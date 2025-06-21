// background.js

// Add authentication state management
let authState = {
  isAuthenticated: false,
  userData: null,
  token: null
};

chrome.runtime.onInstalled.addListener(() => {
  console.log("LinkedIn Email Scraper Extension installed.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkAuthStatus") {
    sendResponse({
      isAuthenticated: authState.isAuthenticated,
      userData: authState.userData
    });
    return true;
  }
  
  else if (request.action === "signInWithGoogle") {
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
  
  else if (request.action === "getAuthToken") {
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
  
  // Logout functionality
  else if (request.action === "logout") {
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
  else if (request.action === "openBioSetupPage") {
    chrome.tabs.create({ url: request.url }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true; // Required for async response
  }
});
