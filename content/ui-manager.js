//ui-manager.js
window.UIManager = {
  elements: {},
  userData: null,
  isAuthenticated: false,
  selectedTemplate: {},
  container: null, // Add this line to store the container reference
  instanceId: Math.random().toString(36).substring(2, 15),
  

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
    console.log('Showing sign in UI');
    this.showView('#linkmail-signin');
    
    // Hide user info
    const accountInfo = this.container.querySelector('.linkmail-account-info');
    if (accountInfo) {
      accountInfo.style.display = 'none';
    }
  },

  cleanupUI() {
    console.log('Cleaning up UI elements with instanceId:', this.instanceId);
    
    // Remove any existing UI elements to prevent duplicates
    const existingUIs = document.querySelectorAll('.linkmail-container');
    console.log(`Found ${existingUIs.length} existing UI elements to clean up`);
    
    existingUIs.forEach(ui => {
      ui.remove();
      console.log('Removed UI element');
    });
    
    // Reset internal state
    this.elements = {};
    this.container = null;
  },

  showAuthenticatedUI() {
    console.log('Showing authenticated UI');
    this.showView('#linkmail-splash');
    
    // Display user info if available
    const accountInfo = this.container.querySelector('.linkmail-account-info');
    const userEmailDisplay = this.container.querySelector('#user-email-display');
    
    if (accountInfo && this.userData?.email) {
      accountInfo.style.display = 'block';
      userEmailDisplay.textContent = this.userData.email;
    }
  },

  async createUI() {
    
    // Check if we've already created the UI
    if (document.querySelector('.linkmail-container')) {
      console.log('UI already exists, skipping creation');
      return;
    }
    const templateHtml = await this.loadHTML();

    // Create a temporary container, inject styles
    const temp = document.createElement('div');
    temp.innerHTML = templateHtml;
    
    // Add account info section
    const accountInfoHtml = `
      <div class="linkmail-account-info" style="display: none; margin-bottom: 10px; text-align: right;">
        <span id="user-email-display" style="font-size: 12px; color: #666;"></span>
        <div style="margin-top: 4px;">
          <button id="editProfileButton" class="linkmail-button" style="font-size: 10px; padding: 2px 6px; margin-right: 8px;">
            Edit Profile
          </button>
          <button id="signOutButton" class="linkmail-button" style="font-size: 10px; padding: 2px 6px;">
            Sign Out
          </button>
        </div>
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
    this.container = injectedDiv; // Store the reference to the container
    
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
      signOutButton: injectedDiv.querySelector('#signOutButton'),
      editProfileButton: injectedDiv.querySelector('#editProfileButton') // Add this line
    };

    // Check authentication status
    await this.checkAuthStatus();
  },

  setupEventListeners() {

    // Use this.container instead of injectedDiv
    if (!this.container) {
      console.error('Container not initialized');
      return;
    }

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

    // Add event listener for edit profile button
    this.elements.editProfileButton = this.container.querySelector('#editProfileButton');
    if (this.elements.editProfileButton) {
      this.elements.editProfileButton.addEventListener('click', () => {
        if (this.userData && this.userData.email) {
          // Open the bio setup page with edit mode
          const bioSetupUrl = chrome.runtime.getURL(`bio-setup.html?email=${encodeURIComponent(this.userData.email)}&mode=edit`);
          
          chrome.runtime.sendMessage({ 
            action: "openBioSetupPage", 
            url: bioSetupUrl 
          });
        }
      });
    }

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

    // Replace your current sendGmailButton event listener with this
    this.elements.sendGmailButton.addEventListener('click', async () => {
      console.log('Send Gmail button clicked');
      
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
        // Disable button and update text
        this.elements.sendGmailButton.disabled = true;
        this.elements.sendGmailButton.textContent = 'Sending...';
        console.log('Sending email...');

        // Send email
        await GmailManager.sendAndSaveEmail(email, subject, emailContent);
        console.log('Email sent successfully');
        
        // Clear the form
        this.elements.emailResult.value = '';
        this.elements.emailSubject.value = '';
        document.getElementById('recipientEmailInput').value = '';
        
        console.log('Form cleared, now updating UI');
        
        // IMPORTANT: Directly access views within the container
        // Get direct references to all views
        const editorView = this.container.querySelector('#linkmail-editor');
        const splashView = this.container.querySelector('#linkmail-splash');
        const signinView = this.container.querySelector('#linkmail-signin');
        const successView = this.container.querySelector('#linkmail-success');
        
        console.log('Found views:', {
          editorView: !!editorView,
          splashView: !!splashView,
          signinView: !!signinView,
          successView: !!successView
        });
        
        // Hide all views first
        if (editorView) {
          editorView.style.display = 'none';
          console.log('Editor view hidden');
        }
        
        if (splashView) {
          splashView.style.display = 'none';
          console.log('Splash view hidden');
        }
        
        if (signinView) {
          signinView.style.display = 'none';
          console.log('Sign-in view hidden');
        }
        
        // Show success view
        if (successView) {
          successView.style.display = 'block';
          console.log('Success view shown');
        } else {
          console.error('Success view not found!');
        }
        
      } catch (error) {
        console.error('Failed to send email:', error);
        alert('Failed to send email. Please make sure you are logged into Gmail and try again.');
      } finally {
        // Re-enable button
        this.elements.sendGmailButton.disabled = false;
        this.elements.sendGmailButton.textContent = 'Send via Gmail';
      }
    });
  },

  // REPLACE the setupStorageListener method in ui-manager.js with this one
  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      // Skip storage listener updates if we're in the email success state
      const successView = this.container.querySelector('#linkmail-success');
      if (successView && successView.style.display === 'block') {
        console.log('Storage change detected but ignoring because success view is displayed');
        return;
      }
      
      if (namespace === 'local' && this.userData?.email && changes[this.userData.email]) {
        console.log('User data updated in storage, refreshing UI');
        // User data has been updated, refresh the UI and userData
        this.getUserFromStorage(this.userData.email)
          .then(userData => {
            if (userData) {
              this.userData = { ...this.userData, ...userData };
              
              // Update the UI with new user data if needed
              const userEmailDisplay = document.getElementById('user-email-display');
              if (userEmailDisplay && this.userData?.email) {
                userEmailDisplay.textContent = this.userData.email;
              }
              
              // Only update UI if we're not showing the success view
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
    console.log('Resetting UI state with forceSignOut:', forceSignOut);
    
    if (!this.container) {
      console.error('Container not initialized, cannot reset UI');
      return;
    }
    
    // Explicitly get all UI elements by their IDs
    const editorView = this.container.querySelector('#linkmail-editor');
    const successView = this.container.querySelector('#linkmail-success');
    const splashView = this.container.querySelector('#linkmail-splash');
    const signInView = this.container.querySelector('#linkmail-signin');
    
    // Hide ALL views first
    [editorView, successView, splashView, signInView].forEach(view => {
      if (view) view.style.display = 'none';
    });
    
    // Reset form fields
    const emailResult = this.container.querySelector('#emailResult');
    const emailSubject = this.container.querySelector('#emailSubject');
    const recipientInput = this.container.querySelector('#recipientEmailInput');
    
    if (emailResult) emailResult.value = '';
    if (emailSubject) emailSubject.value = '';
    if (recipientInput) recipientInput.value = '';
    
    // Reset selected template
    const allPrompts = this.container.querySelectorAll('.linkmail-prompt');
    allPrompts.forEach(prompt => {
      prompt.classList.remove('linkmail-prompt-selected');
    });
    this.selectedTemplate = {};
    
    // Update the UI based on authentication status
    if (this.isAuthenticated && !forceSignOut) {
      // Check if user exists in storage
      try {
        const userExists = await this.checkUserInStorage(this.userData.email);
        
        if (userExists) {
          // Get user data from storage
          const storedUserData = await this.getUserFromStorage(this.userData.email);
          this.userData = { ...this.userData, ...storedUserData };
          
          // Show splash view
          if (splashView) splashView.style.display = 'flex';
          
          // Show user info
          const accountInfo = this.container.querySelector('.linkmail-account-info');
          const userEmailDisplay = this.container.querySelector('#user-email-display');
          
          if (accountInfo && this.userData?.email) {
            accountInfo.style.display = 'block';
            if (userEmailDisplay) userEmailDisplay.textContent = this.userData.email;
          }
        } else {
          // User needs to complete bio setup
          if (signInView) signInView.style.display = 'flex';
          this.redirectToBioSetup(this.userData.email);
        }
      } catch (error) {
        console.error('Error checking user in storage:', error);
        if (signInView) signInView.style.display = 'flex';
      }
    } else {
      // Not authenticated, show sign in view
      if (signInView) signInView.style.display = 'flex';
      
      // Hide user info
      const accountInfo = this.container.querySelector('.linkmail-account-info');
      if (accountInfo) accountInfo.style.display = 'none';
    }
    
    // Update the title with the current profile name
    const nameElement = this.container.querySelector('#title');
    if (nameElement) {
      const h1Element = document.querySelector('h1');
      const profileName = h1Element ? h1Element.innerText : '';
      const firstName = profileName.split(' ')[0] || '';
      nameElement.textContent = `Draft an email to ${firstName}`;
    }
    
    // Re-populate the form with the profile's email
    await this.populateForm();
  },

  // Add this new method to help manage view transitions
  showView(viewName) {
    console.log(`Showing view: ${viewName}`);
    
    if (!this.container) {
      console.error('Container not initialized, cannot show view');
      return;
    }
    
    // Define all possible views
    const allViews = [
      '#linkmail-signin',
      '#linkmail-splash',
      '#linkmail-editor',
      '#linkmail-success'
    ];
    
    // Hide all views first
    allViews.forEach(selector => {
      const view = this.container.querySelector(selector);
      if (view) {
        view.style.display = 'none';
        console.log(`Hidden view: ${selector}`);
      } else {
        console.warn(`View not found: ${selector}`);
      }
    });
    
    // Show the requested view
    const targetView = this.container.querySelector(viewName);
    if (targetView) {
      if (viewName === '#linkmail-splash') {
        targetView.style.display = 'flex';
      } else {
        targetView.style.display = 'block';
      }
      console.log(`Displayed view: ${viewName}`);
    } else {
      console.error(`Target view not found: ${viewName}`);
    }
  }
};


