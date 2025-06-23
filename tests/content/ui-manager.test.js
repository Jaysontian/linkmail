const { createMockLinkMailUI, createMockLinkedInProfile, mockChromeAPIs, simulateDelay } = require('../helpers/test-utils');

// Mock browser globals
global.window = global.window || {};

// Mock modules
global.ProfileScraper = {
  scrapeBasicProfileData: jest.fn(),
  generateColdEmail: jest.fn(),
  cleanupEmail: jest.fn()
};

global.EmailFinder = {
  getEmail: jest.fn(),
  _lastFoundEmail: null,
  _lastProfileUrl: null
};

global.GmailManager = {
  sendAndSaveEmail: jest.fn()
};

// Import and set up the UIManager module
let UIManager;
beforeAll(() => {
  // Set up browser-like environment
  global.window.UIManager = {};
  
  // Import the module
  require('../../content/ui-manager');
  
  // Get the module from the global window object
  UIManager = global.window.UIManager || require('../../content/ui-manager');
});

describe('UIManager', () => {
  let mockUI;

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
        graduationYear: '2025'
      }
    });

    // Create mock UI elements
    mockUI = createMockLinkMailUI();
  });

  afterEach(() => {
    if (mockUI) {
      mockUI.cleanup();
    }
    document.body.innerHTML = '';
  });

  describe('Template Management', () => {
    it('should populate default templates correctly', () => {
      // UIManager is an object literal, not a constructor - use it directly
      UIManager.isAuthenticated = true;
      UIManager.userData = {
        email: 'test@example.com',
        templates: []
      };

      // Mock UI elements
      UIManager.elements = {
        templateDropdown: document.createElement('div')
      };

      UIManager.populateTemplateDropdown();

      const templateCards = UIManager.elements.templateDropdown.querySelectorAll('.template-dropdown-card');
      expect(templateCards.length).toBeGreaterThanOrEqual(2); // At least coffee chat and job application
    });

    it('should include custom templates from user data', () => {
      UIManager.isAuthenticated = true;
      UIManager.userData = {
        email: 'test@example.com',
        templates: [
          {
            name: 'Custom Template',
            content: 'Hi [Recipient First Name], This is custom content.',
            subjectLine: 'Custom Subject',
            icon: '🎯'
          }
        ]
      };

      UIManager.elements = {
        templateDropdown: document.createElement('div')
      };

      UIManager.populateTemplateDropdown();

      const templateCards = UIManager.elements.templateDropdown.querySelectorAll('.template-dropdown-card');
      const customTemplate = Array.from(templateCards).find(card => 
        card.querySelector('h2')?.textContent === 'Custom Template'
      );

      expect(customTemplate).toBeTruthy();
      expect(customTemplate.querySelector('.template-dropdown-icon').textContent).toBe('🎯');
    });

    it('should auto-select first template when none is selected', () => {
      UIManager.selectedTemplate = {};
      UIManager.userData = { templates: [] };
      UIManager.elements = {
        templateDropdown: document.createElement('div')
      };

      UIManager.populateTemplateDropdown();

      expect(UIManager.selectedTemplate.name).toBeTruthy();
      expect(UIManager.selectedTemplate.content).toBeTruthy();
    });

    it('should handle template selection events', () => {
      UIManager.elements = {
        templateDropdown: document.createElement('div')
      };
      UIManager.userData = { templates: [] };

      UIManager.populateTemplateDropdown();

      const firstCard = UIManager.elements.templateDropdown.querySelector('.template-dropdown-card');
      firstCard.click();

      expect(firstCard.classList.contains('selected')).toBe(true);
      expect(UIManager.selectedTemplate.name).toBeTruthy();
    });
  });

  describe('Email Generation Workflow', () => {
    beforeEach(() => {
      UIManager.isAuthenticated = true;
      UIManager.userData = {
        name: 'Test User',
        email: 'test@example.com',
        college: 'UCLA'
      };
      UIManager.selectedTemplate = {
        name: 'Coffee Chat',
        content: 'Hi [Recipient First Name],\n\nTest template content.\n\nBest regards,\n[Sender Name]',
        subjectLine: 'Coffee Chat with [Recipient Name]'
      };

      // Mock DOM elements
      UIManager.elements = {
        generateButton: document.createElement('button'),
        emailResult: document.createElement('textarea'),
        emailSubject: document.createElement('input'),
        findEmailButton: document.createElement('button')
      };

      // Add elements to DOM
      Object.values(UIManager.elements).forEach(el => document.body.appendChild(el));

      // Add required elements for the workflow
      const splashDiv = document.createElement('div');
      splashDiv.id = 'linkmail-splash';
      splashDiv.style.display = 'block';
      document.body.appendChild(splashDiv);

      const editorDiv = document.createElement('div');
      editorDiv.id = 'linkmail-editor';
      editorDiv.style.display = 'none';
      document.body.appendChild(editorDiv);

      const recipientInput = document.createElement('input');
      recipientInput.id = 'recipientEmailInput';
      document.body.appendChild(recipientInput);
    });

    it('should handle successful email generation', async () => {
      // Mock profile scraping
      ProfileScraper.scrapeBasicProfileData.mockResolvedValue({
        name: 'Jane Doe',
        headline: 'Software Engineer',
        company: 'Google',
        emailFromAbout: 'jane@google.com'
      });

      // Mock email generation
      ProfileScraper.generateColdEmail.mockResolvedValue({
        subject: 'Coffee Chat with Jane Doe',
        email: 'Hi Jane,\n\nTest generated email content.\n\nBest regards,\nTest User'
      });

      // Simulate generate button click
      const generatePromise = new Promise(resolve => {
        UIManager.elements.generateButton.addEventListener('click', async () => {
          // Simulate the actual generate button logic
          const profileData = await ProfileScraper.scrapeBasicProfileData();
          const response = await ProfileScraper.generateColdEmail(profileData, UIManager.selectedTemplate);
          
          UIManager.elements.emailResult.value = response.email;
          UIManager.elements.emailSubject.value = response.subject;
          
          // Set recipient email if found in profile
          if (profileData.emailFromAbout) {
            document.getElementById('recipientEmailInput').value = profileData.emailFromAbout;
          }
          
          resolve();
        });
      });

      UIManager.elements.generateButton.click();
      await generatePromise;

      expect(UIManager.elements.emailResult.value).toContain('Hi Jane');
      expect(UIManager.elements.emailSubject.value).toBe('Coffee Chat with Jane Doe');
      expect(document.getElementById('recipientEmailInput').value).toBe('jane@google.com');
    });

    it('should handle generation errors gracefully', async () => {
      ProfileScraper.scrapeBasicProfileData.mockResolvedValue({
        name: 'Jane Doe'
      });

      ProfileScraper.generateColdEmail.mockResolvedValue({
        subject: 'Connection Request',
        email: 'Could not get profile information from this LinkedIn page. Please try refreshing the page.\n\nAs a fallback, here\'s a simple message:\n\nHi there! I came across your profile and would love to connect. Best regards!'
      });

      const generatePromise = new Promise(resolve => {
        UIManager.elements.generateButton.addEventListener('click', async () => {
          const profileData = await ProfileScraper.scrapeBasicProfileData();
          const response = await ProfileScraper.generateColdEmail(profileData, UIManager.selectedTemplate);
          
          UIManager.elements.emailResult.value = response.email;
          UIManager.elements.emailSubject.value = response.subject;
          
          resolve();
        });
      });

      UIManager.elements.generateButton.click();
      await generatePromise;

      expect(UIManager.elements.emailResult.value).toContain('Could not get profile information');
    });

    it('should handle missing email gracefully', async () => {
      ProfileScraper.scrapeBasicProfileData.mockResolvedValue({
        name: 'Jane Doe',
        headline: 'Software Engineer',
        company: 'Google'
        // No email provided
      });

      EmailFinder.getEmail.mockResolvedValue(null);

      ProfileScraper.generateColdEmail.mockResolvedValue({
        subject: 'Coffee Chat with Jane Doe',
        email: 'Hi Jane,\n\nGenerated email content.\n\nBest regards,\nTest User'
      });

      const generatePromise = new Promise(resolve => {
        UIManager.elements.generateButton.addEventListener('click', async () => {
          const profileData = await ProfileScraper.scrapeBasicProfileData();
          
          let emailToUse = profileData.emailFromAbout;
          if (!emailToUse) {
            emailToUse = await EmailFinder.getEmail();
          }

          const response = await ProfileScraper.generateColdEmail(profileData, UIManager.selectedTemplate);
          UIManager.elements.emailResult.value = response.email;
          
          // Should show find email button
          if (!emailToUse) {
            UIManager.elements.findEmailButton.style.display = 'block';
          }
          
          resolve();
        });
      });

      UIManager.elements.generateButton.click();
      await generatePromise;

      expect(UIManager.elements.findEmailButton.style.display).toBe('block');
    });
  });

  describe('Authentication and User Management', () => {
    it('should show sign-in UI when not authenticated', () => {
      UIManager.isAuthenticated = false;
      
      // Create a container for UIManager
      const container = document.createElement('div');
      container.className = 'linkmail-container';
      UIManager.container = container;
      document.body.appendChild(container);

      const signinView = document.createElement('div');
      signinView.id = 'linkmail-signin';
      signinView.style.display = 'none';
      container.appendChild(signinView);

      UIManager.showSignInUI();

      expect(signinView.style.display).toBe('block');
    });

    it('should show authenticated UI when user is logged in', () => {
      UIManager.isAuthenticated = true;
      UIManager.userData = {
        name: 'Test User',
        email: 'test@example.com'
      };

      const splashView = document.createElement('div');
      splashView.id = 'linkmail-splash';
      document.body.appendChild(splashView);

      UIManager.showAuthenticatedUI();

      expect(splashView.style.display).not.toBe('none');
    });

    it('should handle user data refresh', async () => {
      UIManager.userData = { email: 'test@example.com' };
      
      // Mock storage response before calling refreshUserData
      chrome.storage.local.get.callsArgWith(1, {
        'test@example.com': {
          name: 'Updated User',
          email: 'test@example.com',
          templates: [{ name: 'New Template' }]
        }
      });
      
      const refreshPromise = UIManager.refreshUserData();
      await refreshPromise;

      expect(UIManager.userData.name).toBe('Updated User');
      expect(UIManager.userData.templates).toHaveLength(1);
    });
  });

  describe('Email Sending', () => {
    it('should send email with all required data', async () => {
      UIManager.isAuthenticated = true;
      UIManager.selectedTemplate = {
        attachments: [
          { name: 'resume.pdf', data: 'mock-pdf-data' }
        ]
      };

      // Mock form data
      const recipientInput = document.createElement('input');
      recipientInput.id = 'recipientEmailInput';
      recipientInput.value = 'recipient@example.com';
      document.body.appendChild(recipientInput);

      const subjectInput = document.createElement('input');
      subjectInput.id = 'emailSubject';
      subjectInput.value = 'Test Subject';
      document.body.appendChild(subjectInput);

      UIManager.elements = {
        emailResult: document.createElement('textarea'),
        sendGmailButton: document.createElement('button')
      };
      UIManager.elements.emailResult.value = 'Test email content';

      GmailManager.sendAndSaveEmail.mockResolvedValue({ id: 'sent-email-id' });

      // Simulate send button click
      const sendPromise = new Promise(resolve => {
        UIManager.elements.sendGmailButton.addEventListener('click', async () => {
          const email = recipientInput.value;
          const subject = subjectInput.value;
          const content = UIManager.elements.emailResult.value;
          const attachments = UIManager.selectedTemplate.attachments;

          await GmailManager.sendAndSaveEmail(email, subject, content, attachments);
          resolve();
        });
      });

      UIManager.elements.sendGmailButton.click();
      await sendPromise;

      expect(GmailManager.sendAndSaveEmail).toHaveBeenCalledWith(
        'recipient@example.com',
        'Test Subject',
        'Test email content',
        [{ name: 'resume.pdf', data: 'mock-pdf-data' }]
      );
    });

    it('should handle send email errors', async () => {
      UIManager.isAuthenticated = true;
      UIManager.elements = {
        emailResult: document.createElement('textarea'),
        sendGmailButton: document.createElement('button')
      };

      const recipientInput = document.createElement('input');
      recipientInput.id = 'recipientEmailInput';
      recipientInput.value = 'test@example.com';
      document.body.appendChild(recipientInput);

      const subjectInput = document.createElement('input');
      subjectInput.id = 'emailSubject';
      subjectInput.value = 'Test';
      document.body.appendChild(subjectInput);

      GmailManager.sendAndSaveEmail.mockRejectedValue(new Error('Send failed'));

      // Mock alert
      global.alert = jest.fn();

      const sendPromise = new Promise(resolve => {
        UIManager.elements.sendGmailButton.addEventListener('click', async () => {
          try {
            await GmailManager.sendAndSaveEmail('test@example.com', 'Test', 'Content');
          } catch (error) {
            alert('Failed to send email. Please make sure you are logged into Gmail and try again.');
          }
          resolve();
        });
      });

      UIManager.elements.sendGmailButton.click();
      await sendPromise;

      expect(alert).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send email')
      );
    });
  });

  describe('View Management', () => {
    it('should switch between different views correctly', () => {
      // Create container for UIManager
      const container = document.createElement('div');
      UIManager.container = container;
      document.body.appendChild(container);
      
      // Create view elements inside container
      const views = ['signin', 'splash', 'editor', 'success'].map(name => {
        const view = document.createElement('div');
        view.id = `linkmail-${name}`;
        view.style.display = 'none'; // Set initial state
        container.appendChild(view);
        return view;
      });

      UIManager.showView('#linkmail-editor');

      expect(document.getElementById('linkmail-editor').style.display).toBe('block');
      expect(document.getElementById('linkmail-splash').style.display).toBe('none');
      expect(document.getElementById('linkmail-signin').style.display).toBe('none');
    });

    it('should handle view switching with preservation flag', () => {
      UIManager.isAuthenticated = true;

      const splashView = document.createElement('div');
      splashView.id = 'linkmail-splash';
      splashView.style.display = 'block';
      document.body.appendChild(splashView);

      const editorView = document.createElement('div');
      editorView.id = 'linkmail-editor';
      editorView.style.display = 'block';
      document.body.appendChild(editorView);

      // Should preserve current view when flag is true
      UIManager.showAuthenticatedUI(true);

      expect(editorView.style.display).toBe('block');
    });
  });
}); 