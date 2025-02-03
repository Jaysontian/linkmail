

// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log("LinkedIn Email Scraper Extension installed.");
});

// Placeholder for initiating Gmail API authentication.
function initGmailAuth() {
  // TODO: Implement Gmail API auth flow
  console.log("Gmail API auth triggered");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "initGmailAuth") {
    initGmailAuth();
    sendResponse({status: "Gmail auth initiated"});
  }
});
