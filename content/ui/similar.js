// content/ui/similar.js
// Attach similar-person suggestion utilities to window.UIManager

(function attachSimilarPerson(){
  if (!window) return;
  window.UIManager = window.UIManager || {};

  // Find and show similar people recommendations based on recipient's job title and company
  window.UIManager.findAndShowSimilarPerson = async function findAndShowSimilarPerson() {
    try {
      const currentLinkedInUrl = window.location.href;
      
      if (!window.BackendAPI || !window.BackendAPI.isAuthenticated) {
        console.log('Cannot find similar people: not authenticated');
        this.hideSimilarPeopleSection();
        return;
      }

      // Get the recipient's job title, company, and category from the database using LinkedIn URL
      let jobTitle = '';
      let company = '';
      let category = '';
      
      try {
        const contactData = await window.BackendAPI.getEmailByLinkedIn(currentLinkedInUrl);
        if (contactData && contactData.found) {
          jobTitle = contactData.jobTitle || '';
          company = contactData.company || '';
          category = contactData.category || '';
          console.log('Found recipient data from database:', { jobTitle, company, category });
        }
      } catch (error) {
        console.log('Could not get recipient data from database, trying profile scraping:', error);
      }

      // If we couldn't get data from database, try scraping the current profile
      if (!jobTitle || !company) {
        try {
          const profileData = await ProfileScraper.scrapeBasicProfileData();
          jobTitle = jobTitle || profileData.jobTitle || '';
          company = company || profileData.company || '';
          console.log('Scraped profile data:', { jobTitle, company });
        } catch (error) {
          console.log('Could not scrape profile data:', error);
        }
      }

      // If we still don't have both job title and company, hide the section
      if (!jobTitle || !company) {
        console.log('Missing job title or company for recommendations:', { jobTitle, company, category });
        this.hideSimilarPeopleSection();
        return;
      }

      // Search for similar contacts using the new prioritized logic
      try {
        let searchResults = null;
        
        // Use new prioritized search if we have category, otherwise fall back to old logic
        if (category) {
          console.log('Using prioritized search with category:', { category, company });
          searchResults = await window.BackendAPI.searchSimilarContacts(category, company);
        } else {
          console.log('No category available, falling back to job title search:', { jobTitle, company });
          searchResults = await window.BackendAPI.searchContacts(jobTitle, company);
        }
        
        if (searchResults && searchResults.results && searchResults.results.length > 0) {
          // Take up to 3 recommendations
          const recommendations = searchResults.results.slice(0, 3);
          
          if (recommendations.length > 0) {
            this.showSimilarPeopleRecommendations(recommendations, jobTitle, company, category);
          } else {
            console.log('No recommendations found');
            this.hideSimilarPeopleSection();
          }
        } else {
          console.log('No search results found');
          this.hideSimilarPeopleSection();
        }
      } catch (error) {
        console.error('Error searching for similar contacts:', error);
        this.hideSimilarPeopleSection();
      }

    } catch (error) {
      console.error('Error finding similar people:', error);
      this.hideSimilarPeopleSection();
    }
  };

  // Apollo People Search removed
  window.UIManager.findSimilarPeopleUsingApollo = async function findSimilarPeopleUsingApollo() {
    return { success: false, error: 'Similar people search disabled' };
  };

  // Show upgrade message when Apollo API access is denied
  window.UIManager.showSimilarPersonUpgradeMessage = function showSimilarPersonUpgradeMessage() {
    try {
      const similarPersonSection = this.container?.querySelector('#similar-person-section');
      const similarPersonCard = this.container?.querySelector('#similar-person-card');
      if (!similarPersonSection || !similarPersonCard) {
        console.error('Similar person UI elements not found for upgrade message');
        return;
      }
      similarPersonCard.innerHTML = `
        <div style="text-align: center; padding: 8px;">
          <div style="font-size: 16px; margin-bottom: 6px;">🚀</div>
          <div style="font-weight: 600; font-size: 13px; color: #333; margin-bottom: 4px;">Similar people suggestions are unavailable</div>
          <div style="font-size: 11px; color: #666; margin-bottom: 8px;">This feature has been removed.</div>
        </div>
      `;
      similarPersonCard.onclick = null;
      similarPersonCard.style.cursor = 'default';
      similarPersonSection.style.display = 'block';
    } catch (error) {
      console.error('Error showing Apollo upgrade message:', error);
    }
  };

  // Show similar person suggestion in the UI
  window.UIManager.showSimilarPersonSuggestion = function showSimilarPersonSuggestion(suggestion, hasMajorFiltering = false) {
    try {
      const similarPersonSection = this.container?.querySelector('#similar-person-section');
      const similarPersonCard = this.container?.querySelector('#similar-person-card');
      const avatarElement = this.container?.querySelector('#similar-person-avatar');
      const nameElement = this.container?.querySelector('#similar-person-name');
      const titleElement = this.container?.querySelector('#similar-person-title');
      const reasonElement = this.container?.querySelector('#similar-person-reason');
      if (!similarPersonSection || !similarPersonCard || !avatarElement || !nameElement || !titleElement || !reasonElement) {
        console.error('Similar person UI elements not found');
        return;
      }
      const name = suggestion.name || suggestion.first_name + ' ' + suggestion.last_name || 'Unknown';
      const title = suggestion.title || suggestion.headline || 'No title available';
      const company = suggestion.organization?.name || suggestion.organization_name || '';
      const displayTitle = company ? `${title} at ${company}` : title;
      const initials = name.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase();
      let reasonText = '';
      switch (suggestion.similarity_reason) {
        case 'same_company_and_role': reasonText = '🎯 Same company & role'; break;
        case 'same_company': reasonText = '🏢 Same company'; break;
        case 'same_role': reasonText = '💼 Same role'; if (hasMajorFiltering) { reasonText += ' (filtered search)'; } break;
        default: reasonText = '🔍 Similar profile';
      }
      avatarElement.textContent = initials;
      nameElement.textContent = name;
      titleElement.textContent = displayTitle;
      reasonElement.textContent = reasonText;
      similarPersonCard.onclick = () => {
        if (suggestion.linkedin_url) {
          window.open(suggestion.linkedin_url, '_blank');
        } else {
          console.warn('No LinkedIn URL available for suggestion');
        }
      };
      similarPersonCard.addEventListener('mouseenter', () => {
        similarPersonCard.style.backgroundColor = '#f0f4f8';
        similarPersonCard.style.transform = 'translateY(-1px)';
      });
      similarPersonCard.addEventListener('mouseleave', () => {
        similarPersonCard.style.backgroundColor = 'transparent';
        similarPersonCard.style.transform = 'translateY(0)';
      });
      similarPersonSection.style.display = 'block';
    } catch (error) {
      console.error('Error showing similar person suggestion:', error);
    }
  };

  // Hide the similar people section
  window.UIManager.hideSimilarPeopleSection = function hideSimilarPeopleSection() {
    const similarPeopleSection = this.container?.querySelector('#similar-people-section');
    if (similarPeopleSection) {
      similarPeopleSection.style.display = 'none';
    }
  };

  // Show multiple similar people recommendations
  window.UIManager.showSimilarPeopleRecommendations = function showSimilarPeopleRecommendations(recommendations, searchJobTitle, searchCompany, searchCategory) {
    try {
      const similarPeopleSection = this.container?.querySelector('#similar-people-section');
      const similarPeopleContainer = this.container?.querySelector('#similar-people-container');
      
      if (!similarPeopleSection || !similarPeopleContainer) {
        console.error('Similar people UI elements not found');
        return;
      }

      // Clear previous recommendations
      similarPeopleContainer.innerHTML = '';

      // Create recommendation cards
      recommendations.forEach((person, index) => {
        const card = this.createRecommendationCard(person, searchJobTitle, searchCompany, searchCategory);
        similarPeopleContainer.appendChild(card);
      });

      // Show the section
      similarPeopleSection.style.display = 'block';
      
      console.log(`Showing ${recommendations.length} recommendations for ${searchJobTitle} at ${searchCompany}${searchCategory ? ` (category: ${searchCategory})` : ''}`);
    } catch (error) {
      console.error('Error showing similar people recommendations:', error);
    }
  };

  // Create a recommendation card for a person
  window.UIManager.createRecommendationCard = function createRecommendationCard(person, searchJobTitle, searchCompany, searchCategory) {
    const card = document.createElement('div');
    card.style.cssText = `
      cursor: pointer;
      transition: all 0.2s ease;
      background: white;
      border: 1px solid #e1e5e9;
      border-radius: 6px;
      padding: 10px;
    `;

    const firstName = person.firstName || '';
    const lastName = person.lastName || '';
    const name = `${firstName} ${lastName}`.trim() || 'Unknown';
    const initials = name.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase();
    
    const jobTitle = person.jobTitle || 'No title available';
    const company = person.company || '';
    const displayTitle = company ? `${jobTitle} at ${company}` : jobTitle;
    
    // Determine similarity reason based on matchType from backend
    let reasonText = '🔍 Similar profile';
    if (person.matchType) {
      switch (person.matchType) {
        case 'category_and_company':
          reasonText = '🎯 Same category & company';
          break;
        case 'company_only':
          reasonText = '🏢 Same company';
          break;
        case 'category_only':
          reasonText = '💼 Same category';
          break;
        default:
          reasonText = '🔍 Similar profile';
      }
    } else {
      // Fallback to old logic if no matchType available
      const isJobTitleMatch = jobTitle.toLowerCase().includes(searchJobTitle.toLowerCase()) || 
                             searchJobTitle.toLowerCase().includes(jobTitle.toLowerCase());
      const isCompanyMatch = company.toLowerCase().includes(searchCompany.toLowerCase()) || 
                            searchCompany.toLowerCase().includes(company.toLowerCase());
      
      if (isJobTitleMatch && isCompanyMatch) {
        reasonText = '🎯 Same company & role';
      } else if (isCompanyMatch) {
        reasonText = '🏢 Same company';
      } else if (isJobTitleMatch) {
        reasonText = '💼 Same role';
      }
    }

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: #0066cc; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0;">
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

    // Add click handler to navigate to LinkedIn profile in same tab
    card.onclick = () => {
      if (person.linkedinUrl && person.linkedinUrl.trim()) {
        // Navigate in the same tab
        window.location.href = person.linkedinUrl;
      } else {
        console.warn('No LinkedIn URL available for recommendation:', person);
      }
    };

    // Add hover effects
    card.addEventListener('mouseenter', () => {
      card.style.backgroundColor = '#f0f4f8';
      card.style.transform = 'translateY(-1px)';
      card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.backgroundColor = 'white';
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
    });

    return card;
  };
})();

// Export for tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}



