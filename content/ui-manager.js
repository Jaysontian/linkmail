//ui-manager.js
window.UIManager = {
  elements: {},
  userData: null,
  isAuthenticated: false,
  selectedTemplate: {},

  templates: [
    {
      icon: "☕",
      name: "Coffee Chat",
      description: "Send a friendly request to chat with this person.",
      purpose: "to schedule a coffee chat to the recipient",
      content: "Hey [NAME]!\nI bet you get hundreds of cold emails so I'll try to keep this concise: I saw that XXX I'm really interested in XXX and would love to learn more about it as well as potential opportunities for an internship, if you guys are currently looking for summer interns. I have two internships under my belt, have a high GPA, and good communication / leadership development. Let me know if you are down to schedule a time for a chat!\nBest regards,",
    },
    {
      icon: "💼",
      name: "Job Application",
      description: "Craft a professional email to a recruiter or manager",
      purpose: "to inquire if there is internship or job",
      content: "Hey [name],\nI'm [insert personal info here]. I think it's really cool how *Skiff is building a privacy-first collaboration platform with expiring links, secure workspaces, and password protection.* Would love to connect and learn about any possible internship opportunities!\nBest regards,",
    }
  ],

  async loadHTML() {
    const url = chrome.runtime.getURL('/content/linkedin-div.html');
    const response = await fetch(url);
    const html = await response.text();
    return html;
  },

  async populateForm() {
    const recipientInput = document.getElementById('recipientEmailInput');
    const nameElement = document.getElementById('profileName');
    
    const profileData = await ProfileScraper.scrapeProfileData();
    if (recipientInput && profileData.email) {
      recipientInput.value = profileData.email;
    }
    
    if (nameElement) {
      nameElement.textContent = `Generate an outreach email to ${document.querySelector('h1')?.innerText || ''} with AI instantly.`;
    }
  },

  // Add this method to check if user exists in storage
  async checkUserInStorage(email) {
    return new Promise((resolve) => {
      chrome.storage.local.get([email], (result) => {
        resolve(result[email] ? true : false);
      });
    });
  },

  // Add this method to get user data from storage
  async getUserFromStorage(email) {
    return new Promise((resolve) => {
      chrome.storage.local.get([email], (result) => {
        resolve(result[email] || null);
      });
    });
  },

  // Add this method to redirect to the bio setup page
  redirectToBioSetup(email) {
    const bioSetupUrl = chrome.runtime.getURL(`bio-setup.html?email=${encodeURIComponent(email)}`);
    
    // Open the bio setup page in a new tab
    chrome.runtime.sendMessage({ 
      action: "openBioSetupPage", 
      url: bioSetupUrl 
    });
    
    // Show a message in the LinkedIn UI
    this.showSignInUI();
    const signInView = document.querySelector('#linkmail-signin');
    if (signInView) {
      const header = signInView.querySelector('.linkmail-header');
      const paragraph = signInView.querySelector('p');
      
      if (header) {
        header.textContent = 'Complete Your Profile';
      }
      
      if (paragraph) {
        paragraph.textContent = 'Please complete your profile in the new tab that opened. Return here when finished.';
      }
      
      // Hide the sign-in button
      const signInButton = signInView.querySelector('#googleSignInButton');
      if (signInButton) {
        signInButton.style.display = 'none';
      }
    }
  },

  async checkAuthStatus() {
    try {
      // Check if user is already authenticated
      const authStatus = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "checkAuthStatus" }, (response) => {
          resolve(response);
        });
      });

      if (authStatus.isAuthenticated) {
        this.isAuthenticated = true;
        this.userData = authStatus.userData;
        
        // Check if user exists in storage
        const userExists = await this.checkUserInStorage(this.userData.email);
        
        if (userExists) {
          // Get complete user data from storage
          const storedUserData = await this.getUserFromStorage(this.userData.email);
          // Merge with existing userData
          this.userData = { ...this.userData, ...storedUserData };
          this.showAuthenticatedUI();
        } else {
          // Redirect to bio setup page
          this.redirectToBioSetup(this.userData.email);
        }
      } else {
        this.isAuthenticated = false;
        this.showSignInUI();
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      this.isAuthenticated = false;
      this.showSignInUI();
    }
  },

  showSignInUI() {
    if (this.elements.signInView) {
      this.elements.signInView.style.display = 'flex';
    }
    if (this.elements.splashView) {
      this.elements.splashView.style.display = 'none';
    }
    
    // Hide user info
    const accountInfo = document.querySelector('.linkmail-account-info');
    if (accountInfo) {
      accountInfo.style.display = 'none';
    }
  },

  cleanupUI() {
    // Remove any existing UI elements to prevent duplicates
    const existingUI = document.querySelector('.linkmail-container');
    if (existingUI) {
      existingUI.remove();
    }
  },

  showAuthenticatedUI() {
    if (this.elements.signInView) {
      this.elements.signInView.style.display = 'none';
    }
    if (this.elements.splashView) {
      this.elements.splashView.style.display = 'flex';
    }
    
    // Display user info if available
    const accountInfo = document.querySelector('.linkmail-account-info');
    const userEmailDisplay = document.getElementById('user-email-display');
    
    if (accountInfo && this.userData?.email) {
      accountInfo.style.display = 'block';
      userEmailDisplay.textContent = this.userData.email;
    }
  },

  async createUI() {
    const templateHtml = await this.loadHTML();

    // Create a temporary container, inject styles
    const temp = document.createElement('div');
    temp.innerHTML = templateHtml;
    
    // Add account info section
    const accountInfoHtml = `
      <div class="linkmail-account-info" style="display: none; margin-bottom: 10px; text-align: right;">
        <span id="user-email-display" style="font-size: 12px; color: #666;"></span>
        <button id="signOutButton" class="linkmail-button" style="font-size: 10px; padding: 2px 6px; margin-left: 8px;">
          Sign Out
        </button>
      </div>
    `;
    
    // Insert account info at the top of the container
    const container = temp.querySelector('.linkmail-container');
    if (container) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = accountInfoHtml;
      container.insertBefore(tempDiv.firstElementChild, container.firstChild);
    }
    
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

    // Generate template list dynamically
    const promptListDiv = injectedDiv.querySelector('.linkmail-prompt-list');

    // Generate template cards from ProfileScraper.templates
    this.templates.forEach(template => {
        const promptDiv = document.createElement('div');
        promptDiv.className = 'linkmail-prompt';
        promptDiv.innerHTML = `
            <h1>${template.icon}</h1>
            <div>
                <h2>${template.name}</h2>
                <p>${template.description}</p>
            </div>
        `;

        console.log('generated: ', template.name);

        // Add click handler
        promptDiv.addEventListener('click', async () => {
          // Remove 'selected' class from all prompts
          const allPrompts = promptListDiv.querySelectorAll('.linkmail-prompt');
          allPrompts.forEach(prompt => {
              prompt.classList.remove('linkmail-prompt-selected');
          });
          
          // Add 'selected' class to clicked prompt
          promptDiv.classList.add('linkmail-prompt-selected');
          
          // Update the selectedTemplate with the clicked template's data
          this.selectedTemplate = template;
        });

        promptListDiv.appendChild(promptDiv);
    });

    console.log('Injecting this code...');

    // Insert into the page
    const asideElement = document.querySelector('aside.scaffold-layout__aside');
    console.log('Aside element found:', asideElement);
    if (asideElement) {
      asideElement.prepend(injectedDiv);
    } else {
      console.error('Target aside element not found.');
    }

    // Store references to elements
    this.elements = {
      signInButton: injectedDiv.querySelector('#googleSignInButton'),
      signInView: injectedDiv.querySelector('#linkmail-signin'),
      splashView: injectedDiv.querySelector('#linkmail-splash'),
      generateButton: injectedDiv.querySelector('#generateButton'),
      loadingIndicator: injectedDiv.querySelector('#loadingIndicator'),
      emailSubject: injectedDiv.querySelector('#emailSubject'),
      emailResult: injectedDiv.querySelector('#emailResult'),
      copyButton: injectedDiv.querySelector('#copyButton'),
      sendGmailButton: injectedDiv.querySelector('#sendGmailButton'),
      signOutButton: injectedDiv.querySelector('#signOutButton')
    };

    // Check authentication status
    await this.checkAuthStatus();
  },

  setupEventListeners() {
    // Google Sign-in button
    this.elements.signInButton.addEventListener('click', async () => {
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: "signInWithGoogle" }, (response) => {
            resolve(response);
          });
        });

        if (response.success) {
          this.isAuthenticated = true;
          this.userData = response.userData;
          
          // Check if user exists in storage
          const userExists = await this.checkUserInStorage(this.userData.email);
          
          if (userExists) {
            // Get complete user data from storage
            const storedUserData = await this.getUserFromStorage(this.userData.email);
            // Merge with existing userData
            this.userData = { ...this.userData, ...storedUserData };
            this.showAuthenticatedUI();
          } else {
            // Redirect to bio setup page
            this.redirectToBioSetup(this.userData.email);
          }
        } else {
          console.error('Authentication failed:', response.error);
          alert('Authentication failed. Please try again.');
        }
      } catch (error) {
        console.error('Error during authentication:', error);
        alert('Authentication failed. Please try again.');
      }
    });

    // Sign out button
    this.elements.signOutButton.addEventListener('click', async () => {
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: "logout" }, (response) => {
            resolve(response);
          });
        });

        if (response.success) {
          this.isAuthenticated = false;
          this.userData = null;
          
          // Hide all views first
          document.querySelector('#linkmail-editor').style.display = "none";
          document.querySelector('#linkmail-success').style.display = "none";
          document.querySelector('#linkmail-splash').style.display = "none";
          
          // Show sign-in view
          this.showSignInUI();
          
          // Clear form fields
          if (this.elements.emailResult) this.elements.emailResult.value = '';
          if (this.elements.emailSubject) this.elements.emailSubject.value = '';
          document.getElementById('recipientEmailInput').value = '';
        } else {
          console.error('Logout failed:', response.error);
        }
      } catch (error) {
        console.error('Error during logout:', error);
      }
    });

    // GENERATE BUTTON UI
    this.elements.generateButton.addEventListener('click', async () => {
      // Check if authenticated
      if (!this.isAuthenticated) {
        this.showSignInUI();
        return;
      }

      this.elements.generateButton.disabled = true;
      this.elements.generateButton.innerText = "Generating...";

      function adjustHeight(element) {
        element.style.height = 'auto';
        element.style.height = element.scrollHeight + 'px';
      }
      
      // Make textarea autoresizable
      const emailResult = document.getElementById('emailResult');
      if (emailResult) {
        emailResult.addEventListener('input', function() {adjustHeight(this);});
      }

      try {
        const profileData = await ProfileScraper.scrapeProfileData();
        
        // Add this section to update the recipient email field
        const recipientInput = document.getElementById('recipientEmailInput');
        if (recipientInput && profileData.email) {
          recipientInput.value = profileData.email;
        }

        const useTemplate = this.selectedTemplate && Object.keys(this.selectedTemplate).length > 0 
                          ? this.selectedTemplate 
                          : this.templates[0];

        console.log(useTemplate);

        // Add user data to the template
        if (this.userData) {
          useTemplate.userData = {
            name: this.userData.name,
            college: this.userData.college,
            graduationYear: this.userData.graduationYear
          };
        }

        const response = await ProfileScraper.generateColdEmail(profileData, useTemplate);

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
        this.elements.generateButton.innerText = "Generate";
      }
    });

    // COPY BUTTON
    this.elements.copyButton.addEventListener('click', () => {
      this.elements.emailResult.select();
      document.execCommand('copy');
      this.elements.copyButton.textContent = 'Copied!';
      setTimeout(() => {
        this.elements.copyButton.textContent = 'Copy';
      }, 2000);
    });

    // SEND EMAIL BUTTON
    this.elements.sendGmailButton.addEventListener('click', async () => {
      // Check if authenticated
      if (!this.isAuthenticated) {
        this.showSignInUI();
        return;
      }

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

  // Add this to the init method or setupEventListeners
  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && this.userData?.email && changes[this.userData.email]) {
        // User data has been updated, refresh the UI
        this.getUserFromStorage(this.userData.email)
          .then(userData => {
            if (userData && userData.setupCompleted) {
              this.userData = { ...this.userData, ...userData };
              this.showAuthenticatedUI();
            }
          });
      }
    });
  },

  async init() {
    this.cleanupUI(); // Clean up any existing UI first
    await this.createUI();
    this.setupEventListeners();
    this.setupStorageListener(); // Add this line
  },

  async resetUI(forceSignOut = false) {
    // Hide all views
    document.querySelector('#linkmail-editor').style.display = "none";
    document.querySelector('#linkmail-success').style.display = "none";
    
    // Check authentication status and show appropriate view
    if (this.isAuthenticated && !forceSignOut) {
      // Check if user exists in storage
      const userExists = await this.checkUserInStorage(this.userData.email);
      
      if (userExists) {
        document.querySelector('#linkmail-splash').style.display = "flex";
        document.querySelector('#linkmail-signin').style.display = "none";
        
        // Show user info
        const accountInfo = document.querySelector('.linkmail-account-info');
        const userEmailDisplay = document.getElementById('user-email-display');
        
        if (accountInfo && this.userData?.email) {
          accountInfo.style.display = 'block';
          userEmailDisplay.textContent = this.userData.email;
        }
      } else {
        // User needs to complete bio setup
        document.querySelector('#linkmail-splash').style.display = "none";
        document.querySelector('#linkmail-signin').style.display = "none";
        // Redirect to bio setup
        this.redirectToBioSetup(this.userData.email);
      }
    } else {
      document.querySelector('#linkmail-splash').style.display = "none";
      document.querySelector('#linkmail-signin').style.display = "flex";
      
      // Hide user info
      const accountInfo = document.querySelector('.linkmail-account-info');
      if (accountInfo) {
        accountInfo.style.display = 'none';
      }
    }
    
    // Reset form fields
    if (this.elements.emailResult) this.elements.emailResult.value = '';
    if (this.elements.emailSubject) this.elements.emailSubject.value = '';
    const recipientInput = document.getElementById('recipientEmailInput');
    if (recipientInput) recipientInput.value = '';
    
    // Reset selected template
    const allPrompts = document.querySelectorAll('.linkmail-prompt');
    allPrompts.forEach(prompt => {
      prompt.classList.remove('linkmail-prompt-selected');
    });
    this.selectedTemplate = {};
    
    // Update the title with the new profile name
    const nameElement = document.getElementById('title');
    const firstName = document.querySelector('h1')?.innerText.split(' ')[0]?.charAt(0).toUpperCase() + document.querySelector('h1')?.innerText.split(' ')[0]?.slice(1) || '';
    if (nameElement) {
      nameElement.textContent = `Draft an email to ${firstName}`;
    }
  }
};


