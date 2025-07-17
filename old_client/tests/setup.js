// Jest test setup for Chrome extension testing
const sinonChrome = require('sinon-chrome');

// Setup chrome extension APIs
global.chrome = sinonChrome;

// Mock fetch API
global.fetch = jest.fn();

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mocked-url');

// Mock common DOM APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
});

// Mock chrome.runtime.getURL
chrome.runtime.getURL.callsFake((path) => `chrome-extension://test-extension-id/${path}`);

// Setup before each test
beforeEach(() => {
  // Clear all mocks
  jest.clearAllMocks();

  // Reset chrome API mocks
  sinonChrome.flush();

  // Clear DOM
  document.body.innerHTML = '';

  // Reset fetch mock
  fetch.mockClear();
});

// Setup after each test
afterEach(() => {
  // Clean up any timers
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});
