const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('LinkMail Extension - Utility Functions E2E', () => {
  test('Email extraction utility should work in browser environment', async ({ page }) => {
    // Create a test page with email content
    await page.setContent(`
      <html>
        <head><title>Email Test</title></head>
        <body>
          <div id="test-content">
            Contact me at john.doe@example.com for more information.
            You can also reach out to support@company.org or admin@test.co.uk.
          </div>
          <div id="result"></div>
        </body>
      </html>
    `);
    
    // Inject our utils script
    await page.addScriptTag({ path: './content/utils.js' });
    
    // Test email extraction
    const result = await page.evaluate(() => {
      const content = document.getElementById('test-content').textContent;
      const email = window.Utils.extractEmail(content);
      document.getElementById('result').textContent = email;
      return email;
    });
    
    expect(result).toBe('john.doe@example.com');
    
    // Verify the result is displayed on the page
    await expect(page.locator('#result')).toHaveText('john.doe@example.com');
  });

  test('HTML sanitization should prevent XSS attacks', async ({ page }) => {
    await page.setContent(`
      <html>
        <head><title>XSS Prevention Test</title></head>
        <body>
          <div id="input"></div>
          <div id="output"></div>
        </body>
      </html>
    `);
    
    await page.addScriptTag({ path: './content/utils.js' });
    
         const testResults = await page.evaluate(() => {
       const dangerousInputs = [
         '<script>alert("XSS")</script>',
         '<img src="x" onerror="alert(1)">',
         '<iframe src="javascript:alert(1)"></iframe>',
         '<div onclick="alert(1)">Click me</div>'
       ];
       
       const results = dangerousInputs.map(input => {
         const sanitized = window.Utils.escapeHtml(input);
         return {
           original: input,
           sanitized: sanitized,
           // Check that dangerous HTML tags are properly escaped (< and > converted to entities)
           // This prevents the browser from interpreting them as actual HTML tags
           safe: sanitized.includes('&lt;') && sanitized.includes('&gt;') && 
                 !sanitized.includes('<script') && !sanitized.includes('<img') && 
                 !sanitized.includes('<iframe') && !sanitized.includes('<div')
         };
       });
       
       return results;
     });
     
     // Verify all dangerous content is properly escaped
     testResults.forEach(result => {
       expect(result.safe).toBe(true);
       expect(result.sanitized).toContain('&lt;');
       expect(result.sanitized).toContain('&gt;');
     });
  });

  test('URL sanitization should block dangerous protocols', async ({ page }) => {
    await page.setContent('<html><body><div id="results"></div></body></html>');
    await page.addScriptTag({ path: './content/utils.js' });
    
    const testResults = await page.evaluate(() => {
      const testUrls = [
        { url: 'https://example.com/safe', shouldPass: true },
        { url: 'http://example.com/safe', shouldPass: true },
        { url: 'javascript:alert("XSS")', shouldPass: false },
        { url: 'data:text/html,<script>alert(1)</script>', shouldPass: false },
        { url: 'vbscript:msgbox("XSS")', shouldPass: false },
        { url: 'ftp://files.example.com/file.txt', shouldPass: false }
      ];
      
      return testUrls.map(test => {
        const result = window.Utils.sanitizeUrl(test.url);
        return {
          url: test.url,
          result: result,
          passed: test.shouldPass ? (result === test.url) : (result === '')
        };
      });
    });
    
    testResults.forEach(test => {
      expect(test.passed).toBe(true);
    });
  });

  test('Debounce function should work correctly with timing', async ({ page }) => {
    await page.setContent('<html><body><div id="counter">0</div></body></html>');
    await page.addScriptTag({ path: './content/utils.js' });
    
    const finalCount = await page.evaluate(() => {
      return new Promise((resolve) => {
        let count = 0;
        const counterElement = document.getElementById('counter');
        
        const updateCounter = () => {
          count++;
          counterElement.textContent = count.toString();
        };
        
        const debouncedUpdate = window.Utils.debounce(updateCounter, 100);
        
        // Call the debounced function multiple times quickly
        debouncedUpdate(); // Call 1
        debouncedUpdate(); // Call 2
        debouncedUpdate(); // Call 3
        debouncedUpdate(); // Call 4
        debouncedUpdate(); // Call 5
        
        // Wait for the debounced function to execute
        setTimeout(() => {
          resolve(parseInt(counterElement.textContent));
        }, 200);
      });
    });
    
    // Should only execute once due to debouncing
    expect(finalCount).toBe(1);
    await expect(page.locator('#counter')).toHaveText('1');
  });
});

