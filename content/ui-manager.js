window.UIManager = {
  elements: {},
  userData: null,

  selectedTemplate: {},

  templates: [
    {
      icon: "☕",
      name: "Coffee Chat",
      description: "Send a friendly request to chat with this person.",
      purpose: "to schedule a coffee chat to the recipient",
      content: "Hey [NAME]!\nI bet you get hundreds of cold emails so I'll try to keep this concise: I saw that XXX I'm really interested in XXX and would love to learn more about it as well as potential opportunities for an internship, if you guys are currently looking for summer interns. I have two internships under my belt, have a high GPA, and good communication / leadership development. Let me know if you are down to schedule a time for a chat!\nBest regards,",
    },
    {
      icon: "💼",
      name: "Job Application",
      description: "Craft a professional email to a recruiter or manager",
      purpose: "to inquire if there is internship or job",
      content: "Hey [name],\nI'm [insert personal info here]. I think it's really cool how *Skiff is building a privacy-first collaboration platform with expiring links, secure workspaces, and password protection.* Would love to connect and learn about any possible internship opportunities!\nBest regards,",
    }
  ],



  async loadHTML() {
    const url = chrome.runtime.getURL('/content/linkedin-div.html');
    const response = await fetch(url);
    const html = await response.text();
    return html;
  },

  async populateForm() {
    const email = await EmailFinder.findLinkedInEmail();
    const recipientInput = document.getElementById('recipientEmailInput');
    const nameElement = document.getElementById('profileName');
    
    if (recipientInput && email) {
      recipientInput.value = email;
    }
    
    if (nameElement) {
      nameElement.textContent = `Generate an outreach email to ${document.querySelector('h1')?.innerText || ''} with AI instantly.`;
    }
  },

  async createUI() {
    const templateHtml = await this.loadHTML();

    // Create a temporary container, inject styles
    const temp = document.createElement('div');
    temp.innerHTML = templateHtml;
    const styleElement = temp.querySelector('style');
    if (styleElement) {
        document.head.appendChild(styleElement);
    }
    
    // Get the first element (our container)
    const injectedDiv = temp.firstElementChild;
    
    // Set the recipient name
    const nameElement = injectedDiv.querySelector('#title');
    const firstName = document.querySelector('h1')?.innerText.split(' ')[0]?.charAt(0).toUpperCase() + document.querySelector('h1')?.innerText.split(' ')[0]?.slice(1) || '';
    nameElement.textContent = `Draft an email to ${firstName}`;



    // Generate template list dynamically
    const promptListDiv = injectedDiv.querySelector('.linkmail-prompt-list');

    // Generate template cards from ProfileScraper.templates
    this.templates.forEach(template => {
        const promptDiv = document.createElement('div');
        promptDiv.className = 'linkmail-prompt';
        promptDiv.innerHTML = `
            <h1>${template.icon}</h1>
            <div>
                <h2>${template.name}</h2>
                <p>${template.description}</p>
            </div>
        `;

        console.log('generated: ', template.name);

        // Add click handler
        promptDiv.addEventListener('click', async () => {
          // Remove 'selected' class from all prompts
          const allPrompts = promptListDiv.querySelectorAll('.linkmail-prompt');
          allPrompts.forEach(prompt => {
              prompt.classList.remove('linkmail-prompt-selected');
          });
          
          // Add 'selected' class to clicked prompt
          promptDiv.classList.add('linkmail-prompt-selected');
          
          // Update the selectedTemplate with the clicked template's data
          this.selectedTemplate = template;

        });

        promptListDiv.appendChild(promptDiv);
    });


    console.log('Injecting this code...');

    // Insert into the page
    const asideElement = document.querySelector('aside.scaffold-layout__aside');
    console.log('Aside element found:', asideElement); // Add this
    if (asideElement) {
      asideElement.prepend(injectedDiv);
    } else {
      console.error('Target aside element not found.');
    }

    // Store references to elements
    this.elements = {
      generateButton: injectedDiv.querySelector('#generateButton'),
      loadingIndicator: injectedDiv.querySelector('#loadingIndicator'),
      emailSubject: injectedDiv.querySelector('#emailSubject'),
      emailResult: injectedDiv.querySelector('#emailResult'),
      copyButton: injectedDiv.querySelector('#copyButton'),
      sendGmailButton: injectedDiv.querySelector('#sendGmailButton')
    };

  },

  setupEventListeners() {

    // GENERATE BUTTON UI
    this.elements.generateButton.addEventListener('click', async () => {
      this.elements.generateButton.disabled = true;
      this.elements.generateButton.innerText = "Generating...";
      // this.elements.loadingIndicator.style.display = 'block';
      // this.elements.emailResult.style.display = 'none';
      // this.elements.copyButton.style.display = 'none';

      function adjustHeight(element) {
        element.style.height = 'auto';
        element.style.height = element.scrollHeight + 'px';
      }
      // Make textarea autoresizable
      emailResult.addEventListener('input', function() {adjustHeight(this);});


      try {
        const profileData = await ProfileScraper.scrapeProfileData();
        const recipientEmail = document.getElementById('recipientEmailInput').value;
        if (recipientEmail) {
          profileData.email = recipientEmail;
        }
        

        const useTemplate = this.selectedTemplate == undefined ? templates[0] : this.selectedTemplate;

        console.log(useTemplate);

        const response = await ProfileScraper.generateColdEmail(profileData, useTemplate);

        console.log(response);

        document.querySelector('#linkmail-splash').style.display = "none";
        document.querySelector('#linkmail-editor').style.display = "block";
        
        if (response?.email) {
          let emailContent = response.email;
          if (this.userData && this.userData.name) {
            emailContent = emailContent.replace('[Your Name]', this.userData.name);
          }

          this.elements.emailResult.value = emailContent;
          this.elements.emailSubject.value = response.subject;
          
          adjustHeight(this.elements.emailResult);
        } else {
          this.elements.emailResult.value = "Failed to generate email. Please try again.";
        }
      } catch (error) {
        console.error('Error:', error);
        this.elements.emailResult.value = "An error occurred while generating the email.";
      } finally {
        this.elements.generateButton.disabled = false;
      }
    });

    // COPY BUTTON
    this.elements.copyButton.addEventListener('click', () => {
      this.elements.emailResult.select();
      document.execCommand('copy');
      this.elements.copyButton.textContent = 'Copied!';
      setTimeout(() => {
        this.elements.copyButton.textContent = 'Copy to Clipboard';
      }, 2000);
    });


    // SEND EMAIL BUTTON
    this.elements.sendGmailButton.addEventListener('click', async () => {
      const email = document.getElementById('recipientEmailInput').value;
      const subject = document.getElementById('emailSubject').value;
      const emailContent = this.elements.emailResult.value;

      if (!email || !subject || !emailContent) {
        alert('Please fill in all fields');
        return;
      }

      try {
        this.elements.sendGmailButton.disabled = true;
        this.elements.sendGmailButton.textContent = 'Sending...';

        await GmailManager.sendEmail(email, subject, emailContent);
        
        //alert('Email sent successfully!');
        
        // Clear the form
        this.elements.emailResult.value = '';
        this.elements.emailSubject.value = '';
        document.getElementById('recipientEmailInput').value = '';

      } catch (error) {
        console.error('Failed to send email:', error);
        alert('Failed to send email. Please make sure you are logged into Gmail and try again.');
      } finally {
        this.elements.sendGmailButton.disabled = false;
        this.elements.sendGmailButton.textContent = 'Send via Gmail';

        document.querySelector('#linkmail-editor').style.display = "none";
        document.querySelector('#linkmail-success').style.display = "block";
      }
    });
  },

  async init() {
    const profile = await GmailManager.getUserProfile();
    this.userData = {
      email: profile.emailAddress,
      // Extract name from email or fetch it from People API if needed
      name: profile.emailAddress.split('@')[0] // Basic fallback
    };

    await this.createUI();
    this.setupEventListeners();
  }
};
