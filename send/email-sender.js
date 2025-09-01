// Email Sender Module
// Handles email sending functionality via backend API

window.EmailSender = {
  userData: null,

  /**
   * Set user data for email personalization
   * @param {Object} userData - User profile data
   */
  setUserData(userData) {
    this.userData = userData;
  },

  /**
   * Send email via backend API
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} body - Email body
   * @param {Array} attachments - Email attachments
   * @param {Object} contactInfo - Optional contact information
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(to, subject, body, attachments = [], contactInfo = null) {
    try {
      // Check if BackendAPI is available and authenticated
      if (!window.BackendAPI) {
        throw new Error('Backend API not available');
      }

      if (!window.BackendAPI.isAuthenticated) {
        throw new Error('User not authenticated. Please sign in first.');
      }

      // Send email via backend API
      const result = await window.BackendAPI.sendEmail(to, subject, body, attachments, contactInfo);
      
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  },

  /**
   * Send email and save to history (now handled by backend)
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} body - Email body
   * @param {Array} attachments - Email attachments
   * @returns {Promise<Object>} Send result
   */
  async sendAndSaveEmail(to, subject, body, attachments = []) {
    try {
      // Send the email - backend will handle saving to history
      const result = await this.sendEmail(to, subject, body, attachments);

      // Update the email status in UI if available
      if (window.UIManager) {
        window.UIManager.checkLastEmailSent();
      }

      return result;
    } catch (error) {
      console.error('Error sending and saving email:', error);
      throw error;
    }
  },





  /**
   * Check authentication status
   * @returns {Promise<boolean>} Authentication status
   */
  async checkAuthStatus() {
    if (!window.BackendAPI) {
      return false;
    }
    return window.BackendAPI.isAuthenticated;
  },

  /**
   * Get user profile from backend API
   * @returns {Promise<Object>} User profile
   */
  async getUserProfile() {
    try {
      if (!window.BackendAPI) {
        throw new Error('Backend API not available');
      }

      if (!window.BackendAPI.isAuthenticated) {
        throw new Error('User not authenticated');
      }

      return await window.BackendAPI.getUserProfile();
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  },

  /**
   * Get email history from backend
   * @returns {Promise<Array>} Email history
   */
  async getEmailHistory() {
    try {
      if (!window.BackendAPI) {
        throw new Error('Backend API not available');
      }

      if (!window.BackendAPI.isAuthenticated) {
        throw new Error('User not authenticated');
      }

      return await window.BackendAPI.getEmailHistory();
    } catch (error) {
      console.error('Error getting email history:', error);
      throw error;
    }
  },

  /**
   * Start authentication flow
   * @returns {Promise<void>}
   */
  async startAuthFlow() {
    try {
      if (!window.BackendAPI) {
        throw new Error('Backend API not available');
      }

      await window.BackendAPI.startAuthFlow();
    } catch (error) {
      console.error('Error starting auth flow:', error);
      throw error;
    }
  },

  /**
   * Sign out user
   * @returns {Promise<void>}
   */
  async signOut() {
    try {
      if (!window.BackendAPI) {
        return;
      }

      await window.BackendAPI.signOut();
      
      // Update UI if available
      if (window.UIManager) {
        window.UIManager.updateAuthState();
      }
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmailSender;
} 