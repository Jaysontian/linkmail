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
