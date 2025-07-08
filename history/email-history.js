// Email History Manager Module
// Handles all email history operations including saving, loading, searching, and displaying

window.EmailHistory = (function() {
  'use strict';

  // History operations
  const operations = {
    // Save a new email to history
    async saveEmail(userEmail, emailData) {
      if (!userEmail || !emailData) {
        console.error('User email and email data are required');
        return { success: false, error: 'Missing required parameters' };
      }

      // Validate email data
      if (!emailData.recipientEmail || !emailData.subject || !emailData.content) {
        return { success: false, error: 'Email data is incomplete' };
      }

      return new Promise((resolve) => {
        try {
          chrome.storage.local.get([userEmail], function(result) {
            if (chrome.runtime.lastError) {
              console.error('Error getting user data for email save:', chrome.runtime.lastError);
              resolve({ success: false, error: 'Storage error' });
              return;
            }

            const userData = result[userEmail] || {};
            userData.sentEmails = userData.sentEmails || [];

            // Create email record with timestamp and metadata
            const emailRecord = {
              recipientEmail: emailData.recipientEmail,
              recipientName: emailData.recipientName || emailData.recipientEmail,
              subject: emailData.subject,
              content: emailData.content,
              date: emailData.date || new Date().toISOString(),
              linkedInUrl: emailData.linkedInUrl || window.location.href,
              attachments: emailData.attachments ? emailData.attachments.map(a => ({
                name: a.name,
                type: a.type,
                size: a.size
                // Note: We only store metadata, not the actual file data for history
              })) : []
            };

            // Add to sent emails array
            userData.sentEmails.push(emailRecord);

            // Save back to storage
            const data = {};
            data[userEmail] = userData;

            chrome.storage.local.set(data, function() {
              if (chrome.runtime.lastError) {
                console.error('Error saving email to history:', chrome.runtime.lastError);
                resolve({ success: false, error: 'Failed to save email' });
                return;
              }

              console.log('Email saved to history successfully');
              resolve({ success: true, emailRecord });
            });
          });
        } catch (error) {
          console.error('Error in saveEmail:', error);
          resolve({ success: false, error: error.message });
        }
      });
    },

    // Load email history for a user
    async loadHistory(userEmail) {
      if (!userEmail) {
        console.error('User email is required to load history');
        return { success: false, error: 'User email is required', emails: [] };
      }

      return new Promise((resolve) => {
        try {
          chrome.storage.local.get([userEmail], function(result) {
            if (chrome.runtime.lastError) {
              console.error('Error loading email history:', chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message, emails: [] });
              return;
            }

            const userData = result[userEmail];
            const sentEmails = userData?.sentEmails || [];

            console.log(`Loaded ${sentEmails.length} emails from history for ${userEmail}`);
            resolve({ success: true, emails: sentEmails });
          });
        } catch (error) {
          console.error('Error in loadHistory:', error);
          resolve({ success: false, error: error.message, emails: [] });
        }
      });
    },

    // Search/filter email history  
    async searchHistory(userEmail, searchTerm) {
      if (!userEmail) {
        console.error('User email is required');
        return { success: false, error: 'User email is required', emails: [] };
      }

      try {
        const historyResult = await operations.loadHistory(userEmail);
        if (!historyResult.success) {
          return historyResult; // Return the error from loadHistory
        }

        const emails = historyResult.emails;
        
        if (!searchTerm || !searchTerm.trim()) {
          return { success: true, emails: emails };
        }

        const term = searchTerm.toLowerCase().trim();
        
        const filteredEmails = emails.filter(email =>
          (email.recipientName && email.recipientName.toLowerCase().includes(term)) ||
          (email.recipientEmail && email.recipientEmail.toLowerCase().includes(term)) ||
          (email.subject && email.subject.toLowerCase().includes(term)) ||
          (email.content && email.content.toLowerCase().includes(term))
        );

        return { success: true, emails: filteredEmails };
      } catch (error) {
        console.error('Error in searchHistory:', error);
        return { success: false, error: error.message, emails: [] };
      }
    },

    // Get emails sent to a specific profile
    getEmailsToProfile(emails, profileUrl, profileName = null) {
      if (!profileUrl && !profileName) {
        return [];
      }

      let emailsToProfile = [];

      // First try to match by URL
      if (profileUrl) {
        emailsToProfile = emails.filter(email => {
          if (!email.linkedInUrl) return false;
          
          // Exact match
          if (email.linkedInUrl === profileUrl) return true;
          
          // Handle slight URL variations (trailing slashes, etc)
          if (email.linkedInUrl.replace(/\/$/, '') === profileUrl.replace(/\/$/, '')) return true;
          
          // Remove any query parameters for comparison
          if (email.linkedInUrl.split('?')[0] === profileUrl.split('?')[0]) return true;
          
          return false;
        });
      }

      // If no URL matches and we have a name, try name matching as fallback
      if (emailsToProfile.length === 0 && profileName) {
        emailsToProfile = emails.filter(email =>
          email.recipientName && email.recipientName.trim() === profileName.trim()
        );
      }

      return emailsToProfile;
    },

    // Get the most recent email to a profile
    getLastEmailToProfile(emails, profileUrl, profileName = null) {
      const emailsToProfile = operations.getEmailsToProfile(emails, profileUrl, profileName);
      
      if (emailsToProfile.length === 0) {
        return null;
      }

      // Sort by date, newest first
      emailsToProfile.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      return emailsToProfile[0];
    },

    // Delete an email from history (by index in sorted list)
    async deleteEmail(userEmail, emailToDelete) {
      if (!userEmail || !emailToDelete) {
        console.error('User email and email data are required');
        return { success: false, error: 'Missing required parameters' };
      }

      return new Promise((resolve) => {
        try {
          chrome.storage.local.get([userEmail], function(result) {
            if (chrome.runtime.lastError) {
              console.error('Error getting user data for email delete:', chrome.runtime.lastError);
              resolve({ success: false, error: 'Storage error' });
              return;
            }

            const userData = result[userEmail] || {};
            const sentEmails = userData.sentEmails || [];

            // Find the email to delete (match by date and recipient)
            const emailIndex = sentEmails.findIndex(email =>
              email.date === emailToDelete.date &&
              email.recipientEmail === emailToDelete.recipientEmail &&
              email.subject === emailToDelete.subject
            );

            if (emailIndex === -1) {
              resolve({ success: false, error: 'Email not found' });
              return;
            }

            // Remove the email
            const deletedEmail = sentEmails.splice(emailIndex, 1)[0];

            // Save back to storage
            const data = {};
            data[userEmail] = userData;

            chrome.storage.local.set(data, function() {
              if (chrome.runtime.lastError) {
                console.error('Error deleting email from history:', chrome.runtime.lastError);
                resolve({ success: false, error: 'Failed to delete email' });
                return;
              }

              console.log('Email deleted from history successfully');
              resolve({ success: true, deletedEmail });
            });
          });
        } catch (error) {
          console.error('Error in deleteEmail:', error);
          resolve({ success: false, error: error.message });
        }
      });
    },

    // Get history statistics
    getHistoryStats(emails) {
      const stats = {
        totalEmails: emails.length,
        uniqueRecipients: new Set(emails.map(e => e.recipientEmail)).size,
        emailsThisWeek: 0,
        emailsThisMonth: 0,
        mostRecentDate: null,
        oldestDate: null
      };

      if (emails.length === 0) {
        return stats;
      }

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      let mostRecent = new Date(emails[0].date);
      let oldest = new Date(emails[0].date);

      emails.forEach(email => {
        const emailDate = new Date(email.date);
        
        if (emailDate > oneWeekAgo) {
          stats.emailsThisWeek++;
        }
        
        if (emailDate > oneMonthAgo) {
          stats.emailsThisMonth++;
        }

        if (emailDate > mostRecent) {
          mostRecent = emailDate;
        }

        if (emailDate < oldest) {
          oldest = emailDate;
        }
      });

      stats.mostRecentDate = mostRecent;
      stats.oldestDate = oldest;

      return stats;
    }
  };

  // Date formatting utilities
  const dateUtils = {
    formatDate(emailDate) {
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
    },

    formatShortDate(emailDate) {
      const emailDateTime = new Date(emailDate);
      return emailDateTime.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    },

    getRelativeTime(emailDate) {
      const now = new Date();
      const emailDateTime = new Date(emailDate);
      const diffMs = now - emailDateTime;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
      } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? 's' : ''} ago`;
      } else {
        const years = Math.floor(diffDays / 365);
        return `${years} year${years > 1 ? 's' : ''} ago`;
      }
    }
  };

  // UI utilities for displaying history
  const uiUtils = {
    // Escape HTML to prevent XSS
    escapeHtml(unsafe) {
      if (!unsafe) return '';
      return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    // Generate HTML for email list
    generateEmailListHTML(emails) {
      if (!emails || emails.length === 0) {
        return '<div class="no-emails">No emails found</div>';
      }

      // Sort by date, newest first
      const sortedEmails = [...emails].sort((a, b) => new Date(b.date) - new Date(a.date));

      let emailListHTML = '';

      sortedEmails.forEach((email, index) => {
        const date = dateUtils.formatDate(email.date);
        const attachmentIndicator = email.attachments && email.attachments.length > 0 ?
          `<span class="email-attachment-indicator" title="${email.attachments.length} attachment${email.attachments.length > 1 ? 's' : ''}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.47"/>
            </svg>
          </span>` : '';

        emailListHTML += `
          <div class="email-item" data-index="${index}">
            <div class="email-recipient">
              ${uiUtils.escapeHtml(email.recipientName || email.recipientEmail)}
              ${attachmentIndicator}
            </div>
            <div class="email-subject">${uiUtils.escapeHtml(email.subject)}</div>
            <div class="email-date">${date}</div>
          </div>
        `;
      });

      return emailListHTML;
    },

    // Generate HTML for email details modal
    generateEmailDetailHTML(email) {
      const date = dateUtils.formatDate(email.date);

      let attachmentsHtml = '';
      if (email.attachments && email.attachments.length > 0) {
        const attachmentsList = email.attachments.map(att => {
          return `<div class="email-detail-attachment">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span>${uiUtils.escapeHtml(att.name)}</span>
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

      return `
        <div class="email-detail-header">
          <div class="header-top">
            <h2 class="header-title">Email Details</h2>
            <div class="header-date">${date}</div>
          </div>
          
          <div class="recipient-info">
            <div class="recipient-avatar">${initials}</div>
            <div class="recipient-details">
              <div class="recipient-name">${uiUtils.escapeHtml(email.recipientName)}</div>
              <div class="recipient-email">${uiUtils.escapeHtml(email.recipientEmail)}</div>
            </div>
          </div>
          
          <div class="email-subject-display">
            <strong>Subject:</strong> ${uiUtils.escapeHtml(email.subject)}
          </div>
          
          ${email.linkedInUrl ? `
            <a href="${uiUtils.escapeHtml(email.linkedInUrl)}" target="_blank" class="linkedin-button">
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
        
        <div class="email-detail-body">${uiUtils.escapeHtml(email.content)}</div>
      `;
    }
  };

  // Event system for history changes
  const eventListeners = {
    'email-saved': [],
    'email-deleted': [],
    'history-loaded': []
  };

  function triggerEvent(eventName, data) {
    if (eventListeners[eventName]) {
      eventListeners[eventName].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in email history event listener:', error);
        }
      });
    }
  }

  // Public API
  return {
    // Core operations
    saveEmail: operations.saveEmail,
    loadHistory: operations.loadHistory,
    searchHistory: operations.searchHistory,
    getEmailsToProfile: operations.getEmailsToProfile,
    getLastEmailToProfile: operations.getLastEmailToProfile,
    deleteEmail: operations.deleteEmail,
    getHistoryStats: operations.getHistoryStats,

    // Date utilities
    formatDate: dateUtils.formatDate,
    formatShortDate: dateUtils.formatShortDate,
    getRelativeTime: dateUtils.getRelativeTime,

    // UI utilities
    escapeHtml: uiUtils.escapeHtml,
    generateEmailListHTML: uiUtils.generateEmailListHTML,
    generateEmailDetailHTML: uiUtils.generateEmailDetailHTML,

    // Event system
    addEventListener(eventName, callback) {
      if (eventListeners[eventName]) {
        eventListeners[eventName].push(callback);
      }
    },

    removeEventListener(eventName, callback) {
      if (eventListeners[eventName]) {
        const index = eventListeners[eventName].indexOf(callback);
        if (index > -1) {
          eventListeners[eventName].splice(index, 1);
        }
      }
    },

    // Enhanced operations with events
    async saveEmailWithEvents(userEmail, emailData) {
      const result = await operations.saveEmail(userEmail, emailData);
      if (result.success) {
        triggerEvent('email-saved', result);
      }
      return result;
    },

    async deleteEmailWithEvents(userEmail, emailToDelete) {
      const result = await operations.deleteEmail(userEmail, emailToDelete);
      if (result.success) {
        triggerEvent('email-deleted', result);
      }
      return result;
    },

    async loadHistoryWithEvents(userEmail) {
      const emails = await operations.loadHistory(userEmail);
      triggerEvent('history-loaded', { emails, userEmail });
      return emails;
    }
  };
})();

// Legacy compatibility - export formatDate function globally
if (typeof window !== 'undefined') {
  window.formatDate = window.EmailHistory.formatDate;
} 