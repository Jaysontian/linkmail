console.log('Templates module loaded');

// Templates management functionality
let templates = [];
const MAX_TEMPLATES = 10;

// Function to update attachments list UI
function updateAttachmentsList() {
  const attachmentsList = document.getElementById('attachmentsList');
  if (!attachmentsList) return;

  // Clear current list
  attachmentsList.innerHTML = '';

  if (!window.currentTemplateAttachments || window.currentTemplateAttachments.length === 0) {
    // Show no attachments message
    attachmentsList.innerHTML = '<p id="noAttachmentsMessage" class="placeholder-text">No attachments added</p>';
    return;
  }

  // Add each attachment to the list
  window.currentTemplateAttachments.forEach((attachment, index) => {
    const attachmentItem = document.createElement('div');
    attachmentItem.className = 'attachment-item';

    // Format file size
    const sizeInKB = Math.round(attachment.size / 1024);
    const sizeFormatted = sizeInKB >= 1024
      ? (sizeInKB / 1024).toFixed(2) + ' MB'
      : sizeInKB + ' KB';

    attachmentItem.innerHTML = `
      <div class="attachment-info">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="attachment-icon"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M9 18v-6"/><path d="M12 18v-3"/><path d="M15 18v-6"/></svg>
        <div>
          <p class="attachment-name">${escapeHtml(attachment.name)}</p>
          <p class="attachment-size">${sizeFormatted}</p>
        </div>
      </div>
      <button class="attachment-remove" data-index="${index}">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
      </button>
    `;

    // Add click handler for remove button
    const removeButton = attachmentItem.querySelector('.attachment-remove');
    if (removeButton) {
      removeButton.addEventListener('click', function() {
        const index = parseInt(this.getAttribute('data-index'));
        window.currentTemplateAttachments.splice(index, 1);
        updateAttachmentsList();
      });
    }

    attachmentsList.appendChild(attachmentItem);
  });
}

