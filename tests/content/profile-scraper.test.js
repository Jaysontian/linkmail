const { createMockLinkedInProfile, createMockContactModal, mockChromeAPIs, simulateDelay } = require('../helpers/test-utils');

// Mock browser globals
global.window = global.window || {};
global.Utils = {
  extractEmail: jest.fn((text) => {
    const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;
    const match = text.match(emailRegex);
    return match ? match[0] : null;
  })
};

// Import and set up the ProfileScraper module
let ProfileScraper;
beforeAll(() => {
  // Set up browser-like environment
  global.window.ProfileScraper = {};
  
  // Import the module
  require('../../content/profile-scraper');
  
  // Get the module from the global window object
  ProfileScraper = global.window.ProfileScraper || require('../../content/profile-scraper');
});

describe('ProfileScraper', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    fetch.mockClear();
    mockChromeAPIs();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('scrapeBasicProfileData', () => {
    it('should extract basic profile information from LinkedIn page', async () => {
      // Mock DOM querySelector to return the expected elements
      const originalQuerySelector = document.querySelector;
             document.querySelector = jest.fn((selector) => {
         if (selector === 'h1') {
           return { innerText: 'Jane Smith' };
         }
         if (selector === '.text-body-medium') {
           return { innerText: 'Senior Software Engineer at Google' };
         }
         if (selector === '.pv-profile-card .display-flex.ph5.pv3 .inline-show-more-text--is-collapsed') {
           return { innerText: 'Senior Software Engineer at Google. Contact me at jane.smith@google.com' };
         }
         if (selector === '#experience') {
           return { 
             parentElement: { 
               querySelectorAll: () => [],
               querySelector: (sel) => {
                 if (sel === 'li.artdeco-list__item') {
                   return {
                     querySelector: (innerSel) => {
                       if (innerSel === '.t-normal') {
                         return { textContent: 'Google' };
                       }
                       return null;
                     }
                   };
                 }
                 return null;
               }
             } 
           };
         }
         return null;
       });

      // Mock querySelectorAll for the document
      document.querySelectorAll = jest.fn(() => []);

      const result = await ProfileScraper.scrapeBasicProfileData();

      expect(result.name).toBe('Jane Smith');
      expect(result.headline).toBe('Senior Software Engineer at Google');
      expect(result.emailFromAbout).toBe('jane.smith@google.com');
      
      // Restore original function
      document.querySelector = originalQuerySelector;
    });

    it('should handle missing profile elements gracefully', async () => {
      // Mock DOM querySelector to return minimal elements
      const originalQuerySelector = document.querySelector;
             document.querySelector = jest.fn((selector) => {
         if (selector === 'h1') {
           return { innerText: 'John Doe' };
         }
         if (selector === '#experience') {
           return { 
             parentElement: { 
               querySelectorAll: () => [],
               querySelector: () => null  // No company data for this test
             } 
           };
         }
         return null;
       });

      document.querySelectorAll = jest.fn(() => []);

      const result = await ProfileScraper.scrapeBasicProfileData();

      expect(result.name).toBe('John Doe');
      expect(result.headline).toBe('');
      expect(result.company).toBe('');
      
      // Restore original function
      document.querySelector = originalQuerySelector;
    });

    it('should extract email from about section when available', async () => {
      // Mock DOM querySelector to return about section with email
      const originalQuerySelector = document.querySelector;
             document.querySelector = jest.fn((selector) => {
         if (selector === 'h1') {
           return { innerText: 'Test User' };
         }
         if (selector === '.pv-profile-card .display-flex.ph5.pv3 .inline-show-more-text--is-collapsed') {
           return { innerText: 'Software Engineer at Test Corp. Contact me at test@example.com' };
         }
         if (selector === '#experience') {
           return { 
             parentElement: { 
               querySelectorAll: () => [],
               querySelector: () => null  // No company data for this test
             } 
           };
         }
         return null;
       });

      document.querySelectorAll = jest.fn(() => []);

      const result = await ProfileScraper.scrapeBasicProfileData();

      expect(result.emailFromAbout).toBe('test@example.com');
      
      // Restore original function
      document.querySelector = originalQuerySelector;
    });
  });

  describe('generateColdEmail', () => {
    const mockProfileData = {
      name: 'Alice Johnson',
      headline: 'Product Manager at Meta',
      company: 'Meta',
      about: 'Passionate about building products that scale to billions of users.',
      experience: [
        { content: 'Product Manager at Meta (2020-present)' },
        { content: 'Software Engineer at Google (2018-2020)' }
      ]
    };

    const mockTemplateData = {
      name: 'Coffee Chat',
      content: 'Hi [Recipient First Name],\n\nI\'m a Computer Science student at UCLA. [Mention something about their work].\n\nBest regards,\n[Sender Name]',
      subjectLine: 'Coffee Chat with [Recipient Name]',
      userData: {
        name: 'John Student',
        college: 'UCLA',
        graduationYear: '2025'
      }
    };

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should generate personalized email with proper format', async () => {
      // Mock successful API response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: 'Coffee Chat with Alice Johnson$$$Hi Alice,\n\nI\'m a Computer Science student at UCLA. I\'m really impressed by Meta\'s work on building products that scale to billions of users.\n\nBest regards,\nJohn Student'
        })
      });

      const result = await ProfileScraper.generateColdEmail(mockProfileData, mockTemplateData);

      expect(result).toEqual({
        subject: 'Coffee Chat with Alice Johnson',
        email: expect.stringContaining('Hi Alice')
      });
      expect(result.email).toContain('John Student');
      expect(result.email).toContain('Meta\'s work');
    });

    it('should handle API responses without delimiter gracefully', async () => {
      // Mock API response without $$$ delimiter
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: 'Coffee Chat with Alice Johnson\n\nHi Alice,\n\nI\'m a Computer Science student at UCLA. Great work at Meta!\n\nBest regards,\nJohn Student'
        })
      });

      const result = await ProfileScraper.generateColdEmail(mockProfileData, mockTemplateData);

      expect(result.subject).toBe('Coffee Chat with Alice Johnson');
      expect(result.email).toContain('Hi Alice');
    });

    it('should handle different API response structures', async () => {
      // Test response with different structure
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'Coffee Chat$$$Hi Alice, Nice to meet you!'
        })
      });

      const result = await ProfileScraper.generateColdEmail(mockProfileData, mockTemplateData);

      expect(result.subject).toBe('Coffee Chat');
      expect(result.email).toBe('Hi Alice, Nice to meet you!');
    });

    it('should handle OpenAI-style API responses', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: 'Meeting Request$$$Hi Alice,\n\nWould love to connect!\n\nBest,\nJohn'
            }
          }]
        })
      });

      const result = await ProfileScraper.generateColdEmail(mockProfileData, mockTemplateData);

      expect(result.subject).toBe('Meeting Request');
      expect(result.email).toContain('Hi Alice');
    });

    it('should provide helpful error messages for invalid profile data', async () => {
      const result = await ProfileScraper.generateColdEmail(null, mockTemplateData);

      expect(result.subject).toBe('Connection Request');
      expect(result.email).toContain('Could not get profile information');
    });

    it('should provide helpful error messages for invalid template data', async () => {
      const result = await ProfileScraper.generateColdEmail(mockProfileData, null);

      expect(result.subject).toBe('Connection Request');
      expect(result.email).toContain('Email template is not properly configured');
    });

    it('should handle API timeouts gracefully', async () => {
      // Mock timeout that rejects after delay
      fetch.mockImplementationOnce(() => 
        Promise.reject(new Error('Request timed out'))
      );

      const result = await ProfileScraper.generateColdEmail(mockProfileData, mockTemplateData);

      expect(result.subject).toBe('Connection Request');
      expect(result.email).toContain('Email generation timed out');
    }, 15000);

    it('should handle API server errors gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server Error')
      });

      const result = await ProfileScraper.generateColdEmail(mockProfileData, mockTemplateData);

      expect(result.subject).toBe('Connection Request');
      expect(result.email).toContain('Email generation service is temporarily unavailable');
    });

    it('should handle large profile data by truncating', async () => {
      const largeProfileData = {
        ...mockProfileData,
        about: 'A'.repeat(5000), // Very long about section
        experience: Array(50).fill({ content: 'B'.repeat(200) }) // Many long experiences
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: 'Connection Request$$$Hi there, nice profile!'
        })
      });

      const result = await ProfileScraper.generateColdEmail(largeProfileData, mockTemplateData);

      expect(result.subject).toBe('Connection Request');
      expect(result.email).toContain('Hi there');
      
      // Verify fetch was called with truncated data
      const callData = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callData.prompt.length).toBeLessThan(10000);
    });

    it('should include user experience context in generation', async () => {
      const templateWithUserData = {
        ...mockTemplateData,
        userData: {
          name: 'John Student',
          college: 'UCLA',
          graduationYear: '2025',
          experiences: [
            {
              title: 'Software Engineering Intern',
              company: 'Google',
              description: 'Worked on machine learning algorithms'
            }
          ]
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: 'Coffee Chat$$$Hi Alice, great ML work at Meta!'
        })
      });

      await ProfileScraper.generateColdEmail(mockProfileData, templateWithUserData);

      // Verify user experience was included in the prompt
      const callData = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callData.prompt).toContain('Software Engineering Intern at Google');
      expect(callData.prompt).toContain('machine learning algorithms');
    });
  });

  describe('cleanupEmail', () => {
    it('should remove extra whitespace and normalize formatting', () => {
      const messyEmail = '  test@example.com  \n\n  ';
      const result = ProfileScraper.cleanupEmail(messyEmail);
      expect(result).toBe('test@example.com');
    });

    it('should handle null and undefined inputs', () => {
      expect(ProfileScraper.cleanupEmail(null)).toBe('');
      expect(ProfileScraper.cleanupEmail(undefined)).toBe('');
    });
  });

  describe('extractEmailFromText', () => {
    it('should extract valid email addresses from text', () => {
      const text = 'Contact me at john.doe@company.com for more info';
      const result = ProfileScraper.extractEmailFromText(text);
      expect(result).toBe('john.doe@company.com');
    });

    it('should return null for text without email addresses', () => {
      const text = 'No email address here';
      const result = ProfileScraper.extractEmailFromText(text);
      expect(result).toBeNull();
    });

    it('should handle multiple email addresses by returning the first one', () => {
      const text = 'Emails: first@test.com and second@test.com';
      const result = ProfileScraper.extractEmailFromText(text);
      expect(result).toBe('first@test.com');
    });
  });
}); 