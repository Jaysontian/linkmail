function formatDate(emailDate) {
  const now = new Date();
  const emailDateTime = new Date(emailDate);

  const isToday = now.toDateString() === emailDateTime.toDateString();
  const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === emailDateTime.toDateString();
  const isTomorrow = new Date(now.setDate(now.getDate() + 2)).toDateString() === emailDateTime.toDateString();

  if (isToday) {
    return `Today at ${emailDateTime.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  } else if (isYesterday) {
    return `Yesterday at ${emailDateTime.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  } else if (isTomorrow) {
    return `Tomorrow at ${emailDateTime.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  } else {
    return emailDateTime.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) +
           ` at ${emailDateTime.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const bioForm = document.getElementById('bioForm');
  const messageElement = document.getElementById('message');
  const pageTitle = document.getElementById('pageTitle');
  const submitButton = document.getElementById('submitButton');
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.content-section');
  const emailList = document.getElementById('emailList');
  const emailSearch = document.getElementById('emailSearch');
  const emailModal = document.getElementById('emailModal');
  const emailDetail = document.getElementById('emailDetail');
  const closeModal = document.getElementById('closeModal');

  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get('email');
  const mode = urlParams.get('mode');
  const isEditMode = mode === 'edit';

  if (!email) {
    showError('Email parameter is missing. Please try again.');
    bioForm.style.display = 'none';
    return;
  }

  // Update UI based on mode
  if (isEditMode) {
    pageTitle.textContent = 'Your Profile';
    submitButton.textContent = 'Save Changes';

    // Load existing data
    chrome.storage.local.get([email], function(result) {
      const userData = result[email];
      if (userData) {
        document.getElementById('name').value = userData.name || '';
        document.getElementById('college').value = userData.college || '';
        document.getElementById('gradYear').value = userData.graduationYear || '';

        // Load email history
        loadEmailHistory(userData);
      }
    });
  } else {
    // Hide the email history tab for new users
    document.querySelector('.nav-item.emails-section').style.display = 'none';
  }

  // Tab switching
  navItems.forEach(navItem => {
    navItem.addEventListener('click', () => {
      console.log('Nav item clicked:', navItem);
      console.log('Nav item classes:', navItem.classList);

      // Remove active class from all nav items and contents
      navItems.forEach(item => item.classList.remove('active'));
      document.querySelectorAll('.content-section').forEach(content => content.classList.remove('active'));

      // Add active class to clicked nav item
      navItem.classList.add('active');

      // Get the section ID based on the nav item class
      let sectionId;
      if (navItem.classList.contains('profile-section')) {
        sectionId = 'profile';
      } else if (navItem.classList.contains('emails-section')) {
        sectionId = 'emails';
      } else if (navItem.classList.contains('templates-section')) {
        sectionId = 'templates';
      }

      console.log('Found section ID:', sectionId);

      // Show the corresponding content section
      const targetSection = document.getElementById(sectionId);
      console.log('Target section element:', targetSection);

      if (targetSection) {
        targetSection.classList.add('active');

        // If switching to emails tab, refresh the email list
        if (sectionId === 'emails') {
          console.log('Switching to emails tab, refreshing email list');
          chrome.storage.local.get([email], function(result) {
            const userData = result[email];
            if (userData) {
              loadEmailHistory(userData);
            }
          });
        }

        // Remove active class from template items if switching to non-template tab
        if (sectionId !== 'templates') {
          document.querySelectorAll('.sidebar-template-item').forEach(item => {
            item.classList.remove('active');
          });
        }
      } else {
        console.error('Could not find section element with id:', sectionId);
      }
    });
  });

  // Email search functionality
  emailSearch.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    chrome.storage.local.get([email], function(result) {
      const userData = result[email];
      if (userData) {
        loadEmailHistory(userData, searchTerm);
      }
    });
  });

  // Close modal
  closeModal.addEventListener('click', function() {
    emailModal.style.display = 'none';
  });

  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === emailModal) {
      emailModal.style.display = 'none';
    }
  });

  // Experience management functionality
  const experiencesContainer = document.getElementById('experiencesContainer');
  const addExperienceButton = document.getElementById('addExperienceButton');
  const experienceLimit = document.getElementById('experienceLimit');
  let experienceCount = 0;
  const MAX_EXPERIENCES = 5;

  // Function to create a new experience card
  function createExperienceCard(num, data = {}) {
    const card = document.createElement('div');
    card.className = 'experience-card';
    card.dataset.experienceId = num;

    card.innerHTML = `
      <button type="button" class="experience-remove" title="Remove Experience">&times;</button>
      <div class="experience-fields">
        <div class="experience-field-row">
          <div class="experience-field">
            <label for="jobTitle${num}">Job Title</label>
            <input type="text" id="jobTitle${num}" name="jobTitle${num}" class="lm-input short" placeholder="e.g. Software Engineer Intern" value="${escapeHtml(data.jobTitle || '')}">
          </div>
          <div class="experience-field">
            <label for="company${num}">Company Name</label>
            <input type="text" id="company${num}" name="company${num}" class="lm-input short" placeholder="e.g. Google" value="${escapeHtml(data.company || '')}">
          </div>
        </div>
        <div class="experience-field">
          <label for="description${num}">Description</label>
          <textarea id="description${num}" name="description${num}" class="lm-input" placeholder="Describe your responsibilities and achievements...">${escapeHtml(data.description || '')}</textarea>
        </div>
      </div>
    `;

    // Add remove event listener
    const removeButton = card.querySelector('.experience-remove');
    if (removeButton) {
      removeButton.addEventListener('click', function() {
        card.classList.add('removing');
        setTimeout(() => {
          card.remove();
          experienceCount--;
          updateExperienceCounts();
          checkExperienceLimit();
        }, 300); // Match animation duration
      });
    }

    return card;
  }

  // Function to update the experience numbers after removal
  function updateExperienceCounts() {
    const cards = experiencesContainer.querySelectorAll('.experience-card');
    cards.forEach((card, index) => {
      const num = index + 1;
      card.dataset.experienceId = num;
      card.querySelector('.experience-title').textContent = `Experience ${num}`;
    });
  }

  // Function to check if we've reached the max experiences
  function checkExperienceLimit() {
    if (experienceCount >= MAX_EXPERIENCES) {
      addExperienceButton.disabled = true;
      experienceLimit.style.display = 'block';
    } else {
      addExperienceButton.disabled = false;
      experienceLimit.style.display = 'none';
    }
  }

  // Add experience button click handler
  addExperienceButton.addEventListener('click', function() {
    if (experienceCount < MAX_EXPERIENCES) {
      experienceCount++;
      const card = createExperienceCard(experienceCount);
      experiencesContainer.appendChild(card);
      checkExperienceLimit();
    }
  });

  // Function to collect all experiences data
  function collectExperiencesData() {
    const experiences = [];
    const cards = experiencesContainer.querySelectorAll('.experience-card');

    cards.forEach(card => {
      const id = card.dataset.experienceId;
      const experience = {
        jobTitle: document.getElementById(`jobTitle${id}`).value.trim(),
        company: document.getElementById(`company${id}`).value.trim(),
        description: document.getElementById(`description${id}`).value.trim()
      };

      // Only add if at least one field has data
      if (experience.jobTitle || experience.company || experience.description) {
        experiences.push(experience);
      }
    });

    return experiences;
  }

  // Skills management functionality
  const skillInput = document.getElementById('skillInput');
  const addSkillButton = document.getElementById('addSkillButton');
  const skillsTagsContainer = document.getElementById('skillsTagsContainer');
  const noSkillsMessage = document.getElementById('noSkillsMessage');
  let skills = [];
  const MAX_SKILLS = 10;

  // Function to add a skill
  function addSkill() {
    const skill = skillInput.value.trim();

    if (!skill) {
      return;
    }

    // Check for duplicate
    if (skills.includes(skill)) {
      showError('This skill has already been added');
      return;
    }

    // Check max skills
    if (skills.length >= MAX_SKILLS) {
      showError(`You can only add up to ${MAX_SKILLS} skills`);
      return;
    }

    // Add to array
    skills.push(skill);

    // Create tag element
    const tagElement = document.createElement('div');
    tagElement.className = 'skill-tag';
    tagElement.innerHTML = `
      ${escapeHtml(skill)}
      <span class="remove-skill" data-skill="${escapeHtml(skill)}">&times;</span>
    `;

    // Add click event to remove button
    tagElement.querySelector('.remove-skill').addEventListener('click', function() {
      const skillToRemove = this.getAttribute('data-skill');
      removeSkill(skillToRemove);
      tagElement.remove();
      updateSkillsDisplay();
    });

    // Add to container
    skillsTagsContainer.appendChild(tagElement);

    // Clear input
    skillInput.value = '';

    // Focus input for next entry
    skillInput.focus();

    // Update display
    updateSkillsDisplay();
  }

  // Function to remove a skill
  function removeSkill(skillToRemove) {
    skills = skills.filter(skill => skill !== skillToRemove);
  }

  // Function to update the skills display
  function updateSkillsDisplay() {
    if (skills.length === 0) {
      noSkillsMessage.style.display = 'block';
    } else {
      noSkillsMessage.style.display = 'none';
    }
  }

  // Add event listeners for skills
  addSkillButton.addEventListener('click', addSkill);

  skillInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  });

  // Templates management functionality
  let templates = []; // Move templates array to global scope
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
          showSuccess('Template deleted successfully!');

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
          showError('Only PDF files are allowed');
          this.value = ''; // Clear the input
          return;
        }

        // Check file size (limit to 5MB)
        if (file.size > 5 * 1024 * 1024) {
          showError('File size exceeds 5MB limit');
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
          showError('Error reading file: ' + error.message);
        }
      });
    }

    // Load existing templates
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

    // Add click handler for "New Template" button
    const newTemplateButton = document.querySelector('.new-template-button');
    if (newTemplateButton) {
      newTemplateButton.addEventListener('click', function() {
        // Check max templates
        if (templates.length >= MAX_TEMPLATES) {
          showError(`You can only add up to ${MAX_TEMPLATES} templates`);
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
    if (templateForm) {
      templateForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const name = document.getElementById('templateName').value.trim();
        const subjectLine = document.getElementById('templateSubjectLine').value.trim();
        const content = document.getElementById('templateContent').value.trim();
        const icon = document.getElementById('templateIcon').textContent;

        if (!name || !content) {
          showError('Please fill in all required fields');
          return;
        }

        const editIndex = this.dataset.editIndex;

        if (editIndex !== undefined) {
          // Update existing template
          const index = parseInt(editIndex);

          // Check for duplicate name (excluding current template)
          const duplicateIndex = templates.findIndex((t, i) => i !== index && t.name === name);
          if (duplicateIndex !== -1) {
            showError('A template with this name already exists');
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

          // Reset form
          resetTemplateForm();

          showSuccess('Template updated successfully!');
        } else {
          // Check for duplicate name for new template
          if (templates.some(t => t.name === name)) {
            showError('A template with this name already exists');
            return;
          }

          // Add new template
          templates.push({
            name,
            content,
            subjectLine: subjectLine || `${name} with [Recipient Name]`,
            attachments: window.currentTemplateAttachments || [],
            icon: icon
          });

          // Save templates
          saveTemplates();

          // Update the sidebar
          updateSidebarTemplates();

          // Reset form
          resetTemplateForm();

          showSuccess('Template saved successfully!');
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
      showError('Email parameter is missing. Please try again.');
      return;
    }

    console.log('Saving templates to storage:', templates.length);

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

  // Form submission handler
  bioForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const college = document.getElementById('college').value;
    const gradYear = document.getElementById('gradYear').value;

    if (!name || !college || !gradYear) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      // Collect experiences data
      const experiences = collectExperiencesData();

      // Collect skills data
      const skillsData = typeof window.skills !== 'undefined' ? window.skills : skills;

      // Get existing user data first to ensure we don't lose templates
      chrome.storage.local.get([email], function(result) {
        const existingData = result[email] || {};

        // Collect templates data safely
        let templatesData = [];
        if (typeof window.collectTemplatesData === 'function') {
          try {
            templatesData = window.collectTemplatesData();
            console.log('Collected templates from form:', templatesData.length);
          } catch (templateError) {
            console.error('Error collecting templates from form:', templateError);
            // Fall back to existing templates if available
            if (existingData.templates && Array.isArray(existingData.templates)) {
              templatesData = existingData.templates;
              console.log('Using existing templates from storage:', templatesData.length);
            }
          }
        } else if (existingData.templates && Array.isArray(existingData.templates)) {
          // If collectTemplatesData isn't available, use existing templates
          templatesData = existingData.templates;
          console.log('Using existing templates from storage:', templatesData.length);
        }

        // Prepare user data
        const userData = {
          name: name,
          college: college,
          graduationYear: gradYear,
          email: email,
          experiences: experiences,
          skills: skillsData,
          templates: templatesData,
          setupCompleted: true
        };

        console.log('Saving user data with templates:', templatesData.length);

        // Merge with other existing data (like sent emails)
        const mergedData = {
          ...existingData,
          ...userData
        };

        // Store the data
        const data = {};
        data[email] = mergedData;

        chrome.storage.local.set(data, function() {
          // Show success message
          showSuccess('Profile saved successfully!');

          // If not in edit mode, close the tab after a delay
          if (!isEditMode) {
            setTimeout(() => {
              window.close();
            }, 2000);
          }
        });
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      const actionText = isEditMode ? 'updating' : 'saving';
      showError(`Error ${actionText} profile: ${error.message}`);
    }
  });

  function loadEmailHistory(userData, searchTerm = '') {
    const sentEmails = userData.sentEmails || [];

    if (sentEmails.length === 0) {
      emailList.innerHTML = '<div class="no-emails">No emails found</div>';
      return;
    }

    // Filter emails if search term is provided
    const filteredEmails = searchTerm ?
      sentEmails.filter(email =>
        (email.recipientName && email.recipientName.toLowerCase().includes(searchTerm)) ||
        (email.recipientEmail && email.recipientEmail.toLowerCase().includes(searchTerm)) ||
        (email.subject && email.subject.toLowerCase().includes(searchTerm)) ||
        (email.content && email.content.toLowerCase().includes(searchTerm))
      ) :
      sentEmails;

    if (filteredEmails.length === 0) {
      emailList.innerHTML = '<div class="no-emails">No matching emails found</div>';
      return;
    }

    // Sort emails by date (newest first)
    const sortedEmails = [...filteredEmails].sort((a, b) =>
      new Date(b.date) - new Date(a.date)
    );

    // Generate HTML for email list
    let emailListHTML = '';

    sortedEmails.forEach((email, index) => {
      const date = formatDate(email.date);
      const attachmentIndicator = email.attachments && email.attachments.length > 0 ?
        `<span class="email-attachment-indicator" title="${email.attachments.length} attachment${email.attachments.length > 1 ? 's' : ''}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.47"/>
          </svg>
        </span>` : '';

      emailListHTML += `
        <div class="email-item" data-index="${index}">
          <div class="email-recipient">
            ${escapeHtml(email.recipientName || email.recipientEmail)}
            ${attachmentIndicator}
          </div>
          <div class="email-subject">${escapeHtml(email.subject)}</div>
          <div class="email-date">${date}</div>
        </div>
      `;
    });

    emailList.innerHTML = emailListHTML;

    // Add click event to email items
    document.querySelectorAll('.email-item').forEach(item => {
      item.addEventListener('click', function() {
        const index = parseInt(this.getAttribute('data-index'));
        showEmailDetails(sortedEmails[index]);
      });
    });
  }

  function showEmailDetails(email) {
    const date = formatDate(email.date);

    let attachmentsHtml = '';
    if (email.attachments && email.attachments.length > 0) {
      const attachmentsList = email.attachments.map(att => {
        return `<div class="email-detail-attachment">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span>${escapeHtml(att.name)}</span>
        </div>`;
      }).join('');

      attachmentsHtml = `
        <div class="email-detail-attachments">
          <h4>Attachments</h4>
          <div class="email-attachments-list">
            ${attachmentsList}
          </div>
        </div>
      `;
    }

    // Get initials for avatar
    const initials = email.recipientName
      ? email.recipientName.split(' ').map(n => n[0]).join('').toUpperCase()
      : email.recipientEmail[0].toUpperCase();

    let detailsHTML = `
      <div class="email-detail-header">
        <div class="header-top">
          <h2 class="header-title">Coffee chat request</h2>
          <div class="header-date">${date}</div>
        </div>
        
        <div class="recipient-info">
          <div class="recipient-avatar">${initials}</div>
          <div class="recipient-details">
            <div class="recipient-name">${escapeHtml(email.recipientName)}</div>
            <div class="recipient-email">${escapeHtml(email.recipientEmail)}</div>
          </div>
        </div>
        
        ${email.linkedInUrl ? `
          <a href="${escapeHtml(email.linkedInUrl)}" target="_blank" class="linkedin-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
              <rect x="2" y="9" width="4" height="12"/>
              <circle cx="4" cy="4" r="2"/>
            </svg>
            View LinkedIn
          </a>
        ` : ''}
      </div>

      ${attachmentsHtml}
      
      <div class="email-detail-body">${escapeHtml(email.content)}</div>
    `;

    emailDetail.innerHTML = detailsHTML;
    emailModal.style.display = 'block';

    // Add delete template button handler
    const deleteTemplateModalButton = document.getElementById('deleteTemplateModalButton');
    if (deleteTemplateModalButton) {
      deleteTemplateModalButton.onclick = function() {
        if (confirm('Are you sure you want to delete this template?')) {
          // Get the current template index from the sidebar
          const activeTemplate = document.querySelector('.sidebar-template-item.active');
          if (activeTemplate) {
            const index = parseInt(activeTemplate.dataset.index);
            // Remove the template from the array
            templates.splice(index, 1);

            // Save the updated templates
            saveTemplates();

            // Update the sidebar
            updateSidebarTemplates();

            // Close the modal
            emailModal.style.display = 'none';

            // Show success message
            showSuccess('Template deleted successfully!');
          }
        }
      };
    }
  }

  function showError(message) {
    window.notifications.error(message);
  }

  function showSuccess(message) {
    window.notifications.success(message);
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

  // Load existing experiences if in edit mode
  if (isEditMode) {
    chrome.storage.local.get([email], function(result) {
      const userData = result[email];
      if (userData) {
        // Load experiences
        if (userData.experiences && Array.isArray(userData.experiences)) {
          userData.experiences.forEach((exp, index) => {
            experienceCount++;
            const card = createExperienceCard(experienceCount, exp);
            experiencesContainer.appendChild(card);
          });
          checkExperienceLimit();
        } else {
          // Add one empty experience card by default
          experienceCount++;
          const card = createExperienceCard(experienceCount);
          experiencesContainer.appendChild(card);
        }

        // Load skills
        if (userData.skills && Array.isArray(userData.skills)) {
          skills = [...userData.skills];

          // Create skill tags
          skills.forEach(skill => {
            const tagElement = document.createElement('div');
            tagElement.className = 'skill-tag';
            tagElement.innerHTML = `
              ${escapeHtml(skill)}
              <span class="remove-skill" data-skill="${escapeHtml(skill)}">&times;</span>
            `;

            // Add click event to remove button
            tagElement.querySelector('.remove-skill').addEventListener('click', function() {
              const skillToRemove = this.getAttribute('data-skill');
              removeSkill(skillToRemove);
              tagElement.remove();
              updateSkillsDisplay();
            });

            // Add to container
            skillsTagsContainer.appendChild(tagElement);
          });

          updateSkillsDisplay();
        }
      }
    });
  } else {
    // Add one empty experience card by default for new users
    experienceCount++;
    const card = createExperienceCard(experienceCount);
    experiencesContainer.appendChild(card);
  }

  // Initialize templates management with a slight delay to ensure DOM is ready
  setTimeout(initializeTemplatesManagement, 500);

  // Initialize emoji picker
  initEmojiPicker();

  // Add event handler for template form submission
  const templateForm = document.getElementById('templateForm');
  const saveTemplateButton = document.getElementById('saveTemplateButton');

  if (templateForm && saveTemplateButton) {
    saveTemplateButton.addEventListener('click', function(e) {
      e.preventDefault();
      templateForm.dispatchEvent(new Event('submit'));
    });
  }
});

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
