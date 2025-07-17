window.URLObserver = {
  init() {
    console.log('URLObserver initialization skipped - using simplified approach in content.js');
    // This is now handled directly in content.js
  },

  checkForProfilePage() {
    // This is now handled directly in content.js
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
      // eslint-disable-next-line no-unused-vars
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for profile elements'));
      }, 5000);

      checkElements();
    });
  },

  cleanup() {
    // Nothing to clean up in this simplified version
  }
};
