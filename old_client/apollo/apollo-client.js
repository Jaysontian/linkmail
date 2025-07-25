// Apollo API Client Module
// Handles Apollo API integration for email enrichment

window.ApolloClient = {
  // Configuration constants
  API_KEY: 'F9emTuJtuTm33AxHa1U7Nw', // Apollo API key
  API_URL: 'https://api.apollo.io/api/v1/people/match',

  /**
   * Test Apollo API key validity
   * @returns {Promise<boolean>} True if API key is valid
   */
  async testAPIKey() {
    try {
      console.log('Testing Apollo API key...');

      // Simple test request with minimal required parameters
      const testParams = new URLSearchParams();
      testParams.append('first_name', 'John');
      testParams.append('last_name', 'Doe');
      testParams.append('reveal_personal_emails', 'false');

      const response = await fetch(`${this.API_URL}?${testParams.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-api-key': this.API_KEY,
          'Accept': 'application/json'
        }
      });

      console.log('Apollo API test response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Apollo API test failed:', response.status, response.statusText, errorText);
        return false;
      }

      const data = await response.json();
      console.log('Apollo API test successful:', data);
      return true;

    } catch (error) {
      console.error('Apollo API test error:', error);
      return false;
    }
  },

  /**
   * Enrich person data using Apollo API
   * @param {Object} profileData - LinkedIn profile data
   * @returns {Promise<Object>} Enrichment result with email if found
   */
  async enrichPerson(profileData) {
    try {
      console.log('Enriching person with Apollo API:', profileData);

      // Prepare the request parameters based on available profile data
      const params = this._buildRequestParams(profileData);

      const url = `${this.API_URL}?${params.toString()}`;

      console.log('Apollo API request URL:', url);
      console.log('Apollo API request params:', params.toString());
      console.log('Apollo API key (first 10 chars):', this.API_KEY.substring(0, 10) + '...');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-api-key': this.API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        // Try to get the error response body for better debugging
        let errorText = '';
        try {
          const errorData = await response.json();
          errorText = errorData.message || errorData.error || JSON.stringify(errorData);
          console.error('Apollo API error response:', errorData);
        } catch (e) {
          errorText = await response.text();
          console.error('Apollo API error text:', errorText);
        }
        throw new Error(`Apollo API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Apollo API response:', data);

      // Extract email from the response
      return this._parseAPIResponse(data);

    } catch (error) {
      console.error('Apollo API error:', error);
      return {
        success: false,
        error: error.message || 'Failed to enrich person data',
        source: 'apollo'
      };
    }
  },

  /**
   * Build request parameters from profile data
   * @param {Object} profileData - Profile data from LinkedIn
   * @returns {URLSearchParams} Request parameters
   */
  _buildRequestParams(profileData) {
    const params = new URLSearchParams();

    // Use name data
    if (profileData.firstName && profileData.lastName) {
      params.append('first_name', profileData.firstName);
      params.append('last_name', profileData.lastName);
    } else if (profileData.name) {
      params.append('name', profileData.name);
    }

    // Use company data to improve matching
    if (profileData.company) {
      const domain = this._deriveDomainFromCompany(profileData.company);
      if (domain) {
        params.append('domain', domain);
      }
      // Also send organization name for better matching
      params.append('organization_name', profileData.company);
    }

    // Use location data if available
    if (profileData.location) {
      params.append('location', profileData.location);
    }

    // Use title/headline if available
    if (profileData.headline) {
      params.append('title', profileData.headline);
    }

    // Request personal emails and phone numbers
    params.append('reveal_personal_emails', 'true');
    params.append('reveal_phone_number', 'false'); // We only need email

    return params;
  },

  /**
   * Derive domain from company name
   * @param {string} companyName - Company name
   * @returns {string} Derived domain or empty string
   */
  _deriveDomainFromCompany(companyName) {
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
   * Parse Apollo API response
   * @param {Object} data - API response data
   * @returns {Object} Parsed result
   */
  _parseAPIResponse(data) {
    // Extract email from the response
    if (data.person && data.person.email) {
      return {
        success: true,
        email: data.person.email,
        source: 'apollo',
        person: data.person
      };
    } else {
      return {
        success: false,
        error: 'No email found in Apollo database',
        source: 'apollo'
      };
    }
  },

  /**
   * Find email using profile data (content script interface)
   * @param {Object} profileData - Profile data
   * @returns {Promise<Object>} Result with email if found
   */
  async findEmailWithProfile(profileData) {
    try {
      console.log('Attempting to find email with Apollo API');

      return new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'enrichWithApollo',
          profileData: profileData
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            resolve({
              success: false,
              error: 'Extension error occurred'
            });
            return;
          }

          console.log('Apollo API response:', response);
          resolve(response);
        });
      });
    } catch (error) {
      console.error('Error in findEmailWithProfile:', error);
      return {
        success: false,
        error: 'Failed to connect to Apollo API'
      };
    }
  }
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApolloClient;
} 