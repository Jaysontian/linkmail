// content/ui/people.js
// Attach people suggestions utilities to window.UIManager

(function attachPeople(){
  if (!window) return;
  window.UIManager = window.UIManager || {};

  // Load people suggestions for feed page
  window.UIManager.loadPeopleSuggestions = async function loadPeopleSuggestions() {
    try {
      console.log('Loading people suggestions...');

      // Debounce: prevent rapid consecutive calls
      if (this._loadPeopleSuggestionsTimeout) {
        clearTimeout(this._loadPeopleSuggestionsTimeout);
      }
      await new Promise(resolve => {
        this._loadPeopleSuggestionsTimeout = setTimeout(resolve, 200);
      });

      // Show loading state
      const loadingEl = this.container.querySelector('#people-suggestions-loading');
      const errorEl = this.container.querySelector('#people-suggestions-error');
      const containerEl = this.container.querySelector('#suggested-people-container');

      if (loadingEl) loadingEl.style.display = 'block';
      if (errorEl) errorEl.style.display = 'none';
      if (containerEl) containerEl.innerHTML = '';

      // Get user profile information for Apollo search
      const userProfileData = await this.getUserProfileDataForSearch();
      
      if (!userProfileData) {
        this.showPeopleSuggestionsError('Unable to load your profile information');
        return;
      }

      console.log('User profile data for Apollo search:', userProfileData);

      // Caching: use cached suggestions if fresh
      const cacheKey = `peopleSuggestions:${this.userData.email}`;
      const now = Date.now();
      const maxAgeMs = 2 * 60 * 60 * 1000; // 2 hours - longer cache to reduce Apollo API calls
      try {
        const stored = await new Promise(resolve => chrome.storage.local.get([cacheKey], r => resolve(r[cacheKey])));
        if (stored && stored.timestamp && Array.isArray(stored.suggestions) && (now - stored.timestamp) < maxAgeMs) {
          console.log('Using cached people suggestions');
          if (loadingEl) loadingEl.style.display = 'none';
          this.displayPeopleSuggestions(stored.suggestions.slice(0, 3));
          return;
        }
      } catch (e) {
        console.log('Cache read error (non-fatal):', e);
      }

      // Call Apollo People Search API
      const searchResult = await this.findPeopleUsingApollo(userProfileData);
      
      if (loadingEl) loadingEl.style.display = 'none';

      if (searchResult.success && searchResult.allSuggestions && searchResult.allSuggestions.length > 0) {
        const topThree = searchResult.allSuggestions.slice(0, 3);
        // Write to cache
        try {
          await new Promise(resolve => chrome.storage.local.set({ [cacheKey]: { suggestions: topThree, timestamp: Date.now() } }, resolve));
        } catch (e) {
          console.log('Cache write error (non-fatal):', e);
        }
        this.displayPeopleSuggestions(topThree); // Show top 3
      } else {
        const errorMessage = searchResult.error || 'No relevant people found at the moment';
        this.showPeopleSuggestionsError(errorMessage);
      }

    } catch (error) {
      console.error('Error loading people suggestions:', error);
      const loadingEl = this.container.querySelector('#people-suggestions-loading');
      if (loadingEl) loadingEl.style.display = 'none';
      this.showPeopleSuggestionsError('Failed to load suggestions. Please try again.');
    }
  };

  // Get user profile data for Apollo search
  window.UIManager.getUserProfileDataForSearch = async function getUserProfileDataForSearch() {
    try {
      // Get user data from storage which contains their bio information
      if (!this.userData || !this.userData.email) {
        console.log('No user data available for search');
        return null;
      }

      // Extract useful information from user data
      const userProfile = {
        name: this.userData.name || '',
        email: this.userData.email,
        college: this.userData.college || '',
        graduationYear: this.userData.graduationYear || '',
        skills: this.userData.skills || [],
        experiences: this.userData.experiences || []
      };

      // Derive company and job title from most recent experience
      let company = '';
      let headline = '';
      
      if (userProfile.experiences && userProfile.experiences.length > 0) {
        const mostRecentExp = userProfile.experiences[0]; // Assuming first is most recent
        company = mostRecentExp.company || '';
        headline = mostRecentExp.position || '';
      }

      // If no experience, try to use college information
      if (!company && userProfile.college) {
        company = userProfile.college;
        headline = 'Student'; // Default headline for students
      }

      return {
        name: userProfile.name,
        company: company,
        headline: headline,
        location: '', // We don't have location info from bio setup
        linkedinUrl: this.userData.linkedinUrl || '', // Use the user's LinkedIn URL from profile
        isUserProfile: true // Flag to indicate this is the user's own profile
      };

    } catch (error) {
      console.error('Error getting user profile data for search:', error);
      return null;
    }
  };

  // Find people using Apollo API (similar to existing implementation but for user's profile)
  window.UIManager.findPeopleUsingApollo = async function findPeopleUsingApollo(userProfileData) {
    try {
      console.log('Finding people with Apollo People Search API for user:', userProfileData);

      return new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'findSimilarPeople',
          contactedPersonData: userProfileData,
          options: { maxResults: 3 } // Optimize feed page to use early exit
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error in people search:', chrome.runtime.lastError);
            resolve({
              success: false,
              error: 'Extension error occurred'
            });
            return;
          }

          console.log('Apollo People Search response for user:', response);
          resolve(response);
        });
      });
    } catch (error) {
      console.error('Error in findPeopleUsingApollo:', error);
      return {
        success: false,
        error: 'Failed to connect to Apollo People Search API'
      };
    }
  };

  // Display people suggestions in the UI
  window.UIManager.displayPeopleSuggestions = function displayPeopleSuggestions(suggestions) {
    try {
      console.log('Displaying people suggestions:', suggestions);

      const containerEl = this.container.querySelector('#suggested-people-container');
      if (!containerEl) {
        console.error('Suggested people container not found');
        return;
      }

      // Clear existing content
      containerEl.innerHTML = '';

      suggestions.forEach((person, index) => {
        const personCard = this.createPersonCard(person, index);
        containerEl.appendChild(personCard);
      });

      console.log('People suggestions displayed successfully');

    } catch (error) {
      console.error('Error displaying people suggestions:', error);
      this.showPeopleSuggestionsError('Error displaying suggestions');
    }
  };

  // Create a person card element
  window.UIManager.createPersonCard = function createPersonCard(person, index) {
    const card = document.createElement('div');
    card.className = 'suggested-person-card';
    card.style.cssText = `
      background: #f8f9fa;
      border: 1px solid #e1e5e9;
      border-radius: 8px;
      padding: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    // Generate avatar initials
    const name = person.name || person.first_name + ' ' + person.last_name || 'Unknown';
    const initials = name.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase();

    // Create display info
    const title = person.title || person.headline || 'No title available';
    const company = person.organization?.name || person.organization_name || '';
    const displayTitle = company ? `${title} at ${company}` : title;

    // Set reason text
    let reasonText = '';
    switch (person.similarity_reason) {
      case 'same_company_and_role':
        reasonText = '🎯 Same company & role';
        break;
      case 'same_company':
        reasonText = '🏢 Same company';
        break;
      case 'same_role':
        reasonText = '💼 Same role';
        break;
      default:
        reasonText = '🔍 Relevant connection';
    }

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 40px; height: 40px; border-radius: 50%; background: #0066cc; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0;">
          ${initials}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 13px; color: #333; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${name}
          </div>
          <div style="font-size: 11px; color: #666; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${displayTitle}
          </div>
          <div style="font-size: 10px; color: #0066cc; font-weight: 500;">
            ${reasonText}
          </div>
        </div>
        <div style="color: #0066cc; font-size: 14px; flex-shrink: 0;">
          →
        </div>
      </div>
    `;

    // Add click handler to navigate to LinkedIn profile
    card.addEventListener('click', () => {
      if (person.linkedin_url) {
        console.log('Navigating to LinkedIn profile:', person.linkedin_url);
        window.open(person.linkedin_url, '_blank');
      } else {
        console.warn('No LinkedIn URL available for person:', person.name);
        this.showTemporaryMessage('LinkedIn profile not available', 'error');
      }
    });

    // Add hover effects
    card.addEventListener('mouseenter', () => {
      card.style.backgroundColor = '#e8f4f8';
      card.style.transform = 'translateY(-1px)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.backgroundColor = '#f8f9fa';
      card.style.transform = 'translateY(0)';
    });

    return card;
  };

  // Show error state for people suggestions
  window.UIManager.showPeopleSuggestionsError = function showPeopleSuggestionsError(errorMessage) {
    const loadingEl = this.container.querySelector('#people-suggestions-loading');
    const errorEl = this.container.querySelector('#people-suggestions-error');
    const errorTextEl = errorEl?.querySelector('p');

    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'block';
    if (errorTextEl) errorTextEl.textContent = errorMessage;
  };
})();

// Export for tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}


