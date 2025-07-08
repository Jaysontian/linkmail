console.log('Email History module loaded');

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

function loadEmailHistory(userData, searchTerm = '') {
  const emailList = document.getElementById('emailList');
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
    const date = formatDate(email.date);
    const attachmentIndicator = email.attachments && email.attachments.length > 0 ?
      `<span class="email-attachment-indicator" title="${email.attachments.length} attachment${email.attachments.length > 1 ? 's' : ''}">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.47"/>
        </svg>
      </span>` : '';

    emailListHTML += `
      <div class="email-item" data-index="${index}">
        <div class="email-recipient">
          ${escapeHtml(email.recipientName || email.recipientEmail)}
          ${attachmentIndicator}
        </div>
        <div class="email-subject">${escapeHtml(email.subject)}</div>
        <div class="email-date">${date}</div>
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
  const emailModal = document.getElementById('emailModal');
  const emailDetail = document.getElementById('emailDetail');
  const date = formatDate(email.date);

  let attachmentsHtml = '';
  if (email.attachments && email.attachments.length > 0) {
    const attachmentsList = email.attachments.map(att => {
      return `<div class="email-detail-attachment">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span>${escapeHtml(att.name)}</span>
      </div>`;
    }).join('');

    attachmentsHtml = `
      <div class="email-detail-attachments">
        <h4>Attachments</h4>
        <div class="email-attachments-list">
          ${attachmentsList}
        </div>
      </div>
    `;
  }

  // Get initials for avatar
  const initials = email.recipientName
    ? email.recipientName.split(' ').map(n => n[0]).join('').toUpperCase()
    : email.recipientEmail[0].toUpperCase();

  let detailsHTML = `
    <div class="email-detail-header">
      <div class="header-top">
        <h2 class="header-title">Coffee chat request</h2>
        <div class="header-date">${date}</div>
      </div>
      
      <div class="recipient-info">
        <div class="recipient-avatar">${initials}</div>
        <div class="recipient-details">
          <div class="recipient-name">${escapeHtml(email.recipientName)}</div>
          <div class="recipient-email">${escapeHtml(email.recipientEmail)}</div>
        </div>
      </div>
      
      ${email.linkedInUrl ? `
        <a href="${escapeHtml(email.linkedInUrl)}" target="_blank" class="linkedin-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
            <rect x="2" y="9" width="4" height="12"/>
            <circle cx="4" cy="4" r="2"/>
          </svg>
          View LinkedIn
        </a>
      ` : ''}
    </div>

    ${attachmentsHtml}
    
    <div class="email-detail-body">${escapeHtml(email.content)}</div>
  `;

  emailDetail.innerHTML = detailsHTML;
  emailModal.style.display = 'block';
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

// Helper function to display email history using either method
function displayEmailHistory(emails, searchTerm = '') {
  // Create userData-like object for compatibility with existing loadEmailHistory function
  const userData = { sentEmails: emails };
  loadEmailHistory(userData, searchTerm);
}

// Initialize email history functionality
document.addEventListener('DOMContentLoaded', function() {
  const emailSearch = document.getElementById('emailSearch');
  const emailModal = document.getElementById('emailModal');
  const closeModal = document.getElementById('closeModal');

  // Load initial email history
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get('email');
  
  if (email) {
    // Delegate to EmailHistory module if available
    if (window.EmailHistory) {
      window.EmailHistory.loadHistory(email).then(result => {
        if (result.success) {
          displayEmailHistory(result.emails);
        } else {
          console.log('No email history found via EmailHistory');
          displayEmailHistory([]);
        }
      }).catch(error => {
        console.error('Error loading email history via EmailHistory:', error);
        displayEmailHistory([]);
      });
    } else {
      // Fallback to direct Chrome storage
      chrome.storage.local.get([email], function(result) {
        const userData = result[email];
        if (userData) {
          loadEmailHistory(userData);
        } else {
          displayEmailHistory([]);
        }
      });
    }
  }

  // Email search functionality
  if (emailSearch) {
    emailSearch.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      const urlParams = new URLSearchParams(window.location.search);
      const email = urlParams.get('email');

      // Delegate to EmailHistory module if available
      if (window.EmailHistory) {
        window.EmailHistory.searchHistory(email, searchTerm).then(result => {
          if (result.success) {
            displayEmailHistory(result.emails, searchTerm);
          } else {
            console.error('Error searching email history via EmailHistory:', result.error);
            displayEmailHistory([], searchTerm);
          }
        }).catch(error => {
          console.error('Error searching email history via EmailHistory:', error);
          displayEmailHistory([], searchTerm);
        });
      } else {
        // Fallback to direct Chrome storage
        chrome.storage.local.get([email], function(result) {
          const userData = result[email];
          if (userData) {
            loadEmailHistory(userData, searchTerm);
          }
        });
      }
    });
  }

  // Close modal
  if (closeModal) {
    closeModal.addEventListener('click', function() {
      emailModal.style.display = 'none';
    });
  }

  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === emailModal) {
      emailModal.style.display = 'none';
    }
  });
});
