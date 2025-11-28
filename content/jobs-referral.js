// jobs-referral.js
// Handles the "Get Referred" feature on LinkedIn Jobs pages
// Detects job listings, finds company contacts in our database, and shows referral options

(function() {
  'use strict';

  // Track the current job ID to avoid duplicate processing
  let currentJobId = null;
  let referralButtonInjected = false;
  let referralPopupVisible = false;
  let loadingSkeletonInjected = false;
  let isCheckingContacts = false;

  // Check if we're on a LinkedIn jobs page
  function isLinkedInJobsPage() {
    const url = window.location.href;
    return url.includes('linkedin.com/jobs/');
  }

  // Extract job ID from URL
  function getJobIdFromUrl() {
    const url = window.location.href;
    const match = url.match(/currentJobId=(\d+)/);
    return match ? match[1] : null;
  }

  // Extract company name from the job listing page
  function getCompanyNameFromJobListing() {
    // Try multiple selectors for the company name on LinkedIn job pages
    const selectors = [
      // Job detail view - company link
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      // Alternative selectors
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      '.topcard__org-name-link',
      '.topcard__org-name',
      // Job card in list view
      '.job-card-container__primary-description',
      '.jobs-details-top-card__company-url',
      // Fallback selectors
      '[data-tracking-control-name="public_jobs_topcard-org-name"]',
      '.jobs-company__name',
      // New job page layout
      '.job-details-jobs-unified-top-card__primary-description-container a'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        if (text && text.length > 0) {
          // Clean up the company name (remove extra whitespace, newlines)
          return text.replace(/\s+/g, ' ').trim();
        }
      }
    }

    return null;
  }

  // Find the Save button container to inject our button next to it
  function findSaveButtonContainer() {
    // Look for the Save button on the job details page
    const selectors = [
      // Primary Save button container
      '.jobs-save-button',
      '[data-control-name="save"]',
      'button[aria-label*="Save"]',
      // Alternative: the actions container
      '.job-details-jobs-unified-top-card__actions',
      '.jobs-unified-top-card__actions',
      '.jobs-details-top-card__actions-container'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }

    return null;
  }

  // Create a loading skeleton button
  function createLoadingSkeleton() {
    const button = document.createElement('button');
    button.id = 'linkmail-get-referred-skeleton';
    button.className = 'linkmail-referral-btn linkmail-referral-btn-loading';
    button.disabled = true;
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="linkmail-spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <span>Checking contacts...</span>
    `;
    return button;
  }

  // Inject loading skeleton into the page
  function injectLoadingSkeleton() {
    // Don't inject if already present or if actual button is present
    if (loadingSkeletonInjected || referralButtonInjected) {
      return;
    }

    const skeleton = createLoadingSkeleton();
    const saveButtonContainer = findSaveButtonContainer();
    
    if (saveButtonContainer) {
      saveButtonContainer.insertAdjacentElement('afterend', skeleton);
      loadingSkeletonInjected = true;
    } else {
      const actionsArea = document.querySelector('.job-details-jobs-unified-top-card__container--two-pane');
      if (actionsArea) {
        actionsArea.appendChild(skeleton);
        loadingSkeletonInjected = true;
      }
    }
  }

  // Remove loading skeleton
  function removeLoadingSkeleton() {
    const skeleton = document.getElementById('linkmail-get-referred-skeleton');
    if (skeleton) {
      skeleton.remove();
    }
    loadingSkeletonInjected = false;
  }

  // Create the "Get Referred" button
  function createReferralButton(companyName, contacts) {
    const button = document.createElement('button');
    button.id = 'linkmail-get-referred-btn';
    button.className = 'linkmail-referral-btn';
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      <span>Get Referred (${contacts.length})</span>
    `;
    
    button.title = `${contacts.length} contact${contacts.length > 1 ? 's' : ''} at ${companyName}`;
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showReferralPopup(companyName, contacts);
    });

    return button;
  }

  // Create the referral popup showing contacts
  function createReferralPopup(companyName, contacts) {
    const popup = document.createElement('div');
    popup.id = 'linkmail-referral-popup';
    popup.className = 'linkmail-referral-popup';
    
    const contactsHtml = contacts.map(contact => {
      const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
      const jobTitle = contact.jobTitle || 'Employee';
      const linkedinUrl = contact.linkedinUrl || '#';
      
      return `
        <a href="${linkedinUrl}" target="_blank" rel="noopener noreferrer" class="linkmail-referral-contact">
          <div class="linkmail-referral-contact-avatar">
            ${(contact.firstName || 'U').charAt(0).toUpperCase()}
          </div>
          <div class="linkmail-referral-contact-info">
            <div class="linkmail-referral-contact-name">${fullName || 'Unknown'}</div>
            <div class="linkmail-referral-contact-title">${jobTitle}</div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="linkmail-referral-contact-arrow">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      `;
    }).join('');

    popup.innerHTML = `
      <div class="linkmail-referral-popup-header">
        <h3>Use Linkmail — Network with ${companyName} Contacts For a Referral.</h3>
        <button class="linkmail-referral-popup-close" id="linkmail-referral-close">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="linkmail-referral-contacts-list">
        ${contactsHtml}
      </div>
      <div class="linkmail-referral-popup-footer">
        <span class="linkmail-referral-logo">
          <img src="${chrome.runtime.getURL('assets/logo.png')}" alt="Linkmail" width="16" height="16" />
          Powered by Linkmail
        </span>
      </div>
    `;

    return popup;
  }

  // Show the referral popup
  function showReferralPopup(companyName, contacts) {
    // Remove existing popup if any
    hideReferralPopup();

    const popup = createReferralPopup(companyName, contacts);
    document.body.appendChild(popup);
    referralPopupVisible = true;

    // Add close button handler
    const closeBtn = popup.querySelector('#linkmail-referral-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', hideReferralPopup);
    }

    // Close popup when clicking outside
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 100);

    // Animate in
    requestAnimationFrame(() => {
      popup.classList.add('visible');
    });
  }

  // Hide the referral popup
  function hideReferralPopup() {
    const popup = document.getElementById('linkmail-referral-popup');
    if (popup) {
      popup.classList.remove('visible');
      setTimeout(() => {
        popup.remove();
      }, 200);
    }
    referralPopupVisible = false;
    document.removeEventListener('click', handleOutsideClick);
  }

  // Handle clicks outside the popup
  function handleOutsideClick(e) {
    const popup = document.getElementById('linkmail-referral-popup');
    const button = document.getElementById('linkmail-get-referred-btn');
    
    if (popup && !popup.contains(e.target) && button && !button.contains(e.target)) {
      hideReferralPopup();
    }
  }

  // Inject the referral button into the page
  function injectReferralButton(companyName, contacts) {
    // Remove existing button if any
    const existingBtn = document.getElementById('linkmail-get-referred-btn');
    if (existingBtn) {
      existingBtn.remove();
    }

    const button = createReferralButton(companyName, contacts);
    
    // Find the best place to inject the button
    const saveButtonContainer = findSaveButtonContainer();
    
    if (saveButtonContainer) {
      // Insert after the save button
      saveButtonContainer.insertAdjacentElement('afterend', button);
      referralButtonInjected = true;
    } else {
      // Fallback: look for the job details actions area
      const actionsArea = document.querySelector('.job-details-jobs-unified-top-card__container--two-pane');
      if (actionsArea) {
        actionsArea.appendChild(button);
        referralButtonInjected = true;
      }
    }
  }

  // Remove the referral button
  function removeReferralButton() {
    const button = document.getElementById('linkmail-get-referred-btn');
    if (button) {
      button.remove();
    }
    referralButtonInjected = false;
    removeLoadingSkeleton();
    hideReferralPopup();
  }

  // Wait for company name element to appear (with timeout)
  async function waitForCompanyName(maxWaitMs = 2000) {
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms
    
    while (Date.now() - startTime < maxWaitMs) {
      const companyName = getCompanyNameFromJobListing();
      if (companyName) {
        return companyName;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    return null;
  }

  // Main function to check for contacts at the company
  async function checkForReferralContacts() {
    // Only proceed if on a jobs page
    if (!isLinkedInJobsPage()) {
      removeReferralButton();
      return;
    }

    // Check if BackendAPI is available and authenticated
    if (!window.BackendAPI || !window.BackendAPI.isAuthenticated) {
      console.log('[JobsReferral] User not authenticated, skipping referral check');
      return;
    }

    // Get the job ID to track changes
    const jobId = getJobIdFromUrl();
    
    // If same job, don't re-check (unless button was removed)
    if (jobId === currentJobId && referralButtonInjected) {
      return;
    }

    // Prevent concurrent checks
    if (isCheckingContacts) {
      return;
    }

    currentJobId = jobId;
    isCheckingContacts = true;

    // Show loading skeleton immediately while we wait
    injectLoadingSkeleton();

    // Wait for company name element to appear (smart waiting instead of fixed delay)
    const companyName = await waitForCompanyName(2000);
    
    if (!companyName) {
      console.log('[JobsReferral] Could not find company name on job listing');
      removeReferralButton();
      isCheckingContacts = false;
      return;
    }

    console.log(`[JobsReferral] Checking for contacts at: ${companyName}`);

    try {
      // Search for contacts at this company
      const result = await window.BackendAPI.searchContactsByCompany(companyName, 20);
      
      // Remove skeleton before showing actual button
      removeLoadingSkeleton();
      
      if (result.results && result.results.length > 0) {
        console.log(`[JobsReferral] Found ${result.results.length} contacts at ${companyName}`);
        injectReferralButton(companyName, result.results);
      } else {
        console.log(`[JobsReferral] No contacts found at ${companyName}`);
        removeReferralButton();
      }
    } catch (error) {
      console.error('[JobsReferral] Error checking for referral contacts:', error);
      removeReferralButton();
    } finally {
      isCheckingContacts = false;
    }
  }

  // Handle URL change
  function handleUrlChange() {
    currentJobId = null;
    referralButtonInjected = false;
    loadingSkeletonInjected = false;
    isCheckingContacts = false;
    checkForReferralContacts();
  }

  // Set up observers to detect URL changes and page updates
  function setupObservers() {
    // Check on initial load
    checkForReferralContacts();

    // Track last URL to detect changes
    let lastUrl = window.location.href;

    // Intercept pushState and replaceState for SPA navigation detection
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        handleUrlChange();
      }
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        handleUrlChange();
      }
    };

    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', () => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        handleUrlChange();
      }
    });

    // Also observe DOM changes for when job details load (with reduced debounce)
    const observer = new MutationObserver(
      debounce(() => {
        if (isLinkedInJobsPage() && !referralButtonInjected && !isCheckingContacts) {
          checkForReferralContacts();
        }
      }, 250) // Reduced from 500ms to 250ms
    );

    // Start observing once body is available
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }

    // Fallback: lightweight polling for edge cases (every 2 seconds instead of 1)
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        handleUrlChange();
      }
    }, 2000);
  }

  // Debounce helper
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupObservers);
  } else {
    setupObservers();
  }

  // Expose for debugging
  window.JobsReferral = {
    checkForReferralContacts,
    getCompanyNameFromJobListing,
    isLinkedInJobsPage
  };
})();

