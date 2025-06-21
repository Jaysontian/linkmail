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
    // Code quality rules
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',

    // Best practices
    'eqeqeq': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',

    // Style rules
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'no-trailing-spaces': 'error',
    'eol-last': 'error',

    // Chrome extension specific - basic rules
    'no-undef': 'error'
  },
  overrides: [
    {
      files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
      rules: {
        'no-console': 'off' // Allow console in tests
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
    }
  ]
};
