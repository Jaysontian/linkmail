// gmail-manager.js
window.GmailManager = {
  currentToken: null,
  userData: null, // Add this to store the user data

  async getBackendAuth() {
    try {
      // Check if backend API is available and authenticated
      if (!window.BackendAPI) {
        throw new Error('Backend API not available');
      }

      // Initialize backend API if needed
      await window.BackendAPI.init();

      if (!window.BackendAPI.isAuthenticated) {
        throw new Error('User not authenticated with backend');
      }

      return {
        token: window.BackendAPI.userToken,
        userData: window.BackendAPI.userData
      };
    } catch (error) {
      console.error('Backend auth error:', error);
      throw error;
    }
  },

  // Add a method to set user data
  setUserData(userData) {
    this.userData = userData;
    
    // Also pass user data to EmailSender module if available
    if (window.EmailSender) {
      window.EmailSender.setUserData(userData);
    }
  },

  async sendEmail(to, subject, body, attachments = [], contactInfo = null) {
    // Delegate to EmailSender module if available
    if (window.EmailSender) {
      return await window.EmailSender.sendEmail(to, subject, body, attachments, contactInfo);
    } else {
      // Use backend API for email sending
      try {
        const auth = await this.getBackendAuth();

        // Use backend API to send email
        const response = await window.BackendAPI.sendEmail(to, subject, body, attachments, contactInfo);

        return response;
      } catch (error) {
        throw error;
      }
    }
  },

  // Send email and save to history - delegates to new modules
  async sendAndSaveEmail(to, subject, body, attachments = [], contactInfo = null) {
    try {
      // First send the email using delegation
      const result = await this.sendEmail(to, subject, body, attachments, contactInfo);

      // If successful, save to email history
      if (result) {
        // Get current user email
        const userProfile = await this.getUserProfile();
        const userEmail = userProfile.emailAddress;

        // Get current LinkedIn profile URL and name
        const profileUrl = window.location.href;
        const recipientName = document.querySelector('h1')?.innerText || '';

        // Create email record
        const emailData = {
          recipientEmail: to,
          recipientName: recipientName,
          subject: subject,
          content: body,
          date: new Date().toISOString(),
          linkedInUrl: profileUrl,
          attachments: attachments
        };

        // Delegate to EmailHistory module if available
        if (window.EmailHistory) {
          await window.EmailHistory.saveEmail(userEmail, emailData);
        } else {
          // Fallback to direct storage manipulation
          chrome.storage.local.get([userEmail], (result) => {
            const userData = result[userEmail] || {};

            // Add email to sent emails array
            userData.sentEmails = userData.sentEmails || [];
            userData.sentEmails.push({
              ...emailData,
              attachments: attachments.map(a => ({ name: a.name, size: a.size })) // Only store metadata for fallback
            });

            // Save back to storage
            const data = {};
            data[userEmail] = userData;
            chrome.storage.local.set(data, () => {
              // Update the email status after saving
              if (window.UIManager) {
                window.UIManager.checkLastEmailSent();
              }
            });
          });
        }

        // Update the email status after saving
        if (window.UIManager) {
          window.UIManager.checkLastEmailSent();
        }

        // Persist contacted LinkedIn to backend if available
        try {
          if (window.BackendAPI && window.BackendAPI.isAuthenticated && profileUrl && profileUrl.includes('linkedin.com')) {
            await window.BackendAPI.addContactedLinkedIn(profileUrl);
          }
        } catch (e) {
          console.warn('Failed to update contacted LinkedIn in backend (non-fatal):', e?.message || e);
        }

        return result;
      }
    } catch (error) {
      console.error('Error sending and saving email:', error);
      throw error;
    }
  },

  createEmail({ to, subject, message, from, attachments = [] }) {
    // Process the message to ensure proper line breaks
    const processedMessage = this.processMessageContent(message);

    // Generate a random boundary string for multipart message
    const boundary = 'LinkMail_' + Math.random().toString(36).substring(2);

    // Create email headers with properly quoted sender name
    const fromHeader = (from?.name && from.name.trim()) 
      ? `From: "${from.name}" <${from.email}>`  // Properly quote the name if available
      : `From: ${from?.email || 'me'}`;         // Otherwise just use email
    
    const headers = [
      'MIME-Version: 1.0',
      fromHeader,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',  // Empty line separates headers from body
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',  // Empty line separates headers from content
      processedMessage
    ];

    // Add attachments if any
    if (attachments && attachments.length > 0) {
      attachments.forEach(attachment => {
        if (attachment.data) {
          headers.push(`--${boundary}`);
          headers.push(`Content-Type: ${attachment.type || 'application/pdf'}`);
          headers.push('Content-Transfer-Encoding: base64');
          headers.push(`Content-Disposition: attachment; filename="${attachment.name}"`);
          headers.push('');  // Empty line separates headers from content

          // Add the attachment data - split into chunks to avoid line length issues
          const chunkSize = 76;
          let remainingData = attachment.data;
          while (remainingData.length > 0) {
            headers.push(remainingData.substring(0, chunkSize));
            remainingData = remainingData.substring(chunkSize);
          }
        }
      });
    }

    // Add closing boundary
    headers.push(`--${boundary}--`);

    // Join all parts with CRLF
    const email = headers.join('\r\n');

    // Encode the email for Gmail API
    return btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  },

  processMessageContent(message) {
    // Group text into paragraphs
    const paragraphs = message.split('\n\n').map(p => p.trim()).filter(p => p);

    // Process each paragraph - handle line breaks within paragraphs
    const processedParagraphs = paragraphs.map(paragraph => {
      // Replace single line breaks with spaces if they're within a paragraph
      const processedParagraph = paragraph
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();

      // Escape HTML special characters
      return processedParagraph
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    });

    // Join paragraphs with proper spacing
    const htmlContent = processedParagraphs
      .map(p => `<p>${p}</p>`)
      .join('');

    // Wrap the content in HTML structure
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #333;
          }
          p {
            margin: 0 0 10px 0;
            padding: 0;
            line-height: 1.4;
          }
        </style>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; color: #333;">
          ${htmlContent}
        </div>
      </body>
      </html>
    `;
  },

  async getUserProfile() {
    try {
      const auth = await this.getBackendAuth();
      
      // Use backend user data to construct a profile
      const userData = auth.userData;
      
      // Return a profile object that matches what the calling code expects
      return {
        emailAddress: userData.email,
        messagesTotal: 0, // We don't have this info from backend
        threadsTotal: 0   // We don't have this info from backend
      };
    } catch (error) {
      throw error;
    }
  }
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GmailManager;
}
