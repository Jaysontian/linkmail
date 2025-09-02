
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
        // Experiences already collected and validated above

        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const email = urlParams.get('email');
        const mode = urlParams.get('mode');
        const isEditMode = mode === 'edit';

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
            console.error('Error saving profile via ProfileManager:', error);
            window.showError(`Error saving profile: ${error.message}`);
          });
        } else {
          // Fallback to direct Chrome storage
          chrome.storage.local.get([email], function(result) {
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
        console.error('Error saving profile:', error);
        const actionText = isEditMode ? 'updating' : 'saving';
        window.showError(`Error ${actionText} profile: ${error.message}`);
      }
    });
  }

  // Load existing data if in edit mode
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get('email');
  const mode = urlParams.get('mode');
  const isEditMode = mode === 'edit';

  if (isEditMode && email) {
    // Delegate to ProfileManager if available
    if (window.ProfileManager) {
      window.ProfileManager.getProfile(email).then(result => {
        if (result.success && result.profile) {
          const userData = result.profile;
          loadProfileData(userData);
        } else {
          // Add one empty experience card by default
          window.experienceCount++;
          const card = createExperienceCard(window.experienceCount);
          experiencesContainer.appendChild(card);
        }
      }).catch(error => {
        console.error('Error loading profile via ProfileManager:', error);
        // Add one empty experience card by default on error
        window.experienceCount++;
        const card = createExperienceCard(window.experienceCount);
        experiencesContainer.appendChild(card);
      });
    } else {
      // Fallback to direct Chrome storage
      chrome.storage.local.get([email], function(result) {
        const userData = result[email];
        if (userData) {
          loadProfileData(userData);
        } else {
          // Add one empty experience card by default
          window.experienceCount++;
          const card = createExperienceCard(window.experienceCount);
          experiencesContainer.appendChild(card);
        }
      });
    }
  } else {
    // Add one empty experience card by default for new users
    window.experienceCount++;
    const card = createExperienceCard(window.experienceCount);
    experiencesContainer.appendChild(card);
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