function initializeTemplatesManagement() {
  console.log('Initializing template management');

  // Initialize current template attachments array
  window.currentTemplateAttachments = [];

  // Add file attachment handling
  const attachmentFileInput = document.getElementById('attachmentFile');
  const fileUploadButton = document.getElementById('fileUploadButton');
  const attachmentsList = document.getElementById('attachmentsList');

  // Add click handler for the upload button
  if (fileUploadButton && attachmentFileInput) {
    fileUploadButton.addEventListener('click', function() {
      attachmentFileInput.click();
    });
  }

  // Add delete button handler
  const deleteTemplateButton = document.getElementById('deleteTemplateButton');
  if (deleteTemplateButton) {
    deleteTemplateButton.addEventListener('click', function() {
      const templateForm = document.getElementById('templateForm');
      const editIndex = templateForm.dataset.editIndex;

      if (editIndex === undefined) {
        console.error('No template index found for deletion');
        return;
      }

      if (confirm('Are you sure you want to delete this template?')) {
        console.log('Deleting template at index:', editIndex);

        // Remove the template from the array
        templates.splice(parseInt(editIndex), 1);

        // Save the updated templates
        saveTemplates();

        // Update the sidebar
        updateSidebarTemplates();

        // Reset the form
        resetTemplateForm();

        // Show success message
        window.showSuccess('Template deleted successfully!');

        // Remove active class from all template items
        document.querySelectorAll('.sidebar-template-item').forEach(item => {
          item.classList.remove('active');
        });
      }
    });
  }

  // Function to read file as base64
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        // Get the base64 string (remove the data URL prefix)
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };

      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };

      reader.readAsDataURL(file);
    });
  }

  if (attachmentFileInput && attachmentsList) {
    attachmentFileInput.addEventListener('change', async function(e) {
      if (!this.files || !this.files.length) return;

      const file = this.files[0];

      // Check if it's a PDF
      if (file.type !== 'application/pdf') {
        window.showError('Only PDF files are allowed');
        this.value = ''; // Clear the input
        return;
      }

      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        window.showError('File size exceeds 5MB limit');
        this.value = ''; // Clear the input
        return;
      }

      try {
        // Convert the file to base64
        const base64Data = await readFileAsBase64(file);

        // Add to current attachments
        window.currentTemplateAttachments.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64Data
        });

        // Update the attachments list UI
        updateAttachmentsList();

        // Clear the input for next selection
        this.value = '';
      } catch (error) {
        console.error('Error reading file:', error);
        window.showError('Error reading file: ' + error.message);
      }
    });
  }

  // Load existing templates using TemplateManager
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get('email');

  if (email) {
    // Delegate to TemplateManager if available
    if (window.TemplateManager) {
      window.TemplateManager.loadTemplates(email).then(result => {
        if (result.success) {
          templates = JSON.parse(JSON.stringify(result.templates)); // Deep clone to avoid reference issues
          console.log('Loaded', templates.length, 'templates via TemplateManager');
          updateSidebarTemplates(); // Update sidebar immediately after loading
        } else {
          console.log('No existing templates found via TemplateManager');
          templates = result.templates || []; // Use the templates from result
          updateSidebarTemplates(); // Update sidebar with empty state
        }
      }).catch(error => {
        console.error('Error loading templates via TemplateManager:', error);
        templates = [];
        updateSidebarTemplates();
      });
    } else {
      // Fallback to direct Chrome storage
      chrome.storage.local.get([email], function(result) {
        const userData = result[email];
        if (userData && userData.templates && Array.isArray(userData.templates)) {
          templates = JSON.parse(JSON.stringify(userData.templates)); // Deep clone to avoid reference issues
          console.log('Loaded', templates.length, 'templates');
          updateSidebarTemplates(); // Update sidebar immediately after loading
        } else {
          console.log('No existing templates found');
          templates = []; // Initialize empty array if no templates exist
          updateSidebarTemplates(); // Update sidebar with empty state
        }
      });
    }
  }

  // Add click handler for "New Template" button
  const newTemplateButton = document.querySelector('.new-template-button');
  if (newTemplateButton) {
    newTemplateButton.addEventListener('click', function() {
      // Check max templates
      if (templates.length >= MAX_TEMPLATES) {
        window.showError(`You can only add up to ${MAX_TEMPLATES} templates`);
        return;
      }

      // Show templates section
      document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
      });
      const templatesSection = document.getElementById('templates');
      if (templatesSection) {
        templatesSection.classList.add('active');
      }

      // Reset form
      resetTemplateForm();

      // Remove active class from all template items
      document.querySelectorAll('.sidebar-template-item').forEach(item => {
        item.classList.remove('active');
      });
    });
  }

  // Add form submit handler
  const templateForm = document.getElementById('templateForm');
  const saveTemplateButton = document.getElementById('saveTemplateButton');

  // Add click handler for save button
  if (saveTemplateButton) {
    saveTemplateButton.addEventListener('click', function(e) {
      e.preventDefault();
      if (templateForm) {
        templateForm.dispatchEvent(new Event('submit'));
      }
    });
  }

  if (templateForm) {
    templateForm.addEventListener('submit', function(e) {
      e.preventDefault();

      const name = document.getElementById('templateName').value.trim();
      const subjectLine = document.getElementById('templateSubjectLine').value.trim();
      const content = document.getElementById('templateContent').value.trim();
      const icon = document.getElementById('templateIcon').textContent;

      if (!name || !content) {
        window.showError('Please fill in all required fields');
        return;
      }

      const editIndex = this.dataset.editIndex;

      if (editIndex !== undefined) {
        // Update existing template
        const index = parseInt(editIndex);

        // Check for duplicate name (excluding current template)
        const duplicateIndex = templates.findIndex((t, i) => i !== index && t.name === name);
        if (duplicateIndex !== -1) {
          window.showError('A template with this name already exists');
          return;
        }

        // Update the template in place
        templates[index] = {
          name,
          content,
          subjectLine: subjectLine || `${name} with [Recipient Name]`,
          attachments: window.currentTemplateAttachments || [],
          icon: icon
        };

        // Save templates
        saveTemplates();

        // Update the sidebar
        updateSidebarTemplates();

        // Don't reset form, keep the current template loaded
        // Just update the sidebar to reflect changes

        // Show success message
        window.showSuccess('Changes Have Been Saved');

        // Ensure the current template stays active in sidebar
        setTimeout(() => {
          const templateItems = document.querySelectorAll('.sidebar-template-item');
          if (templateItems[index]) {
            templateItems[index].classList.add('active');
          }
        }, 100);

      } else {
        // Check for duplicate name for new template
        if (templates.some(t => t.name === name)) {
          window.showError('A template with this name already exists');
          return;
        }

        // Add new template
        const newTemplate = {
          name,
          content,
          subjectLine: subjectLine || `${name} with [Recipient Name]`,
          attachments: window.currentTemplateAttachments || [],
          icon: icon
        };

        templates.push(newTemplate);
        const newIndex = templates.length - 1;

        // Save templates
        saveTemplates();

        // Update the sidebar
        updateSidebarTemplates();

        // Show success message
        window.showSuccess('Template Created');

        // Load the newly created template for editing (keep user on this template)
        setTimeout(() => {
          // Remove active class from all nav items, including the "New Template" button
          document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
          });

          loadTemplateForEditing(newTemplate, newIndex);

          // Ensure the new template is active in sidebar
          const templateItems = document.querySelectorAll('.sidebar-template-item');
          if (templateItems[newIndex]) {
            templateItems[newIndex].classList.add('active');
          }

          // Make sure the templates section tab is active
          const templatesNavItem = document.querySelector('.nav-item.templates-section');
          if (templatesNavItem) {
            templatesNavItem.classList.add('active');
          }
        }, 100);
      }
    });
  }
}

