//email-finder.js

window.EmailFinder = {
  async checkContactInfo() {
    const contactButton = document.querySelector('a[href*="contact-info"]');
    if (!contactButton) return null;

    contactButton.click();
    
    let modalContent = null;
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      modalContent = document.querySelector([
        'div[aria-label="Contact info"] .artdeco-modal__content',
        '.pv-contact-info__contact-type',
        '.pv-profile-section__section-info',
        '.artdeco-modal__content'
      ].join(','));

      if (modalContent) break;
    }

    if (modalContent) {
      const allText = modalContent.innerText || modalContent.textContent;
      console.log('Modal content found:', allText);
      
      const email = Utils.extractEmail(allText);
      console.log('Email found:', email);
      
      const closeButton = document.querySelector([
        'button[aria-label="Dismiss"]',
        '.artdeco-modal__dismiss',
        '.artdeco-modal__close'
      ].join(','));
      
      if (closeButton) closeButton.click();
      
      return email;
    }
    return null;
  },

  checkAboutSection() {
    const aboutSection = document.getElementById('about')?.closest('section');
    if (!aboutSection) return null;
    return Utils.extractEmail(aboutSection.textContent);
  },

  async findLinkedInEmail() {
    const contactInfoEmail = await this.checkContactInfo();
    if (contactInfoEmail) return contactInfoEmail;

    const aboutEmail = this.checkAboutSection();
    if (aboutEmail) return aboutEmail;

    return null;
  }
};
