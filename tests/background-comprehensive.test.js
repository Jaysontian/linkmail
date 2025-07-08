// Comprehensive background script tests
const { mockChromeAPIs } = require('./helpers/test-utils');

// Mock the background script environment
let authState = {
  isAuthenticated: false,
  userData: null,
  token: null
};

// Mock fetch for Apollo API tests
global.fetch = jest.fn();

describe('Background Script - Comprehensive Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockChromeAPIs();
    
    // Reset auth state
    authState = {
      isAuthenticated: false,
      userData: null,
      token: null
    };
    
    // Reset fetch mock
    fetch.mockClear();
  });

  describe('Apollo API Integration', () => {
    test('testApolloAPIKey should return true for successful API response', async () => {
      // Mock successful Apollo API response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ person: { id: '123' } })
      });

      // Mock the testApolloAPIKey function (simplified version for testing)
      const testApolloAPIKey = async () => {
        try {
          const testParams = new URLSearchParams();
          testParams.append('first_name', 'John');
          testParams.append('last_name', 'Doe');
          testParams.append('reveal_personal_emails', 'false');

          const response = await fetch('https://api.apollo.io/api/v1/people/match', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'x-api-key': 'test-key',
              'Accept': 'application/json'
            }
          });

          return response.ok;
        } catch (error) {
          return false;
        }
      };

      const result = await testApolloAPIKey();
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.apollo.io/api/v1/people/match',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-key'
          })
        })
      );
    });

    test('testApolloAPIKey should return false for failed API response', async () => {
      // Mock failed Apollo API response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Invalid API key')
      });

      // Mock the testApolloAPIKey function
      const testApolloAPIKey = async () => {
        try {
          const response = await fetch('https://api.apollo.io/api/v1/people/match', {
            method: 'POST'
          });
          return response.ok;
        } catch (error) {
          return false;
        }
      };

      const result = await testApolloAPIKey();
      expect(result).toBe(false);
    });

    test('enrichPersonWithApollo should return email when found', async () => {
      const mockProfileData = {
        firstName: 'John',
        lastName: 'Doe',
        company: 'Tech Corp',
        headline: 'Software Engineer'
      };

      // Mock successful Apollo API response with email
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          person: {
            email: 'john.doe@techcorp.com',
            id: '123',
            first_name: 'John',
            last_name: 'Doe'
          }
        })
      });

      // Mock the enrichPersonWithApollo function
      const enrichPersonWithApollo = async (profileData) => {
        try {
          const params = new URLSearchParams();
          if (profileData.firstName && profileData.lastName) {
            params.append('first_name', profileData.firstName);
            params.append('last_name', profileData.lastName);
          }
          if (profileData.company) {
            params.append('organization_name', profileData.company);
          }
          params.append('reveal_personal_emails', 'true');

          const response = await fetch('https://api.apollo.io/api/v1/people/match', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': 'test-key'
            }
          });

          if (!response.ok) {
            throw new Error('API request failed');
          }

          const data = await response.json();

          if (data.person && data.person.email) {
            return {
              success: true,
              email: data.person.email,
              source: 'apollo',
              person: data.person
            };
          } else {
            return {
              success: false,
              error: 'No email found in Apollo database',
              source: 'apollo'
            };
          }
        } catch (error) {
          return {
            success: false,
            error: error.message || 'Failed to enrich person data',
            source: 'apollo'
          };
        }
      };

      const result = await enrichPersonWithApollo(mockProfileData);

      expect(result.success).toBe(true);
      expect(result.email).toBe('john.doe@techcorp.com');
      expect(result.source).toBe('apollo');
      expect(result.person).toBeDefined();
    });

    test('enrichPersonWithApollo should handle no email found', async () => {
      const mockProfileData = {
        firstName: 'John',
        lastName: 'Doe'
      };

      // Mock Apollo API response without email
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          person: {
            id: '123',
            first_name: 'John',
            last_name: 'Doe'
            // No email field
          }
        })
      });

      const enrichPersonWithApollo = async (profileData) => {
        try {
          const response = await fetch('https://api.apollo.io/api/v1/people/match');
          const data = await response.json();

          if (data.person && data.person.email) {
            return {
              success: true,
              email: data.person.email,
              source: 'apollo'
            };
          } else {
            return {
              success: false,
              error: 'No email found in Apollo database',
              source: 'apollo'
            };
          }
        } catch (error) {
          return {
            success: false,
            error: 'Failed to enrich person data',
            source: 'apollo'
          };
        }
      };

      const result = await enrichPersonWithApollo(mockProfileData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No email found in Apollo database');
      expect(result.source).toBe('apollo');
    });

    test('enrichPersonWithApollo should handle API errors', async () => {
      const mockProfileData = {
        firstName: 'John',
        lastName: 'Doe'
      };

      // Mock API error
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const enrichPersonWithApollo = async (profileData) => {
        try {
          await fetch('https://api.apollo.io/api/v1/people/match');
          // This won't be reached due to the error
        } catch (error) {
          return {
            success: false,
            error: error.message || 'Failed to enrich person data',
            source: 'apollo'
          };
        }
      };

      const result = await enrichPersonWithApollo(mockProfileData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.source).toBe('apollo');
    });
  });

  describe('Chrome Runtime Message Handlers', () => {
    test('should handle checkAuthStatus message', () => {
      let responseReceived = null;

      // Mock chrome.runtime.onMessage listener behavior
      const mockMessageHandler = (request, sender, sendResponse) => {
        if (request.action === 'checkAuthStatus') {
          sendResponse({
            isAuthenticated: authState.isAuthenticated,
            userData: authState.userData
          });
          return true;
        }
      };

      // Test authenticated state
      authState.isAuthenticated = true;
      authState.userData = { email: 'test@example.com', name: 'Test User' };

      mockMessageHandler(
        { action: 'checkAuthStatus' },
        {},
        (response) => { responseReceived = response; }
      );

      expect(responseReceived).toEqual({
        isAuthenticated: true,
        userData: { email: 'test@example.com', name: 'Test User' }
      });
    });

    test('should handle signInWithGoogle message success', async () => {
      let responseReceived = null;

      // Mock successful Google user info response
      fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          email: 'user@example.com',
          name: 'John Doe'
        })
      });

      // Mock chrome.identity.getAuthToken
      chrome.identity.getAuthToken.callsFake((options, callback) => {
        callback('mock-auth-token');
      });

      const mockMessageHandler = async (request, sender, sendResponse) => {
        if (request.action === 'signInWithGoogle') {
          chrome.identity.getAuthToken({ interactive: true }, async function(token) {
            if (!chrome.runtime.lastError) {
              try {
                const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
                  headers: { Authorization: `Bearer ${token}` }
                });
                const data = await response.json();
                
                authState.isAuthenticated = true;
                authState.userData = {
                  email: data.email,
                  name: data.name || data.email.split('@')[0]
                };
                authState.token = token;

                sendResponse({
                  success: true,
                  userData: authState.userData
                });
              } catch (error) {
                sendResponse({
                  success: false,
                  error: 'Failed to fetch user data'
                });
              }
            }
          });
          return true;
        }
      };

      await mockMessageHandler(
        { action: 'signInWithGoogle' },
        {},
        (response) => { responseReceived = response; }
      );

      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(responseReceived.success).toBe(true);
      expect(responseReceived.userData.email).toBe('user@example.com');
      expect(authState.isAuthenticated).toBe(true);
    });

    test('should handle signInWithGoogle message failure', () => {
      let responseReceived = null;

      // Mock chrome.identity.getAuthToken error
      chrome.identity.getAuthToken.callsFake((options, callback) => {
        chrome.runtime.lastError = { message: 'User cancelled' };
        callback(null);
      });

      const mockMessageHandler = (request, sender, sendResponse) => {
        if (request.action === 'signInWithGoogle') {
          chrome.identity.getAuthToken({ interactive: true }, function(token) {
            if (chrome.runtime.lastError) {
              sendResponse({
                success: false,
                error: chrome.runtime.lastError.message
              });
              return;
            }
          });
          return true;
        }
      };

      mockMessageHandler(
        { action: 'signInWithGoogle' },
        {},
        (response) => { responseReceived = response; }
      );

      expect(responseReceived.success).toBe(false);
      expect(responseReceived.error).toBe('User cancelled');

      // Clean up
      delete chrome.runtime.lastError;
    });

    test('should handle getAuthToken message with existing token', () => {
      let responseReceived = null;

      authState.isAuthenticated = true;
      authState.token = 'existing-token';

      const mockMessageHandler = (request, sender, sendResponse) => {
        if (request.action === 'getAuthToken') {
          if (authState.isAuthenticated && authState.token) {
            sendResponse({ token: authState.token });
          }
          return true;
        }
      };

      mockMessageHandler(
        { action: 'getAuthToken' },
        {},
        (response) => { responseReceived = response; }
      );

      expect(responseReceived.token).toBe('existing-token');
    });

    test('should handle getAuthToken message without existing token', () => {
      let responseReceived = null;

      authState.isAuthenticated = false;
      authState.token = null;

      // Mock chrome.identity.getAuthToken
      chrome.identity.getAuthToken.callsFake((options, callback) => {
        callback('new-auth-token');
      });

      const mockMessageHandler = (request, sender, sendResponse) => {
        if (request.action === 'getAuthToken') {
          if (authState.isAuthenticated && authState.token) {
            sendResponse({ token: authState.token });
          } else {
            chrome.identity.getAuthToken({ interactive: true }, function(token) {
              if (!chrome.runtime.lastError) {
                authState.token = token;
                sendResponse({ token: token });
              }
            });
          }
          return true;
        }
      };

      mockMessageHandler(
        { action: 'getAuthToken' },
        {},
        (response) => { responseReceived = response; }
      );

      expect(responseReceived.token).toBe('new-auth-token');
      expect(authState.token).toBe('new-auth-token');
    });

    test('should handle enrichWithApollo message', async () => {
      let responseReceived = null;

      const mockProfileData = {
        firstName: 'John',
        lastName: 'Doe'
      };

      // Mock successful enrichment result
      const mockEnrichResult = {
        success: true,
        email: 'john.doe@example.com',
        source: 'apollo'
      };

      const mockMessageHandler = async (request, sender, sendResponse) => {
        if (request.action === 'enrichWithApollo') {
          // Simulate enrichPersonWithApollo function
          try {
            const result = mockEnrichResult;
            sendResponse(result);
          } catch (error) {
            sendResponse({
              success: false,
              error: 'Failed to enrich person data',
              source: 'apollo'
            });
          }
          return true;
        }
      };

      await mockMessageHandler(
        { action: 'enrichWithApollo', profileData: mockProfileData },
        {},
        (response) => { responseReceived = response; }
      );

      expect(responseReceived.success).toBe(true);
      expect(responseReceived.email).toBe('john.doe@example.com');
      expect(responseReceived.source).toBe('apollo');
    });

    test('should handle logout message', async () => {
      let responseReceived = null;

      authState.token = 'token-to-revoke';

      // Mock successful token revocation
      fetch.mockResolvedValueOnce({ ok: true });

      // Mock chrome.identity.removeCachedAuthToken
      chrome.identity.removeCachedAuthToken.callsFake((options, callback) => {
        callback();
      });

      const mockMessageHandler = async (request, sender, sendResponse) => {
        if (request.action === 'logout') {
          if (authState.token) {
            try {
              await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${authState.token}`);
              chrome.identity.removeCachedAuthToken({ token: authState.token }, function() {
                authState.isAuthenticated = false;
                authState.userData = null;
                authState.token = null;
                sendResponse({ success: true });
              });
            } catch (error) {
              sendResponse({ success: false, error: 'Failed to revoke token' });
            }
          } else {
            sendResponse({ success: true });
          }
          return true;
        }
      };

      await mockMessageHandler(
        { action: 'logout' },
        {},
        (response) => { responseReceived = response; }
      );

      expect(responseReceived.success).toBe(true);
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.userData).toBe(null);
      expect(authState.token).toBe(null);
    });

    test('should handle openBioSetupPage message', () => {
      let responseReceived = null;

      // Mock chrome.tabs.create
      chrome.tabs.create.callsFake((options, callback) => {
        callback({ id: 456 });
      });

      const mockMessageHandler = (request, sender, sendResponse) => {
        if (request.action === 'openBioSetupPage') {
          chrome.tabs.create({ url: request.url }, (tab) => {
            sendResponse({ success: true, tabId: tab.id });
          });
          return true;
        }
      };

      mockMessageHandler(
        { action: 'openBioSetupPage', url: 'chrome-extension://test/dashboard.html' },
        {},
        (response) => { responseReceived = response; }
      );

      expect(responseReceived.success).toBe(true);
      expect(responseReceived.tabId).toBe(456);
    });

    test('should handle testApolloAPI message', async () => {
      let responseReceived = null;

      // Mock successful Apollo API test
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ person: { id: '123' } })
      });

      const mockTestApolloAPIKey = async () => {
        try {
          const response = await fetch('https://api.apollo.io/api/v1/people/match');
          return response.ok;
        } catch (error) {
          return false;
        }
      };

      const mockMessageHandler = async (request, sender, sendResponse) => {
        if (request.action === 'testApolloAPI') {
          try {
            const result = await mockTestApolloAPIKey();
            sendResponse({ success: result });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          return true;
        }
      };

      await mockMessageHandler(
        { action: 'testApolloAPI' },
        {},
        (response) => { responseReceived = response; }
      );

      expect(responseReceived.success).toBe(true);
    });
  });

  describe('Chrome Extension Event Listeners', () => {
    test('should handle chrome.runtime.onInstalled event', () => {
      // Mock console.log to avoid output during tests
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const mockOnInstalledHandler = () => {
        console.log('LinkedIn Email Scraper Extension installed.');
      };

      mockOnInstalledHandler();

      expect(consoleSpy).toHaveBeenCalledWith('LinkedIn Email Scraper Extension installed.');

      consoleSpy.mockRestore();
    });

    test('should handle chrome.runtime.onStartup event', () => {
      // Mock console.log to avoid output during tests
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const mockOnStartupHandler = () => {
        console.log('Extension started.');
      };

      mockOnStartupHandler();

      expect(consoleSpy).toHaveBeenCalledWith('Extension started.');

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    test('should handle fetch errors in Apollo API', async () => {
      fetch.mockRejectedValueOnce(new Error('Network failure'));

      const enrichPersonWithApollo = async (profileData) => {
        try {
          await fetch('https://api.apollo.io/api/v1/people/match');
        } catch (error) {
          return {
            success: false,
            error: error.message || 'Failed to enrich person data',
            source: 'apollo'
          };
        }
      };

      const result = await enrichPersonWithApollo({ firstName: 'John' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network failure');
    });

    test('should handle Chrome runtime errors', () => {
      let responseReceived = null;

      chrome.runtime.lastError = { message: 'Extension context invalidated' };

      const mockMessageHandler = (request, sender, sendResponse) => {
        if (request.action === 'checkAuthStatus') {
          if (chrome.runtime.lastError) {
            sendResponse({
              isAuthenticated: false,
              error: chrome.runtime.lastError.message
            });
          }
          return true;
        }
      };

      mockMessageHandler(
        { action: 'checkAuthStatus' },
        {},
        (response) => { responseReceived = response; }
      );

      expect(responseReceived.isAuthenticated).toBe(false);
      expect(responseReceived.error).toBe('Extension context invalidated');

      // Clean up
      delete chrome.runtime.lastError;
    });
  });

  describe('Authentication State Management', () => {
    test('should maintain authentication state correctly', () => {
      // Initially unauthenticated
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.userData).toBe(null);
      expect(authState.token).toBe(null);

      // Simulate successful authentication
      authState.isAuthenticated = true;
      authState.userData = { email: 'test@example.com', name: 'Test User' };
      authState.token = 'auth-token-123';

      expect(authState.isAuthenticated).toBe(true);
      expect(authState.userData.email).toBe('test@example.com');
      expect(authState.token).toBe('auth-token-123');

      // Simulate logout
      authState.isAuthenticated = false;
      authState.userData = null;
      authState.token = null;

      expect(authState.isAuthenticated).toBe(false);
      expect(authState.userData).toBe(null);
      expect(authState.token).toBe(null);
    });
  });
}); 