#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, description) {
  log(`\n${colors.bold}🔄 ${description}${colors.reset}`, 'blue');
  try {
    execSync(command, { stdio: 'inherit' });
    log(`✅ ${description} completed successfully`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${description} failed`, 'red');
    return false;
  }
}

function checkFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`✅ ${description} exists`, 'green');
    return true;
  } else {
    log(`❌ ${description} not found at ${filePath}`, 'red');
    return false;
  }
}

async function runTestSuite(suite) {
  log(`\n${colors.bold}🧪 Running ${suite.toUpperCase()} Tests${colors.reset}`, 'cyan');

  switch (suite) {
  case 'unit':
    return runCommand('npm test', 'Unit Tests');

  case 'integration':
    return runCommand('npm test -- --testPathPattern=integration', 'Integration Tests');

  case 'e2e':
    log('Installing Playwright browsers...', 'yellow');
    runCommand('npx playwright install chromium', 'Browser Installation');
    return runCommand('npm run test:e2e', 'End-to-End Tests');

  case 'lint':
    return runCommand('npm run lint', 'Code Linting');

  case 'coverage':
    return runCommand('npm test -- --coverage --watchAll=false', 'Test Coverage Report');

  case 'build':
    return runCommand('npm run build', 'Extension Build Test');

  case 'security':
    return runCommand('npm audit --audit-level high', 'Security Audit');

  default:
    log(`Unknown test suite: ${suite}`, 'red');
    return false;
  }
}

async function runAllTests() {
  log(`\n${colors.bold}🚀 Running Complete Test Suite${colors.reset}`, 'magenta');

  const testSuites = [
    'lint',
    'unit',
    'integration',
    'build',
    'security'
  ];

  let allPassed = true;
  const results = {};

  for (const suite of testSuites) {
    const passed = await runTestSuite(suite);
    results[suite] = passed;
    allPassed = allPassed && passed;
  }

  // Print summary
  log(`\n${colors.bold}📊 Test Summary${colors.reset}`, 'cyan');
  for (const [suite, passed] of Object.entries(results)) {
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    const color = passed ? 'green' : 'red';
    log(`  ${suite.padEnd(12)}: ${status}`, color);
  }

  if (allPassed) {
    log('\n🎉 All tests passed! Extension is ready for deployment.', 'green');
  } else {
    log('\n🚨 Some tests failed. Please fix the issues before deploying.', 'red');
    process.exit(1);
  }
}

async function preCommitHook() {
  log(`\n${colors.bold}🔍 Running Pre-commit Checks${colors.reset}`, 'yellow');

  const checks = [
    { name: 'lint', description: 'Code Style Check' },
    { name: 'unit', description: 'Unit Tests' }
  ];

  let allPassed = true;

  for (const check of checks) {
    const passed = await runTestSuite(check.name);
    allPassed = allPassed && passed;
  }

  if (allPassed) {
    log('\n✅ Pre-commit checks passed. Ready to commit!', 'green');
  } else {
    log('\n❌ Pre-commit checks failed. Please fix the issues before committing.', 'red');
    process.exit(1);
  }
}

function setupTestEnvironment() {
  log(`\n${colors.bold}⚙️  Setting up Test Environment${colors.reset}`, 'cyan');

  // Check if all required files exist
  const requiredFiles = [
    { path: 'package.json', description: 'Package configuration' },
    { path: 'jest.config.js', description: 'Jest configuration' },
    { path: 'playwright.config.js', description: 'Playwright configuration' },
    { path: '.eslintrc.js', description: 'ESLint configuration' },
    { path: 'tests/setup.js', description: 'Test setup file' }
  ];

  let allFilesExist = true;

  for (const file of requiredFiles) {
    const exists = checkFileExists(file.path, file.description);
    allFilesExist = allFilesExist && exists;
  }

  if (!allFilesExist) {
    log('\n❌ Test environment setup incomplete. Please ensure all required files exist.', 'red');
    return false;
  }

  // Install dependencies if needed
  if (!fs.existsSync('node_modules')) {
    log('\n📦 Installing dependencies...', 'yellow');
    runCommand('npm install', 'Dependency Installation');
  }

  log('\n✅ Test environment is ready!', 'green');
  return true;
}

function showHelp() {
  log(`\n${colors.bold}LinkMail Extension Test Runner${colors.reset}`, 'cyan');
  log('\nUsage: node scripts/test-runner.js [command]', 'blue');
  log('\nAvailable commands:', 'blue');
  log('  unit        Run unit tests only');
  log('  integration Run integration tests only');
  log('  e2e         Run end-to-end tests only');
  log('  lint        Run code linting only');
  log('  coverage    Generate test coverage report');
  log('  build       Test extension build process');
  log('  security    Run security audit');
  log('  all         Run complete test suite');
  log('  pre-commit  Run pre-commit checks');
  log('  setup       Setup test environment');
  log('  help        Show this help message');
  log('\nExamples:', 'yellow');
  log('  node scripts/test-runner.js unit');
  log('  node scripts/test-runner.js all');
  log('  node scripts/test-runner.js pre-commit');
}

async function main() {
  const command = process.argv[2] || 'help';

  log(`${colors.bold}LinkMail Extension Test Runner${colors.reset}`, 'magenta');

  switch (command) {
  case 'setup':
    setupTestEnvironment();
    break;

  case 'all':
    await runAllTests();
    break;

  case 'pre-commit':
    await preCommitHook();
    break;

  case 'unit':
  case 'integration':
  case 'e2e':
  case 'lint':
  case 'coverage':
  case 'build':
  case 'security':
    await runTestSuite(command);
    break;

  case 'help':
  default:
    showHelp();
    break;
  }
}

// Run the main function
main().catch(error => {
  log(`\n💥 Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