// Function to update sidebar templates
function updateSidebarTemplates() {
  console.log('Updating sidebar templates:', templates.length);
  const sidebarTemplatesList = document.getElementById('sidebar-templates-list');
  if (!sidebarTemplatesList) {
    console.error('Sidebar templates list element not found');
    return;
  }

  // Clear existing templates
  sidebarTemplatesList.innerHTML = '';

  // Add each template to the sidebar
  templates.forEach((template, index) => {
    const templateItem = document.createElement('div');
    templateItem.className = 'sidebar-template-item';
    templateItem.dataset.index = index;

    templateItem.innerHTML = `
      <span class="template-dropdown-icon">${template.icon || '📝'}</span>
      ${escapeHtml(template.name)}
    `;

    // Add click handler
    templateItem.addEventListener('click', function() {
      // Remove active class from all template items
      document.querySelectorAll('.sidebar-template-item').forEach(item => {
        item.classList.remove('active');
      });

      // Add active class to clicked item
      this.classList.add('active');

      // Show templates section and activate the templates tab
      document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
      });
      const templatesSection = document.getElementById('templates');
      if (templatesSection) {
        templatesSection.classList.add('active');
      }

      // Activate the templates tab in the sidebar
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
      });
      const templatesNavItem = document.querySelector('.nav-item.templates-section');
      if (templatesNavItem) {
        templatesNavItem.classList.add('active');
      }

      // Load template data
      loadTemplateForEditing(template, index);
    });

    sidebarTemplatesList.appendChild(templateItem);
  });
}

// Function to load template for editing
function loadTemplateForEditing(template, index) {
  console.log('Loading template for editing:', template, 'at index:', index);
  const templateForm = document.getElementById('templateForm');
  const templateName = document.getElementById('templateName');
  const templateSubjectLine = document.getElementById('templateSubjectLine');
  const templateContent = document.getElementById('templateContent');
  const templateIcon = document.getElementById('templateIcon');
  const saveButton = document.getElementById('saveTemplateButton');
  const deleteButton = document.getElementById('deleteTemplateButton');

  // Populate form
  templateName.value = template.name || '';
  templateSubjectLine.value = template.subjectLine || '';
  templateContent.value = template.content || '';
  templateIcon.textContent = template.icon || '📝';

  // Load attachments
  window.currentTemplateAttachments = template.attachments || [];
  updateAttachmentsList();

  // Update button states
  saveButton.textContent = 'Save Changes';
  deleteButton.style.display = 'inline-flex';

  // Store current template index
  templateForm.dataset.editIndex = index;
  console.log('Set editIndex to:', index);

  // Scroll to form
  templateForm.scrollIntoView({ behavior: 'smooth' });
}

