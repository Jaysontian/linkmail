// content/content.js
(function() {
  console.log("LinkedIn Email Scraper Content Script running");

  // Helper function to extract email using regex
  function extractEmail(text) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const matches = text.match(emailRegex);
    return matches ? matches[0] : null;
  }

  // Function to check Contact Info section
  async function checkContactInfo() {
    const contactButton = document.querySelector('a[href*="contact-info"]');
    if (!contactButton) return null;

    // Click the contact info button
    contactButton.click();
    
    // Wait for modal to appear
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Look for email in contact info modal
    const modalContent = document.querySelector('div[aria-label="Contact info"] .artdeco-modal__content');
    if (modalContent) {
      const email = extractEmail(modalContent.textContent);
      
      // Close the modal
      const closeButton = document.querySelector('button[aria-label="Dismiss"]');
      if (closeButton) closeButton.click();
      
      return email;
    }
    return null;
  }

  // Function to check About section
  function checkAboutSection() {
    const aboutSection = document.getElementById('about')?.closest('section');
    if (!aboutSection) return null;
    
    return extractEmail(aboutSection.textContent);
  }

  // Main function to find email
  async function findLinkedInEmail() {
    // Try Contact Info first
    const contactInfoEmail = await checkContactInfo();
    if (contactInfoEmail) {
      return contactInfoEmail;
    }

    // Try About section next
    const aboutEmail = checkAboutSection();
    if (aboutEmail) {
      return aboutEmail;
    }

    // No email found
    return null;
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "findEmail") {
      findLinkedInEmail().then(email => {
        if (email) {
          sendResponse({ email: email });
        } else {
          sendResponse({ error: "No Email Found on LinkedIn Page. Please Input Email Manually." });
        }
      });
      return true; // Required for async response
    }
  });
})();
