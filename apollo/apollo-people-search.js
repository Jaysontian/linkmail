// Apollo People Search Module
// Handles finding similar people to reach out to next

window.ApolloPeopleSearch = {
  // Configuration constants
  API_KEY: 'Z8v_SYe2ByFcVLF3H1bfiA', // Same Apollo API key
  API_URL: 'https://api.apollo.io/api/v1/mixed_people/search',

  /**
   * Find similar people to reach out to based on the previously contacted person
   * @param {Object} contactedPersonData - Profile data of the person who was contacted
   * @returns {Promise<Object>} Result with suggested similar people
   */
  async findSimilarPeople(contactedPersonData) {
    try {
      console.log('Finding similar people for:', contactedPersonData);

      // Extract key information for searching
      const companyDomain = this._extractCompanyDomain(contactedPersonData.company);
      const organizationName = this._normalizeCompanyName(contactedPersonData.company);
      const jobTitle = this._normalizeJobTitle(contactedPersonData.headline);

      console.log('Search criteria - Company domain:', companyDomain, 'Job title:', jobTitle);

      // Perform searches in order of similarity priority
      const similarPeople = [];

      // 1. Same company AND same role (highest similarity)
      if (companyDomain && jobTitle) {
        console.log('Searching for people with same company AND same role...');
        const sameCompanyAndRole = await this._searchPeople({
          organization_domains: [companyDomain],
          organization_name: organizationName,
          job_titles: [jobTitle],
          exclude_linkedin_url: contactedPersonData.linkedinUrl
        });
        
        if (sameCompanyAndRole.length > 0) {
          similarPeople.push(...sameCompanyAndRole.map(person => ({
            ...person,
            similarity_reason: 'same_company_and_role',
            similarity_score: 3
          })));
        }
      }

      // 2. Same company only (medium similarity)
      if (companyDomain && similarPeople.length < 3) {
        console.log('Searching for people with same company only...');
        const sameCompanyOnly = await this._searchPeople({
          organization_domains: [companyDomain],
          organization_name: organizationName,
          exclude_linkedin_url: contactedPersonData.linkedinUrl,
          exclude_job_titles: jobTitle ? [jobTitle] : []
        });

        if (sameCompanyOnly.length > 0) {
          similarPeople.push(...sameCompanyOnly.map(person => ({
            ...person,
            similarity_reason: 'same_company',
            similarity_score: 2
          })));
        }
      }

      // 3. Same role only (lower similarity)
      if (jobTitle && similarPeople.length < 3) {
        console.log('Searching for people with same role only...');
        const sameRoleOnly = await this._searchPeople({
          job_titles: [jobTitle],
          exclude_linkedin_url: contactedPersonData.linkedinUrl,
          exclude_organization_domains: companyDomain ? [companyDomain] : []
        });

        if (sameRoleOnly.length > 0) {
          similarPeople.push(...sameRoleOnly.map(person => ({
            ...person,
            similarity_reason: 'same_role',
            similarity_score: 1
          })));
        }
      }

      // Remove duplicates and sort by similarity score
      const uniquePeople = this._deduplicateAndSort(similarPeople);
      
      // Return the top suggestion
      const topSuggestion = uniquePeople.length > 0 ? uniquePeople[0] : null;

      console.log('Found similar people:', uniquePeople.length, 'Top suggestion:', topSuggestion);

      return {
        success: true,
        suggestion: topSuggestion,
        allSuggestions: uniquePeople.slice(0, 3), // Return top 3
        source: 'apollo_people_search'
      };

    } catch (error) {
      console.error('Apollo People Search error:', error);
      return {
        success: false,
        error: error.message || 'Failed to find similar people',
        source: 'apollo_people_search'
      };
    }
  },

  /**
   * Search for people using Apollo People Search API
   * @param {Object} searchCriteria - Search parameters
   * @returns {Promise<Array>} Array of people found
   */
  async _searchPeople(searchCriteria) {
    try {
      const requestBody = {
        per_page: 5, // Limit results for performance
        page: 1
      };

      // Add organization domains if specified
      if (searchCriteria.organization_domains && searchCriteria.organization_domains.length > 0) {
        requestBody.q_organization_domains_list = searchCriteria.organization_domains;
      }

      // Add organization name if provided
      if (searchCriteria.organization_name) {
        requestBody.organization_name = searchCriteria.organization_name;
      }

      // Add job titles if specified
      if (searchCriteria.job_titles && searchCriteria.job_titles.length > 0) {
        requestBody.person_titles = searchCriteria.job_titles;
        requestBody.include_similar_titles = true; // Include similar job titles
      }

      console.log('Apollo People Search request:', requestBody);

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-api-key': this.API_KEY,
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let errorText = '';
        try {
          const errorData = await response.json();
          errorText = errorData.message || errorData.error || JSON.stringify(errorData);
          console.error('Apollo People Search API error response:', errorData);
        } catch (e) {
          errorText = await response.text();
          console.error('Apollo People Search API error text:', errorText);
        }
        throw new Error(`Apollo People Search API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Apollo People Search API response:', data);

      // Extract global people and saved contacts, prefer global results
      const people = Array.isArray(data.people) ? data.people : [];
      const contacts = Array.isArray(data.contacts) ? data.contacts : [];
      const combined = [...people, ...contacts];

      // Filter out the original person
      const filtered = combined.filter(contact => {
        // Exclude the person we just contacted
        if (searchCriteria.exclude_linkedin_url && contact.linkedin_url) {
          return !this._isSameLinkedInProfile(contact.linkedin_url, searchCriteria.exclude_linkedin_url);
        }
        return true;
      });

      return filtered;

    } catch (error) {
      console.error('Error in Apollo People Search API call:', error);
      return [];
    }
  },

  /**
   * Extract company domain from company name
   * @param {string} companyName - Company name
   * @returns {string} Company domain or empty string
   */
  _extractCompanyDomain(companyName) {
    if (!companyName) return '';

    const cleanCompany = companyName.toLowerCase();

    // If company name already contains domain info
    if (cleanCompany.includes('.com') || cleanCompany.includes('.org') || cleanCompany.includes('.net')) {
      const domainMatch = cleanCompany.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (domainMatch) {
        return domainMatch[1];
      }
    }

    // Try common patterns for domain derivation
    const normalizedCompany = cleanCompany
      .replace(/\s+(inc|inc\.|llc|ltd|limited|corp|corporation|company|co\.).*$/i, '')
      .replace(/[^a-zA-Z0-9]/g, '');

    // For well-known companies, we might want to add domain mapping
    // For now, we'll try the simple approach
    if (normalizedCompany) {
      return `${normalizedCompany}.com`;
    }

    return '';
  },

  /**
   * Normalize company name for Apollo organization_name filter
   * @param {string} companyName
   * @returns {string}
   */
  _normalizeCompanyName(companyName) {
    if (!companyName) return '';
    let cleaned = companyName.toLowerCase();
    cleaned = cleaned.replace(/\s*·\s*(full-time|part-time|contract|freelance|internship)/gi, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    if (cleaned.length % 2 === 0) {
      const half = cleaned.length / 2;
      const a = cleaned.substring(0, half);
      const b = cleaned.substring(half);
      if (a === b) cleaned = a.trim();
    }
    cleaned = cleaned.replace(/\s+(inc|inc\.|llc|ltd|limited|corp|corporation|company|co\.|gmbh|ag|sa)$/i, '').trim();
    cleaned = cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return cleaned;
  },

  /**
   * Normalize job title for better matching
   * @param {string} headline - LinkedIn headline or job title
   * @returns {string} Normalized job title
   */
  _normalizeJobTitle(headline) {
    if (!headline) return '';

    // Extract job title from headline (often contains company info)
    let title = headline;

    // Remove company information (typically after "at" or "@")
    title = title.split(' at ')[0];
    title = title.split(' @ ')[0];
    title = title.split('|')[0]; // Remove secondary info after pipe

    // Clean up and normalize
    title = title.trim();
    
    // Common title normalizations
    const titleMappings = {
      'software engineer': ['software developer', 'developer', 'engineer'],
      'product manager': ['pm', 'product mgr'],
      'sales manager': ['sales mgr', 'account manager'],
      'marketing manager': ['marketing mgr', 'mktg manager'],
      'data scientist': ['data analyst', 'data engineer'],
      'business development': ['bd', 'biz dev']
    };

    // Return the main normalized title
    return title;
  },

  /**
   * Check if two LinkedIn URLs refer to the same profile
   * @param {string} url1 - First LinkedIn URL
   * @param {string} url2 - Second LinkedIn URL
   * @returns {boolean} True if same profile
   */
  _isSameLinkedInProfile(url1, url2) {
    if (!url1 || !url2) return false;

    // Extract profile IDs from URLs
    const extractProfileId = (url) => {
      const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/i);
      return match ? match[1].toLowerCase() : null;
    };

    const id1 = extractProfileId(url1);
    const id2 = extractProfileId(url2);

    return id1 && id2 && id1 === id2;
  },

  /**
   * Remove duplicates and sort by similarity score
   * @param {Array} people - Array of people with similarity scores
   * @returns {Array} Deduplicated and sorted array
   */
  _deduplicateAndSort(people) {
    // Remove duplicates based on LinkedIn URL
    const seen = new Set();
    const unique = people.filter(person => {
      const key = person.linkedin_url || person.id;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    // Sort by similarity score (highest first), then by name
    return unique.sort((a, b) => {
      if (a.similarity_score !== b.similarity_score) {
        return b.similarity_score - a.similarity_score;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  },

  /**
   * Find similar people using profile data (content script interface)
   * @param {Object} contactedPersonData - Profile data of contacted person
   * @returns {Promise<Object>} Result with similar people
   */
  async findSimilarPeopleWithProfile(contactedPersonData) {
    try {
      console.log('Attempting to find similar people with Apollo People Search API');

      return new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'findSimilarPeople',
          contactedPersonData: contactedPersonData
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            resolve({
              success: false,
              error: 'Extension error occurred'
            });
            return;
          }

          console.log('Apollo People Search response:', response);
          resolve(response);
        });
      });
    } catch (error) {
      console.error('Error in findSimilarPeopleWithProfile:', error);
      return {
        success: false,
        error: 'Failed to connect to Apollo People Search API'
      };
    }
  }
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApolloPeopleSearch;
}
