const { test, expect } = require('@playwright/test');

test.describe('LinkMail Extension - Utility Functions', () => {
  test('Email extraction utility should work', async ({ page }) => {
    // Create a simple test page with email content
    await page.setContent(`
      <html>
        <body>
          <div id="test-content">
            Contact me at test@example.com for more information.
            You can also reach out to support@company.org.
          </div>
        </body>
      </html>
    `);
    
    // Inject our utils script
    await page.addScriptTag({ path: './content/utils.js' });
    
    // Test email extraction
    const extractedEmail = await page.evaluate(() => {
      const content = document.getElementById('test-content').textContent;
      return window.Utils.extractEmail(content);
    });
    
    expect(extractedEmail).toBe('test@example.com');
    
    console.log('✓ Email extraction utility works correctly');
  });

  test('HTML sanitization should prevent XSS', async ({ page }) => {
    await page.setContent('<html><body></body></html>');
    await page.addScriptTag({ path: './content/utils.js' });
    
    // Test HTML sanitization
    const sanitizedHtml = await page.evaluate(() => {
      const dangerousHtml = '<script>alert("XSS")</script><img src="x" onerror="alert(1)">';
      return window.Utils.escapeHtml(dangerousHtml);
    });
    
    expect(sanitizedHtml).not.toContain('<script>');
    expect(sanitizedHtml).not.toContain('onerror');
    expect(sanitizedHtml).toContain('&lt;script&gt;');
    
    console.log('✓ HTML sanitization works correctly');
  });

  test('URL sanitization should block dangerous protocols', async ({ page }) => {
    await page.setContent('<html><body></body></html>');
    await page.addScriptTag({ path: './content/utils.js' });
    
    // Test URL sanitization
    const testResults = await page.evaluate(() => {
      return {
        validHttps: window.Utils.sanitizeUrl('https://example.com/path'),
        validHttp: window.Utils.sanitizeUrl('http://example.com/path'),
        dangerousJs: window.Utils.sanitizeUrl('javascript:alert("XSS")'),
        dangerousData: window.Utils.sanitizeUrl('data:text/html,<script>alert(1)</script>'),
        invalid: window.Utils.sanitizeUrl('not-a-url')
      };
    });
    
    expect(testResults.validHttps).toBe('https://example.com/path');
    expect(testResults.validHttp).toBe('http://example.com/path');
    expect(testResults.dangerousJs).toBe('');
    expect(testResults.dangerousData).toBe('');
    expect(testResults.invalid).toBe('');
    
    console.log('✓ URL sanitization works correctly');
  });

  test('Debounce function should work correctly', async ({ page }) => {
    await page.setContent('<html><body></body></html>');
    await page.addScriptTag({ path: './content/utils.js' });
    
    // Test debounce function
    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        let callCount = 0;
        const testFn = () => callCount++;
        
        const debouncedFn = window.Utils.debounce(testFn, 100);
        
        // Call multiple times quickly
        debouncedFn();
        debouncedFn();
        debouncedFn();
        
        // Should only execute once after delay
        setTimeout(() => {
          resolve(callCount);
        }, 150);
      });
    });
    
    expect(result).toBe(1);
    console.log('✓ Debounce function works correctly');
  });
});

test.describe('LinkMail Extension - Dashboard Tests', () => {
  test('Dashboard HTML should load without errors', async ({ page }) => {
    // Load the dashboard HTML file
    await page.goto(`file://${process.cwd()}/dashboard.html`);
    
    // Check that basic elements are present
    await expect(page.locator('#pageTitle')).toBeVisible();
    await expect(page.locator('.nav-item')).toHaveCount(3); // Profile, Templates, Email History
    
    console.log('✓ Dashboard HTML loads correctly');
  });

  test('Dashboard navigation should work', async ({ page }) => {
    await page.goto(`file://${process.cwd()}/dashboard.html`);
    
    // Test tab switching
    const templatesTab = page.locator('.nav-item').nth(1);
    const profileTab = page.locator('.nav-item').nth(0);
    
    await templatesTab.click();
    await expect(page.locator('#templates')).toHaveClass(/active/);
    
    await profileTab.click(); 
    await expect(page.locator('#profile')).toHaveClass(/active/);
    
    console.log('✓ Dashboard navigation works correctly');
  });

  test('Form validation should prevent empty submissions', async ({ page }) => {
    await page.goto(`file://${process.cwd()}/dashboard.html`);
    
    // Try to submit form without required fields
    const nameField = page.locator('#name');
    const submitButton = page.locator('#submitButton');
    
    // Clear any existing value and try to submit
    await nameField.fill('');
    await submitButton.click();
    
    // Check if form validation prevents submission
    const isRequired = await nameField.getAttribute('required');
    expect(isRequired).not.toBeNull();
    
    console.log('✓ Form validation is properly configured');
  });
});

test.describe('LinkMail Extension - Content Script Loading', () => {
  test('Content scripts should load without syntax errors', async ({ page }) => {
    await page.setContent('<html><body></body></html>');
    
    // Load each content script and verify no syntax errors
    const scripts = [
      './content/utils.js',
      './content/email-finder.js',
      './content/profile-scraper.js'
    ];
    
    for (const script of scripts) {
      try {
        await page.addScriptTag({ path: script });
        console.log(`✓ ${script} loaded successfully`);
      } catch (error) {
        throw new Error(`Failed to load ${script}: ${error.message}`);
      }
    }
    
    // Verify global objects are created
    const hasUtils = await page.evaluate(() => typeof window.Utils !== 'undefined');
    const hasEmailFinder = await page.evaluate(() => typeof window.EmailFinder !== 'undefined');
    const hasProfileScraper = await page.evaluate(() => typeof window.ProfileScraper !== 'undefined');
    
    expect(hasUtils).toBe(true);
    expect(hasEmailFinder).toBe(true);
    expect(hasProfileScraper).toBe(true);
    
    console.log('✓ All content scripts create their global objects');
  });

  test('Email finder should work with mock LinkedIn content', async ({ page }) => {
    // Create mock LinkedIn profile page
    await page.setContent(`
      <html>
        <body>
          <section>
            <div id="about">
              <p>Software Engineer with 5+ years of experience.</p>
              <p>Contact me at: john.doe@example.com</p>
            </div>
          </section>
        </body>
      </html>
    `);
    
    // Load required scripts
    await page.addScriptTag({ path: './content/utils.js' });
    await page.addScriptTag({ path: './content/email-finder.js' });
    
    // Test email finding
    const foundEmail = await page.evaluate(() => {
      return window.EmailFinder.checkAboutSection();
    });
    
    expect(foundEmail).toBe('john.doe@example.com');
    console.log('✓ Email finder works with mock LinkedIn content');
  });
}); 