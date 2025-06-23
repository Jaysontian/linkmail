const { 
  createMockLinkedInProfile, 
  createMockLinkMailUI, 
  mockChromeAPIs, 
  simulateDelay,
  createTestTemplates 
} = require('../helpers/test-utils');

// Mock all required modules
global.ProfileScraper = require('../../content/profile-scraper');
global.EmailFinder = require('../../content/email-finder');
global.UIManager = require('../../content/ui-manager');
global.GmailManager = require('../../content/gmail-manager');

describe('Email Generation Workflow Integration', () => {
  let mockUI;
  // UIManager is an object literal, not a constructor - we'll use it directly

  beforeEach(() => {
    document.body.innerHTML = '';
    fetch.mockClear();
    jest.clearAllMocks();
    
    mockChromeAPIs({
      authenticated: true,
      userData: {
        email: 'test@example.com',
        name: 'Test User',
        college: 'UCLA',
        graduationYear: '2025',
        experiences: [
          {
            title: 'Software Engineering Intern',
            company: 'Google',
            description: 'Worked on machine learning algorithms'
          }
        ],
        templates: createTestTemplates(2)
      }
    });

    // Create mock UI
    mockUI = createMockLinkMailUI({ currentView: 'splash' });
    
    // Initialize UI Manager (object literal)
    UIManager.isAuthenticated = true;
    UIManager.userData = {
      email: 'test@example.com',
      name: 'Test User',
      college: 'UCLA',
      graduationYear: '2025',
      experiences: [
        {
          title: 'Software Engineering Intern',
          company: 'Google',
          description: 'Worked on machine learning algorithms'
        }
      ],
      templates: createTestTemplates(2)
    };
  });

  afterEach(() => {
    if (mockUI) {
      mockUI.cleanup();
    }
    document.body.innerHTML = '';
  });

  describe('Complete Email Generation Flow', () => {
    it('should complete full workflow: profile scraping → email generation → UI update', async () => {
      // Step 1: Setup LinkedIn profile page
      const profileMock = createMockLinkedInProfile({
        name: 'Alice Johnson',
        title: 'Senior Product Manager',
        company: 'Meta',
        email: 'alice.johnson@meta.com'
      });

      // Step 2: Mock successful API response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: 'Coffee Chat with Alice Johnson$$$Hi Alice,\n\nI\'m a Computer Science student at UCLA with internship experience at Google. I\'m really impressed by Meta\'s innovative approach to building products that connect billions of people.\n\nGiven my background in machine learning algorithms, I\'m particularly interested in how Meta leverages AI for personalization. Would you be open to a brief coffee chat?\n\nBest regards,\nTest User'
        })
      });

      // Step 3: Set up template
      UIManager.selectedTemplate = {
        name: 'Coffee Chat',
        content: 'Hi [Recipient First Name],\n\nI\'m a Computer Science student at UCLA. [Mention something specific about their work at their company].\n\n[Connect their work to your experience]. Would you be open to a brief coffee chat?\n\nBest regards,\n[Sender Name]',
        subjectLine: 'Coffee Chat with [Recipient Name]',
        userData: UIManager.userData
      };

      // Step 4: Execute the workflow
      const profileData = await ProfileScraper.scrapeBasicProfileData();
      const emailResponse = await ProfileScraper.generateColdEmail(profileData, UIManager.selectedTemplate);

      // Step 5: Verify results
      expect(profileData.name).toBe('Alice Johnson');
      expect(profileData.company).toContain('Meta');
      expect(profileData.emailFromAbout).toBe('alice.johnson@meta.com');

      expect(emailResponse.subject).toBe('Coffee Chat with Alice Johnson');
      expect(emailResponse.email).toContain('Hi Alice');
      expect(emailResponse.email).toContain('Meta\'s innovative approach');
      expect(emailResponse.email).toContain('machine learning algorithms');
      expect(emailResponse.email).toContain('Test User');

      // Step 6: Verify API call was made with correct data
      expect(fetch).toHaveBeenCalledWith(
        'https://linkmail-api.vercel.app/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: expect.stringContaining('Alice Johnson')
        })
      );

      const apiCallBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(apiCallBody.prompt).toContain('Alice Johnson');
      expect(apiCallBody.prompt).toContain('Meta');
      expect(apiCallBody.prompt).toContain('Test User');
      expect(apiCallBody.prompt).toContain('Google');
    });

    it('should handle missing email with Apollo fallback', async () => {
      // Step 1: Setup profile without email
      createMockLinkedInProfile({
        name: 'Bob Smith',
        title: 'Software Engineer',
        company: 'Startup Inc',
        hasAboutSection: false,
        hasContactInfo: false
      });

      // Step 2: Mock Apollo API success
      chrome.runtime.sendMessage.callsFake((message, callback) => {
        if (message.action === 'enrichWithApollo') {
          callback({
            success: true,
            email: 'bob.smith@startup.com',
            source: 'apollo'
          });
        }
      });

      // Step 3: Mock email generation
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: 'Connection Request$$$Hi Bob,\n\nGreat work at Startup Inc!\n\nBest,\nTest User'
        })
      });

      // Step 4: Execute workflow with Apollo fallback
      const profileData = await ProfileScraper.scrapeBasicProfileData();
      const apolloResult = await EmailFinder.findEmailWithApollo(profileData);
      
      // Add Apollo email to profile data
      const enrichedProfileData = {
        ...profileData,
        email: apolloResult.email
      };

      const emailResponse = await ProfileScraper.generateColdEmail(enrichedProfileData, UIManager.selectedTemplate);

      // Step 5: Verify Apollo integration worked
      expect(apolloResult.success).toBe(true);
      expect(apolloResult.email).toBe('bob.smith@startup.com');
      expect(emailResponse.email).toContain('Hi Bob');
    });

    it('should gracefully degrade when all email finding methods fail', async () => {
      // Step 1: Setup profile without email
      createMockLinkedInProfile({
        name: 'Jane Doe',
        title: 'CEO',
        company: 'Stealth Startup',
        hasAboutSection: false,
        hasContactInfo: false
      });

      // Step 2: Mock Apollo API failure
      chrome.runtime.sendMessage.callsFake((message, callback) => {
        if (message.action === 'enrichWithApollo') {
          callback({
            success: false,
            error: 'No email found in Apollo database'
          });
        }
      });

      // Step 3: Mock email generation still succeeds
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: 'Connection Request$$$Hi Jane,\n\nImpressed by your work at Stealth Startup.\n\nBest regards,\nTest User'
        })
      });

      // Step 4: Execute workflow
      const profileData = await ProfileScraper.scrapeBasicProfileData();
      const apolloResult = await EmailFinder.findEmailWithApollo(profileData);
      const emailResponse = await ProfileScraper.generateColdEmail(profileData, UIManager.selectedTemplate);

      // Step 5: Verify graceful handling
      expect(apolloResult.success).toBe(false);
      expect(emailResponse.email).toContain('Hi Jane');
      expect(emailResponse.subject).toBe('Connection Request');
    });
  });

  describe('Template Processing Integration', () => {
    it('should correctly process complex template with multiple placeholders', async () => {
      // Setup complex template
      const complexTemplate = {
        name: 'Advanced Networking',
        content: 'Hi [Recipient First Name],\n\nI\'m [brief introduction with your background] at [Your College]. I was particularly impressed by [mention specific aspect of their company\'s work or recent achievements].\n\n[Connect their work to your experience and interests]. I believe there could be great synergy between [mention a specific area of overlap].\n\nWould you be interested in [suggest specific type of collaboration or meeting]?\n\nBest regards,\n[Sender Name]',
        subjectLine: '[Your Name] from [Your College] - [Recipient Company] Collaboration',
        userData: {
          name: 'Test User',
          college: 'UCLA',
          experiences: [
            {
              title: 'ML Research Assistant',
              company: 'UCLA AI Lab',
              description: 'Published research on computer vision'
            }
          ]
        }
      };

      createMockLinkedInProfile({
        name: 'Dr. Sarah Chen',
        title: 'VP of AI Research',
        company: 'NVIDIA',
        about: 'Leading breakthrough research in computer vision and autonomous systems at NVIDIA.'
      });

      // Mock sophisticated API response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: 'Test User from UCLA - NVIDIA Collaboration$$$Hi Sarah,\n\nI\'m a Computer Science student and ML Research Assistant at UCLA. I was particularly impressed by NVIDIA\'s groundbreaking work in computer vision and how it\'s revolutionizing autonomous systems.\n\nGiven my research background in computer vision at UCLA AI Lab where I\'ve published work in this area, I\'m deeply interested in NVIDIA\'s approach to real-time inference optimization. I believe there could be great synergy between academic research and industry applications in autonomous vehicle perception.\n\nWould you be interested in discussing potential research collaboration or internship opportunities?\n\nBest regards,\nTest User'
        })
      });

      const profileData = await ProfileScraper.scrapeBasicProfileData();
      const emailResponse = await ProfileScraper.generateColdEmail(profileData, complexTemplate);

      expect(emailResponse.subject).toBe('Test User from UCLA - NVIDIA Collaboration');
      expect(emailResponse.email).toContain('Hi Sarah');
      expect(emailResponse.email).toContain('UCLA');
      expect(emailResponse.email).toContain('NVIDIA\'s groundbreaking work');
      expect(emailResponse.email).toContain('computer vision');
      expect(emailResponse.email).toContain('research collaboration');
    });

    it('should handle template with user experience integration', async () => {
      const templateWithExperience = {
        name: 'Experience-Based Outreach',
        content: 'Hi [Recipient First Name],\n\nAs someone with experience in [mention your relevant experience], I\'m fascinated by [mention something specific about their company\'s work in related area].\n\n[Draw connection between your experience and their company\'s mission]. I\'d love to learn more about [specific aspect of their work].\n\nBest regards,\n[Sender Name]',
        userData: {
          name: 'Test User',
          experiences: [
            {
              title: 'Data Science Intern',
              company: 'Netflix',
              description: 'Built recommendation algorithms using collaborative filtering'
            },
            {
              title: 'Backend Engineer',
              company: 'Spotify',
              description: 'Optimized music streaming infrastructure'
            }
          ]
        }
      };

      createMockLinkedInProfile({
        name: 'Alex Rodriguez',
        company: 'Spotify',
        title: 'Senior Engineering Manager',
        about: 'Leading the team that builds the recommendation engine powering music discovery for 500M+ users.'
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: 'Connecting on Recommendation Systems$$$Hi Alex,\n\nAs someone with experience in building recommendation algorithms at Netflix and optimizing streaming infrastructure at Spotify, I\'m fascinated by how Spotify\'s recommendation engine has evolved to serve 500M+ users.\n\nMy background in collaborative filtering and infrastructure optimization has given me deep appreciation for the challenges of real-time personalization at scale. I\'d love to learn more about Spotify\'s approach to balancing recommendation accuracy with system performance.\n\nBest regards,\nTest User'
        })
      });

      const profileData = await ProfileScraper.scrapeBasicProfileData();
      const emailResponse = await ProfileScraper.generateColdEmail(profileData, templateWithExperience);

      expect(emailResponse.email).toContain('Netflix');
      expect(emailResponse.email).toContain('Spotify');
      expect(emailResponse.email).toContain('recommendation algorithms');
      expect(emailResponse.email).toContain('500M+ users');
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from API timeout and provide helpful fallback', async () => {
      createMockLinkedInProfile({
        name: 'Timeout Test',
        company: 'Test Corp'
      });

      // Mock API timeout
      fetch.mockImplementationOnce(() => 
        new Promise(() => {}) // Never resolves
      );

      jest.useFakeTimers();
      
      const emailPromise = ProfileScraper.generateColdEmail(
        { name: 'Timeout Test', company: 'Test Corp' },
        uiManager.selectedTemplate
      );

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(30000);
      
      const result = await emailPromise;

      expect(result.subject).toBe('Connection Request');
      expect(result.email).toContain('Email generation timed out');
      expect(result.email).toContain('As a fallback, here\'s a simple message');

      jest.useRealTimers();
    });

    it('should handle malformed API responses gracefully', async () => {
      createMockLinkedInProfile({
        name: 'Malformed Test',
        company: 'Test Corp'
      });

      // Mock malformed API response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          // Missing 'result' field
          data: 'This is malformed'
        })
      });

      const result = await ProfileScraper.generateColdEmail(
        { name: 'Malformed Test', company: 'Test Corp' },
        uiManager.selectedTemplate
      );

      expect(result.subject).toBe('Connection Request');
      expect(result.email).toContain('An error occurred while generating the email');
      expect(result.email).toContain('As a fallback');
    });

    it('should handle LinkedIn profile scraping failures', async () => {
      // Don't create any profile elements
      document.body.innerHTML = '<div>No profile here</div>';

      const result = await ProfileScraper.generateColdEmail(
        null, // Invalid profile data
        uiManager.selectedTemplate
      );

      expect(result.subject).toBe('Connection Request');
      expect(result.email).toContain('Could not get profile information');
    });
  });

  describe('End-to-End Sending Workflow', () => {
    it('should complete full send workflow: generate → populate form → send → save', async () => {
      // Step 1: Setup complete UI
      const recipientInput = document.createElement('input');
      recipientInput.id = 'recipientEmailInput';
      document.body.appendChild(recipientInput);

      const subjectInput = document.createElement('input');
      subjectInput.id = 'emailSubject';
      document.body.appendChild(subjectInput);

      const contentTextarea = document.createElement('textarea');
      contentTextarea.id = 'emailResult';
      document.body.appendChild(contentTextarea);

      // Step 2: Setup mocks
      createMockLinkedInProfile({
        name: 'Send Test User',
        email: 'sendtest@example.com'
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: 'Test Subject$$$Test email content for sending'
        })
      });

      // Mock Gmail sending
      const mockSendAndSave = jest.fn().mockResolvedValue({ id: 'sent-123' });
      global.GmailManager = { sendAndSaveEmail: mockSendAndSave };

      // Step 3: Execute generation
      const profileData = await ProfileScraper.scrapeBasicProfileData();
      const emailResponse = await ProfileScraper.generateColdEmail(profileData, uiManager.selectedTemplate);

      // Step 4: Populate form
      recipientInput.value = profileData.emailFromAbout || 'sendtest@example.com';
      subjectInput.value = emailResponse.subject;
      contentTextarea.value = emailResponse.email;

      // Step 5: Send email
      await GmailManager.sendAndSaveEmail(
        recipientInput.value,
        subjectInput.value,
        contentTextarea.value,
        []
      );

      // Step 6: Verify complete workflow
      expect(recipientInput.value).toBe('sendtest@example.com');
      expect(subjectInput.value).toBe('Test Subject');
      expect(contentTextarea.value).toBe('Test email content for sending');
      expect(mockSendAndSave).toHaveBeenCalledWith(
        'sendtest@example.com',
        'Test Subject',
        'Test email content for sending',
        []
      );
    });

    it('should handle attachment workflow', async () => {
      const templateWithAttachment = {
        ...uiManager.selectedTemplate,
        attachments: [
          {
            name: 'resume.pdf',
            data: 'base64-encoded-pdf-data',
            type: 'application/pdf'
          }
        ]
      };

      createMockLinkedInProfile({
        name: 'Attachment Test',
        email: 'attachment@test.com'
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: 'With Attachment$$$Please find my resume attached.'
        })
      });

      const mockSendAndSave = jest.fn().mockResolvedValue({ id: 'sent-with-attachment' });
      global.GmailManager = { sendAndSaveEmail: mockSendAndSave };

      const profileData = await ProfileScraper.scrapeBasicProfileData();
      const emailResponse = await ProfileScraper.generateColdEmail(profileData, templateWithAttachment);

      await GmailManager.sendAndSaveEmail(
        'attachment@test.com',
        emailResponse.subject,
        emailResponse.email,
        templateWithAttachment.attachments
      );

      expect(mockSendAndSave).toHaveBeenCalledWith(
        'attachment@test.com',
        'With Attachment',
        'Please find my resume attached.',
        [
          {
            name: 'resume.pdf',
            data: 'base64-encoded-pdf-data',
            type: 'application/pdf'
          }
        ]
      );
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle large profile data efficiently', async () => {
      // Create profile with very large about section and many experiences
      const largeProfileData = {
        name: 'Large Profile User',
        company: 'Big Corp',
        about: 'A'.repeat(10000), // Very long about section
        experience: Array(100).fill().map((_, i) => ({
          content: `Experience ${i}: ${'B'.repeat(500)}`
        }))
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: 'Large Profile Email$$$Successfully processed large profile'
        })
      });

      const start = Date.now();
      const result = await ProfileScraper.generateColdEmail(largeProfileData, uiManager.selectedTemplate);
      const duration = Date.now() - start;

      expect(result.email).toContain('Successfully processed large profile');
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify data was truncated in API call
      const apiCallBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(apiCallBody.prompt.length).toBeLessThan(10000);
    });

    it('should clean up resources after failed operations', async () => {
      createMockLinkedInProfile({
        name: 'Cleanup Test'
      });

      // Mock API failure
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await ProfileScraper.generateColdEmail(
        { name: 'Cleanup Test' },
        uiManager.selectedTemplate
      );

      // Should still provide fallback response
      expect(result.subject).toBe('Connection Request');
      expect(result.email).toContain('An error occurred');

      // Verify no memory leaks or hanging promises
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
}); 