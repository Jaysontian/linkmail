

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
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
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
    pageTitle.textContent = 'LinkMail';
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
    document.querySelector('.tab[data-tab="emails"]').style.display = 'none';
  }
  
  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      const tabName = tab.getAttribute('data-tab');
      document.getElementById(`${tabName}-tab`).classList.add('active');
      
      // If switching to emails tab, refresh the email list
      if (tabName === 'emails') {
        chrome.storage.local.get([email], function(result) {
          const userData = result[email];
          if (userData) {
            loadEmailHistory(userData);
          }
        });
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
      <div class="experience-header">
        <h4 class="experience-title">Experience ${num}</h4>
        ${num > 1 ? '<button type="button" class="experience-remove" title="Remove Experience">&times;</button>' : ''}
      </div>
      <div class="experience-fields">
        <div class="experience-field">
          <label for="jobTitle${num}">Job Title</label>
          <input type="text" id="jobTitle${num}" name="jobTitle${num}" placeholder="e.g. Software Engineer Intern" value="${data.jobTitle || ''}">
        </div>
        <div class="experience-field">
          <label for="company${num}">Company Name</label>
          <input type="text" id="company${num}" name="company${num}" placeholder="e.g. Google" value="${data.company || ''}">
        </div>
        <div class="experience-field">
          <label for="description${num}">Description</label>
          <textarea id="description${num}" name="description${num}" placeholder="Describe your responsibilities and achievements...">${data.description || ''}</textarea>
        </div>
      </div>
    `;
    
    // Add remove event listener
    const removeButton = card.querySelector('.experience-remove');
    if (removeButton) {
      removeButton.addEventListener('click', function() {
        card.remove();
        experienceCount--;
        updateExperienceCounts();
        checkExperienceLimit();
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
  function initializeTemplatesManagement() {
    const templatesContainer = document.getElementById('templates-container');
    const templateNameInput = document.getElementById('templateName');
    const templateContentInput = document.getElementById('templateContent');
    const addTemplateButton = document.getElementById('addTemplateButton');
    const noTemplatesMessage = document.getElementById('no-templates-message');
    
    // Skip initialization if elements don't exist
    if (!templatesContainer || !templateNameInput || !templateContentInput || !addTemplateButton || !noTemplatesMessage) {
      console.error('Template management elements not found');
      return;
    }
    
    let templates = [];
    const MAX_TEMPLATES = 10;

    // Function to reset the add form to its default state
    function resetTemplateForm() {
      templateNameInput.value = '';
      templateContentInput.value = '';
      addTemplateButton.textContent = 'Add Template';
      addTemplateButton.dataset.mode = 'add';
      delete addTemplateButton.dataset.index;
    }

    // Function to render template cards - fixed to prevent infinite loops
    function renderTemplates() {
      console.log('Rendering templates:', templates.length);
      
      // Clear container first (carefully, preserving the no-templates message)
      const childNodes = Array.from(templatesContainer.childNodes);
      for (const child of childNodes) {
        if (child !== noTemplatesMessage) {
          templatesContainer.removeChild(child);
        }
      }
      
      // Show or hide "no templates" message
      if (!templates || templates.length === 0) {
        noTemplatesMessage.style.display = 'block';
        
        // If there are no templates, make sure the form is reset to add mode
        resetTemplateForm();
      } else {
        noTemplatesMessage.style.display = 'none';
        
        // Create and append each template card
        templates.forEach((template, index) => {
          try {
            const templateCard = createTemplateCard(template, index);
            if (templateCard) {
              templatesContainer.insertBefore(templateCard, noTemplatesMessage);
            }
          } catch (error) {
            console.error('Error creating template card:', error);
          }
        });
      }
    }

    // Function to create a template card - error handling added
    function createTemplateCard(template, index) {
      if (!template || typeof template !== 'object') {
        console.error('Invalid template data:', template);
        return null;
      }
      
      try {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.dataset.templateId = index;
        
        card.innerHTML = `
          <div class="template-header">
            <h3 class="template-title">${escapeHtml(template.name || '')}</h3>
            <div class="template-btn-group">
              <button class="template-btn template-edit">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil-icon lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
              </button>
              <button class="template-btn template-remove">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-icon lucide-trash"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
          <div class="template-content">
            ${escapeHtml(template.content || '')}
          </div>
        `;
        
        // Add edit event listener
        const editButton = card.querySelector('.template-edit');
        if (editButton) {
          editButton.addEventListener('click', function(e) {
            e.preventDefault();
            // Populate form with template data for editing
            templateNameInput.value = template.name || '';
            templateContentInput.value = template.content || '';
            
            // Change add button to update button
            addTemplateButton.textContent = 'Update Template';
            addTemplateButton.dataset.mode = 'edit';
            addTemplateButton.dataset.index = index;
            
            // Scroll to the form
            templateNameInput.scrollIntoView({ behavior: 'smooth' });
            templateNameInput.focus();
          });
        }
        
        // Add remove event listener
        const removeButton = card.querySelector('.template-remove');
        if (removeButton) {
          removeButton.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Check if we're currently editing this template
            const currentEditIndex = parseInt(addTemplateButton.dataset.index);
            if (!isNaN(currentEditIndex) && currentEditIndex === index) {
              // Reset form if we're deleting the template we're currently editing
              resetTemplateForm();
            }
            
            // Remove the template
            templates.splice(index, 1);
            renderTemplates();
          });
        }
        
        return card;
      } catch (error) {
        console.error('Error in createTemplateCard:', error);
        return null;
      }
    }


    // Add template button click handler - fixed and with better error handling
    addTemplateButton.addEventListener('click', function(e) {
      e.preventDefault();
      
      try {
        const name = templateNameInput.value.trim();
        const content = templateContentInput.value.trim();
        
        if (!name) {
          showError('Please enter a template name');
          return;
        }
        
        if (!content) {
          showError('Please enter template content');
          return;
        }
        
        const mode = addTemplateButton.dataset.mode || 'add';
        
        if (mode === 'add') {
          // Check max templates
          if (templates.length >= MAX_TEMPLATES) {
            showError(`You can only add up to ${MAX_TEMPLATES} templates`);
            return;
          }
          
          // Check for duplicate name
          if (templates.some(t => t && t.name === name)) {
            showError('A template with this name already exists');
            return;
          }
          
          // Add new template
          templates.push({ name, content });
          console.log('Added new template:', name);
          
          // Save templates immediately after adding
          saveTemplates();
        } else if (mode === 'edit') {
          // Update existing template
          const index = parseInt(addTemplateButton.dataset.index);
          if (isNaN(index) || index < 0 || index >= templates.length) {
            console.error('Invalid template index for edit:', index);
            showError('Error updating template');
            resetTemplateForm();
            return;
          }
          
          templates[index] = { name, content };
          console.log('Updated template at index', index);
          
          // Save templates immediately after updating
          saveTemplates();
        }
        
        // Clear form and reset to add mode
        resetTemplateForm();
        
        // Re-render templates
        renderTemplates();
        
        showSuccess('Template saved successfully!');
      } catch (error) {
        console.error('Error handling template save:', error);
        showError('An error occurred while saving the template');
        resetTemplateForm();
      }
    });

    // Add a cancel button next to Add Template
    const formContainer = addTemplateButton.parentElement;
    if (formContainer) {
      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'linkmail-button secondary-button';
      cancelButton.textContent = 'Cancel';
      cancelButton.style.marginLeft = '10px';
      
      cancelButton.addEventListener('click', function(e) {
        e.preventDefault();
        resetTemplateForm();
      });
      
      formContainer.appendChild(cancelButton);
    }

    // Function to save templates to storage immediately
    function saveTemplates() {
      if (!email) {
        console.error('Email is not available, cannot save templates');
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
        });
      });
    }

    // Function to collect all templates data
    function collectTemplatesData() {
      return Array.isArray(templates) ? templates : [];
    }

    // Load existing templates if in edit mode
    console.log('Loading templates for email:', email);
    chrome.storage.local.get([email], function(result) {
      const userData = result[email];
      if (userData && userData.templates && Array.isArray(userData.templates)) {
        templates = JSON.parse(JSON.stringify(userData.templates)); // Deep clone to avoid reference issues
        console.log('Loaded', templates.length, 'templates');
        renderTemplates();
      } else {
        console.log('No existing templates found');
      }
    });
    
    // Expose the collectTemplatesData function
    window.collectTemplatesData = collectTemplatesData;
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
      const preview = email.content.substring(0, 100) + (email.content.length > 100 ? '...' : '');
      
      emailListHTML += `
        <div class="email-item" data-index="${index}">
          <div class="email-header">
            <div class="email-recipient">${escapeHtml(email.recipientName || email.recipientEmail)}</div>
            <div class="email-date">${date}</div>
          </div>
          <div class="email-subject">${escapeHtml(email.subject)}</div>
          <div class="email-preview">${escapeHtml(preview)}</div>
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
    
    let detailsHTML = `
      <div class="email-detail-header">
        <h3>${escapeHtml(email.subject)}</h3>
        <p><b>Recipient:</b> ${escapeHtml(email.recipientName)} (${escapeHtml(email.recipientEmail)})</p>
        <p><strong>Sent on:</strong> ${date}</p>
        ${email.linkedInUrl ? `<a href="${escapeHtml(email.linkedInUrl)}" target="_blank"><button class="lm-btn" style="margin:8px 0px;">View LinkedIn</button></a>` : ''}
      </div>

      <div class="email-detail-body">${escapeHtml(email.content)}</div>
    `;
    
    emailDetail.innerHTML = detailsHTML;
    emailModal.style.display = 'block';
  }
  
  function showError(message) {
    messageElement.textContent = message;
    messageElement.className = 'error';
    messageElement.style.display = 'block';
  }
  
  function showSuccess(message) {
    messageElement.textContent = message;
    messageElement.className = 'success';
    messageElement.style.display = 'block';
  }
  
  // Helper function to escape HTML to prevent XSS
  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
});