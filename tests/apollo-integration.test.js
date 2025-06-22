// tests/apollo-integration.test.js

// Import test utilities
const path = require('path');
require('./setup'); // Load the test environment setup

describe('Apollo API Integration Tests', () => {
  let mockChromeRuntime;

  beforeEach(() => {
    // Mock Chrome runtime for testing
    mockChromeRuntime = {
      sendMessage: jest.fn(),
      lastError: null
    };
    
    global.chrome = {
      runtime: mockChromeRuntime
    };

    // Load EmailFinder module
    const fs = require('fs');
    const emailFinderPath = path.join(__dirname, '../content/email-finder.js');
    const emailFinderCode = fs.readFileSync(emailFinderPath, 'utf8');
    
    // Execute the code in the test environment
    eval(emailFinderCode.replace('window.EmailFinder', 'global.EmailFinder'));
  });

  test('should have findEmailWithApollo method', () => {
    expect(global.EmailFinder).toBeDefined();
    expect(typeof global.EmailFinder.findEmailWithApollo).toBe('function');
  });

  test('should call Chrome runtime with correct action', async () => {
    const testProfileData = {
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      company: 'Tech Corp',
      headline: 'Software Engineer',
      location: 'San Francisco, CA'
    };

    // Mock successful response
    mockChromeRuntime.sendMessage.mockImplementation((message, callback) => {
      expect(message.action).toBe('enrichWithApollo');
      expect(message.profileData).toEqual(testProfileData);
      
      callback({
        success: true,
        email: 'john.doe@techcorp.com',
        source: 'apollo'
      });
    });

    const result = await global.EmailFinder.findEmailWithApollo(testProfileData);

    expect(result.success).toBe(true);
    expect(result.email).toBe('john.doe@techcorp.com');
    expect(result.source).toBe('apollo');
    expect(mockChromeRuntime.sendMessage).toHaveBeenCalledTimes(1);
  });

  test('should handle API errors gracefully', async () => {
    const testProfileData = {
      name: 'Jane Smith',
      company: 'Unknown Corp'
    };

    // Mock error response
    mockChromeRuntime.sendMessage.mockImplementation((message, callback) => {
      callback({
        success: false,
        error: 'No email found in Apollo database',
        source: 'apollo'
      });
    });

    const result = await global.EmailFinder.findEmailWithApollo(testProfileData);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No email found in Apollo database');
    expect(result.source).toBe('apollo');
  });

  test('should handle Chrome runtime errors', async () => {
    const testProfileData = {
      name: 'Test User'
    };

    // Mock Chrome runtime error
    mockChromeRuntime.lastError = { message: 'Extension context invalidated' };
    mockChromeRuntime.sendMessage.mockImplementation((message, callback) => {
      callback(null);
    });

    const result = await global.EmailFinder.findEmailWithApollo(testProfileData);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Extension error occurred');
  });

  test('should handle missing profile data', async () => {
    const emptyProfileData = {};

    mockChromeRuntime.sendMessage.mockImplementation((message, callback) => {
      // Simulate backend handling empty data
      callback({
        success: false,
        error: 'Insufficient profile data for enrichment',
        source: 'apollo'
      });
    });

    const result = await global.EmailFinder.findEmailWithApollo(emptyProfileData);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient profile data for enrichment');
  });
}); 