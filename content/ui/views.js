// content/ui/views.js
// Attach view transition utilities to window.UIManager

(function attachViews(){
  if (!window) return;
  window.UIManager = window.UIManager || {};

  window.UIManager.showSignInUI = function showSignInUI() {
    this.showView('#linkmail-signin');
    const accountInfo = this.container.querySelector('.account-dropdown');
    if (accountInfo) accountInfo.style.display = 'none';
  };

  // Add circuit breaker to prevent infinite loops
  window.UIManager._authUICallHistory = [];
  window.UIManager._authUIBlocked = false;
  
  // Manual reset function for debugging
  window.UIManager.resetAuthUICircuitBreaker = function() {
    this._authUIBlocked = false;
    this._authUICallHistory = [];
  };
  
  window.UIManager.showAuthenticatedUI = function showAuthenticatedUI(preserveCurrentView = false) {
    const now = Date.now();
    
    // Add to call history
    this._authUICallHistory.push(now);
    
    // Keep only calls from last 5 seconds
    this._authUICallHistory = this._authUICallHistory.filter(time => now - time < 5000);
    
    // If blocked, don't allow any calls
    if (this._authUIBlocked) {
      console.error('[showAuthenticatedUI] BLOCKED - function is in circuit breaker mode');
      return;
    }
    
    // If more than 10 calls in 5 seconds, activate circuit breaker
    if (this._authUICallHistory.length > 10) {
      console.error('[showAuthenticatedUI] CIRCUIT BREAKER ACTIVATED');
      console.error('- Total calls in last 5 seconds:', this._authUICallHistory.length);
      console.error('- Call times:', this._authUICallHistory.map(t => new Date(t).toLocaleTimeString()));
      console.error('- To manually reset: window.UIManager.resetAuthUICircuitBreaker()');
      this._authUIBlocked = true;
      
      // Auto-reset after 10 seconds
      setTimeout(() => {
        this._authUIBlocked = false;
        this._authUICallHistory = [];
      }, 10000);
      
      return;
    }
    
    try {

      const pageType = this.getSafePageType();
      const shouldShowPeopleSuggestions = pageType === 'feed' || pageType === 'own-profile';

      // Auto-detect if we should preserve the current view
      if (!preserveCurrentView) {
        const currentView = this.getCurrentView();
        const shouldAutoPreserve = currentView === 'editor' || currentView === 'success';
        
        if (shouldAutoPreserve) {
          preserveCurrentView = true;
        }
      }

      if (!preserveCurrentView) {
        if (shouldShowPeopleSuggestions) {
          this.showView('#linkmail-people-suggestions');
        } else {
          this.showView('#linkmail-splash');
        }
      } else {
      }

      try {
        const accountInfo = document.querySelector('.linkmail-account-info');
        const userEmailDisplay = document.getElementById('user-email-display');
        if (accountInfo && this.userData?.email) {
          accountInfo.style.display = 'block';
          if (userEmailDisplay) userEmailDisplay.textContent = this.userData.email;
        }
      } catch (domError) {
      }

      // Set flag to prevent storage listener loops
      this._updatingStorage = true;
      
      // First, fetch the latest templates from backend
      this.refreshTemplatesFromBackend().then(() => {
        // Then refresh user data from local storage (which now has the latest templates)
        return this.refreshUserData();
      }).then(() => {
        if (window.GmailManager && this.userData) window.GmailManager.setUserData(this.userData);
        this.populateTemplateDropdown();
        this.checkLastEmailSent();
      }).catch(error => console.warn('Error refreshing user data:', error)).finally(() => {
        // Reset flag after operations complete
        setTimeout(() => {
          this._updatingStorage = false;
        }, 500);
      });
    } catch (error) {
    }
  };

  window.UIManager.resetUI = async function resetUI(forceSignOut = false) {
    if (!this.container) { console.error('Container not initialized, cannot reset UI'); return; }

    const editorView = this.container.querySelector('#linkmail-editor');
    const successView = this.container.querySelector('#linkmail-success');
    const splashView = this.container.querySelector('#linkmail-splash');
    const signInView = this.container.querySelector('#linkmail-signin');
    const peopleSuggestionsView = this.container.querySelector('#linkmail-people-suggestions');

    this._hideAllViews();

    const emailResult = this.container.querySelector('#emailResult');
    const emailSubject = this.container.querySelector('#emailSubject');
    const recipientInput = this.container.querySelector('#recipientEmailInput');
    if (emailResult) emailResult.value = '';
    if (emailSubject) emailSubject.value = '';
    if (recipientInput) recipientInput.value = '';

    const allPrompts = this.container.querySelectorAll('.linkmail-prompt');
    allPrompts.forEach(prompt => prompt.classList.remove('linkmail-prompt-selected'));
    this.selectedTemplate = {};

    if (this.isAuthenticated && !forceSignOut) {
      try {
        if (!chrome.runtime?.id) {
          if (signInView) signInView.style.display = 'flex';
          return;
        }
        const userExists = await this.checkUserInStorage(this.userData.email);
        if (userExists) {
          const storedUserData = await this.getUserFromStorage(this.userData.email);
          this.userData = { ...this.userData, ...storedUserData };
          const pageType = this.getSafePageType();
          const shouldShowPeopleSuggestions = pageType === 'feed' || pageType === 'own-profile';
          if (shouldShowPeopleSuggestions) {
            if (peopleSuggestionsView) { peopleSuggestionsView.style.display = 'block'; this.loadPeopleSuggestions(); }
          } else {
            if (splashView) splashView.style.display = 'flex';
          }
          const accountInfo = this.container.querySelector('.linkmail-account-info');
          const userEmailDisplay = this.container.querySelector('#user-email-display');
          if (accountInfo && this.userData?.email) {
            accountInfo.style.display = 'block';
            if (userEmailDisplay) userEmailDisplay.textContent = this.userData.email;
          }
        } else {
          if (signInView) signInView.style.display = 'flex';
        }
      } catch (error) {
        if (signInView) signInView.style.display = 'flex';
      }
    } else {
      if (signInView) signInView.style.display = 'flex';
      const accountInfo = this.container.querySelector('.linkmail-account-info');
      if (accountInfo) accountInfo.style.display = 'none';
    }

    const nameElement = this.container.querySelector('#title');
    if (nameElement) {
      const pageType = this.getSafePageType();
      const shouldShowGenericTitle = pageType === 'feed' || pageType === 'own-profile';
      if (shouldShowGenericTitle) {
        nameElement.textContent = 'Draft personalized emails with AI';
      } else {
        let profileName = '';
        const h1Element = document.querySelector('h1');
        if (h1Element) profileName = h1Element.innerText || '';
        const firstName = profileName.split(' ')[0] || '';
        nameElement.textContent = `Draft an email to ${firstName}`;
      }
    }
    this.populateTemplateDropdown();
    await this.checkLastEmailSent();
    await this.populateForm();
  };

  window.UIManager.showView = function showView(viewName) {
    if (!this.container) { 
      console.error('[SHOWVIEW] Container not initialized, cannot show view'); 
      return; 
    }
    
    const allViews = this.ALL_VIEWS;
    
    // FORCE hide all views first with !important style
    allViews.forEach(selector => {
      const view = this.container.querySelector(selector);
      if (view) { 
        view.style.setProperty('display', 'none', 'important');
      }
      else { console.warn(`[SHOWVIEW] View not found: ${selector}`); }
    });
    
    // Show the requested view with !important
    const targetView = this.container.querySelector(viewName);
    if (targetView) {
      const displayValue = (viewName === '#linkmail-splash') ? 'flex' : 'block';
      targetView.style.setProperty('display', displayValue, 'important');
      
      // Double-check that other views are actually hidden using computed styles
      setTimeout(() => {
        allViews.forEach(selector => {
          const view = this.container.querySelector(selector);
          if (view) {
            const computedDisplay = getComputedStyle(view).display;
            const isTarget = selector === viewName;
            
            if (!isTarget && computedDisplay !== 'none') {
              console.error(`[SHOWVIEW] ERROR: View ${selector} should be hidden but computed display is: ${computedDisplay}`);
              // Force hide again
              view.style.setProperty('display', 'none', 'important');
            }
          }
        });
      }, 100);
      
      if (viewName === '#linkmail-people-suggestions') this.loadPeopleSuggestions();
    } else {
      console.error(`[SHOWVIEW] Target view not found: ${viewName}`);
    }
  };

  window.UIManager.getCurrentView = function getCurrentView() {
    if (!this.container) {
      console.warn('[getCurrentView] Container not initialized');
      return 'unknown';
    }
    
    const views = [
      { selector: '#linkmail-editor', name: 'editor', expectedDisplay: 'block' },
      { selector: '#linkmail-success', name: 'success', expectedDisplay: 'block' },
      { selector: '#linkmail-splash', name: 'splash', expectedDisplay: 'flex' },
      { selector: '#linkmail-signin', name: 'signin', expectedDisplay: 'flex' },
      { selector: '#linkmail-people-suggestions', name: 'people-suggestions', expectedDisplay: 'block' }
    ];
    
    let activeViews = [];
    for (const view of views) {
      const element = this.container.querySelector(view.selector);
      if (element) {
        const computedDisplay = getComputedStyle(element).display;
        if (computedDisplay === view.expectedDisplay) {
          activeViews.push(view.name);
        }
      }
    }
    
    if (activeViews.length === 1) {
      return activeViews[0];
    } else if (activeViews.length > 1) {
      console.warn(`[getCurrentView] Multiple active views detected: ${activeViews.join(', ')}, returning first one: ${activeViews[0]}`);
      return activeViews[0];
    }
    
    console.warn('[getCurrentView] No active view found, returning unknown');
    return 'unknown';
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}


