//content.js
const BACKEND_URL = 'http://localhost:3000';

(async function() {
  console.log("Linkmail Content Script running");
  
  // Initialize URL observer first
  URLObserver.init();
  
  // Only initialize UI if we're on a profile page
  if (location.href.includes('/in/')) {
    await UIManager.init();
  } else {
    console.log("Not on a profile page, waiting for navigation");
  }
  
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
