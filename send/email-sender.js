// Email Sender Module
// Handles Gmail API integration and email sending functionality

window.EmailSender = {
  currentToken: null,
  userData: null,

  /**
   * Set user data for email personalization
   * @param {Object} userData - User profile data
   */
  setUserData(userData) {
    this.userData = userData;
  },

  /**
   * Send email via Gmail API
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} body - Email body
   * @param {Array} attachments - Email attachments
   * @returns {Promise<Object>} Send result
   */
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

  /**
   * Send email and save to local storage
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} body - Email body
   * @param {Array} attachments - Email attachments
   * @returns {Promise<Object>} Send result
   */
  async sendAndSaveEmail(to, subject, body, attachments = []) {
    try {
      // First send the email
      const result = await this.sendEmail(to, subject, body, attachments);

      // If successful, save to local storage
      if (result) {
        await this._saveEmailToHistory(to, subject, body, attachments);
        return result;
      }
    } catch (error) {
      console.error('Error sending and saving email:', error);
      throw error;
    }
  },

  /**
   * Create email in Gmail format
   * @param {Object} emailData - Email data including to, subject, message, from, attachments
   * @returns {string} Base64 encoded email
   */
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

  /**
   * Process message content for proper formatting
   * @param {string} message - Raw message content
   * @returns {string} Processed message
   */
  processMessageContent(message) {
    if (!message) return '';

    // Convert line breaks to HTML format
    let processedMessage = message
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n/g, '<br>\n');

    // Wrap in basic HTML structure
    processedMessage = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333; }
  </style>
</head>
<body>
  ${processedMessage}
</body>
</html>`.trim();

    return processedMessage;
  },

  /**
   * Get authentication token
   * @returns {Promise<string>} Auth token
   */
  async getAuthToken() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'getAuthToken' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response.error) {
          reject(new Error(response.error.message));
          return;
        }

        this.currentToken = response.token;
        resolve(response.token);
      });
    });
  },

  /**
   * Get user profile from Gmail API
   * @returns {Promise<Object>} User profile
   */
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
  },

  /**
   * Save email to local storage history
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} body - Email body
   * @param {Array} attachments - Email attachments
   * @private
   */
  async _saveEmailToHistory(to, subject, body, attachments) {
    try {
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
    } catch (error) {
      console.error('Error saving email to history:', error);
      // Don't throw here - email was sent successfully, just logging failed
    }
  }
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmailSender;
} 