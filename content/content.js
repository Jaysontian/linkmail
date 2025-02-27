const BACKEND_URL = 'http://localhost:3000';

// Use a self-executing function with a more robust initialization check
(function() {
  // Check if we've already injected our UI
  if (document.querySelector('.linkmail-container')) {
    console.log("LinkMail UI already exists, preventing duplicate injection");
    return;
  }
  
  console.log("Linkmail Content Script running with fresh injection");
  
  // Function to initialize the extension
  async function initialize() {
    // Clean up any existing UI elements first
    if (window.UIManager) {
      window.UIManager.cleanupUI();
    }
    
    // Initialize URL observer
    if (location.href.includes('/in/')) {
      console.log("On a profile page, initializing UI directly");
      
      // Wait for the DOM to be fully loaded
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }
      
      // Wait a bit more to ensure LinkedIn's dynamic content is loaded
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Initialize UI
      await UIManager.init();
    } else {
      console.log("Not on a profile page, setting up URL observer only");
      
      // Set up a simple MutationObserver to detect URL changes
      const observer = new MutationObserver(
        Utils.debounce(() => {
          if (location.href.includes('/in/') && !document.querySelector('.linkmail-container')) {
            console.log('Detected navigation to profile page');
            initialize();
          }
        }, 250)
      );
      
      observer.observe(document, { childList: true, subtree: true });
      
      // Also listen for navigation events
      window.addEventListener('popstate', () => {
        console.log('Navigation detected via popstate');
        if (location.href.includes('/in/') && !document.querySelector('.linkmail-container')) {
          initialize();
        }
      });
    }
  }
  
  // Start initialization
  initialize();
  
  // Handle extension messages
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "findEmail") {
      EmailFinder.findLinkedInEmail()
        .then(email => {
          console.log("Found email:", email);
          if (email) {
            UIManager.populateForm();
            sendResponse({ email: email });
          } else {
            sendResponse({ error: "No Email Found on LinkedIn Page. Please Input Email Manually." });
          }
        })
        .catch(error => {
          console.error("Error finding email:", error);
          sendResponse({ error: "Error finding email" });
        });
      return true; // Required for async response
    }
  });
})();
