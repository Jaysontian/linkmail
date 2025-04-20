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
      // Build system prompt and user prompt here
      // ---- SYSTEM PROMPT ----
      const systemPrompt = `You are an expert email writer who crafts concise, personalized outreach emails on behalf of a sender.

Your response MUST be formatted as follows:
[Subject Line]$$$[Email Body]
-  Place the subject line first.
-  Use three dollar signs ($$$) as a delimiter.
-  Follow with the email body.
-  Do NOT include any extra text, explanations, or formatting—just the subject and body separated by $$$.

Guidelines:
-  The subject line must use the provided subject line template, replacing any [bracketed text] with relevant content.
-  The email body must be brief (ideally 80–100 words, maximum 100).
-  Use a warm, professional tone suitable for outreach.
-  Highlight ONE specific, meaningful connection between the sender and recipient.
-  Make the reason for connecting clear and specific.
-  End with a short, punchy call-to-action.

Example format:
Subject line here$$$Email body here
`;

      // ---- USER PROMPT ----
      // You can further customize this as needed!
      let userPrompt = `Write a short, personalized email from me to ${profileData.name}${profileData.company ? ` who works at ${profileData.company}` : ""}.

  Recipient information:
-  Name: ${profileData.name}
-  Headline: ${profileData.headline || "Not provided"}
-  Company: ${profileData.company || "Not provided"}
-  About: ${profileData.about || "Not provided"}
-  Location: ${profileData.location || "Not provided"}
-  Experiences: ${profileData.experience && profileData.experience.length > 0 ? profileData.experience.map(e => e.content).join("; ") : "Not provided"}

My information:
-  Name: ${templateData.userData?.name || "[Your Name]"}
-  College/University: ${templateData.userData?.college || ""}
-  Graduation year: ${templateData.userData?.graduationYear || ""}
-  Experiences: ${templateData.userData?.experiences && templateData.userData.experiences.length > 0 ? templateData.userData.experiences.map(e => `${e.jobTitle || ""}${e.company ? ` at ${e.company}` : ""}${e.description ? ` (${e.description.length > 50 ? e.description.substring(0, 50) + "..." : ""})` : ""}`).join("; ") : "Not provided"}
-  Skills: ${templateData.userData?.skills && templateData.userData.skills.length > 0 ? templateData.userData.skills.join(", ") : "Not provided"}

Purpose of the email: ${templateData.purpose || "to schedule a coffee chat"}

Subject line template:
${templateData.subjectLine || "Coffee Chat with [Recipient Name]"}

Email body template:
${templateData.content || "Hey [NAME], I saw that XXX. I'm really interested in XXX and would love to learn more about it as well as potential opportunities for an internship, if you guys are currently looking for summer interns. Let me know if you are down to schedule a time for a chat! Best regards,"}

IMPORTANT: Return your response in this exact format:
[Subject Line]$$$[Email Body]
  `;

      // ---- API CALL ----
      const response = await fetch('https://linkmail-api.vercel.app/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: String(userPrompt),
          systemPrompt: String(systemPrompt)
        })
      });

      const data = await response.json();

      console.log(data);
      
      // Parse the response into subject and email parts
      const [subject, email] = data.result.split('$$$').map(str => str.trim());
      
      return {
        subject,
        email
      };

    } catch (error) {
      console.error('Error generating email:', error);
      return null;
    }
  }
};