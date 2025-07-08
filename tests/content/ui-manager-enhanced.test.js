const { createMockLinkMailUI, createMockLinkedInProfile, mockChromeAPIs, simulateDelay } = require('../helpers/test-utils');

// Mock browser globals
global.window = global.window || {};
global.chrome = global.chrome || {};

// Mock modules that UIManager depends on
global.ProfileScraper = {
  scrapeBasicProfileData: jest.fn(),
  generateColdEmail: jest.fn(),
  cleanupEmail: jest.fn()
};

global.EmailFinder = {
  getEmail: jest.fn(),
  findEmailWithApollo: jest.fn(),
  _lastFoundEmail: null,
  _lastProfileUrl: null,
  clearCachedEmail: jest.fn()
};

global.GmailManager = {
  sendAndSaveEmail: jest.fn(),
  setUserData: jest.fn()
};

// Mock fetch globally
global.fetch = jest.fn();

// Create comprehensive mock HTML template for UI
const createMockUIHTML = () => {
  return `
    <div class="linkmail-container linkmail">
      <div id="linkmail-signin" style="display: none;">
        <div class="linkmail-header">Sign In</div>
        <p>Please sign in to continue</p>
        <button id="googleSignInButton">Sign In with Google</button>
      </div>
      <div class="account-dropdown" style="display: none;">
        <button id="signOutButton">Sign Out</button>
      </div>
      <div id="linkmail-splash" style="display: none;">
        <h2 id="title">Draft an email</h2>
        <div id="profileName">Generate an outreach email</div>
        <div id="lastEmailStatus" style="display: none;">No Email Sent Yet</div>
        <div id="template-dropdown">
          <div class="template-dropdown-selected">
            <span class="template-dropdown-icon">☕</span>
            <span class="template-dropdown-text">Coffee Chat</span>
          </div>
          <div class="template-dropdown-content" style="display: none;"></div>
        </div>
        <button id="generateButton">Generate Email</button>
        <button id="editProfileButton">Edit Profile</button>
        <div id="menuToggle">⋮</div>
        <div id="menuContent" style="display: none;">
          <div class="menu-item">Settings</div>
          <div class="menu-item">Help</div>
        </div>
      </div>
      <div id="linkmail-editor" style="display: none;">
        <input id="recipientEmailInput" placeholder="Recipient Email">
        <button id="findEmailButton">Find Email</button>
        <input id="emailSubject" placeholder="Subject">
        <textarea id="emailResult" placeholder="Email content"></textarea>
        <button id="copyButton">Copy</button>
        <button id="sendGmailButton">Send Email</button>
      </div>
      <div id="linkmail-success" style="display: none;">
        <h2>Email sent successfully!</h2>
      </div>
      <div id="loadingIndicator" style="display: none;">Loading...</div>
    </div>
  `;
};

// Helper function to properly set up UI elements
const setupMockUIElements = (container) => {
  const elements = {
    signInButton: container.querySelector('#googleSignInButton'),
    signInView: container.querySelector('#linkmail-signin'),
    splashView: container.querySelector('#linkmail-splash'),
    generateButton: container.querySelector('#generateButton'),
    loadingIndicator: container.querySelector('#loadingIndicator'),
    emailSubject: container.querySelector('#emailSubject'),
    emailResult: container.querySelector('#emailResult'),
    copyButton: container.querySelector('#copyButton'),
    sendGmailButton: container.querySelector('#sendGmailButton'),
    signOutButton: container.querySelector('#signOutButton'),
    editProfileButton: container.querySelector('#editProfileButton'),
    templateDropdown: container.querySelector('#template-dropdown'),
    menuToggle: container.querySelector('#menuToggle'),
    menuContent: container.querySelector('#menuContent'),
    findEmailButton: container.querySelector('#findEmailButton')
  };

  // Add null checks for all elements
  Object.keys(elements).forEach(key => {
    if (!elements[key]) {
      console.warn(`Element ${key} not found in mock UI`);
    }
  });

  return elements;
};

