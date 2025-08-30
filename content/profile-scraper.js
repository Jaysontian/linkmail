//profile-scraper.js

window.ProfileScraper = {

  // Scrape basic profile data without opening contact info overlay
  async scrapeBasicProfileData() {
    console.log('ProfileScraper: Starting basic profile data scraping');

    const name = document.querySelector('h1')?.innerText || '';
    console.log('ProfileScraper: Name:', name);

    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    console.log('ProfileScraper: First name:', firstName);
    console.log('ProfileScraper: Last name:', lastName);

    const headline = document.querySelector('.text-body-medium')?.innerText || '';
    console.log('ProfileScraper: Headline:', headline);

    const about = document.querySelector('.pv-profile-card .display-flex.ph5.pv3 .inline-show-more-text--is-collapsed')?.innerText || '';
    console.log('ProfileScraper: About:', about);

    // Extract email from about section if present
    const emailFromAbout = this.extractEmailFromText(about);
    console.log('ProfileScraper: Email from about section:', emailFromAbout);

    const company = this.extractCompany();
    console.log('ProfileScraper: Company:', company);

    const location = this.extractLocation();
    console.log('ProfileScraper: Location:', location);

    const experience = this.extractExperience();
    console.log('ProfileScraper: Experience count:', experience.length);

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

    console.log('ProfileScraper: Basic profile data scraping complete');
    return result;
  },

  // Full profile scrape including email (which requires contact info overlay)
  async scrapeProfileData(forceEmailLookup = false) {
    console.log('ProfileScraper: Starting full profile data scraping, forceEmailLookup:', forceEmailLookup);

    // Get basic data first
    const basicData = await this.scrapeBasicProfileData();

    // Use email from about section if available
    let email = basicData.emailFromAbout;

    // Only try to find email via contact info overlay if explicitly requested and not found in about
    if (forceEmailLookup && !email) {
      console.log('ProfileScraper: Looking up email via EmailFinder');
      const foundEmail = await EmailFinder.findLinkedInEmail();
      console.log('ProfileScraper: Email result from finder:', foundEmail);

      // Clean up email if needed
      if (foundEmail) {
        email = this.cleanupEmail(foundEmail);
        console.log('ProfileScraper: Cleaned email:', email);
      }
    }

    // Copy basic data but remove emailFromAbout property
    // eslint-disable-next-line no-unused-vars
    const { emailFromAbout, ...resultWithoutEmailFromAbout } = basicData;

    const result = {
      ...resultWithoutEmailFromAbout,
      email: email
    };

    console.log('ProfileScraper: Full profile data scraping complete');
    return result;
  },

  // Extract experience data
  extractExperience() {
    console.log('ProfileScraper: Extracting experience data');

    const experienceItems = Array.from((document.querySelector('#experience')?.parentElement || document.createElement('div')).querySelectorAll('li.artdeco-list__item'));
    console.log('ProfileScraper: Found experience items:', experienceItems.length);

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

        console.log(`ProfileScraper: Experience ${index + 1}:`, content);

        return { content };
      })
      .filter(item => item !== null);

    console.log('ProfileScraper: Experience extraction complete');
    return result;
  },

  // Extract company from the profile
  extractCompany() {
    console.log('ProfileScraper: Extracting company');

    // Try to find current company in the experience section
    const experienceSection = document.querySelector('#experience')?.parentElement;
    if (experienceSection) {
      const firstExperience = experienceSection.querySelector('li.artdeco-list__item');
      if (firstExperience) {
        // Look for company name in the first experience item
        const companyElement = firstExperience.querySelector('.t-normal');
        if (companyElement) {
          const company = companyElement.textContent.trim();
          console.log('ProfileScraper: Company found in experience section:', company);
          return company;
        }
      }
    }

    // Fallback: Try to extract from headline
    const headline = document.querySelector('.text-body-medium')?.innerText || '';
    if (headline.includes(' at ')) {
      const company = headline.split(' at ')[1].trim();
      console.log('ProfileScraper: Company extracted from headline:', company);
      return company;
    }

    console.log('ProfileScraper: No company found');
    return '';
  },

  // Extract location from the profile
  extractLocation() {
    console.log('ProfileScraper: Extracting location');

    const locationElement = document.querySelector('.pv-text-details__left-panel .text-body-small:not(.inline)');
    if (locationElement) {
      const location = locationElement.textContent.trim();
      console.log('ProfileScraper: Location found:', location);
      return location;
    }

    console.log('ProfileScraper: No location found');
    return '';
  },

  // Extract email from text using regex
  extractEmailFromText(text) {
    if (!text) return null;

    // Email regex pattern - comprehensive version
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const matches = text.match(emailRegex);

    if (matches && matches.length > 0) {
      console.log('ProfileScraper: Found email in text:', matches[0]);
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
