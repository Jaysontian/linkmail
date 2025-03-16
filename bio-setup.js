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
    pageTitle.textContent = 'Your LinkMail Profile';
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
  
  bioForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const college = document.getElementById('college').value;
    const gradYear = document.getElementById('gradYear').value;
    
    if (!name || !college || !gradYear) {
      showError('Please fill in all fields');
      return;
    }
    
    // Collect experiences data
    const experiences = collectExperiencesData();
    
    // Prepare user data
    const userData = {
      name: name,
      college: college,
      graduationYear: gradYear,
      email: email,
      experiences: experiences, // Add experiences array
      setupCompleted: true
    };
    
    try {
      // Get existing data to preserve sent emails
      chrome.storage.local.get([email], function(result) {
        const existingData = result[email] || {};
        
        // Merge new data with existing data
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
      const date = new Date(email.date).toLocaleString();
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
    const date = new Date(email.date).toLocaleString();
    
    let detailsHTML = `
      <div class="email-detail-header">
        <h3>Email to: ${escapeHtml(email.recipientName || email.recipientEmail)}</h3>
        <p><strong>Recipient:</strong> ${escapeHtml(email.recipientEmail)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(email.subject)}</p>
        <p><strong>Sent on:</strong> ${date}</p>
        ${email.linkedInUrl ? `<p><strong>LinkedIn Profile:</strong> <a href="${escapeHtml(email.linkedInUrl)}" target="_blank">View Profile</a></p>` : ''}
      </div>
      <h4>Email Content:</h4>
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
      if (userData && userData.experiences && Array.isArray(userData.experiences)) {
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
    });
  } else {
    // Add one empty experience card by default for new users
    experienceCount++;
    const card = createExperienceCard(experienceCount);
    experiencesContainer.appendChild(card);
  }
});