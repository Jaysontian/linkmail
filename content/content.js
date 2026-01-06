//content.js

// Use a self-executing function with a more robust initialization check
(function() {
  let currentProfileId = null;
  let isInitializing = false; // Guard to prevent overlapping initializations

  // Function to get LinkedIn profile ID from URL
  function getProfileIdFromUrl() {
    const url = window.location.href;
    const match = url.match(/linkedin\.com\/in\/([^\/?#]+)/);
    return match ? match[1] : null;
  }

  // Function to check if we're on a LinkedIn feed page
  function isLinkedInFeedPage() {
    const url = window.location.href;
    return url.includes('/feed/');
  }

  // Function to check if current profile is the user's own profile
  async function isUserOwnProfile() {
    const profileId = getProfileIdFromUrl();
    if (!profileId) return false;

    try {
      // Get authenticated user from backend storage
      const authData = await new Promise((resolve) => {
        chrome.storage.local.get(['backendUserData'], (result) => {
          resolve(result.backendUserData || null);
        });
      });

      if (!authData || !authData.email) {
        return false;
      }

      // Get user profile record by email to access linkedinUrl
      const userProfile = await new Promise((resolve) => {
        chrome.storage.local.get([authData.email], (result) => {
          resolve(result[authData.email] || null);
        });
      });

      if (!userProfile || !userProfile.linkedinUrl) {
        return false;
      }

      // Extract profile ID from stored LinkedIn URL
      const storedProfileMatch = userProfile.linkedinUrl.match(/linkedin\.com\/in\/([^\/\?]+)/i);
      const storedProfileId = storedProfileMatch ? storedProfileMatch[1].toLowerCase() : null;

      // Compare profile IDs
      const isOwnProfile = storedProfileId && profileId.toLowerCase() === storedProfileId;

      return isOwnProfile;
    } catch (error) {
      console.error('Error checking if profile is user\'s own:', error);
      return false;
    }
  }

  // Function to get page type: 'feed', 'own-profile', or 'other-profile'
  async function getPageType() {
    if (isLinkedInFeedPage()) {
      return 'feed';
    }
    
    const profileId = getProfileIdFromUrl();
    if (!profileId) {
      return null; // Not a supported page
    }

    const isOwn = await isUserOwnProfile();
    return isOwn ? 'own-profile' : 'other-profile';
  }

  // Function to check if we're on a supported LinkedIn page (profile or feed)
  function isSupportedLinkedInPage() {
    return getProfileIdFromUrl() || isLinkedInFeedPage();
  }

  // ADD this helper function to content.js just before the initialization code
  function forceResetUIState() {
    if (window.UIManager) {
      // Hide all views to avoid flicker; actual view will be decided by resetUI
      const container = document.querySelector('.linkmail-container');
      if (container) {
        ['#linkmail-signin', '#linkmail-splash', '#linkmail-editor', '#linkmail-success', '#linkmail-people-suggestions']
          .forEach(selector => {
            const view = container.querySelector(selector);
            if (view) view.style.display = 'none';
          });

        // Also hide the "Couldn't find email" popup
        const noEmailMessage = container.querySelector('#noEmailFoundMessage');
        if (noEmailMessage) noEmailMessage.style.display = 'none';
      }

      setTimeout(() => {
        window.UIManager.checkLastEmailSent();
      }, 1000); // Small delay to ensure DOM is ready
    }
  }

  // Function to initialize the extension
  async function initialize() {

    // Concurrency guard
    if (isInitializing) {
      return;
    }
    isInitializing = true;

    try {
      // Only proceed if we're on a supported LinkedIn page (profile or feed)
      if (!isSupportedLinkedInPage()) {
        return;
      }

      const pageType = await getPageType();
      const profileId = getProfileIdFromUrl();
      

      // Check if this is a different profile than before, or if we're switching between feed and profile
      const currentPageId = profileId || 'feed';
      const isNewPage = currentPageId !== currentProfileId;
      currentProfileId = currentPageId;

      // Store page type for UI manager to use
      window.currentPageType = pageType;

      // Wait for the DOM to be fully loaded
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      // Wait a bit more to ensure LinkedIn's dynamic content is loaded
      await new Promise(resolve => setTimeout(resolve, 1000));

      // If page changed, clear the cached email
      if (isNewPage && window.EmailFinder) {
        window.EmailFinder.clearCachedEmail();
      }

      // If UI exists but page changed, reset UI
      const existingUI = document.querySelector('.linkmail-container');
      if (existingUI && isNewPage) {
        forceResetUIState();
        if (window.UIManager && typeof window.UIManager.resetUI === 'function') {
          await window.UIManager.resetUI();
        }
        return;
      }

      // If no UI exists, create it
      if (!existingUI) {
        try {
          await window.UIManager.init();
        } catch (e) {
          console.error('Error during UI initialization:', e);
        }
      }
    } finally {
      // Always release guard
      isInitializing = false;
    }
  }

  // Function to observe URL changes
  function setupUrlObserver() {

    // Save initial page ID (profile ID or 'feed')
    currentProfileId = getProfileIdFromUrl() || (isLinkedInFeedPage() ? 'feed' : null);

    // Set up interval to check for URL changes
    setInterval(async () => {
      const newPageId = getProfileIdFromUrl() || (isLinkedInFeedPage() ? 'feed' : null);
      if (newPageId && newPageId !== currentProfileId) {
        // Clear the stored page type so it gets re-evaluated
        window.currentPageType = null;
        await initialize();
      }
    }, 1000);

    // Also listen for navigation events
    window.addEventListener('popstate', async () => {
      window.currentPageType = null;
      await initialize();
    });

    // Set up a MutationObserver as backup
    const observer = new MutationObserver(
      Utils.debounce(async () => {
        const newPageId = getProfileIdFromUrl() || (isLinkedInFeedPage() ? 'feed' : null);
        if (newPageId && newPageId !== currentProfileId) {
          window.currentPageType = null;
          await initialize();
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

  // eslint-disable-next-line no-unused-vars
  function isLinkedInProfilePage() {
    return window.location.href.match(/^https:\/\/www\.linkedin\.com\/in\/[^/]+\/?$/);
  }
})();
