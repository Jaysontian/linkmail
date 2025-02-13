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
    composeButton.addEventListener('click', () => {
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
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
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
