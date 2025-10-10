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
  _authenticationInProgress: false,
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
      name: 'Coffee Chat Request',
      description: 'Send a friendly request to chat with this person.',
      purpose: 'to schedule a coffee chat to the recipient',
      subjectLine: 'Coffee Chat Request',
      content: 'Hi [Recipient First Name],\n\n[Mention something specific about recipient company or recent work that interests me].\n\nI\'d love to connect and learn more about your experience in [mention recipient field/industry]. Would you be open to a brief coffee chat?\n\nBest regards,\n[My Name]'
    },
    {
      icon: '💼',
      name: 'Inquire About Open Roles',
      description: 'Craft a professional email to a recruiter or manager',
      purpose: 'to inquire if there is internship or job',
      subjectLine: 'Wondering About Potential Opportunities at [Recipient Company Name]',
      content: 'Hi [Recipient First Name],\n\nI\'m [brief personal introduction including my background]. I\'m really impressed by [mention something specific about recipient company\'s work or mission].\n\n[Connect recipient company\'s work to my own experience or interests]. I\'d love to learn about potential opportunities at [Recipient Company Name].\n\nBest regards,\n[My Name]'
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
        // Hide Apollo button since we have an email
        if (this.elements.findEmailApolloButton) {
          this.elements.findEmailApolloButton.style.display = 'none';
        }
      } else {
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
      
      // Always hide Apollo button on feed page and own profile
      if (this.elements.findEmailApolloButton) {
        this.elements.findEmailApolloButton.style.display = 'none';
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
        if (!email || typeof email !== 'string' || email.trim().length === 0) {
          console.warn('checkUserInStorage called without a valid email');
          resolve(false);
          return;
        }
        if (!chrome.runtime?.id) {
          resolve(false);
          return;
        }

        chrome.storage.local.get([email], (result) => {
          if (chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(result[email] ? true : false);
        });
      } catch (error) {
        resolve(false);
      }
    });
  },

  // Add this method to get user data from storage
  async getUserFromStorage(email) {
    return new Promise((resolve) => {
      try {
        if (!email || typeof email !== 'string' || email.trim().length === 0) {
          console.warn('getUserFromStorage called without a valid email');
          resolve(null);
          return;
        }
        if (!chrome.runtime?.id) {
          resolve(null);
          return;
        }

        chrome.storage.local.get([email], (result) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(result[email] || null);
        });
      } catch (error) {
        resolve(null);
      }
    });
  },

  // Removed redirectToBioSetup flow: no profile completion redirects/messages
  redirectToBioSetup(_email) {
  },

  async checkAuthStatus() {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        this.isAuthenticated = false;
        this.showSignInUI();
        return this.isAuthenticated;
      }

      // Check backend authentication status
      if (!window.BackendAPI) {
        this.isAuthenticated = false;
        this.showSignInUI();
        return this.isAuthenticated;
      }

      // Initialize BackendAPI and check auth status (will only poll backend if not already authenticated)
      await window.BackendAPI.init();
      
      if (window.BackendAPI.isAuthenticated && window.BackendAPI.userData) {
        this.isAuthenticated = true;
        console.log('[UIManager] Setting userData from BackendAPI:', window.BackendAPI.userData);
        this.userData = {
          email: window.BackendAPI.userData.email,
          name: window.BackendAPI.userData.name,
          firstName: window.BackendAPI.userData.firstName,
          lastName: window.BackendAPI.userData.lastName,
          picture: window.BackendAPI.userData.picture
        };
        console.log('[UIManager] userData set to:', this.userData);

        // Keep cached own-profile id updated for stable page-type detection
        this.updateOwnProfileIdFromUserData();

        // Check if user exists in local storage for additional user data (bio, templates, etc.)
        const hasEmail = typeof this.userData.email === 'string' && this.userData.email.trim().length > 0;
        const userExists = hasEmail ? await this.checkUserInStorage(this.userData.email) : false;

        if (userExists) {
          // Get complete user data from storage and merge with backend userData
          const storedUserData = hasEmail ? await this.getUserFromStorage(this.userData.email) : null;
          this.userData = { ...this.userData, ...storedUserData };
          this.updateOwnProfileIdFromUserData();
        }

        // Show authenticated UI for all authenticated users - no profile setup redirection
        this.showAuthenticatedUI();
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

  /**
   * Get user name with fallback to firstName + lastName combination
   * @returns {string} User's full name
   */
  _getUserNameWithFallback() {
    // First try the direct name field (from Google auth)
    if (this.userData && this.userData.name && this.userData.name.trim()) {
      return this.userData.name.trim();
    }

    // Fallback to combining firstName + lastName (from profile)
    if (this.userData && (this.userData.firstName || this.userData.lastName)) {
      const firstName = this.userData.firstName || '';
      const lastName = this.userData.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName) {
        return fullName;
      }
    }

    // No name available
    return null;
  },

  showSignInUI() {
    this.showView('#linkmail-signin');

    // Hide user info
    const accountInfo = this.container.querySelector('.account-dropdown');
    if (accountInfo) {
      accountInfo.style.display = 'none';
    }
  },

  cleanupUI() {

    // Remove any existing UI elements to prevent duplicates
    const existingUIs = document.querySelectorAll('.linkmail-container');

    existingUIs.forEach(ui => {
      ui.remove();
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



  // Add this new method to UIManager to refresh user data
  async refreshUserData() {
    if (!this.isAuthenticated || !this.userData || !this.userData.email) {
      return;
    }


    return new Promise((resolve) => {
      try {
        if (!chrome.runtime?.id) {
          resolve();
          return;
        }

        chrome.storage.local.get([this.userData.email], (result) => {
          if (chrome.runtime.lastError) {
            resolve();
            return;
          }

          const storedUserData = result[this.userData.email];

          if (storedUserData) {
            console.log('[UIManager] refreshUserData - BEFORE merge, this.userData:', this.userData);
            console.log('[UIManager] refreshUserData - storedUserData from Chrome storage:', storedUserData);
            // MERGE stored data with current userData, preserving name fields from BackendAPI
            this.userData = {
              ...storedUserData,  // Get templates, sentEmails from storage
              ...this.userData,   // Preserve name, firstName, lastName, email, picture from BackendAPI
              // Explicitly preserve critical fields from stored data that we want to keep
              templates: storedUserData.templates || this.userData.templates,
              sentEmails: storedUserData.sentEmails || this.userData.sentEmails
            };
            console.log('[UIManager] refreshUserData - AFTER merge, this.userData:', this.userData);

            // Pass updated user data to GmailManager
            if (window.GmailManager) {
              window.GmailManager.setUserData(this.userData);
            }
          } else {
          }

          resolve();
        });
      } catch (error) {
        resolve();
      }
    });
  },

  // Method to refresh templates from backend and sync to local storage
  async refreshTemplatesFromBackend() {
    if (!this.isAuthenticated || !this.userData || !this.userData.email) {
      return;
    }

    try {
      if (window.TemplateManager) {
        console.log('Refreshing templates from backend...');
        const result = await window.TemplateManager.loadTemplates(this.userData.email);
        if (result.success) {
          console.log('Templates refreshed successfully from backend:', result.templates.length);

          // Refresh userData from storage to get the newly synced templates
          const updatedUserData = await this.getUserFromStorage(this.userData.email);
          if (updatedUserData) {
            this.userData = { ...this.userData, ...updatedUserData };
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing templates from backend:', error);
    }
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
        return;
      }
      this._isCreatingUI = true;

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



      // Insert into the page (wait for LinkedIn aside to be present)
      let asideElement = document.querySelector('aside.scaffold-layout__aside');
      let attempts = 0;
      const maxAttempts = 10; // ~3s total at 300ms intervals
      while (!asideElement && attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 300));
        asideElement = document.querySelector('aside.scaffold-layout__aside');
      }
      if (asideElement) {
        // Double-check right before injection
        if (!document.querySelector('.linkmail-container')) {
          asideElement.prepend(injectedDiv);
        } else {
          console.log('LinkMail UI already present at inject time; aborting duplicate injection');
          this._isCreatingUI = false;
          return;
        }
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
      await this.checkAuthStatus();

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

        }
      } catch (fallbackError) {
        console.error('Failed to create fallback UI:', fallbackError);
      }
    } finally {
      this._isCreatingUI = false;
    }
  },

  // Update Apollo usage display
  async updateApolloUsageDisplay() {
    if (!this.elements.findEmailApolloButton || !this.elements.apolloUsageCounter || !this.elements.apolloLimitMessage) {
      return;
    }

    try {
      if (!window.BackendAPI || !window.BackendAPI.isAuthenticated) {
        return;
      }

      const usageInfo = await window.BackendAPI.getApolloUsage();
      
      if (usageInfo && usageInfo.success) {
        const { currentUsage, limit, hasReachedLimit } = usageInfo;
        
        // Update usage counter text
        this.elements.apolloUsageCounter.textContent = `Current Usage: ${currentUsage}/${limit}`;
        
        if (hasReachedLimit) {
          // Hide Apollo button and usage counter, show limit message
          this.elements.findEmailApolloButton.style.display = 'none';
          this.elements.apolloUsageCounter.style.display = 'none';
          this.elements.apolloLimitMessage.style.display = 'block';
        } else {
          // Show usage counter, hide limit message
          this.elements.apolloUsageCounter.style.display = 'block';
          this.elements.apolloLimitMessage.style.display = 'none';
          // Only show Apollo button if we're in the editor view and no email is filled
          const recipientInput = document.getElementById('recipientEmailInput');
          const editorView = document.querySelector('#linkmail-editor');
          if (editorView && editorView.style.display === 'block' && recipientInput && !recipientInput.value) {
            this.elements.findEmailApolloButton.style.display = 'flex';
            // Reset button to default search icon state
            this.resetFindEmailButtonToDefault();
          }
        }
      }
    } catch (error) {
      console.error('Error updating Apollo usage display:', error);
      // On error, hide usage counter but don't show limit message
      this.elements.apolloUsageCounter.style.display = 'none';
      this.elements.apolloLimitMessage.style.display = 'none';
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
        
        if (dropdown.classList.contains('show')) {
          // Hide dropdown with animation
          dropdown.classList.remove('show');
          dropdown.classList.add('hide');
          
          // Remove from DOM after animation completes
          setTimeout(() => {
            dropdown.style.display = 'none';
            dropdown.classList.remove('hide');
          }, 200); // Match CSS transition duration
        } else {
          // Show dropdown with animation
          dropdown.style.display = 'block';
          // Force reflow to ensure display change is applied
          dropdown.offsetHeight;
          dropdown.classList.add('show');
        }
      });
    } else {
      console.log('Menu toggle/content not found; skipping account dropdown listeners');
    }

    // Close dropdown when clicking elsewhere on the page
    window.addEventListener('click', (event) => {
      if (this.elements.menuContent && !this.elements.menuContent.contains(event.target) && this.elements.menuContent.classList.contains('show')){
        const dropdown = this.elements.menuContent;
        dropdown.classList.remove('show');
        dropdown.classList.add('hide');
        
        // Remove from DOM after animation completes
        setTimeout(() => {
          dropdown.style.display = 'none';
          dropdown.classList.remove('hide');
        }, 200); // Match CSS transition duration
      }
    });

    // Google Sign-in button - now uses backend authentication
    if (this.elements.signInButton) this.elements.signInButton.addEventListener('click', async () => {
      try {
        // Check if extension context is still valid
        if (!chrome.runtime?.id) {
          this.showTemporaryMessage('Extension needs to be reloaded. Please refresh the page and try again.', 'error');
          return;
        }

        // Check if BackendAPI is available
        if (!window.BackendAPI) {
          console.error('Backend API not available');
          this.showTemporaryMessage('Service unavailable. Please try again later.', 'error');
          return;
        }

        // Prevent multiple authentication attempts
        if (this._authenticationInProgress) {
          this.showTemporaryMessage('Authentication already in progress. Please wait...', 'info');
          return;
        }

        // Check if already authenticated
        if (window.BackendAPI.isAuthenticated && window.BackendAPI.userData) {
          this.isAuthenticated = true;
          this.userData = window.BackendAPI.userData;
          this.showAuthenticatedUI();
          return;
        }

        // Mark authentication as in progress
        this._authenticationInProgress = true;

        // Show loading message
        this.showTemporaryMessage('Opening authentication page...', 'info');
        
        // Start backend authentication flow
        await window.BackendAPI.startAuthFlow();
        
        // Show instructions to user
        this.showTemporaryMessage('Please complete authentication in the new tab and return here.', 'info');
        
        // Set up a listener for when authentication completes
        let authCheckCount = 0;
        const maxAuthChecks = 15; // 1 minute at 4-second intervals (reduced from 2 minutes)
        
        const checkAuthInterval = setInterval(async () => {
          try {
            authCheckCount++;
            
            // Check BackendAPI for auth status (only poll if not already authenticated)
            if (!window.BackendAPI.isAuthenticated) {
              await window.BackendAPI.checkForAuthSuccess();
            }
            
            if (window.BackendAPI.isAuthenticated && window.BackendAPI.userData) {
              clearInterval(checkAuthInterval);
              this._authenticationInProgress = false; // Reset flag
              
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
                this.showAuthenticatedUI();
                this.showTemporaryMessage('Authentication successful!', 'success');
              }
            } else if (authCheckCount >= maxAuthChecks) {
              // Stop checking after max attempts
              clearInterval(checkAuthInterval);
              this._authenticationInProgress = false; // Reset flag
              this.showTemporaryMessage('Authentication timeout. Please try again.', 'error');
            }
          } catch (error) {
            if (authCheckCount >= maxAuthChecks) {
              clearInterval(checkAuthInterval);
              this._authenticationInProgress = false; // Reset flag
            }
          }
        }, 4000); // Check every 4 seconds
        
        // Also listen for storage changes (in case auth data is stored while we're waiting)
        const storageListener = (changes, namespace) => {
          if (namespace === 'local' && (changes.backendToken || changes.backendUserData)) {
            // Trigger an immediate auth check
            setTimeout(async () => {
              try {
                await window.BackendAPI.init();
                if (window.BackendAPI.isAuthenticated) {
                  clearInterval(checkAuthInterval);
                  chrome.storage.onChanged.removeListener(storageListener);
                  this._authenticationInProgress = false; // Reset flag
                  
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
                    this.showAuthenticatedUI();
                    this.showTemporaryMessage('Authentication successful!', 'success');
                  }
                }
              } catch (error) {
              }
            }, 100);
          }
        };
        
        chrome.storage.onChanged.addListener(storageListener);
        
      } catch (error) {
        console.error('Error during authentication:', error);
        this._authenticationInProgress = false; // Reset flag on error
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

        // Show sign-in view (this will handle hiding all other views)
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
    if (this.elements.editProfileButton) {
      this.elements.editProfileButton.addEventListener('click', () => {
        // Redirect to web dashboard profile page
        const profileUrl = 'https://www.linkmail.dev/dashboard/profile';
        
        // Open in new tab
        chrome.runtime.sendMessage({
          action: 'openBioSetupPage',
          url: profileUrl
        }, (response) => {
          if (response && response.success) {
            console.log('✅ Opened web dashboard profile page');
            
            // Set up a timer to refresh templates when user returns
            const refreshInterval = setInterval(() => {
              this.refreshUserData().then(() => {
                this.populateTemplateDropdown();
              });
            }, 5000);

            // Stop checking after 10 minutes (600000 ms)
            setTimeout(() => {
              clearInterval(refreshInterval);
            }, 600000);
          } else {
            console.error('❌ Failed to open dashboard:', response);
          }
        });
      });
    } else {
      console.error('❌ Edit Profile button not found in DOM!');
    }

    // Add settingsButton click handler for templates
    if (this.elements.settingsButton) {
      this.elements.settingsButton.addEventListener('click', () => {
        // Redirect to web dashboard templates page
        const templatesUrl = 'https://www.linkmail.dev/dashboard/templates';
        
        // Open in new tab
        chrome.runtime.sendMessage({
          action: 'openBioSetupPage',
          url: templatesUrl
        }, (response) => {
          if (response && response.success) {
            console.log('✅ Opened web dashboard templates page');
            
            // Set up a timer to refresh templates when user returns
            const refreshInterval = setInterval(() => {
              this.refreshUserData().then(() => {
                this.populateTemplateDropdown();
              });
            }, 5000);

            // Stop checking after 10 minutes (600000 ms)
            setTimeout(() => {
              clearInterval(refreshInterval);
            }, 600000);
          } else {
            console.error('❌ Failed to open templates dashboard:', response);
          }
        });
      });
    } else {
      console.error('❌ Settings button not found in DOM!');
    }

    // GENERATE BUTTON UI
    if (this.elements.generateButton) this.elements.generateButton.addEventListener('click', async () => {
      // Check if authenticated
      if (!this.isAuthenticated) {
        this.showSignInUI();
        return;
      }

      this.elements.generateButton.disabled = true;
      this.elements.generateButton.innerText = 'Generating...';
      
      // Hide the "Last sent on" tooltip during loading
      const lastEmailStatus = this.container.querySelector('#lastEmailStatus');
      if (lastEmailStatus) {
        lastEmailStatus.style.display = 'none !important';
        lastEmailStatus.classList.add('hidden');
      }
      
      // Start loading animation
      const pointer = document.querySelector('.linkmail-pointer');
      if (pointer) {
        pointer.classList.add('loading');
      }

      // Shrink container height
      const container = document.querySelector('.linkmail-container');
      if (container) {
        container.classList.add('compact');
      }

      // Hide template dropdown and generate button with fade out animation
      const templateDropdown = document.querySelector('.linkmail-template-select');
      if (templateDropdown) {
        templateDropdown.classList.add('fade-out-up');
      }
      if (this.elements.generateButton) {
        this.elements.generateButton.classList.add('fade-out-up');
      }

      // Change heading to "Cooking..."
      const titleElement = document.getElementById('title');
      if (titleElement) {
        this.originalTitle = titleElement.textContent; // Store original title
        titleElement.textContent = 'Cooking...';
      }

      function adjustHeight(element) {
        element.style.height = 'auto';
        element.style.height = element.scrollHeight + 'px';
      }

      // Make textarea autoresizable
      const emailResult = document.getElementById('emailResult');
      if (emailResult) {
        emailResult.addEventListener('input', function() {adjustHeight(this);});
      }

      // Hide no email found message when user types in recipient email
      const recipientInput = document.getElementById('recipientEmailInput');
      if (recipientInput) {
        recipientInput.addEventListener('input', () => {
          if (recipientInput.value.trim()) {
            this.hideNoEmailFoundMessage();
          }
        });
      }

      // Add event listener for dismiss button
      const dismissButton = document.getElementById('noEmailDismissButton');
      if (dismissButton) {
        dismissButton.addEventListener('click', () => {
          this.hideNoEmailFoundMessage();
        });
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
        }

        // Update the recipient email field (only for other-profile pages)
        if (shouldScrapeProfile) {
          const recipientInput = document.getElementById('recipientEmailInput');

          if (recipientInput && emailToUse) {
            recipientInput.value = emailToUse;
            // Hide Apollo button since we have an email
            if (this.elements.findEmailApolloButton) {
              this.elements.findEmailApolloButton.style.display = 'none';
            }
          } else {
            // No email found - show Apollo button if authenticated
            if (window.BackendAPI && window.BackendAPI.isAuthenticated && this.elements.findEmailApolloButton) {
              this.elements.findEmailApolloButton.style.display = 'flex';
            }
          }
        }

        // Get selected template
        let useTemplate = this.selectedTemplate;


        // FAILSAFE: Ensure template is selected
        if (!useTemplate.name || !useTemplate.content) {
          // Force template selection if empty
          this.populateTemplateDropdown();
          useTemplate = this.selectedTemplate;

          // If still empty, use default template
          if (!useTemplate.name || !useTemplate.content) {
            useTemplate = {
              name: 'Coffee Chat Request',
              content: this.templates[0].content,
              subjectLine: this.templates[0].subjectLine || 'Coffee Chat Request',
              purpose: 'to send a coffee chat request',
              attachments: []
            };
            this.selectedTemplate = useTemplate;
          }
        }

        // Add user data to the template
        console.log('[UIManager] Generate button clicked - this.userData:', this.userData);
        console.log('[UIManager] Generate button clicked - this.userData values:');
        console.log('  - email:', this.userData?.email);
        console.log('  - name:', this.userData?.name);
        console.log('  - firstName:', this.userData?.firstName);
        console.log('  - lastName:', this.userData?.lastName);
        if (this.userData) {
          useTemplate.userData = {
            email: this.userData.email,
            name: this.userData.name,
            firstName: this.userData.firstName,
            lastName: this.userData.lastName,
            college: this.userData.college,
            graduationYear: this.userData.graduationYear,
            experiences: this.userData.experiences,
            skills: this.userData.skills
          };
          console.log('[UIManager] useTemplate.userData created:', useTemplate.userData);
        } else {
          console.error('[UIManager] ERROR: this.userData is null/undefined!');
        }

        const response = await ProfileScraper.generateColdEmail(profileData, useTemplate);


        this.showView('#linkmail-editor');

        // Reset findEmail button to default state when editor is shown
        this.resetFindEmailButtonToDefault();

        // Set the editor title
        const editorTitle = document.getElementById('editor-title');
        if (editorTitle) {
          const pageType = window.currentPageType || 'other-profile';
          if (pageType === 'other-profile') {
            const h1Element = document.querySelector('h1');
            const fullName = h1Element?.innerText || '';
            const firstName = fullName.split(' ')[0]?.charAt(0).toUpperCase() + fullName.split(' ')[0]?.slice(1) || '';
            editorTitle.textContent = `Draft an email to ${firstName}`;
          } else {
            editorTitle.textContent = 'Draft personalized emails with AI';
          }
        }

        if (response?.email) {
          let emailContent = response.email;

          // Check if this is an error message (contains our error format)
          if (emailContent.includes('As a fallback, here\'s a simple message:')) {
            // This is an error message, display it as-is for debugging
            this.elements.emailResult.value = emailContent;
            this.elements.emailSubject.value = response.subject;
          } else {
            // This is a normal email, process it
            // Get the user's name with fallback to firstName + lastName
            const userName = this._getUserNameWithFallback();
            
            if (userName && userName !== 'undefined' && userName.trim()) {
              // Replace various name placeholders with the user's actual name
              emailContent = emailContent.replace(/\[My Name\]/g, userName);
              emailContent = emailContent.replace(/\[Your Name\]/g, userName);

              // Fix case where recipient name might have been used in signature
              const profileData = await ProfileScraper.scrapeBasicProfileData();
              if (profileData.name) {
                // Replace recipient name in signature area with user name
                const recipientName = profileData.name;
                // Look for patterns like "Best regards,\n  [RecipientName]" and replace with user name
                emailContent = emailContent.replace(
                  new RegExp(`(Best regards,\\s*\\n\\s*)(${recipientName})`, 'gi'),
                  `$1${userName}`
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
        
        // Show the "Last sent on" tooltip again after loading
        const lastEmailStatus = this.container.querySelector('#lastEmailStatus');
        if (lastEmailStatus && lastEmailStatus.textContent) {
          lastEmailStatus.classList.remove('hidden');
          lastEmailStatus.style.display = 'block';
        }
        
        // Stop loading animation
        const pointer = document.querySelector('.linkmail-pointer');
        if (pointer) {
          pointer.classList.remove('loading');
        }

        // Restore container height
        const container = document.querySelector('.linkmail-container');
        if (container) {
          container.classList.remove('compact');
        }

        // Restore template dropdown and generate button
        const templateDropdown = document.querySelector('.linkmail-template-select');
        if (templateDropdown) {
          templateDropdown.classList.remove('fade-out-up');
        }
        if (this.elements.generateButton) {
          this.elements.generateButton.classList.remove('fade-out-up');
        }

        // Restore original heading
        const titleElement = document.getElementById('title');
        if (titleElement && this.originalTitle) {
          titleElement.textContent = this.originalTitle;
        }
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

    // Removed Find Email button and its manual scraping flow

    // Find Email with Apollo button event listener
    if (this.elements.findEmailApolloButton) this.elements.findEmailApolloButton.addEventListener('click', async () => {

      // Check if authenticated
      if (!window.BackendAPI || !window.BackendAPI.isAuthenticated) {
        this.showTemporaryMessage('Please sign in to use Apollo email finding', 'error');
        return;
      }

      // Disable button and show loading state
      this.elements.findEmailApolloButton.disabled = true;
      this.elements.findEmailApolloButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" style="margin-right: 4px; animation: spin 1s linear infinite;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 11-6.219-8.56"/>
        </svg>
        Searching...
      `;

      try {
        // Get the current profile data
        const profileData = await ProfileScraper.scrapeBasicProfileData();

        // Call Apollo API via backend
        const apolloData = await window.BackendAPI.findEmailWithApollo({
          firstName: profileData?.firstName || '',
          lastName: profileData?.lastName || '',
          company: profileData?.company || '',
          linkedinUrl: window.location.href
        });


        if (apolloData && apolloData.success && apolloData.email) {
          const recipientInput = document.getElementById('recipientEmailInput');
          if (recipientInput) {
            recipientInput.value = apolloData.email;
          }

          // Hide Apollo button since we found an email
          this.elements.findEmailApolloButton.style.display = 'none';

          // Hide any existing no email found message
          this.hideNoEmailFoundMessage();

          // Show success message
          this.showTemporaryMessage('Email found with Apollo!', 'success');

          // Update Apollo usage display after successful call
          await this.updateApolloUsageDisplay();

        } else {
          // Show dismissable message instead of temporary message
          this.showNoEmailFoundMessage();
        }

      } catch (error) {
        console.error('Error in Apollo email search:', error);
        
        // Check if this is a usage limit error
        if (error.message && error.message.includes('Usage limit exceeded')) {
          this.showTemporaryMessage('You have reached your Apollo API usage limit. Please upgrade to get more calls.', 'error');
          // Update display to show limit message
          await this.updateApolloUsageDisplay();
        } else {
          this.showTemporaryMessage(error.message || 'Failed to find email with Apollo. Please try again.', 'error');
        }
      } finally {
        // Reset button state to default search icon
        this.resetFindEmailButtonToDefault();
        this.elements.findEmailApolloButton.style.display = `none`;
      }
    });

    // Replace your current sendGmailButton event listener with this
    if (this.elements.sendGmailButton) this.elements.sendGmailButton.addEventListener('click', async () => {

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

        // Start loading animation during sending
        const pointer = document.querySelector('.linkmail-pointer');
        if (pointer) {
          pointer.classList.remove('sending'); // Remove any existing sending state
          pointer.classList.add('loading');
        }

        // Shrink container height
        const container = document.querySelector('.linkmail-container');
        if (container) {
          container.classList.add('compact');
        }

        // Hide form elements with fade out animation
        const recipientInput = document.getElementById('recipientEmailInput');
        const emailSubject = document.getElementById('emailSubject');
        const emailResult = document.getElementById('emailResult');
        const copyButton = document.getElementById('copyButton');
        const emailAttachments = document.getElementById('emailAttachments');

        if (recipientInput) recipientInput.classList.add('fade-out-up');
        if (emailSubject) emailSubject.classList.add('fade-out-up');
        if (emailResult) emailResult.classList.add('fade-out-up');
        if (copyButton) copyButton.classList.add('fade-out-up');
        if (emailAttachments) emailAttachments.classList.add('fade-out-up');
        if (this.elements.sendGmailButton) {
          this.elements.sendGmailButton.classList.add('fade-out-up');
        }

        // Change heading to "Sending..."
        const titleElement = document.getElementById('editor-title');
        if (titleElement) {
          this.originalTitle = titleElement.textContent; // Store original title
          titleElement.textContent = 'Sending...';
        }

        // Get any attachments from the selected template
        const attachments = this.selectedTemplate?.attachments || [];

        // Extract contact information from current profile if available
        let contactInfo = null;
        try {
          const pageType = this.getSafePageType();
          if (pageType === 'other-profile' && window.ProfileScraper) {
            const profileData = await window.ProfileScraper.scrapeBasicProfileData();
            
            // Extract job title from headline (remove company part if present)
            let jobTitle = profileData?.headline || null;
            if (jobTitle && profileData?.company) {
              // If headline contains " at [company]", extract just the job title part
              const atIndex = jobTitle.toLowerCase().indexOf(' at ');
              if (atIndex > 0) {
                jobTitle = jobTitle.substring(0, atIndex).trim();
              }
            }
            
            // Extract profile picture URL
            let profilePictureUrl = null;
            try {
              profilePictureUrl = window.ProfileScraper.extractProfilePictureUrl();
            } catch (imgError) {
              console.warn('Failed to extract profile picture URL:', imgError);
            }
            
            contactInfo = {
              firstName: profileData?.firstName || null,
              lastName: profileData?.lastName || null,
              jobTitle: jobTitle,
              company: profileData?.company || null,
              linkedinUrl: window.location.href,
              profilePictureUrl: profilePictureUrl
            };
            
          }
        } catch (error) {
          console.warn('Failed to extract contact information:', error);
          // Continue with sending email even if contact extraction fails
        }

        // Send email with attachments and contact information
        await GmailManager.sendAndSaveEmail(email, subject, emailContent, attachments, contactInfo);

        // Clear the form
        this.elements.emailResult.value = '';
        this.elements.emailSubject.value = '';
        document.getElementById('recipientEmailInput').value = '';


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
        }

        if (splashView) {
          splashView.style.display = 'none';
        }

        if (signinView) {
          signinView.style.display = 'none';
        }

        // Trigger sending animation before showing success
        const successPointer = document.querySelector('.linkmail-pointer');
        if (successPointer) {
          successPointer.classList.remove('loading');
          successPointer.classList.add('sending');
          
          // Reset pointer after animation completes (1.2s duration)
          setTimeout(() => {
            successPointer.classList.remove('sending');
            successPointer.style.transform = 'translateY(0) scale(1)';
            successPointer.style.opacity = '1';
          }, 1200);
        }

        // Show success view
        if (successView) {
          successView.style.display = 'block';
          
          // Find and show similar people recommendations
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

        // Don't reset pointer animation here - let it stay in sending state for success screen

        // Restore container height
        const container = document.querySelector('.linkmail-container');
        if (container) {
          container.classList.remove('compact');
        }

        // Restore form elements
        const recipientInput = document.getElementById('recipientEmailInput');
        const emailSubject = document.getElementById('emailSubject');
        const emailResult = document.getElementById('emailResult');
        const copyButton = document.getElementById('copyButton');
        const emailAttachments = document.getElementById('emailAttachments');

        if (recipientInput) recipientInput.classList.remove('fade-out-up');
        if (emailSubject) emailSubject.classList.remove('fade-out-up');
        if (emailResult) emailResult.classList.remove('fade-out-up');
        if (copyButton) copyButton.classList.remove('fade-out-up');
        if (emailAttachments) emailAttachments.classList.remove('fade-out-up');
        if (this.elements.sendGmailButton) {
          this.elements.sendGmailButton.classList.remove('fade-out-up');
        }

        // Restore original heading
        const titleElement = document.getElementById('editor-title');
        if (titleElement && this.originalTitle) {
          titleElement.textContent = this.originalTitle;
        }
      }
    });

    // Retry People Search button
    if (this.elements.retryPeopleSearchButton) {
      this.elements.retryPeopleSearchButton.addEventListener('click', () => {
        this.loadPeopleSuggestions();
      });
    }
  },

  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      // Skip storage listener updates if we're in the email success state
      const successView = this.container.querySelector('#linkmail-success');
      if (successView && successView.style.display === 'block') {
        return;
      }

      if (namespace === 'local' && this.userData?.email && changes[this.userData.email]) {

        // Check current view before updating
        const currentView = this.getCurrentView();

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
          if (this.elements.findEmailApolloButton) this.elements.findEmailApolloButton.style.display = 'none';
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
        } catch (e) {
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
        if (this.elements.findEmailApolloButton) this.elements.findEmailApolloButton.style.display = 'none';
        if (data.isVerifiedContact) {
          this.showTemporaryMessage('Verified email autofilled from your contacts', 'success');
        } else {
          this.showTemporaryMessage('Email autofilled from your contacts', 'success');
        }
      } else if (!recipientInput.value) {
        // No email found through scraping or backend - check Apollo usage and show button if authenticated and within limits
        if (window.BackendAPI && window.BackendAPI.isAuthenticated) {
          if (this.elements.findEmailApolloButton && document.querySelector('#linkmail-editor').style.display === 'block') {
            // Update Apollo usage display first to determine if button should be shown
            await this.updateApolloUsageDisplay();
          }
        }
      }
    } catch (err) {
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
          // No profile setup flow: still show authenticated UI without stored profile
          const pageType = this.getSafePageType();
          const shouldShowPeopleSuggestions = pageType === 'feed' || pageType === 'own-profile';
          if (shouldShowPeopleSuggestions) {
            if (peopleSuggestionsView) {
              peopleSuggestionsView.style.display = 'block';
              this.loadPeopleSuggestions();
            }
          } else {
            if (splashView) splashView.style.display = 'flex';
          }
          const accountInfo = this.container.querySelector('.linkmail-account-info');
          const userEmailDisplay = this.container.querySelector('#user-email-display');
          if (accountInfo && this.userData?.email) {
            accountInfo.style.display = 'block';
            if (userEmailDisplay) userEmailDisplay.textContent = this.userData.email;
          }
        }
      } catch (error) {
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
        name: 'Coffee Chat Request',
        description: 'A friendly intro to chat',
        content: this.templates[0].content,
        subjectLine: this.templates[0].subjectLine || 'Coffee Chat Request',
        purpose: 'to send a coffee chat request',
        attachments: [] // Add empty attachments array
      },
      {
        id: 'job-application',
        icon: '💼',
        name: 'Inquire About Open Roles',
        description: 'A professional email for recruiting',
        content: this.templates[1].content,
        subjectLine: this.templates[1].subjectLine || 'Wondering About Potential Opportunities at [Recipient Company Name]',
        purpose: 'to send a job application',
        attachments: [] // Add empty attachments array
      }
    ];

    let allTemplates = [...defaultTemplates];

    if (this.userData && this.userData.templates && Array.isArray(this.userData.templates)) {

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

      try {
        if (!chrome.runtime?.id) {
          return;
        }

        chrome.storage.local.get([this.userData.email], (result) => {
          if (chrome.runtime.lastError) {
            return;
          }

          const storedData = result[this.userData.email];

          if (storedData && storedData.templates) {
            // Check if templates have changed by comparing lengths first (quick check)
            const currentTemplatesLength = this.userData.templates ? this.userData.templates.length : 0;
            const newTemplatesLength = storedData.templates.length;

            if (newTemplatesLength !== currentTemplatesLength) {

              // Check current UI state before updating
              const currentView = this.getCurrentView();

              this.userData = storedData;
              this.populateTemplateDropdown();

              // Preserve the current view state
              if (currentView === 'editor') {
              }
              return;
            }

            // If lengths match, do a deeper comparison
            if (currentTemplatesLength > 0) {
              const currentTemplatesJSON = JSON.stringify(this.userData.templates);
              const newTemplatesJSON = JSON.stringify(storedData.templates);

              if (currentTemplatesJSON !== newTemplatesJSON) {

                // Check current UI state before updating
                const currentView = this.getCurrentView();

                this.userData = storedData;
                this.populateTemplateDropdown();

                // Preserve the current view state
                if (currentView === 'editor') {
                }
              }
            }
          }
        });
      } catch (error) {
      }
    }
  },

  // similar person logic is in content/ui/similar.js

  // Email history logic remains here (extracted helpers used elsewhere)
  async checkLastEmailSent() {
    try {

      // Check if we're on a supported page (profile or feed)
      const currentProfileUrl = window.location.href;
      const isOnProfilePage = currentProfileUrl.includes('/in/');
      const isOnFeedPage = currentProfileUrl.includes('/feed/');
      
      if (!isOnProfilePage && !isOnFeedPage) {
        return;
      }

      // Only check email history for other-profile pages (feed page and own-profile don't have specific profile context)
      const pageType = window.currentPageType || 'other-profile';
      if (pageType !== 'other-profile') {
        return;
      }

      // Check if the UI container exists
      if (!this.container) {
        return;
      }

      // Get the last email status element
      const lastEmailStatus = this.container.querySelector('#lastEmailStatus');
      if (!lastEmailStatus) {
        return;
      }

      // Get the current LinkedIn profile name
      const profileName = document.querySelector('h1')?.innerText || '';

      // Default state
      lastEmailStatus.style.display = 'none';

      // If not authenticated, return early (don't call checkAuthStatus to avoid loops)
      if (!this.isAuthenticated || !this.userData || !this.userData.email) {
        return;
      }


      // Now we're sure we're authenticated and have user data
      // Get full user data from storage directly
      try {
        if (!chrome.runtime?.id) {
          return;
        }

        chrome.storage.local.get([this.userData.email], (result) => {
          if (chrome.runtime.lastError) {
            return;
          }

          const storedUserData = result[this.userData.email];

          if (!storedUserData || !storedUserData.sentEmails || !storedUserData.sentEmails.length) {
            return; // No emails sent yet
          }


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
            emailsToThisProfile = storedUserData.sentEmails.filter(email =>
              email.recipientName && email.recipientName.trim() === profileName.trim()
            );
          }


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
          }
        });
      } catch (error) {
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

          console.log('Templates changed in storage, updating UI');

          // Check current UI state before updating
          const currentView = this.getCurrentView();

          // Update local userData
          this.userData = newValue;

          // Update the dropdown without changing the current view
          this.populateTemplateDropdown();

          // Show a brief notification that templates were updated
          this.showTemporaryMessage('Templates updated!', 'success');

          // Preserve the current view state
          if (currentView === 'editor') {
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

      if (this.isAuthenticated && this.userData && this.userData.email) {
        // Check current UI state before refreshing
        const currentView = this.getCurrentView();

        // First try to refresh templates from backend
        this.refreshTemplatesFromBackend().then(() => {
          this.refreshUserData().then(() => {
            // Only update template dropdown, don't change the current view
            this.populateTemplateDropdown();

            // If user was in email editor or success view, preserve it
            if (currentView === 'editor' || currentView === 'success') {
              // Don't call showAuthenticatedUI as it might change the view
            } else {
              // Only refresh UI if we're not in a critical view
            }
          });
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

  // Show temporary message to user (currently disabled for debugging)
  showTemporaryMessage(message, type = 'info') {
    // Temporarily disabled - uncomment for debugging
    return;
    
    /* 
    // Create message element if it doesn't exist
    let messageEl = this.container.querySelector('#linkmail-temp-message');
    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.id = 'linkmail-temp-message';
      messageEl.className = 'linkmail-temp-message';
      messageEl.style.cssText = `
        position: absolute;
        top: 16px;
        left: 0;
        right: 0;
        padding: 12px 16px;
        border-radius: 10px;
        font-size: 9pt;
        z-index: 1000;
        box-shadow: var(--shadow);
        border: 1px solid var(--border-color);
        background-color: white;
        animation: lm-fadeIn 0.3s ease;
        transition: all 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
      `;
      this.container.style.position = 'relative';
      this.container.appendChild(messageEl);
    }

    // Set message content and keep it clean and white
    messageEl.textContent = message;
    messageEl.style.color = 'var(--text-color)';
    messageEl.style.borderColor = 'var(--border-color)';
    messageEl.style.backgroundColor = 'white';

    messageEl.style.opacity = '1';
    messageEl.style.display = 'block';

    // Hide after 3 seconds with smooth animation
    setTimeout(() => {
      if (messageEl) {
        messageEl.style.opacity = '0';
        messageEl.style.transform = 'translateY(-8px)';
        setTimeout(() => {
          if (messageEl && messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
          }
        }, 200);
      }
    }, 3000);
    */
  },

  // Show dismissable no email found message
  showNoEmailFoundMessage() {
    const messageEl = document.getElementById('noEmailFoundMessage');
    if (messageEl) {
      messageEl.style.display = 'block';
    }
  },

  // Hide dismissable no email found message
  hideNoEmailFoundMessage() {
    const messageEl = document.getElementById('noEmailFoundMessage');
    if (messageEl) {
      messageEl.style.display = 'none';
    }
  },

  // Reset findEmail button to default search icon state
  resetFindEmailButtonToDefault() {
    if (this.elements.findEmailApolloButton) {
      this.elements.findEmailApolloButton.disabled = false;
      this.elements.findEmailApolloButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>
      `;
    }
  }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.UIManager;
}
