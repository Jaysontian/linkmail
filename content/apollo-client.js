// apollo-client.js

window.ApolloClient = {
  // Constants for Apollo OAuth
  APOLLO_AUTH_URL: 'https://app.apollo.io/#/oauth/authorize',
  APOLLO_TOKEN_URL: 'https://app.apollo.io/api/v1/oauth/token',
  APOLLO_API_URL: 'https://api.apollo.io/v1',
  CLIENT_ID: 'Q6r543Suh-EvrVGq56bZk1HofGihh-jlvQoLln8DoEM', 
  CLIENT_SECRET: 'j8XBK-Px1dV66heCzBBl-neZN1Nd8UVR9OimPnSntjM', 
  REDIRECT_URI: 'https://igupta1.github.io/apollo-redirect/apollo-redirect.html',
  
  // Authentication state
  authState: {
    isAuthenticated: false,
    accessToken: null,
    refreshToken: null,
    expiresAt: null
  },
  
  // Initialize the Apollo client
  async init() {
    try {
      // Load auth state from storage
      const authData = await new Promise(resolve => {
        chrome.storage.local.get(['apolloAuth'], result => {
          resolve(result.apolloAuth || {});
        });
      });
      
      if (authData.accessToken && authData.expiresAt) {
        // Check if token is expired
        const now = Date.now();
        if (now < authData.expiresAt) {
          this.authState = authData;
          console.log('Apollo auth state loaded from storage');
          
          // If token expires soon (in less than 1 day), refresh it
          if (authData.expiresAt - now < 24 * 60 * 60 * 1000) {
            await this.refreshToken();
          }
        } else {
          console.log('Apollo token expired, will need to re-authenticate');
          // Token is expired, clear it
          await this.clearAuthState();
        }
      }
    } catch (error) {
      console.error('Error initializing Apollo client:', error);
      await this.clearAuthState();
    }
    
    return this.authState.isAuthenticated;
  },
  
  // Start the OAuth flow - alternative method without chrome.identity
  // Start the OAuth flow - with fallback for when chrome.tabs is not available
async authenticate() {
  try {
    // Generate a random state string for security
    const state = this.generateRandomString(16);
    
    // Save state to storage for verification later
    if (chrome.storage && chrome.storage.local) {
      await new Promise(resolve => {
        chrome.storage.local.set({ 'apolloAuthState': state }, resolve);
      });
    } else {
      // Fallback to sessionStorage if chrome.storage is not available
      sessionStorage.setItem('apolloAuthState', state);
    }
    
    // Build the OAuth URL
    const authUrl = this.buildAuthUrl(state);
    
    console.log('Starting Apollo authentication with URL:', authUrl);
    
    // Try to use chrome.tabs if available, otherwise use window.open
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      // Use chrome.tabs API
      return new Promise((resolve, reject) => {
        try {
          chrome.tabs.create({ url: authUrl }, (tab) => {
            console.log('Opened authentication tab:', tab.id);
            
            // Set up a listener for when this tab is updated (will catch redirects)
            const tabListener = async (tabId, changeInfo) => {
              // Only proceed if this is our tab and it has a URL change
              if (tabId !== tab.id || !changeInfo.url) return;
              
              // Check if the URL is our redirect URL
              if (changeInfo.url.startsWith(this.REDIRECT_URI)) {
                console.log('Detected redirect to our URL:', changeInfo.url);
                
                // Remove the listener since we've caught our redirect
                chrome.tabs.onUpdated.removeListener(tabListener);
                
                try {
                  // Process the redirect URL
                  const url = new URL(changeInfo.url);
                  const code = url.searchParams.get('code');
                  const returnedState = url.searchParams.get('state');
                  
                  // Get our saved state
                  const savedState = await new Promise(resolve => {
                    chrome.storage.local.get(['apolloAuthState'], result => {
                      resolve(result.apolloAuthState || '');
                    });
                  });
                  
                  // Verify state to prevent CSRF attacks
                  if (savedState !== returnedState) {
                    throw new Error('State mismatch in OAuth callback');
                  }
                  
                  if (!code) {
                    throw new Error('No authorization code received');
                  }
                  
                  // Close the auth tab
                  chrome.tabs.remove(tab.id);
                  
                  // Exchange the code for an access token
                  await this.getAccessToken(code);
                  
                  resolve(true);
                } catch (error) {
                  console.error('Error processing auth redirect:', error);
                  chrome.tabs.remove(tab.id);
                  reject(error);
                }
              }
            };
            
            chrome.tabs.onUpdated.addListener(tabListener);
            
            // Also set up a listener for when the tab is closed without completing auth
            const tabClosedListener = (tabId) => {
              if (tabId === tab.id) {
                chrome.tabs.onRemoved.removeListener(tabClosedListener);
                chrome.tabs.onUpdated.removeListener(tabListener);
                
                reject(new Error('Authentication was cancelled'));
              }
            };
            
            chrome.tabs.onRemoved.addListener(tabClosedListener);
          });
        } catch (error) {
          console.error('Error creating authentication tab:', error);
          reject(error);
        }
      });
    } else {
      // Fallback: Use regular window.open
      console.log('chrome.tabs API not available, using window.open fallback');
      
      // Open the auth URL in a new window
      const authWindow = window.open(authUrl, '_blank', 'width=800,height=600');
      
      if (!authWindow) {
        throw new Error('Could not open authentication window. Please check if pop-ups are blocked.');
      }
      
      // Set up a timer to check the window location
      const checkInterval = 500; // Check every 500ms
      const maxChecks = 120; // Maximum of 60 seconds (120 * 500ms)
      let checkCount = 0;
      
      return new Promise((resolve, reject) => {
        // Poll the redirect URL
        const checkRedirect = async () => {
          checkCount++;
          
          // Check if window has been closed
          if (authWindow.closed) {
            clearInterval(intervalId);
            reject(new Error('Authentication window was closed'));
            return;
          }
          
          // Check if we've reached the maximum number of checks
          if (checkCount >= maxChecks) {
            clearInterval(intervalId);
            authWindow.close();
            reject(new Error('Authentication timed out'));
            return;
          }
          
          try {
            // Try to get the window's URL
            // This will throw an error if the URL is from a different origin
            const currentUrl = authWindow.location.href;
            
            // Check if the URL is our redirect URL
            if (currentUrl.startsWith(this.REDIRECT_URI)) {
              clearInterval(intervalId);
              
              // Process the redirect URL
              const url = new URL(currentUrl);
              const code = url.searchParams.get('code');
              const returnedState = url.searchParams.get('state');
              
              // Get our saved state
              let savedState;
              if (chrome.storage && chrome.storage.local) {
                savedState = await new Promise(resolve => {
                  chrome.storage.local.get(['apolloAuthState'], result => {
                    resolve(result.apolloAuthState || '');
                  });
                });
              } else {
                savedState = sessionStorage.getItem('apolloAuthState');
              }
              
              // Verify state to prevent CSRF attacks
              if (savedState !== returnedState) {
                authWindow.close();
                reject(new Error('State mismatch in OAuth callback'));
                return;
              }
              
              if (!code) {
                authWindow.close();
                reject(new Error('No authorization code received'));
                return;
              }
              
              // Close the auth window
              authWindow.close();
              
              // Exchange the code for an access token
              await this.getAccessToken(code);
              
              resolve(true);
            }
          } catch (error) {
            // Ignore cross-origin errors, which will happen while the window
            // is on a different domain
            if (!error.toString().includes('cross-origin')) {
              console.error('Error checking redirect:', error);
            }
          }
        };
        
        // Start the polling
        const intervalId = setInterval(checkRedirect, checkInterval);
        
        // Also add a message event listener for the redirect page to communicate back
        window.addEventListener('message', async (event) => {
          // Check if the message is from our redirect page
          if (event.origin === 'https://igupta1.github.io' && 
              event.data && 
              event.data.type === 'apollo_redirect') {
            
            clearInterval(intervalId);
            
            const code = event.data.code;
            const returnedState = event.data.state;
            
            // Get our saved state
            let savedState;
            if (chrome.storage && chrome.storage.local) {
              savedState = await new Promise(resolve => {
                chrome.storage.local.get(['apolloAuthState'], result => {
                  resolve(result.apolloAuthState || '');
                });
              });
            } else {
              savedState = sessionStorage.getItem('apolloAuthState');
            }
            
            // Verify state
            if (savedState !== returnedState) {
              authWindow.close();
              reject(new Error('State mismatch in OAuth callback'));
              return;
            }
            
            if (!code) {
              authWindow.close();
              reject(new Error('No authorization code received'));
              return;
            }
            
            // Close the auth window
            authWindow.close();
            
            // Exchange the code for an access token
            await this.getAccessToken(code);
            
            resolve(true);
          }
        });
      });
    }
  } catch (error) {
    console.error('Apollo authentication error:', error);
    return false;
  }
},
  
  // Build the authorization URL
  buildAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: this.CLIENT_ID,
      redirect_uri: this.REDIRECT_URI,
      response_type: 'code',
      state: state
    });
    
    return `${this.APOLLO_AUTH_URL}?${params.toString()}`;
  },
  
  // Exchange code for access token
  async getAccessToken(code) {
    try {
      const response = await fetch(this.APOLLO_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: this.CLIENT_ID,
          client_secret: this.CLIENT_SECRET,
          redirect_uri: this.REDIRECT_URI,
          code: code
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to get access token: ${errorData.error || response.status}`);
      }
      
      const data = await response.json();
      
      // Update auth state
      this.authState = {
        isAuthenticated: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in * 1000) // Convert seconds to milliseconds
      };
      
      // Save to storage
      await this.saveAuthState();
      
      return this.authState;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  },
  
  // Refresh the access token
  async refreshToken() {
    try {
      if (!this.authState.refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await fetch(this.APOLLO_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: this.CLIENT_ID,
          client_secret: this.CLIENT_SECRET,
          refresh_token: this.authState.refreshToken,
          redirect_uri: this.REDIRECT_URI
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to refresh token: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update auth state
      this.authState = {
        isAuthenticated: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in * 1000)
      };
      
      // Save to storage
      await this.saveAuthState();
      
      return this.authState;
    } catch (error) {
      console.error('Error refreshing token:', error);
      await this.clearAuthState();
      throw error;
    }
  },
  
  // Save auth state to storage
  async saveAuthState() {
    return new Promise(resolve => {
      chrome.storage.local.set({ apolloAuth: this.authState }, resolve);
    });
  },
  
  // Clear auth state
  async clearAuthState() {
    this.authState = {
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      expiresAt: null
    };
    
    return new Promise(resolve => {
      chrome.storage.local.remove('apolloAuth', resolve);
    });
  },
  
  // Check if Apollo is authenticated
  isAuthenticated() {
    return this.authState.isAuthenticated && 
           this.authState.accessToken && 
           Date.now() < this.authState.expiresAt;
  },
  
  // Logout from Apollo
  async logout() {
    await this.clearAuthState();
    return true;
  },
  
  // Search for a person's email using Apollo API
  async findEmail(personData) {
    try {
      if (!this.authState.isAuthenticated || !this.authState.accessToken) {
        throw new Error('Not authenticated with Apollo');
      }
      
      // Check if token is expired
      if (Date.now() >= this.authState.expiresAt) {
        await this.refreshToken();
      }
      
      const response = await fetch('https://api.apollo.io/api/v1/people/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authState.accessToken}`
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
  },
  
  // Generate a random string for the state parameter
  generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
};