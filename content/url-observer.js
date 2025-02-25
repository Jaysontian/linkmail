//url-observer.js
window.URLObserver = {
  lastUrl: location.href,
  initialized: false,

  init() {
    // Run initial setup
    this.checkForProfilePage();
    
    // Set up the observer
    const urlObserver = new MutationObserver(
      Utils.debounce(() => {
        const currentUrl = location.href;
        if (currentUrl !== this.lastUrl) {
          this.lastUrl = currentUrl;
          console.log('LinkedIn page changed, checking if profile page...');
          this.checkForProfilePage();
        }
      }, 250)
    );

    urlObserver.observe(document, { childList: true, subtree: true });
    
    // Also listen for navigation events
    window.addEventListener('popstate', () => {
      console.log('Navigation detected via popstate');
      this.checkForProfilePage();
    });
  },
  
  checkForProfilePage() {
    // Check if we're on a profile page
    if (location.href.includes('/in/')) {
      console.log('Profile page detected, initializing UI...');
      
      // Wait for the profile page to fully render
      this.waitForProfileElements()
        .then(() => {
          console.log('Profile elements found, resetting UI');
          if (this.initialized) {
            UIManager.resetUI();
          } else {
            // If first time, do full initialization
            this.initialized = true;
            UIManager.init();
          }
        })
        .catch(error => {
          console.error('Error waiting for profile elements:', error);
        });
    } else {
      console.log('Not a profile page, URL:', location.href);
    }
  },
  
  waitForProfileElements() {
    return new Promise((resolve, reject) => {
      // Check for essential profile elements
      const checkElements = () => {
        const profileHeader = document.querySelector('h1');
        const asideElement = document.querySelector('aside.scaffold-layout__aside');
        
        if (profileHeader && asideElement) {
          resolve();
        } else {
          // Try again after a short delay
          setTimeout(checkElements, 200);
        }
      };
      
      // Set a timeout to avoid infinite checking
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for profile elements'));
      }, 5000);
      
      checkElements();
    });
  }
};
