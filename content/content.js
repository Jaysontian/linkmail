const BACKEND_URL = 'http://localhost:3000';

(function() {
  console.log("Linkmail Content Script running");
  
  // Initialize all modules
  URLObserver.init();
  UIManager.init();
  
  // Initial email search
  setTimeout(() => {
    UIManager.populateForm();
  }, 2000); // Give the page time to load
  
  // Handle extension messages
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "findEmail") {
      EmailFinder.findLinkedInEmail()
        .then(email => {
          console.log("Found email:", email);
          if (email) {
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
