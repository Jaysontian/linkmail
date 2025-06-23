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
    if (!possibleEmail) return '';  // Return empty string instead of null for consistency

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
      // Log input data for debugging
      console.log('Email generation input data:', {
        profileData: profileData,
        templateData: templateData
      });
      
      // Validate inputs
      if (!profileData || !profileData.name) {
        console.error('Profile data validation failed:', profileData);
        throw new Error('Invalid profile data provided');
      }
      
      if (!templateData || !templateData.content) {
        console.error('Template data validation failed:', templateData);
        throw new Error('Invalid template data provided');
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
      const systemPrompt = `You are a professional email template assistant. Your job is to fill in bracketed placeholders with personalized, natural content while maintaining the template structure.

MANDATORY RESPONSE FORMAT: You MUST respond with exactly this format:
[Subject Line]$$$[Email Body]

The $$$ delimiter is REQUIRED. Do not include any other text, explanations, or formatting.

CRITICAL RULES:
1. Replace ALL text inside [square brackets] with appropriate personalized content
2. If brackets contain instructions (like "talk about X" or "add a sentence about Y"), follow those instructions and write natural content
3. NEVER include the instruction text itself in the final output
4. Keep all formatting, punctuation, and paragraph breaks outside brackets
5. Write in a professional, networking-appropriate tone
6. Make the email sound natural and personally written

EXAMPLES:
Template: "I think it's really cool how [talk about the company's work]"
✓ GOOD: "I think it's really cool how you're revolutionizing the fintech space with AI-powered solutions"
✗ BAD: "I think it's really cool how talk about the company's work"

Template: "[mention something specific about their background]"
✓ GOOD: "I noticed your experience leading product development at Microsoft"
✗ BAD: "mention something specific about their background"

Template: "[brief personal introduction including your background]" 
✓ GOOD: "a senior Computer Science student at UCLA with internship experience at Google and Meta"
✗ BAD: "brief personal introduction including your background"

Template: "[Connect their company's work to your own experience]. I'd love to learn about opportunities."
✓ GOOD: "Given my background in machine learning and data analytics, I'm particularly drawn to your AI-driven approach. I'd love to learn about opportunities."
✗ BAD: "Connect their company's work to your own experience. I'd love to learn about opportunities."

Format: Subject$$$Body (no extra explanations)
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
        // Extract first name from full name
        const firstName = profileData.name ? profileData.name.split(' ')[0] : '';
        
        // Format user experiences for context
        const userExperiencesText = userData?.experiences ? 
          userData.experiences.map(exp => `${exp.title} at ${exp.company}: ${exp.description}`).join('\n') : 
          'Not provided';

        return `TASK: Fill in the email template with personalized content. Replace ALL bracketed placeholders with natural, professional content.

==== EMAIL TEMPLATES ====

SUBJECT TEMPLATE:
${templateData.subjectLine || 'Coffee Chat with [Recipient Name]'}

BODY TEMPLATE:
${templateData.content || 'Hey [NAME], I saw that XXX. I\'m really interested in XXX and would love to learn more about it as well as potential opportunities for an internship, if you guys are currently looking for summer interns. Let me know if you are down to schedule a time for a chat! Best regards,'}

==== RECIPIENT INFORMATION ====

Full Name: ${profileData.name}
First Name: ${firstName}
Company: ${profileData.company || 'Not specified'}
Headline: ${profileData.headline || 'Not specified'}
About Section: ${profileData.about || 'Not specified'}
Experience: ${profileData.experience && profileData.experience.length > 0 ? profileData.experience.map(e => e.content).join('; ') : 'Not specified'}

==== SENDER INFORMATION ====

Your Name: ${userData?.name || '[Your Name]'}
Your College: ${userData?.college || 'UCLA'}
Your Graduation Year: ${userData?.graduationYear || '2025'}
Your Experiences: ${userExperiencesText}

==== INSTRUCTIONS ====

1. Replace [Recipient Name] with the recipient's full name
2. Replace [Recipient First Name] with the recipient's first name
3. Replace [NAME] with the recipient's first name
4. Replace [Sender Name] with your name
5. For instruction placeholders (like "[talk about...]"), write natural content following the instruction
6. Use the recipient's company information, experience, and background to personalize the content
7. Connect the recipient's work to your own experiences when relevant and instructed
8. Make the email sound professional but friendly, appropriate for networking
9. Keep all text outside brackets exactly the same

REQUIRED OUTPUT FORMAT: 
You MUST respond with this exact format:
[Subject Line]$$$[Email Body]

Example:
Coffee Chat with John Smith$$$Hi John,

I'm a 3rd year Computer Science student at UCLA. I'm really impressed by how Microsoft is advancing AI research and its practical applications in cloud computing.

I'd love to connect and learn more about your experience in the tech industry. Would you be open to a brief coffee chat?

Best regards,
[Your Name]

Remember: Use $$$ as the delimiter between subject and body.
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
        console.log('Full API response structure:', data);
        console.log('Response keys:', Object.keys(data || {}));

        // Handle different possible API response structures
        let responseContent = null;
        
        if (data && data.result) {
          responseContent = data.result;
        } else if (data && data.response) {
          responseContent = data.response;
        } else if (data && data.content) {
          responseContent = data.content;
        } else if (data && data.message) {
          responseContent = data.message;
        } else if (typeof data === 'string') {
          responseContent = data;
        } else if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
          // OpenAI format
          responseContent = data.choices[0].message.content;
        }

        if (!responseContent) {
          console.error('API response missing expected content');
          console.error('Expected one of: result, response, content, message, or string');
          console.error('Got:', data);
          throw new Error('Invalid response from API');
        }

        console.log('API Response received successfully');
        console.log('Raw API response:', data);
        console.log('API content:', responseContent);

        // Parse the response into subject and email parts
        const parts = responseContent.split('$$$');
        console.log('Split parts:', parts);
        console.log('Number of parts:', parts.length);
        
        let subject, email;
        
        if (parts.length === 2) {
          // Expected format: Subject$$$Body
          [subject, email] = parts.map(str => str.trim());
        } else if (parts.length === 1) {
          // Fallback: AI didn't use the delimiter, try to extract subject and body
          console.warn('API response missing delimiter, attempting to parse as plain text');
          const response = responseContent.trim();
          
          // Look for a short first line that could be a subject
          const lines = response.split('\n');
          if (lines.length > 1 && lines[0].length < 100) {
            subject = lines[0].trim();
            email = lines.slice(1).join('\n').trim();
          } else {
            // Use default subject and entire response as email
            subject = 'Connection Request';
            email = response;
          }
        } else {
          console.error('Expected 2 parts (subject$$$body), got:', parts.length);
          console.error('Raw response was:', responseContent);
          throw new Error('Invalid response format from API');
        }

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
      
      // Provide more specific error information
      let errorMessage = 'An error occurred while generating the email.';
      if (error.message.includes('Invalid profile data')) {
        errorMessage = 'Could not get profile information from this LinkedIn page. Please try refreshing the page.';
      } else if (error.message.includes('Invalid template data')) {
        errorMessage = 'Email template is not properly configured. Please select a different template or check your template settings.';
      } else if (error.message.includes('Request timed out')) {
        errorMessage = 'Email generation timed out. Please try again.';
      } else if (error.message.includes('API request failed')) {
        errorMessage = 'Email generation service is temporarily unavailable. Please try again later.';
      } else if (error.message.includes('Request too large')) {
        errorMessage = 'Profile data is too large to process. Please try again or contact support.';
      } else if (error.message.includes('Invalid response format')) {
        errorMessage = 'Email generation service returned an invalid response. Please try again.';
      }
      
      return {
        subject: 'Connection Request',
        email: `${errorMessage}\n\nAs a fallback, here's a simple message:\n\nHi there! I came across your profile and would love to connect. Best regards!`
      };
    }
  }
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProfileScraper;
}
