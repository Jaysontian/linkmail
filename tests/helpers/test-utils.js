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
 * Mock Chrome APIs with common responses using Jest mocks
 * @param {Object} overrides - Override specific API responses
 */
function mockChromeAPIs(overrides = {}) {
  const defaults = {
    authenticated: false,
    userData: null,
    storageData: {},
    authToken: 'mock-token',
  };

  const config = { ...defaults, ...overrides };

  const chromeMock = {
    runtime: {
      sendMessage: jest.fn((message, callback) => {
        if (typeof callback !== 'function') {
          return Promise.resolve();
        }

        switch (message.action) {
          case 'checkAuthStatus':
            callback({ isAuthenticated: config.authenticated, userData: config.userData });
            break;
          case 'signInWithGoogle':
            callback({ success: true, userData: config.userData || { email: 'test@example.com', name: 'Test User' } });
            break;
          case 'getAuthToken':
            callback({ token: config.authToken });
            break;
          case 'logout':
            callback({ success: true });
            break;
          case 'openBioSetupPage':
            callback({ success: true, tabId: 123 });
            break;
          default:
            callback({});
        }
      }),
      onMessage: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
        hasListeners: jest.fn(() => true),
      },
      lastError: null,
    },
    storage: {
      local: {
        get: jest.fn((keys, callback) => {
          const result = {};
          const requestedKeys = Array.isArray(keys) ? keys : [keys];
          requestedKeys.forEach(key => {
            result[key] = config.storageData[key] || null;
          });
          if (callback) callback(result);
          return Promise.resolve(result);
        }),
        set: jest.fn((data, callback) => {
          Object.assign(config.storageData, data);
          if (callback) callback();
          return Promise.resolve();
        }),
        remove: jest.fn((keys, callback) => {
          const keysToRemove = Array.isArray(keys) ? keys : [keys];
          keysToRemove.forEach(key => delete config.storageData[key]);
          if (callback) callback();
          return Promise.resolve();
        }),
        clear: jest.fn(callback => {
          config.storageData = {};
          if (callback) callback();
          return Promise.resolve();
        }),
      },
      sync: {
        get: jest.fn((keys, callback) => {
          if (callback) callback({});
          return Promise.resolve({});
        }),
        set: jest.fn((data, callback) => {
          if (callback) callback();
          return Promise.resolve();
        }),
      },
      onChanged: {
        _listeners: [],
        addListener: jest.fn(listener => {
          chromeMock.storage.onChanged._listeners.push(listener);
        }),
        removeListener: jest.fn(listener => {
          const index = chromeMock.storage.onChanged._listeners.indexOf(listener);
          if (index > -1) {
            chromeMock.storage.onChanged._listeners.splice(index, 1);
          }
        }),
        trigger: jest.fn((changes, area) => {
          chromeMock.storage.onChanged._listeners.forEach(listener => {
            listener(changes, area);
          });
        }),
      },
    },
    tabs: {
      create: jest.fn((createProperties, callback) => {
        const mockTab = { id: 123, url: createProperties.url };
        if (callback) callback(mockTab);
        return Promise.resolve(mockTab);
      }),
      query: jest.fn(),
      sendMessage: jest.fn(),
    },
    action: {
      setBadgeText: jest.fn(),
      setBadgeBackgroundColor: jest.fn(),
    },
    identity: {
        getAuthToken: jest.fn((options, callback) => {
            if (callback) callback(config.authToken);
        }),
        removeCachedAuthToken: jest.fn((options, callback) => {
            if (callback) callback();
        })
    }
  };

  global.chrome = chromeMock;
  return chromeMock;
}


/**
 * Waits for a condition to be true before proceeding.
 * Useful for tests involving asynchronous UI updates.
 * @param {Function} condition - A function that returns true when the condition is met.
 * @param {number} [timeout=5000] - Maximum time to wait in milliseconds.
 * @param {number} [interval=50] - Time between checks in milliseconds.
 * @returns {Promise<void>} - A promise that resolves when the condition is met.
 * @throws {Error} - Throws an error if the timeout is reached.
 */
async function waitFor(condition, timeout = 5000, interval = 50) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('Timeout waiting for condition');
}

/**
 * Creates a mock email history for testing dashboard functionality.
 * @param {number} [count=3] - The number of email history entries to create.
 * @returns {Array<Object>} - An array of mock email history objects.
 */
function createTestEmailHistory(count = 3) {
  const history = [];
  for (let i = 0; i < count; i++) {
    history.push({
      id: `test-id-${i}`,
      recipient: `recipient${i}@example.com`,
      subject: `Test Subject ${i}`,
      body: `This is test email body ${i}.`,
      status: i % 2 === 0 ? 'Sent' : 'Opened',
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
    });
  }
  return history;
}


/**
 * Creates a set of mock templates for testing template functionality.
 * @param {number} [count=2] - The number of custom templates to create.
 * @returns {Array<Object>} - An array of mock template objects.
 */
function createTestTemplates(count = 2) {
  const templates = [];
  for (let i = 0; i < count; i++) {
    templates.push({
      id: `template-id-${i}`,
      name: `Custom Template ${i + 1}`,
      subject: `Subject for Template ${i + 1}`,
      body: `This is the body for custom template ${i + 1}.`
    });
  }
  return templates;
}

/**
 * Simulates a delay using Promises.
 * @param {number} [ms=100] - The delay in milliseconds.
 * @returns {Promise<void>} - A promise that resolves after the delay.
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
  simulateDelay,
};
