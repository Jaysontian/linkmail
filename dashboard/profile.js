
// Experience management functionality
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
        window.experienceCount--;
        updateExperienceCounts();
        checkExperienceLimit();
      }, 300); // Match animation duration
    });
  }

  return card;
}

function updateExperienceCounts() {
  const cards = document.getElementById('experiencesContainer').querySelectorAll('.experience-card');
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

function checkExperienceLimit() {
  const addExperienceButton = document.getElementById('addExperienceButton');
  const experienceLimit = document.getElementById('experienceLimit');
  const MAX_EXPERIENCES = 5;

  if (window.experienceCount >= MAX_EXPERIENCES) {
    addExperienceButton.disabled = true;
    experienceLimit.style.display = 'block';
  } else {
    addExperienceButton.disabled = false;
    experienceLimit.style.display = 'none';
  }
}

function collectExperiencesData() {
  const experiences = [];
  const cards = document.getElementById('experiencesContainer').querySelectorAll('.experience-card');

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
function addSkill() {
  const skillInput = document.getElementById('skillInput');
  const skill = skillInput.value.trim();
  const MAX_SKILLS = 10;

  if (!skill) {
    return;
  }

  // Check for duplicate
  if (window.skills.includes(skill)) {
    window.showError('This skill has already been added');
    return;
  }

  // Check max skills
  if (window.skills.length >= MAX_SKILLS) {
    window.showError(`You can only add up to ${MAX_SKILLS} skills`);
    return;
  }

  // Add to array
  window.skills.push(skill);

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
  document.getElementById('skillsTagsContainer').appendChild(tagElement);

  // Clear input
  skillInput.value = '';

  // Focus input for next entry
  skillInput.focus();

  // Update display
  updateSkillsDisplay();
}

function removeSkill(skillToRemove) {
  window.skills = window.skills.filter(skill => skill !== skillToRemove);
}

function updateSkillsDisplay() {
  const noSkillsMessage = document.getElementById('noSkillsMessage');
  if (!noSkillsMessage) return;

  if (window.skills.length === 0) {
    noSkillsMessage.style.display = 'block';
  } else {
    noSkillsMessage.style.display = 'none';
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

// Initialize profile functionality
document.addEventListener('DOMContentLoaded', function() {
  const bioForm = document.getElementById('bioForm');
  const addExperienceButton = document.getElementById('addExperienceButton');
  const experiencesContainer = document.getElementById('experiencesContainer');
  const skillInput = document.getElementById('skillInput');
  const addSkillButton = document.getElementById('addSkillButton');

  // Initialize experience count
  window.experienceCount = 0;
  const MAX_EXPERIENCES = 5;

  // Initialize skills array
  window.skills = [];

  // Add experience button click handler
  if (addExperienceButton) {
    addExperienceButton.addEventListener('click', function() {
      if (window.experienceCount < MAX_EXPERIENCES) {
        window.experienceCount++;
        const card = createExperienceCard(window.experienceCount);
        experiencesContainer.appendChild(card);
        checkExperienceLimit();
      }
    });
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

      const firstName = document.getElementById('firstName').value;
      const lastName = document.getElementById('lastName').value;
      const college = document.getElementById('college').value;
      const linkedinUrl = document.getElementById('linkedinUrl').value;

      if (!firstName || !lastName || !college || !linkedinUrl) {
        window.showError('Please fill in all required fields');
        return;
      }

      // Validate LinkedIn URL format
      if (!linkedinUrl.includes('linkedin.com')) {
        window.showError('Please enter a valid LinkedIn profile URL');
        return;
      }

      // Collect experiences data for validation
      const experiences = collectExperiencesData();
      
      // Validate that at least one experience is added
      if (!experiences || experiences.length === 0) {
        window.showError('Please add at least one experience');
        return;
      }

      try {
        // Show form loading overlay
        showFormLoading();

        // Experiences already collected and validated above

        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        let email = urlParams.get('email');
        const mode = urlParams.get('mode');
        const isEditMode = mode === 'edit';

        // Fallback to backend email if URL parameter is missing
        if (!email && window.BackendAPI?.userData?.email) {
          email = window.BackendAPI.userData.email;
          console.log('📧 Form submission using fallback email from BackendAPI:', email);
        }

        // Prepare user data
        const userData = {
          firstName: firstName,
          lastName: lastName,
          college: college,
          linkedinUrl: linkedinUrl,
          email: email,
          experiences: experiences,
          skills: window.skills,
          setupCompleted: true
        };

        // Delegate to ProfileManager if available
        if (window.ProfileManager) {
          window.ProfileManager.updateProfile(email, userData).then(result => {
            hideFormLoading();
            if (result.success) {
              // Show success message
              window.showSuccess('Profile saved successfully!');

              // If not in edit mode, close the tab after a delay
              if (!isEditMode) {
                setTimeout(() => {
                  window.close();
                }, 2000);
              }
            } else {
              console.error('Failed to save profile via ProfileManager:', result.error);
              window.showError(`Error saving profile: ${result.error}`);
            }
          }).catch(error => {
            hideFormLoading();
            console.error('Error saving profile via ProfileManager:', error);
            window.showError(`Error saving profile: ${error.message}`);
          });
        } else {
          // Fallback to direct Chrome storage
          chrome.storage.local.get([email], function(result) {
            hideFormLoading();
            const existingData = result[email] || {};

            // Merge with other existing data (like sent emails and templates)
            const mergedData = {
              ...existingData,
              ...userData
            };

            // Store the data
            const data = {};
            data[email] = mergedData;

            chrome.storage.local.set(data, function() {
              // Show success message
              window.showSuccess('Profile saved successfully!');

              // If not in edit mode, close the tab after a delay
              if (!isEditMode) {
                setTimeout(() => {
                  window.close();
                }, 2000);
              }
            });
          });
        }
      } catch (error) {
        hideFormLoading();
        console.error('Error saving profile:', error);
        const actionText = isEditMode ? 'updating' : 'saving';
        window.showError(`Error ${actionText} profile: ${error.message}`);
      }
    });
  }

  // Load existing data if in edit mode
  const urlParams = new URLSearchParams(window.location.search);
  let email = urlParams.get('email');
  const mode = urlParams.get('mode');
  const isEditMode = mode === 'edit';

  // Fallback to backend email if URL parameter is missing
  if (!email && window.BackendAPI?.userData?.email) {
    email = window.BackendAPI.userData.email;
    console.log('📧 Profile.js using fallback email from BackendAPI:', email);
  }

  if (isEditMode && email) {
    // Show loading state
    showProfileLoading();
    
    // Load profile with retry functionality
    loadProfileWithRetry(email, 3); // Allow up to 3 retries
  } else {
    // Add one empty experience card by default for new users
    window.experienceCount++;
    const card = createExperienceCard(window.experienceCount);
    experiencesContainer.appendChild(card);
  }

  // Profile loading function with retry capability
  async function loadProfileWithRetry(email, maxRetries = 3) {
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`[ProfileLoad] Attempt ${attempt}/${maxRetries} to load profile for ${email}`);
        
        // Try ProfileManager first if available
        if (window.ProfileManager) {
          const result = await window.ProfileManager.getProfile(email);
          
          if (result.success && result.profile) {
            console.log('[ProfileLoad] Successfully loaded profile from ProfileManager');
            hideProfileLoading();
            const userData = result.profile;
            loadProfileData(userData);
            return; // Success, exit function
          } else if (result.success && !result.profile) {
            // No profile exists yet - this is normal for new users
            console.log('[ProfileLoad] No profile found - showing empty form for new user');
            hideProfileLoading();
            addDefaultExperienceCard();
            return; // This is not an error, exit function
          } else if (result.error) {
            // Error occurred - check if we should retry
            console.error(`[ProfileLoad] Error loading profile (attempt ${attempt}): ${result.error}`);
            
            if (attempt < maxRetries && (
              result.error.includes('Backend request timeout') ||
              result.error.includes('Network error') ||
              result.error.includes('Backend failed')
            )) {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              continue; // Try again
            } else {
              // Don't retry or max retries reached
              hideProfileLoading();
              showProfileError(result.error, email);
              return;
            }
          }
        } else {
          // Fallback to direct Chrome storage
          console.log('[ProfileLoad] ProfileManager not available, using Chrome storage');
          const result = await new Promise((resolve) => {
            chrome.storage.local.get([email], function(result) {
              resolve(result);
            });
          });
          
          const userData = result[email];
          if (userData && userData.setupCompleted) {
            console.log('[ProfileLoad] Successfully loaded profile from Chrome storage');
            hideProfileLoading();
            loadProfileData(userData);
            return;
          } else {
            console.log('[ProfileLoad] No profile found in Chrome storage');
            hideProfileLoading();
            addDefaultExperienceCard();
            return;
          }
        }
      } catch (error) {
        console.error(`[ProfileLoad] Unexpected error on attempt ${attempt}:`, error);
        
        if (attempt >= maxRetries) {
          hideProfileLoading();
          showProfileError(`Failed to load profile after ${maxRetries} attempts: ${error.message}`, email);
          return;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // Show profile loading error with retry option
  function showProfileError(errorMessage, email) {
    const formContainer = document.getElementById('profileFormContainer');
    if (formContainer) {
      // Create error message container
      const errorContainer = document.createElement('div');
      errorContainer.className = 'profile-error-container';
      errorContainer.style.cssText = `
        text-align: center;
        padding: 40px 20px;
        background: #fff3f3;
        border: 1px solid #ffebee;
        border-radius: 8px;
        margin: 20px 0;
      `;
      
      errorContainer.innerHTML = `
        <div style="color: #d32f2f; font-size: 18px; font-weight: 600; margin-bottom: 12px;">
          Failed to Load Profile
        </div>
        <div style="color: #666; margin-bottom: 20px;">
          ${errorMessage}
        </div>
        <button id="retryProfileLoad" style="
          background: #1976d2;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          margin-right: 10px;
        ">
          Retry Loading
        </button>
        <button id="startFresh" style="
          background: #757575;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        ">
          Start Fresh
        </button>
      `;
      
      // Insert error container at the top of the form
      formContainer.insertBefore(errorContainer, formContainer.firstChild);
      
      // Add retry functionality
      document.getElementById('retryProfileLoad').addEventListener('click', () => {
        errorContainer.remove();
        showProfileLoading();
        loadProfileWithRetry(email, 3);
      });
      
      // Add start fresh functionality
      document.getElementById('startFresh').addEventListener('click', () => {
        errorContainer.remove();
        addDefaultExperienceCard();
        window.showSuccess('Started with a fresh profile. You can enter your information below.');
      });
    }
    
    // Also show notification
    window.showError(`Unable to load profile: ${errorMessage}`);
    
    // Add default experience card as fallback
    addDefaultExperienceCard();
  }

  // Helper function to add default experience card
  function addDefaultExperienceCard() {
    // Only add if no experience cards exist yet
    const existingCards = experiencesContainer.querySelectorAll('.experience-card');
    if (existingCards.length === 0) {
      window.experienceCount++;
      const card = createExperienceCard(window.experienceCount);
      experiencesContainer.appendChild(card);
    }
  }

  // Helper functions for loading state
  function showProfileLoading() {
    const loadingContainer = document.getElementById('profileLoadingContainer');
    const formContainer = document.getElementById('profileFormContainer');
    if (loadingContainer) loadingContainer.style.display = 'flex';
    if (formContainer) formContainer.style.display = 'none';
  }

  function hideProfileLoading() {
    const loadingContainer = document.getElementById('profileLoadingContainer');
    const formContainer = document.getElementById('profileFormContainer');
    if (loadingContainer) loadingContainer.style.display = 'none';
    if (formContainer) formContainer.style.display = 'block';
  }

  function showFormLoading() {
    const formContainer = document.getElementById('profileFormContainer');
    if (formContainer) {
      // Create overlay if it doesn't exist
      let overlay = formContainer.querySelector('.form-loading-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'form-loading-overlay';
        overlay.innerHTML = `
          <div class="loading-container" style="min-height: auto; padding: 24px;">
            <div class="loading-spinner"></div>
            <div class="loading-text">Saving profile...</div>
          </div>
        `;
        formContainer.appendChild(overlay);
      }
      overlay.style.display = 'flex';
    }
  }

  function hideFormLoading() {
    const formContainer = document.getElementById('profileFormContainer');
    if (formContainer) {
      const overlay = formContainer.querySelector('.form-loading-overlay');
      if (overlay) {
        overlay.style.display = 'none';
      }
    }
  }

  // Helper function to load profile data into the UI
  function loadProfileData(userData) {
    // Load basic profile information
    if (userData.firstName) {
      const firstNameInput = document.getElementById('firstName');
      if (firstNameInput) firstNameInput.value = userData.firstName;
    }
    
    if (userData.lastName) {
      const lastNameInput = document.getElementById('lastName');
      if (lastNameInput) lastNameInput.value = userData.lastName;
    }
    
    if (userData.linkedinUrl) {
      const linkedinUrlInput = document.getElementById('linkedinUrl');
      if (linkedinUrlInput) linkedinUrlInput.value = userData.linkedinUrl;
    }
    
    if (userData.college) {
      const collegeInput = document.getElementById('college');
      if (collegeInput) collegeInput.value = userData.college;
    }

    // Load experiences
    if (userData.experiences && Array.isArray(userData.experiences)) {
      userData.experiences.forEach((exp, index) => {
        window.experienceCount++;
        const card = createExperienceCard(window.experienceCount, exp);
        experiencesContainer.appendChild(card);
      });
      checkExperienceLimit();
    } else {
      // Add one empty experience card by default
      window.experienceCount++;
      const card = createExperienceCard(window.experienceCount);
      experiencesContainer.appendChild(card);
    }

    // Load skills
    if (userData.skills && Array.isArray(userData.skills)) {
      window.skills = [...userData.skills];

      // Create skill tags
      window.skills.forEach(skill => {
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
        document.getElementById('skillsTagsContainer').appendChild(tagElement);
      });

      updateSkillsDisplay();
    }
  }
});
