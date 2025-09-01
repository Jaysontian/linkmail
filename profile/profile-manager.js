// Profile Manager Module
// Handles all user profile operations including creation, updating, loading, and validation

window.ProfileManager = (function() {
  'use strict';

  // Profile data schema
  const PROFILE_SCHEMA = {
    firstName: '',
    lastName: '',
    email: '',
    college: '',
    linkedinUrl: '',
    experiences: [],
    skills: [],
    templates: [],
    sentEmails: [],
    setupCompleted: false
  };

  // Profile operations
  const operations = {
    // Create a new user profile
    async createProfile(profileData) {
      if (!profileData || !profileData.email) {
        console.error('Email is required to create profile');
        return { success: false, error: 'Email is required' };
      }

      // Validate required fields
      const validation = operations.validateProfile(profileData);
      if (!validation.isValid) {
        return { success: false, error: validation.errors.join(', ') };
      }

      try {
        // Check if profile already exists
        const existingProfile = await operations.loadProfile(profileData.email);
        if (existingProfile) {
          return { success: false, error: 'Profile already exists' };
        }

        // Create profile with default values
        const newProfile = {
          ...PROFILE_SCHEMA,
          ...profileData,
          setupCompleted: true
        };

        // Save to storage
        const saved = await operations.saveProfile(newProfile);
        if (saved) {
          return { success: true, profile: newProfile };
        } else {
          return { success: false, error: 'Failed to save profile' };
        }
      } catch (error) {
        console.error('Error creating profile:', error);
        return { success: false, error: error.message };
      }
    },

    // Load a user profile from storage
    async loadProfile(email) {
      if (!email) {
        console.error('Email is required to load profile');
        return { success: false, error: 'Email is required', profile: null };
      }
      // Prefer backend if authenticated
      try {
        if (window.BackendAPI && window.BackendAPI.isAuthenticated) {
          const resp = await window.BackendAPI.getUserBio();
          if (resp && resp.success) {
            const p = resp.profile;
            if (p) {
              // Map backend shape to existing schema fields for UI compatibility
              const mapped = {
                firstName: p.first_name || '',
                lastName: p.last_name || '',
                email,
                college: '',
                linkedinUrl: p.linkedin_url || '',
                experiences: Array.isArray(p.experiences) ? p.experiences.map(e => ({
                  jobTitle: e.job_title || e.jobTitle || '',
                  company: e.company || '',
                  description: e.description || ''
                })) : [],
                skills: Array.isArray(p.skills) ? p.skills : [],
                templates: Array.isArray(p.templates) ? p.templates.map(t => ({
                  name: t.title || '',
                  content: t.body || ''
                })) : [],
                sentEmails: [],
                setupCompleted: true
              };
              return { success: true, profile: mapped };
            }
            return { success: true, profile: null };
          }
        }
      } catch (error) {
        console.error('Backend loadProfile failed, falling back to storage:', error);
      }

      // Backend-only: no local storage fallback
      return { success: true, profile: null };
    },

    // Save a user profile to storage
    async saveProfile(profileData) {
      if (!profileData || !profileData.email) {
        console.error('Profile data with email is required');
        return false;
      }
      // Prefer backend if authenticated
      try {
        if (window.BackendAPI && window.BackendAPI.isAuthenticated) {
          const payload = {
            firstName: profileData.firstName || null,
            lastName: profileData.lastName || null,
            linkedinUrl: profileData.linkedinUrl || null,
            experiences: Array.isArray(profileData.experiences) ? profileData.experiences.map(e => ({
              job_title: e.jobTitle || e.job_title || '',
              company: e.company || '',
              description: e.description || ''
            })) : [],
            skills: Array.isArray(profileData.skills) ? profileData.skills : [],
            templates: Array.isArray(profileData.templates) ? profileData.templates.map(t => ({
              title: t.name || t.title || '',
              body: t.content || t.body || ''
            })) : []
          };
          const resp = await window.BackendAPI.saveUserBio(payload);
          if (resp && resp.success) {
            return true;
          }
        }
      } catch (error) {
        console.error('Backend saveProfile failed, falling back to storage:', error);
      }

      // Backend-only: no local storage fallback
      return false;
    },

    // Update an existing profile
    async updateProfile(email, updates) {
      if (!email || !updates) {
        console.error('Email and updates are required');
        return { success: false, error: 'Missing required parameters' };
      }

      try {
        // Load existing profile (may be null on first save)
        const existingResult = await operations.loadProfile(email);
        const existingProfile = existingResult && existingResult.profile ? existingResult.profile : null;

        // Merge updates
        const updatedProfile = {
          ...(existingProfile || {}),
          ...updates,
          email: email // Ensure email doesn't change
        };

        // Validate updated profile
        const validation = operations.validateProfile(updatedProfile);
        if (!validation.isValid) {
          return { success: false, error: validation.errors.join(', ') };
        }

        // Save updated profile
        const saved = await operations.saveProfile(updatedProfile);
        if (saved) {
          return { success: true, profile: updatedProfile };
        } else {
          return { success: false, error: 'Failed to save updated profile' };
        }
      } catch (error) {
        console.error('Error updating profile:', error);
        return { success: false, error: error.message };
      }
    },

    // Delete a user profile
    async deleteProfile(email) {
      if (!email) {
        console.error('Email is required to delete profile');
        return { success: false, error: 'Email is required' };
      }

      return new Promise((resolve) => {
        try {
          chrome.storage.local.remove([email], function() {
            if (chrome.runtime.lastError) {
              console.error('Error deleting profile:', chrome.runtime.lastError);
              resolve({ success: false, error: 'Failed to delete profile' });
              return;
            }

            console.log('Profile deleted successfully for', email);
            resolve({ success: true });
          });
        } catch (error) {
          console.error('Error in deleteProfile:', error);
          resolve({ success: false, error: error.message });
        }
      });
    },

    // Check if a profile exists
    async profileExists(email) {
      if (!email) {
        return false;
      }

      const profile = await operations.loadProfile(email);
      return profile !== null;
    },

    // Validate profile data
    validateProfile(profileData) {
      const errors = [];

      if (!profileData.firstName || profileData.firstName.trim() === '') {
        errors.push('First name is required');
      }

      if (!profileData.lastName || profileData.lastName.trim() === '') {
        errors.push('Last name is required');
      }

      if (!profileData.email || profileData.email.trim() === '') {
        errors.push('Email is required');
      } else if (!operations.isValidEmail(profileData.email)) {
        errors.push('Valid email is required');
      }

      if (!profileData.college || profileData.college.trim() === '') {
        errors.push('College is required');
      }

      if (!profileData.linkedinUrl || profileData.linkedinUrl.trim() === '') {
        errors.push('LinkedIn profile URL is required');
      } else if (!operations.isValidLinkedInUrl(profileData.linkedinUrl)) {
        errors.push('Valid LinkedIn profile URL is required');
      }

      // Validate that at least one experience is provided
      if (!profileData.experiences || !Array.isArray(profileData.experiences) || profileData.experiences.length === 0) {
        errors.push('At least one experience is required');
      }

      // Validate experiences if provided
      if (profileData.experiences && Array.isArray(profileData.experiences)) {
        profileData.experiences.forEach((exp, index) => {
          if (!exp.jobTitle || exp.jobTitle.trim() === '') {
            errors.push(`Experience ${index + 1}: Job title is required`);
          }
          if (!exp.company || exp.company.trim() === '') {
            errors.push(`Experience ${index + 1}: Company is required`);
          }
        });
      }

      // Validate skills if provided
      if (profileData.skills && Array.isArray(profileData.skills)) {
        if (profileData.skills.length > 20) {
          errors.push('Maximum 20 skills allowed');
        }
      }

      return {
        isValid: errors.length === 0,
        errors: errors
      };
    },

    // Email validation helper
    isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },

    // Graduation year validation helper
    isValidGraduationYear(year) {
      const currentYear = new Date().getFullYear();
      const numYear = parseInt(year);
      return !isNaN(numYear) && numYear >= 1950 && numYear <= currentYear + 10;
    },

    // LinkedIn URL validation helper
    isValidLinkedInUrl(url) {
      if (!url || typeof url !== 'string') return false;
      const trimmedUrl = url.trim().toLowerCase();
      return trimmedUrl.includes('linkedin.com') && 
             (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('www.') || trimmedUrl.includes('/in/'));
    },

    // Get profile summary/stats
    getProfileSummary(profileData) {
      if (!profileData) {
        return null;
      }

      return {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        fullName: `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim(),
        email: profileData.email,
        college: profileData.college,
        linkedinUrl: profileData.linkedinUrl,
        experienceCount: profileData.experiences ? profileData.experiences.length : 0,
        skillsCount: profileData.skills ? profileData.skills.length : 0,
        templatesCount: profileData.templates ? profileData.templates.length : 0,
        sentEmailsCount: profileData.sentEmails ? profileData.sentEmails.length : 0,
        setupCompleted: profileData.setupCompleted || false
      };
    },

    // Add experience to profile
    async addExperience(email, experience) {
      if (!email || !experience) {
        return { success: false, error: 'Email and experience data are required' };
      }

      // Validate experience
      if (!experience.jobTitle || !experience.company) {
        return { success: false, error: 'Job title and company are required' };
      }

      try {
        const profile = await operations.loadProfile(email);
        if (!profile) {
          return { success: false, error: 'Profile not found' };
        }

        profile.experiences = profile.experiences || [];
        profile.experiences.push(experience);

        const saved = await operations.saveProfile(profile);
        if (saved) {
          return { success: true, profile };
        } else {
          return { success: false, error: 'Failed to save experience' };
        }
      } catch (error) {
        console.error('Error adding experience:', error);
        return { success: false, error: error.message };
      }
    },

    // Remove experience from profile
    async removeExperience(email, experienceIndex) {
      if (!email || experienceIndex === undefined) {
        return { success: false, error: 'Email and experience index are required' };
      }

      try {
        const profile = await operations.loadProfile(email);
        if (!profile) {
          return { success: false, error: 'Profile not found' };
        }

        if (!profile.experiences || experienceIndex < 0 || experienceIndex >= profile.experiences.length) {
          return { success: false, error: 'Invalid experience index' };
        }

        const removedExperience = profile.experiences.splice(experienceIndex, 1)[0];

        const saved = await operations.saveProfile(profile);
        if (saved) {
          return { success: true, profile, removedExperience };
        } else {
          return { success: false, error: 'Failed to save changes' };
        }
      } catch (error) {
        console.error('Error removing experience:', error);
        return { success: false, error: error.message };
      }
    },

    // Add skill to profile
    async addSkill(email, skill) {
      if (!email || !skill) {
        return { success: false, error: 'Email and skill are required' };
      }

      try {
        const profile = await operations.loadProfile(email);
        if (!profile) {
          return { success: false, error: 'Profile not found' };
        }

        profile.skills = profile.skills || [];
        
        // Check if skill already exists
        if (profile.skills.includes(skill)) {
          return { success: false, error: 'Skill already exists' };
        }

        // Check skill limit
        if (profile.skills.length >= 20) {
          return { success: false, error: 'Maximum 20 skills allowed' };
        }

        profile.skills.push(skill);

        const saved = await operations.saveProfile(profile);
        if (saved) {
          return { success: true, profile };
        } else {
          return { success: false, error: 'Failed to save skill' };
        }
      } catch (error) {
        console.error('Error adding skill:', error);
        return { success: false, error: error.message };
      }
    },

    // Remove skill from profile
    async removeSkill(email, skill) {
      if (!email || !skill) {
        return { success: false, error: 'Email and skill are required' };
      }

      try {
        const profile = await operations.loadProfile(email);
        if (!profile) {
          return { success: false, error: 'Profile not found' };
        }

        if (!profile.skills) {
          return { success: false, error: 'No skills found' };
        }

        const skillIndex = profile.skills.indexOf(skill);
        if (skillIndex === -1) {
          return { success: false, error: 'Skill not found' };
        }

        profile.skills.splice(skillIndex, 1);

        const saved = await operations.saveProfile(profile);
        if (saved) {
          return { success: true, profile };
        } else {
          return { success: false, error: 'Failed to save changes' };
        }
      } catch (error) {
        console.error('Error removing skill:', error);
        return { success: false, error: error.message };
      }
    }
  };

  // UI utilities for profile management
  const uiUtils = {
    // Generate initials from name
    generateInitials(name) {
      if (!name) return '';
      
      const nameParts = name.trim().split(' ');
      let initials = nameParts[0].charAt(0);

      if (nameParts.length > 1) {
        initials += nameParts[nameParts.length - 1].charAt(0);
      }

      return initials.toUpperCase();
    },

    // Format profile data for display
    formatProfileForDisplay(profileData) {
      if (!profileData) return null;

      const fullName = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim();

      return {
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        fullName: fullName || 'Unknown User',
        email: profileData.email || '',
        college: profileData.college || 'Not specified',
        linkedinUrl: profileData.linkedinUrl || '',
        initials: uiUtils.generateInitials(fullName),
        experiencesText: profileData.experiences ? 
          `${profileData.experiences.length} experience${profileData.experiences.length !== 1 ? 's' : ''}` : 
          'No experiences',
        skillsText: profileData.skills ? 
          `${profileData.skills.length} skill${profileData.skills.length !== 1 ? 's' : ''}` : 
          'No skills'
      };
    },

    // Update profile in sidebar/UI
    updateProfileInUI(profileData) {
      if (!profileData) return;

      const fullName = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim();
      const userNameElement = document.querySelector('.user-name');
      const userEmailElement = document.getElementById('user-email-display');
      const userAvatarElement = document.querySelector('.user-avatar');

      if (userNameElement) {
        userNameElement.textContent = fullName || 'Unknown User';
      }

      if (userEmailElement) {
        userEmailElement.textContent = profileData.email;
      }

      if (userAvatarElement) {
        userAvatarElement.textContent = uiUtils.generateInitials(fullName);
      }
    },

    // Escape HTML for safe display
    escapeHtml(unsafe) {
      if (!unsafe) return '';
      return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  };

  // Authentication helpers
  const authUtils = {
    // Check if user is authenticated with valid profile
    async isUserAuthenticated(email) {
      if (!email) return false;
      
      try {
        const profile = await operations.loadProfile(email);
        return profile !== null && profile.setupCompleted === true;
      } catch (error) {
        console.error('Error checking authentication:', error);
        return false;
      }
    },

    // Get authentication status and user data
    async getAuthStatus(email) {
      if (!email) {
        return { isAuthenticated: false, profile: null };
      }

      try {
        const profile = await operations.loadProfile(email);
        return {
          isAuthenticated: profile !== null && profile.setupCompleted === true,
          profile: profile
        };
      } catch (error) {
        console.error('Error getting auth status:', error);
        return { isAuthenticated: false, profile: null };
      }
    }
  };

  // Event system for profile changes
  const eventListeners = {
    'profile-created': [],
    'profile-updated': [],
    'profile-deleted': [],
    'profile-loaded': []
  };

  function triggerEvent(eventName, data) {
    if (eventListeners[eventName]) {
      eventListeners[eventName].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in profile event listener:', error);
        }
      });
    }
  }

  // Public API
  return {
    // Core operations
    createProfile: operations.createProfile,
    loadProfile: operations.loadProfile,
    getProfile: operations.loadProfile, // Alias for dashboard compatibility
    saveProfile: operations.saveProfile,
    updateProfile: operations.updateProfile,
    deleteProfile: operations.deleteProfile,
    profileExists: operations.profileExists,

    // Validation
    validateProfile: operations.validateProfile,
    isValidEmail: operations.isValidEmail,
    isValidGraduationYear: operations.isValidGraduationYear,
    isValidLinkedInUrl: operations.isValidLinkedInUrl,

    // Profile management
    getProfileSummary: operations.getProfileSummary,
    addExperience: operations.addExperience,
    removeExperience: operations.removeExperience,
    addSkill: operations.addSkill,
    removeSkill: operations.removeSkill,

    // UI utilities
    generateInitials: uiUtils.generateInitials,
    formatProfileForDisplay: uiUtils.formatProfileForDisplay,
    updateProfileInUI: uiUtils.updateProfileInUI,
    escapeHtml: uiUtils.escapeHtml,

    // Authentication
    isUserAuthenticated: authUtils.isUserAuthenticated,
    getAuthStatus: authUtils.getAuthStatus,

    // Event system
    addEventListener(eventName, callback) {
      if (eventListeners[eventName]) {
        eventListeners[eventName].push(callback);
      }
    },

    removeEventListener(eventName, callback) {
      if (eventListeners[eventName]) {
        const index = eventListeners[eventName].indexOf(callback);
        if (index > -1) {
          eventListeners[eventName].splice(index, 1);
        }
      }
    },

    // Enhanced operations with events
    async createProfileWithEvents(profileData) {
      const result = await operations.createProfile(profileData);
      if (result.success) {
        triggerEvent('profile-created', result);
      }
      return result;
    },

    async updateProfileWithEvents(email, updates) {
      const result = await operations.updateProfile(email, updates);
      if (result.success) {
        triggerEvent('profile-updated', result);
      }
      return result;
    },

    async deleteProfileWithEvents(email) {
      const result = await operations.deleteProfile(email);
      if (result.success) {
        triggerEvent('profile-deleted', { email });
      }
      return result;
    },

    async loadProfileWithEvents(email) {
      const profile = await operations.loadProfile(email);
      if (profile) {
        triggerEvent('profile-loaded', { profile, email });
      }
      return profile;
    },

    // Schema and constants
    PROFILE_SCHEMA: { ...PROFILE_SCHEMA }
  };
})();

// Legacy compatibility functions
if (typeof window !== 'undefined') {
  // Export commonly used functions globally for backward compatibility
  window.updateUserProfileInSidebar = window.ProfileManager.updateProfileInUI;
} 