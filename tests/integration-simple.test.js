// Simplified integration tests
const { mockChromeAPIs, createMockLinkMailUI } = require('./helpers/test-utils');

// Load the content scripts
require('../content/utils.js');
require('../content/email-finder.js');

// Mock ProfileScraper
window.ProfileScraper = {
  scrapeBasicProfileData: jest.fn().mockResolvedValue({
    name: 'John Doe',
    title: 'Software Engineer',
    company: 'Tech Corp'
  })
};

describe('Component Integration Tests', () => {
  beforeEach(() => {
    mockChromeAPIs();

    // Reset window.location
    delete window.location;
    window.location = { href: 'https://www.linkedin.com/in/test-profile' };
  });

  test('should have all required components loaded', () => {
    expect(window.Utils).toBeDefined();
    expect(window.EmailFinder).toBeDefined();
    expect(window.ProfileScraper).toBeDefined();
  });

  test('should handle basic email finding workflow', () => {
    // Create mock about section with email
    const aboutSection = document.createElement('section');
    const aboutDiv = document.createElement('div');
    aboutDiv.id = 'about';
    aboutDiv.textContent = 'Contact me at john@example.com';
    aboutSection.appendChild(aboutDiv);
    document.body.appendChild(aboutSection);

    const email = window.EmailFinder.checkAboutSection();
    expect(email).toBe('john@example.com');

    // Cleanup
    document.body.removeChild(aboutSection);
  });

  test('should handle Chrome API integration', () => {
    mockChromeAPIs({
      authenticated: true,
      storageData: { 'test@example.com': { name: 'Test User' } }
    });

    let authResult = null;
    chrome.runtime.sendMessage({ action: 'checkAuthStatus' }, (response) => {
      authResult = response;
    });

    expect(authResult.isAuthenticated).toBe(true);
  });

  test('should handle UI component creation', () => {
    const ui = createMockLinkMailUI({ currentView: 'splash' });

    expect(ui.container).toBeDefined();
    expect(ui.splashView.style.display).toBe('flex');
    expect(ui.signinView.style.display).toBe('none');

    // Cleanup
    ui.cleanup();
  });

  test('should handle email caching', () => {
    const testEmail = 'cached@example.com';
    const testUrl = 'https://www.linkedin.com/in/test';

    // Clear cache first
    window.EmailFinder.clearCachedEmail();
    expect(window.EmailFinder._lastFoundEmail).toBeNull();

    // Set cache
    window.EmailFinder._lastFoundEmail = testEmail;
    window.EmailFinder._lastProfileUrl = testUrl;

    expect(window.EmailFinder._lastFoundEmail).toBe(testEmail);
    expect(window.EmailFinder._lastProfileUrl).toBe(testUrl);

    // Clear cache
    window.EmailFinder.clearCachedEmail();
    expect(window.EmailFinder._lastFoundEmail).toBeNull();
  });

  test('should handle utility functions integration', () => {
    // Test email extraction with Utils
    const text = 'Please contact me at integration@test.com for more info';
    const extractedEmail = window.Utils.extractEmail(text);
    expect(extractedEmail).toBe('integration@test.com');

    // Test HTML escaping
    const dangerousHtml = '<script>alert("test")</script>';
    const safeHtml = window.Utils.escapeHtml(dangerousHtml);
    expect(safeHtml).not.toContain('<script>');
    expect(safeHtml).toContain('&lt;script&gt;');
  });
});
