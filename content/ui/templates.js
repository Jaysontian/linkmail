// content/ui/templates.js
// Attach template-related utilities to window.UIManager

(function attachTemplates(){
  if (!window) return;
  window.UIManager = window.UIManager || {};

  window.UIManager.populateTemplateDropdown = function populateTemplateDropdown() {
    const templateContainer = this.elements.templateDropdown;

    if (!templateContainer) {
      console.error('Template container not found');
      return;
    }

    templateContainer.innerHTML = '';

    const selectedTemplateName = this.selectedTemplate.name || null;

    const defaultTemplates = [
      {
        id: 'coffee-chat',
        icon: '☕',
        name: 'Coffee Chat Request',
        description: 'A friendly intro to chat',
        content: this.templates[0].content,
        subjectLine: this.templates[0].subjectLine || 'Coffee Chat Request',
        purpose: 'to send a coffee chat request',
        attachments: []
      },
      {
        id: 'job-application',
        icon: '💼',
        name: 'Inquire About Open Roles',
        description: 'A professional email for recruiting',
        content: this.templates[1].content,
        subjectLine: this.templates[1].subjectLine || 'Wondering About Potential Opportunities at [Recipient Company Name]',
        purpose: 'to send a job application',
        attachments: []
      }
    ];
    let allTemplates = [...defaultTemplates];

    if (this.userData && this.userData.templates && Array.isArray(this.userData.templates)) {
      const customTemplates = this.userData.templates
        .filter(template => template && template.name)
        .map((template, index) => ({
          id: `custom-${index}`,
          icon: template.icon || '📝',
          name: template.name,
          description: template.description || 'Custom email template',
          content: template.content,
          // Use template.subjectLine if available, otherwise use template.name as subject
          // Do NOT use placeholders like [Recipient Name] as fallback since they'll be replaced by AI
          subjectLine: template.subjectLine || template.name || 'Subject Line',
          purpose: `to send a ${template.name} email`,
          attachments: template.attachments || []
        }));
      allTemplates = [...allTemplates, ...customTemplates];
    } else {
    }

    allTemplates.forEach(template => {
      const card = document.createElement('div');
      card.className = 'template-dropdown-card';
      card.dataset.template = template.id;
      if (selectedTemplateName === template.name) {
        card.classList.add('selected');
      }
      card.innerHTML = `
        <h1 class="template-dropdown-icon">${template.icon}</h1>
        <div>
          <h2>${template.name}</h2>
        </div>
      `;
      card.addEventListener('click', () => {
        templateContainer.querySelectorAll('.template-dropdown-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedTemplate = {
          name: template.name,
          content: template.content,
          subjectLine: template.subjectLine,
          purpose: template.purpose,
          attachments: template.attachments || []
        };
      });
      templateContainer.appendChild(card);
    });

    if ((!this.selectedTemplate.name || Object.keys(this.selectedTemplate).length === 0) && allTemplates.length > 0) {
      let templateToSelect = allTemplates[0];
      const customTemplate = allTemplates.find(t => t.id && t.id.startsWith('custom-'));
      if (customTemplate) templateToSelect = customTemplate;
      const firstTemplate = templateToSelect;
      this.selectedTemplate = {
        name: firstTemplate.name,
        content: firstTemplate.content,
        subjectLine: firstTemplate.subjectLine,
        purpose: firstTemplate.purpose,
        attachments: firstTemplate.attachments || []
      };
      const templateCards = templateContainer.querySelectorAll('.template-dropdown-card');
      templateCards.forEach(card => {
        const cardTemplateName = card.querySelector('h2')?.textContent;
        if (cardTemplateName === firstTemplate.name) card.classList.add('selected');
      });
    } else if (this.selectedTemplate.name) {
      const templateCards = templateContainer.querySelectorAll('.template-dropdown-card');
      templateCards.forEach(card => {
        const templateName = card.querySelector('h2')?.textContent;
        card.classList.remove('selected');
        if (templateName === this.selectedTemplate.name) card.classList.add('selected');
      });
    }
  };

  window.UIManager.checkForTemplateUpdates = function checkForTemplateUpdates() {
    if (this.isAuthenticated && this.userData && this.userData.email) {
      try {
        if (!chrome.runtime?.id) {
          return;
        }
        chrome.storage.local.get([this.userData.email], (result) => {
          if (chrome.runtime.lastError) {
            return;
          }
          const storedData = result[this.userData.email];
          if (storedData && storedData.templates) {
            const currentTemplatesLength = this.userData.templates ? this.userData.templates.length : 0;
            const newTemplatesLength = storedData.templates.length;
            if (newTemplatesLength !== currentTemplatesLength) {
              const currentView = this.getCurrentView();
              this.userData = storedData;
              this.populateTemplateDropdown();
              if (currentView === 'editor') {
              }
              return;
            }
            if (currentTemplatesLength > 0) {
              const currentTemplatesJSON = JSON.stringify(this.userData.templates);
              const newTemplatesJSON = JSON.stringify(storedData.templates);
              if (currentTemplatesJSON !== newTemplatesJSON) {
                const currentView = this.getCurrentView();
                this.userData = storedData;
                this.populateTemplateDropdown();
                if (currentView === 'editor') {
                }
              }
            }
          }
        });
      } catch (error) {
      }
    }
  };

  window.UIManager.setupTemplateRefreshListener = function setupTemplateRefreshListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && this.userData?.email && changes[this.userData.email]) {
        const newValue = changes[this.userData.email].newValue;
        const oldValue = changes[this.userData.email].oldValue;
        if (newValue && oldValue && JSON.stringify(newValue.templates) !== JSON.stringify(oldValue.templates)) {
          const currentView = this.getCurrentView();
          this.userData = newValue;
          this.populateTemplateDropdown();
          if (currentView === 'editor') {
          }
        }
      }
    });
  };

  window.UIManager.displayAttachments = function displayAttachments(attachments) {
    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      const attachmentsSection = document.getElementById('emailAttachments');
      if (attachmentsSection) attachmentsSection.style.display = 'none';
      return;
    }
    const attachmentsSection = document.getElementById('emailAttachments');
    const attachmentsList = document.getElementById('attachmentsList');
    if (!attachmentsSection || !attachmentsList) {
      console.error('Attachments elements not found');
      return;
    }
    attachmentsList.innerHTML = '';
    attachments.forEach((attachment) => {
      const attachmentItem = document.createElement('div');
      attachmentItem.className = 'email-attachment-item';
      const sizeInKB = Math.round(attachment.size / 1024);
      const sizeFormatted = sizeInKB >= 1024 ? (sizeInKB / 1024).toFixed(2) + ' MB' : sizeInKB + ' KB';
      attachmentItem.innerHTML = `
        <div class="attachment-info">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <path d="M9 18v-6"/>
            <path d="M12 18v-3"/>
            <path d="M15 18v-6"/>
          </svg>
          <div>
            <p class="attachment-name">${attachment.name}</p>
            <p class="attachment-size">${sizeFormatted}</p>
          </div>
        </div>
      `;
      attachmentsList.appendChild(attachmentItem);
    });
    attachmentsSection.style.display = 'block';
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}