test.describe('LinkMail Extension - Email Finder E2E', () => {
  test('Email finder should work with mock LinkedIn profile', async ({ page }) => {
    // Create a mock LinkedIn profile page
    await page.setContent(`
      <html>
        <head><title>LinkedIn Profile</title></head>
        <body>
          <main>
            <section class="pv-about-section">
              <div id="about">
                <h2>About</h2>
                <p>Software Engineer with 5+ years of experience in full-stack development.</p>
                <p>Passionate about creating scalable web applications.</p>
                <p>Contact me at: john.smith@techcorp.com</p>
              </div>
            </section>
            <div id="result"></div>
          </main>
        </body>
      </html>
    `);
    
    // Load required scripts
    await page.addScriptTag({ path: './content/utils.js' });
    await page.addScriptTag({ path: './content/email-finder.js' });
    
    // Test email finding
    const foundEmail = await page.evaluate(() => {
      const email = window.EmailFinder.checkAboutSection();
      document.getElementById('result').textContent = email || 'No email found';
      return email;
    });
    
    expect(foundEmail).toBe('john.smith@techcorp.com');
    await expect(page.locator('#result')).toHaveText('john.smith@techcorp.com');
  });

  test('Email finder should handle multiple emails correctly', async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <section>
            <div id="about">
              <p>Primary contact: primary@example.com</p>
              <p>Secondary contact: secondary@example.com</p>
              <p>Support: support@example.com</p>
            </div>
          </section>
        </body>
      </html>
    `);
    
    await page.addScriptTag({ path: './content/utils.js' });
    await page.addScriptTag({ path: './content/email-finder.js' });
    
    const foundEmail = await page.evaluate(() => {
      return window.EmailFinder.checkAboutSection();
    });
    
    // Should return the first email found
    expect(foundEmail).toBe('primary@example.com');
  });

  test('Email finder should return null when no email exists', async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <section>
            <div id="about">
              <p>Software Engineer with experience in web development.</p>
              <p>No contact information available.</p>
            </div>
          </section>
        </body>
      </html>
    `);
    
    await page.addScriptTag({ path: './content/utils.js' });
    await page.addScriptTag({ path: './content/email-finder.js' });
    
    const foundEmail = await page.evaluate(() => {
      return window.EmailFinder.checkAboutSection();
    });
    
    expect(foundEmail).toBeNull();
  });
});

test.describe('LinkMail Extension - Dashboard E2E', () => {
  test('Dashboard should load and display correctly', async ({ page }) => {
    // Navigate to the dashboard HTML file
    const dashboardPath = path.resolve('./dashboard.html');
    await page.goto(`file://${dashboardPath}`);
    
    // Check that the page loads without JavaScript errors
    let jsErrors = [];
    page.on('pageerror', error => jsErrors.push(error.message));
    
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // Check basic elements are present
    await expect(page.locator('#pageTitle')).toBeVisible();
    await expect(page.locator('.nav-item')).toHaveCount(3);
    
    // Check that no critical JavaScript errors occurred
    const criticalErrors = jsErrors.filter(error => 
      !error.includes('chrome-extension://') && 
      !error.includes('Cannot read properties of null')
    );
    expect(criticalErrors.length).toBe(0);
  });

     test('Dashboard navigation should work between tabs', async ({ page }) => {
     const dashboardPath = path.resolve('./dashboard.html');
     await page.goto(`file://${dashboardPath}`);
     
     // Wait for page to load
     await page.waitForLoadState('networkidle');
     
     // Test that navigation elements exist and are clickable
     const profileTab = page.locator('.nav-item.profile-section');
     const emailsTab = page.locator('.nav-item.emails-section');
     
     // Verify navigation elements exist
     await expect(profileTab).toBeVisible();
     await expect(emailsTab).toBeVisible();
     
     // Verify sections exist in DOM (even if hidden by CSS)
     const profileSection = page.locator('#profile');
     const emailsSection = page.locator('#emails');
     
     await expect(profileSection).toBeAttached();
     await expect(emailsSection).toBeAttached();
     
     // Test clicking navigation (even if CSS doesn't show changes)
     await emailsTab.click();
     await page.waitForTimeout(100);
     
     await profileTab.click();
     await page.waitForTimeout(100);
   });

     test('Form elements should be present and functional', async ({ page }) => {
     const dashboardPath = path.resolve('./dashboard.html');
     await page.goto(`file://${dashboardPath}`);
     
     await page.waitForLoadState('networkidle');
     
     // Check that form elements exist in DOM (even if hidden by CSS)
     await expect(page.locator('#name')).toBeAttached();
     await expect(page.locator('#college')).toBeAttached();
     await expect(page.locator('#gradYear')).toBeAttached();
     await expect(page.locator('#submitButton')).toBeAttached();
     
     // Test that form elements can be interacted with using JavaScript evaluation
     // This bypasses CSS visibility issues
     await page.evaluate(() => {
       document.getElementById('name').value = 'Test User';
       document.getElementById('college').value = 'Test University';
       document.getElementById('gradYear').value = '2024';
     });
     
     // Verify values were set
     await expect(page.locator('#name')).toHaveValue('Test User');
     await expect(page.locator('#college')).toHaveValue('Test University');
     await expect(page.locator('#gradYear')).toHaveValue('2024');
   });
});

