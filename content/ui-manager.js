window.UIManager = {
  elements: {},

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

  createUI() {
    const injectedDiv = document.createElement('div');
    const nameElement = document.createElement('p');
    nameElement.id = 'profileName';
    nameElement.textContent = `Generate an outreach email to ${document.querySelector('h1')?.innerText || ''} with AI instantly.`;

    injectedDiv.innerHTML = `
    <input type="email" id="recipientEmailInput" placeholder="Recipient Email" style="width: 90%; margin-top: 8px; padding: 8px; border-radius: 8px; border: 1px solid #ccc;">
    <button id="generateButton" style='background-color: rgb(0, 106, 255); margin-top:8px; border-radius: 16px; color: white; padding: 8px 16px; border: none;'>Generate Email</button>
    <div id="loadingIndicator" style="display: none; margin-top: 10px;">
        Generating your email...
    </div>
    <input id="emailSubject" placeholder="Outreach Request" style="width: 90%; height: fit-content; margin-top: 16px; padding: 12px; border-radius: 8px; border: 1px solid #ccc; display: none;"></input>
    <textarea id="emailResult" style="width: 100%; height: 250px; margin-top: 16px; padding: 12px; border-radius: 8px; border: 1px solid #ccc; display: none;"></textarea>
    <div style="display: flex; gap: 8px; margin-top: 8px;">
        <button id="copyButton" style='background-color: #28a745; border-radius: 16px; color: white; padding: 8px 16px; border: none; display: none;'>Copy to Clipboard</button>
        <button id="sendGmailButton" style='background-color: #dc3545; border-radius: 16px; color: white; padding: 8px 16px; border: none; display: none;'>Send via Gmail</button>
    </div>
    `;


    injectedDiv.prepend(nameElement);

    Object.assign(injectedDiv.style, {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      textAlign: 'center',
      alignItems: 'center',
      boxShadow: '0 0 10px rgba(0,0,0,0.15)',
      padding: '16px',
      minHeight: '300px',
      borderRadius: '8px',
      backgroundColor: 'white',
      marginBottom: '20px',
    });

    const asideElement = document.querySelector('aside.scaffold-layout__aside');
    if (asideElement) {
      asideElement.prepend(injectedDiv);
    } else {
      console.error('Target aside element not found.');
    }

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
      this.elements.loadingIndicator.style.display = 'block';
      this.elements.emailResult.style.display = 'none';
      this.elements.copyButton.style.display = 'none';

      try {
        const profileData = await ProfileScraper.scrapeProfileData();
        
        const recipientEmail = document.getElementById('recipientEmailInput').value;
        if (recipientEmail) {
          profileData.email = recipientEmail;
        }
        
        const response = await ProfileScraper.generateColdEmail(profileData);
        
        if (response?.email) {
          this.elements.emailResult.value = response.email;
          this.elements.emailResult.style.display = 'block';
          this.elements.copyButton.style.display = 'block';
          this.elements.emailSubject.style.display = 'block';
          this.elements.sendGmailButton.style.display = 'block';
        } else {
          this.elements.emailResult.value = "Failed to generate email. Please try again.";
          this.elements.emailResult.style.display = 'block';
        }
      } catch (error) {
        console.error('Error:', error);
        this.elements.emailResult.value = "An error occurred while generating the email.";
        this.elements.emailResult.style.display = 'block';
      } finally {
        this.elements.generateButton.disabled = false;
        this.elements.loadingIndicator.style.display = 'none';
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
        
        alert('Email sent successfully!');
        
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
      }
    });
  },

  init() {
    this.createUI();
    this.setupEventListeners();
  }
};
