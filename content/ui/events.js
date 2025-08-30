// content/ui/events.js
// Attach event listeners and related utilities to window.UIManager

(function attachEvents(){
  if (!window) return;
  window.UIManager = window.UIManager || {};

  window.UIManager.setupStorageListener = function setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      const successView = this.container.querySelector('#linkmail-success');
      if (successView && successView.style.display === 'block') {
        console.log('Storage change detected but ignoring because success view is displayed');
        return;
      }
      if (namespace === 'local' && this.userData?.email && changes[this.userData.email]) {
        console.log('User data updated in storage, refreshing UI');
        const currentView = this.getCurrentView();
        console.log('Current view before storage listener update:', currentView);
        this.getUserFromStorage(this.userData.email).then(userData => {
          if (userData) {
            this.userData = { ...this.userData, ...userData };
            const userEmailDisplay = document.getElementById('user-email-display');
            if (userEmailDisplay && this.userData?.email) userEmailDisplay.textContent = this.userData.email;
            const shouldPreserveView = currentView === 'editor' || currentView === 'success';
            console.log('Should preserve view:', shouldPreserveView);
            this.showAuthenticatedUI(shouldPreserveView);
          }
        });
      }
    });
  };

  window.UIManager.setupFocusRefresh = function setupFocusRefresh() {
    window.addEventListener('focus', () => {
      console.log('Window focused, checking for template updates');
      if (this.isAuthenticated && this.userData && this.userData.email) {
        const currentView = this.getCurrentView();
        console.log('Current view before focus refresh:', currentView);
        this.refreshUserData().then(() => {
          this.populateTemplateDropdown();
          if (currentView === 'editor' || currentView === 'success') {
            console.log('Preserving current view after focus refresh:', currentView);
          } else {
            console.log('Safe to refresh UI after focus');
          }
        });
      }
    });
  };

  window.UIManager.setupEventListeners = function setupEventListeners() {
    if (!this.container) { console.error('Container not initialized'); return; }

    this.elements.menuToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const dropdown = this.elements.menuContent;
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    });
    window.addEventListener('click', (event) => {
      if (!this.elements.menuContent.contains(event.target)){
        this.elements.menuContent.style.display = 'none';
      }
    });

    this.elements.signInButton.addEventListener('click', async () => {
      try {
        if (!chrome.runtime?.id) {
          console.log('Extension context invalidated, cannot sign in');
          this.showTemporaryMessage('Extension needs to be reloaded. Please refresh the page and try again.', 'error');
          return;
        }
        if (!window.BackendAPI) {
          console.error('Backend API not available');
          this.showTemporaryMessage('Service unavailable. Please try again later.', 'error');
          return;
        }
        this.showTemporaryMessage('Opening authentication page...', 'info');
        await window.BackendAPI.startAuthFlow();
        this.showTemporaryMessage('Please complete authentication in the new tab and return here.', 'info');
        let authCheckCount = 0;
        const maxAuthChecks = 30;
        const checkAuthInterval = setInterval(async () => {
          try {
            authCheckCount++;
            console.log(`Checking for authentication... (${authCheckCount}/${maxAuthChecks})`);
            await window.BackendAPI.init();
            if (window.BackendAPI.isAuthenticated && window.BackendAPI.userData) {
              clearInterval(checkAuthInterval);
              console.log('Authentication detected! Setting up user data...');
              this.isAuthenticated = true;
              this.userData = {
                email: window.BackendAPI.userData.email,
                name: window.BackendAPI.userData.name,
                picture: window.BackendAPI.userData.picture
              };
              // Check if user exists in local storage for additional user data (bio, templates, etc.)
              const userExists = await this.checkUserInStorage(this.userData.email);
              if (userExists) {
                const storedUserData = await this.getUserFromStorage(this.userData.email);
                this.userData = { ...this.userData, ...storedUserData };
              }
              
              // Show authenticated UI for all authenticated users - no profile setup redirection
              this.showAuthenticatedUI();
              this.showTemporaryMessage('Authentication successful!', 'success');
            } else if (authCheckCount >= maxAuthChecks) {
              clearInterval(checkAuthInterval);
              console.log('Auth check timeout - stopping polling');
              this.showTemporaryMessage('Authentication timeout. Please try again.', 'error');
            }
          } catch (error) {
            console.log('Auth check error:', error);
            if (authCheckCount >= maxAuthChecks) clearInterval(checkAuthInterval);
          }
        }, 4000);
        const storageListener = (changes, namespace) => {
          if (namespace === 'local' && (changes.backendToken || changes.backendUserData)) {
            console.log('Auth storage changed detected, checking authentication...');
            setTimeout(async () => {
              try {
                await window.BackendAPI.init();
                if (window.BackendAPI.isAuthenticated) {
                  clearInterval(checkAuthInterval);
                  chrome.storage.onChanged.removeListener(storageListener);
                  this.isAuthenticated = true;
                  this.userData = {
                    email: window.BackendAPI.userData.email,
                    name: window.BackendAPI.userData.name,
                    picture: window.BackendAPI.userData.picture
                  };
                  // Check if user exists in local storage for additional user data (bio, templates, etc.)
                  const userExists = await this.checkUserInStorage(this.userData.email);
                  if (userExists) {
                    const storedUserData = await this.getUserFromStorage(this.userData.email);
                    this.userData = { ...this.userData, ...storedUserData };
                  }
                  
                  // Show authenticated UI for all authenticated users - no profile setup redirection
                  this.showAuthenticatedUI();
                  this.showTemporaryMessage('Authentication successful!', 'success');
                }
              } catch (error) { console.log('Storage change auth check error:', error); }
            }, 100);
          }
        };
        chrome.storage.onChanged.addListener(storageListener);
      } catch (error) {
        console.error('Error during authentication:', error);
        this.showTemporaryMessage('Authentication failed. Please try again.', 'error');
      }
    });

    this.elements.signOutButton.addEventListener('click', async () => {
      try {
        if (window.BackendAPI) await window.BackendAPI.signOut();
        this.isAuthenticated = false;
        this.userData = null;
        document.querySelector('#linkmail-editor').style.display = 'none';
        document.querySelector('#linkmail-success').style.display = 'none';
        document.querySelector('#linkmail-splash').style.display = 'none';
        this.showSignInUI();
        if (this.elements.emailResult) this.elements.emailResult.value = '';
        if (this.elements.emailSubject) this.elements.emailSubject.value = '';
        document.getElementById('recipientEmailInput').value = '';
        this.showTemporaryMessage('Signed out successfully', 'success');
      } catch (error) {
        console.error('Error during logout:', error);
        this.showTemporaryMessage('Error signing out', 'error');
      }
    });
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}


