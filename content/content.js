//content.js
const BACKEND_URL = 'http://localhost:3000';

// Use a self-executing function with a more robust initialization check
(function() {
  let currentProfileId = null;

  // Function to get LinkedIn profile ID from URL
  function getProfileIdFromUrl() {
    const url = window.location.href;
    const match = url.match(/linkedin\.com\/in\/([^\/]+)/);
    return match ? match[1] : null;
  }

  // ADD this helper function to content.js just before the initialization code
  function forceResetUIState() {
    console.log('Forcing UI state reset for new profile');
    if (window.UIManager) {
      // Find the success view
      const container = document.querySelector('.linkmail-container');
      if (container) {
        const successView = container.querySelector('#linkmail-success');
        const splashView = container.querySelector('#linkmail-splash');

        // If success view is visible, hide it and show splash
        if (successView && successView.style.display === 'block') {
          console.log('Found success view visible, resetting to splash view');
          successView.style.display = 'none';

          if (splashView) {
            splashView.style.display = 'flex';

            // Update the title with the new profile name
            const nameElement = container.querySelector('#title');
            if (nameElement) {
              const h1Element = document.querySelector('h1');
              const profileName = h1Element ? h1Element.innerText : '';
              const firstName = profileName.split(' ')[0] || '';
              nameElement.textContent = `Draft an email to ${firstName}`;
            }
          }
        }
      }

      setTimeout(() => {
        window.UIManager.checkLastEmailSent();
      }, 1000); // Small delay to ensure DOM is ready
    }
  }

  // Function to initialize the extension
  async function initialize() {
    console.log('Starting initialization');

    // Only proceed if we're on a profile page
    const profileId = getProfileIdFromUrl();
    if (!profileId) {
      console.log('Not on a profile page');
      return;
    }

    // Check if this is a different profile than before
    const isNewProfile = profileId !== currentProfileId;
    currentProfileId = profileId;

    // Wait for the DOM to be fully loaded
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }

    // Wait a bit more to ensure LinkedIn's dynamic content is loaded
    await new Promise(resolve => setTimeout(resolve, 1000));

    // If profile changed, clear the cached email
    if (isNewProfile && window.EmailFinder) {
      console.log('New profile detected, clearing cached email');
      window.EmailFinder.clearCachedEmail();
    }

    // If UI exists but profile changed, reset UI
    const existingUI = document.querySelector('.linkmail-container');
    if (existingUI && isNewProfile) {
      console.log('Detected navigation to a new profile, resetting UI');
      forceResetUIState();
      window.UIManager.resetUI();
      return;
    }

    // If no UI exists, create it
    if (!existingUI) {
      console.log('No UI found, creating new UI');
      await window.UIManager.init();
    }
  }

  // Function to observe URL changes
  function setupUrlObserver() {
    console.log('Setting up URL observer');

    // Save initial profile ID
    currentProfileId = getProfileIdFromUrl();

    // Set up interval to check for URL changes
    setInterval(() => {
      const newProfileId = getProfileIdFromUrl();
      if (newProfileId && newProfileId !== currentProfileId) {
        console.log(`Profile changed from ${currentProfileId} to ${newProfileId}`);
        initialize();
      }
    }, 1000);

    // Also listen for navigation events
    window.addEventListener('popstate', () => {
      console.log('Navigation detected via popstate');
      initialize();
    });

    // Set up a MutationObserver as backup
    const observer = new MutationObserver(
      Utils.debounce(() => {
        const newProfileId = getProfileIdFromUrl();
        if (newProfileId && newProfileId !== currentProfileId) {
          console.log(`Profile changed (detected by DOM mutation) from ${currentProfileId} to ${newProfileId}`);
          initialize();
        }
      }, 500)
    );

    // Only observe if document.body exists
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      // Wait for document.body to be available
      const bodyObserver = new MutationObserver(() => {
        if (document.body) {
          bodyObserver.disconnect();
          observer.observe(document.body, { childList: true, subtree: true });
        }
      });
      bodyObserver.observe(document.documentElement, { childList: true });
    }
  }

  // Start initialization and setup observers
  initialize().then(() => {
    setupUrlObserver();
  });

  // Handle extension messages
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'findEmail') {
      EmailFinder.findLinkedInEmail()
        .then(email => {
          console.log('Found email:', email);
          if (email) {
            UIManager.populateForm();
            sendResponse({ email: email });
          } else {
            sendResponse({ error: 'No Email Found on LinkedIn Page. Please Input Email Manually.' });
          }
        })
        .catch(error => {
          console.error('Error finding email:', error);
          sendResponse({ error: 'Error finding email' });
        });
      return true; // Required for async response
    }
  });
})();
