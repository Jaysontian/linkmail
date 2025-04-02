//email-finder.js

window.EmailFinder = {
  // Last found email is cached to avoid opening the overlay multiple times
  _lastFoundEmail: null,
  _lastProfileUrl: null,
  
  async checkContactInfo() {
    const contactButton = document.querySelector('a[href*="contact-info"]');
    if (!contactButton) return null;

    // Create and append a style element to hide the modal
    const hideModalStyle = document.createElement('style');
    hideModalStyle.id = 'linkmail-hide-modal-style';
    hideModalStyle.textContent = `
      .artdeco-modal__overlay {
        opacity: 0 !important;
        pointer-events: auto !important; /* Keep pointer events to allow interaction */
      }
      .artdeco-modal {
        opacity: 0 !important;
        pointer-events: auto !important;
      }
    `;
    document.head.appendChild(hideModalStyle);

    // Click the contact button to open the overlay (now invisible)
    contactButton.click();
    
    let modalContent = null;
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      modalContent = document.querySelector([
        'div[aria-label="Contact info"] .artdeco-modal__content',
        '.pv-contact-info__contact-type',
        '.pv-profile-section__section-info',
        '.artdeco-modal__content'
      ].join(','));

      if (modalContent) break;
    }

    let email = null;
    if (modalContent) {
      const allText = modalContent.innerText || modalContent.textContent;
      console.log('Modal content found:', allText);
      
      email = Utils.extractEmail(allText);
      console.log('Email found:', email);
      
      const closeButton = document.querySelector([
        'button[aria-label="Dismiss"]',
        '.artdeco-modal__dismiss',
        '.artdeco-modal__close'
      ].join(','));
      
      if (closeButton) closeButton.click();
    }
    
    // Remove the style that was hiding the modal
    const styleElement = document.getElementById('linkmail-hide-modal-style');
    if (styleElement) {
      styleElement.remove();
    }

    // Cache the found email
    if (email) {
      this._lastFoundEmail = email;
      this._lastProfileUrl = window.location.href;
    }
    
    return email;
  },

  checkAboutSection() {
    const aboutSection = document.getElementById('about')?.closest('section');
    if (!aboutSection) return null;
    return Utils.extractEmail(aboutSection.textContent);
  },

  async findLinkedInEmail(useCache = true) {
    // Check if we have a cached email for this profile
    if (useCache && this._lastFoundEmail && this._lastProfileUrl === window.location.href) {
      console.log('Using cached email:', this._lastFoundEmail);
      return this._lastFoundEmail;
    }
    
    // Try to find email in the about section first (no overlay needed)
    const aboutEmail = this.checkAboutSection();
    if (aboutEmail) {
      this._lastFoundEmail = aboutEmail;
      this._lastProfileUrl = window.location.href;
      return aboutEmail;
    }
    
    // If not found, check contact info (opens overlay)
    const contactInfoEmail = await this.checkContactInfo();
    return contactInfoEmail;
  },
  
  // Get email - will only open the overlay if no cached email is available
  async getEmail(forceRefresh = false) {
    if (!forceRefresh && this._lastFoundEmail && this._lastProfileUrl === window.location.href) {
      return this._lastFoundEmail;
    }
    
    return await this.findLinkedInEmail(false);
  },
  
  // Clear the cached email
  clearCachedEmail() {
    this._lastFoundEmail = null;
    this._lastProfileUrl = null;
  },
  
  // New method to find email using Apollo
  async findEmailWithApollo() {
    try {
      // Check if Apollo is authenticated
      if (!window.ApolloClient || !window.ApolloClient.isAuthenticated()) {
        return { success: false, error: "Apollo not authenticated" };
      }
      
      // Get profile data for Apollo search
      // Don't open contact overlay again if we already have basic profile data
      const profileData = await window.ProfileScraper.scrapeBasicProfileData();
      if (!profileData || !profileData.name) {
        return { success: false, error: "Couldn't retrieve profile data" };
      }
      
      // Extract first and last name
      const nameParts = profileData.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      
      // Format data for Apollo API
      const apolloSearchData = {
        firstName: firstName,
        lastName: lastName,
        name: profileData.name,
        linkedinUrl: window.location.href
      };
      
      // Use Apollo client to search for email
      const email = await window.ApolloClient.findEmail(apolloSearchData);
      
      if (email) {
        // Cache the found email from Apollo
        this._lastFoundEmail = email;
        this._lastProfileUrl = window.location.href;
        
        return { 
          success: true, 
          email: email 
        };
      } else {
        return { 
          success: false, 
          error: "No email found with Apollo" 
        };
      }
    } catch (error) {
      console.error('Error finding email with Apollo:', error);
      return { 
        success: false, 
        error: error.message || "Error using Apollo to find email" 
      };
    }
  }
};