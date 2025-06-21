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
    const cleanedCompany = this._removeDuplicates(company);
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
      emailFromAbout: emailFromAbout // Include this for reference
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
    if (!possibleEmail) return null;

    // Extract just the email pattern
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
    const match = possibleEmail.match(emailRegex);

    if (match && match[1]) {
      return match[1];
    }

    return possibleEmail; // Return original if no match found
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
    try {
      // Validate inputs
      if (!profileData || !profileData.name) {
        throw new Error('Invalid profile data provided');
      }

      // Clean user inputs (no HTML escaping needed for API calls)
      const sanitizedProfileData = {
        name: profileData.name || '',
        headline: profileData.headline || '',
        company: profileData.company || '',
        about: profileData.about || '',
        location: profileData.location || '',
        experience: profileData.experience ?
          profileData.experience.map(exp => ({
            content: exp.content || ''
          })) : []
      };

      // Build system prompt and user prompt here
      // ---- SYSTEM PROMPT ----
      const systemPrompt = `You are a template-filling assistant. Your ONLY job is to take the provided email templates and fill in the bracketed placeholders with personalized information. You must NOT deviate from the templates in ANY way.

RESPONSE FORMAT: [Subject Line]$$$[Email Body]

ABSOLUTE REQUIREMENTS:
1. Use the EXACT wording from the provided templates
2. Only replace text that is inside [square brackets]
3. Keep ALL original punctuation, spacing, paragraph breaks, and formatting
4. Do NOT add any sentences, words, or content not in the original template
5. Do NOT change greetings, closings, or any other text outside brackets
6. Do NOT rephrase or "improve" the template language
7. Do NOT change the tone or style

You are essentially doing a "find and replace" operation - find bracketed text, replace with specific info, leave everything else identical.

WRONG: Adding extra content, changing "Hi" to "Hey", rephrasing sentences
RIGHT: Exact template with only bracketed content replaced

Format: Subject$$$Body (no extra text, explanations, or formatting)
`;

      // Helper function to truncate content intelligently
      const truncateContent = (profileData, userData, templateData) => {
        // Option B: Smart field truncation
        const truncatedProfileData = { ...profileData };

        // Truncate About section to first 300 characters if it exists
        if (truncatedProfileData.about && truncatedProfileData.about.length > 300) {
          truncatedProfileData.about = truncatedProfileData.about.substring(0, 300) + '...';
        }

        // Option A: Keep only 2-3 most recent experiences with shortened descriptions
        if (truncatedProfileData.experience && truncatedProfileData.experience.length > 0) {
          // Take only the first 3 experiences (assuming they're in reverse chronological order)
          const recentExperiences = truncatedProfileData.experience.slice(0, 3);

          // Limit each experience description to ~100 characters
          truncatedProfileData.experience = recentExperiences.map(exp => ({
            ...exp,
            content: exp.content && exp.content.length > 100 ?
              exp.content.substring(0, 100) + '...' : exp.content
          }));
        }

        // Also truncate user's experience descriptions if they're very long
        const truncatedUserData = { ...userData };
        if (truncatedUserData.experiences && truncatedUserData.experiences.length > 0) {
          truncatedUserData.experiences = truncatedUserData.experiences.map(exp => ({
            ...exp,
            description: exp.description && exp.description.length > 100 ?
              exp.description.substring(0, 100) + '...' : exp.description
          }));
        }

        return { truncatedProfileData, truncatedUserData };
      };

      // Build user prompt with original data first
      const buildUserPrompt = (profileData, userData, templateData) => {
        return `TEMPLATE FILLING TASK: Replace only the bracketed placeholders in the templates below. Do NOT change anything else.

==== TEMPLATES TO FILL ====

SUBJECT TEMPLATE:
${templateData.subjectLine || 'Coffee Chat with [Recipient Name]'}

BODY TEMPLATE:
${templateData.content || 'Hey [NAME], I saw that XXX. I\'m really interested in XXX and would love to learn more about it as well as potential opportunities for an internship, if you guys are currently looking for summer interns. Let me know if you are down to schedule a time for a chat! Best regards,'}

==== REPLACEMENT DATA ====

Recipient Name: ${profileData.name}
Company: ${profileData.company || 'Not provided'}
About: ${profileData.about || 'Not provided'}
Experience: ${profileData.experience && profileData.experience.length > 0 ? profileData.experience.map(e => e.content).join('; ') : 'Not provided'}

==== INSTRUCTIONS ====

1. Copy the templates exactly as shown above
2. Replace [Recipient Name] with: ${profileData.name}
3. Replace [NAME] with: ${profileData.name}
4. Replace any other [bracketed text] with relevant information from the recipient data
5. Keep everything else IDENTICAL - same words, punctuation, spacing, line breaks
6. Do NOT add extra content, do NOT change greetings or closings

OUTPUT FORMAT: Subject$$$Body
  `;
      };

      // ---- USER PROMPT ----
      let userPrompt = buildUserPrompt(sanitizedProfileData, templateData.userData, templateData);

      // Check if prompt is too large and truncate if necessary
      if (userPrompt.length > 10000) {
        console.log(`Original prompt length: ${userPrompt.length} characters. Truncating content...`);

        const { truncatedProfileData, truncatedUserData } = truncateContent(sanitizedProfileData, templateData.userData, templateData);

        // Rebuild prompt with truncated data
        const truncatedTemplateData = { ...templateData, userData: truncatedUserData };
        userPrompt = buildUserPrompt(truncatedProfileData, truncatedUserData, templateData);

        console.log(`Truncated prompt length: ${userPrompt.length} characters`);

        // Final safety check - if still too large, throw error
        if (userPrompt.length > 10000) {
          throw new Error('Request too large even after truncation');
        }
      }

      // ---- API CALL ----
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch('https://linkmail-api.vercel.app/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: String(userPrompt),
            systemPrompt: String(systemPrompt)
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();

        if (!data || !data.result) {
          throw new Error('Invalid response from API');
        }

        console.log('API Response received successfully');

        // Parse the response into subject and email parts
        const parts = data.result.split('$$$');
        if (parts.length !== 2) {
          throw new Error('Invalid response format from API');
        }

        const [subject, email] = parts.map(str => str.trim());

        // Return the response as plain text (no HTML sanitization needed for email composer)
        return {
          subject: subject,
          email: email
        };

      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out');
        }
        throw fetchError;
      }

    } catch (error) {
      console.error('Error generating email:', error);
      return {
        subject: 'Connection Request',
        email: 'Hi there! I came across your profile and would love to connect. Best regards!'
      };
    }
  }
};
