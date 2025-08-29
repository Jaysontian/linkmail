// Backend API Module
// Handles all communication with the LinkMail backend service

window.BackendAPI = {
  // Backend configuration
  baseURL: 'https://linkmail-sending.vercel.app',
  // Data API (facets, etc.) lives on the same backend
  apiBaseURL: 'https://linkmail-sending.vercel.app',
  
  // User authentication state
  isAuthenticated: false,
  userToken: null,
  userData: null,

  /**
   * Initialize the backend API client
   */
  async init() {
    // Check if user is already authenticated
    const result = await this.getStoredAuth();
    if (result.token && result.userData) {
      this.userToken = result.token;
      this.userData = result.userData;
      this.isAuthenticated = true;
      
      // Verify token is still valid
      const isValid = await this.verifyToken();
      if (!isValid) {
        await this.clearAuth();
      }
      return; // Don't poll if already authenticated
    }
    
    // Only check for auth success data if not already authenticated
    await this.checkForAuthSuccess();
  },

  /**
   * Check for authentication success data from OAuth flow
   * Polls the backend for available extension tokens
   */
  async checkForAuthSuccess() {
    try {
      console.log('Polling backend for extension token...');
      
      const response = await fetch(`${this.baseURL}/api/auth/extension-poll`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Extension poll response:', data);
        
        if (data.success && data.token && data.userData) {
          console.log('Found extension token! Storing authentication data...');
          
          // Store the authentication data
          await this.storeAuth(data.token, data.userData);
          console.log('Authentication data stored successfully from extension poll');
          return true;
        } else {
          console.log('No extension token available yet');
        }
      } else {
        console.log('Extension poll failed:', response.status);
      }
    } catch (error) {
      console.error('Error polling for extension token:', error);
    }
    return false;
  },

  /**
   * Get stored authentication data
   * @returns {Promise<Object>} Stored auth data
   */
  async getStoredAuth() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['backendToken', 'backendUserData'], (result) => {
        resolve({
          token: result.backendToken,
          userData: result.backendUserData
        });
      });
    });
  },

  /**
   * Store authentication data
   * @param {string} token - User token
   * @param {Object} userData - User data
   */
  async storeAuth(token, userData) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        backendToken: token,
        backendUserData: userData
      }, () => {
        this.userToken = token;
        this.userData = userData;
        this.isAuthenticated = true;
        resolve();
      });
    });
  },

  /**
   * Clear stored authentication data
   */
  async clearAuth() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['backendToken', 'backendUserData'], () => {
        this.userToken = null;
        this.userData = null;
        this.isAuthenticated = false;
        resolve();
      });
    });
  },

  /**
   * Verify if the stored token is still valid
   * @returns {Promise<boolean>} Token validity
   */
  async verifyToken() {
    if (!this.userToken) return false;

    try {
      const response = await fetch(`${this.baseURL}/api/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.userToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  },

  /**
   * Start the authentication flow
   * Opens the backend login page in a new tab
   */
  async startAuthFlow() {
    const authURL = `${this.baseURL}/api/auth/google?source=extension`;
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'openAuthPage',
        url: authURL
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  },

  /**
   * Complete authentication with token from backend
   * @param {string} token - Authentication token from backend
   * @returns {Promise<Object>} User data
   */
  async completeAuth(token) {
    try {
      // Get user data from backend
      const response = await fetch(`${this.baseURL}/api/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get user profile');
      }

      const userData = await response.json();
      await this.storeAuth(token, userData);
      
      return userData;
    } catch (error) {
      console.error('Auth completion failed:', error);
      throw error;
    }
  },

  /**
   * Send email via backend API
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} body - Email body
   * @param {Array} attachments - Email attachments
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(to, subject, body, attachments = []) {
    if (!this.isAuthenticated) {
      throw new Error('User not authenticated. Please sign in first.');
    }

    try {
      const response = await fetch(`${this.baseURL}/api/email/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to,
          subject,
          body,
          attachments
        })
      });

      if (response.status === 401) {
        // Token expired, clear auth and throw error
        await this.clearAuth();
        throw new Error('Authentication expired. Please sign in again.');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      return await response.json();
    } catch (error) {
      if (error.message.includes('Authentication expired')) {
        // Re-throw auth errors
        throw error;
      }
      throw new Error(`Email sending failed: ${error.message}`);
    }
  },

  /**
   * Get user's email history from backend
   * @returns {Promise<Array>} Email history
   */
  async getEmailHistory() {
    if (!this.isAuthenticated) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch(`${this.baseURL}/api/email/history`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        await this.clearAuth();
        throw new Error('Authentication expired. Please sign in again.');
      }

      if (!response.ok) {
        throw new Error('Failed to fetch email history');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get email history:', error);
      throw error;
    }
  },

  /**
   * Get user profile data
   * @returns {Promise<Object>} User profile
   */
  async getUserProfile() {
    if (!this.isAuthenticated) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch(`${this.baseURL}/api/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        await this.clearAuth();
        throw new Error('Authentication expired. Please sign in again.');
      }

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const userData = await response.json();
      this.userData = userData;
      
      // Update stored user data
      await this.storeAuth(this.userToken, userData);
      
      return userData;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      throw error;
    }
  },

  /**
   * Sign out user
   * @returns {Promise<void>}
   */
  async signOut() {
    try {
      // Call backend logout endpoint
      if (this.userToken) {
        await fetch(`${this.baseURL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.userToken}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Backend logout failed:', error);
      // Continue with local cleanup even if backend call fails
    }

    // Clear local auth data
    await this.clearAuth();
  },

  /**
   * Fetch contact facets (job titles and companies) for dropdowns
   * @returns {Promise<{ jobTitles: string[], companies: string[] }>}
   */
  async getContactFacets() {
    if (!this.isAuthenticated || !this.userToken) {
      throw new Error('User not authenticated');
    }

    try {
      // Try primary exact endpoint, then fallbacks if 404
      const base = this.apiBaseURL || this.baseURL;
      const paths = ['/api/contacts/facets', '/contacts/facets', '/api/v1/contacts/facets'];
      let response = null;
      let lastErrorText = '';
      for (let i = 0; i < paths.length; i++) {
        const url = `${base}${paths[i]}`;
        try {
          response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.userToken}`,
              'Content-Type': 'application/json'
            }
          });
        } catch (e) {
          lastErrorText = e?.message || String(e);
          continue;
        }
        if (response && response.status !== 404) {
          break;
        }
      }
      if (!response) {
        throw new Error(lastErrorText || 'Network error');
      }

      if (response.status === 401) {
        await this.clearAuth();
        throw new Error('Authentication expired. Please sign in again.');
      }

      if (!response.ok) {
        let errText = '';
        try {
          const e = await response.json();
          errText = e.message || e.error || JSON.stringify(e);
        } catch (_) {
          errText = await response.text().catch(() => 'Unknown error');
        }
        throw new Error(errText || `HTTP ${response.status}`);
      }

      const json = await response.json();
      const jobTitles = Array.isArray(json.jobTitles) ? json.jobTitles : [];
      const companies = Array.isArray(json.companies) ? json.companies : [];
      return { jobTitles, companies };
    } catch (error) {
      console.error('Failed to fetch contact facets:', error);
      throw error;
    }
  },

  /**
   * Search contacts by jobTitle and company (returns up to 3)
   * @param {string} jobTitle
   * @param {string} company
   * @returns {Promise<{ results: Array }>} contacts list
   */
  async searchContacts(jobTitle, company) {
    if (!this.isAuthenticated || !this.userToken) {
      throw new Error('User not authenticated');
    }
    if (!jobTitle || !company) {
      throw new Error('Both jobTitle and company are required');
    }

    try {
      const base = this.apiBaseURL || this.baseURL;
      const params = new URLSearchParams({ jobTitle, company });
      const url = `${base}/api/contacts/search?${params.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        await this.clearAuth();
        throw new Error('Authentication expired. Please sign in again.');
      }

      if (!response.ok) {
        let errText = '';
        try {
          const e = await response.json();
          errText = e.message || e.error || JSON.stringify(e);
        } catch (_) {
          errText = await response.text().catch(() => 'Unknown error');
        }
        throw new Error(errText || `HTTP ${response.status}`);
      }

      const json = await response.json();
      const results = Array.isArray(json.results) ? json.results : [];
      return { results };
    } catch (error) {
      console.error('Failed to search contacts:', error);
      throw error;
    }
  },

  /**
   * Debug method to check authentication state
   * @returns {Promise<Object>} Current auth state
   */
  async debugAuthState() {
    const storedAuth = await this.getStoredAuth();
    
    return {
      currentState: {
        isAuthenticated: this.isAuthenticated,
        hasToken: !!this.userToken,
        hasUserData: !!this.userData,
        userEmail: this.userData?.email
      },
      storedAuth: {
        hasStoredToken: !!storedAuth.token,
        hasStoredUserData: !!storedAuth.userData,
        storedUserEmail: storedAuth.userData?.email
      },
      timestamp: new Date().toISOString()
    };
  }
};

// Initialize on load
if (typeof window !== 'undefined') {
  window.BackendAPI.init();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BackendAPI;
}