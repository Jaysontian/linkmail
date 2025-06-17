// apollo-client.js

window.ApolloClient = {
  // Authentication state - now using simple API key
  authState: {
    isAuthenticated: false,
    apiKey: null
  },
  
  // Initialize the Apollo client
  async init() {
    try {
      // Load API key from storage
      const authData = await new Promise(resolve => {
        chrome.storage.local.get(['apolloApiKey'], result => {
          resolve(result.apolloApiKey || null);
        });
      });
      
      if (authData) {
        this.authState = {
          isAuthenticated: true,
          apiKey: authData
        };
        console.log('Apollo API key loaded from storage');
        
        // Test the API key to ensure it's still valid
        const isValid = await this.testApiKey();
        if (!isValid) {
          console.log('Apollo API key is invalid, clearing from storage');
          await this.clearAuthState();
        }
      }
    } catch (error) {
      console.error('Error initializing Apollo client:', error);
      await this.clearAuthState();
    }
    
    return this.authState.isAuthenticated;
  },
  
  // Test if the API key is valid
  async testApiKey() {
    if (!this.authState.apiKey) {
      return false;
    }
    
    try {
      const response = await fetch('https://api.apollo.io/v1/auth/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': this.authState.apiKey
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.is_logged_in === true && data.credits_remaining !== undefined;
      }
      
      return false;
    } catch (error) {
      console.error('Error testing Apollo API key:', error);
      return false;
    }
  },
  
  // Set API key manually (user will need to input their API key)
  async setApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key provided');
    }
    
    // Store the API key temporarily to test it
    const tempAuthState = {
      isAuthenticated: true,
      apiKey: apiKey.trim()
    };
    
    // Test the API key
    const previousState = this.authState;
    this.authState = tempAuthState;
    
    const isValid = await this.testApiKey();
    
    if (isValid) {
      // Save to storage
      await this.saveAuthState();
      console.log('Apollo API key set and validated successfully');
      return true;
    } else {
      // Restore previous state
      this.authState = previousState;
      throw new Error('Invalid Apollo API key provided');
    }
  },
  
  // Save auth state to storage
  async saveAuthState() {
    return new Promise(resolve => {
      chrome.storage.local.set({ apolloApiKey: this.authState.apiKey }, resolve);
    });
  },
  
  // Clear auth state
  async clearAuthState() {
    this.authState = {
      isAuthenticated: false,
      apiKey: null
    };
    
    return new Promise(resolve => {
      chrome.storage.local.remove('apolloApiKey', resolve);
    });
  },
  
  // Check if Apollo is authenticated
  isAuthenticated() {
    return this.authState.isAuthenticated && this.authState.apiKey;
  },
  
  // Logout from Apollo
  async logout() {
    await this.clearAuthState();
    return true;
  },
  
  // Search for a person's email using Apollo API
  async findEmail(personData) {
    try {
      if (!this.authState.isAuthenticated || !this.authState.apiKey) {
        throw new Error('Not authenticated with Apollo');
      }
      
      const response = await fetch('https://api.apollo.io/api/v1/people/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': this.authState.apiKey
        },
        body: JSON.stringify({
          first_name: personData.firstName,
          last_name: personData.lastName,
          name: personData.name,
          linkedin_url: personData.linkedinUrl,
          reveal_personal_emails: true
        })
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Apollo API key is invalid or has insufficient permissions');
        }
        throw new Error(`Apollo API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.person && data.person.email) {
        return data.person.email;
      }
      
      // Try to find email in other fields
      if (data.person && data.person.personal_emails && data.person.personal_emails.length > 0) {
        return data.person.personal_emails[0];
      }
      
      return null;
    } catch (error) {
      console.error('Error finding email via Apollo:', error);
      throw error;
    }
  }
};