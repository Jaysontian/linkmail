//bio-setup.js
document.addEventListener('DOMContentLoaded', function() {
  const bioForm = document.getElementById('bioForm');
  const messageElement = document.getElementById('message');
  const pageTitle = document.getElementById('pageTitle');
  const submitButton = document.getElementById('submitButton');
  
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
    pageTitle.textContent = 'Edit Your LinkMail Profile';
    submitButton.textContent = 'Save Changes';
    
    // Load existing data
    chrome.storage.local.get([email], function(result) {
      const userData = result[email];
      if (userData) {
        document.getElementById('name').value = userData.name || '';
        document.getElementById('college').value = userData.college || '';
        document.getElementById('gradYear').value = userData.graduationYear || '';
      }
    });
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
    
    // Prepare user data
    const userData = {
      name: name,
      college: college,
      graduationYear: gradYear,
      email: email,
      setupCompleted: true
    };
    
    try {
      // Store the data
      const data = {};
      data[email] = userData;
      
      await chrome.storage.local.set(data);
      
      // Show success message
      bioForm.style.display = 'none';
      const successMessage = isEditMode ? 
        'Profile updated successfully! You can now return to LinkedIn.' : 
        'Profile saved successfully! You can now return to LinkedIn.';
      showSuccess(successMessage);
      
      // Close this tab and return to LinkedIn after a short delay
      setTimeout(() => {
        window.close();
      }, 3000);
      
    } catch (error) {
      const actionText = isEditMode ? 'updating' : 'saving';
      showError(`Error ${actionText} profile: ${error.message}`);
    }
  });
  
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
});
