//profile-scraper.js

window.ProfileScraper = {
  
  async scrapeProfileData() {
    return {
      name: document.querySelector('h1')?.innerText || '',
      headline: document.querySelector('.text-body-medium')?.innerText || '',
      about: document.querySelector('.pv-profile-card .display-flex.ph5.pv3 .inline-show-more-text--is-collapsed')?.innerText || '',
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

  async generateColdEmail(profileData, templateData) {
    try {
      // Add user experiences to template data if available
      if (templateData.userData && templateData.userData.experiences) {
        templateData.userData.experiencesFormatted = templateData.userData.experiences
          .map(exp => {
            let text = '';
            if (exp.jobTitle) text += exp.jobTitle;
            if (exp.company) text += exp.jobTitle ? ` at ${exp.company}` : exp.company;
            
            // Only add description if it exists and isn't too long
            if (exp.description && exp.description.length > 0) {
              // Truncate if too long
              const shortDesc = exp.description.length > 100 
                ? exp.description.substring(0, 100) + '...' 
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
