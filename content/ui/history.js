// content/ui/history.js
// Attach email history utilities to window.UIManager

(function attachHistory(){
  if (!window) return;
  window.UIManager = window.UIManager || {};

  window.UIManager.setupEmailHistoryRefresh = function setupEmailHistoryRefresh() {
    const refreshInterval = setInterval(() => {
      if (this.isAuthenticated && this.userData) {
        this.checkLastEmailSent();
        clearInterval(refreshInterval);
      }
    }, 2000);
    setTimeout(() => { clearInterval(refreshInterval); }, 10000);
  };

  window.UIManager.checkLastEmailSent = async function checkLastEmailSent() {
    try {
      console.log('Checking last email sent...');
      const currentProfileUrl = window.location.href;
      const isOnProfilePage = currentProfileUrl.includes('/in/');
      const isOnFeedPage = currentProfileUrl.includes('/feed/');
      if (!isOnProfilePage && !isOnFeedPage) { console.log('Not on a supported LinkedIn page, skipping email status check'); return; }
      const pageType = window.currentPageType || 'other-profile';
      if (pageType !== 'other-profile') { console.log('On feed page or own profile, skipping profile-specific email status check'); return; }
      if (!this.container) { console.log('UI container not initialized, skipping email status check'); return; }
      const lastEmailStatus = this.container.querySelector('#lastEmailStatus');
      if (!lastEmailStatus) { console.log('Last email status element not found in container, UI may not be fully initialized'); return; }
      const profileName = document.querySelector('h1')?.innerText || '';
      lastEmailStatus.style.display = 'none';
      if (!this.isAuthenticated || !this.userData || !this.userData.email) {
        console.log('Not authenticated or missing user data, checking auth status first...');
        await this.checkAuthStatus();
        if (!this.isAuthenticated || !this.userData) { console.log('Still not authenticated after check, returning'); return; }
      }
      console.log('User authenticated, email:', this.userData.email);
      try {
        if (!chrome.runtime?.id) { console.log('Extension context invalidated, cannot check last email sent'); return; }
        chrome.storage.local.get([this.userData.email], (result) => {
          if (chrome.runtime.lastError) { console.log('Chrome storage error:', chrome.runtime.lastError); return; }
          const storedUserData = result[this.userData.email];
          if (!storedUserData || !storedUserData.sentEmails || !storedUserData.sentEmails.length) { console.log('No sent emails found in storage'); return; }
          console.log(`Found ${storedUserData.sentEmails.length} sent emails in storage`);
          let emailsToThisProfile = storedUserData.sentEmails.filter(email =>
            email.linkedInUrl && (
              email.linkedInUrl === currentProfileUrl ||
              email.linkedInUrl.replace(/\/$/, '') === currentProfileUrl.replace(/\/$/, '') ||
              email.linkedInUrl.split('?')[0] === currentProfileUrl.split('?')[0]
            )
          );
          if (emailsToThisProfile.length === 0 && profileName) {
            console.log('No URL match, trying name match with:', profileName);
            emailsToThisProfile = storedUserData.sentEmails.filter(email => email.recipientName && email.recipientName.trim() === profileName.trim());
          }
          console.log(`Found ${emailsToThisProfile.length} emails to this profile`);
          if (emailsToThisProfile.length > 0) {
            emailsToThisProfile.sort((a, b) => new Date(b.date) - new Date(a.date));
            const lastEmailDate = new Date(emailsToThisProfile[0].date);
            const formattedDate = lastEmailDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            lastEmailStatus.textContent = `Last Sent on ${formattedDate}`;
            lastEmailStatus.style.display = 'block';
            console.log('Updated status with last email date:', formattedDate);
          }
        });
      } catch (error) {
        console.log('Error accessing chrome storage for last email check:', error);
      }
    } catch (error) {
      console.error('Error checking last email sent:', error);
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}


