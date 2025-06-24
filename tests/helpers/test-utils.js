// Test utilities for LinkMail extension testing

/**
 * Creates a mock LinkedIn profile page DOM structure
 * @param {Object} profileData - Profile data to inject
 * @returns {Object} - Object containing created elements
 */
function createMockLinkedInProfile(profileData = {}) {
  const {
    name = 'John Doe',
    title = 'Software Engineer',
    company = 'Tech Corp',
    email = 'john.doe@example.com',
    hasContactInfo = true,
    hasAboutSection = true
  } = profileData;

  // Create main profile elements
  const profileSection = document.createElement('section');
  profileSection.className = 'pv-top-card';

  // Profile name (h1 - this is what ProfileScraper looks for)
  const nameElement = document.createElement('h1');
  nameElement.textContent = name;
  document.body.appendChild(nameElement); // Add directly to body

  // Profile title (.text-body-medium - this is what ProfileScraper looks for)
  const titleElement = document.createElement('div');
  titleElement.className = 'text-body-medium';
  titleElement.textContent = `${title} at ${company}`;
  document.body.appendChild(titleElement); // Add directly to body

  // About section with proper structure
  let aboutSection = null;
  if (hasAboutSection) {
    // Create the structure that ProfileScraper looks for
    const aboutContainer = document.createElement('div');
    aboutContainer.className = 'pv-profile-card';

    const aboutContent = document.createElement('div');
    aboutContent.className = 'display-flex ph5 pv3';

    const aboutText = document.createElement('div');
    aboutText.className = 'inline-show-more-text--is-collapsed';
    aboutText.textContent = `${title} at ${company}. Contact me at ${email}`;

    aboutContent.appendChild(aboutText);
    aboutContainer.appendChild(aboutContent);

    aboutSection = aboutContainer;
    document.body.appendChild(aboutSection);
  }

  // Experience section with proper structure
  const experienceSection = document.createElement('section');
  const experienceDiv = document.createElement('div');
  experienceDiv.id = 'experience';
  experienceSection.appendChild(experienceDiv);

  // Create a parent element for experience
  const experienceParent = document.createElement('div');
  experienceParent.appendChild(experienceSection);

  // Add some mock experience items
  const experienceList = document.createElement('ul');
  const experienceItem = document.createElement('li');
  experienceItem.className = 'artdeco-list__item';

  const expTitle = document.createElement('span');
  expTitle.className = 't-bold';
  expTitle.textContent = title;

  const expCompany = document.createElement('span');
  expCompany.className = 't-normal';
  expCompany.textContent = company;

  experienceItem.appendChild(expTitle);
  experienceItem.appendChild(expCompany);
  experienceList.appendChild(experienceItem);
  experienceParent.appendChild(experienceList);

  document.body.appendChild(experienceParent);

  // Contact info button
  let contactButton = null;
  if (hasContactInfo) {
    contactButton = document.createElement('a');
    contactButton.href = '/in/test-user/contact-info';
    contactButton.textContent = 'Contact info';
    contactButton.click = jest.fn();
    document.body.appendChild(contactButton);
  }

  return {
    profileSection,
    aboutSection,
    contactButton,
    experienceParent,
    cleanup: () => {
      // Clean up all created elements
      [nameElement, titleElement, aboutSection, experienceParent, contactButton].forEach(el => {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    }
  };
}

/**
 * Creates a mock contact info modal
 * @param {string} email - Email to include in modal
 * @returns {Object} - Object containing modal elements
 */
function createMockContactModal(email = 'test@example.com') {
  const modal = document.createElement('div');
  modal.className = 'artdeco-modal';
  modal.setAttribute('aria-label', 'Contact info');

  const modalContent = document.createElement('div');
  modalContent.className = 'artdeco-modal__content';
  modalContent.textContent = `Email: ${email}\nPhone: 123-456-7890`;

  const closeButton = document.createElement('button');
  closeButton.setAttribute('aria-label', 'Dismiss');
  closeButton.className = 'artdeco-modal__dismiss';
  closeButton.click = jest.fn();

  modal.appendChild(modalContent);
  modal.appendChild(closeButton);
  document.body.appendChild(modal);

  return {
    modal,
    modalContent,
    closeButton,
    cleanup: () => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }
  };
}

/**
 * Creates a mock LinkMail UI container
 * @param {Object} options - UI options
 * @returns {Object} - Object containing UI elements
 */
function createMockLinkMailUI(options = {}) {
  const {
    isAuthenticated = false,
    currentView = 'splash'
  } = options;

  const container = document.createElement('div');
  container.className = 'linkmail-container';

  // Splash view
  const splashView = document.createElement('div');
  splashView.id = 'linkmail-splash';
  splashView.style.display = currentView === 'splash' ? 'flex' : 'none';

  // Sign-in view
  const signinView = document.createElement('div');
  signinView.id = 'linkmail-signin';
  signinView.style.display = currentView === 'signin' ? 'block' : 'none';

  // Success view
  const successView = document.createElement('div');
  successView.id = 'linkmail-success';
  successView.style.display = currentView === 'success' ? 'block' : 'none';

  // Form elements
  const recipientInput = document.createElement('input');
  recipientInput.id = 'recipientEmailInput';
  recipientInput.type = 'email';

  const templateSelect = document.createElement('select');
  templateSelect.id = 'templateSelect';

  const emailTextarea = document.createElement('textarea');
  emailTextarea.id = 'emailContent';

  container.appendChild(splashView);
  container.appendChild(signinView);
  container.appendChild(successView);
  container.appendChild(recipientInput);
  container.appendChild(templateSelect);
  container.appendChild(emailTextarea);

  document.body.appendChild(container);

  return {
    container,
    splashView,
    signinView,
    successView,
    recipientInput,
    templateSelect,
    emailTextarea,
    cleanup: () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  };
}

/**
 * Mock Chrome APIs with common responses using sinon-chrome
 * @param {Object} overrides - Override specific API responses
 */
function mockChromeAPIs(overrides = {}) {
  const defaults = {
    authenticated: false,
    userData: null,
    storageData: {},
    authToken: 'mock-token'
  };

  const config = { ...defaults, ...overrides };

  // Reset all chrome mocks first
  chrome.flush();

  // Mock runtime.sendMessage
  chrome.runtime.sendMessage.callsFake((message, callback) => {
    switch (message.action) {
    case 'checkAuthStatus':
      if (callback) callback({
        isAuthenticated: config.authenticated,
        userData: config.userData
      });
      break;
    case 'signInWithGoogle':
      if (callback) callback({
        success: true,
        userData: config.userData || { email: 'test@example.com', name: 'Test User' }
      });
      break;
    case 'getAuthToken':
      if (callback) callback({ token: config.authToken });
      break;
    case 'logout':
      if (callback) callback({ success: true });
      break;
    case 'openBioSetupPage':
      if (callback) callback({ success: true, tabId: 123 });
      break;
    default:
      if (callback) callback({});
    }
  });

  // Mock storage.local.get
  chrome.storage.local.get.callsFake((keys, callback) => {
    const result = {};
    if (Array.isArray(keys)) {
      keys.forEach(key => {
        if (config.storageData[key]) {
          result[key] = config.storageData[key];
        }
      });
    } else if (typeof keys === 'string') {
      if (config.storageData[keys]) {
        result[keys] = config.storageData[keys];
      }
    } else if (keys === null || keys === undefined) {
      Object.assign(result, config.storageData);
    }
    if (callback) callback(result);
  });

  // Mock storage.local.set
  chrome.storage.local.set.callsFake((items, callback) => {
    Object.assign(config.storageData, items);
    if (callback) callback();
  });

  // Mock tabs.create
  chrome.tabs.create.callsFake((options, callback) => {
    if (callback) callback({ id: 123 });
  });

  // Mock identity.getAuthToken
  chrome.identity.getAuthToken.callsFake((options, callback) => {
    if (callback) callback(config.authToken);
  });
}

/**
 * Wait for a condition to be true
 * @param {Function} condition - Function that returns boolean
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
async function waitFor(condition, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return false;
}

/**
 * Create a test email history
 * @param {number} count - Number of emails to create
 * @returns {Array} - Array of email objects
 */
function createTestEmailHistory(count = 3) {
  const emails = [];
  const baseTime = Date.now();

  for (let i = 0; i < count; i++) {
    emails.push({
      id: `email-${i + 1}`,
      recipientEmail: `recipient${i + 1}@example.com`,
      recipientName: `Recipient ${i + 1}`,
      subject: `Test Subject ${i + 1}`,
      content: `Test email content ${i + 1}`,
      timestamp: baseTime - (i * 86400000), // 1 day apart
      profileUrl: `https://www.linkedin.com/in/test-profile-${i + 1}`,
      status: 'sent'
    });
  }

  return emails;
}

/**
 * Create test templates
 * @param {number} count - Number of templates to create
 * @returns {Array} - Array of template objects
 */
function createTestTemplates(count = 2) {
  const templates = [];

  for (let i = 0; i < count; i++) {
    templates.push({
      id: `template-${i + 1}`,
      name: `Test Template ${i + 1}`,
      description: `Test template description ${i + 1}`,
      icon: '🔧',
      purpose: `test purpose ${i + 1}`,
      subjectLine: `Test Subject ${i + 1}`,
      content: `Test template content ${i + 1}\n\nBest regards,\n[Sender Name]`
    });
  }

  return templates;
}

/**
 * Simulate user interaction delay
 * @param {number} ms - Milliseconds to wait
 */
function simulateDelay(ms = 100) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  createMockLinkedInProfile,
  createMockContactModal,
  createMockLinkMailUI,
  mockChromeAPIs,
  waitFor,
  createTestEmailHistory,
  createTestTemplates,
  simulateDelay
};
