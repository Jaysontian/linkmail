// content/ui/views.js
// Attach view transition utilities to window.UIManager

(function attachViews(){
  if (!window) return;
  window.UIManager = window.UIManager || {};

  window.UIManager.showSignInUI = function showSignInUI() {
    console.log('Showing sign in UI');
    this.showView('#linkmail-signin');
    const accountInfo = this.container.querySelector('.account-dropdown');
    if (accountInfo) accountInfo.style.display = 'none';
  };

  window.UIManager.showAuthenticatedUI = function showAuthenticatedUI(preserveCurrentView = false) {
    try {
      console.log('Showing authenticated UI, preserveCurrentView:', preserveCurrentView);
      if (this.elements.signInView) this.elements.signInView.style.display = 'none';

      const pageType = this.getSafePageType();
      const shouldShowPeopleSuggestions = pageType === 'feed' || pageType === 'own-profile';

      if (!preserveCurrentView) {
        if (shouldShowPeopleSuggestions) {
          if (this.elements.peopleSuggestionsView) {
            this.elements.peopleSuggestionsView.style.display = 'block';
            this.loadPeopleSuggestions();
          }
          if (this.elements.splashView) this.elements.splashView.style.display = 'none';
        } else {
          if (this.elements.splashView) this.elements.splashView.style.display = 'flex';
          if (this.elements.peopleSuggestionsView) this.elements.peopleSuggestionsView.style.display = 'none';
        }
      } else {
        console.log('Preserving current view, not changing view');
      }

      try {
        const accountInfo = document.querySelector('.linkmail-account-info');
        const userEmailDisplay = document.getElementById('user-email-display');
        if (accountInfo && this.userData?.email) {
          accountInfo.style.display = 'block';
          if (userEmailDisplay) userEmailDisplay.textContent = this.userData.email;
        }
      } catch (domError) {
        console.log('Error accessing DOM elements:', domError);
      }

      this.refreshUserData().then(() => {
        if (window.GmailManager && this.userData) window.GmailManager.setUserData(this.userData);
        this.populateTemplateDropdown();
        this.checkLastEmailSent();
      }).catch(error => console.log('Error refreshing user data:', error));
    } catch (error) {
      console.log('Error in showAuthenticatedUI:', error);
    }
  };

  window.UIManager.resetUI = async function resetUI(forceSignOut = false) {
    console.log('Resetting UI state with forceSignOut:', forceSignOut);
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
          console.log('Extension context invalidated, cannot check user in storage during reset');
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
          this.redirectToBioSetup(this.userData.email);
        }
      } catch (error) {
        console.log('Error checking user in storage during reset:', error);
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
    console.log(`Showing view: ${viewName}`);
    if (!this.container) { console.error('Container not initialized, cannot show view'); return; }
    const allViews = this.ALL_VIEWS;
    allViews.forEach(selector => {
      const view = this.container.querySelector(selector);
      if (view) { view.style.display = 'none'; console.log(`Hidden view: ${selector}`); }
      else { console.warn(`View not found: ${selector}`); }
    });
    const targetView = this.container.querySelector(viewName);
    if (targetView) {
      targetView.style.display = (viewName === '#linkmail-splash') ? 'flex' : 'block';
      console.log(`Displayed view: ${viewName}`);
      if (viewName === '#linkmail-people-suggestions') this.loadPeopleSuggestions();
    } else {
      console.error(`Target view not found: ${viewName}`);
    }
  };

  window.UIManager.getCurrentView = function getCurrentView() {
    if (!this.container) return 'unknown';
    const editorView = this.container.querySelector('#linkmail-editor');
    const splashView = this.container.querySelector('#linkmail-splash');
    const successView = this.container.querySelector('#linkmail-success');
    const signInView = this.container.querySelector('#linkmail-signin');
    if (editorView && editorView.style.display === 'block') return 'editor';
    if (successView && successView.style.display === 'block') return 'success';
    if (splashView && splashView.style.display === 'flex') return 'splash';
    if (signInView && signInView.style.display === 'flex') return 'signin';
    return 'unknown';
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}


