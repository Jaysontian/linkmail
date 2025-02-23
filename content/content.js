// content/content.js

const BACKEND_URL = 'http://localhost:3000';

(function() {
  
  console.log("LinkedIn Email Scraper Content Script running");

    // Add function to scrape profile data
    async function scrapeProfileData() {
        return {
            name: document.querySelector('h1')?.innerText || '',
            headline: document.querySelector('.pv-text-details__headline')?.innerText || '',
            about: document.querySelector('.pv-shared-text-with-see-more')?.innerText || '',
            experience: Array.from(document.querySelectorAll('section#experience-section li')).map(exp => ({
                title: exp.querySelector('.pv-entity__summary-info h3')?.innerText || '',
                company: exp.querySelector('.pv-entity__secondary-title')?.innerText || '',
                duration: exp.querySelector('.pv-entity__date-range span:nth-child(2)')?.innerText || ''
            })),
            email: await findLinkedInEmail()
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
    injectedDiv.innerHTML = `
        <p>Generate an outreach email to ${document.querySelector('h1')?.innerText} with AI instantly.</p>
        <button id="generateButton" style='background-color: rgb(0, 106, 255); margin-top:8px; border-radius: 16px; color: white; padding: 8px 16px; border: none;'>Generate Email</button>
        <div id="loadingIndicator" style="display: none; margin-top: 10px;">
            Generating your email...
        </div>
        <textarea id="emailResult" style="width: 90%; height: 200px; margin-top: 16px; padding: 12px; border-radius: 8px; border: 1px solid #ccc; display: none;"></textarea>
        <button id="copyButton" style='background-color: #28a745; margin-top:8px; border-radius: 16px; color: white; padding: 8px 16px; border: none; display: none;'>Copy to Clipboard</button>
    `;

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



    // Example of scraping emails from page content (customize the selector as needed)
    const emails = [];
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi;
    const bodyText = document.body.innerText;
    const foundEmails = bodyText.match(emailRegex);

    if (foundEmails) {
        foundEmails.forEach(email => {
        if (!emails.includes(email)) {
            emails.push(email);
        }
        });
    }

    // Send scraped emails to popup or storage if needed
    chrome.storage.local.set({ scrapedEmails: emails }, () => {
        console.log("Scraped emails saved: ", emails);
    });







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
