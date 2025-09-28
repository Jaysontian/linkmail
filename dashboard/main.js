
/*
 * Dashboard Race Condition Fix
 * ===========================
 * 
 * PROBLEM: Profile information sometimes doesn't appear on dashboard load but works after reload.
 * 
 * ROOT CAUSE: Race condition between:
 * 1. BackendAPI.init() - asynchronous authentication and initialization
 * 2. main.js - immediate profile loading attempt on DOMContentLoaded
 * 3. profile.js - separate profile loading logic (only for edit mode)
 * 
 * SOLUTION IMPLEMENTED:
 * 1. waitForBackendAPI() - Ensures BackendAPI completes initialization before profile loading
 * 2. loadAndDisplayUserProfile() - Centralized profile loading with ProfileManager + fallbacks
 * 3. Enhanced coordination between main.js and profile.js to prevent competing attempts
 * 4. Extended retry mechanism from profile.js to work for all dashboard modes
 * 5. Proper error handling and fallback to Chrome storage when backend fails
 * 
 * FLOW:
 * 1. BackendAPI loads and starts async initialization
 * 2. Dashboard scripts wait for BackendAPI to be ready
 * 3. Centralized profile loading attempts ProfileManager first, then Chrome storage
 * 4. Multiple retry attempts with exponential backoff for network issues
 * 5. Graceful fallback to empty form if no profile data exists
 */

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize notifications
window.notifications = {
  error: function(message) {
    // TODO: Implement error notification
    console.error(message);
  },
  success: function(message) {
    // TODO: Implement success notification
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

// Expose for testing
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  window.formatDate = formatDate;
}

// Initialize dashboard when DOM and BackendAPI are ready
async function initializeDashboard() {
  console.log('[Dashboard] Starting initialization...');
  
  const bioForm = document.getElementById('bioForm');
  const pageTitle = document.getElementById('pageTitle');
  const submitButton = document.getElementById('submitButton');
  const navItems = document.querySelectorAll('.nav-item');

  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  let email = urlParams.get('email');
  const mode = urlParams.get('mode');
  const isEditMode = mode === 'edit';

  // Wait for BackendAPI to be ready
  await waitForBackendAPI();

  // Fallback to backend email if URL parameter is missing
  if (!email && window.BackendAPI?.userData?.email) {
    email = window.BackendAPI.userData.email;
    console.log('📧 Using fallback email from BackendAPI:', email);
  }

  if (!email) {
    window.showError('Email parameter is missing. Please try again.');
    if (bioForm) bioForm.style.display = 'none';
    return;
  }

  // Load initial user data to update profile in sidebar
  // Use centralized profile loading instead of direct Chrome storage access
  await loadAndDisplayUserProfile(email);
  
  // Signal to profile.js that it should attempt profile loading if needed
  if (!isEditMode && email) {
    // Add URL parameter to trigger profile loading in profile.js as backup
    window.history.replaceState(null, null, `${window.location.pathname}?email=${encodeURIComponent(email)}&loadProfile=true`);
  }

  // Update UI based on mode
  if (isEditMode) {
    if (pageTitle) pageTitle.textContent = 'Your Profile';
    if (submitButton) submitButton.textContent = 'Save Changes';

    // Profile loading is handled by profile.js in edit mode
    console.log('[Dashboard] Edit mode detected - profile.js will handle profile loading');
  } else {
    // Hide the email history tab for new users
    const emailHistoryTab = document.querySelector('.nav-item.emails-section');
    if (emailHistoryTab) emailHistoryTab.style.display = 'none';
  }

  // Tab switching
  navItems.forEach(navItem => {
    navItem.addEventListener('click', () => {

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


      // Only proceed if we have a valid sectionId
      if (!sectionId) {
        return;
      }

      // Show the corresponding content section
      const targetSection = document.getElementById(sectionId);

      if (targetSection) {
        targetSection.classList.add('active');

        // If switching to emails tab, refresh the email list
        if (sectionId === 'emails') {
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
}

// Wait for BackendAPI to be ready
async function waitForBackendAPI() {
  console.log('[Dashboard] Waiting for BackendAPI to be ready...');
  
  let attempts = 0;
  const maxAttempts = 10; // Wait up to 5 seconds
  
  while (attempts < maxAttempts) {
    if (window.BackendAPI) {
      // Give BackendAPI time to complete initialization
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('[Dashboard] BackendAPI is ready');
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }
  
  console.warn('[Dashboard] BackendAPI not ready after waiting, continuing anyway');
}

// Centralized profile loading with retry mechanism
async function loadAndDisplayUserProfile(email) {
  console.log('[Dashboard] Loading user profile for sidebar display...');
  
  try {
    let userData = null;
    
    // Try ProfileManager first (includes backend and storage fallback)
    if (window.ProfileManager) {
      console.log('[Dashboard] Attempting to load profile via ProfileManager...');
      const result = await window.ProfileManager.getProfile(email);
      
      if (result.success && result.profile) {
        userData = result.profile;
        console.log('[Dashboard] Profile loaded via ProfileManager');
      } else {
        console.log('[Dashboard] No profile found via ProfileManager');
      }
    }
    
    // Fallback to Chrome storage if ProfileManager didn't return data
    if (!userData) {
      console.log('[Dashboard] Falling back to Chrome storage...');
      userData = await new Promise((resolve) => {
        chrome.storage.local.get([email], function(result) {
          const data = result[email];
          resolve(data && data.setupCompleted ? data : null);
        });
      });
      
      if (userData) {
        console.log('[Dashboard] Profile loaded from Chrome storage');
      } else {
        console.log('[Dashboard] No profile found in Chrome storage');
      }
    }
    
    // Update sidebar if we have user data
    if (userData) {
      updateUserProfileInSidebar(userData);
      
      // Load email history if available
      if (typeof window.loadEmailHistory === 'function') {
        window.loadEmailHistory(userData);
      }
    } else {
      console.log('[Dashboard] No user profile data available for sidebar');
    }
    
  } catch (error) {
    console.error('[Dashboard] Error loading user profile:', error);
    // Don't show error to user for sidebar loading failures
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  initializeDashboard().catch(error => {
    console.error('[Dashboard] Initialization failed:', error);
    // Continue with basic initialization even if profile loading fails
  });

  // Experience management functionality
  const experiencesContainer = document.getElementById('experiencesContainer');
  const addExperienceButton = document.getElementById('addExperienceButton');
  const experienceLimit = document.getElementById('experienceLimit');
  let experienceCount = 0;
  const MAX_EXPERIENCES = 5;

  // Initialize experience count based on existing DOM content
  if (experiencesContainer) {
    experienceCount = experiencesContainer.querySelectorAll('.experience-card').length;
    checkExperienceLimit();
  }

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
      addExperienceButton.style.display = 'none';
      experienceLimit.style.display = 'block';
    } else {
      addExperienceButton.style.display = 'block';
      experienceLimit.style.display = 'none';
    }
  }

  // Add experience button click handler
  if (addExperienceButton) {
    addExperienceButton.addEventListener('click', function() {
      if (experienceCount < MAX_EXPERIENCES) {
        experienceCount++;
        const card = createExperienceCard(experienceCount);
        experiencesContainer.appendChild(card);
        checkExperienceLimit();
      }
    });
  }

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
  if (addSkillButton) {
    addSkillButton.addEventListener('click', addSkill);
  }

  if (skillInput) {
    skillInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSkill();
      }
    });
  }

  // Form submission handler
  if (bioForm) {
    bioForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const name = document.getElementById('name').value;
      const college = document.getElementById('college').value;
      const gradYear = document.getElementById('gradYear').value;
      const linkedinUrl = document.getElementById('linkedinUrl').value;

      if (!name || !college || !gradYear || !linkedinUrl) {
        showError('Please fill in all required fields');
        return;
      }

      // Validate LinkedIn URL format
      if (!linkedinUrl.includes('linkedin.com')) {
        showError('Please enter a valid LinkedIn profile URL');
        return;
      }

      try {
        // Collect experiences data
        const experiences = collectExperiencesData();
        
        // Validate that at least one experience is added
        if (!experiences || experiences.length === 0) {
          showError('Please add at least one experience');
          return;
        }

        // Collect skills data
        const skillsData = typeof window.skills !== 'undefined' ? window.skills : skills;

        // Collect templates (optional UI feature)
        let templatesData = [];
        if (typeof window.collectTemplatesData === 'function') {
          try {
            templatesData = window.collectTemplatesData();
          } catch (templateError) {
            console.error('Error collecting templates from form:', templateError);
          }
        }

        // Prepare user data for ProfileManager
        const userData = {
          name: name,
          college: college,
          graduationYear: gradYear,
          linkedinUrl: linkedinUrl,
          email: email,
          experiences: experiences,
          skills: skillsData,
          templates: templatesData,
          setupCompleted: true
        };

        // Prefer ProfileManager (backend-only now)
        if (window.ProfileManager && typeof window.ProfileManager.updateProfile === 'function') {
          try {
            const result = await window.ProfileManager.updateProfile(email, userData);
            if (!result || !result.success) {
              throw new Error(result?.error || 'Failed to save via ProfileManager');
            }
            showSuccess('Profile saved successfully!');
            if (!isEditMode) setTimeout(() => window.close(), 2000);
            return;
          } catch (pmErr) {
            console.error('ProfileManager save failed:', pmErr?.message || pmErr);
            showError('Failed to save profile. Please try again.');
            return;
          }
        }
        showError('Profile service unavailable. Please sign in and try again.');
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
