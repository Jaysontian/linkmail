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
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000) // 10 second timeout
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
      } else if (response.status === 429) {
        // Rate limited - this is likely the "Too many requests" error
        console.log('Extension poll rate limited, will retry later');
        throw new Error('Rate limited - too many requests');
      } else {
        console.log('Extension poll failed:', response.status);
      }
    } catch (error) {
      if (error.message.includes('Rate limited')) {
        console.error('Rate limiting detected:', error);
        throw error; // Re-throw rate limit errors
      } else {
        console.error('Error polling for extension token:', error);
      }
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
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (response.ok) {
        return true;
      } else if (response.status === 401) {
        // Only clear auth if we get a definitive 401 (unauthorized)
        console.log('Token verification failed with 401, clearing auth');
        return false;
      } else {
        // For other errors (network issues, 500s, etc.), assume token is still valid
        // to avoid clearing auth due to temporary backend issues
        console.log(`Token verification returned ${response.status}, assuming token is still valid`);
        return true;
      }
    } catch (error) {
      // Network errors or timeouts - assume token is still valid to avoid clearing auth
      console.log('Token verification network error, assuming token is still valid:', error.message);
      return true;
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

      const json = await response.json();
      const user = json && json.user ? json.user : json;
      await this.storeAuth(token, user);
      
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
   * @param {Object} contactInfo - Optional contact information
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(to, subject, body, attachments = [], contactInfo = null) {
    // Validate authentication first
    const isAuthValid = await this.validateAuth();
    if (!isAuthValid) {
      throw new Error('User not authenticated. Please sign in first.');
    }

    // Validate required parameters
    if (!to || !subject || !body) {
      throw new Error('Missing required email parameters (to, subject, body)');
    }

    const emailData = {
      to: to.trim(),
      subject: subject.trim(),
      body: body.trim(),
      attachments: attachments || []
    };

    // Add contact information if provided
    if (contactInfo && typeof contactInfo === 'object') {
      emailData.contactInfo = contactInfo;
    }

    console.log('[BackendAPI] Sending email:', {
      to: emailData.to,
      subject: emailData.subject,
      bodyLength: emailData.body.length,
      attachmentsCount: emailData.attachments.length,
      hasToken: !!this.userToken,
      baseURL: this.baseURL
    });

    try {
      const url = `${this.baseURL}/api/email/send`;
      console.log('[BackendAPI] Making request to:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData),
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      console.log('[BackendAPI] Response status:', response.status);
      console.log('[BackendAPI] Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.status === 401) {
        console.error('[BackendAPI] Authentication failed - token expired');
        // Token expired, clear auth and throw error
        await this.clearAuth();
        throw new Error('Authentication expired. Please sign in again.');
      }

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          console.error('[BackendAPI] Server error:', errorData);
        } catch (parseError) {
          console.error('[BackendAPI] Failed to parse error response:', parseError);
          const errorText = await response.text();
          console.error('[BackendAPI] Error response text:', errorText);
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('[BackendAPI] Email sent successfully:', result);
      return result;

    } catch (error) {
      console.error('[BackendAPI] Email sending error:', error);
      
      // Provide more specific error messages
      if (error.name === 'AbortError') {
        throw new Error('Email sending timed out. Please check your connection and try again.');
      }
      
      if (error.message.includes('Authentication expired')) {
        // Re-throw auth errors as-is
        throw error;
      }
      
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error: Unable to connect to email service. Please check your internet connection and try again.');
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

      const json = await response.json();
      const user = json && json.user ? json.user : json;
      this.userData = user;
      
      // Update stored user data
      await this.storeAuth(this.userToken, user);
      
      return { success: true, user };
    } catch (error) {
      console.error('Failed to get user profile:', error);
      throw error;
    }
  },

  /**
   * Get persisted user bio from backend
   */
  async getUserBio() {
    if (!this.isAuthenticated) {
      throw new Error('User not authenticated');
    }
    const response = await fetch(`${this.baseURL}/api/user/bio`, {
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
      throw new Error('Failed to fetch user bio');
    }
    return await response.json();
  },

  /**
   * Save user bio to backend
   */
  async saveUserBio(bio) {
    if (!this.isAuthenticated) {
      throw new Error('User not authenticated');
    }
    const response = await fetch(`${this.baseURL}/api/user/bio`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bio)
    });
    if (response.status === 401) {
      await this.clearAuth();
      throw new Error('Authentication expired. Please sign in again.');
    }
    if (!response.ok) {
      let err = 'Failed to save user bio';
      try { const e = await response.json(); err = e.message || e.error || err; } catch (_e) {}
      throw new Error(err);
    }
    return await response.json();
  },

  /**
   * Save templates to backend (stores as [{title, body}])
   */
  async saveTemplates(templates) {
    // Merge with current backend profile snapshot to avoid wiping columns
    try {
      const resp = await this.getUserBio();
      const profile = resp && resp.profile ? resp.profile : {};
      const existingExperiences = Array.isArray(profile.experiences) ? profile.experiences : [];
      const existingSkills = Array.isArray(profile.skills) ? profile.skills : [];
      const linkedin_url = typeof profile.linkedin_url === 'string' ? profile.linkedin_url : undefined;
      const first_name = typeof profile.first_name === 'string' ? profile.first_name : undefined;
      const last_name = typeof profile.last_name === 'string' ? profile.last_name : undefined;
      const payload = {
        templates,
        experiences: existingExperiences,
        skills: existingSkills
      };
      if (linkedin_url) payload.linkedinUrl = linkedin_url;
      if (first_name) payload.firstName = first_name;
      if (last_name) payload.lastName = last_name;
      return await this.saveUserBio(payload);
    } catch (_e) {
      // Fallback to sending templates only; server will COALESCE others
      return await this.saveUserBio({ templates });
    }
  },

  /**
   * Append a contacted LinkedIn profile URL to backend
   */
  async addContactedLinkedIn(linkedinUrl) {
    if (!this.isAuthenticated) {
      throw new Error('User not authenticated');
    }
    const response = await fetch(`${this.baseURL}/api/user/contacted`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ linkedinUrl })
    });
    if (response.status === 401) {
      await this.clearAuth();
      throw new Error('Authentication expired. Please sign in again.');
    }
    if (!response.ok) {
      let err = 'Failed to update contacted linkedins';
      try { const e = await response.json(); err = e.message || e.error || err; } catch (_e) {}
      throw new Error(err);
    }
    return await response.json();
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
   * Get best contact email by LinkedIn profile URL
   * @param {string} linkedinUrl - Raw LinkedIn profile URL (window.location.href)
   * @returns {Promise<Object>} EmailByLinkedInResponse
   */
  async getEmailByLinkedIn(linkedinUrl, extra = {}) {
    if (!this.isAuthenticated || !this.userToken) {
      throw new Error('User not authenticated');
    }

    if (!linkedinUrl || typeof linkedinUrl !== 'string') {
      throw new Error('linkedinUrl is required');
    }

    try {
      const normalizedUrl = this._normalizeLinkedInUrl(linkedinUrl);
      const params = new URLSearchParams({ linkedinUrl: normalizedUrl });
      try {
        const maybeAdd = (key) => {
          const value = (extra && typeof extra[key] === 'string') ? extra[key].trim() : '';
          if (value) params.append(key, value);
        };
        maybeAdd('firstName');
        maybeAdd('lastName');
        maybeAdd('company');
      } catch (_e) {}
      const primaryBase = this.apiBaseURL || this.baseURL;
      const candidates = [primaryBase];
      // Host fallback: try the sibling host if primary fails (mirrors how facets is resilient by path)
      try {
        const u = new URL(primaryBase);
        if (u.hostname.includes('linkmail-sending')) {
          candidates.push('https://linkmail-api.vercel.app');
        } else if (u.hostname.includes('linkmail-api')) {
          candidates.push('https://linkmail-sending.vercel.app');
        }
      } catch (_) {}

      let response = null;
      let lastError = '';
      for (let i = 0; i < candidates.length; i++) {
        const base = candidates[i];
        const url = `${base}/api/contacts/email-by-linkedin?${params.toString()}`;
        console.log('[BackendAPI] Fetching email by LinkedIn URL:', { url, normalizedUrl, extra });
        try {
          response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.userToken}`,
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });
        } catch (e) {
          lastError = e?.message || String(e);
          continue;
        }
        if (response && response.status !== 404) break; // only fallback on 404/network
      }
      if (!response) {
        throw new Error(lastError || 'Network error');
      }

      if (response.status === 401 || response.status === 403) {
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
      console.log('[BackendAPI] Email-by-LinkedIn response:', json);
      return json;
    } catch (error) {
      console.error('Failed to fetch email by LinkedIn URL:', error);
      throw error;
    }
  },

  /**
   * Find email using Apollo People Search API
   * @param {Object} searchData - Search parameters
   * @param {string} searchData.firstName - First name
   * @param {string} searchData.lastName - Last name
   * @param {string} searchData.company - Company name
   * @param {string} searchData.linkedinUrl - LinkedIn URL
   * @returns {Promise<Object>} Apollo search response
   */
  async findEmailWithApollo(searchData) {
    if (!this.isAuthenticated) {
      throw new Error('User not authenticated');
    }

    if (!searchData || typeof searchData !== 'object') {
      throw new Error('searchData is required');
    }

    try {
      const primaryBase = this.apiBaseURL || this.baseURL;
      const candidates = [primaryBase];
      
      // Host fallback: try the sibling host if primary fails
      try {
        const u = new URL(primaryBase);
        if (u.hostname.includes('linkmail-sending')) {
          candidates.push('https://linkmail-api.vercel.app');
        } else if (u.hostname.includes('linkmail-api')) {
          candidates.push('https://linkmail-sending.vercel.app');
        }
      } catch (_) {}

      let response = null;
      let lastError = '';
      
      for (let i = 0; i < candidates.length; i++) {
        const base = candidates[i];
        const url = `${base}/api/contacts/apollo-email-search`;
        
        console.log('[BackendAPI] Apollo email search:', { url, searchData });
        
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.userToken}`,
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(searchData)
          });
        } catch (e) {
          lastError = e?.message || String(e);
          continue;
        }
        
        if (response && response.status !== 404) break; // only fallback on 404/network
      }
      
      if (!response) {
        throw new Error(lastError || 'Network error');
      }

      if (response.status === 401 || response.status === 403) {
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
      console.log('[BackendAPI] Apollo email search response:', json);
      return json;
    } catch (error) {
      console.error('Failed to search email with Apollo:', error);
      throw error;
    }
  },

  /**
   * Normalize a LinkedIn profile URL to canonical form:
   * https://www.linkedin.com/in/{slug}/ (lowercased slug, no query/hash)
   */
  _normalizeLinkedInUrl(rawUrl) {
    try {
      const u = new URL(rawUrl);
      const match = u.pathname.match(/\/in\/([^\/?#]+)/i);
      if (match && match[1]) {
        const slug = match[1].toLowerCase();
        return `https://www.linkedin.com/in/${slug}/`;
      }
      // Fallback: strip query/hash, force https and www if linkedin domain
      const isLinkedIn = /(^|\.)linkedin\.com$/i.test(u.hostname);
      const host = isLinkedIn ? 'www.linkedin.com' : u.hostname;
      const path = u.pathname.replace(/\/$/, '');
      return `https://${host}${path ? path + '/' : '/'}`;
    } catch (_e) {
      return rawUrl;
    }
  },

  /**
   * Test backend connectivity
   * @returns {Promise<Object>} Connectivity test result
   */
  async testConnectivity() {
    console.log('[BackendAPI] Testing backend connectivity...');
    
    try {
      const url = `${this.baseURL}/api/health`;
      console.log('[BackendAPI] Testing connection to:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      const isHealthy = response.ok;
      const status = response.status;
      
      let responseData = null;
      try {
        responseData = await response.json();
      } catch (e) {
        responseData = await response.text();
      }
      
      console.log('[BackendAPI] Connectivity test result:', { isHealthy, status, responseData });
      
      return {
        success: isHealthy,
        status,
        data: responseData,
        url,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('[BackendAPI] Connectivity test failed:', error);
      
      return {
        success: false,
        error: error.message,
        url: `${this.baseURL}/api/health`,
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Validate authentication before making API calls
   * @returns {Promise<boolean>} Whether auth is valid
   */
  async validateAuth() {
    console.log('[BackendAPI] Validating authentication...');
    
    if (!this.isAuthenticated || !this.userToken) {
      console.log('[BackendAPI] Not authenticated or missing token');
      return false;
    }
    
    try {
      // Test the token by making a simple API call
      const isValid = await this.verifyToken();
      
      if (!isValid) {
        console.log('[BackendAPI] Token validation failed');
        await this.clearAuth();
        return false;
      }
      
      console.log('[BackendAPI] Authentication is valid');
      return true;
      
    } catch (error) {
      console.error('[BackendAPI] Auth validation error:', error);
      return false;
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
      baseURL: this.baseURL,
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