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
            console.log('[UIManager] refreshUserData - BEFORE merge, this.userData:', this.userData);
            console.log('[UIManager] refreshUserData - storedUserData from Chrome storage:', storedUserData);
            // MERGE stored data with current userData, preserving name fields from BackendAPI
            this.userData = {
              ...storedUserData,  // Get templates, sentEmails from storage
              ...this.userData,   // Preserve name, firstName, lastName, email, picture from BackendAPI
              // Explicitly preserve critical fields from stored data that we want to keep
              templates: storedUserData.templates || this.userData.templates,
              sentEmails: storedUserData.sentEmails || this.userData.sentEmails
            };
            console.log('[UIManager] refreshUserData - AFTER merge, this.userData:', this.userData);
            if (window.GmailManager) window.GmailManager.setUserData(this.userData);
          } else {
            console.log('[UIManager] refreshUserData - No stored data found for email:', this.userData.email);
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
        console.log('[UIManager] Setting userData from BackendAPI:', window.BackendAPI.userData);
        this.userData = {
          email: window.BackendAPI.userData.email,
          name: window.BackendAPI.userData.name,
          firstName: window.BackendAPI.userData.firstName,
          lastName: window.BackendAPI.userData.lastName,
          picture: window.BackendAPI.userData.picture
        };
        console.log('[UIManager] userData set to:', this.userData);
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


