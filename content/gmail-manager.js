// gmail-manager.js
window.GmailManager = {
  currentToken: null,

  async getAuthToken() {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: "getAuthToken" },
          (response) => resolve(response)
        );
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      this.currentToken = response.token;
      return response.token;
    } catch (error) {
      console.error('Auth error:', error);
      throw error;
    }
  },

  async sendEmail(to, subject, body) {
    try {
      if (!this.currentToken) {
        await this.getAuthToken();
      }

      const message = {
        raw: this.createEmail({
          to,
          subject,
          message: body
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
        return this.sendEmail(to, subject, body);
      }
      throw error;
    }
  },

  createEmail({ to, subject, message }) {
    const email = [
      'Content-Type: text/plain; charset="UTF-8"\n',
      'MIME-Version: 1.0\n',
      'Content-Transfer-Encoding: 7bit\n',
      'to: ', to, '\n',
      'subject: ', subject, '\n\n',
      message
    ].join('');

    return btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
};
