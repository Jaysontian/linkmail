# Testing Documentation for LinkMail Extension

## Overview

This document provides comprehensive information about testing the LinkMail Chrome extension. The testing strategy ensures functionality works correctly and prevents regressions when adding new features.

## Testing Strategy

### 1. **Unit Tests**
- **Purpose**: Test individual functions and components in isolation
- **Framework**: Jest with jsdom environment
- **Location**: `tests/` directory
- **Coverage**: Utilities, email finding, background script functionality

### 2. **Integration Tests**
- **Purpose**: Test how components work together
- **Framework**: Jest with Chrome extension mocks
- **Location**: `tests/integration/` directory
- **Coverage**: UI Manager integration, authentication flows, data persistence

### 3. **End-to-End Tests**
- **Purpose**: Test complete user workflows
- **Framework**: Playwright with Chrome extension support
- **Location**: `tests/e2e/` directory
- **Coverage**: Extension loading, LinkedIn integration, dashboard functionality

### 4. **Code Quality**
- **Linting**: ESLint with Chrome extension rules
- **Security**: npm audit for vulnerabilities
- **Build**: Verification that extension builds correctly

## Quick Start

### Setup Testing Environment

```bash
# Install dependencies
npm install

# Setup test environment
node scripts/test-runner.js setup
```

### Running Tests

```bash
# Run all tests
npm run test:all
# or
node scripts/test-runner.js all

# Run specific test types
npm test                    # Unit tests
npm run test:e2e           # E2E tests
npm run lint               # Code linting
node scripts/test-runner.js coverage  # Coverage report
```

## Test Commands Reference

| Command | Description |
|---------|-------------|
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run test:e2e:headed` | Run E2E tests with browser UI |
| `npm run test:all` | Run complete test suite |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues automatically |

## Test Structure

```
tests/
├── setup.js                 # Jest setup and mocks
├── helpers/
│   └── test-utils.js        # Test utilities and fixtures
├── content/
│   ├── utils.test.js        # Utility function tests
│   ├── email-finder.test.js # Email finding tests
│   └── ui-manager.test.js   # UI Manager tests
├── integration/
│   └── ui-manager.test.js   # Integration tests
├── e2e/
│   └── extension-basic.spec.js # End-to-end tests
└── background.test.js       # Background script tests
```

## Writing Tests

### Unit Test Example

```javascript
// tests/utils.test.js
describe('Utils', () => {
  test('should extract email from text', () => {
    const text = 'Contact me at john@example.com';
    const result = Utils.extractEmail(text);
    expect(result).toBe('john@example.com');
  });
});
```

### Integration Test Example

```javascript
// tests/integration/auth-flow.test.js
describe('Authentication Flow', () => {
  test('should handle complete auth flow', async () => {
    mockChromeAPIs({ authenticated: true });
    await UIManager.checkAuthStatus();
    expect(UIManager.isAuthenticated).toBe(true);
  });
});
```

### E2E Test Example

```javascript
// tests/e2e/linkedin-integration.spec.js
test('should inject extension on LinkedIn', async () => {
  await page.goto('https://linkedin.com/in/test-profile');
  const hasExtension = await page.evaluate(() => {
    return typeof window.UIManager !== 'undefined';
  });
  expect(hasExtension).toBe(true);
});
```

## Test Utilities

### Available Test Helpers

```javascript
const {
  createMockLinkedInProfile,
  createMockContactModal,
  createMockLinkMailUI,
  mockChromeAPIs,
  waitFor,
  createTestEmailHistory,
  createTestTemplates,
  simulateDelay
} = require('./tests/helpers/test-utils');
```

### Chrome API Mocking

```javascript
// Mock authenticated user
mockChromeAPIs({
  authenticated: true,
  userData: { email: 'test@example.com', name: 'Test User' },
  storageData: { 'test@example.com': { /* user data */ } }
});
```

### DOM Mocking

```javascript
// Create mock LinkedIn profile
const profile = createMockLinkedInProfile({
  name: 'John Doe',
  email: 'john@example.com'
});

// Cleanup after test
afterEach(() => {
  profile.cleanup();
});
```

## Pre-commit Hooks

Set up pre-commit hooks to run tests automatically:

```bash
# Add to .git/hooks/pre-commit
#!/bin/sh
node scripts/test-runner.js pre-commit
```

## Continuous Integration

Tests run automatically on:
- Push to main/develop branches
- Pull requests
- Release creation

See `.github/workflows/test.yml` for CI configuration.

## Test Coverage

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

### Coverage Targets

- **Unit Tests**: >90% code coverage
- **Integration Tests**: >80% feature coverage
- **E2E Tests**: >70% user workflow coverage

## Best Practices

### 1. Test Organization

- Group related tests using `describe` blocks
- Use descriptive test names
- Keep tests isolated and independent
- Clean up DOM modifications after each test

### 2. Mocking Strategy

- Mock Chrome APIs consistently
- Use test utilities for common mocks
- Mock external dependencies (fetch, APIs)
- Avoid mocking internal application logic

### 3. Async Testing

```javascript
// Proper async test handling
test('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expectedValue);
});

// Wait for conditions
await waitFor(() => element.isVisible());
```

### 4. Error Testing

```javascript
test('should handle errors gracefully', async () => {
  chrome.runtime.lastError = { message: 'Test error' };
  
  const result = await functionThatMightFail();
  
  expect(result).toBe(false);
  delete chrome.runtime.lastError;
});
```

## Debugging Tests

### Debug Failed Tests

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- tests/content/utils.test.js

# Debug with Node.js debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

### E2E Test Debugging

```bash
# Run E2E tests with browser UI
npm run test:e2e:headed

# Debug specific test
npx playwright test --debug tests/e2e/extension-basic.spec.js
```

## Troubleshooting

### Common Issues

1. **Chrome extension context errors**
   - Solution: Check Chrome API mocks are properly configured

2. **DOM manipulation tests failing**
   - Solution: Ensure proper cleanup in `afterEach` hooks

3. **E2E tests timing out**
   - Solution: Increase timeout or add proper wait conditions

4. **Coverage reports not generating**
   - Solution: Check Jest configuration and file paths

### Getting Help

- Check existing tests for examples
- Review test utilities in `tests/helpers/`
- Consult Jest and Playwright documentation
- Use the test runner's help: `node scripts/test-runner.js help`

## Feature Development Workflow

When adding new features:

1. **Write Tests First** (TDD approach)
   ```bash
   # Create test file
   touch tests/new-feature.test.js
   
   # Write failing test
   # Implement feature
   # Make test pass
   ```

2. **Run Tests During Development**
   ```bash
   # Watch mode for rapid feedback
   npm run test:watch
   ```

3. **Verify Before Committing**
   ```bash
   # Run pre-commit checks
   node scripts/test-runner.js pre-commit
   ```

4. **Integration Testing**
   ```bash
   # Run full test suite
   node scripts/test-runner.js all
   ```

## Conclusion

This testing infrastructure ensures:
- ✅ **Functionality works correctly** across all components
- ✅ **Regressions are caught early** before they reach users
- ✅ **Code quality is maintained** through linting and standards
- ✅ **Security vulnerabilities are detected** automatically
- ✅ **New features don't break existing functionality**

The testing strategy provides confidence when adding new features and ensures the LinkMail extension remains reliable and high-quality.

## Next Steps

1. Run the initial test setup: `node scripts/test-runner.js setup`
2. Install dependencies: `npm install`
3. Run the complete test suite: `node scripts/test-runner.js all`
4. Set up pre-commit hooks for automated testing
5. Configure CI/CD pipeline for automated testing on commits

Happy testing! 🧪✨ 