/**
 * Content Script Basic Tests
 * Tests the main entry point that coordinates all components
 */

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

describe('Content Script - Basic Integration', () => {
  beforeEach(() => {
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
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should load without errors', () => {
    expect(() => {
      require('../../content/content.js');
    }).not.toThrow();
  });

  test('should register Chrome runtime message listener', () => {
    require('../../content/content.js');
    
    expect(chrome.runtime.onMessage.addListener.calledOnce).toBe(true);
  });

  test('should detect LinkedIn profile pages', async () => {
    // Start with valid profile URL
    window.location.href = 'https://www.linkedin.com/in/john-doe/';
    
    require('../../content/content.js');
    
    // Fast-forward timers to trigger initialization
    jest.advanceTimersByTime(1100); // 1000ms delay + some buffer
    
    // Should initialize UIManager for profile pages
    expect(window.UIManager.init).toHaveBeenCalled();
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

  test('should handle findEmail message correctly', async () => {
    window.location.href = 'https://www.linkedin.com/in/john-doe/';
    
    require('../../content/content.js');
    
    // Get the registered message listener
    const messageListenerCall = chrome.runtime.onMessage.addListener.getCall(0);
    const messageListener = messageListenerCall.args[0];
    
    // Mock sendResponse
    const mockSendResponse = jest.fn();
    
    // Simulate findEmail message
    const result = messageListener(
      { action: 'findEmail' },
      {},
      mockSendResponse
    );
    
    // Should return true for async response
    expect(result).toBe(true);
    
    // Should call EmailFinder
    expect(window.EmailFinder.findLinkedInEmail).toHaveBeenCalled();
    
    // Wait for async operations
    await Promise.resolve();
    
    // Should call populateForm and send response
    expect(window.UIManager.populateForm).toHaveBeenCalled();
    expect(mockSendResponse).toHaveBeenCalledWith({ email: 'test@example.com' });
  });

  test('should handle findEmail errors gracefully', async () => {
    window.location.href = 'https://www.linkedin.com/in/john-doe/';
    
    // Make EmailFinder throw an error
    window.EmailFinder.findLinkedInEmail.mockRejectedValueOnce(new Error('Network error'));
    
    require('../../content/content.js');
    
    const messageListener = chrome.runtime.onMessage.addListener.getCall(0).args[0];
    const mockSendResponse = jest.fn();
    
    messageListener(
      { action: 'findEmail' },
      {},
      mockSendResponse
    );
    
    // Wait for async operations
    await Promise.resolve();
    
    expect(mockSendResponse).toHaveBeenCalledWith({ error: 'Error finding email' });
  });

  test('should handle findEmail when no email found', async () => {
    window.location.href = 'https://www.linkedin.com/in/john-doe/';
    
    // Make EmailFinder return null
    window.EmailFinder.findLinkedInEmail.mockResolvedValueOnce(null);
    
    require('../../content/content.js');
    
    const messageListener = chrome.runtime.onMessage.addListener.getCall(0).args[0];
    const mockSendResponse = jest.fn();
    
    messageListener(
      { action: 'findEmail' },
      {},
      mockSendResponse
    );
    
    // Wait for async operations
    await Promise.resolve();
    
    expect(mockSendResponse).toHaveBeenCalledWith({
      error: 'No Email Found on LinkedIn Page. Please Input Email Manually.'
    });
  });

  test('should use Utils.debounce for performance', () => {
    window.location.href = 'https://www.linkedin.com/in/john-doe/';
    
    require('../../content/content.js');
    
    // Should use debounce for MutationObserver callback
    expect(window.Utils.debounce).toHaveBeenCalledWith(expect.any(Function), 500);
  });

  test('should set up URL monitoring with intervals', () => {
    window.location.href = 'https://www.linkedin.com/in/john-doe/';
    
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    
    require('../../content/content.js');
    
    // Fast-forward to trigger setupUrlObserver
    jest.advanceTimersByTime(1100);
    
    // Should set up URL monitoring
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    
    setIntervalSpy.mockRestore();
  });

  test('should handle missing dependencies gracefully', () => {
    // Remove UIManager
    delete window.UIManager;
    
    expect(() => {
      require('../../content/content.js');
      jest.advanceTimersByTime(1100);
    }).not.toThrow();
  });

  test('should handle DOM ready state loading', () => {
    document.readyState = 'loading';
    
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    
    require('../../content/content.js');
    
    // Should wait for DOM ready
    expect(addEventListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
    
    addEventListenerSpy.mockRestore();
  });
}); 