// content/ui/people.js
// Attach people suggestions utilities to window.UIManager

(function attachPeople(){
  if (!window) return;
  window.UIManager = window.UIManager || {};

  // Load people suggestions for feed page
  window.UIManager.loadPeopleSuggestions = async function loadPeopleSuggestions() {
    try {

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

      // Wire search input handlers for real-time search
      this.attachPeopleSearchHandlers();

      // Get user profile information for suggestions (Apollo removed)
      const userProfileData = await this.getUserProfileDataForSearch();
      
      if (!userProfileData) {
        // Profile data not available, but continue with search functionality
        console.log('Profile data not available for suggestions');
      }


      // Caching: use cached suggestions if fresh
      const cacheKey = `peopleSuggestions:${this.userData.email}`;
      const now = Date.now();
      const maxAgeMs = 2 * 60 * 60 * 1000;
      try {
        const stored = await new Promise(resolve => chrome.storage.local.get([cacheKey], r => resolve(r[cacheKey])));
        if (stored && stored.timestamp && Array.isArray(stored.suggestions) && (now - stored.timestamp) < maxAgeMs) {
          if (loadingEl) loadingEl.style.display = 'none';
          this.displayPeopleSuggestions(stored.suggestions.slice(0, 3));
          return;
        }
      } catch (e) {
      }

      // Similar people search disabled (no results fetched)
      const searchResult = { success: false, error: 'Similar people search disabled' };
      
      if (loadingEl) loadingEl.style.display = 'none';

      if (searchResult.success && searchResult.allSuggestions && searchResult.allSuggestions.length > 0) {
        const topThree = searchResult.allSuggestions.slice(0, 3);
        // Write to cache
        try {
          await new Promise(resolve => chrome.storage.local.set({ [cacheKey]: { suggestions: topThree, timestamp: Date.now() } }, resolve));
        } catch (e) {
        }
        this.displayPeopleSuggestions(topThree); // Show top 3
      } else {
        // Don't show error if similar people search is disabled - just hide the error section silently
        if (searchResult.error === 'Similar people search disabled') {
          const errorEl = this.container.querySelector('#people-suggestions-error');
          if (errorEl) errorEl.style.display = 'none';
        } else {
          const errorMessage = searchResult.error || 'No relevant people found at the moment';
          this.showPeopleSuggestionsError(errorMessage);
        }
      }

    } catch (error) {
      console.error('Error loading people suggestions:', error);
      const loadingEl = this.container.querySelector('#people-suggestions-loading');
      if (loadingEl) loadingEl.style.display = 'none';
      this.showPeopleSuggestionsError('Failed to load suggestions. Please try again.');
    }
  };

  // Note: Dropdown-related functions removed since we now use text inputs for real-time search

  // Attach real-time search behavior for people search
  window.UIManager.attachPeopleSearchHandlers = function attachPeopleSearchHandlers() {
    try {
      const jobTitleInput = this.container?.querySelector('#jobTitleFilter');
      const companyInput = this.container?.querySelector('#companyFilter');
      const resultsContainer = this.container?.querySelector('#people-search-results');
      if (!jobTitleInput || !companyInput || !resultsContainer) return;

      // Initialize autocomplete for job title and company fields
      try {
        if (window.UIManager.initAutocomplete) {
          // Initialize autocomplete for job title field
          window.UIManager.initAutocomplete(jobTitleInput, 'jobTitle', {
            minLength: 1,
            maxSuggestions: 10,
            debounceMs: 300
          });

          // Initialize autocomplete for company field
          window.UIManager.initAutocomplete(companyInput, 'company', {
            minLength: 1,
            maxSuggestions: 10,
            debounceMs: 300
          });
        }
      } catch (autocompleteError) {
        console.error('Failed to initialize autocomplete:', autocompleteError);
      }

      // Helper to render results
      const renderResults = (results) => {
        resultsContainer.innerHTML = '';
        if (!Array.isArray(results) || results.length === 0) {
          const empty = document.createElement('div');
          empty.style.cssText = 'font-size: 11px; color: #666;';
          empty.textContent = 'No results found. Try entering both a job title and company.';
          resultsContainer.appendChild(empty);
          return;
        }
        results.slice(0, 3).forEach((person) => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; border:1px solid #e1e5e9; border-radius:6px; padding:8px; background:white; cursor:' + (person.linkedinUrl ? 'pointer' : 'default') + '; transition: background-color 0.2s;';
          
          // Add hover effect
          row.addEventListener('mouseenter', () => {
            if (person.linkedinUrl) {
              row.style.backgroundColor = '#f8f9fa';
            }
          });
          row.addEventListener('mouseleave', () => {
            row.style.backgroundColor = 'white';
          });

          const name = `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Unknown';
          const title = person.jobTitle || '';
          const company = person.company || '';
          const left = document.createElement('div');
          left.style.cssText = 'display:flex; flex-direction:column; gap:2px;';
          const nameEl = document.createElement('div');
          nameEl.style.cssText = 'font-weight:600; font-size: 12px; color:#333;';
          nameEl.textContent = name;
          const infoEl = document.createElement('div');
          infoEl.style.cssText = 'font-size: 11px; color:#666;';
          infoEl.textContent = [title, company].filter(Boolean).join(' at ');
          left.appendChild(nameEl);
          left.appendChild(infoEl);
          row.appendChild(left);
          
          // Add arrow indicator for clickable items
          if (person.linkedinUrl) {
            const arrow = document.createElement('div');
            arrow.style.cssText = 'color: #0066cc; font-size: 16px; flex-shrink: 0;';
            arrow.textContent = '→';
            row.appendChild(arrow);
            
            row.addEventListener('click', () => {
              window.location.href = person.linkedinUrl;
            });
          }
          
          resultsContainer.appendChild(row);
        });
      };

      // Debounce search function
      let searchTimeout = null;
      let lastKey = '';
      
      const doSearch = async () => {
        if (!window.BackendAPI || !BackendAPI.isAuthenticated) {
          renderResults([]);
          return;
        }
        
        const jobTitle = jobTitleInput.value.trim();
        const company = companyInput.value.trim();
        
        // Clear results if either field is empty
        if (!jobTitle || !company) {
          resultsContainer.innerHTML = '';
          return;
        }
        
        const key = `${jobTitle}|||${company}`;
        if (key === lastKey) return;
        lastKey = key;

        // Show loading state
        resultsContainer.innerHTML = '<div style="font-size:11px; color:#666;">Searching...</div>';
        
        try {
          const { results } = await BackendAPI.searchContacts(jobTitle, company);
          renderResults(results);
        } catch (error) {
          console.error('People search failed:', error);
          const err = document.createElement('div');
          err.style.cssText = 'font-size: 11px; color: #e74c3c;';
          err.textContent = error?.message || 'Search failed';
          resultsContainer.innerHTML = '';
          resultsContainer.appendChild(err);
        }
      };

      // Add real-time search on input change with debouncing
      const handleInput = () => {
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }
        searchTimeout = setTimeout(doSearch, 500); // 500ms debounce
      };

      jobTitleInput.addEventListener('input', handleInput);
      companyInput.addEventListener('input', handleInput);

      // Also trigger search on Enter key
      const handleEnter = (e) => {
        if (e.key === 'Enter') {
          if (searchTimeout) {
            clearTimeout(searchTimeout);
          }
          doSearch();
        }
      };

      jobTitleInput.addEventListener('keydown', handleEnter);
      companyInput.addEventListener('keydown', handleEnter);

    } catch (e) {
      console.error('Failed to attach people search handlers:', e);
    }
  };

  // Get user profile data for suggestions
  window.UIManager.getUserProfileDataForSearch = async function getUserProfileDataForSearch() {
    try {
      // Get user data from storage which contains their bio information
      if (!this.userData || !this.userData.email) {
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

  // Apollo People Search removed
  window.UIManager.findPeopleUsingApollo = async function findPeopleUsingApollo() {
    return { success: false, error: 'Similar people search disabled' };
  };

  // Display people suggestions in the UI
  window.UIManager.displayPeopleSuggestions = function displayPeopleSuggestions(suggestions) {
    try {

      const containerEl = this.container.querySelector('#suggested-people-container');
      if (!containerEl) {
        console.error('Suggested people container not found');
        return;
      }

      // Clear existing content
      containerEl.innerHTML = '';

      suggestions.forEach((person) => {
        const personCard = this.createPersonCard(person);
        containerEl.appendChild(personCard);
      });


    } catch (error) {
      console.error('Error displaying people suggestions:', error);
      this.showPeopleSuggestionsError('Error displaying suggestions');
    }
  };

  // Create a person card element
  window.UIManager.createPersonCard = function createPersonCard(person) {
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


