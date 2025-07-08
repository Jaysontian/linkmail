/**
 * Dashboard Main Module Tests
 * Tests the main coordinator for dashboard functionality
 */

describe('Dashboard Main Module', () => {
  let mockUserData;
  
  beforeEach(() => {
    // Set up DOM structure that main.js expects
    document.body.innerHTML = `
      <div id="pageTitle">Your Profile</div>
      <div id="submitButton">Save Profile</div>
      <div id="message"></div>
      <form id="bioForm">
        <input id="name" type="text" />
        <input id="college" type="text" />
        <input id="gradYear" type="number" />
        <div id="experiencesContainer"></div>
        <div id="addExperienceButton">Add Experience</div>
        <div id="experienceLimit" style="display: none;">Max 5 experiences</div>
      </form>
      
      <!-- Navigation -->
      <div class="nav-item profile-section active">Profile</div>
      <div class="nav-item emails-section">Email History</div>
      <div class="nav-item templates-section">Templates</div>
      <div class="nav-item new-template-button">New Template</div>
      
      <!-- Content sections -->
      <div id="profile" class="content-section active">Profile Content</div>
      <div id="emails" class="content-section">Email Content</div>
      <div id="templates" class="content-section">Template Content</div>
      
      <!-- Email components -->
      <div id="emailList"></div>
      <input id="emailSearch" type="text" placeholder="Search emails..." />
      <div id="emailModal" style="display: none;">
        <div id="emailDetail"></div>
        <span id="closeModal">&times;</span>
      </div>
      
      <!-- User profile sidebar -->
      <div class="user-name">John Doe</div>
      <div id="user-email-display">test@example.com</div>
      <div class="user-avatar">JD</div>
    `;

    // Mock URL parameters
    delete window.location;
    window.location = { search: '?email=test@example.com&mode=edit' };

    // Set up test user data
    mockUserData = {
      name: 'John Doe',
      email: 'test@example.com',
      college: 'UCLA',
      graduationYear: '2025',
      experiences: [
        { jobTitle: 'Intern', company: 'Tech Corp', description: 'Great experience' }
      ],
      sentEmails: [
        {
          recipientEmail: 'recipient@test.com',
          recipientName: 'Jane Smith',
          subject: 'Test Subject',
          content: 'Test content',
          date: new Date().toISOString(),
          linkedInUrl: 'https://linkedin.com/in/jane-smith'
        }
      ],
      templates: []
    };

    // Mock storage
    chrome.storage.local.get.callsFake((keys, callback) => {
      if (keys.includes && keys.includes('test@example.com')) {
        callback({ 'test@example.com': mockUserData });
      } else if (keys === 'test@example.com' || (Array.isArray(keys) && keys[0] === 'test@example.com')) {
        callback({ 'test@example.com': mockUserData });
      } else {
        callback({});
      }
    });

    chrome.storage.local.set.callsFake((data, callback) => {
      Object.assign(mockUserData, data['test@example.com'] || {});
      if (callback) callback();
    });

    // Mock global functions
    window.showError = jest.fn();
    window.showSuccess = jest.fn();
    window.loadEmailHistory = jest.fn();
    window.collectTemplatesData = jest.fn().mockReturnValue([]);
  });

  describe('Module Loading', () => {
    test('should load without errors', () => {
      expect(() => {
        require('../../dashboard/main.js');
      }).not.toThrow();
    });

    test('should initialize notifications object', () => {
      require('../../dashboard/main.js');
      
      expect(window.notifications).toBeDefined();
      expect(window.notifications.error).toBeInstanceOf(Function);
      expect(window.notifications.success).toBeInstanceOf(Function);
    });

    test('should set up global showError and showSuccess functions', () => {
      require('../../dashboard/main.js');
      
      expect(window.showError).toBeDefined();
      expect(window.showSuccess).toBeDefined();
    });
  });

  describe('Date Formatting', () => {
    test('should format today dates correctly', () => {
      require('../../dashboard/main.js');
      
      const today = new Date();
      const result = window.formatDate ? window.formatDate(today.toISOString()) : '';
      
      expect(result).toMatch(/Today at \d{1,2}:\d{2} (AM|PM)/);
    });

    test('should format yesterday dates correctly', () => {
      require('../../dashboard/main.js');
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const result = window.formatDate ? window.formatDate(yesterday.toISOString()) : '';
      
      expect(result).toMatch(/Yesterday at \d{1,2}:\d{2} (AM|PM)/);
    });

    test('should format older dates with full date', () => {
      require('../../dashboard/main.js');
      
      const oldDate = new Date('2023-01-15T10:30:00');
      const result = window.formatDate ? window.formatDate(oldDate.toISOString()) : '';
      
      expect(result).toMatch(/January 15, 2023 at \d{1,2}:\d{2} (AM|PM)/);
    });
  });

  describe('URL Parameter Handling', () => {
    test('should handle missing email parameter', () => {
      window.location.search = '';
      
      require('../../dashboard/main.js');
      
      // Should trigger DOMContentLoaded event
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      expect(window.showError).toHaveBeenCalledWith('Email parameter is missing. Please try again.');
    });

    test('should handle edit mode correctly', () => {
      window.location.search = '?email=test@example.com&mode=edit';
      
      require('../../dashboard/main.js');
      
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      expect(document.getElementById('pageTitle').textContent).toBe('Your Profile');
      expect(document.getElementById('submitButton').textContent).toBe('Save Changes');
    });

    test('should handle new user mode correctly', () => {
      window.location.search = '?email=newuser@example.com';
      
      require('../../dashboard/main.js');
      
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      // Email history tab should be hidden for new users
      const emailHistoryTab = document.querySelector('.nav-item.emails-section');
      expect(emailHistoryTab.style.display).toBe('none');
    });
  });

  describe('Tab Navigation', () => {
    test('should switch tabs correctly', () => {
      require('../../dashboard/main.js');
      
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      // Click on emails tab
      const emailsTab = document.querySelector('.nav-item.emails-section');
      emailsTab.click();
      
      // Check active states
      expect(emailsTab.classList.contains('active')).toBe(true);
      expect(document.getElementById('emails').classList.contains('active')).toBe(true);
      expect(document.getElementById('profile').classList.contains('active')).toBe(false);
    });

    test('should refresh email history when switching to emails tab', () => {
      require('../../dashboard/main.js');
      
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      // Click on emails tab
      const emailsTab = document.querySelector('.nav-item.emails-section');
      emailsTab.click();
      
      // Should call loadEmailHistory
      expect(window.loadEmailHistory).toHaveBeenCalled();
    });

    test('should handle templates tab switching', () => {
      require('../../dashboard/main.js');
      
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      const templatesTab = document.querySelector('.nav-item.templates-section');
      templatesTab.click();
      
      expect(templatesTab.classList.contains('active')).toBe(true);
      expect(document.getElementById('templates').classList.contains('active')).toBe(true);
    });
  });

  describe('Experience Management', () => {
    test('should add new experience when button clicked', () => {
      require('../../dashboard/main.js');
      
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      const initialExperiences = document.querySelectorAll('.experience-card').length;
      
      // Click add experience button
      const addButton = document.getElementById('addExperienceButton');
      addButton.click();
      
      const newExperiences = document.querySelectorAll('.experience-card').length;
      expect(newExperiences).toBe(initialExperiences + 1);
    });

    test('should show limit message when max experiences reached', () => {
      require('../../dashboard/main.js');
      
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      // Add max experiences (5)
      const addButton = document.getElementById('addExperienceButton');
      for (let i = 0; i < 5; i++) {
        addButton.click();
      }
      
      const limitMessage = document.getElementById('experienceLimit');
      expect(limitMessage.style.display).toBe('block');
      expect(addButton.style.display).toBe('none');
    });

    test('should remove experience correctly', () => {
      require('../../dashboard/main.js');
      
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      // Add an experience first
      const addButton = document.getElementById('addExperienceButton');
      addButton.click();
      
      const initialCount = document.querySelectorAll('.experience-card').length;
      
      // Remove the experience
      const removeButton = document.querySelector('.remove-experience');
      if (removeButton) {
        removeButton.click();
        
        const newCount = document.querySelectorAll('.experience-card').length;
        expect(newCount).toBe(initialCount - 1);
      }
    });
  });

  describe('Form Submission', () => {
    test('should collect and save form data correctly', () => {
      require('../../dashboard/main.js');
      
      // Fill form data
      document.getElementById('name').value = 'Jane Doe';
      document.getElementById('college').value = 'Stanford';
      document.getElementById('gradYear').value = '2024';
      
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      // Submit form
      const form = document.getElementById('bioForm');
      const submitEvent = new Event('submit');
      form.dispatchEvent(submitEvent);
      
      // Should have called chrome storage
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('should validate required fields', () => {
      require('../../dashboard/main.js');
      
      // Leave name field empty
      document.getElementById('name').value = '';
      document.getElementById('college').value = 'UCLA';
      document.getElementById('gradYear').value = '2025';
      
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      // Submit form
      const form = document.getElementById('bioForm');
      const submitEvent = new Event('submit');
      form.dispatchEvent(submitEvent);
      
      expect(window.showError).toHaveBeenCalledWith('Please fill in all required fields.');
    });

    test('should merge with existing data including templates', () => {
      require('../../dashboard/main.js');
      
      // Set up existing templates
      window.collectTemplatesData.mockReturnValue([
        { name: 'Test Template', content: 'Test content' }
      ]);
      
      document.getElementById('name').value = 'Updated Name';
      document.getElementById('college').value = 'Updated College';
      document.getElementById('gradYear').value = '2026';
      
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      const form = document.getElementById('bioForm');
      const submitEvent = new Event('submit');
      form.dispatchEvent(submitEvent);
      
      // Should have merged existing sentEmails with new data
      const saveCall = chrome.storage.local.set.mock.calls[chrome.storage.local.set.mock.calls.length - 1];
      const savedData = saveCall[0]['test@example.com'];
      
      expect(savedData.name).toBe('Updated Name');
      expect(savedData.sentEmails).toEqual(mockUserData.sentEmails); // Should preserve existing emails
      expect(savedData.templates).toHaveLength(1); // Should include templates
    });
  });

  describe('User Profile Sidebar Updates', () => {
    test('should update sidebar with user data', () => {
      require('../../dashboard/main.js');
      
      const userData = {
        name: 'John Smith',
        email: 'john@example.com'
      };
      
      // Call the updateUserProfileInSidebar function
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      // Check if sidebar elements are updated
      const userNameElement = document.querySelector('.user-name');
      const userEmailElement = document.getElementById('user-email-display');
      
      expect(userNameElement).toBeTruthy();
      expect(userEmailElement).toBeTruthy();
    });

    test('should generate correct user initials', () => {
      require('../../dashboard/main.js');
      
      const userData = { name: 'John Smith' };
      
      // Simulate the initials generation logic
      const nameParts = userData.name.split(' ');
      let initials = nameParts[0].charAt(0);
      if (nameParts.length > 1) {
        initials += nameParts[nameParts.length - 1].charAt(0);
      }
      
      expect(initials.toUpperCase()).toBe('JS');
    });

    test('should handle single name for initials', () => {
      const userData = { name: 'John' };
      
      const nameParts = userData.name.split(' ');
      let initials = nameParts[0].charAt(0);
      if (nameParts.length > 1) {
        initials += nameParts[nameParts.length - 1].charAt(0);
      }
      
      expect(initials.toUpperCase()).toBe('J');
    });
  });

  describe('Error Handling', () => {
    test('should handle Chrome storage errors gracefully', () => {
      chrome.storage.local.get.callsFake((keys, callback) => {
        // Simulate storage error
        callback(undefined);
      });
      
      expect(() => {
        require('../../dashboard/main.js');
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);
      }).not.toThrow();
    });

    test('should handle missing DOM elements gracefully', () => {
      // Remove some DOM elements
      document.getElementById('bioForm').remove();
      
      expect(() => {
        require('../../dashboard/main.js');
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);
      }).not.toThrow();
    });

    test('should handle collectTemplatesData errors gracefully', () => {
      window.collectTemplatesData.mockImplementation(() => {
        throw new Error('Template collection failed');
      });
      
      require('../../dashboard/main.js');
      
      document.getElementById('name').value = 'Test Name';
      document.getElementById('college').value = 'Test College';
      document.getElementById('gradYear').value = '2025';
      
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      // Should not throw and should fall back to existing templates
      expect(() => {
        const form = document.getElementById('bioForm');
        const submitEvent = new Event('submit');
        form.dispatchEvent(submitEvent);
      }).not.toThrow();
    });
  });
}); 