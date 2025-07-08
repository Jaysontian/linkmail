/**
 * Content Script Basic Tests
 * Tests the main entry point that coordinates all components
 */

const { mockChromeAPIs } = require('../helpers/test-utils');

// Mock dependencies that content.js uses
global.window.UIManager = {
  init: jest.fn().mockResolvedValue(),
  resetUI: jest.fn(),
  checkLastEmailSent: jest.fn(),
  populateForm: jest.fn()
};

global.window.EmailFinder = {
  clearCachedEmail: jest.fn(),
  findLinkedInEmail: jest.fn().mockResolvedValue('test@example.com')
};

global.window.Utils = {
  debounce: jest.fn((fn, delay) => fn) // Return the function directly for testing
};

// Set up Chrome API mocks
mockChromeAPIs();

describe('Content Script - Basic Integration', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Set up a valid LinkedIn profile page environment
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://www.linkedin.com/in/john-doe/'
      },
      writable: true
    });

    // Mock DOM structure
    document.body.innerHTML = '<div><h1>John Doe</h1></div>';
    document.readyState = 'complete';

    // Mock timing functions to control async behavior
    jest.useFakeTimers();
    
    // Ensure Utils is available on global scope
    global.Utils = global.window.Utils;
    global.UIManager = global.window.UIManager;
    global.EmailFinder = global.window.EmailFinder;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should load without errors', () => {
    expect(() => {
      require('../../content/content.js');
    }).not.toThrow();
  });

  test('should ignore non-profile pages', async () => {
    // Set to non-profile URL
    window.location.href = 'https://www.linkedin.com/feed/';
    
    require('../../content/content.js');
    
    // Fast-forward timers
    jest.advanceTimersByTime(1100);
    
    // Should not initialize for non-profile pages
    expect(window.UIManager.init).not.toHaveBeenCalled();
  });

  test('should handle missing dependencies gracefully', () => {
    // Remove UIManager
    delete window.UIManager;
    
    expect(() => {
      require('../../content/content.js');
      jest.advanceTimersByTime(1100);
    }).not.toThrow();
  });
}); 