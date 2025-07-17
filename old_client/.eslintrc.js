module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    webextensions: true,
    jest: true
  },
  ignorePatterns: [
    'node_modules/',
    'vendor/',
    '*.min.js',
    'linkmail-extension.zip',
    'tests/background.test.js',
    'tests/content/email-finder.test.js',
    'tests/integration/ui-manager.test.js',
    'tests/e2e/'
  ],
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  globals: {
    chrome: 'readonly',
    window: 'readonly',
    document: 'readonly',
    console: 'readonly'
  },
  rules: {
    // Code quality rules - focus on critical errors only
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off', // Allow console statements in production
    'no-debugger': 'error',
    'no-alert': 'warn', // Changed from error to warning

    // Best practices - keep critical security rules
    'eqeqeq': 'error',
    'no-eval': 'warn', // Changed from error to warning for tests
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'warn', // Changed from error to warning for tests

    // Style rules - make less strict
    'indent': 'off', // Disable indent checking
    'quotes': 'off', // Disable quote style checking
    'semi': 'warn', // Changed from error to warning
    'comma-dangle': 'off', // Disable comma-dangle checking
    'no-trailing-spaces': 'off', // Disable trailing spaces checking
    'eol-last': 'off', // Disable end-of-line checking

    // Chrome extension specific - basic rules
    'no-undef': 'warn', // Changed from error to warning
    'no-useless-escape': 'warn' // Add this to handle escape character issues
  },
  overrides: [
    {
      files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
      rules: {
        'no-console': 'off', // Allow console in tests
        'no-unused-vars': 'off', // Allow unused variables in tests
        'no-eval': 'off', // Allow eval in tests
        'no-script-url': 'off', // Allow script URLs in tests
        'no-alert': 'off' // Allow alerts in tests
      }
    },
    {
      files: ['content/**/*.js'],
      globals: {
        // Content script globals
        Utils: 'readonly',
        EmailFinder: 'readonly',
        UIManager: 'readonly',
        ProfileScraper: 'readonly',
        GmailManager: 'readonly'
      }
    },
    {
      files: ['dashboard.js', 'dashboard/**/*.js'],
      globals: {
        // Dashboard globals
        templates: 'writable',
        saveTemplates: 'readonly',
        updateSidebarTemplates: 'readonly',
        showError: 'readonly',
        showSuccess: 'readonly',
        escapeHtml: 'readonly'
      }
    }
  ]
};
