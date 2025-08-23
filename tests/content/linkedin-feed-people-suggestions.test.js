// Test file for LinkedIn feed page people suggestions functionality

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
    email: 'Test email content for suggested person',
    subject: 'Test Subject for Suggested Person'
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

describe('LinkedIn Feed Page People Suggestions', () => {
  let UIManager;
  
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
          <div id="linkmail-people-suggestions" style="display:none;">
            <h2 class="linkmail-header">People you might want to reach out to</h2>
            <p>Based on your profile, here are some people who might be interested in connecting with you:</p>
            <div id="suggested-people-container"></div>
            <div id="people-suggestions-loading" style="display: none;">
              <p>Finding people for you...</p>
            </div>
            <div id="people-suggestions-error" style="display: none;">
              <p>Unable to find suggestions at the moment</p>
              <button id="retry-people-search">Try Again</button>
            </div>
            <button id="skip-to-templates">Skip to Email Templates</button>
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
      callback({ 
        'test@example.com': { 
          email: 'test@example.com', 
          name: 'Test User', 
          templates: [],
          college: 'UCLA',
          graduationYear: '2023',
          experiences: [
            { company: 'TechCorp', position: 'Software Engineer' }
          ],
          skills: ['JavaScript', 'React']
        } 
      });
    });

    // Mock Apollo People Search response
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.action === 'findSimilarPeople') {
        callback({
          success: true,
          allSuggestions: [
            {
              name: 'Alice Johnson',
              first_name: 'Alice',
              last_name: 'Johnson',
              email: 'alice.johnson@example.com',
              title: 'Senior Software Engineer',
              organization: { name: 'TechCorp' },
              linkedin_url: 'https://linkedin.com/in/alice-johnson',
              similarity_reason: 'same_company_and_role'
            },
            {
              name: 'Bob Smith',
              first_name: 'Bob',
              last_name: 'Smith',
              email: 'bob.smith@example.com',
              title: 'Product Manager',
              organization: { name: 'StartupCo' },
              linkedin_url: 'https://linkedin.com/in/bob-smith',
              similarity_reason: 'same_role'
            },
            {
              name: 'Carol Davis',
              first_name: 'Carol',
              last_name: 'Davis',
              email: 'carol.davis@example.com',
              title: 'Data Scientist',
              organization: { name: 'DataCorp' },
              linkedin_url: 'https://linkedin.com/in/carol-davis',
              similarity_reason: 'same_company'
            }
          ]
        });
      } else {
        callback({});
      }
    });
  });

  test('should show people suggestions view instead of splash on feed page', async () => {
    require('../../content/ui-manager.js');
    const UIManager = window.UIManager;

    await UIManager.init();

    // Set up authentication and user data
    UIManager.isAuthenticated = true;
    UIManager.userData = { 
      email: 'test@example.com', 
      name: 'Test User', 
      templates: [],
      college: 'UCLA',
      experiences: [{ company: 'TechCorp', position: 'Software Engineer' }]
    };

    // Mock loadPeopleSuggestions to avoid actual API calls in test
    UIManager.loadPeopleSuggestions = jest.fn();

    // Show authenticated UI
    UIManager.showAuthenticatedUI();

    // Check that people suggestions view is shown
    const peopleSuggestionsView = document.querySelector('#linkmail-people-suggestions');
    const splashView = document.querySelector('#linkmail-splash');

    expect(peopleSuggestionsView.style.display).toBe('block');
    expect(splashView.style.display).toBe('none');
    
    // Verify that loadPeopleSuggestions was called
    expect(UIManager.loadPeopleSuggestions).toHaveBeenCalled();
  });

  test('should load and display people suggestions', async () => {
    require('../../content/ui-manager.js');
    const UIManager = window.UIManager;

    await UIManager.init();

    // Set up authentication and user data
    UIManager.isAuthenticated = true;
    UIManager.userData = { 
      email: 'test@example.com', 
      name: 'Test User',
      college: 'UCLA',
      experiences: [{ company: 'TechCorp', position: 'Software Engineer' }],
      skills: ['JavaScript']
    };

    // Mock loadPeopleSuggestions to simulate successful loading
    const mockSuggestions = [
      {
        name: 'Alice Johnson',
        first_name: 'Alice',
        last_name: 'Johnson',
        email: 'alice.johnson@example.com',
        title: 'Senior Software Engineer',
        organization: { name: 'TechCorp' },
        similarity_reason: 'same_company_and_role'
      }
    ];

    UIManager.displayPeopleSuggestions = jest.fn();
    UIManager.getUserProfileDataForSearch = jest.fn().mockResolvedValue({
      name: 'Test User',
      company: 'TechCorp',
      headline: 'Software Engineer'
    });
    UIManager.findPeopleUsingApollo = jest.fn().mockResolvedValue({
      success: true,
      allSuggestions: mockSuggestions
    });

    await UIManager.loadPeopleSuggestions();

    expect(UIManager.getUserProfileDataForSearch).toHaveBeenCalled();
    expect(UIManager.findPeopleUsingApollo).toHaveBeenCalled();
    expect(UIManager.displayPeopleSuggestions).toHaveBeenCalledWith(mockSuggestions);
  });

  test('should extract user profile data for Apollo search', async () => {
    require('../../content/ui-manager.js');
    const UIManager = window.UIManager;

    UIManager.userData = {
      name: 'Test User',
      email: 'test@example.com',
      college: 'UCLA',
      graduationYear: '2023',
      experiences: [
        { company: 'TechCorp', position: 'Software Engineer' },
        { company: 'OldCorp', position: 'Junior Developer' }
      ],
      skills: ['JavaScript', 'React']
    };

    const profileData = await UIManager.getUserProfileDataForSearch();

    expect(profileData).toEqual(expect.objectContaining({
      name: 'Test User',
      company: 'TechCorp', // Most recent experience
      headline: 'Software Engineer', // Most recent position
      isUserProfile: true
    }));
    
    // Check that required properties exist
    expect(profileData).toHaveProperty('location');
    expect(profileData).toHaveProperty('linkedinUrl');
  });

  test('should handle user with no experience (student case)', async () => {
    require('../../content/ui-manager.js');
    const UIManager = window.UIManager;

    // Create a fresh instance and set user data
    UIManager.userData = {
      name: 'Student User',
      email: 'student@example.com',
      college: 'UCLA',
      graduationYear: '2024',
      experiences: [], // No work experience
      skills: ['Python', 'Machine Learning']
    };

    const profileData = await UIManager.getUserProfileDataForSearch();

    expect(profileData).toEqual(expect.objectContaining({
      name: 'Student User',
      company: 'UCLA', // Using college as company
      headline: 'Student', // Default headline for students
      isUserProfile: true
    }));
    
    // Check that required properties exist
    expect(profileData).toHaveProperty('location');
    expect(profileData).toHaveProperty('linkedinUrl');
  });

  test('should navigate to LinkedIn profile when person card is clicked', async () => {
    require('../../content/ui-manager.js');
    const UIManager = window.UIManager;

    await UIManager.init();

    const mockPerson = {
      name: 'Alice Johnson',
      first_name: 'Alice',
      last_name: 'Johnson',
      email: 'alice.johnson@example.com',
      title: 'Senior Software Engineer',
      organization: { name: 'TechCorp' },
      linkedin_url: 'https://linkedin.com/in/alice-johnson'
    };

    // Mock window.open
    global.window.open = jest.fn();

    // Create a person card and simulate click
    const personCard = UIManager.createPersonCard(mockPerson, 0);
    personCard.click();

    expect(window.open).toHaveBeenCalledWith('https://linkedin.com/in/alice-johnson', '_blank');
  });

  test('should handle person card without LinkedIn URL', async () => {
    require('../../content/ui-manager.js');
    const UIManager = window.UIManager;

    await UIManager.init();

    const mockPersonNoUrl = {
      name: 'Bob Smith',
      first_name: 'Bob',
      last_name: 'Smith',
      email: 'bob.smith@example.com',
      title: 'Product Manager',
      organization: { name: 'StartupCo' }
      // No linkedin_url field
    };

    // Mock window.open and showTemporaryMessage
    global.window.open = jest.fn();
    UIManager.showTemporaryMessage = jest.fn();

    // Create a person card and simulate click
    const personCard = UIManager.createPersonCard(mockPersonNoUrl, 0);
    personCard.click();

    expect(window.open).not.toHaveBeenCalled();
    expect(UIManager.showTemporaryMessage).toHaveBeenCalledWith('LinkedIn profile not available', 'error');
  });

  test('should not have skip to templates button on feed page', () => {
    require('../../content/ui-manager.js');
    
    // Check that the skip button is not in the DOM
    const skipButton = document.getElementById('skip-to-templates');
    expect(skipButton).toBeNull();
  });

  test('should handle retry people search button', async () => {
    require('../../content/ui-manager.js');
    const UIManager = window.UIManager;

    await UIManager.init();

    UIManager.loadPeopleSuggestions = jest.fn();

    const retryButton = document.getElementById('retry-people-search');
    retryButton.click();

    expect(UIManager.loadPeopleSuggestions).toHaveBeenCalled();
  });

  test('should handle people suggestions error state', () => {
    require('../../content/ui-manager.js');
    const UIManager = window.UIManager;

    // Create the container
    UIManager.container = document.createElement('div');
    UIManager.container.innerHTML = `
      <div id="people-suggestions-loading">Loading...</div>
      <div id="people-suggestions-error" style="display: none;">
        <p>Error message</p>
      </div>
    `;

    UIManager.showPeopleSuggestionsError('Test error message');

    const loadingEl = UIManager.container.querySelector('#people-suggestions-loading');
    const errorEl = UIManager.container.querySelector('#people-suggestions-error');
    const errorTextEl = errorEl.querySelector('p');

    expect(loadingEl.style.display).toBe('none');
    expect(errorEl.style.display).toBe('block');
    expect(errorTextEl.textContent).toBe('Test error message');
  });
});