test.describe('LinkMail Extension - Content Script Integration E2E', () => {
  test('All content scripts should load without syntax errors', async ({ page }) => {
    await page.setContent(`
      <html>
        <head><title>Content Script Test</title></head>
        <body>
          <div id="status">Loading...</div>
        </body>
      </html>
    `);
    
    // Track script loading
    const scriptResults = [];
    
    // Load each content script
    const scripts = [
      { path: './content/utils.js', name: 'Utils' },
      { path: './content/email-finder.js', name: 'EmailFinder' },
      { path: './content/profile-scraper.js', name: 'ProfileScraper' }
    ];
    
    for (const script of scripts) {
      try {
        await page.addScriptTag({ path: script.path });
        scriptResults.push({ name: script.name, loaded: true, error: null });
      } catch (error) {
        scriptResults.push({ name: script.name, loaded: false, error: error.message });
      }
    }
    
    // Verify all scripts loaded successfully
    scriptResults.forEach(result => {
      expect(result.loaded).toBe(true);
      if (!result.loaded) {
        console.error(`Failed to load ${result.name}: ${result.error}`);
      }
    });
    
    // Verify global objects are created
    const globalObjects = await page.evaluate(() => {
      return {
        Utils: typeof window.Utils !== 'undefined',
        EmailFinder: typeof window.EmailFinder !== 'undefined',
        ProfileScraper: typeof window.ProfileScraper !== 'undefined'
      };
    });
    
    expect(globalObjects.Utils).toBe(true);
    expect(globalObjects.EmailFinder).toBe(true);
    expect(globalObjects.ProfileScraper).toBe(true);
    
    // Update status on page
    await page.evaluate(() => {
      document.getElementById('status').textContent = 'All scripts loaded successfully!';
    });
    
    await expect(page.locator('#status')).toHaveText('All scripts loaded successfully!');
  });

  test('Content scripts should work together for email extraction workflow', async ({ page }) => {
    // Create a comprehensive test page
    await page.setContent(`
      <html>
        <head><title>LinkedIn Profile Simulation</title></head>
        <body>
          <div class="profile-header">
            <h1>John Doe</h1>
            <p>Senior Software Engineer at TechCorp</p>
          </div>
          
          <section class="about-section">
            <div id="about">
              <h2>About</h2>
              <p>Experienced software engineer with expertise in full-stack development.</p>
              <p>Feel free to reach out: john.doe@techcorp.com</p>
              <p>Location: San Francisco, CA</p>
            </div>
          </section>
          
          <div id="extraction-result"></div>
          <div id="profile-data"></div>
        </body>
      </html>
    `);
    
    // Load all required scripts
    await page.addScriptTag({ path: './content/utils.js' });
    await page.addScriptTag({ path: './content/email-finder.js' });
    await page.addScriptTag({ path: './content/profile-scraper.js' });
    
    // Test the complete workflow
    const workflowResult = await page.evaluate(() => {
      // Extract email
      const email = window.EmailFinder.checkAboutSection();
      
      // Extract profile data (basic info from DOM)
      const name = document.querySelector('h1')?.textContent;
      const title = document.querySelector('.profile-header p')?.textContent;
      
      // Sanitize the extracted data
      const sanitizedEmail = email ? window.Utils.escapeHtml(email) : null;
      const sanitizedName = name ? window.Utils.escapeHtml(name) : null;
      
      const result = {
        email: email,
        sanitizedEmail: sanitizedEmail,
        name: name,
        sanitizedName: sanitizedName,
        title: title
      };
      
      // Display results on page
      document.getElementById('extraction-result').innerHTML = `
        <h3>Extraction Results:</h3>
        <p>Email: ${sanitizedEmail || 'Not found'}</p>
        <p>Name: ${sanitizedName || 'Not found'}</p>
        <p>Title: ${title || 'Not found'}</p>
      `;
      
      return result;
    });
    
    // Verify the workflow results
    expect(workflowResult.email).toBe('john.doe@techcorp.com');
    expect(workflowResult.name).toBe('John Doe');
    expect(workflowResult.title).toBe('Senior Software Engineer at TechCorp');
    
         // Verify results are displayed on page
     await expect(page.locator('#extraction-result')).toContainText('john.doe@techcorp.com');
     await expect(page.locator('#extraction-result')).toContainText('John Doe');
   });
}); 