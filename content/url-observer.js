//url-observer.js
window.URLObserver = {
  lastUrl: location.href,

  init() {
    const urlObserver = new MutationObserver(
      Utils.debounce(() => {
        const currentUrl = location.href;
        if (currentUrl !== this.lastUrl && currentUrl.includes('/in/')) {
          this.lastUrl = currentUrl;
          console.log('LinkedIn profile page changed, resetting UI...');
          requestAnimationFrame(() => UIManager.resetUI());
        }
      }, 250)
    );

    urlObserver.observe(document.body, { childList: true, subtree: true });
  }
};
