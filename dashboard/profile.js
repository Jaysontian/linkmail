console.log('Profile module loaded');

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

      const name = document.getElementById('name').value;
      const college = document.getElementById('college').value;
      const gradYear = document.getElementById('gradYear').value;

      if (!name || !college || !gradYear) {
        window.showError('Please fill in all required fields');
        return;
      }

      try {
        // Collect experiences data
        const experiences = collectExperiencesData();

        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const email = urlParams.get('email');
        const mode = urlParams.get('mode');
        const isEditMode = mode === 'edit';

        // Get existing user data first to ensure we don't lose templates
        chrome.storage.local.get([email], function(result) {
          const existingData = result[email] || {};

          // Prepare user data
          const userData = {
            name: name,
            college: college,
            graduationYear: gradYear,
            email: email,
            experiences: experiences,
            skills: window.skills,
            setupCompleted: true
          };

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
    chrome.storage.local.get([email], function(result) {
      const userData = result[email];
      if (userData) {
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
  } else {
    // Add one empty experience card by default for new users
    window.experienceCount++;
    const card = createExperienceCard(window.experienceCount);
    experiencesContainer.appendChild(card);
  }
});