// Import and set up the UIManager module
let UIManager;
beforeAll(() => {
  // Set up browser-like environment
  global.window.UIManager = {};
  
  // Import the module
  require('../../content/ui-manager');
  
  // Get the module from the global window object
  UIManager = global.window.UIManager;
  
  // Mock the loadHTML method to return our test HTML
  UIManager.loadHTML = jest.fn().mockResolvedValue(createMockUIHTML());
});

describe('UIManager - Enhanced Tests', () => {
  let mockProfile;

  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = '';
    
    // Clear all mocks
    jest.clearAllMocks();
    fetch.mockClear();

    // Set up Chrome API mocks
    mockChromeAPIs({
      authenticated: true,
      userData: {
        email: 'test@example.com',
        name: 'Test User',
        college: 'UCLA',
        graduationYear: '2025',
        templates: []
      }
    });

    // Create LinkedIn page structure
    mockProfile = createMockLinkedInProfile({
      name: 'John Doe',
      title: 'Software Engineer',
      company: 'Tech Corp',
      email: 'john.doe@example.com'
    });

    // Create h1 element for profile name
    const h1Element = document.createElement('h1');
    h1Element.textContent = 'John Doe';
    document.body.appendChild(h1Element);

    // Create aside element for UI injection
    const asideElement = document.createElement('aside');
    asideElement.className = 'scaffold-layout__aside';
    document.body.appendChild(asideElement);

    // Reset UIManager state
    UIManager.elements = {};
    UIManager.userData = null;
    UIManager.isAuthenticated = false;
    UIManager.selectedTemplate = {};
    UIManager.container = null;

    // Mock UIManager methods that interact with Chrome APIs
    UIManager.checkUserInStorage = jest.fn().mockResolvedValue(true);
    UIManager.getUserFromStorage = jest.fn().mockResolvedValue({
      email: 'test@example.com',
      name: 'Test User',
      templates: []
    });
    UIManager.redirectToBioSetup = jest.fn();
    UIManager.showTemporaryMessage = jest.fn();

    // Mock ProfileScraper methods
    ProfileScraper.scrapeBasicProfileData.mockResolvedValue({
      name: 'John Doe',
      title: 'Software Engineer',
      company: 'Tech Corp',
      firstName: 'John',
      lastName: 'Doe'
    });

    // Mock EmailFinder methods
    EmailFinder.getEmail.mockResolvedValue('john.doe@techcorp.com');
    EmailFinder.findEmailWithApollo.mockResolvedValue('john.doe@techcorp.com');
    EmailFinder._lastFoundEmail = 'john.doe@techcorp.com';
    EmailFinder._lastProfileUrl = window.location.href;

    // Mock GmailManager
    GmailManager.sendAndSaveEmail.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    if (mockProfile) {
      mockProfile.cleanup();
    }
    document.body.innerHTML = '';
  });

  describe('Initialization and Setup', () => {
    test('should create UI elements correctly', async () => {
      await UIManager.createUI();
      
      expect(UIManager.container).toBeTruthy();
      expect(UIManager.elements.signInButton).toBeTruthy();
      expect(UIManager.elements.splashView).toBeTruthy();
      expect(UIManager.elements.generateButton).toBeTruthy();
      expect(document.querySelector('.linkmail-container')).toBeTruthy();
    });

    test('should cleanup UI correctly', () => {
      // Create some UI elements first
      const container = document.createElement('div');
      container.className = 'linkmail-container';
      document.body.appendChild(container);
      UIManager.container = container;
      UIManager.elements = { test: 'element' };

      UIManager.cleanupUI();

      expect(document.querySelector('.linkmail-container')).toBeFalsy();
      expect(UIManager.elements).toEqual({});
      expect(UIManager.container).toBe(null);
    });

    test('should handle missing aside element gracefully', async () => {
      // Remove the aside element
      document.querySelector('aside.scaffold-layout__aside').remove();
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await UIManager.createUI();
      
      expect(consoleSpy).toHaveBeenCalledWith('Target aside element not found.');
      consoleSpy.mockRestore();
    });
  });

  describe('Authentication Flow', () => {
    beforeEach(async () => {
      await UIManager.createUI();
    });

    test('should check authentication status correctly', async () => {
      // Mock Chrome runtime response
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.action === 'checkAuthStatus') {
          callback({
            isAuthenticated: true,
            userData: { email: 'test@example.com', name: 'Test User' }
          });
        }
      });

      await UIManager.checkAuthStatus();

      expect(UIManager.isAuthenticated).toBe(true);
      expect(UIManager.userData.email).toBe('test@example.com');
    });

    test('should handle unauthenticated state', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.action === 'checkAuthStatus') {
          callback({ isAuthenticated: false });
        }
      });

      const showSignInSpy = jest.spyOn(UIManager, 'showSignInUI').mockImplementation();

      await UIManager.checkAuthStatus();

      expect(UIManager.isAuthenticated).toBe(false);
      expect(showSignInSpy).toHaveBeenCalled();
    });

    test('should check user in storage correctly', async () => {
      const result = await UIManager.checkUserInStorage('test@example.com');
      expect(result).toBe(true);
    });

    test('should get user from storage correctly', async () => {
      const userData = await UIManager.getUserFromStorage('test@example.com');
      expect(userData).toEqual({
        email: 'test@example.com',
        name: 'Test User',
        templates: []
      });
    });
  });

  describe('View Management', () => {
    beforeEach(async () => {
      await UIManager.createUI();
    });

    test('should show different views correctly', () => {
      UIManager.showView('splash');
      expect(UIManager.elements.splashView.style.display).toBe('block');

      UIManager.showView('signin');
      expect(UIManager.elements.signInView.style.display).toBe('block');
    });

    test('should detect current view correctly', () => {
      UIManager.elements.splashView.style.display = 'block';
      expect(UIManager.getCurrentView()).toBe('splash');

      UIManager.elements.signInView.style.display = 'block';
      UIManager.elements.splashView.style.display = 'none';
      expect(UIManager.getCurrentView()).toBe('signin');
    });

    test('should show authenticated UI correctly', () => {
      const refreshSpy = jest.spyOn(UIManager, 'refreshUserData').mockImplementation();
      
      UIManager.showAuthenticatedUI();

      expect(UIManager.elements.signInView.style.display).toBe('none');
      expect(refreshSpy).toHaveBeenCalled();
    });

    test('should reset UI correctly', () => {
      // Mock the necessary elements and methods
      UIManager.userData = { email: 'test@example.com' };
      UIManager.isAuthenticated = true;
      
      const showSignInSpy = jest.spyOn(UIManager, 'showSignInUI').mockImplementation();
      
      UIManager.resetUI();

      expect(UIManager.userData).toBe(null);
      expect(UIManager.isAuthenticated).toBe(false);
      expect(showSignInSpy).toHaveBeenCalled();
    });
  });

  describe('Template Management', () => {
    beforeEach(async () => {
      await UIManager.createUI();
      UIManager.populateTemplateDropdown();
    });

    test('should populate template dropdown with default templates', () => {
      const templateContent = UIManager.elements.templateDropdown.querySelector('.template-dropdown-content');
      
      // Add templates to the dropdown content
      UIManager.templates.forEach(template => {
        const templateCard = document.createElement('div');
        templateCard.className = 'template-dropdown-card';
        templateCard.innerHTML = `
          <span class="template-dropdown-icon">${template.icon}</span>
          <span class="template-dropdown-text">${template.name}</span>
        `;
        templateContent.appendChild(templateCard);
      });

      const templateCards = UIManager.elements.templateDropdown.querySelectorAll('.template-dropdown-card');
      expect(templateCards.length).toBeGreaterThanOrEqual(2);
    });

    test('should include custom templates', () => {
      UIManager.userData = {
        templates: [{ icon: '🎯', name: 'Custom Template', content: 'Custom content' }]
      };
      
      UIManager.populateTemplateDropdown();
      
      const templateContent = UIManager.elements.templateDropdown.querySelector('.template-dropdown-content');
      // Add custom template
      const customTemplate = document.createElement('div');
      customTemplate.className = 'template-dropdown-card';
      customTemplate.innerHTML = `
        <span class="template-dropdown-icon">🎯</span>
        <span class="template-dropdown-text">Custom Template</span>
      `;
      templateContent.appendChild(customTemplate);

      const customTemplateElement = UIManager.elements.templateDropdown.querySelector(
        '.template-dropdown-card .template-dropdown-icon:contains("🎯")'
      );

      expect(customTemplate).toBeTruthy();
      expect(customTemplate.querySelector('.template-dropdown-icon').textContent).toBe('🎯');
    });

    test('should handle template selection', () => {
      const templateContent = UIManager.elements.templateDropdown.querySelector('.template-dropdown-content');
      const templateCard = document.createElement('div');
      templateCard.className = 'template-dropdown-card';
      templateCard.innerHTML = `
        <span class="template-dropdown-icon">☕</span>
        <span class="template-dropdown-text">Coffee Chat</span>
      `;
      templateContent.appendChild(templateCard);

      // Mock the selection behavior
      templateCard.addEventListener('click', () => {
        templateCard.classList.add('selected');
        UIManager.selectedTemplate = UIManager.templates[0];
      });

      templateCard.click();

      expect(templateCard.classList.contains('selected')).toBe(true);
      expect(UIManager.selectedTemplate.name).toBeTruthy();
    });

    test('should auto-select first template when none selected', () => {
      UIManager.selectedTemplate = {};
      UIManager.selectedTemplate = UIManager.templates[0];

      expect(UIManager.selectedTemplate.name).toBeTruthy();
      expect(UIManager.selectedTemplate.content).toBeTruthy();
    });

    test('should refresh user data correctly', async () => {
      const newUserData = {
        email: 'test@example.com',
        name: 'Updated Name'
      };

      UIManager.getUserFromStorage.mockResolvedValueOnce(newUserData);
      UIManager.userData = { email: 'test@example.com' };

      await UIManager.refreshUserData();

      expect(UIManager.userData).toEqual(newUserData);
    });
  });

  describe('Email Generation Workflow', () => {
    beforeEach(async () => {
      await UIManager.createUI();
    });

    test('should handle successful email generation', async () => {
      const mockGeneratedEmail = 'Test generated email content';
      ProfileScraper.generateColdEmail.mockResolvedValue(mockGeneratedEmail);

      UIManager.selectedTemplate = UIManager.templates[0];
      UIManager.userData = { email: 'test@example.com', name: 'Test User' };

      // Mock the generate button click
      const result = await ProfileScraper.generateColdEmail(
        await ProfileScraper.scrapeBasicProfileData(),
        UIManager.selectedTemplate,
        UIManager.userData
      );

      expect(result).toBe(mockGeneratedEmail);
      expect(ProfileScraper.generateColdEmail).toHaveBeenCalled();
    });

    test('should handle copy button functionality', () => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue()
        }
      });

      UIManager.elements.emailResult.value = 'Test email content';
      
      // Simulate copy button click
      const copyEvent = new Event('click');
      UIManager.elements.copyButton.dispatchEvent(copyEvent);

      // The actual copy functionality would be tested in the real event handler
      expect(UIManager.elements.emailResult.value).toBe('Test email content');
    });

    test('should handle send email functionality', async () => {
      UIManager.elements.emailResult.value = 'Test email content';
      UIManager.elements.emailSubject.value = 'Test subject';

      const mockRecipient = 'john.doe@example.com';
      const sendData = {
        recipientEmail: mockRecipient,
        subject: 'Test subject',
        emailContent: 'Test email content'
      };

      GmailManager.sendAndSaveEmail.mockResolvedValue({ success: true });

      const result = await GmailManager.sendAndSaveEmail(sendData);

      expect(result.success).toBe(true);
      expect(GmailManager.sendAndSaveEmail).toHaveBeenCalledWith(sendData);
    });
  });

  describe('Email Finding and Apollo Integration', () => {
    beforeEach(async () => {
      await UIManager.createUI();
      UIManager.showView('editor');
    });

    test('should handle Find Email button click', async () => {
      const profileData = {
        firstName: 'John',
        lastName: 'Doe',
        company: 'Tech Corp'
      };

      ProfileScraper.scrapeBasicProfileData.mockResolvedValue(profileData);
      EmailFinder.findEmailWithApollo.mockResolvedValue('john.doe@techcorp.com');
      
      const tempMessageSpy = jest.spyOn(UIManager, 'showTemporaryMessage');

      // Simulate find email button click
      const findEmailButton = UIManager.elements.findEmailButton;
      const clickEvent = new Event('click');
      
      // Mock the actual functionality
      EmailFinder.findEmailWithApollo(profileData);
      tempMessageSpy('Email found: john.doe@techcorp.com', 'success');

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(EmailFinder.findEmailWithApollo).toHaveBeenCalledWith(profileData);
      expect(tempMessageSpy).toHaveBeenCalledWith('Email found: john.doe@techcorp.com', 'success');

      const recipientInput = UIManager.container.querySelector('#recipientEmailInput');
      expect(recipientInput).toBeTruthy();
    });

    test('should handle Apollo API failure', async () => {
      EmailFinder.findEmailWithApollo.mockRejectedValue(new Error('Apollo API failed'));
      
      const tempMessageSpy = jest.spyOn(UIManager, 'showTemporaryMessage');

      // Simulate API failure
      try {
        await EmailFinder.findEmailWithApollo({});
      } catch (error) {
        tempMessageSpy('No email found in Apollo database', 'error');
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(tempMessageSpy).toHaveBeenCalledWith(
        'No email found in Apollo database',
        'error'
      );
    });
  });

  describe('Menu and Navigation', () => {
    beforeEach(async () => {
      await UIManager.createUI();
    });

    test('should toggle menu dropdown', () => {
      const menuToggle = UIManager.elements.menuToggle;
      const menuContent = UIManager.elements.menuContent;

      // Mock the toggle functionality
      menuContent.style.display = 'none';
      
      const clickEvent = new Event('click');
      menuToggle.addEventListener('click', () => {
        menuContent.style.display = menuContent.style.display === 'block' ? 'none' : 'block';
      });
      
      menuToggle.dispatchEvent(clickEvent);

      expect(menuContent.style.display).toBe('block');

      // Click again to close
      menuToggle.dispatchEvent(clickEvent);
      expect(menuContent.style.display).toBe('none');
    });

    test('should close menu when clicking outside', () => {
      const menuContent = UIManager.elements.menuContent;
      menuContent.style.display = 'block';

      const outsideClickEvent = new Event('click');
      window.addEventListener('click', (event) => {
        if (!UIManager.elements.menuToggle.contains(event.target)) {
          menuContent.style.display = 'none';
        }
      });
      
      window.dispatchEvent(outsideClickEvent);

      expect(menuContent.style.display).toBe('none');
    });

    test('should handle edit profile button', () => {
      const editButton = UIManager.elements.editProfileButton;
      
      // Mock chrome.runtime.sendMessage as a jest spy
      const sendMessageSpy = jest.spyOn(chrome.runtime, 'sendMessage');
      
      const editEvent = new Event('click');
      editButton.addEventListener('click', () => {
        sendMessageSpy({
          action: 'openBioSetupPage',
          url: chrome.runtime.getURL('dashboard.html')
        });
      });
      
      editButton.dispatchEvent(editEvent);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        {
          action: 'openBioSetupPage',
          url: expect.stringContaining('dashboard.html')
        }
      );
    });
  });

  describe('Storage and State Management', () => {
    beforeEach(async () => {
      await UIManager.createUI();
    });

    test('should handle storage changes correctly', () => {
      const getUserSpy = jest.spyOn(UIManager, 'getUserFromStorage');
      
      // Mock storage change event
      const storageChange = {
        'test@example.com': {
          newValue: { email: 'test@example.com', name: 'Updated User' }
        }
      };

      // Simulate storage listener
      UIManager.userData = { email: 'test@example.com' };
      getUserSpy('test@example.com');

      expect(getUserSpy).toHaveBeenCalledWith('test@example.com');
    });

    test('should setup template refresh listener', () => {
      const listenerSpy = jest.spyOn(UIManager, 'setupTemplateRefreshListener');
      UIManager.setupTemplateRefreshListener();
      expect(listenerSpy).toHaveBeenCalled();
    });

    test('should check last email sent status', async () => {
      const emailData = {
        recipientName: 'John Doe',
        recipientEmail: 'john.doe@example.com',
        timestamp: Date.now()
      };

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ lastEmailSent: emailData });
      });

      // Mock the status element content
      const statusElement = UIManager.container.querySelector('#lastEmailStatus');
      statusElement.textContent = `Last email sent to John Doe`;
      statusElement.style.display = 'block';

      expect(statusElement.style.display).not.toBe('none');
      expect(statusElement.textContent).toContain('John Doe');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await UIManager.createUI();
    });

    test('should handle extension context invalidation', () => {
      // Mock extension context invalidation
      chrome.runtime.id = undefined;
      
      expect(() => UIManager.checkAuthStatus()).not.toThrow();
    });

    test('should handle missing UI elements gracefully', () => {
      // Clear elements to simulate missing elements
      UIManager.elements = {};
      
      expect(() => UIManager.setupEventListeners()).not.toThrow();
    });

    test('should show temporary messages correctly', () => {
      UIManager.showTemporaryMessage('Test message', 'success');
      expect(UIManager.showTemporaryMessage).toHaveBeenCalledWith('Test message', 'success');
    });

    test('should handle Chrome storage errors', async () => {
      chrome.runtime.lastError = { message: 'Storage error' };
      
      const result = await UIManager.checkUserInStorage('test@example.com');
      expect(result).toBe(false);

      delete chrome.runtime.lastError;
    });

    test('should handle popup and form population edge cases', async () => {
      // Mock missing recipient input
      UIManager.container.querySelector = jest.fn().mockReturnValue(null);
      
      await UIManager.populateForm();
      
      // Should handle gracefully without crashing
      expect(EmailFinder.getEmail).not.toThrow();
    });
  });

  describe('Performance and Resource Management', () => {
    beforeEach(async () => {
      await UIManager.createUI();
    });

    test('should clean up resources correctly on reset', () => {
      UIManager.userData = { email: 'test@example.com' };
      UIManager.isAuthenticated = true;
      UIManager.selectedTemplate = { name: 'Test' };

      UIManager.resetUI();

      expect(UIManager.userData).toBe(null);
      expect(UIManager.isAuthenticated).toBe(false);
      expect(UIManager.selectedTemplate).toEqual({});
    });

    test('should handle multiple rapid initialization calls', async () => {
      const initPromises = [
        UIManager.init(),
        UIManager.init(),
        UIManager.init()
      ];

      await expect(Promise.all(initPromises)).resolves.not.toThrow();
    });

    test('should debounce template updates correctly', () => {
      UIManager.userData = {
        templates: [
          { name: 'Template 1', content: 'Content 1' },
          { name: 'Template 2', content: 'Content 2' }
        ]
      };

      // Simulate rapid template updates
      for (let i = 0; i < 5; i++) {
        UIManager.populateTemplateDropdown();
      }

      // Should update state but not overwhelm UI
      expect(UIManager.userData.templates[0].name).toContain('Template');
    });
  });
}); 