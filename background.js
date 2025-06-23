// background.js

// Add authentication state management
let authState = {
  isAuthenticated: false,
  userData: null,
  token: null
};

// Apollo API configuration - securely store the API key here  
const APOLLO_API_KEY = 'F9emTuJtuTm33AxHa1U7Nw'; // Your Apollo API key
const APOLLO_API_URL = 'https://api.apollo.io/api/v1/people/match';

// Test Apollo API key validity
async function testApolloAPIKey() {
  try {
    console.log('Testing Apollo API key...');
    
    // Simple test request with minimal required parameters
    const testParams = new URLSearchParams();
    testParams.append('first_name', 'John');
    testParams.append('last_name', 'Doe');
    testParams.append('reveal_personal_emails', 'false');
    
    const response = await fetch(`${APOLLO_API_URL}?${testParams.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-api-key': APOLLO_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    console.log('Apollo API test response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Apollo API test failed:', response.status, response.statusText, errorText);
      return false;
    }
    
    const data = await response.json();
    console.log('Apollo API test successful:', data);
    return true;
    
  } catch (error) {
    console.error('Apollo API test error:', error);
    return false;
  }
}

// Apollo API service function
async function enrichPersonWithApollo(profileData) {
  try {
    console.log('Enriching person with Apollo API:', profileData);
    
    // Prepare the request parameters based on available profile data
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
      // Extract domain from company name if possible
      const companyName = profileData.company.toLowerCase();
      
      // Try to derive domain from common company patterns
      let domain = '';
      if (companyName.includes('.com') || companyName.includes('.org') || companyName.includes('.net')) {
        // Company name might already contain domain info
        const domainMatch = companyName.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (domainMatch) {
          domain = domainMatch[1];
        }
      } else {
        // Try common patterns for domain derivation
        const cleanCompany = companyName
          .replace(/\s+(inc|inc\.|llc|ltd|limited|corp|corporation|company|co\.).*$/i, '')
          .replace(/[^a-zA-Z0-9]/g, '');
        
        // For well-known companies, we might want to add domain mapping
        // For now, we'll try the simple approach
        if (cleanCompany) {
          domain = `${cleanCompany}.com`;
        }
      }
      
      if (domain) {
        params.append('domain', domain);
      }
      
      // Also send organization name for better matching
      params.append('organization_name', profileData.company);
    }
    
    // Use location data if available
    if (profileData.location) {
      // Apollo might use this for better matching
      params.append('location', profileData.location);
    }
    
    // Use title/headline if available
    if (profileData.headline) {
      params.append('title', profileData.headline);
    }
    
    // Request personal emails and phone numbers
    params.append('reveal_personal_emails', 'true');
    params.append('reveal_phone_number', 'false'); // We only need email
    
    const url = `${APOLLO_API_URL}?${params.toString()}`;
    
    console.log('Apollo API request URL:', url);
    console.log('Apollo API request params:', params.toString());
    console.log('Apollo API key (first 10 chars):', APOLLO_API_KEY.substring(0, 10) + '...');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-api-key': APOLLO_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      // Try to get the error response body for better debugging
      let errorText = '';
      try {
        const errorData = await response.json();
        errorText = errorData.message || errorData.error || JSON.stringify(errorData);
        console.error('Apollo API error response:', errorData);
      } catch (e) {
        errorText = await response.text();
        console.error('Apollo API error text:', errorText);
      }
      throw new Error(`Apollo API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Apollo API response:', data);
    
    // Extract email from the response
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
