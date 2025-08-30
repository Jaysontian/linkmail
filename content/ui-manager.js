//ui-manager.js
// Load split helpers during tests (Node), no effect in browser
try {
  if (typeof module !== 'undefined' && module.exports) {
    require('./ui/helpers.js');
    require('./ui/auth.js');
    require('./ui/similar.js');
    require('./ui/people.js');
    require('./ui/templates.js');
    require('./ui/history.js');
    require('./ui/messages.js');
    require('./ui/views.js');
    require('./ui/bootstrap.js');
  }
} catch (_e) {}
const __existingUI = window.UIManager || {};
window.UIManager = Object.assign(__existingUI, {
  elements: {},
  userData: null,
  isAuthenticated: false,
  _selectedTemplate: {},
  container: null, // Add this line to store the container reference
  instanceId: Math.random().toString(36).substring(2, 15),
  _isCreatingUI: false,
  _ownProfileId: null,
  _emailLookupAttemptedForUrl: null,
  _autoFillRetryTimer: null,
  _autoFillRetryCount: 0,

  // Track which emails have already triggered the bio setup tab to avoid duplicates
  _bioSetupOpenedByEmail: {},

  // Add getter and setter for selectedTemplate to track changes
  get selectedTemplate() {
    return this._selectedTemplate;
  },

  set selectedTemplate(value) {
    this._selectedTemplate = value;
  },


  templates: [
    {
      icon: '☕',
      name: 'Coffee Chat',
      description: 'Send a friendly request to chat with this person.',
      purpose: 'to schedule a coffee chat to the recipient',
      subjectLine: 'Coffee Chat with [Recipient Name]',
      content: 'Hi [Recipient First Name],\n\nI\'m a 3rd year Computer Science student at UCLA. [Mention something specific about their company or recent work that interests you].\n\nI\'d love to connect and learn more about your experience in [mention their field/industry]. Would you be open to a brief coffee chat?\n\nBest regards,\n[Sender Name]'
    },
    {
      icon: '💼',
      name: 'Job Application',
      description: 'Craft a professional email to a recruiter or manager',
      purpose: 'to inquire if there is internship or job',
      subjectLine: 'Internship Inquiry - [Sender Name]',
      content: 'Hi [Recipient First Name],\n\nI\'m [brief personal introduction including your background]. I\'m really impressed by [mention something specific about their company\'s work or mission].\n\n[Connect their company\'s work to your own experience or interests]. I\'d love to learn about potential internship opportunities at [Company Name].\n\nBest regards,\n[Sender Name]'
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

    // Check page type - treat own-profile same as feed page
    const pageType = this.getSafePageType();
    const shouldShowEmailInterface = pageType === 'other-profile';

    if (shouldShowEmailInterface) {
      // Profile page logic - get basic profile data without opening contact info overlay
      const profileData = await ProfileScraper.scrapeBasicProfileData();

      // Check if we already have a cached email
      const cachedEmail = EmailFinder._lastFoundEmail;

      if (recipientInput && cachedEmail && EmailFinder._lastProfileUrl === window.location.href) {
        // Use the cached email if available
        recipientInput.value = cachedEmail;
        // Hide find email button since we have an email
        if (this.elements.findEmailButton) {
          this.elements.findEmailButton.style.display = 'none';
        }
      } else {
        // No cached email - show the Find Email button if we're in editor view
        if (this.elements.findEmailButton && document.querySelector('#linkmail-editor').style.display === 'block') {
          this.elements.findEmailButton.style.display = 'block';
        }
        // Attempt auto-fill (quick on-page check first, then backend)
        await this._fetchAndFillEmailIfBlank();
      }

      if (nameElement) {
        nameElement.textContent = `Generate an outreach email to ${profileData.name || ''} with AI instantly.`;
      }
    } else {
      // Feed page and own-profile logic - no specific profile data
      if (recipientInput) {
        recipientInput.value = '';
        recipientInput.placeholder = 'Enter recipient email address';
      }
      
      // Always hide find email button on feed page and own profile
      if (this.elements.findEmailButton) {
        this.elements.findEmailButton.style.display = 'none'; // Hide by default, user needs to enter email manually
      }

      if (nameElement) {
        nameElement.textContent = 'Generate personalized emails with AI instantly.';
      }
    }
  },

  // Add this method to check if user exists in storage
  async checkUserInStorage(email) {
    return new Promise((resolve) => {
      try {
        if (!chrome.runtime?.id) {
          console.log('Extension context invalidated, cannot check user in storage');
          resolve(false);
          return;
        }

        chrome.storage.local.get([email], (result) => {
          if (chrome.runtime.lastError) {
            console.log('Chrome storage error:', chrome.runtime.lastError);
            resolve(false);
            return;
          }
          resolve(result[email] ? true : false);
        });
      } catch (error) {
        console.log('Error checking user in storage:', error);
        resolve(false);
      }
    });
  },

  // Add this method to get user data from storage
  async getUserFromStorage(email) {
    return new Promise((resolve) => {
      try {
        if (!chrome.runtime?.id) {
          console.log('Extension context invalidated, cannot get user from storage');
          resolve(null);
          return;
        }

        chrome.storage.local.get([email], (result) => {
          if (chrome.runtime.lastError) {
            console.log('Chrome storage error:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          resolve(result[email] || null);
        });
      } catch (error) {
        console.log('Error getting user from storage:', error);
        resolve(null);
      }
    });
  },

  // Add this method to redirect to the bio setup page
  redirectToBioSetup(email) {
    // Prevent opening duplicate tabs for the same email
    if (email && this._bioSetupOpenedByEmail[email]) {
      console.log('Bio setup tab already opened for:', email);
      // Still update the UI messaging but do not open another tab
      this.showSignInUI();
      const signInView = document.querySelector('#linkmail-signin');
      if (signInView) {
        const header = signInView.querySelector('.linkmail-header');
        const paragraph = signInView.querySelector('p');
        if (header) header.textContent = 'Complete Your Profile';
        if (paragraph) paragraph.textContent = 'Please complete your profile in the tab that opened. Return here when finished.';
        const signInButton = signInView.querySelector('#googleSignInButton');
        if (signInButton) signInButton.style.display = 'none';
      }
      return;
    }

    // Mark as opened for this email
    if (email) {
      this._bioSetupOpenedByEmail[email] = true;
    }

    const bioSetupUrl = chrome.runtime.getURL(`dashboard.html?email=${encodeURIComponent(email)}`);

    // Open the bio setup page in a new tab
    chrome.runtime.sendMessage({
      action: 'openBioSetupPage',
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
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.log('Extension context invalidated, cannot check auth status');
        this.isAuthenticated = false;
        this.showSignInUI();
        return this.isAuthenticated;
      }

      // Check backend authentication status
      if (!window.BackendAPI) {
        console.log('Backend API not available');
        this.isAuthenticated = false;
        this.showSignInUI();
        return this.isAuthenticated;
      }

      // Initialize BackendAPI and check auth status (will only poll backend if not already authenticated)
      await window.BackendAPI.init();
      
      if (window.BackendAPI.isAuthenticated && window.BackendAPI.userData) {
        this.isAuthenticated = true;
        this.userData = {
          email: window.BackendAPI.userData.email,
          name: window.BackendAPI.userData.name,
          picture: window.BackendAPI.userData.picture
        };

        // Keep cached own-profile id updated for stable page-type detection
        this.updateOwnProfileIdFromUserData();

        // Check if user exists in local storage for bio setup completion
        const userExists = await this.checkUserInStorage(this.userData.email);

        if (userExists) {
          // Get complete user data from storage (bio, templates, etc.)
          const storedUserData = await this.getUserFromStorage(this.userData.email);
          // Merge with backend userData
          this.userData = { ...this.userData, ...storedUserData };
          this.updateOwnProfileIdFromUserData();
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
    return this.isAuthenticated;
  },

  showSignInUI() {
    console.log('Showing sign in UI');
    this.showView('#linkmail-signin');

    // Hide user info
    const accountInfo = this.container.querySelector('.account-dropdown');
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
    this._emailLookupAttemptedForUrl = null;
    if (this._autoFillRetryTimer) {
      clearTimeout(this._autoFillRetryTimer);
      this._autoFillRetryTimer = null;
    }
    this._autoFillRetryCount = 0;
  },

  showAuthenticatedUI(preserveCurrentView = false) {
    try {
      console.log('Showing authenticated UI, preserveCurrentView:', preserveCurrentView);

      // Always hide the sign-in view
      if (this.elements.signInView) {
        this.elements.signInView.style.display = 'none';
      }

      // Check page type - treat own-profile same as feed page
      const pageType = this.getSafePageType();
      const shouldShowPeopleSuggestions = pageType === 'feed' || pageType === 'own-profile';

      // Only show appropriate view if we're not preserving the current view
      if (!preserveCurrentView) {
        if (shouldShowPeopleSuggestions) {
          // Feed page and own-profile: Show people suggestions
          if (this.elements.peopleSuggestionsView) {
            this.elements.peopleSuggestionsView.style.display = 'block';
            // Load people suggestions
            this.loadPeopleSuggestions();
          }
          // Hide splash view on feed page and own-profile
          if (this.elements.splashView) {
            this.elements.splashView.style.display = 'none';
          }
        } else {
          // Other profile page: Show splash view
          if (this.elements.splashView) {
            this.elements.splashView.style.display = 'flex';
          }
          // Hide people suggestions on other profile page
          if (this.elements.peopleSuggestionsView) {
            this.elements.peopleSuggestionsView.style.display = 'none';
          }
        }
      } else {
        console.log('Preserving current view, not changing view');
      }

      // Display user info if available
      try {
        const accountInfo = document.querySelector('.linkmail-account-info');
        const userEmailDisplay = document.getElementById('user-email-display');

        if (accountInfo && this.userData?.email) {
          accountInfo.style.display = 'block';
          if (userEmailDisplay) {
            userEmailDisplay.textContent = this.userData.email;
          }
        }
      } catch (domError) {
        console.log('Error accessing DOM elements:', domError);
      }

      // Refresh user data from storage to get latest templates
      this.refreshUserData().then(() => {
        // Pass user data to GmailManager
        if (window.GmailManager && this.userData) {
          window.GmailManager.setUserData(this.userData);
        }

        // Populate template dropdown with user's custom templates
        this.populateTemplateDropdown();

        // Check email history after authentication is confirmed
        this.checkLastEmailSent();

        // Ensure form is populated and attempt automatic email autofill
        // This runs post-auth so BackendAPI.isAuthenticated is true
        this.populateForm().then(() => {
          // Force a lookup once immediately post-auth to ensure it runs at least once
          this._fetchAndFillEmailIfBlank(true);
        });
      }).catch(error => {
        console.log('Error refreshing user data:', error);
      });

    } catch (error) {
      console.log('Error in showAuthenticatedUI:', error);
    }
  },

  // Add this new method to UIManager to refresh user data
  async refreshUserData() {
    if (!this.isAuthenticated || !this.userData || !this.userData.email) {
      console.log('Not authenticated or missing user data, cannot refresh');
      return;
    }

    console.log('Refreshing user data from storage');

    return new Promise((resolve) => {
      try {
        if (!chrome.runtime?.id) {
          console.log('Extension context invalidated, skipping storage refresh');
          resolve();
          return;
        }

        chrome.storage.local.get([this.userData.email], (result) => {
          if (chrome.runtime.lastError) {
            console.log('Chrome storage error:', chrome.runtime.lastError);
            resolve();
            return;
          }

          const storedUserData = result[this.userData.email];

          if (storedUserData) {
            console.log('Found stored user data, updating local copy');
            this.userData = storedUserData;

            // Pass updated user data to GmailManager
            if (window.GmailManager) {
              window.GmailManager.setUserData(this.userData);
            }
          } else {
            console.log('No stored user data found');
          }

          resolve();
        });
      } catch (error) {
        console.log('Error accessing chrome storage:', error);
        resolve();
      }
    });
  },

  // First, let's modify the UIManager's createUI method to add better error handling and logging

  async createUI() {
    try {
      // Check if we've already created the UI
      if (document.querySelector('.linkmail-container')) {
        return;
      }

      // Concurrency guard for UI creation
      if (this._isCreatingUI) {
        console.log('UI creation already in progress, skipping');
        return;
      }
      this._isCreatingUI = true;

      const templateHtml = await this.loadHTML();
      console.log('HTML template loaded successfully');

      // Create a temporary container, inject styles
      const temp = document.createElement('div');
      temp.innerHTML = templateHtml;





      const styleElement = temp.querySelector('style');
      if (styleElement) {
        document.head.appendChild(styleElement);
      }

      // Get the first element (our container)
      const injectedDiv = temp.firstElementChild;
      if (!injectedDiv) {
        console.error('No first element found in template');
        this._isCreatingUI = false;
        return;
      }

      this.container = injectedDiv; // Store the reference to the container


      // Set the recipient name based on page type
      const nameElement = injectedDiv.querySelector('#title');
      if (nameElement) {
                // Check page type - treat own-profile same as feed page
        const pageType = this.getSafePageType();
        const shouldUseManualEmail = pageType === 'feed' || pageType === 'own-profile';

        if (shouldUseManualEmail) {
          nameElement.textContent = 'Draft personalized emails with AI';
        } else {
          // Profile page logic
          const h1Element = document.querySelector('h1');
          const fullName = h1Element?.innerText || '';
          const firstName = fullName.split(' ')[0]?.charAt(0).toUpperCase() + fullName.split(' ')[0]?.slice(1) || '';
          nameElement.textContent = `Draft an email to ${firstName}`;
        }
      }


      console.log('Injecting UI into page...');

      // Insert into the page (wait for LinkedIn aside to be present)
      let asideElement = document.querySelector('aside.scaffold-layout__aside');
      let attempts = 0;
      const maxAttempts = 10; // ~3s total at 300ms intervals
      while (!asideElement && attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 300));
        asideElement = document.querySelector('aside.scaffold-layout__aside');
      }
      console.log('Aside element found after attempts:', attempts, !!asideElement);
      if (asideElement) {
        // Double-check right before injection
        if (!document.querySelector('.linkmail-container')) {
          asideElement.prepend(injectedDiv);
        } else {
          console.log('LinkMail UI already present at inject time; aborting duplicate injection');
          this._isCreatingUI = false;
          return;
        }
        console.log('UI successfully injected');
      } else {
        console.error('Target aside element not found after waiting. Aborting injection for now.');
        this._isCreatingUI = false;
        return;
      }


      // Store references to elements in a centralized way
      this._cacheElements(injectedDiv);

      // Check that required elements exist
      if (!this.elements.signInButton || !this.elements.splashView || !this.elements.generateButton) {
        console.error('Required UI elements not found:', {
          signInButton: !!this.elements.signInButton,
          splashView: !!this.elements.splashView,
          generateButton: !!this.elements.generateButton
        });
        return;
      }

      // Prevent flicker: hide all views immediately after injection
      const editorViewAtInit = injectedDiv.querySelector('#linkmail-editor');
      const successViewAtInit = injectedDiv.querySelector('#linkmail-success');
      [this.elements.signInView, this.elements.splashView, this.elements.peopleSuggestionsView, editorViewAtInit, successViewAtInit]
        .forEach(view => { if (view) view.style.display = 'none'; });

      // If we're on feed or own-profile, pre-show the people suggestions view with a loading state
      const initialPageType = window.currentPageType || 'other-profile';
      const isFeedLikePage = initialPageType === 'feed' || initialPageType === 'own-profile';
      if (isFeedLikePage && this.elements.peopleSuggestionsView) {
        this.elements.peopleSuggestionsView.style.display = 'block';
        const loadingEl = injectedDiv.querySelector('#people-suggestions-loading');
        if (loadingEl) loadingEl.style.display = 'block';
      }

      // Check authentication status
      console.log('Checking authentication status...');
      await this.checkAuthStatus();
      console.log('UI creation complete');

    } catch (error) {
      console.error('Error creating UI:', error);
      // Try to recover by reverting to original UI
      try {
        const asideElement = document.querySelector('aside.scaffold-layout__aside');
        if (asideElement) {
          // Create a minimal UI if all else fails
          const fallbackDiv = document.createElement('div');
          fallbackDiv.className = 'linkmail-container';
          fallbackDiv.innerHTML = `
            <div id="linkmail-signin" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <p>There is an error.</p>
            </div>
          `;


          asideElement.prepend(fallbackDiv);
          console.log('Fallback UI created');

        }
      } catch (fallbackError) {
        console.error('Failed to create fallback UI:', fallbackError);
      }
    } finally {
      this._isCreatingUI = false;
    }
  },

  setupEventListeners() {

    // Use this.container instead of injectedDiv
    if (!this.container) {
      console.error('Container not initialized');
      return;
    }

    // Toggle dropdown when three-dots button is clicked (guard if missing)
    if (this.elements.menuToggle && this.elements.menuContent) {
      this.elements.menuToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const dropdown = this.elements.menuContent;
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
      });
    } else {
      console.log('Menu toggle/content not found; skipping account dropdown listeners');
    }

    // Close dropdown when clicking elsewhere on the page
    window.addEventListener('click', (event) => {
      if (this.elements.menuContent && !this.elements.menuContent.contains(event.target)){
        this.elements.menuContent.style.display = 'none';
      }
    });

    // Google Sign-in button - now uses backend authentication
    if (this.elements.signInButton) this.elements.signInButton.addEventListener('click', async () => {
      try {
        // Check if extension context is still valid
        if (!chrome.runtime?.id) {
          console.log('Extension context invalidated, cannot sign in');
          this.showTemporaryMessage('Extension needs to be reloaded. Please refresh the page and try again.', 'error');
          return;
        }

        // Check if BackendAPI is available
        if (!window.BackendAPI) {
          console.error('Backend API not available');
          this.showTemporaryMessage('Service unavailable. Please try again later.', 'error');
          return;
        }

        // Show loading message
        this.showTemporaryMessage('Opening authentication page...', 'info');
        
        // Start backend authentication flow
        await window.BackendAPI.startAuthFlow();
        
        // Show instructions to user
        this.showTemporaryMessage('Please complete authentication in the new tab and return here.', 'info');
        
        // Set up a listener for when authentication completes
        let authCheckCount = 0;
        const maxAuthChecks = 30; // 2 minutes at 4-second intervals
        
        const checkAuthInterval = setInterval(async () => {
          try {
            authCheckCount++;
            console.log(`Checking for authentication... (${authCheckCount}/${maxAuthChecks})`);
            
            // Check BackendAPI for auth status (it will poll backend only if not already authenticated)
            await window.BackendAPI.init();
            
            if (window.BackendAPI.isAuthenticated && window.BackendAPI.userData) {
              clearInterval(checkAuthInterval);
              console.log('Authentication detected! Setting up user data...');
              
              this.isAuthenticated = true;
              this.userData = {
                email: window.BackendAPI.userData.email,
                name: window.BackendAPI.userData.name,
                picture: window.BackendAPI.userData.picture
              };

              // Check if user exists in storage
              const userExists = await this.checkUserInStorage(this.userData.email);

              if (userExists) {
                // Get complete user data from storage
                const storedUserData = await this.getUserFromStorage(this.userData.email);
                // Merge with backend userData
                this.userData = { ...this.userData, ...storedUserData };
                this.showAuthenticatedUI();
                this.showTemporaryMessage('Authentication successful!', 'success');
              } else {
                // Redirect to bio setup page
                this.redirectToBioSetup(this.userData.email);
              }
            } else if (authCheckCount >= maxAuthChecks) {
              // Stop checking after max attempts
              clearInterval(checkAuthInterval);
              console.log('Auth check timeout - stopping polling');
              this.showTemporaryMessage('Authentication timeout. Please try again.', 'error');
            }
          } catch (error) {
            console.log('Auth check error:', error);
            if (authCheckCount >= maxAuthChecks) {
              clearInterval(checkAuthInterval);
            }
          }
        }, 4000); // Check every 4 seconds
        
        // Also listen for storage changes (in case auth data is stored while we're waiting)
        const storageListener = (changes, namespace) => {
          if (namespace === 'local' && (changes.backendToken || changes.backendUserData)) {
            console.log('Auth storage changed detected, checking authentication...');
            // Trigger an immediate auth check
            setTimeout(async () => {
              try {
                await window.BackendAPI.init();
                if (window.BackendAPI.isAuthenticated) {
                  clearInterval(checkAuthInterval);
                  chrome.storage.onChanged.removeListener(storageListener);
                  
                  this.isAuthenticated = true;
                  this.userData = {
                    email: window.BackendAPI.userData.email,
                    name: window.BackendAPI.userData.name,
                    picture: window.BackendAPI.userData.picture
                  };
                  
                  const userExists = await this.checkUserInStorage(this.userData.email);
                  if (userExists) {
                    const storedUserData = await this.getUserFromStorage(this.userData.email);
                    this.userData = { ...this.userData, ...storedUserData };
                    this.showAuthenticatedUI();
                    this.showTemporaryMessage('Authentication successful!', 'success');
                  } else {
                    this.redirectToBioSetup(this.userData.email);
                  }
                }
              } catch (error) {
                console.log('Storage change auth check error:', error);
              }
            }, 100);
          }
        };
        
        chrome.storage.onChanged.addListener(storageListener);
        
      } catch (error) {
        console.error('Error during authentication:', error);
        this.showTemporaryMessage('Authentication failed. Please try again.', 'error');
      }
    });

    // Sign out button - now uses backend logout
    if (this.elements.signOutButton) this.elements.signOutButton.addEventListener('click', async () => {
      try {
        // Use backend logout
        if (window.BackendAPI) {
          await window.BackendAPI.signOut();
        }

        // Clear local state
        this.isAuthenticated = false;
        this.userData = null;

        // Hide all views first
        document.querySelector('#linkmail-editor').style.display = 'none';
        document.querySelector('#linkmail-success').style.display = 'none';
        document.querySelector('#linkmail-splash').style.display = 'none';

        // Show sign-in view
        this.showSignInUI();

        // Clear form fields
        if (this.elements.emailResult) this.elements.emailResult.value = '';
        if (this.elements.emailSubject) this.elements.emailSubject.value = '';
        document.getElementById('recipientEmailInput').value = '';
        
        this.showTemporaryMessage('Signed out successfully', 'success');
      } catch (error) {
        console.error('Error during logout:', error);
        this.showTemporaryMessage('Error signing out', 'error');
      }
    });

    // Add this improvement to the editProfileButton click handler
    // Find this in setupEventListeners
    if (this.elements.editProfileButton) this.elements.editProfileButton.addEventListener('click', () => {
      if (this.userData && this.userData.email) {
        // Open the bio setup page with edit mode
        const bioSetupUrl = chrome.runtime.getURL(`dashboard.html?email=${encodeURIComponent(this.userData.email)}&mode=edit`);

        chrome.runtime.sendMessage({
          action: 'openBioSetupPage',
          url: bioSetupUrl
        }, (response) => {
          // If the bio setup page was opened successfully, set up a timer to refresh templates
          if (response && response.success) {
            console.log('Bio setup page opened, setting up refresh timer');

            // Check for template updates every 5 seconds while the bio page might be open
            const refreshInterval = setInterval(() => {
              this.refreshUserData().then(() => {
                this.populateTemplateDropdown();
              });
            }, 5000);

            // Stop checking after 10 minutes (600000 ms)
            setTimeout(() => {
              clearInterval(refreshInterval);
            }, 600000);
          }
        });
      }
    });

    // GENERATE BUTTON UI
    if (this.elements.generateButton) this.elements.generateButton.addEventListener('click', async () => {
      // Check if authenticated
      if (!this.isAuthenticated) {
        this.showSignInUI();
        return;
      }

      this.elements.generateButton.disabled = true;
      this.elements.generateButton.innerText = 'Generating...';

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
        // Check page type - treat own-profile same as feed page  
        const pageType = window.currentPageType || 'other-profile';
        const shouldScrapeProfile = pageType === 'other-profile';
        let profileData = {};
        let emailToUse = null;

        if (shouldScrapeProfile) {
          // Profile page logic - get basic profile data (no contact info overlay)
          const basicProfileData = await ProfileScraper.scrapeBasicProfileData();

          // Prefer email from about section if available
          emailToUse = basicProfileData.emailFromAbout;

          // Only look for email via contact info if not found in about section
          if (!emailToUse) {
            const foundEmail = await EmailFinder.getEmail();

            // Clean up the email if it has any extra text
            if (foundEmail) {
              emailToUse = ProfileScraper.cleanupEmail(foundEmail);
            }
          }

          // If scraping yielded no email, immediately query backend and auto-fill if found
          if (!emailToUse && window.BackendAPI && window.BackendAPI.isAuthenticated) {
            try {
              const extra = {
                firstName: basicProfileData?.firstName || '',
                lastName: basicProfileData?.lastName || '',
                company: basicProfileData?.company || ''
              };
              const data = await window.BackendAPI.getEmailByLinkedIn(window.location.href, extra);
              if (data && data.found && data.email) {
                emailToUse = data.email;
              }
            } catch (be) {
              console.log('Backend email lookup failed after scraping:', be);
            }
          }

          // Add the email to the profile data (remove emailFromAbout to avoid duplication)
          // eslint-disable-next-line no-unused-vars
          const { emailFromAbout, ...cleanedProfileData } = basicProfileData;
          profileData = {
            ...cleanedProfileData,
            email: emailToUse
          };

          // Log the complete profile data with email
          console.log('Complete Profile Data (with email):', JSON.stringify(profileData, null, 2));
        } else {
          // Feed page logic - use recipient email from input field
          const recipientInput = document.getElementById('recipientEmailInput');
          emailToUse = recipientInput ? recipientInput.value.trim() : '';
          
          if (!emailToUse) {
            this.showTemporaryMessage('Please enter a recipient email address', 'error');
            return;
          }

          // Create minimal profile data for feed page and own-profile
          profileData = {
            email: emailToUse,
            name: '', // We don't have the recipient's name on feed page or own-profile
            company: '',
            headline: '',
            location: ''
          };
          console.log('Feed Page/Own Profile Email Generation - Minimal data, recipient:', emailToUse);
        }

        // Update the recipient email field (only for other-profile pages)
        if (shouldScrapeProfile) {
          const recipientInput = document.getElementById('recipientEmailInput');

          if (recipientInput && emailToUse) {
            recipientInput.value = emailToUse;
            // Hide find email button since we have an email
            if (this.elements.findEmailButton) {
              this.elements.findEmailButton.style.display = 'none';
            }
          } else {
            // No email found - show the Find Email button
            if (this.elements.findEmailButton) {
              this.elements.findEmailButton.style.display = 'block';
            }
          }
        }

        // Get selected template
        let useTemplate = this.selectedTemplate;

        console.log('Selected template for email generation:', JSON.stringify(useTemplate, null, 2));

        // FAILSAFE: Ensure template is selected
        if (!useTemplate.name || !useTemplate.content) {
          // Force template selection if empty
          this.populateTemplateDropdown();
          useTemplate = this.selectedTemplate;

          // If still empty, use default template
          if (!useTemplate.name || !useTemplate.content) {
            useTemplate = {
              name: 'Coffee Chat',
              content: this.templates[0].content,
              subjectLine: this.templates[0].subjectLine || 'Coffee Chat with [Recipient Name]',
              purpose: 'to send a coffee chat request',
              attachments: []
            };
            this.selectedTemplate = useTemplate;
          }
        }

        // Add user data to the template
        if (this.userData) {
          useTemplate.userData = {
            name: this.userData.name,
            college: this.userData.college,
            graduationYear: this.userData.graduationYear,
            experiences: this.userData.experiences,
            skills: this.userData.skills
          };
        }

        const response = await ProfileScraper.generateColdEmail(profileData, useTemplate);

        console.log(response);

        document.querySelector('#linkmail-splash').style.display = 'none';
        document.querySelector('#linkmail-editor').style.display = 'block';

        if (response?.email) {
          let emailContent = response.email;

          // Check if this is an error message (contains our error format)
          if (emailContent.includes('As a fallback, here\'s a simple message:')) {
            // This is an error message, display it as-is for debugging
            this.elements.emailResult.value = emailContent;
            this.elements.emailSubject.value = response.subject;
          } else {
            // This is a normal email, process it
            if (this.userData && this.userData.name) {
              // Replace various name placeholders with the user's actual name
              emailContent = emailContent.replace(/\[Your Name\]/g, this.userData.name);
              emailContent = emailContent.replace(/\[Sender Name\]/g, this.userData.name);

              // Fix case where recipient name might have been used in signature
              const profileData = await ProfileScraper.scrapeBasicProfileData();
              if (profileData.name) {
                // Replace recipient name in signature area with user name
                const recipientName = profileData.name;
                // Look for patterns like "Best regards,\n  [RecipientName]" and replace with user name
                emailContent = emailContent.replace(
                  new RegExp(`(Best regards,\\s*\\n\\s*)(${recipientName})`, 'gi'),
                  `$1${this.userData.name}`
                );
              }
            }

            this.elements.emailResult.value = emailContent;
            this.elements.emailSubject.value = response.subject;

            // Display attachments if any are present in the selected template
            this.displayAttachments(useTemplate.attachments);
          }

          adjustHeight(this.elements.emailResult);
        } else {
          this.elements.emailResult.value = 'Failed to generate email. Please try again.';
        }
        
        // Attempt to auto-fill recipient email automatically if still blank
        await this._fetchAndFillEmailIfBlank();
      } catch (error) {
        console.error('Error:', error);
        this.elements.emailResult.value = 'An error occurred while generating the email.';
      } finally {
        this.elements.generateButton.disabled = false;
        this.elements.generateButton.innerText = 'Generate';
      }
    });

    // COPY BUTTON
    if (this.elements.copyButton) this.elements.copyButton.addEventListener('click', () => {
      this.elements.emailResult.select();
      document.execCommand('copy');
      this.elements.copyButton.textContent = 'Copied!';
      setTimeout(() => {
        this.elements.copyButton.textContent = 'Copy';
      }, 2000);
    });

    // Find Email button event listener
    if (this.elements.findEmailButton) this.elements.findEmailButton.addEventListener('click', async () => {
      console.log('Find Email button clicked');

      // Disable button and show loading state
      this.elements.findEmailButton.disabled = true;
      this.elements.findEmailButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" style="margin-right: 4px; animation: spin 1s linear infinite;" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 11-6.219-8.56"/>
        </svg>
        Finding...
      `;

      try {
        // Get the current profile data
        const profileData = await ProfileScraper.scrapeBasicProfileData();
        console.log('Profile data for email search:', profileData);

        // Try scraping LinkedIn for email (about/contact info)
        const scrapedEmail = await EmailFinder.getEmail();

        if (scrapedEmail) {
          const recipientInput = document.getElementById('recipientEmailInput');
          if (recipientInput) {
            recipientInput.value = scrapedEmail;
          }

          // Hide the find email button since we found an email
          this.elements.findEmailButton.style.display = 'none';

          // Show success message briefly
          this.showTemporaryMessage('Email found on profile!', 'success');

        } else {
          // No email found via scraping; try backend by LinkedIn URL as a fallback
          console.log('[UIManager] Find Email fallback: calling backend by LinkedIn URL');
          try {
            if (!window.BackendAPI || !window.BackendAPI.isAuthenticated) {
              this.showTemporaryMessage('Please sign in to fetch emails from your contacts', 'error');
            } else {
              let extra = {};
              try {
                const basic = await ProfileScraper.scrapeBasicProfileData();
                extra = {
                  firstName: basic?.firstName || '',
                  lastName: basic?.lastName || '',
                  company: basic?.company || ''
                };
              } catch (_e) {}
              const data = await window.BackendAPI.getEmailByLinkedIn(window.location.href, extra);
              console.log('[UIManager] Find Email backend result:', data);
              if (data && data.found && data.email) {
                const recipientInput = document.getElementById('recipientEmailInput');
                if (recipientInput) recipientInput.value = data.email;
                this.elements.findEmailButton.style.display = 'none';
                this.showTemporaryMessage(data.isVerifiedContact ? 'Verified email from your contacts' : 'Email from your contacts', 'success');
              } else {
                this.showTemporaryMessage('No email found in contacts', 'error');
              }
            }
          } catch (be) {
            console.log('[UIManager] Find Email backend error:', be);
            this.showTemporaryMessage('Failed to fetch email from contacts', 'error');
          }
        }

      } catch (error) {
        console.error('Error in Find Email:', error);
        this.showTemporaryMessage('Failed to find email. Please try again.', 'error');
      } finally {
        // Reset button state
        this.elements.findEmailButton.disabled = false;
        this.elements.findEmailButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" style="margin-right: 4px;" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          Find Email
        `;
      }
    });

    // Replace your current sendGmailButton event listener with this
    if (this.elements.sendGmailButton) this.elements.sendGmailButton.addEventListener('click', async () => {
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
        this.showTemporaryMessage('Please fill in all fields', 'error');
        return;
      }

      try {
        // Disable button and update text
        this.elements.sendGmailButton.disabled = true;
        this.elements.sendGmailButton.textContent = 'Sending...';
        console.log('Sending email...');

        // Get any attachments from the selected template
        const attachments = this.selectedTemplate?.attachments || [];

        // Send email with attachments
        await GmailManager.sendAndSaveEmail(email, subject, emailContent, attachments);
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
          
          // Find and show similar person suggestion
          this.findAndShowSimilarPerson();
        } else {
          console.error('Success view not found!');
        }

      } catch (error) {
        console.error('Failed to send email:', error);
        this.showTemporaryMessage('Failed to send email. Please make sure you are logged into Gmail and try again.', 'error');
      } finally {
        // Re-enable button
        this.elements.sendGmailButton.disabled = false;
        this.elements.sendGmailButton.textContent = 'Send Email';
      }
    });

    // Retry People Search button
    if (this.elements.retryPeopleSearchButton) {
      this.elements.retryPeopleSearchButton.addEventListener('click', () => {
        console.log('Retry people search clicked');
        this.loadPeopleSuggestions();
      });
    }
  },

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

        // Check current view before updating
        const currentView = this.getCurrentView();
        console.log('Current view before storage listener update:', currentView);

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

              // Preserve current view if user is in editor or success view
              const shouldPreserveView = currentView === 'editor' || currentView === 'success';
              console.log('Should preserve view:', shouldPreserveView);

              // Only update UI if we're not showing the success view
              this.showAuthenticatedUI(shouldPreserveView);
            }
          });
      }
    });
  },

  // Helper: normalize profile URL key for caching
  _normalizeProfileUrlForCache(url) {
    try {
      const u = new URL(url);
      // keep pathname only up to profile slug
      const path = u.pathname.split('?')[0].split('#')[0].replace(/\/$/, '');
      return `${u.host}${path}`.toLowerCase();
    } catch (_e) {
      return (url || '').toString();
    }
  },

  // Fetch email from backend and fill input if currently blank; debounced per URL
  async _fetchAndFillEmailIfBlank(force = false) {
    try {
      const pageType = window.currentPageType || 'other-profile';
      if (pageType !== 'other-profile') return; // only on other people's profiles

      const recipientInput = document.getElementById('recipientEmailInput');
      if (!recipientInput) {
        // Retry a few times in case the editor hasn't mounted yet
        if (this._autoFillRetryCount < 5) {
          this._autoFillRetryCount++;
          this._autoFillRetryTimer = setTimeout(() => this._fetchAndFillEmailIfBlank(force), 400);
        }
        return;
      }
      const currentVal = (recipientInput.value || '').trim();
      if (currentVal) return; // already has an email

      // Quick on-page check: try About section only (non-invasive)
      try {
        const basic = await ProfileScraper.scrapeBasicProfileData();
        const fromAbout = basic?.emailFromAbout;
        if (fromAbout && !recipientInput.value) {
          recipientInput.value = fromAbout;
          if (this.elements.findEmailButton) this.elements.findEmailButton.style.display = 'none';
          this.showTemporaryMessage('Email found on profile!', 'success');
          return; // done
        }
        // If no about email and editor just mounted, retry once after a brief delay to let editor render
        if (!recipientInput.value && this._autoFillRetryCount < 1) {
          this._autoFillRetryCount++;
          this._autoFillRetryTimer = setTimeout(() => this._fetchAndFillEmailIfBlank(force), 300);
          return;
        }
      } catch (_e) {}

      if (!window.BackendAPI || !window.BackendAPI.isAuthenticated) return;

      const currentUrl = window.location.href;
      console.log('[UIManager] Attempting backend email fetch for URL:', currentUrl);
      const cacheKey = this._normalizeProfileUrlForCache(currentUrl);

      // Debounce per URL so we only attempt once per profile load, unless forced
      if (!force && this._emailLookupAttemptedForUrl === cacheKey) return;
      this._emailLookupAttemptedForUrl = cacheKey;

      // Check cached value in storage first
      const storageKey = `emailByLinkedIn:${cacheKey}`;
      const cached = await new Promise((resolve) => {
        try {
          if (!chrome.runtime?.id) return resolve(null);
          chrome.storage.local.get([storageKey], (result) => resolve(result[storageKey] || null));
        } catch (_e) { resolve(null); }
      });

      let data = cached;
      if (!data) {
        // Fetch from backend
        try {
          let extra = {};
          try {
            const basic = await ProfileScraper.scrapeBasicProfileData();
            extra = {
              firstName: basic?.firstName || '',
              lastName: basic?.lastName || '',
              company: basic?.company || ''
            };
          } catch (_e) {}
          data = await window.BackendAPI.getEmailByLinkedIn(currentUrl, extra);
          console.log('[UIManager] Backend email result:', data);
        } catch (e) {
          console.log('Email by LinkedIn fetch failed:', e?.message || e);
          return;
        }
        // Cache result (even negative) to avoid repeat calls
        try {
          if (chrome.runtime?.id) {
            chrome.storage.local.set({ [storageKey]: data });
          }
        } catch (_e) {}
      }

      if (data && data.found && data.email && !recipientInput.value) {
        recipientInput.value = data.email;
        if (this.elements.findEmailButton) this.elements.findEmailButton.style.display = 'none';
        if (data.isVerifiedContact) {
          this.showTemporaryMessage('Verified email autofilled from your contacts', 'success');
        } else {
          this.showTemporaryMessage('Email autofilled from your contacts', 'success');
        }
      }
    } catch (err) {
      console.log('fetchAndFillEmailIfBlank error:', err);
    }
  },

  async init() {
    this.cleanupUI(); // Clean up any existing UI first
    await this.createUI();
    this.setupEventListeners();
    this.setupStorageListener();
    this.setupEmailHistoryRefresh();
    this.setupTemplateRefreshListener();
    this.setupFocusRefresh();

    // Initial checks
    await this.checkLastEmailSent();
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
    const peopleSuggestionsView = this.container.querySelector('#linkmail-people-suggestions');

    // Hide ALL views first (centralized)
    this._hideAllViews();

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
        // Check if extension context is still valid
        if (!chrome.runtime?.id) {
          console.log('Extension context invalidated, cannot check user in storage during reset');
          if (signInView) signInView.style.display = 'flex';
          return;
        }

        const userExists = await this.checkUserInStorage(this.userData.email);

        if (userExists) {
          // Get user data from storage
          const storedUserData = await this.getUserFromStorage(this.userData.email);
          this.userData = { ...this.userData, ...storedUserData };

          // Check page type - treat own-profile same as feed page
          const pageType = this.getSafePageType();
          const shouldShowPeopleSuggestions = pageType === 'feed' || pageType === 'own-profile';

          if (shouldShowPeopleSuggestions) {
            // Feed page and own-profile: Show people suggestions
            if (peopleSuggestionsView) {
              peopleSuggestionsView.style.display = 'block';
              this.loadPeopleSuggestions();
            }
          } else {
            // Other profile page: Show splash view
            if (splashView) splashView.style.display = 'flex';
          }

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
        console.log('Error checking user in storage during reset:', error);
        if (signInView) signInView.style.display = 'flex';
      }
    } else {
      // Not authenticated, show sign in view
      if (signInView) signInView.style.display = 'flex';

      // Hide user info
      const accountInfo = this.container.querySelector('.linkmail-account-info');
      if (accountInfo) accountInfo.style.display = 'none';
    }

    // Update the title based on page type
    const nameElement = this.container.querySelector('#title');
    if (nameElement) {
      const pageType = this.getSafePageType();
      const shouldShowGenericTitle = pageType === 'feed' || pageType === 'own-profile';

      if (shouldShowGenericTitle) {
        nameElement.textContent = 'Draft personalized emails with AI';
      } else {
        // Other profile page logic
        // Try to extract the correct profile name from LinkedIn's DOM
        let profileName = '';
        const h1Element = document.querySelector('h1');
        if (h1Element) {
          profileName = h1Element.innerText || '';
        }
        const firstName = profileName.split(' ')[0] || '';
        nameElement.textContent = `Draft an email to ${firstName}`;
      }
    }

    // Ensure templates are populated and one is selected
    this.populateTemplateDropdown();

    // Make sure the view matches the page type after auth check
    await this.checkLastEmailSent();

    // Re-populate the form with the profile's email and attempt autofill
    await this.populateForm();
    await this._fetchAndFillEmailIfBlank(true);
  },

  // Add this new method to help manage view transitions
  showView(viewName) {
    console.log(`Showing view: ${viewName}`);

    if (!this.container) {
      console.error('Container not initialized, cannot show view');
      return;
    }

    // Define all possible views (centralized)
    const allViews = this.ALL_VIEWS;

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
      
      // If showing people suggestions, load the suggestions
      if (viewName === '#linkmail-people-suggestions') {
        this.loadPeopleSuggestions();
      }
    } else {
      console.error(`Target view not found: ${viewName}`);
    }
  },

  // Update the populateTemplateDropdown method in UI-manager.js
  populateTemplateDropdown() {
    const templateContainer = this.elements.templateDropdown;

    if (!templateContainer) {
      console.error('Template container not found');
      return;
    }

    templateContainer.innerHTML = '';

    const selectedTemplateName = this.selectedTemplate.name || null;

    const defaultTemplates = [
      {
        id: 'coffee-chat',
        icon: '☕',
        name: 'Coffee Chat',
        description: 'A friendly intro to chat',
        content: this.templates[0].content,
        subjectLine: this.templates[0].subjectLine || 'Coffee Chat with [Recipient Name]',
        purpose: 'to send a coffee chat request',
        attachments: [] // Add empty attachments array
      },
      {
        id: 'job-application',
        icon: '💼',
        name: 'Job Application',
        description: 'A professional email for recruiting',
        content: this.templates[1].content,
        subjectLine: this.templates[1].subjectLine || 'Job Application - [Your Name] ([User College])',
        purpose: 'to send a job application',
        attachments: [] // Add empty attachments array
      }
    ];

    let allTemplates = [...defaultTemplates];

    if (this.userData && this.userData.templates && Array.isArray(this.userData.templates)) {
      console.log(`Found ${this.userData.templates.length} custom templates`);

      const customTemplates = this.userData.templates
        .filter(template => template && template.name)
        .map((template, index) => ({
          id: `custom-${index}`,
          icon: template.icon || '📝',
          name: template.name,
          description: template.description || 'Custom email template',
          content: template.content,
          subjectLine: template.subjectLine || `${template.name} with [Recipient Name]`,
          purpose: `to send a ${template.name} email`,
          attachments: template.attachments || [] // Include attachments
        }));

      allTemplates = [...allTemplates, ...customTemplates];
    } else {
      console.log('No custom templates found');
    }


    // Render each template from the concatenated array
    allTemplates.forEach(template => {
      const card = document.createElement('div');
      card.className = 'template-dropdown-card';
      card.dataset.template = template.id;

      // Check if this template should be selected
      if (selectedTemplateName === template.name) {
        card.classList.add('selected');
      }

      // Use the specified HTML structure without attachment indicator
      card.innerHTML = `
        <h1 class="template-dropdown-icon">${template.icon}</h1>
        <div>
          <h2>${template.name}</h2>
        </div>
      `;

      // Add click event listener with consistent handling
      card.addEventListener('click', () => {
        // Remove 'selected' class from all cards
        templateContainer.querySelectorAll('.template-dropdown-card').forEach(c => {
          c.classList.remove('selected');
        });

        // Add 'selected' class to clicked card
        card.classList.add('selected');

        // Update the selectedTemplate with consistent structure
        this.selectedTemplate = {
          name: template.name,
          content: template.content,
          subjectLine: template.subjectLine,
          purpose: template.purpose,
          attachments: template.attachments || [] // Include attachments in selected template
        };
      });

      templateContainer.appendChild(card);
    });

    // Auto-select first template if no template is currently selected
    if ((!this.selectedTemplate.name || Object.keys(this.selectedTemplate).length === 0) && allTemplates.length > 0) {
      // Prefer custom templates over default ones
      let templateToSelect = allTemplates[0]; // fallback to first template

      // Look for custom templates first (they have id starting with 'custom-')
      const customTemplate = allTemplates.find(t => t.id && t.id.startsWith('custom-'));
      if (customTemplate) {
        templateToSelect = customTemplate;
      }

      // Select the chosen template
      const firstTemplate = templateToSelect;
      this.selectedTemplate = {
        name: firstTemplate.name,
        content: firstTemplate.content,
        subjectLine: firstTemplate.subjectLine,
        purpose: firstTemplate.purpose,
        attachments: firstTemplate.attachments || []
      };

      // Add visual selection to the correct template card
      const templateCards = templateContainer.querySelectorAll('.template-dropdown-card');
      templateCards.forEach(card => {
        const cardTemplateName = card.querySelector('h2')?.textContent;
        if (cardTemplateName === firstTemplate.name) {
          card.classList.add('selected');
        }
      });
    } else if (this.selectedTemplate.name) {
      // Find and highlight the already selected template
      const templateCards = templateContainer.querySelectorAll('.template-dropdown-card');
      templateCards.forEach(card => {
        const templateName = card.querySelector('h2')?.textContent;
        // Clear all selections first
        card.classList.remove('selected');
        // Then highlight only the correct one
        if (templateName === this.selectedTemplate.name) {
          card.classList.add('selected');
        }
      });
    }
  },

  // Also add this method to actively pull the latest templates when a user returns to LinkedIn
  checkForTemplateUpdates() {
    if (this.isAuthenticated && this.userData && this.userData.email) {
      console.log('Actively checking for template updates');

      try {
        if (!chrome.runtime?.id) {
          console.log('Extension context invalidated, cannot check template updates');
          return;
        }

        chrome.storage.local.get([this.userData.email], (result) => {
          if (chrome.runtime.lastError) {
            console.log('Chrome storage error:', chrome.runtime.lastError);
            return;
          }

          const storedData = result[this.userData.email];

          if (storedData && storedData.templates) {
            // Check if templates have changed by comparing lengths first (quick check)
            const currentTemplatesLength = this.userData.templates ? this.userData.templates.length : 0;
            const newTemplatesLength = storedData.templates.length;

            if (newTemplatesLength !== currentTemplatesLength) {
              console.log(`Template count changed: ${currentTemplatesLength} -> ${newTemplatesLength}`);

              // Check current UI state before updating
              const currentView = this.getCurrentView();
              console.log('Current view before template count update:', currentView);

              this.userData = storedData;
              this.populateTemplateDropdown();

              // Preserve the current view state
              if (currentView === 'editor') {
                console.log('Preserving email editor view after template count change');
              }
              return;
            }

            // If lengths match, do a deeper comparison
            if (currentTemplatesLength > 0) {
              const currentTemplatesJSON = JSON.stringify(this.userData.templates);
              const newTemplatesJSON = JSON.stringify(storedData.templates);

              if (currentTemplatesJSON !== newTemplatesJSON) {
                console.log('Template content changed, updating dropdown');

                // Check current UI state before updating
                const currentView = this.getCurrentView();
                console.log('Current view before template content update:', currentView);

                this.userData = storedData;
                this.populateTemplateDropdown();

                // Preserve the current view state
                if (currentView === 'editor') {
                  console.log('Preserving email editor view after template content change');
                }
              }
            }
          }
        });
      } catch (error) {
        console.log('Error checking template updates:', error);
      }
    }
  },

  // similar person logic is in content/ui/similar.js

  // Email history logic remains here (extracted helpers used elsewhere)
  async checkLastEmailSent() {
    try {
      console.log('Checking last email sent...');

      // Check if we're on a supported page (profile or feed)
      const currentProfileUrl = window.location.href;
      const isOnProfilePage = currentProfileUrl.includes('/in/');
      const isOnFeedPage = currentProfileUrl.includes('/feed/');
      
      if (!isOnProfilePage && !isOnFeedPage) {
        console.log('Not on a supported LinkedIn page, skipping email status check');
        return;
      }

      // Only check email history for other-profile pages (feed page and own-profile don't have specific profile context)
      const pageType = window.currentPageType || 'other-profile';
      if (pageType !== 'other-profile') {
        console.log('On feed page or own profile, skipping profile-specific email status check');
        return;
      }

      // Check if the UI container exists
      if (!this.container) {
        console.log('UI container not initialized, skipping email status check');
        return;
      }

      // Get the last email status element
      const lastEmailStatus = this.container.querySelector('#lastEmailStatus');
      if (!lastEmailStatus) {
        console.log('Last email status element not found in container, UI may not be fully initialized');
        return;
      }

      // Get the current LinkedIn profile name
      const profileName = document.querySelector('h1')?.innerText || '';

      // Default state
      lastEmailStatus.style.display = 'none';

      // If not authenticated, we need to check auth status first
      if (!this.isAuthenticated || !this.userData || !this.userData.email) {
        console.log('Not authenticated or missing user data, checking auth status first...');
        await this.checkAuthStatus();

        // If still not authenticated after checking, return
        if (!this.isAuthenticated || !this.userData) {
          console.log('Still not authenticated after check, returning');
          return;
        }
      }

      console.log('User authenticated, email:', this.userData.email);

      // Now we're sure we're authenticated and have user data
      // Get full user data from storage directly
      try {
        if (!chrome.runtime?.id) {
          console.log('Extension context invalidated, cannot check last email sent');
          return;
        }

        chrome.storage.local.get([this.userData.email], (result) => {
          if (chrome.runtime.lastError) {
            console.log('Chrome storage error:', chrome.runtime.lastError);
            return;
          }

          const storedUserData = result[this.userData.email];

          if (!storedUserData || !storedUserData.sentEmails || !storedUserData.sentEmails.length) {
            console.log('No sent emails found in storage');
            return; // No emails sent yet
          }

          console.log(`Found ${storedUserData.sentEmails.length} sent emails in storage`);

          // Find emails sent to this profile by URL match
          let emailsToThisProfile = storedUserData.sentEmails.filter(email =>
            email.linkedInUrl && (
            // Exact match
              email.linkedInUrl === currentProfileUrl ||
            // Handle slight URL variations (trailing slashes, etc)
            email.linkedInUrl.replace(/\/$/, '') === currentProfileUrl.replace(/\/$/, '') ||
            // Remove any query parameters for comparison
            email.linkedInUrl.split('?')[0] === currentProfileUrl.split('?')[0]
            )
          );

          // If no match by URL, try match by name (as a fallback)
          if (emailsToThisProfile.length === 0 && profileName) {
            console.log('No URL match, trying name match with:', profileName);
            emailsToThisProfile = storedUserData.sentEmails.filter(email =>
              email.recipientName && email.recipientName.trim() === profileName.trim()
            );
          }

          console.log(`Found ${emailsToThisProfile.length} emails to this profile`);

          if (emailsToThisProfile.length > 0) {
          // Sort by date, newest first
            emailsToThisProfile.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Format the date of the most recent email
            const lastEmailDate = new Date(emailsToThisProfile[0].date);
            const formattedDate = lastEmailDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });

            // Update the status text
            lastEmailStatus.textContent = `Last Sent on ${formattedDate}`;
            lastEmailStatus.style.display = 'block';
            // lastEmailStatus.style.color = '#4caf50'; // Green color to indicate success
            console.log('Updated status with last email date:', formattedDate);
          }
        });
      } catch (error) {
        console.log('Error accessing chrome storage for last email check:', error);
      }

    } catch (error) {
      console.error('Error checking last email sent:', error);
    }
  },

  setupTemplateRefreshListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && this.userData?.email && changes[this.userData.email]) {
        const newValue = changes[this.userData.email].newValue;
        const oldValue = changes[this.userData.email].oldValue;

        // Check if templates have changed
        if (newValue && oldValue &&
            JSON.stringify(newValue.templates) !== JSON.stringify(oldValue.templates)) {
          console.log('Templates have changed, updating user data and dropdown');

          // Check current UI state before updating
          const currentView = this.getCurrentView();
          console.log('Current view before storage update:', currentView);

          // Update local userData
          this.userData = newValue;

          // Update the dropdown without changing the current view
          this.populateTemplateDropdown();

          // Preserve the current view state
          if (currentView === 'editor') {
            console.log('Preserving email editor view after storage update');
            // Don't change the view, user should stay in email editor
          }
        }
      }
    });
  },

  // Focus refresh listener
  setupFocusRefresh() {
    // Set up a handler to refresh templates when the window regains focus
    window.addEventListener('focus', () => {
      console.log('Window focused, checking for template updates');

      if (this.isAuthenticated && this.userData && this.userData.email) {
        // Check current UI state before refreshing
        const currentView = this.getCurrentView();
        console.log('Current view before focus refresh:', currentView);

        this.refreshUserData().then(() => {
          // Only update template dropdown, don't change the current view
          this.populateTemplateDropdown();

          // If user was in email editor or success view, preserve it
          if (currentView === 'editor' || currentView === 'success') {
            console.log('Preserving current view after focus refresh:', currentView);
            // Don't call showAuthenticatedUI as it might change the view
          } else {
            // Only refresh UI if we're not in a critical view
            console.log('Safe to refresh UI after focus');
          }
        });
      }
    });
  },

  // Helper method to detect current view
  getCurrentView() {
    if (!this.container) return 'unknown';

    const editorView = this.container.querySelector('#linkmail-editor');
    const splashView = this.container.querySelector('#linkmail-splash');
    const successView = this.container.querySelector('#linkmail-success');
    const signInView = this.container.querySelector('#linkmail-signin');

    if (editorView && editorView.style.display === 'block') {
      return 'editor';
    } else if (successView && successView.style.display === 'block') {
      return 'success';
    } else if (splashView && splashView.style.display === 'flex') {
      return 'splash';
    } else if (signInView && signInView.style.display === 'flex') {
      return 'signin';
    }

    return 'unknown';
  },

  // Display template attachments in the email editor
  displayAttachments(attachments) {
    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      // Hide attachments section if there are no attachments
      const attachmentsSection = document.getElementById('emailAttachments');
      if (attachmentsSection) {
        attachmentsSection.style.display = 'none';
      }
      return;
    }

    // Show attachments section
    const attachmentsSection = document.getElementById('emailAttachments');
    const attachmentsList = document.getElementById('attachmentsList');

    if (!attachmentsSection || !attachmentsList) {
      console.error('Attachments elements not found');
      return;
    }

    // Clear any existing attachments
    attachmentsList.innerHTML = '';

    // Add each attachment
    attachments.forEach((attachment, _index) => {
      const attachmentItem = document.createElement('div');
      attachmentItem.className = 'email-attachment-item';

      // Format file size
      const sizeInKB = Math.round(attachment.size / 1024);
      const sizeFormatted = sizeInKB >= 1024
        ? (sizeInKB / 1024).toFixed(2) + ' MB'
        : sizeInKB + ' KB';

      attachmentItem.innerHTML = `
        <div class="attachment-info">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <path d="M9 18v-6"/>
            <path d="M12 18v-3"/>
            <path d="M15 18v-6"/>
          </svg>
          <div>
            <p class="attachment-name">${attachment.name}</p>
            <p class="attachment-size">${sizeFormatted}</p>
          </div>
        </div>
      `;

      attachmentsList.appendChild(attachmentItem);
    });

    // Show the attachments section
    attachmentsSection.style.display = 'block';
  },


  setupEmailHistoryRefresh() {
    // Set up a periodic check for email history
    // This helps with the case when auth isn't immediately ready after page load
    const refreshInterval = setInterval(() => {
      if (this.isAuthenticated && this.userData) {
        this.checkLastEmailSent();
        clearInterval(refreshInterval);
      }
    }, 2000); // Check every 2 seconds up to 10 seconds

    // Clear the interval after 10 seconds to avoid infinite checking
    setTimeout(() => {
      clearInterval(refreshInterval);
    }, 10000);
  },

  // People suggestions logic is in content/ui/people.js

  // Show temporary message to user
  showTemporaryMessage(message, type = 'info') {
    // Create message element if it doesn't exist
    let messageEl = this.container.querySelector('#linkmail-temp-message');
    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.id = 'linkmail-temp-message';
      messageEl.style.cssText = `
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        z-index: 1000;
        max-width: 300px;
        text-align: center;
        transition: opacity 0.3s ease;
      `;
      this.container.style.position = 'relative';
      this.container.appendChild(messageEl);
    }

    // Set message content and style based on type
    messageEl.textContent = message;
    if (type === 'success') {
      messageEl.style.backgroundColor = '#d4edda';
      messageEl.style.color = '#155724';
      messageEl.style.border = '1px solid #c3e6cb';
    } else if (type === 'error') {
      messageEl.style.backgroundColor = '#f8d7da';
      messageEl.style.color = '#721c24';
      messageEl.style.border = '1px solid #f5c6cb';
    } else {
      messageEl.style.backgroundColor = '#d1ecf1';
      messageEl.style.color = '#0c5460';
      messageEl.style.border = '1px solid #bee5eb';
    }

    messageEl.style.opacity = '1';
    messageEl.style.display = 'block';

    // Hide after 3 seconds
    setTimeout(() => {
      if (messageEl) {
        messageEl.style.opacity = '0';
        setTimeout(() => {
          if (messageEl && messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
          }
        }, 300);
      }
    }, 3000);
  }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.UIManager;
}
