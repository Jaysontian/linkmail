// Template Manager Module
// Handles all template CRUD operations and storage management

window.TemplateManager = (function() {
  'use strict';

  // Constants
  const MAX_TEMPLATES = 10;

  // Template state
  let templates = [];
  let currentTemplateAttachments = [];

  // Default templates
  const DEFAULT_TEMPLATES = [
    {
      icon: '☕',
      name: 'Coffee Chat Request',
      description: 'Send a friendly request to chat with this person.',
      purpose: 'to schedule a coffee chat to the recipient',
      subjectLine: 'Coffee Chat Request',
      content: 'Hi [Recipient First Name],\n\n[Mention something specific about recipient company or recent work that interests me].\n\nI\'d love to connect and learn more about your experience in [mention recipient field/industry]. Would you be open to a brief coffee chat?\n\nBest regards,\n[My Name]'
    },
    {
      icon: '💼',
      name: 'Inquire About Open Roles',
      description: 'Craft a professional email to a recruiter or manager',
      purpose: 'to inquire if there is internship or job',
      subjectLine: 'Wondering About Potential Opportunities at [Recipient Company Name]',
      content: 'Hi [Recipient First Name],\n\nI\'m [brief personal introduction including my background]. I\'m really impressed by [mention something specific about recipient company\'s work or mission].\n\n[Connect recipient company\'s work to my own experience or interests]. I\'d love to learn about potential opportunities at [Recipient Company Name].\n\nBest regards,\n[My Name]'
    }
  ];

  // Template operations
  const operations = {
    // Load templates for a specific user
    async loadTemplates(email) {
      if (!email) {
        console.error('Email is required to load templates');
        return { success: false, error: 'Email is required', templates: [] };
      }

      // Backend-only: fetch via BackendAPI if available
      try {
        if (window.BackendAPI && window.BackendAPI.isAuthenticated) {
          const resp = await window.BackendAPI.getUserBio();
          const p = resp && resp.profile ? resp.profile : null;
          const fromDb = Array.isArray(p?.templates) ? p.templates.map(t => {
            const template = {
              name: t.title || '', 
              content: t.body || '',
              // IMPORTANT: Use t.subject first (the actual subject line from database)
              // Fall back to t.title only if subject is not set
              subjectLine: t.subject || t.title || 'Template Subject',
              icon: t.icon || '📝',
              attachments: t.file ? [{ url: t.file }] : []
            };
            
            // Debug logging to help diagnose template loading issues
            if (!t.subject && t.title) {
              console.warn(`[TemplateManager] Template "${t.title}" missing subject field, using title as fallback`);
            }
            
            return template;
          }) : [];
          templates = JSON.parse(JSON.stringify(fromDb));
          
          // Sync loaded templates to local storage for LinkedIn injection
          await this.syncToLocalStorage(email, templates);
          
          return { success: true, templates };
        }
      } catch (e) {
        console.error('Backend loadTemplates failed:', e);
      }
      templates = [];
      return { success: true, templates: [] };
    },

    // Save templates for a specific user
    async saveTemplates(email, templatesToSave = null) {
      if (!email) {
        console.error('Email is required to save templates');
        return false;
      }

      // Use provided templates or current templates array
      const templatesData = templatesToSave || templates;

      try {
        if (window.BackendAPI && window.BackendAPI.isAuthenticated) {
          const simplified = templatesData.map(t => ({ 
            title: t.name, 
            body: t.content,
            subject: t.subjectLine || t.name || 'Subject Line',
            icon: t.icon || '📝',
            file: t.attachments && t.attachments.length > 0 ? t.attachments[0].url : null,
            strict_template: t.strict_template || false
          }));
          await window.BackendAPI.saveTemplates(simplified);
          
          // Also save to Chrome local storage for LinkedIn injection synchronization
          await this.syncToLocalStorage(email, templatesData);
          
          return true;
        }
      } catch (e) {
        console.error('Backend saveTemplates failed:', e);
        return false;
      }
      return false;
    },

    // Create a new template
    async createTemplate(email, templateData) {
      if (!email || !templateData) {
        console.error('Email and template data are required');
        return { success: false, error: 'Missing required parameters' };
      }

      // Validate template data
      if (!templateData.name || !templateData.content) {
        return { success: false, error: 'Template name and content are required' };
      }

      // Check max templates limit
      if (templates.length >= MAX_TEMPLATES) {
        return { success: false, error: `You can only add up to ${MAX_TEMPLATES} templates` };
      }

      // Check for duplicate name
      if (templates.some(t => t.name === templateData.name)) {
        return { success: false, error: 'A template with this name already exists' };
      }

      // Create new template with default values
      const newTemplate = {
        name: templateData.name,
        content: templateData.content,
        subjectLine: templateData.subjectLine || `${templateData.name} with [Recipient Name]`,
        attachments: templateData.attachments || [],
        icon: templateData.icon || '📝',
        description: templateData.description || '',
        purpose: templateData.purpose || `to send a ${templateData.name} email`
      };

      templates.push(newTemplate);
      const saved = await operations.saveTemplates(email);

      if (saved) {
        return { success: true, template: newTemplate, index: templates.length - 1 };
      } else {
        // Rollback on save failure
        templates.pop();
        return { success: false, error: 'Failed to save template' };
      }
    },

    // Update an existing template
    async updateTemplate(email, index, templateData) {
      if (!email || index === undefined || !templateData) {
        console.error('Email, index, and template data are required');
        return { success: false, error: 'Missing required parameters' };
      }

      if (index < 0 || index >= templates.length) {
        return { success: false, error: 'Invalid template index' };
      }

      // Validate template data
      if (!templateData.name || !templateData.content) {
        return { success: false, error: 'Template name and content are required' };
      }

      // Check for duplicate name (excluding current template)
      const duplicateIndex = templates.findIndex((t, i) => i !== index && t.name === templateData.name);
      if (duplicateIndex !== -1) {
        return { success: false, error: 'A template with this name already exists' };
      }

      // Store original template for rollback
      const originalTemplate = { ...templates[index] };

      // Update template
      templates[index] = {
        name: templateData.name,
        content: templateData.content,
        subjectLine: templateData.subjectLine || `${templateData.name} with [Recipient Name]`,
        attachments: templateData.attachments || [],
        icon: templateData.icon || '📝',
        description: templateData.description || '',
        purpose: templateData.purpose || `to send a ${templateData.name} email`
      };

      const saved = await operations.saveTemplates(email);

      if (saved) {
        return { success: true, template: templates[index] };
      } else {
        // Rollback on save failure
        templates[index] = originalTemplate;
        return { success: false, error: 'Failed to save template' };
      }
    },

    // Delete a template
    async deleteTemplate(email, index) {
      if (!email || index === undefined) {
        console.error('Email and index are required');
        return { success: false, error: 'Missing required parameters' };
      }

      if (index < 0 || index >= templates.length) {
        return { success: false, error: 'Invalid template index' };
      }

      // Store removed template for rollback
      const removedTemplate = templates.splice(index, 1)[0];
      const saved = await operations.saveTemplates(email);

      if (saved) {
        return { success: true, template: removedTemplate };
      } else {
        // Rollback on save failure
        templates.splice(index, 0, removedTemplate);
        return { success: false, error: 'Failed to delete template' };
      }
    },

    // Get all templates for a user
    getTemplates() {
      return [...templates]; // Return a copy to prevent external modification
    },

    // Get template by index
    getTemplate(index) {
      if (index < 0 || index >= templates.length) {
        return null;
      }
      return { ...templates[index] }; // Return a copy
    },

    // Get template by name
    getTemplateByName(name) {
      const template = templates.find(t => t.name === name);
      return template ? { ...template } : null;
    },

    // Get all templates including defaults for UI display
    getAllTemplatesForUI() {
      const defaultTemplatesWithIds = DEFAULT_TEMPLATES.map((template, index) => ({
        ...template,
        id: `default-${index}`,
        isDefault: true
      }));

      const customTemplatesWithIds = templates.map((template, index) => ({
        ...template,
        id: `custom-${index}`,
        isDefault: false
      }));

      return [...defaultTemplatesWithIds, ...customTemplatesWithIds];
    },

    // Get default templates
    getDefaultTemplates() {
      return [...DEFAULT_TEMPLATES];
    },

    // Attachment management
    setCurrentAttachments(attachments) {
      currentTemplateAttachments = attachments || [];
    },

    getCurrentAttachments() {
      return [...currentTemplateAttachments];
    },

    clearCurrentAttachments() {
      currentTemplateAttachments = [];
    },

    // File processing for attachments
    async processAttachmentFile(file) {
      return new Promise((resolve, reject) => {
        // Validate file type
        if (file.type !== 'application/pdf') {
          reject(new Error('Only PDF files are allowed'));
          return;
        }

        // Check file size (limit to 5MB)
        if (file.size > 5 * 1024 * 1024) {
          reject(new Error('File size exceeds 5MB limit'));
          return;
        }

        const reader = new FileReader();
        
        reader.onload = () => {
          try {
            // Get the base64 string (remove the data URL prefix)
            const base64 = reader.result.split(',')[1];
            const attachment = {
              name: file.name,
              type: file.type,
              size: file.size,
              data: base64
            };
            resolve(attachment);
          } catch (error) {
            reject(new Error('Error processing file: ' + error.message));
          }
        };

        reader.onerror = () => {
          reject(new Error('Error reading file'));
        };

        reader.readAsDataURL(file);
      });
    },

    // Template validation
    validateTemplate(templateData) {
      const errors = [];

      if (!templateData.name || templateData.name.trim() === '') {
        errors.push('Template name is required');
      }

      if (!templateData.content || templateData.content.trim() === '') {
        errors.push('Template content is required');
      }

      if (templateData.name && templateData.name.length > 100) {
        errors.push('Template name must be less than 100 characters');
      }

      if (templateData.content && templateData.content.length > 10000) {
        errors.push('Template content must be less than 10,000 characters');
      }

      return {
        isValid: errors.length === 0,
        errors: errors
      };
    },

    // Sync templates to Chrome local storage for LinkedIn injection
    async syncToLocalStorage(email, templatesData) {
      return new Promise((resolve) => {
        try {
          if (!chrome.runtime?.id) {
            console.warn('Chrome extension context not available');
            resolve(false);
            return;
          }

          // Get existing user data from storage
          chrome.storage.local.get([email], (result) => {
            if (chrome.runtime.lastError) {
              console.error('Error getting user data from storage:', chrome.runtime.lastError);
              resolve(false);
              return;
            }

            // Merge templates with existing user data
            const userData = result[email] || {};
            userData.templates = templatesData;

            // Save back to storage
            const dataToSave = {};
            dataToSave[email] = userData;

            chrome.storage.local.set(dataToSave, () => {
              if (chrome.runtime.lastError) {
                console.error('Error saving templates to storage:', chrome.runtime.lastError);
                resolve(false);
                return;
              }
              console.log('Templates synced to local storage successfully');
              resolve(true);
            });
          });
        } catch (error) {
          console.error('Error syncing templates to local storage:', error);
          resolve(false);
        }
      });
    }
  };

  // Event system for template changes
  const eventListeners = {
    'template-created': [],
    'template-updated': [],
    'template-deleted': [],
    'templates-loaded': []
  };

  function triggerEvent(eventName, data) {
    if (eventListeners[eventName]) {
      eventListeners[eventName].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in template event listener:', error);
        }
      });
    }
  }

  // Public API
  return {
    // Core operations
    loadTemplates: operations.loadTemplates,
    saveTemplates: operations.saveTemplates,
    createTemplate: operations.createTemplate,
    updateTemplate: operations.updateTemplate,
    deleteTemplate: operations.deleteTemplate,

    // Template access
    getTemplates: operations.getTemplates,
    getTemplate: operations.getTemplate,
    getTemplateByName: operations.getTemplateByName,
    getAllTemplatesForUI: operations.getAllTemplatesForUI,
    getDefaultTemplates: operations.getDefaultTemplates,

    // Attachment management
    setCurrentAttachments: operations.setCurrentAttachments,
    getCurrentAttachments: operations.getCurrentAttachments,
    clearCurrentAttachments: operations.clearCurrentAttachments,
    processAttachmentFile: operations.processAttachmentFile,

    // Validation
    validateTemplate: operations.validateTemplate,

    // Storage sync
    syncToLocalStorage: operations.syncToLocalStorage,

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

    // Constants
    MAX_TEMPLATES,

    // Enhanced operations with events
    async createTemplateWithEvents(email, templateData) {
      const result = await operations.createTemplate(email, templateData);
      if (result.success) {
        triggerEvent('template-created', result);
      }
      return result;
    },

    async updateTemplateWithEvents(email, index, templateData) {
      const result = await operations.updateTemplate(email, index, templateData);
      if (result.success) {
        triggerEvent('template-updated', { ...result, index });
      }
      return result;
    },

    async deleteTemplateWithEvents(email, index) {
      const result = await operations.deleteTemplate(email, index);
      if (result.success) {
        triggerEvent('template-deleted', { ...result, index });
      }
      return result;
    },

    async loadTemplatesWithEvents(email) {
      const templates = await operations.loadTemplates(email);
      triggerEvent('templates-loaded', { templates, email });
      return templates;
    }
  };
})();

// Legacy compatibility for existing code
if (typeof window !== 'undefined') {
  // Expose the current attachments globally for backward compatibility
  window.currentTemplateAttachments = [];

  // Update the global variable when attachments change
  window.TemplateManager.addEventListener('template-created', () => {
    window.currentTemplateAttachments = window.TemplateManager.getCurrentAttachments();
  });

  window.TemplateManager.addEventListener('template-updated', () => {
    window.currentTemplateAttachments = window.TemplateManager.getCurrentAttachments();
  });
} 