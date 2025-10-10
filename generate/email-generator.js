// Email Generation Module
// Handles AI-powered email generation with template processing

window.EmailGenerator = {
  // Configuration constants
  API_ENDPOINT: 'https://linkmail-api.vercel.app/api/generate',
  TIMEOUT_MS: 30000,
  MAX_PROMPT_LENGTH: 10000,

  /**
   * Generate a personalized cold email using AI
   * @param {Object} profileData - Data about the recipient
   * @param {Object} templateData - Template and user data
   * @returns {Promise<Object>} Generated email with subject and content
   */
  async generateColdEmail(profileData, templateData) {
    try {
      // Log input data for debugging
      console.log('Email generation input data:', {
        profileData: profileData,
        templateData: templateData
      });

      // Validate inputs
      this._validateInputs(profileData, templateData);

      // Clean and sanitize profile data
      const sanitizedProfileData = this._sanitizeProfileData(profileData);

      // Build prompts
      const systemPrompt = this._buildSystemPrompt();
      let userPrompt = this._buildUserPrompt(sanitizedProfileData, templateData.userData, templateData);

      // Handle prompt size limitations
      if (userPrompt.length > this.MAX_PROMPT_LENGTH) {
        const { truncatedProfileData, truncatedUserData } = this._truncateContent(sanitizedProfileData, templateData.userData, templateData);
        userPrompt = this._buildUserPrompt(truncatedProfileData, truncatedUserData, templateData);
        

        if (userPrompt.length > this.MAX_PROMPT_LENGTH) {
          throw new Error('Request too large even after truncation');
        }
      }

      // Make API call
      const response = await this._callGenerationAPI(userPrompt, systemPrompt);
      
      // Parse and return response
      const parsedResponse = this._parseAPIResponse(response);
      
      // Post-process to ensure name placeholders are replaced
      return this._ensureNameReplacement(parsedResponse, templateData.userData);

    } catch (error) {
      console.error('Error generating email:', error);
      return this._handleGenerationError(error);
    }
  },

  /**
   * Validate input parameters
   */
  _validateInputs(profileData, templateData) {
    if (!profileData || !profileData.name) {
      console.error('Profile data validation failed:', profileData);
      throw new Error('Invalid profile data provided');
    }

    if (!templateData || !templateData.content) {
      console.error('Template data validation failed:', templateData);
      throw new Error('Invalid template data provided');
    }
  },

  /**
   * Sanitize profile data for API consumption
   */
  _sanitizeProfileData(profileData) {
    return {
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
  },

  /**
   * Build the system prompt for AI generation
   */
  _buildSystemPrompt() {
    return `You are a professional email template assistant. Your job is to fill in bracketed placeholders with personalized, natural content while maintaining the template structure.

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
7. CRITICAL: When you see [My Name], [Your Name], or any name placeholder at the end of the email, you MUST replace it with the ACTUAL sender's name provided in the SENDER INFORMATION section. NEVER leave it as a placeholder or use generic terms.

EXAMPLES:
Template: "I think it's really cool how [talk about the company's work]"
✓ GOOD: "I think it's really cool how you're revolutionizing the fintech space with AI-powered solutions"
✗ BAD: "I think it's really cool how talk about the company's work"

Template: "[mention something specific about their background]"
✓ GOOD: "I noticed your experience leading product development at Microsoft"
✗ BAD: "mention something specific about their background"

Template: "[brief personal introduction including my background]" 
✓ GOOD: "a senior Computer Science student at UCLA with internship experience at Google and Meta"
✗ BAD: "brief personal introduction including your background"

Template: "[Connect their company's work to my own experience]. I'd love to learn about opportunities."
✓ GOOD: "Given my background in machine learning and data analytics, I'm particularly drawn to your AI-driven approach. I'd love to learn about opportunities."
✗ BAD: "Connect their company's work to your own experience. I'd love to learn about opportunities."

Template: "Best regards,\n[My Name]"
If sender's name is "Sarah Chen":
✓ GOOD: "Best regards,\nSarah Chen"
✗ BAD: "Best regards,\n[Your Name]"
✗ BAD: "Best regards,\n[My Name]"
✗ BAD: "Best regards,\n[Name]"

Template: "Thanks,\n[Your Name]"
If sender's name is "Michael Johnson":
✓ GOOD: "Thanks,\nMichael Johnson"
✗ BAD: "Thanks,\n[Your Name]"

Format: Subject$$$Body (no extra explanations)
`;
  },

  /**
   * Get user name with fallback to firstName + lastName combination
   * @param {Object} userData - User data object
   * @returns {string} User's full name
   */
  _getUserName(userData) {
    // Debug logging to understand what data we have
    console.log('======================================');
    console.log('🔍 [EmailGenerator] _getUserName called');
    console.log('📦 userData received:', userData);
    console.log('📧 Available fields:', Object.keys(userData || {}));
    console.log('📊 Field values:');
    console.log('  - email:', userData?.email);
    console.log('  - name:', userData?.name);
    console.log('  - firstName:', userData?.firstName);
    console.log('  - lastName:', userData?.lastName);
    console.log('======================================');
    
    // First try the direct name field (from Google auth)
    if (userData?.name && typeof userData.name === 'string' && userData.name.trim()) {
      console.log('✅ Found name in userData.name:', userData.name);
      return userData.name.trim();
    }
    console.log('❌ userData.name not found or empty (value:', userData?.name, ')');

    // Fallback to combining firstName + lastName (from profile)
    if (userData && (userData.firstName || userData.lastName)) {
      const firstName = userData.firstName || '';
      const lastName = userData.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName) {
        console.log('✅ Found name from firstName + lastName:', fullName);
        return fullName;
      }
    }
    console.log('❌ firstName/lastName not found or empty');
    
    // Try email-based name (before @ symbol, capitalize first letter)
    if (userData?.email && userData.email.trim()) {
      const emailName = userData.email.split('@')[0];
      // Convert "john.doe" or "john_doe" to "John Doe"
      const formattedName = emailName
        .replace(/[._-]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      if (formattedName) {
        console.log('⚠️  Generated name from email:', formattedName);
        console.warn('⚠️  USER NAME NOT FOUND: Using email-based fallback. Please complete your profile setup.');
        return formattedName;
      }
    }
    console.log('❌ email not found or empty');

    // Final fallback with warning
    console.error('❌ CRITICAL: Could not find user name in userData. Email will end with "Not specified".');
    console.error('💡 SOLUTION: Please reload the extension or complete your profile.');
    console.error('Available userData fields:', Object.keys(userData || {}));
    console.error('userData values:', userData);
    return 'Not specified';
  },

  /**
   * Build the user prompt with profile and template data
   */
  _buildUserPrompt(profileData, userData, templateData) {
    // Extract first name from full name
    const firstName = profileData.name ? profileData.name.split(' ')[0] : '';

    // Format user experiences for context
    const userExperiencesText = userData?.experiences ?
      userData.experiences.map(exp => `${exp.title} at ${exp.company}: ${exp.description}`).join('\n') :
      'Not provided';

    return `TASK: Fill in the email template with personalized content. Replace ALL bracketed placeholders with natural, professional content.

==== EMAIL TEMPLATES ====

SUBJECT TEMPLATE:
${templateData.subjectLine}

BODY TEMPLATE:
${templateData.content}

==== RECIPIENT INFORMATION ====

Full Name: ${profileData.name}
First Name: ${firstName}
Company: ${profileData.company || 'Not specified'}
Headline: ${profileData.headline || 'Not specified'}
About Section: ${profileData.about || 'Not specified'}
Experience: ${profileData.experience && profileData.experience.length > 0 ? profileData.experience.map(e => e.content).join('; ') : 'Not specified'}

  ==== SENDER INFORMATION (THIS IS WHO IS SENDING THE EMAIL) ====

  SENDER'S FULL NAME: ${this._getUserName(userData)}
  My College: ${userData?.college || 'Not specified'}
  My Graduation Year: ${userData?.graduationYear || 'Not specified'}
  My Experiences: ${userExperiencesText}

==== INSTRUCTIONS ====

1. Replace [Recipient Name] with the recipient's full name: ${profileData.name}
2. Replace [Recipient First Name] with the recipient's first name: ${firstName}
3. Replace [My Name], [Your Name], or any name placeholder with the SENDER'S FULL NAME: ${this._getUserName(userData)}
4. For instruction placeholders (like "[talk about...]"), write natural content following the instruction
5. Use the recipient's company information, experience, and background to personalize the content
6. Connect the recipient's work to your own experiences when relevant and instructed
7. Make the email sound professional but friendly, appropriate for networking
8. Keep all text outside brackets exactly the same
9. CRITICAL: The email signature MUST end with the sender's actual name (${this._getUserName(userData)}), NOT with a placeholder

REQUIRED OUTPUT FORMAT: 
You MUST respond with this exact format:
[Subject Line]$$$[Email Body]

Example (if sender's name is "James Miller"):
Coffee Chat Request$$$Hi John,

I'm really impressed by how Microsoft is advancing AI research and its practical applications in cloud computing.

I'd love to connect and learn more about your experience in the tech industry. Would you be open to a brief coffee chat?

Best regards,
James Miller

Remember: Use $$$ as the delimiter between subject and body. The email MUST end with the sender's actual name (${this._getUserName(userData)}), NOT a placeholder.
  `;
  },

  /**
   * Truncate content intelligently to fit prompt limits
   */
  _truncateContent(profileData, userData, templateData) {
    const truncatedProfileData = { ...profileData };

    // Truncate About section to first 300 characters if it exists
    if (truncatedProfileData.about && truncatedProfileData.about.length > 300) {
      truncatedProfileData.about = truncatedProfileData.about.substring(0, 300) + '...';
    }

    // Keep only 2-3 most recent experiences with shortened descriptions
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
  },

  /**
   * Call the email generation API
   */
  async _callGenerationAPI(userPrompt, systemPrompt) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(this.API_ENDPOINT, {
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

      return data;

    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw fetchError;
    }
  },

  /**
   * Parse the API response and extract subject/body
   */
  _parseAPIResponse(data) {
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


    // Parse the response into subject and email parts
    const parts = responseContent.split('$$$');

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
  },

  /**
   * Ensure name placeholders are replaced with actual user name
   * This is a safeguard in case the AI doesn't follow instructions
   */
  _ensureNameReplacement(parsedResponse, userData) {
    const userName = this._getUserName(userData);
    
    // If we don't have a valid user name, return as is
    if (!userName || userName === 'Not specified') {
      return parsedResponse;
    }
    
    // List of common name placeholder patterns
    const namePlaceholders = [
      /\[My Name\]/gi,
      /\[Your Name\]/gi,
      /\[Name\]/gi,
      /\[my name\]/g,
      /\[your name\]/g,
      /\[sender name\]/gi,
      /\[sender's name\]/gi
    ];
    
    // Replace placeholders in the email body
    let cleanedEmail = parsedResponse.email;
    namePlaceholders.forEach(placeholder => {
      cleanedEmail = cleanedEmail.replace(placeholder, userName);
    });
    
    // Also replace in subject (less common but possible)
    let cleanedSubject = parsedResponse.subject;
    namePlaceholders.forEach(placeholder => {
      cleanedSubject = cleanedSubject.replace(placeholder, userName);
    });
    
    return {
      subject: cleanedSubject,
      email: cleanedEmail
    };
  },

  /**
   * Handle generation errors with appropriate fallbacks
   */
  _handleGenerationError(error) {
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
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmailGenerator;
} 