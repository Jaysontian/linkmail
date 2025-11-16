// background.js

// Backend authentication state management
let backendAuthState = {
  isAuthenticated: false,
  userData: null,
  token: null
};

// Similar People Search (external API) - disabled
async function findSimilarPeopleWithApollo(contactedPersonData, options = {}) {
  return { success: false, error: 'Similar people search disabled', source: 'similar_people' };
}


// Apollo enrichment removed
async function enrichPersonWithApollo() {
  return { success: false, error: 'Apollo removed' };
}

// Apollo API key test removed
async function testApolloAPIKey() { return false; }

chrome.runtime.onInstalled.addListener((details) => {
  // Open the installation success page when the extension is first installed
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('install-success.html') });
  }
});

chrome.runtime.onStartup.addListener(() => {
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkAuthStatus') {
    // Check backend auth status
    chrome.storage.local.get(['backendToken', 'backendUserData'], (result) => {
      sendResponse({
        isAuthenticated: !!result.backendToken,
        userData: result.backendUserData
      });
    });
    return true;
  }

  else if (request.action === 'openAuthPage') {
    // Open the backend authentication page
    chrome.tabs.create({ url: request.url }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true;
  }

  else if (request.action === 'completeBackendAuth') {
    // Store backend authentication data
    const { token, userData } = request;
    chrome.storage.local.set({
      backendToken: token,
      backendUserData: userData
    }, () => {
      backendAuthState.isAuthenticated = true;
      backendAuthState.userData = userData;
      backendAuthState.token = token;
      
      sendResponse({ success: true });
    });
    return true;
  }

  // Apollo enrichment removed
  else if (request.action === 'enrichWithApollo') {
    sendResponse({ success: false, error: 'Apollo removed' });
    return true;
  }

  // Backend logout functionality
  else if (request.action === 'logout') {
    // Clear backend auth data
    chrome.storage.local.remove(['backendToken', 'backendUserData'], () => {
      backendAuthState.isAuthenticated = false;
      backendAuthState.userData = null;
      backendAuthState.token = null;
      sendResponse({ success: true });
    });
    return true;
  }

  // Handle opening the bio setup page
  else if (request.action === 'openBioSetupPage') {
    chrome.tabs.create({ url: request.url }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true; // Required for async response
  }

  // Apollo API test removed
  else if (request.action === 'testApolloAPI') {
    sendResponse({ success: false });
    return true;
  }

  // Similar people search removed
  else if (request.action === 'findSimilarPeople') {
    sendResponse({ success: false, error: 'Similar people search disabled' });
    return true;
  }

  // Handle close tab request
  else if (request.action === 'closeCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.remove(tabs[0].id);
      }
    });
    sendResponse({ success: true });
    return true;
  }
});
