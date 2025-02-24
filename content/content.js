// content/content.js

const BACKEND_URL = 'http://localhost:3000';

(function() {
  console.log("LinkedIn Email Scraper Content Script running");

  // Add debounce function to prevent multiple rapid executions
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Add a URL observer to detect page changes
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(
    debounce(() => {
      const currentUrl = location.href;
      // Only trigger if we're on a different profile page
      if (currentUrl !== lastUrl && currentUrl.includes('/in/')) {
        lastUrl = currentUrl;
        console.log('LinkedIn profile page changed, updating email...');
        scrapeProfileData();
      }
    }, 1000)  // 1 second debounce
  );

  // Start observing URL changes
  urlObserver.observe(document.body, { childList: true, subtree: true });

  // Add function to scrape profile data
  async function scrapeProfileData() {
    const email = await findLinkedInEmail(); // Get email first
    const recipientInput = document.getElementById('recipientEmailInput');
    const nameElement = document.getElementById('profileName');
    
    if (recipientInput && email) {
      recipientInput.value = email;
    }
    
    if (nameElement) {
      nameElement.textContent = `Generate an outreach email to ${document.querySelector('h1')?.innerText || ''} with AI instantly.`;
    }
    
    return {
      name: document.querySelector('h1')?.innerText || '',
      headline: document.querySelector('.pv-text-details__headline')?.innerText || '',
      about: document.querySelector('.pv-shared-text-with-see-more')?.innerText || '',
      experience: Array.from(document.querySelectorAll('section#experience-section li')).map(exp => ({
        title: exp.querySelector('.pv-entity__summary-info h3')?.innerText || '',
        company: exp.querySelector('.pv-entity__secondary-title')?.innerText || '',
        duration: exp.querySelector('.pv-entity__date-range span:nth-child(2)')?.innerText || ''
      })),
      email: email
    };
  }

  async function generateColdEmail(profileData) {
    try {
      const response = await fetch(`${BACKEND_URL}/generate-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile: profileData
        })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Error generating email:', error);
      return null;
    }
  }

  // Create the injected div with a textarea
  const injectedDiv = document.createElement('div');
  const nameElement = document.createElement('p');
  nameElement.id = 'profileName';
  nameElement.textContent = `Generate an outreach email to ${document.querySelector('h1')?.innerText || ''} with AI instantly.`;
  
  injectedDiv.innerHTML = `
    <input type="email" id="recipientEmailInput" placeholder="Recipient Email" style="width: 90%; margin-top: 8px; padding: 8px; border-radius: 8px; border: 1px solid #ccc;">
    <button id="generateButton" style='background-color: rgb(0, 106, 255); margin-top:8px; border-radius: 16px; color: white; padding: 8px 16px; border: none;'>Generate Email</button>
    <div id="loadingIndicator" style="display: none; margin-top: 10px;">
      Generating your email...
    </div>
    <textarea id="emailResult" style="width: 90%; height: 200px; margin-top: 16px; padding: 12px; border-radius: 8px; border: 1px solid #ccc; display: none;"></textarea>
    <button id="copyButton" style='background-color: #28a745; margin-top:8px; border-radius: 16px; color: white; padding: 8px 16px; border: none; display: none;'>Copy to Clipboard</button>
  `;

  injectedDiv.prepend(nameElement);

  Object.assign(injectedDiv.style, {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    textAlign: 'center',
    alignItems: 'center',
    boxShadow: '0 0 10px rgba(0,0,0,0.15)',
    padding: '16px',
    minHeight: '300px',
    borderRadius: '8px',
    backgroundColor: 'white',
    marginBottom:'20px',
  });

  // Add the div to the page
  const asideElement = document.querySelector('aside.scaffold-layout__aside');
  if (asideElement) {
    asideElement.prepend(injectedDiv);
  } else {
    console.error('Target aside element not found.');
  }

  // Get elements
  const generateButton = injectedDiv.querySelector('#generateButton');
  const loadingIndicator = injectedDiv.querySelector('#loadingIndicator');
  const emailResult = injectedDiv.querySelector('#emailResult');
  const copyButton = injectedDiv.querySelector('#copyButton');

  // Add click handler for generate button
  generateButton.addEventListener('click', async () => {
    // Show loading state
    generateButton.disabled = true;
    loadingIndicator.style.display = 'block';
    emailResult.style.display = 'none';
    copyButton.style.display = 'none';

    try {
      // Scrape profile data
      const profileData = await scrapeProfileData();
      
      // Get the recipient email from the input field
      const recipientEmail = document.getElementById('recipientEmailInput').value;
      if (recipientEmail) {
        profileData.email = recipientEmail;
      }
      
      // Generate email
      const response = await generateColdEmail(profileData);
      
      if (response?.email) {
        // Show the result
        emailResult.value = response.email;
        emailResult.style.display = 'block';
        copyButton.style.display = 'block';
      } else {
        emailResult.value = "Failed to generate email. Please try again.";
        emailResult.style.display = 'block';
      }
    } catch (error) {
      console.error('Error:', error);
      emailResult.value = "An error occurred while generating the email.";
      emailResult.style.display = 'block';
    } finally {
      // Hide loading state
      generateButton.disabled = false;
      loadingIndicator.style.display = 'none';
    }
  });

  // Add click handler for copy button
  copyButton.addEventListener('click', () => {
    emailResult.select();
    document.execCommand('copy');
    copyButton.textContent = 'Copied!';
    setTimeout(() => {
      copyButton.textContent = 'Copy to Clipboard';
    }, 2000);
  });

  // Helper function to extract email using regex
  function extractEmail(text) {
    if (!text) return null;
    
    // More comprehensive email regex
    const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gi;
    
    const matches = text.match(emailRegex);
    console.log('All email matches:', matches); // Debug log
    return matches ? matches[0] : null;
  }

  // Function to check Contact Info section
  async function checkContactInfo() {
    const contactButton = document.querySelector('a[href*="contact-info"]');
    if (!contactButton) return null;

    // Click the contact info button
    contactButton.click();
    
    // Wait for modal to appear and try multiple times
    let modalContent = null;
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try multiple possible selectors for the modal content
      modalContent = document.querySelector([
        'div[aria-label="Contact info"] .artdeco-modal__content',
        '.pv-contact-info__contact-type',
        '.pv-profile-section__section-info',
        '.artdeco-modal__content'
      ].join(','));

      if (modalContent) break;
    }

    if (modalContent) {
      // Search through all text content in the modal
      const allText = modalContent.innerText || modalContent.textContent;
      console.log('Modal content found:', allText); // Debug log
      
      const email = extractEmail(allText);
      console.log('Email found:', email); // Debug log
      
      // Close the modal
      const closeButton = document.querySelector([
        'button[aria-label="Dismiss"]',
        '.artdeco-modal__dismiss',
        '.artdeco-modal__close'
      ].join(','));
      
      if (closeButton) closeButton.click();
      
      return email;
    }

    // If we get here, we couldn't find the modal or email
    console.log('No modal content found'); // Debug log
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

  // Initial scrape
  scrapeProfileData();
})();
