// gmail-manager.js
window.GmailManager = {
  currentToken: null,
  userData: null, // Add this to store the user data

  async getAuthToken() {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: "getAuthToken" },
          (response) => resolve(response)
        );
      });

      if (response.error) {
        console.log("could not get auth token!");
        throw new Error(response.error.message);
      }

      this.currentToken = response.token;
      return response.token;
    } catch (error) {
      console.error('Auth error:', error);
      throw error;
    }
  },

  // Add a method to set user data
  setUserData(userData) {
    this.userData = userData;
    console.log('GmailManager: User data set', userData?.name);
  },

  async sendEmail(to, subject, body, attachments = []) {
    try {
      if (!this.currentToken) {
        await this.getAuthToken();
      }

      // Get user profile to use for the From header
      const userProfile = await this.getUserProfile();
      const userEmail = userProfile.emailAddress;

      // Create the message with the proper From header and attachments
      const message = {
        raw: this.createEmail({
          to,
          subject,
          message: body,
          from: {
            email: userEmail,
            name: this.userData?.name || userEmail.split('@')[0]
          },
          attachments
        })
      };

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.currentToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to send email');
      }

      return await response.json();
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('invalid_token')) {
        // Token expired or invalid, try to get a new one
        this.currentToken = null;
        await this.getAuthToken();
        // Retry the send once
        return this.sendEmail(to, subject, body, attachments);
      }
      throw error;
    }
  },

  // Update the sendAndSaveEmail method in gmail-manager.js to include a callback to update the status
  async sendAndSaveEmail(to, subject, body, attachments = []) {
    try {
      // First send the email
      const result = await this.sendEmail(to, subject, body, attachments);
      
      // If successful, save to local storage
      if (result) {
        // Get current user email
        const userProfile = await this.getUserProfile();
        const userEmail = userProfile.emailAddress;
        
        // Get current LinkedIn profile URL and name
        const profileUrl = window.location.href;
        const recipientName = document.querySelector('h1')?.innerText || '';
        
        // Create email record
        const emailRecord = {
          recipientEmail: to,
          recipientName: recipientName,
          subject: subject,
          content: body,
          date: new Date().toISOString(),
          linkedInUrl: profileUrl,
          attachments: attachments.map(a => ({ name: a.name, size: a.size })) // Only store metadata, not the actual file
        };
        
        // Get existing user data
        chrome.storage.local.get([userEmail], (result) => {
          const userData = result[userEmail] || {};
          
          // Add email to sent emails array
          userData.sentEmails = userData.sentEmails || [];
          userData.sentEmails.push(emailRecord);
          
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
    
    // Create email headers
    const headers = [
      'MIME-Version: 1.0',
      from?.name ? `From: ${from.name} <${from.email}>` : `From: ${from?.email || 'me'}`,
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
      if (!this.currentToken) {
        await this.getAuthToken();
      }

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.currentToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch user profile');
      }

      return await response.json();
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('invalid_token')) {
        // Token expired or invalid, try to get a new one
        this.currentToken = null;
        await this.getAuthToken();
        // Retry the fetch once
        return this.getUserProfile();
      }
      throw error;
    }
  }
};