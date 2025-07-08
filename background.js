// background.js

// Add authentication state management
let authState = {
  isAuthenticated: false,
  userData: null,
  token: null
};

// Apollo API integration - delegate to ApolloClient module
// Note: In a real backend migration, this would be moved to linkmail-web
async function enrichPersonWithApollo(profileData) {
  // Delegate to the ApolloClient module if available
  if (typeof window !== 'undefined' && window.ApolloClient) {
    return await window.ApolloClient.enrichPerson(profileData);
  } else {
    // Fallback implementation for service worker context
    // This code will eventually be moved to linkmail-web backend
    try {
      console.log('Enriching person with Apollo API (service worker context):', profileData);

      const params = new URLSearchParams();

      // Use name data
      if (profileData.firstName && profileData.lastName) {
        params.append('first_name', profileData.firstName);
        params.append('last_name', profileData.lastName);
      } else if (profileData.name) {
        params.append('name', profileData.name);
      }

      // Use company data to improve matching
      if (profileData.company) {
        const companyName = profileData.company.toLowerCase();
        let domain = '';
        if (companyName.includes('.com') || companyName.includes('.org') || companyName.includes('.net')) {
          const domainMatch = companyName.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          if (domainMatch) {
            domain = domainMatch[1];
          }
        } else {
          const cleanCompany = companyName
            .replace(/\s+(inc|inc\.|llc|ltd|limited|corp|corporation|company|co\.).*$/i, '')
            .replace(/[^a-zA-Z0-9]/g, '');
          if (cleanCompany) {
            domain = `${cleanCompany}.com`;
          }
        }

        if (domain) {
          params.append('domain', domain);
        }
        params.append('organization_name', profileData.company);
      }

      if (profileData.location) {
        params.append('location', profileData.location);
      }

      if (profileData.headline) {
        params.append('title', profileData.headline);
      }

      params.append('reveal_personal_emails', 'true');
      params.append('reveal_phone_number', 'false');

      const url = `https://api.apollo.io/api/v1/people/match?${params.toString()}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-api-key': 'F9emTuJtuTm33AxHa1U7Nw',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        let errorText = '';
        try {
          const errorData = await response.json();
          errorText = errorData.message || errorData.error || JSON.stringify(errorData);
        } catch (e) {
          errorText = await response.text();
        }
        throw new Error(`Apollo API request failed: ${response.status} ${response.statusText} - ${errorText}`);
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
      console.error('Apollo API error:', error);
      return {
        success: false,
        error: error.message || 'Failed to enrich person data',
        source: 'apollo'
      };
    }
  }
}

// Test Apollo API key functionality - delegate to ApolloClient module
async function testApolloAPIKey() {
  // Delegate to the ApolloClient module if available
  if (typeof window !== 'undefined' && window.ApolloClient) {
    return await window.ApolloClient.testApiKey();
  } else {
    // Fallback test for service worker context
    try {
      const testProfile = {
        firstName: 'John',
        lastName: 'Doe',
        company: 'Google'
      };
      
      const result = await enrichPersonWithApollo(testProfile);
      console.log('Apollo API test result:', result);
      return result.success !== false; // Return true unless explicitly failed
    } catch (error) {
      console.error('Apollo API test failed:', error);
      return false;
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('LinkedIn Email Scraper Extension installed.');
  // Test Apollo API on installation
  testApolloAPIKey();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started.');
  // Test Apollo API on startup
  testApolloAPIKey();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkAuthStatus') {
    sendResponse({
      isAuthenticated: authState.isAuthenticated,
      userData: authState.userData
    });
    return true;
  }

  else if (request.action === 'signInWithGoogle') {
    chrome.identity.getAuthToken({ interactive: true }, function(token) {
      if (chrome.runtime.lastError) {
        console.error('Auth error:', chrome.runtime.lastError);
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message
        });
        return;
      }

      // Get user info using the token
      fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(response => response.json())
        .then(data => {
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
        })
        .catch(error => {
          console.error('Error fetching user data:', error);
          sendResponse({
            success: false,
            error: 'Failed to fetch user data'
          });
        });
    });
    return true; // Required for async response
  }

  else if (request.action === 'getAuthToken') {
    if (authState.isAuthenticated && authState.token) {
      sendResponse({ token: authState.token });
    } else {
      chrome.identity.getAuthToken({ interactive: true }, function(token) {
        if (chrome.runtime.lastError) {
          console.error('Auth error:', chrome.runtime.lastError);
          sendResponse({
            error: {
              message: chrome.runtime.lastError.message
            }
          });
          return;
        }

        authState.token = token;
        sendResponse({ token: token });
      });
    }
    return true; // Required for async response
  }

  // Handle Apollo API enrichment
  else if (request.action === 'enrichWithApollo') {
    enrichPersonWithApollo(request.profileData)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error('Error in Apollo enrichment:', error);
        sendResponse({
          success: false,
          error: 'Failed to enrich person data',
          source: 'apollo'
        });
      });
    return true; // Required for async response
  }

  // Logout functionality
  else if (request.action === 'logout') {
    if (authState.token) {
      // Revoke the token
      fetch(`https://accounts.google.com/o/oauth2/revoke?token=${authState.token}`)
        .then(() => {
          chrome.identity.removeCachedAuthToken({ token: authState.token }, function() {
            authState.isAuthenticated = false;
            authState.userData = null;
            authState.token = null;
            sendResponse({ success: true });
          });
        })
        .catch(error => {
          console.error('Error revoking token:', error);
          sendResponse({ success: false, error: 'Failed to revoke token' });
        });
    } else {
      sendResponse({ success: true });
    }
    return true; // Required for async response
  }

  // Handle opening the bio setup page
  else if (request.action === 'openBioSetupPage') {
    chrome.tabs.create({ url: request.url }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true; // Required for async response
  }

  // Test Apollo API key
  else if (request.action === 'testApolloAPI') {
    testApolloAPIKey()
      .then(result => {
        sendResponse({ success: result });
      })
      .catch(error => {
        console.error('Error testing Apollo API:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async response
  }
});
