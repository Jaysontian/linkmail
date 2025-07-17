# LinkMail Extension Testing Guide

This guide provides comprehensive information about testing the LinkMail extension to ensure all functionality remains stable as you add new features.

## 🧪 Test Suite Overview

The LinkMail extension has a comprehensive test suite that covers:

- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test how components work together
- **End-to-End Tests**: Test complete user workflows
- **Error Handling Tests**: Test fallback scenarios and edge cases

## 📁 Test Structure

```
tests/
├── content/                    # Unit tests for content scripts
│   ├── profile-scraper.test.js # Email generation & profile scraping
│   ├── ui-manager.test.js      # UI interactions & template management
│   ├── email-finder.test.js    # Email finding & Apollo integration
│   └── utils.test.js           # Utility functions
├── integration/                # Integration tests
│   └── *.test.js              # End-to-end workflow tests
├── helpers/                    # Test utilities
│   └── test-utils.js          # Mock helpers and test data
├── setup.js                   # Jest test setup
└── run-all-tests.js          # Comprehensive test runner
```

## 🚀 Running Tests

### Quick Start

```bash
# Run all tests with detailed output
npm test

# Run specific test file
npx jest tests/content/profile-scraper.test.js

# Run tests in watch mode (re-runs on file changes)
npx jest --watch

# Run comprehensive test suite with coverage
node tests/run-all-tests.js
```

### Test Categories

1. **Profile Scraper Tests** - Core email generation functionality
   ```bash
   npx jest tests/content/profile-scraper.test.js
   ```

2. **UI Manager Tests** - User interface and template handling
   ```bash
   npx jest tests/content/ui-manager.test.js
   ```

3. **Email Finder Tests** - Email extraction from LinkedIn
   ```bash
   npx jest tests/content/email-finder.test.js
   ```

4. **Integration Tests** - Complete workflows
   ```bash
   npx jest tests/integration/
   ```

## 🔧 Key Test Areas

### Email Generation Tests

These tests ensure the core functionality we recently improved works correctly:

- ✅ **API Response Handling**: Tests different API response formats
- ✅ **Template Processing**: Tests complex template placeholder replacement
- ✅ **Error Fallbacks**: Tests graceful degradation when APIs fail
- ✅ **Profile Data Integration**: Tests how user experience is incorporated

**Critical Test Cases:**
```javascript
// Test proper format handling
it('should handle API responses without delimiter gracefully')

// Test error recovery
it('should provide helpful error messages for invalid profile data')

// Test template processing
it('should generate personalized email with proper format')
```

### UI Integration Tests

These tests ensure the user interface behaves correctly:

- ✅ **Template Management**: Tests template selection and custom templates
- ✅ **Email Generation Workflow**: Tests the complete generation process
- ✅ **Authentication Handling**: Tests sign-in/sign-out scenarios
- ✅ **View Management**: Tests switching between different UI states

### Email Finding Tests

These tests ensure email extraction works reliably:

- ✅ **LinkedIn Modal Extraction**: Tests extracting emails from contact info
- ✅ **Apollo API Integration**: Tests fallback email finding service
- ✅ **Caching Behavior**: Tests email caching for performance
- ✅ **Error Handling**: Tests graceful failure scenarios

## 📊 Coverage Requirements

The test suite aims for high coverage in critical areas:

- **Email Generation**: >90% coverage
- **Profile Scraping**: >85% coverage
- **UI Components**: >80% coverage
- **Error Handling**: >95% coverage

View current coverage:
```bash
npx jest --coverage
open coverage/index.html
```

## 🛠️ Writing New Tests

### When to Add Tests

**Always add tests when:**
- Adding new features
- Fixing bugs
- Modifying existing functionality
- Adding new API integrations

### Test Structure

Follow this pattern for new tests:

```javascript
describe('FeatureName', () => {
  beforeEach(() => {
    // Setup mocks and test data
    jest.clearAllMocks();
    mockChromeAPIs();
  });

  describe('specific functionality', () => {
    it('should handle normal case', () => {
      // Test the happy path
    });

    it('should handle error case', () => {
      // Test error scenarios
    });

    it('should handle edge cases', () => {
      // Test boundary conditions
    });
  });
});
```

