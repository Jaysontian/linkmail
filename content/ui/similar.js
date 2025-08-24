// content/ui/similar.js
// Attach similar-person suggestion utilities to window.UIManager

(function attachSimilarPerson(){
  if (!window) return;
  window.UIManager = window.UIManager || {};

  // Find and show similar person suggestion
  window.UIManager.findAndShowSimilarPerson = async function findAndShowSimilarPerson() {
    try {
      console.log('Finding similar person suggestion...');

      // Get the current profile data
      const profileData = await ProfileScraper.scrapeBasicProfileData();
      console.log('Current profile data for similar person search:', profileData);

      // Call Apollo People Search API
      const searchResult = await this.findSimilarPeopleUsingApollo(profileData);
      console.log('Similar person search result:', searchResult);

      // Log debug information if available
      if (searchResult.debug) {
        console.log('🔍 === APOLLO SEARCH DEBUG INFO ===');
        console.log('🏢 Original company:', searchResult.debug.originalCompany);
        console.log('🌐 Extracted domain:', searchResult.debug.extractedDomain);
        console.log('💼 Original job title:', searchResult.debug.originalJobTitle);
        console.log('📝 Normalized job title:', searchResult.debug.normalizedJobTitle);
        console.log('📊 Search results by priority:');
        console.log('  🎯 Same company + role:', searchResult.debug.searchResults.sameCompanyAndRole);
        console.log('  🏢 Same company only:', searchResult.debug.searchResults.sameCompanyOnly);
        console.log('  💼 Same role only:', searchResult.debug.searchResults.sameRoleOnly);
        console.log('✨ Final suggestions:');
        searchResult.debug.finalSuggestions.forEach((suggestion, index) => {
          console.log(`  ${index + 1}. ${suggestion.name} - ${suggestion.title} at ${suggestion.company} (${suggestion.reason})`);
        });
        if (searchResult.debug.majorCompanyFiltering && searchResult.debug.majorCompanyFiltering.applied) {
          console.log('📊 MAJOR COMPANY FILTERING INFO:');
          console.log(`   Company: ${searchResult.debug.majorCompanyFiltering.company}`);
          console.log(`   Reason: ${searchResult.debug.majorCompanyFiltering.reason}`);
          console.log('   Note: Applied location and seniority filters to narrow search results');
        }
        console.log('🔍 === END DEBUG INFO ===');
      }

      if (searchResult.success && searchResult.suggestion) {
        const hasMajorFiltering = searchResult.debug && 
                                  searchResult.debug.majorCompanyFiltering && 
                                  searchResult.debug.majorCompanyFiltering.applied;
        this.showSimilarPersonSuggestion(searchResult.suggestion, hasMajorFiltering);
      } else {
        console.log('No similar person found or error occurred:', searchResult.error);
        if (searchResult.errorType === 'api_access_denied') {
          this.showSimilarPersonUpgradeMessage();
        } else {
          const similarPersonSection = this.container?.querySelector('#similar-person-section');
          if (similarPersonSection) similarPersonSection.style.display = 'none';
        }
      }

    } catch (error) {
      console.error('Error finding similar person:', error);
      const similarPersonSection = this.container?.querySelector('#similar-person-section');
      if (similarPersonSection) similarPersonSection.style.display = 'none';
    }
  };

  // Call Apollo People Search API through background script
  window.UIManager.findSimilarPeopleUsingApollo = async function findSimilarPeopleUsingApollo(contactedPersonData) {
    try {
      console.log('📡 Calling Apollo People Search API through background script');
      console.log('📡 Sending profile data:', contactedPersonData);

      return new Promise((resolve) => {
        console.log('📡 Sending Chrome runtime message...');
        chrome.runtime.sendMessage({
          action: 'findSimilarPeople',
          contactedPersonData: contactedPersonData,
          options: { maxResults: 1 }
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('❌ Chrome runtime error in similar people search:', chrome.runtime.lastError);
            resolve({ success: false, error: 'Extension error occurred' });
            return;
          }
          console.log('📡 Received Apollo People Search response:', response);
          if (response && response.debug) {
            console.log('📡 Background script debug info received:');
            console.log('   - Original company:', response.debug.originalCompany);
            console.log('   - Extracted domain:', response.debug.extractedDomain);
            console.log('   - Search results:', response.debug.searchResults);
            if (response.debug.majorCompanyFiltering && response.debug.majorCompanyFiltering.applied) {
              console.log('📊 MAJOR COMPANY FILTERING APPLIED');
              console.log('   - Company:', response.debug.majorCompanyFiltering.company);
              console.log('   - Reason:', response.debug.majorCompanyFiltering.reason);
            }
          } else {
            console.log('📡 No debug info in response');
          }
          resolve(response);
        });
      });
    } catch (error) {
      console.error('❌ Error in findSimilarPeopleUsingApollo:', error);
      return { success: false, error: 'Failed to connect to Apollo People Search API' };
    }
  };

  // Show upgrade message when Apollo API access is denied
  window.UIManager.showSimilarPersonUpgradeMessage = function showSimilarPersonUpgradeMessage() {
    try {
      console.log('Showing Apollo upgrade message');
      const similarPersonSection = this.container?.querySelector('#similar-person-section');
      const similarPersonCard = this.container?.querySelector('#similar-person-card');
      if (!similarPersonSection || !similarPersonCard) {
        console.error('Similar person UI elements not found for upgrade message');
        return;
      }
      similarPersonCard.innerHTML = `
        <div style="text-align: center; padding: 8px;">
          <div style="font-size: 16px; margin-bottom: 6px;">🚀</div>
          <div style="font-weight: 600; font-size: 13px; color: #333; margin-bottom: 4px;">
            Upgrade to Apollo Pro
          </div>
          <div style="font-size: 11px; color: #666; margin-bottom: 8px;">
            Find similar people to contact next
          </div>
          <div style="font-size: 10px; color: #0066cc; cursor: pointer; text-decoration: underline;" onclick="window.open('https://apollo.io/pricing', '_blank')">
            View pricing →
          </div>
        </div>
      `;
      similarPersonCard.onclick = null;
      similarPersonCard.style.cursor = 'default';
      similarPersonSection.style.display = 'block';
      console.log('Apollo upgrade message displayed successfully');
    } catch (error) {
      console.error('Error showing Apollo upgrade message:', error);
    }
  };

  // Show similar person suggestion in the UI
  window.UIManager.showSimilarPersonSuggestion = function showSimilarPersonSuggestion(suggestion, hasMajorFiltering = false) {
    try {
      console.log('Showing similar person suggestion:', suggestion);
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
          console.log('Navigating to LinkedIn profile:', suggestion.linkedin_url);
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
      console.log('Similar person suggestion displayed successfully');
    } catch (error) {
      console.error('Error showing similar person suggestion:', error);
    }
  };
})();

// Export for tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}


