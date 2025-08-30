// content/ui/auth.js
// Attach auth and storage utilities to window.UIManager

(function attachAuth(){
  if (!window) return;
  window.UIManager = window.UIManager || {};

  window.UIManager.checkUserInStorage = async function checkUserInStorage(email) {
    return new Promise((resolve) => {
      try {
        if (!chrome.runtime?.id) {
          console.log('Extension context invalidated, cannot check user in storage');
          resolve(false);
          return;
        }
        chrome.storage.local.get([email], (result) => {
          if (chrome.runtime.lastError) {
            console.log('Chrome storage error:', chrome.runtime.lastError);
            resolve(false);
            return;
          }
          resolve(result[email] ? true : false);
        });
      } catch (error) {
        console.log('Error checking user in storage:', error);
        resolve(false);
      }
    });
  };

  window.UIManager.getUserFromStorage = async function getUserFromStorage(email) {
    return new Promise((resolve) => {
      try {
        if (!chrome.runtime?.id) {
          console.log('Extension context invalidated, cannot get user from storage');
          resolve(null);
          return;
        }
        chrome.storage.local.get([email], (result) => {
          if (chrome.runtime.lastError) {
            console.log('Chrome storage error:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          resolve(result[email] || null);
        });
      } catch (error) {
        console.log('Error getting user from storage:', error);
        resolve(null);
      }
    });
  };



  window.UIManager.refreshUserData = async function refreshUserData() {
    if (!this.isAuthenticated || !this.userData || !this.userData.email) {
      console.log('Not authenticated or missing user data, cannot refresh');
      return;
    }
    console.log('Refreshing user data from storage');
    return new Promise((resolve) => {
      try {
        if (!chrome.runtime?.id) {
          console.log('Extension context invalidated, skipping storage refresh');
          resolve();
          return;
        }
        chrome.storage.local.get([this.userData.email], (result) => {
          if (chrome.runtime.lastError) {
            console.log('Chrome storage error:', chrome.runtime.lastError);
            resolve();
            return;
          }
          const storedUserData = result[this.userData.email];
          if (storedUserData) {
            console.log('Found stored user data, updating local copy');
            this.userData = storedUserData;
            if (window.GmailManager) window.GmailManager.setUserData(this.userData);
          } else {
            console.log('No stored user data found');
          }
          resolve();
        });
      } catch (error) {
        console.log('Error accessing chrome storage:', error);
        resolve();
      }
    });
  };

  window.UIManager.checkAuthStatus = async function checkAuthStatus() {
    try {
      if (!chrome.runtime?.id) {
        console.log('Extension context invalidated, cannot check auth status');
        this.isAuthenticated = false;
        this.showSignInUI();
        return this.isAuthenticated;
      }
      if (!window.BackendAPI) {
        console.log('Backend API not available');
        this.isAuthenticated = false;
        this.showSignInUI();
        return this.isAuthenticated;
      }
      await window.BackendAPI.init();
      if (window.BackendAPI.isAuthenticated && window.BackendAPI.userData) {
        this.isAuthenticated = true;
        this.userData = {
          email: window.BackendAPI.userData.email,
          name: window.BackendAPI.userData.name,
          picture: window.BackendAPI.userData.picture
        };
        this.updateOwnProfileIdFromUserData();
        // Check if user exists in local storage for additional user data (bio, templates, etc.)
        const userExists = await this.checkUserInStorage(this.userData.email);
        if (userExists) {
          const storedUserData = await this.getUserFromStorage(this.userData.email);
          this.userData = { ...this.userData, ...storedUserData };
          this.updateOwnProfileIdFromUserData();
        }
        
        // Show authenticated UI for all authenticated users - no profile setup redirection
        this.showAuthenticatedUI();
      } else {
        this.isAuthenticated = false;
        this.showSignInUI();
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      this.isAuthenticated = false;
      this.showSignInUI();
    }
    return this.isAuthenticated;
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}


