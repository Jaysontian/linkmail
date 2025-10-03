// content/ui/auth.js
// Attach auth and storage utilities to window.UIManager

(function attachAuth(){
  if (!window) return;
  window.UIManager = window.UIManager || {};

  window.UIManager.checkUserInStorage = async function checkUserInStorage(email) {
    return new Promise((resolve) => {
      try {
        if (!chrome.runtime?.id) {
          resolve(false);
          return;
        }
        chrome.storage.local.get([email], (result) => {
          if (chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(result[email] ? true : false);
        });
      } catch (error) {
        resolve(false);
      }
    });
  };

  window.UIManager.getUserFromStorage = async function getUserFromStorage(email) {
    return new Promise((resolve) => {
      try {
        if (!chrome.runtime?.id) {
          resolve(null);
          return;
        }
        chrome.storage.local.get([email], (result) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(result[email] || null);
        });
      } catch (error) {
        resolve(null);
      }
    });
  };



  window.UIManager.refreshUserData = async function refreshUserData() {
    if (!this.isAuthenticated || !this.userData || !this.userData.email) {
      return;
    }
    return new Promise((resolve) => {
      try {
        if (!chrome.runtime?.id) {
          resolve();
          return;
        }
        chrome.storage.local.get([this.userData.email], (result) => {
          if (chrome.runtime.lastError) {
            resolve();
            return;
          }
          const storedUserData = result[this.userData.email];
          if (storedUserData) {
            this.userData = storedUserData;
            if (window.GmailManager) window.GmailManager.setUserData(this.userData);
          } else {
          }
          resolve();
        });
      } catch (error) {
        resolve();
      }
    });
  };

  window.UIManager.checkAuthStatus = async function checkAuthStatus() {
    try {
      if (!chrome.runtime?.id) {
        this.isAuthenticated = false;
        this.showSignInUI();
        return this.isAuthenticated;
      }
      if (!window.BackendAPI) {
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
        
        // Fetch latest templates from backend before showing UI
        if (window.TemplateManager && this.userData.email) {
          try {
            console.log('[UIManager] Loading templates from backend...');
            await window.TemplateManager.loadTemplates(this.userData.email);
            // Refresh userData from storage to get the newly synced templates
            const updatedUserData = await this.getUserFromStorage(this.userData.email);
            if (updatedUserData) {
              this.userData = { ...this.userData, ...updatedUserData };
            }
          } catch (templateError) {
            console.warn('[UIManager] Failed to load templates from backend:', templateError);
          }
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


