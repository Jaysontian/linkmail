// popup/popup.js
let currentToken = null;


document.addEventListener("DOMContentLoaded", function() {
  // Attach event listeners only to the elements that exist in popup.html
  const loginButton = document.getElementById('loginButton');
  const logoutButton = document.getElementById('logoutButton');
  const composeButton = document.getElementById('composeButton');
  const sendEmailButton = document.getElementById('sendEmail');
  const cancelComposeButton = document.getElementById('cancelCompose');
  const composeForm = document.getElementById('composeForm');

  if (loginButton) {
    loginButton.addEventListener('click', signIn);
  }
  if (logoutButton) {
    logoutButton.addEventListener('click', signOut);
  }
  if (composeButton) {
    composeButton.addEventListener('click', async () => {
      // Query for the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Only proceed with email search if we're on a LinkedIn page
      if (tab.url.includes('linkedin.com')) {
        chrome.tabs.sendMessage(tab.id, { action: "findEmail" }, response => {
          if (response.email) {
            document.getElementById('recipientEmail').value = response.email;
          } else if (response.error) {
            alert(response.error);
          }
        });
      }
      
      composeForm.style.display = 'block';
      composeButton.style.display = 'none';
    });
  }
  if (cancelComposeButton) {
    cancelComposeButton.addEventListener('click', () => {
      composeForm.style.display = 'none';
      composeButton.style.display = 'block';
      clearComposeForm();
    });
  }
  if (sendEmailButton) {
    sendEmailButton.addEventListener('click', sendEmail);
  }

  // Check if user is already signed in
  chrome.identity.getAuthToken({ interactive: false }, function(token) {
    if (token) {
      currentToken = token;
      getUserInfo(token);
    }
  });
});

function signIn() {
  chrome.identity.getAuthToken({ interactive: true }, function(token) {
    console.log('Logging in with token: ', token);
    if (chrome.runtime.lastError) {
      console.error("THERE IS AN ERROR W SIGNING: ", chrome.runtime.lastError);
      return;
    }
    currentToken = token;
    getUserInfo(token);
  });
}

function getUserInfo(token) {
  // Fetch user profile from Gmail API
  fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(response => response.json())
    .then(data => {
      document.getElementById('loginContainer').style.display = 'none';
      document.getElementById('userContainer').style.display = 'block';
      document.getElementById('userEmail').textContent = data.emailAddress;
    })
    .catch(error => console.error('Error:', error));
}

function signOut() {
  if (!currentToken) return;
  // Revoke the token
  fetch(`https://accounts.google.com/o/oauth2/revoke?token=${currentToken}`)
    .then(() => {
      chrome.identity.removeCachedAuthToken({ token: currentToken }, function() {
        currentToken = null;
        document.getElementById('loginContainer').style.display = 'block';
        document.getElementById('userContainer').style.display = 'none';
      });
    });
}

function clearComposeForm() {
  document.getElementById('recipientEmail').value = '';
  document.getElementById('emailSubject').value = '';
  document.getElementById('emailBody').value = '';
}







// Add this at the top of the file, after the DOMContentLoaded listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendEmail') {
    const { to, subject, body } = request.data;
    
    // Set the form values
    document.getElementById('recipientEmail').value = to;
    document.getElementById('emailSubject').value = subject;
    document.getElementById('emailBody').value = body;
    
    // Show the compose form
    document.getElementById('composeForm').style.display = 'block';
    document.getElementById('composeButton').style.display = 'none';
    
    // Optionally, automatically send the email
    if (currentToken) {
      sendEmail();
    } else {
      // If not logged in, show login prompt
      alert('Please log in to Gmail first');
      document.getElementById('loginContainer').style.display = 'block';
    }
  }
});




function sendEmail() {
  if (!currentToken) return;

  const recipientEmail = document.getElementById('recipientEmail').value;
  const subject = document.getElementById('emailSubject').value;
  const body = document.getElementById('emailBody').value;

  if (!recipientEmail || !subject || !body) {
    alert('Please fill in all fields');
    return;
  }

  const message = {
    raw: createEmail({
      to: recipientEmail,
      subject: subject,
      message: body
    })
  };

  fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + currentToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(message)
  })
    .then(response => response.json())
    .then(data => {
      alert('Email sent successfully!');
      clearComposeForm();
      document.getElementById('composeForm').style.display = 'none';
      document.getElementById('composeButton').style.display = 'block';
    })
    .catch(error => {
      console.error('Error:', error);
      alert('Failed to send email');
    });
}

function createEmail({ to, subject, message }) {
  const email = [
    'Content-Type: text/plain; charset="UTF-8"\n',
    'MIME-Version: 1.0\n',
    'Content-Transfer-Encoding: 7bit\n',
    'to: ', to, '\n',
    'subject: ', subject, '\n\n',
    message
  ].join('');

  return btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
