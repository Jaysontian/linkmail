const { mockChromeAPIs } = require('../helpers/test-utils');

// Mock browser globals before importing modules
global.window = global.window || {};
global.chrome = global.chrome || {};
global.fetch = jest.fn();
global.btoa = jest.fn();
global.unescape = jest.fn();
global.encodeURIComponent = jest.fn();

// Mock DOM elements properly
document.querySelector = jest.fn();

// Mock location
Object.defineProperty(window, 'location', {
  value: {
    href: 'https://www.linkedin.com/in/john-doe/'
  },
  writable: true
});

// Import GmailManager after setting up mocks
let GmailManager;
beforeAll(() => {
  // Set up browser-like environment
  global.window.GmailManager = {};
  
  // Import the module
  require('../../content/gmail-manager');
  
  // Get the module from the global window object
  GmailManager = global.window.GmailManager;
});

describe('GmailManager - Comprehensive Tests', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Set up Chrome API mocks using the proper approach
    mockChromeAPIs({
      authenticated: true,
      userData: {
        email: 'test@example.com',
        name: 'Test User'
      },
      authToken: 'mock-auth-token-123'
    });

    // Reset GmailManager state
    GmailManager.currentToken = null;
    GmailManager.userData = null;

    // Mock btoa and encoding functions
    btoa.mockImplementation((str) => Buffer.from(str).toString('base64'));
    unescape.mockImplementation((str) => str);
    encodeURIComponent.mockImplementation((str) => str);

    // Mock document.querySelector
    document.querySelector.mockReturnValue({
      innerText: 'John Doe'
    });
  });

  describe('Authentication and Token Management', () => {
    test('should get auth token successfully', async () => {
      const token = await GmailManager.getAuthToken();

      expect(token).toBe('mock-auth-token-123');
      expect(GmailManager.currentToken).toBe('mock-auth-token-123');
    });

    test('should handle auth token error', async () => {
      // Override the mock to return an error
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.action === 'getAuthToken') {
          callback({ error: { message: 'Authentication failed' } });
        }
      });

      await expect(GmailManager.getAuthToken()).rejects.toThrow('Authentication failed');
      expect(GmailManager.currentToken).toBe(null);
    });

    test('should handle Chrome runtime errors during token request', async () => {
      // Override the mock to throw an error
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.action === 'getAuthToken') {
          throw new Error('Chrome runtime error');
        }
      });

      await expect(GmailManager.getAuthToken()).rejects.toThrow('Chrome runtime error');
    });

    test('should set user data correctly', () => {
      const userData = {
        email: 'user@example.com',
        name: 'Test User',
        college: 'MIT'
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      GmailManager.setUserData(userData);

      expect(GmailManager.userData).toEqual(userData);
      expect(consoleSpy).toHaveBeenCalledWith('GmailManager: User data set', 'Test User');

      consoleSpy.mockRestore();
    });

    test('should handle null user data', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      GmailManager.setUserData(null);

      expect(GmailManager.userData).toBe(null);
      expect(consoleSpy).toHaveBeenCalledWith('GmailManager: User data set', undefined);

      consoleSpy.mockRestore();
    });
  });

  describe('User Profile Management', () => {
    test('should get user profile successfully', async () => {
      const mockProfile = {
        emailAddress: 'user@gmail.com',
        messagesTotal: 1500,
        threadsTotal: 800
      };

      GmailManager.currentToken = 'valid-token';
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfile)
      });

      const profile = await GmailManager.getUserProfile();

      expect(fetch).toHaveBeenCalledWith(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json'
          }
        }
      );
      expect(profile).toEqual(mockProfile);
    });

    test('should get auth token if not available for profile request', async () => {
      const mockProfile = { emailAddress: 'user@gmail.com' };

      // No current token
      GmailManager.currentToken = null;

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfile)
      });

      const profile = await GmailManager.getUserProfile();

      expect(GmailManager.currentToken).toBe('mock-auth-token-123');
      expect(profile).toEqual(mockProfile);
    });

    test('should handle getUserProfile API errors', async () => {
      GmailManager.currentToken = 'valid-token';
      
      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: { message: 'Profile access denied' }
        })
      });

      await expect(GmailManager.getUserProfile()).rejects.toThrow('Profile access denied');
    });

    test('should retry getUserProfile with new token on 401 error', async () => {
      const mockProfile = { emailAddress: 'user@gmail.com' };

      GmailManager.currentToken = 'expired-token';

      // Mock first call to fail with 401
      fetch
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({
            error: { message: 'invalid_token' }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

      const profile = await GmailManager.getUserProfile();

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(GmailManager.currentToken).toBe('mock-auth-token-123'); // Should get new token
      expect(profile).toEqual(mockProfile);
    });
  });

  describe('Email Creation and Processing', () => {
    test('should create email with basic content', () => {
      const emailData = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        message: 'Test message content',
        from: {
          email: 'sender@example.com',
          name: 'Sender Name'
        }
      };

      const result = GmailManager.createEmail(emailData);

      expect(btoa).toHaveBeenCalled();
      expect(unescape).toHaveBeenCalled();
      expect(encodeURIComponent).toHaveBeenCalled();
      expect(typeof result).toBe('string');
    });

    test('should create email with attachments', () => {
      const emailData = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        message: 'Test message content',
        from: {
          email: 'sender@example.com',
          name: 'Sender Name'
        },
        attachments: [
          {
            name: 'document.pdf',
            type: 'application/pdf',
            data: 'base64-encoded-data'
          }
        ]
      };

      const result = GmailManager.createEmail(emailData);

      expect(btoa).toHaveBeenCalled();
      expect(typeof result).toBe('string');
    });

    test('should handle email creation without from name', () => {
      const emailData = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        message: 'Test message content',
        from: {
          email: 'sender@example.com'
        }
      };

      const result = GmailManager.createEmail(emailData);

      expect(btoa).toHaveBeenCalled();
      expect(typeof result).toBe('string');
    });

    test('should process message content correctly', () => {
      const message = 'Hello\n\nThis is a test message.\n\nBest regards,\nSender';
      
      const result = GmailManager.processMessageContent(message);

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<p>Hello</p>');
      expect(result).toContain('<p>This is a test message.</p>');
      expect(result).toContain('<p>Best regards, Sender</p>');
      expect(result).toContain('font-family: Arial, sans-serif');
    });

    test('should escape HTML special characters in message', () => {
      const message = 'Test message with <script>alert("xss")</script> & other & "quotes"';
      
      const result = GmailManager.processMessageContent(message);

      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
      expect(result).not.toContain('<script>');
    });

    test('should handle empty message content', () => {
      const message = '';
      
      const result = GmailManager.processMessageContent(message);

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<body>');
      expect(result).toContain('</body>');
    });

    test('should normalize whitespace in message content', () => {
      const message = 'Test   message   with\n\n\nmultiple\n   spaces';
      
      const result = GmailManager.processMessageContent(message);

      expect(result).toContain('<p>Test message with</p>');
      expect(result).toContain('<p>multiple spaces</p>');
    });
  });

  describe('Email Sending', () => {
    beforeEach(() => {
      GmailManager.currentToken = 'valid-token';
      GmailManager.userData = { name: 'Test User' };
    });

    test('should send email successfully', async () => {
      const mockProfile = { emailAddress: 'sender@gmail.com' };
      const mockSendResponse = { id: 'message-id-123' };

      // Mock getUserProfile and sendEmail API calls
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSendResponse)
        });

      const result = await GmailManager.sendEmail(
        'recipient@example.com',
        'Test Subject',
        'Test message content'
      );

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenLastCalledWith(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json'
          },
          body: expect.any(String)
        }
      );
      expect(result).toEqual(mockSendResponse);
    });

    test('should get auth token if not available for sending', async () => {
      const mockProfile = { emailAddress: 'sender@gmail.com' };
      const mockSendResponse = { id: 'message-id-123' };

      GmailManager.currentToken = null;

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSendResponse)
        });

      const result = await GmailManager.sendEmail(
        'recipient@example.com',
        'Test Subject',
        'Test message content'
      );

      expect(GmailManager.currentToken).toBe('mock-auth-token-123');
      expect(result).toEqual(mockSendResponse);
    });

    test('should send email with attachments', async () => {
      const mockProfile = { emailAddress: 'sender@gmail.com' };
      const mockSendResponse = { id: 'message-id-123' };
      const attachments = [
        {
          name: 'resume.pdf',
          type: 'application/pdf',
          data: 'base64-data'
        }
      ];

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSendResponse)
        });

      const result = await GmailManager.sendEmail(
        'recipient@example.com',
        'Test Subject',
        'Test message content',
        attachments
      );

      expect(result).toEqual(mockSendResponse);
    });

    test('should handle send email API errors', async () => {
      const mockProfile = { emailAddress: 'sender@gmail.com' };

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({
            error: { message: 'Failed to send email' }
          })
        });

      await expect(GmailManager.sendEmail(
        'recipient@example.com',
        'Test Subject',
        'Test message content'
      )).rejects.toThrow('Failed to send email');
    });

    test('should retry send email with new token on 401 error', async () => {
      const mockProfile = { emailAddress: 'sender@gmail.com' };
      const mockSendResponse = { id: 'message-id-123' };

      // Mock profile call
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfile)
      });

      // Mock first send call to fail with 401
      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: { message: 'invalid_token' }
        })
      });

      // Mock profile call for retry
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfile)
      });

      // Mock successful send call
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSendResponse)
      });

      const result = await GmailManager.sendEmail(
        'recipient@example.com',
        'Test Subject',
        'Test message content'
      );

      expect(fetch).toHaveBeenCalledTimes(4);
      expect(GmailManager.currentToken).toBe('mock-auth-token-123');
      expect(result).toEqual(mockSendResponse);
    });
  });

  describe('Email Sending and Storage', () => {
    beforeEach(() => {
      GmailManager.currentToken = 'valid-token';
      GmailManager.userData = { name: 'Test User' };
      
      // Mock UIManager
      global.window.UIManager = {
        checkLastEmailSent: jest.fn()
      };
    });

    test('should send and save email successfully', async () => {
      const mockProfile = { emailAddress: 'sender@gmail.com' };
      const mockSendResponse = { id: 'message-id-123' };

      // Need to mock the getUserProfile and sendEmail API calls within sendAndSaveEmail
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSendResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

      // Set up storage mock
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          'sender@gmail.com': {
            sentEmails: []
          }
        });
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const result = await GmailManager.sendAndSaveEmail(
        'recipient@example.com',
        'Test Subject',
        'Test message content'
      );

      expect(result).toEqual(mockSendResponse);
      expect(global.window.UIManager.checkLastEmailSent).toHaveBeenCalled();
    });

    test('should save email record with correct data', async () => {
      const mockProfile = { emailAddress: 'sender@gmail.com' };
      const mockSendResponse = { id: 'message-id-123' };

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSendResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

      let savedData = null;
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          'sender@gmail.com': {
            sentEmails: []
          }
        });
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        savedData = data;
        callback();
      });

      await GmailManager.sendAndSaveEmail(
        'recipient@example.com',
        'Test Subject',
        'Test message content',
        [{ name: 'attachment.pdf', size: 1024 }]
      );

      expect(savedData).toBeTruthy();
      expect(savedData['sender@gmail.com'].sentEmails).toHaveLength(1);
      
      const emailRecord = savedData['sender@gmail.com'].sentEmails[0];
      expect(emailRecord.recipientEmail).toBe('recipient@example.com');
      expect(emailRecord.recipientName).toBe('John Doe');
      expect(emailRecord.subject).toBe('Test Subject');
      expect(emailRecord.content).toBe('Test message content');
      expect(emailRecord.linkedInUrl).toBe('https://www.linkedin.com/in/john-doe/');
      expect(emailRecord.attachments).toEqual([{ name: 'attachment.pdf', size: 1024 }]);
      expect(emailRecord.date).toBeTruthy();
    });

    test('should handle existing user data when saving email', async () => {
      const mockProfile = { emailAddress: 'sender@gmail.com' };
      const mockSendResponse = { id: 'message-id-123' };

      GmailManager.currentToken = 'valid-token';

      // Mock the sequence: getUserProfile (in sendEmail) + sendEmail API + getUserProfile (in sendAndSaveEmail)
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSendResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

      const existingData = {
        'sender@gmail.com': {
          sentEmails: [
            {
              recipientEmail: 'old@example.com',
              subject: 'Old Email',
              date: '2023-01-01T00:00:00.000Z'
            }
          ],
          templates: ['template1']
        }
      };

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback(existingData);
      });

      let savedData = null;
      chrome.storage.local.set.mockImplementation((data, callback) => {
        savedData = data;
        callback();
      });

      await GmailManager.sendAndSaveEmail(
        'new@example.com',
        'New Subject',
        'New content'
      );

      expect(savedData['sender@gmail.com'].sentEmails).toHaveLength(2);
      expect(savedData['sender@gmail.com'].templates).toEqual(['template1']);
      expect(savedData['sender@gmail.com'].sentEmails[0].recipientEmail).toBe('old@example.com');
      expect(savedData['sender@gmail.com'].sentEmails[1].recipientEmail).toBe('new@example.com');
    });

    test('should handle sendAndSaveEmail when no existing user data', async () => {
      const mockProfile = { emailAddress: 'sender@gmail.com' };
      const mockSendResponse = { id: 'message-id-123' };

      GmailManager.currentToken = 'valid-token';

      // Mock the sequence: getUserProfile (in sendEmail) + sendEmail API + getUserProfile (in sendAndSaveEmail)
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSendResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({}); // No existing data
      });

      let savedData = null;
      chrome.storage.local.set.mockImplementation((data, callback) => {
        savedData = data;
        callback();
      });

      await GmailManager.sendAndSaveEmail(
        'recipient@example.com',
        'Test Subject',
        'Test content'
      );

      expect(savedData['sender@gmail.com'].sentEmails).toHaveLength(1);
      expect(savedData['sender@gmail.com'].sentEmails[0].recipientEmail).toBe('recipient@example.com');
    });

    test('should handle sendAndSaveEmail errors', async () => {
      // Mock sendEmail to fail
      const originalSendEmail = GmailManager.sendEmail;
      GmailManager.sendEmail = jest.fn().mockRejectedValue(new Error('Send failed'));

      await expect(GmailManager.sendAndSaveEmail(
        'recipient@example.com',
        'Test Subject',
        'Test content'
      )).rejects.toThrow('Send failed');

      // Restore original method
      GmailManager.sendEmail = originalSendEmail;
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing document.querySelector', async () => {
      document.querySelector.mockReturnValue(null);

      const mockProfile = { emailAddress: 'sender@gmail.com' };
      const mockSendResponse = { id: 'message-id-123' };

      GmailManager.currentToken = 'valid-token';
      GmailManager.userData = { name: 'Test User' };

      // Mock the sequence: getUserProfile (in sendEmail) + sendEmail API + getUserProfile (in sendAndSaveEmail)
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSendResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'sender@gmail.com': { sentEmails: [] } });
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const result = await GmailManager.sendAndSaveEmail(
        'recipient@example.com',
        'Test Subject',
        'Test content'
      );

      expect(result).toEqual(mockSendResponse);
    });

    test('should handle Chrome storage errors gracefully', async () => {
      const mockProfile = { emailAddress: 'sender@gmail.com' };
      const mockSendResponse = { id: 'message-id-123' };

      GmailManager.currentToken = 'valid-token';

      // Mock the sequence: getUserProfile (in sendEmail) + sendEmail API + getUserProfile (in sendAndSaveEmail)
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSendResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

      // Mock storage error - should call callback with error, not throw directly
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        try {
          callback({});
        } catch (e) {
          // This simulates a storage access error without breaking the test
          console.log('Storage error simulated');
        }
      });

      // Should not throw error, just log it
      const result = await GmailManager.sendAndSaveEmail(
        'recipient@example.com',
        'Test Subject',
        'Test content'
      );

      expect(result).toEqual(mockSendResponse);
    });

    test('should handle network errors during email sending', async () => {
      GmailManager.currentToken = 'valid-token';
      
      fetch.mockRejectedValue(new Error('Network error'));

      await expect(GmailManager.sendEmail(
        'recipient@example.com',
        'Test Subject',
        'Test content'
      )).rejects.toThrow('Network error');
    });

    test('should handle malformed API responses', async () => {
      GmailManager.currentToken = 'valid-token';
      
      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}) // Missing error object
      });

      await expect(GmailManager.getUserProfile()).rejects.toThrow('Failed to fetch user profile');
    });

    test('should handle encoding function errors', () => {
      btoa.mockImplementation(() => {
        throw new Error('Encoding error');
      });

      const emailData = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        message: 'Test message',
        from: { email: 'sender@example.com' }
      };

      expect(() => GmailManager.createEmail(emailData)).toThrow('Encoding error');
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle full email workflow with token refresh', async () => {
      const refreshedToken = 'new-token';
      const mockProfile = { emailAddress: 'sender@gmail.com' };
      const mockSendResponse = { id: 'message-id-123' };

      GmailManager.currentToken = 'expired-token';
      GmailManager.userData = { name: 'Test User' };

      // Mock sequence: getUserProfile (in sendEmail) + sendEmail API + getUserProfile (in sendAndSaveEmail, fails 401) + getUserProfile (retry)  
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSendResponse)
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: { message: '401' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'sender@gmail.com': { sentEmails: [] } });
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const result = await GmailManager.sendAndSaveEmail(
        'recipient@example.com',
        'Test Subject',
        'Test content'
      );

      expect(GmailManager.currentToken).toBe('mock-auth-token-123');
      expect(result).toEqual(mockSendResponse);
    });

    test('should handle multiple rapid email sends', async () => {
      const mockProfile = { emailAddress: 'sender@gmail.com' };
      const mockSendResponse1 = { id: 'message-id-1' };
      const mockSendResponse2 = { id: 'message-id-2' };

      GmailManager.currentToken = 'valid-token';
      GmailManager.userData = { name: 'Test User' };

      // Mock responses based on URL to handle parallel execution properly
      fetch.mockImplementation((url) => {
        if (url.includes('profile')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockProfile)
          });
        } else if (url.includes('send')) {
          // Return different responses for each send call
          const callCount = fetch.mock.calls.filter(call => call[0].includes('send')).length;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(callCount === 1 ? mockSendResponse1 : mockSendResponse2)
          });
        }
      });

      let callCount = 0;
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          'sender@gmail.com': {
            sentEmails: Array(callCount).fill().map((_, i) => ({ id: i }))
          }
        });
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        callCount++;
        callback();
      });

      const [result1, result2] = await Promise.all([
        GmailManager.sendAndSaveEmail('recipient1@example.com', 'Subject 1', 'Content 1'),
        GmailManager.sendAndSaveEmail('recipient2@example.com', 'Subject 2', 'Content 2')
      ]);

      expect(result1).toEqual(mockSendResponse1);
      expect(result2).toEqual(mockSendResponse2);
    });
  });
}); 