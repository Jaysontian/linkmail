//profile-scraper.js

window.ProfileScraper = {
  
  // Scrape basic profile data without opening contact info overlay
  async scrapeBasicProfileData() {
    console.log("ProfileScraper: Starting basic profile data scraping");
    
    const name = document.querySelector('h1')?.innerText || '';
    console.log("ProfileScraper: Name:", name);
    
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    console.log("ProfileScraper: First name:", firstName);
    console.log("ProfileScraper: Last name:", lastName);
    
    const headline = document.querySelector('.text-body-medium')?.innerText || '';
    console.log("ProfileScraper: Headline:", headline);
    
    const about = document.querySelector('.pv-profile-card .display-flex.ph5.pv3 .inline-show-more-text--is-collapsed')?.innerText || '';
    console.log("ProfileScraper: About:", about);
    
    const company = this.extractCompany();
    console.log("ProfileScraper: Company:", company);
    
    const location = this.extractLocation();
    console.log("ProfileScraper: Location:", location);
    
    const experience = this.extractExperience();
    console.log("ProfileScraper: Experience count:", experience.length);
    
    const result = {
      name: name,
      firstName: firstName,
      lastName: lastName,
      headline: headline,
      about: about,
      company: company,
      location: location,
      experience: experience
    };
    
    console.log("ProfileScraper: Basic profile data scraping complete");
    return result;
  },
  
  // Full profile scrape including email (which requires contact info overlay)
  async scrapeProfileData(forceEmailLookup = false) {
    console.log("ProfileScraper: Starting full profile data scraping, forceEmailLookup:", forceEmailLookup);
    
    // Get basic data first
    const basicData = await this.scrapeBasicProfileData();
    
    // Only try to find email if explicitly requested
    let email = null;
    if (forceEmailLookup) {
      console.log("ProfileScraper: Looking up email via EmailFinder");
      email = await EmailFinder.findLinkedInEmail();
      console.log("ProfileScraper: Email result:", email);
    }
    
    const result = {
      ...basicData,
      email: email
    };
    
    console.log("ProfileScraper: Full profile data scraping complete");
    return result;
  },
  
  // Extract experience data
  extractExperience() {
    console.log("ProfileScraper: Extracting experience data");
    
    const experienceItems = Array.from((document.querySelector('#experience')?.parentElement || document.createElement('div')).querySelectorAll('li.artdeco-list__item'));
    console.log("ProfileScraper: Found experience items:", experienceItems.length);
    
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
    
    console.log("ProfileScraper: Experience extraction complete");
    return result;
  },
  
  // Extract company from the profile
  extractCompany() {
    console.log("ProfileScraper: Extracting company");
    
    // Try to find current company in the experience section
    const experienceSection = document.querySelector('#experience')?.parentElement;
    if (experienceSection) {
      const firstExperience = experienceSection.querySelector('li.artdeco-list__item');
      if (firstExperience) {
        // Look for company name in the first experience item
        const companyElement = firstExperience.querySelector('.t-normal');
        if (companyElement) {
          const company = companyElement.textContent.trim();
          console.log("ProfileScraper: Company found in experience section:", company);
          return company;
        }
      }
    }
    
    // Fallback: Try to extract from headline
    const headline = document.querySelector('.text-body-medium')?.innerText || '';
    if (headline.includes(' at ')) {
      const company = headline.split(' at ')[1].trim();
      console.log("ProfileScraper: Company extracted from headline:", company);
      return company;
    }
    
    console.log("ProfileScraper: No company found");
    return '';
  },
  
  // Extract location from the profile
  extractLocation() {
    console.log("ProfileScraper: Extracting location");
    
    const locationElement = document.querySelector('.pv-text-details__left-panel .text-body-small:not(.inline)');
    if (locationElement) {
      const location = locationElement.textContent.trim();
      console.log("ProfileScraper: Location found:", location);
      return location;
    }
    
    console.log("ProfileScraper: No location found");
    return '';
  },

  async generateColdEmail(profileData, templateData) {
    try {
      // Add user experiences and skills to template data if available
      if (templateData.userData) {
        // Format experiences
        if (templateData.userData.experiences) {
          templateData.userData.experiencesFormatted = templateData.userData.experiences
            .map(exp => {
              let text = '';
              if (exp.jobTitle) text += exp.jobTitle;
              if (exp.company) text += exp.jobTitle ? ` at ${exp.company}` : exp.company;
              
              // Only add description if it exists and isn't too long
              if (exp.description && exp.description.length > 0) {
                // Truncate if too long
                const shortDesc = exp.description.length > 50 
                  ? exp.description.substring(0, 50) + '...' 
                  : exp.description;
                text += ` (${shortDesc})`;
              }
              return text;
            })
            .filter(text => text.length > 0) // Remove empty experiences
            .join('\n- '); // Format as bullet points
          
          // If we have experiences, add a prefix
          if (templateData.userData.experiencesFormatted) {
            templateData.userData.experiencesFormatted = 'My experiences include:\n- ' + 
              templateData.userData.experiencesFormatted;
          }
        }
        
        // Format skills
        if (templateData.userData.skills && templateData.userData.skills.length > 0) {
          templateData.userData.skillsFormatted = 'My skills include: ' + 
            templateData.userData.skills.join(', ');
        }
      }
    
      const response = await fetch(`${BACKEND_URL}/generate-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile: profileData,
          template: templateData
        })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Error generating email:', error);
      return null;
    }
  }
};