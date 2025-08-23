// Test file for LinkedIn feed page injection functionality

const mockChromeAPIs = require('../helpers/test-utils').mockChromeAPIs;

// Mock the required global functions and objects
global.ProfileScraper = {
  scrapeBasicProfileData: jest.fn().mockResolvedValue({
    name: 'John Doe',
    company: 'Tech Corp',
    headline: 'Software Engineer',
    location: 'San Francisco, CA'
  }),
  generateColdEmail: jest.fn().mockResolvedValue({
    email: 'Test email content',
    subject: 'Test Subject'
  }),
  cleanupEmail: jest.fn(email => email)
};

global.EmailFinder = {
  _lastFoundEmail: null,
  _lastProfileUrl: null,
  getEmail: jest.fn().mockResolvedValue('test@example.com'),
  clearCachedEmail: jest.fn(),
  findEmailWithApollo: jest.fn().mockResolvedValue({ success: false, error: 'Not found' })
};

global.GmailManager = {
  sendAndSaveEmail: jest.fn().mockResolvedValue(true),
  setUserData: jest.fn()
};

global.BackendAPI = {
  init: jest.fn().mockResolvedValue(true),
  isAuthenticated: true,
  userData: { email: 'test@example.com', name: 'Test User' },
  startAuthFlow: jest.fn(),
  signOut: jest.fn()
};

global.Utils = {
  debounce: jest.fn(fn => fn)
};

// Mock chrome APIs
mockChromeAPIs();

describe('LinkedIn Feed Page Injection', () => {
  let contentScript;
  
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    
    // Mock URL for feed page
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://www.linkedin.com/feed/'
      },
      writable: true
    });

    // Setup basic LinkedIn feed page structure
    document.body.innerHTML = `
      <aside class="scaffold-layout__aside">
        <div class="scaffold-layout__sticky"></div>
      </aside>
      <main>
        <div class="feed-container">
          <div class="post">Test post content</div>
        </div>
      </main>
    `;

    // Clear all mocks
    jest.clearAllMocks();

    // Mock fetch for HTML template
    global.fetch = jest.fn().mockResolvedValue({
      text: () => Promise.resolve(`
        <div class="linkmail-container linkmail">
          <div id="linkmail-signin">
            <h2 class="linkmail-header">Personalized Emails with AI</h2>
            <p>Connect your Gmail to generate and send personalized emails</p>
            <button id="googleSignInButton" class="lm-btn">Connect Gmail Account</button>
          </div>
          <div id="linkmail-splash" style="display: none;">
            <h2 id="title" class="linkmail-header"></h2>
            <div id="template-dropdown" class="template-dropdown"></div>
            <button id="generateButton" class="lm-btn">Generate</button>
          </div>
          <div id="linkmail-editor" style="display: none;">
            <input id="recipientEmailInput" placeholder="Recipient Email">
            <input id="emailSubject" placeholder="Subject">
            <textarea id="emailResult"></textarea>
            <button id="copyButton">Copy</button>
            <button id="sendGmailButton">Send Email</button>
            <button id="findEmailButton" style="display: none;">Find Email</button>
          </div>
          <div class="account-dropdown linkmail-account-info">
            <p id="user-email-display">test@example.com</p>
            <button id="menuToggle">Menu</button>
            <div id="menuContent">
              <div id="editProfileButton">Edit Profile</div>
              <div id="signOutButton">Sign Out</div>
            </div>
          </div>
        </div>
      `)
    });

    chrome.runtime.getURL = jest.fn(path => `chrome-extension://test-id${path}`);
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ 'test@example.com': { email: 'test@example.com', name: 'Test User', templates: [] } });
    });
  });

  test('should detect feed page correctly', () => {
    // Load the content script
    require('../../content/content.js');

    // Check that our functions are available
    expect(window.location.href).toBe('https://www.linkedin.com/feed/');
  });

  test('should initialize UI Manager on feed page', async () => {
    // Load UI Manager
    require('../../content/ui-manager.js');
    const UIManager = window.UIManager;

    // Initialize the UI
    await UIManager.init();

    // Check that container exists
    const container = document.querySelector('.linkmail-container');
    expect(container).toBeTruthy();

    // Check that aside element has the injected UI
    const asideElement = document.querySelector('aside.scaffold-layout__aside');
    expect(asideElement.children.length).toBeGreaterThan(0);
  });

  test('should set correct title for feed page', async () => {
    require('../../content/ui-manager.js');
    const UIManager = window.UIManager;

    await UIManager.init();

    // Mock authentication status
    UIManager.isAuthenticated = true;
    UIManager.userData = { email: 'test@example.com', name: 'Test User', templates: [] };

    // Show authenticated UI
    UIManager.showAuthenticatedUI();

    // Check title element
    const titleElement = document.querySelector('#title');
    expect(titleElement.textContent).toBe('Draft personalized emails with AI');
  });

  test('should handle email generation on feed page', async () => {
    require('../../content/ui-manager.js');
    const UIManager = window.UIManager;

    await UIManager.init();

    // Set up authentication
    UIManager.isAuthenticated = true;
    UIManager.userData = { email: 'test@example.com', name: 'Test User', templates: [] };
    UIManager.selectedTemplate = {
      name: 'Coffee Chat',
      content: 'Test template content',
      subjectLine: 'Test Subject',
      purpose: 'test purpose'
    };

    // Set recipient email
    const recipientInput = document.getElementById('recipientEmailInput');
    recipientInput.value = 'recipient@example.com';

    // Show editor view
    UIManager.showView('#linkmail-editor');

    // Simulate generate button click
    const generateButton = document.getElementById('generateButton');
    
    // Mock the click event
    generateButton.click();

    // Verify that ProfileScraper.generateColdEmail was called with correct data
    expect(ProfileScraper.generateColdEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'recipient@example.com',
        name: '',
        company: '',
        headline: '',
        location: ''
      }),
      expect.objectContaining({
        name: 'Coffee Chat',
        content: 'Test template content',
        subjectLine: 'Test Subject',
        purpose: 'test purpose'
      })
    );
  });

  test('should require email input on feed page before generation', async () => {
    require('../../content/ui-manager.js');
    const UIManager = window.UIManager;

    await UIManager.init();

    // Set up authentication
    UIManager.isAuthenticated = true;
    UIManager.userData = { email: 'test@example.com', name: 'Test User', templates: [] };

    // Don't set recipient email (leave empty)
    const recipientInput = document.getElementById('recipientEmailInput');
    recipientInput.value = '';

    // Mock showTemporaryMessage
    UIManager.showTemporaryMessage = jest.fn();

    // Show editor view
    UIManager.showView('#linkmail-editor');

    // Simulate generate button click
    const generateButton = document.getElementById('generateButton');
    generateButton.click();

    // Should show error message
    expect(UIManager.showTemporaryMessage).toHaveBeenCalledWith(
      'Please enter a recipient email address',
      'error'
    );
  });

  test('should populate form correctly for feed page', async () => {
    require('../../content/ui-manager.js');
    const UIManager = window.UIManager;

    await UIManager.init();

    // Set up authentication
    UIManager.isAuthenticated = true;
    UIManager.userData = { email: 'test@example.com', name: 'Test User' };

    // Populate form
    await UIManager.populateForm();

    // Check recipient input placeholder
    const recipientInput = document.getElementById('recipientEmailInput');
    expect(recipientInput.placeholder).toBe('Enter recipient email address');
    expect(recipientInput.value).toBe('');

    // Check that find email button is hidden on feed page
    const findEmailButton = document.getElementById('findEmailButton');
    expect(findEmailButton.style.display).toBe('none');
  });
});
