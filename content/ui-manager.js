window.UIManager = {
  elements: {},
  userData: null,

  async loadHTML() {
    const url = chrome.runtime.getURL('/content/linkedin-div.html');
    const response = await fetch(url);
    const html = await response.text();
    return html;
  },

  async populateForm() {
    const email = await EmailFinder.findLinkedInEmail();
    const recipientInput = document.getElementById('recipientEmailInput');
    const nameElement = document.getElementById('profileName');
    
    if (recipientInput && email) {
      recipientInput.value = email;
    }
    
    if (nameElement) {
      nameElement.textContent = `Generate an outreach email to ${document.querySelector('h1')?.innerText || ''} with AI instantly.`;
    }
  },

  async createUI() {
    const templateHtml = await this.loadHTML();

    // Create a temporary container, inject styles
    const temp = document.createElement('div');
    temp.innerHTML = templateHtml;
    const styleElement = temp.querySelector('style');
    if (styleElement) {
        document.head.appendChild(styleElement);
    }
    
    // Get the first element (our container)
    const injectedDiv = temp.firstElementChild;
    
    // Set the recipient name
    const nameElement = injectedDiv.querySelector('#title');
    const firstName = document.querySelector('h1')?.innerText.split(' ')[0]?.charAt(0).toUpperCase() + document.querySelector('h1')?.innerText.split(' ')[0]?.slice(1) || '';
    nameElement.textContent = `Draft an email to ${firstName}`;

    // Insert into the page
    const asideElement = document.querySelector('aside.scaffold-layout__aside');
    if (asideElement) {
      asideElement.prepend(injectedDiv);
    } else {
      console.error('Target aside element not found.');
    }

    // Store references to elements
    this.elements = {
      generateButton: injectedDiv.querySelector('#generateButton'),
      loadingIndicator: injectedDiv.querySelector('#loadingIndicator'),
      emailSubject: injectedDiv.querySelector('#emailSubject'),
      emailResult: injectedDiv.querySelector('#emailResult'),
      copyButton: injectedDiv.querySelector('#copyButton'),
      sendGmailButton: injectedDiv.querySelector('#sendGmailButton')
    };

  },

  setupEventListeners() {

    // GENERATE BUTTON UI
    this.elements.generateButton.addEventListener('click', async () => {
      this.elements.generateButton.disabled = true;
      this.elements.generateButton.innerText = "Generating...";
      // this.elements.loadingIndicator.style.display = 'block';
      // this.elements.emailResult.style.display = 'none';
      // this.elements.copyButton.style.display = 'none';

      function adjustHeight(element) {
        element.style.height = 'auto';
        element.style.height = element.scrollHeight + 'px';
      }
      // Make textarea autoresizable
      emailResult.addEventListener('input', function() {adjustHeight(this);});


      try {
        const profileData = await ProfileScraper.scrapeProfileData();
        const recipientEmail = document.getElementById('recipientEmailInput').value;
        if (recipientEmail) {
          profileData.email = recipientEmail;
        }
        
        const response = await ProfileScraper.generateColdEmail(profileData);

        console.log(response);

        document.querySelector('#linkmail-splash').style.display = "none";
        document.querySelector('#linkmail-editor').style.display = "block";
        
        if (response?.email) {
          let emailContent = response.email;
          if (this.userData && this.userData.name) {
            emailContent = emailContent.replace('[Your Name]', this.userData.name);
          }

          this.elements.emailResult.value = emailContent;
          this.elements.emailSubject.value = response.subject;
          
          adjustHeight(this.elements.emailResult);
        } else {
          this.elements.emailResult.value = "Failed to generate email. Please try again.";
        }
      } catch (error) {
        console.error('Error:', error);
        this.elements.emailResult.value = "An error occurred while generating the email.";
      } finally {
        this.elements.generateButton.disabled = false;
      }
    });

    // COPY BUTTON
    this.elements.copyButton.addEventListener('click', () => {
      this.elements.emailResult.select();
      document.execCommand('copy');
      this.elements.copyButton.textContent = 'Copied!';
      setTimeout(() => {
        this.elements.copyButton.textContent = 'Copy to Clipboard';
      }, 2000);
    });


    // SEND EMAIL BUTTON
    this.elements.sendGmailButton.addEventListener('click', async () => {
      const email = document.getElementById('recipientEmailInput').value;
      const subject = document.getElementById('emailSubject').value;
      const emailContent = this.elements.emailResult.value;

      if (!email || !subject || !emailContent) {
        alert('Please fill in all fields');
        return;
      }

      try {
        this.elements.sendGmailButton.disabled = true;
        this.elements.sendGmailButton.textContent = 'Sending...';

        await GmailManager.sendEmail(email, subject, emailContent);
        
        //alert('Email sent successfully!');
        
        // Clear the form
        this.elements.emailResult.value = '';
        this.elements.emailSubject.value = '';
        document.getElementById('recipientEmailInput').value = '';

      } catch (error) {
        console.error('Failed to send email:', error);
        alert('Failed to send email. Please make sure you are logged into Gmail and try again.');
      } finally {
        this.elements.sendGmailButton.disabled = false;
        this.elements.sendGmailButton.textContent = 'Send via Gmail';

        document.querySelector('#linkmail-editor').style.display = "none";
        document.querySelector('#linkmail-success').style.display = "block";
      }
    });
  },

  async init() {
    const profile = await GmailManager.getUserProfile();
    this.userData = {
      email: profile.emailAddress,
      // Extract name from email or fetch it from People API if needed
      name: profile.emailAddress.split('@')[0] // Basic fallback
    };

    await this.createUI();
    this.setupEventListeners();
  }
};