### Using Test Utilities

The test suite provides helpful utilities in `tests/helpers/test-utils.js`:

```javascript
// Create mock LinkedIn profile
const profile = createMockLinkedInProfile({
  name: 'Test User',
  company: 'Test Corp',
  email: 'test@example.com'
});

// Create mock UI elements
const ui = createMockLinkMailUI({ currentView: 'splash' });

// Mock Chrome APIs
mockChromeAPIs({
  authenticated: true,
  userData: { name: 'Test User' }
});
```

## 🚨 Critical Test Scenarios

### Email Generation Robustness

These tests ensure the recent improvements to email generation are working:

```javascript
// Test API response format flexibility
it('should handle different API response structures', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({
      response: 'Subject$$$Body'  // Different structure
    })
  });
  
  const result = await ProfileScraper.generateColdEmail(profileData, template);
  expect(result.subject).toBe('Subject');
});

// Test error recovery
it('should provide helpful fallback when API fails', async () => {
  fetch.mockRejectedValueOnce(new Error('API Error'));
  
  const result = await ProfileScraper.generateColdEmail(profileData, template);
  expect(result.email).toContain('An error occurred');
  expect(result.email).toContain('As a fallback');
});
```

### Template Processing Accuracy

```javascript
// Test complex template processing
it('should process complex templates with multiple placeholders', async () => {
  const complexTemplate = {
    content: 'Hi [First Name], I saw [company work]. [connect experience].'
  };
  
  // Verify all placeholders are replaced correctly
});
```

## 🔄 Continuous Testing

### Pre-commit Testing

Run these before committing changes:

```bash
# Quick validation
npm test

# Full test suite with coverage
node tests/run-all-tests.js

# Check specific areas you modified
npx jest tests/content/profile-scraper.test.js --coverage
```

### Test-Driven Development

1. **Write tests first** for new features
2. **Run tests** to see them fail
3. **Implement feature** to make tests pass
4. **Refactor** while keeping tests green

### Regression Testing

Before releasing:

```bash
# Run all tests
node tests/run-all-tests.js

# Check coverage
npx jest --coverage

# Run end-to-end tests
npx playwright test
```

## 🐛 Debugging Test Failures

### Common Issues

1. **Mock not working**: Check if mocks are properly reset in `beforeEach`
2. **Async timing**: Use `await` or proper Promise handling
3. **DOM cleanup**: Ensure `document.body.innerHTML = ''` in cleanup
4. **Chrome API mocks**: Verify `mockChromeAPIs()` is called

### Debugging Tips

```javascript
// Add debugging to tests
it('should work correctly', async () => {
  console.log('Debug data:', testData);
  
  const result = await functionUnderTest();
  
  console.log('Result:', result);
  expect(result).toBe(expected);
});

// Use Jest's verbose mode
npx jest --verbose tests/specific-test.js
```

## 📋 Test Checklist

Before adding new features, ensure you have tests for:

- [ ] **Happy path scenarios** - Normal usage works
- [ ] **Error scenarios** - Graceful error handling
- [ ] **Edge cases** - Boundary conditions and unusual inputs
- [ ] **Integration points** - How your feature interacts with others
- [ ] **User workflows** - Complete end-to-end scenarios
- [ ] **Performance** - No memory leaks or hanging promises
- [ ] **Accessibility** - UI components work with assistive technology

## 🎯 Best Practices

1. **Test behavior, not implementation** - Focus on what the code does, not how
2. **Keep tests independent** - Tests should not depend on each other
3. **Use descriptive test names** - Make it clear what's being tested
4. **Mock external dependencies** - Don't rely on real APIs or services
5. **Test error paths** - Ensure graceful degradation
6. **Maintain test performance** - Keep test suite running quickly

## 📈 Monitoring Test Health

- **Coverage trends**: Aim to maintain or improve coverage over time
- **Test runtime**: Keep the full suite under 30 seconds
- **Flaky tests**: Investigate and fix tests that intermittently fail
- **Test maintenance**: Update tests when features change

---

This comprehensive test suite ensures that your LinkMail extension remains stable and reliable as you continue to add new features. The tests serve as both verification and documentation of how the system should behave. 