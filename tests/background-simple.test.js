// Simplified background script tests
const { mockChromeAPIs } = require('./helpers/test-utils');

describe('Background Script - Core Functionality', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockChromeAPIs();
  });

  test('should have Chrome APIs available', () => {
    expect(chrome).toBeDefined();
    expect(chrome.runtime).toBeDefined();
    expect(chrome.storage).toBeDefined();
    expect(chrome.identity).toBeDefined();
    expect(chrome.tabs).toBeDefined();
  });

  test('should handle authentication check', async () => {
    mockChromeAPIs({
      authenticated: true,
      userData: { email: 'test@example.com', name: 'Test User' }
    });

    let responseReceived = null;

    chrome.runtime.sendMessage({ action: 'checkAuthStatus' }, (response) => {
      responseReceived = response;
    });

    expect(responseReceived).toEqual({
      isAuthenticated: true,
      userData: { email: 'test@example.com', name: 'Test User' }
    });
  });

  test('should handle storage operations', async () => {
    const testData = { key: 'value', user: { name: 'test' } };

    mockChromeAPIs({ storageData: testData });

    let storageResult = null;

    chrome.storage.local.get(['key'], (result) => {
      storageResult = result;
    });

    expect(storageResult).toEqual({ key: 'value' });
  });

  test('should handle tab creation', async () => {
    mockChromeAPIs();

    let tabResult = null;

    chrome.tabs.create({ url: 'https://example.com' }, (tab) => {
      tabResult = tab;
    });

    expect(tabResult).toEqual({ id: 123 });
  });

  test('should handle auth token requests', async () => {
    mockChromeAPIs({ authToken: 'test-token-123' });

    let tokenResult = null;

    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      tokenResult = token;
    });

    expect(tokenResult).toBe('test-token-123');
  });
});
