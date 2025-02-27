//bio-setup.js
document.addEventListener('DOMContentLoaded', function() {
    const bioForm = document.getElementById('bioForm');
    const messageElement = document.getElementById('message');
    
    // Get email from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');
    
    if (!email) {
      showError('Email parameter is missing. Please try again.');
      bioForm.style.display = 'none';
      return;
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
      
      // Save user data to Chrome storage
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
        showSuccess('Profile saved successfully! You can now return to LinkedIn.');
        
        // Close this tab and return to LinkedIn after a short delay
        setTimeout(() => {
          window.close();
        }, 3000);
        
      } catch (error) {
        showError('Error saving profile: ' + error.message);
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
  