// Function to reset template form
function resetTemplateForm() {
  const templateForm = document.getElementById('templateForm');
  const templateName = document.getElementById('templateName');
  const templateSubjectLine = document.getElementById('templateSubjectLine');
  const templateContent = document.getElementById('templateContent');
  const templateIcon = document.getElementById('templateIcon');
  const saveButton = document.getElementById('saveTemplateButton');
  const deleteButton = document.getElementById('deleteTemplateButton');

  // Clear form
  templateForm.reset();
  delete templateForm.dataset.editIndex;

  // Reset button states
  saveButton.textContent = 'Create';
  deleteButton.style.display = 'none';

  // Reset emoji to default
  templateIcon.textContent = '📝';

  // Clear attachments
  window.currentTemplateAttachments = [];
  updateAttachmentsList();
}

// Function to save templates to storage
function saveTemplates() {
  // Get email from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get('email');

  if (!email) {
    console.error('Email is not available, cannot save templates');
    window.showError('Email parameter is missing. Please try again.');
    return;
  }

  console.log('Saving templates to storage:', templates.length);

  // Delegate to TemplateManager if available
  if (window.TemplateManager) {
    window.TemplateManager.saveTemplates(email, templates).then(success => {
      if (success) {
        console.log('Templates saved successfully via TemplateManager');
        // Update sidebar after saving
        updateSidebarTemplates();
      } else {
        console.error('Failed to save templates via TemplateManager');
        window.showError('Failed to save template');
      }
    }).catch(error => {
      console.error('Error saving templates via TemplateManager:', error);
      window.showError('Failed to save template');
    });
  } else {
    // Fallback to direct Chrome storage
    chrome.storage.local.get([email], function(result) {
      const userData = result[email] || {};

      // Update templates in user data
      userData.templates = templates;

      // Save back to storage
      const data = {};
      data[email] = userData;

      chrome.storage.local.set(data, function() {
        console.log('Templates saved successfully');
        // Update sidebar after saving
        updateSidebarTemplates();
      });
    });
  }
}

// Helper function to escape HTML to prevent XSS
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initialize emoji picker
function initEmojiPicker() {
  const emojiPickerButton = document.getElementById('emojiPickerButton');
  const emojiPicker = document.getElementById('emojiPicker');
  const emojiPickerContent = document.querySelector('.emoji-picker-content');
  const templateIcon = document.getElementById('templateIcon');
  const templateForm = document.getElementById('templateForm');

  // Common emojis to display
  const commonEmojis = [
    '📝', '📧', '✉️', '📨', '📩', '💼', '👔', '🎓', '🎯', '💡',
    '🚀', '⭐', '🌟', '💫', '✨', '💪', '🎉', '🎊', '🎈', '🎁',
    '📚', '📖', '📑', '📋', '📌', '📍', '🔍', '🔎', '📊', '📈',
    '📉', '📅', '📆', '🗓️', '⏰', '⌛', '⏳', '⚡', '🔥', '💯'
  ];

  // Populate emoji picker with common emojis
  function populateEmojis(emojis) {
    emojiPickerContent.innerHTML = '';
    emojis.forEach(emoji => {
      const emojiItem = document.createElement('div');
      emojiItem.className = 'emoji-item';
      emojiItem.textContent = emoji;
      emojiItem.addEventListener('click', () => {
        templateIcon.textContent = emoji;
        emojiPicker.classList.remove('active');

        // Update the template data with the new emoji
        const editIndex = templateForm.dataset.editIndex;
        if (editIndex !== undefined) {
          // Update existing template
          const index = parseInt(editIndex);
          if (templates[index]) {
            templates[index].icon = emoji;
            // Save templates to storage
            saveTemplates();
            // Update the sidebar display
            updateSidebarTemplates();
          }
        }
      });
      emojiPickerContent.appendChild(emojiItem);
    });
  }

  // Initialize with common emojis
  populateEmojis(commonEmojis);

  // Toggle emoji picker
  emojiPickerButton.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('active');
  });

  // Close emoji picker when clicking outside
  document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && !emojiPickerButton.contains(e.target)) {
      emojiPicker.classList.remove('active');
    }
  });
}

// Initialize templates management with a slight delay to ensure DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(initializeTemplatesManagement, 500);
  initEmojiPicker();
});
