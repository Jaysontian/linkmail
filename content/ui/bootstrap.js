// content/ui/bootstrap.js
// Attach bootstrap/injection functions to window.UIManager

(function attachBootstrap(){
  if (!window) return;
  window.UIManager = window.UIManager || {};

  window.UIManager.cleanupUI = function cleanupUI() {
    console.log('Cleaning up UI elements with instanceId:', this.instanceId);
    const existingUIs = document.querySelectorAll('.linkmail-container');
    console.log(`Found ${existingUIs.length} existing UI elements to clean up`);
    existingUIs.forEach(ui => { ui.remove(); console.log('Removed UI element'); });
    this.elements = {};
    this.container = null;
  };

  window.UIManager.createUI = async function createUI() {
    try {
      if (document.querySelector('.linkmail-container')) return;
      if (this._isCreatingUI) { console.log('UI creation already in progress, skipping'); return; }
      this._isCreatingUI = true;

      const templateHtml = await this.loadHTML();
      console.log('HTML template loaded successfully');
      const temp = document.createElement('div');
      temp.innerHTML = templateHtml;
      const styleElement = temp.querySelector('style');
      if (styleElement) document.head.appendChild(styleElement);
      const injectedDiv = temp.firstElementChild;
      if (!injectedDiv) { console.error('No first element found in template'); this._isCreatingUI = false; return; }
      this.container = injectedDiv;

      const nameElement = injectedDiv.querySelector('#title');
      if (nameElement) {
        const pageType = this.getSafePageType();
        const shouldUseManualEmail = pageType === 'feed' || pageType === 'own-profile';
        if (shouldUseManualEmail) nameElement.textContent = 'Draft personalized emails with AI';
        else {
          const h1Element = document.querySelector('h1');
          const fullName = h1Element?.innerText || '';
          const firstName = fullName.split(' ')[0]?.charAt(0).toUpperCase() + fullName.split(' ')[0]?.slice(1) || '';
          nameElement.textContent = `Draft an email to ${firstName}`;
        }
      }

      console.log('Injecting UI into page...');
      let asideElement = document.querySelector('aside.scaffold-layout__aside');
      let attempts = 0;
      const maxAttempts = 10;
      while (!asideElement && attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 300));
        asideElement = document.querySelector('aside.scaffold-layout__aside');
      }
      console.log('Aside element found after attempts:', attempts, !!asideElement);
      if (asideElement) {
        if (!document.querySelector('.linkmail-container')) {
          asideElement.prepend(injectedDiv);
        } else {
          console.log('LinkMail UI already present at inject time; aborting duplicate injection');
          this._isCreatingUI = false; return;
        }
        console.log('UI successfully injected');
      } else {
        console.error('Target aside element not found after waiting. Aborting injection for now.');
        this._isCreatingUI = false; return;
      }

      this._cacheElements(injectedDiv);
      if (!this.elements.signInButton || !this.elements.splashView || !this.elements.generateButton) {
        console.error('Required UI elements not found:', {
          signInButton: !!this.elements.signInButton,
          splashView: !!this.elements.splashView,
          generateButton: !!this.elements.generateButton
        });
        return;
      }

      const editorViewAtInit = injectedDiv.querySelector('#linkmail-editor');
      const successViewAtInit = injectedDiv.querySelector('#linkmail-success');
      [this.elements.signInView, this.elements.splashView, this.elements.peopleSuggestionsView, editorViewAtInit, successViewAtInit]
        .forEach(view => { if (view) view.style.display = 'none'; });

      const initialPageType = window.currentPageType || 'other-profile';
      const isFeedLikePage = initialPageType === 'feed' || initialPageType === 'own-profile';
      if (isFeedLikePage && this.elements.peopleSuggestionsView) {
        this.elements.peopleSuggestionsView.style.display = 'block';
        const loadingEl = injectedDiv.querySelector('#people-suggestions-loading');
        if (loadingEl) loadingEl.style.display = 'block';
      }

      console.log('Checking authentication status...');
      await this.checkAuthStatus();
      console.log('UI creation complete');
    } catch (error) {
      console.error('Error creating UI:', error);
      try {
        const asideElement = document.querySelector('aside.scaffold-layout__aside');
        if (asideElement) {
          const fallbackDiv = document.createElement('div');
          fallbackDiv.className = 'linkmail-container';
          fallbackDiv.innerHTML = `
            <div id="linkmail-signin" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <p>There is an error.</p>
            </div>
          `;
          asideElement.prepend(fallbackDiv);
          console.log('Fallback UI created');
        }
      } catch (fallbackError) {
        console.error('Failed to create fallback UI:', fallbackError);
      }
    } finally {
      this._isCreatingUI = false;
    }
  };

  window.UIManager.init = async function init() {
    this.cleanupUI();
    await this.createUI();
    this.setupEventListeners();
    this.setupStorageListener();
    this.setupEmailHistoryRefresh();
    this.setupTemplateRefreshListener();
    this.setupFocusRefresh();
    await this.checkLastEmailSent();
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}


