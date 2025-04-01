//profile-scraper.js

window.ProfileScraper = {
  
  async scrapeProfileData() {
    const name = document.querySelector('h1')?.innerText || '';
    const nameParts = name.split(' ');
    
    return {
      name: name,
      firstName: nameParts[0] || '',
      lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : '',
      headline: document.querySelector('.text-body-medium')?.innerText || '',
      about: document.querySelector('.pv-profile-card .display-flex.ph5.pv3 .inline-show-more-text--is-collapsed')?.innerText || '',
      company: this.extractCompany(),
      location: this.extractLocation(),
      experience: Array.from((document.querySelector('#experience')?.parentElement || document.createElement('div')).querySelectorAll('li.artdeco-list__item'))
        .map(li => {
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
        .filter(item => item !== null),
      email: await EmailFinder.findLinkedInEmail(),
    };
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
          return companyElement.textContent.trim();
        }
      }
    }
    
    // Fallback: Try to extract from headline
    const headline = document.querySelector('.text-body-medium')?.innerText || '';
    if (headline.includes(' at ')) {
      return headline.split(' at ')[1].trim();
    }
    
    return '';
  },
  
  // Extract location from the profile
  extractLocation() {
    const locationElement = document.querySelector('.pv-text-details__left-panel .text-body-small:not(.inline)');
    return locationElement ? locationElement.textContent.trim() : '';
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