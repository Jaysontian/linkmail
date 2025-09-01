// content/ui/helpers.js
// Attach helper utilities to window.UIManager without changing external API

(function attachUIHelpers(){
  if (!window) return;
  window.UIManager = window.UIManager || {};

  // Centralized list of view selectors
  window.UIManager.ALL_VIEWS = window.UIManager.ALL_VIEWS || [
    '#linkmail-signin',
    '#linkmail-splash',
    '#linkmail-editor',
    '#linkmail-success',
    '#linkmail-people-suggestions'
  ];

  // Safe page type detection
  window.UIManager.getSafePageType = window.UIManager.getSafePageType || function getSafePageType(){
    try {
      const cp = window.currentPageType;
      if (cp === 'feed' || cp === 'own-profile') return cp;
      const href = window.location.href || '';
      if (href.includes('/feed/')) return 'feed';
      if (href.includes('/in/')) {
        const currentMatch = href.match(/linkedin\.com\/in\/([^\/?#]+)/i);
        const currentId = currentMatch ? currentMatch[1].toLowerCase() : null;
        const storedId = window.UIManager._ownProfileId;
        if (currentId && storedId && currentId === storedId) return 'own-profile';
        return 'other-profile';
      }
      return 'other-profile';
    } catch (_e) {
      return window.currentPageType || 'other-profile';
    }
  };

  // Update cached own-profile id
  window.UIManager.updateOwnProfileIdFromUserData = window.UIManager.updateOwnProfileIdFromUserData || function updateOwnProfileIdFromUserData(){
    try {
      const storedUrl = this.userData?.linkedinUrl || '';
      const storedMatch = storedUrl.match(/linkedin\.com\/in\/([^\/?#]+)/i);
      this._ownProfileId = storedMatch ? storedMatch[1].toLowerCase() : null;
    } catch (_e) {
      this._ownProfileId = null;
    }
  };

  // Cache frequently accessed elements
  window.UIManager._cacheElements = window.UIManager._cacheElements || function _cacheElements(container){
    this.elements = {
      signInButton: container.querySelector('#googleSignInButton'),
      signInView: container.querySelector('#linkmail-signin'),
      splashView: container.querySelector('#linkmail-splash'),
      peopleSuggestionsView: container.querySelector('#linkmail-people-suggestions'),
      generateButton: container.querySelector('#generateButton'),
      loadingIndicator: container.querySelector('#loadingIndicator'),
      emailSubject: container.querySelector('#emailSubject'),
      emailResult: container.querySelector('#emailResult'),
      copyButton: container.querySelector('#copyButton'),
      sendGmailButton: container.querySelector('#sendGmailButton'),
      signOutButton: container.querySelector('#signOutButton'),
      editProfileButton: container.querySelector('#editProfileButton'),
      templateDropdown: container.querySelector('#template-dropdown'),
      menuToggle: container.querySelector('#menuToggle'),
      menuContent: container.querySelector('#menuContent'),
      findEmailApolloButton: container.querySelector('#findEmailApolloButton'),
      retryPeopleSearchButton: container.querySelector('#retry-people-search')
    };
  };

  // Hide all known views
  window.UIManager._hideAllViews = window.UIManager._hideAllViews || function _hideAllViews(){
    if (!this.container) return;
    this.ALL_VIEWS.forEach(selector => {
      const view = this.container.querySelector(selector);
      if (view) view.style.display = 'none';
    });
  };
})();

// Export for tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}


