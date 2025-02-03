// popup/popup.js
document.addEventListener("DOMContentLoaded", function() {
  const emailListElement = document.getElementById("emailList");
  const emailBody = document.getElementById("emailBody");
  const generateAIButton = document.getElementById("generateAI");
  const authGmailButton = document.getElementById("authGmail");

  // Retrieve scraped emails from storage on popup open
  chrome.storage.local.get("scrapedEmails", (data) => {
    if (data.scrapedEmails && data.scrapedEmails.length > 0) {
      data.scrapedEmails.forEach(email => {
        const li = document.createElement("li");
        li.textContent = email;
        emailListElement.appendChild(li);
      });
    } else {
      emailListElement.innerHTML = "<li>No emails found.</li>";
    }
  });

  // Placeholder for AI message generation
  generateAIButton.addEventListener("click", () => {
    // TODO: Integrate AI message generation logic
    const draftMessage = "Hello, this is a generated message based on AI logic."; 
    emailBody.value = draftMessage;
  });

  // Trigger Gmail API Authentication via background script
  authGmailButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "initGmailAuth" }, (response) => {
      console.log(response.status);
      alert("Gmail authentication process started. Check console for details.");
    });
  });
});
