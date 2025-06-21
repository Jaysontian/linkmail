console.log('Main module loaded');

// Initialize notifications
window.notifications = {
  error: function(message) {
    // TODO: Implement error notification
    console.error(message);
  },
  success: function(message) {
    // TODO: Implement success notification
    console.log(message);
  }
};

// Initialize shared functions
window.showError = window.notifications.error;
window.showSuccess = window.notifications.success;

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
    window.showError('Email parameter is missing. Please try again.');
    if (bioForm) bioForm.style.display = 'none';
    return;
  }

  // Load initial user data to update profile in sidebar
  chrome.storage.local.get([email], function(result) {
    const userData = result[email];
    if (userData) {
      updateUserProfileInSidebar(userData);
    }
  });

  // Update UI based on mode
  if (isEditMode) {
    if (pageTitle) pageTitle.textContent = 'Your Profile';
    if (submitButton) submitButton.textContent = 'Save Changes';

    // Load existing data
    chrome.storage.local.get([email], function(result) {
      const userData = result[email];
      if (userData) {
        if (document.getElementById('name')) document.getElementById('name').value = userData.name || '';
        if (document.getElementById('college')) document.getElementById('college').value = userData.college || '';
        if (document.getElementById('gradYear')) document.getElementById('gradYear').value = userData.graduationYear || '';

        // Update user profile in sidebar
        updateUserProfileInSidebar(userData);

        // Load email history
        if (typeof window.loadEmailHistory === 'function') {
          window.loadEmailHistory(userData);
        }
      }
    });
  } else {
    // Hide the email history tab for new users
    const emailHistoryTab = document.querySelector('.nav-item.emails-section');
    if (emailHistoryTab) emailHistoryTab.style.display = 'none';
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
      } else if (navItem.classList.contains('new-template-button')) {
        // Special case for the "New Template" button
        sectionId = 'templates';
      }

      console.log('Found section ID:', sectionId);

      // Only proceed if we have a valid sectionId
      if (!sectionId) {
        console.log('No section ID found for this nav item, skipping tab switch');
        return;
      }

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
            if (userData && typeof window.loadEmailHistory === 'function') {
              window.loadEmailHistory(userData);
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
            <input type="text" id="jobTitle${num}" name="jobTitle${num}" class="lm-input short" placeholder="e.g. Software Engineer Intern" value="${data.jobTitle || ''}">
          </div>
          <div class="experience-field">
            <label for="company${num}">Company Name</label>
            <input type="text" id="company${num}" name="company${num}" class="lm-input short" placeholder="e.g. Google" value="${data.company || ''}">
          </div>
        </div>
        <div class="experience-field">
          <label for="description${num}">Description</label>
          <textarea id="description${num}" name="description${num}" class="lm-input" placeholder="Describe your responsibilities and achievements...">${data.description || ''}</textarea>
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

      // Check if the title element exists before updating it
      const titleElement = card.querySelector('.experience-title');
      if (titleElement) {
        titleElement.textContent = `Experience ${num}`;
      }
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

  // Form submission handler
  if (bioForm) {
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
  }
});

// Add new function to update user profile in sidebar
function updateUserProfileInSidebar(userData) {
  if (!userData || !userData.name || !userData.email) return;

  const userNameElement = document.querySelector('.user-name');
  const userEmailElement = document.getElementById('user-email-display');
  const userAvatarElement = document.querySelector('.user-avatar');

  if (userNameElement) userNameElement.textContent = userData.name;
  if (userEmailElement) userEmailElement.textContent = userData.email;

  if (userAvatarElement && userData.name) {
    // Generate initials from name (up to 2 characters)
    const nameParts = userData.name.split(' ');
    let initials = nameParts[0].charAt(0);

    if (nameParts.length > 1) {
      initials += nameParts[nameParts.length - 1].charAt(0);
    }

    userAvatarElement.textContent = initials.toUpperCase();
  }
}
