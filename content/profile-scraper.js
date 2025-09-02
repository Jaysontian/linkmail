//profile-scraper.js

window.ProfileScraper = {

  // Scrape basic profile data without opening contact info overlay
  async scrapeBasicProfileData() {

    const name = document.querySelector('h1')?.innerText || '';

    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

    const headline = document.querySelector('.text-body-medium')?.innerText || '';

    const about = document.querySelector('.pv-profile-card .display-flex.ph5.pv3 .inline-show-more-text--is-collapsed')?.innerText || '';

    // Extract email from about section if present
    const emailFromAbout = this.extractEmailFromText(about);

    const company = this.extractCompany();

    const location = this.extractLocation();

    const experience = this.extractExperience();

    const cleanedAbout = this._removeDuplicates(about);
    const cleanedCompany = this._cleanCompanyName(this._removeDuplicates(company));
    const cleanedExperience = experience.map(exp => ({
      content: this._removeDuplicates(exp.content)
    }));

    const result = {
      name: name,
      firstName: firstName,
      lastName: lastName,
      headline: headline,
      about: cleanedAbout,
      company: cleanedCompany,
      location: location,
      experience: cleanedExperience,
      emailFromAbout: emailFromAbout, // Include this for reference
      linkedinUrl: window.location.href
    };

    return result;
  },

  // Full profile scrape including email (which requires contact info overlay)
  async scrapeProfileData(forceEmailLookup = false) {

    // Get basic data first
    const basicData = await this.scrapeBasicProfileData();

    // Use email from about section if available
    let email = basicData.emailFromAbout;

    // Only try to find email via contact info overlay if explicitly requested and not found in about
    if (forceEmailLookup && !email) {
      const foundEmail = await EmailFinder.findLinkedInEmail();

      // Clean up email if needed
      if (foundEmail) {
        email = this.cleanupEmail(foundEmail);
      }
    }

    // Copy basic data but remove emailFromAbout property
    // eslint-disable-next-line no-unused-vars
    const { emailFromAbout, ...resultWithoutEmailFromAbout } = basicData;

    const result = {
      ...resultWithoutEmailFromAbout,
      email: email
    };

    return result;
  },

  // Extract experience data
  extractExperience() {

    const experienceItems = Array.from((document.querySelector('#experience')?.parentElement || document.createElement('div')).querySelectorAll('li.artdeco-list__item'));

    const result = experienceItems
      .map((li, index) => {
        const content = [
          ...li.querySelectorAll('.t-bold'),
          ...li.querySelectorAll('.t-normal'),
          ...li.querySelectorAll('.pvs-entity__caption-wrapper')
        ]
          .map(el => el.textContent.trim())
          .filter(text => text)
          .join(' · ');


        return { content };
      })
      .filter(item => item !== null);

    return result;
  },

  // Extract company from the profile
  extractCompany() {

    // Try to find current company in the experience section
    const experienceSection = document.querySelector('#experience')?.parentElement;
    if (experienceSection) {
      const firstExperience = experienceSection.querySelector('li.artdeco-list__item');
      if (firstExperience) {
        // Look for company name in the first experience item
        const companyElement = firstExperience.querySelector('.t-normal');
        if (companyElement) {
          const company = companyElement.textContent.trim();
          return company;
        }
      }
    }

    // Fallback: Try to extract from headline
    const headline = document.querySelector('.text-body-medium')?.innerText || '';
    if (headline.includes(' at ')) {
      const company = headline.split(' at ')[1].trim();
      return company;
    }

    return '';
  },

  // Extract location from the profile
  extractLocation() {

    const locationElement = document.querySelector('.pv-text-details__left-panel .text-body-small:not(.inline)');
    if (locationElement) {
      const location = locationElement.textContent.trim();
      return location;
    }

    return '';
  },

  // Extract email from text using regex
  extractEmailFromText(text) {
    if (!text) return null;

    // Email regex pattern - comprehensive version
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const matches = text.match(emailRegex);

    if (matches && matches.length > 0) {
      return matches[0];
    }

    return null;
  },

  // Clean up email to ensure only the email address is returned
  cleanupEmail(possibleEmail) {
    if (!possibleEmail) return '';  // Return empty string instead of null for consistency

    // Extract just the email pattern
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
    const match = possibleEmail.match(emailRegex);

    if (match && match[1]) {
      return match[1];
    }

    return possibleEmail; // Return original if no match found
  },

  // Helper method to clean company names (remove duplicates)
  _cleanCompanyName(company) {
    if (!company) return '';
    
    // Remove exact duplicates like "DecagonDecagon" -> "Decagon"
    const cleaned = company.replace(/(.+)\1+/g, '$1').trim();
    
    // Additional cleanup for common patterns
    return cleaned
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .trim();
  },

  // Helper method to remove duplicated content
  _removeDuplicates(text) {
    if (!text) return '';

    // Try to detect duplicated phrases and remove them
    const chunks = text.split(/\s+/);
    const cleaned = [];

    for (let i = 0; i < chunks.length; i++) {
      const currentChunk = chunks[i];

      // Check if this chunk is the start of a duplicated sequence
      let isDuplicate = false;

      // Check patterns of different lengths (up to 8 words)
      const maxPatternLength = Math.min(8, Math.floor((chunks.length - i) / 2));

      for (let patternLength = maxPatternLength; patternLength >= 1; patternLength--) {
        if (i + 2 * patternLength > chunks.length) continue;

        // Get potential pattern
        const pattern = chunks.slice(i, i + patternLength).join(' ');
        const nextChunks = chunks.slice(i + patternLength, i + 2 * patternLength).join(' ');

        if (pattern === nextChunks) {
          // Found a duplicated pattern, skip the second occurrence
          isDuplicate = true;
          i += patternLength - 1; // -1 because the loop will increment i
          break;
        }
      }

      if (!isDuplicate) {
        cleaned.push(currentChunk);
      }
    }

    // Join the cleaned chunks back into a string
    return cleaned.join(' ');
  },

  async generateColdEmail(profileData, templateData) {
    // Delegate to EmailGenerator module
    if (window.EmailGenerator) {
      return await window.EmailGenerator.generateColdEmail(profileData, templateData);
    } else {
      // Fallback if EmailGenerator is not loaded
      console.error('EmailGenerator module not available');
      return {
        subject: 'Connection Request',
        email: 'Email generation service is temporarily unavailable. Please try refreshing the page and try again.'
      };
    }
  }
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProfileScraper;
}
