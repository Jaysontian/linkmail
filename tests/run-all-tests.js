#!/usr/bin/env node

/**
 * Comprehensive test runner for LinkMail extension
 * This script runs all tests and provides detailed coverage information
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 LinkMail Extension Test Suite');
console.log('==================================\n');

// Test categories to run
const testCategories = [
  {
    name: 'Unit Tests - Profile Scraper',
    pattern: 'tests/content/profile-scraper.test.js',
    description: 'Tests core email generation and profile data extraction'
  },
  {
    name: 'Unit Tests - UI Manager',
    pattern: 'tests/content/ui-manager.test.js',
    description: 'Tests user interface interactions and template management'
  },
  {
    name: 'Unit Tests - Email Finder',
    pattern: 'tests/content/email-finder.test.js',
    description: 'Tests email extraction from LinkedIn and Apollo integration'
  },
  {
    name: 'Unit Tests - Utilities',
    pattern: 'tests/content/utils.test.js',
    description: 'Tests utility functions and helpers'
  },
  {
    name: 'Integration Tests',
    pattern: 'tests/integration/*.test.js',
    description: 'Tests end-to-end workflows and component interactions'
  },
  {
    name: 'Background Script Tests',
    pattern: 'tests/background-simple.test.js',
    description: 'Tests Chrome extension background script functionality'
  },
  {
    name: 'Apollo Integration Tests',
    pattern: 'tests/apollo-integration.test.js',
    description: 'Tests Apollo API integration for email finding'
  }
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let skippedTests = 0;

function runTestCategory(category) {
  console.log(`\n📋 Running: ${category.name}`);
  console.log(`   ${category.description}`);
  console.log(`   Pattern: ${category.pattern}\n`);

  try {
    const result = execSync(
      `npx jest "${category.pattern}" --verbose --coverage=false --passWithNoTests`,
      { encoding: 'utf8', stdio: 'pipe' }
    );

    // Parse Jest output for test counts
    const lines = result.split('\n');
    for (const line of lines) {
      if (line.includes('Tests:')) {
        const matches = line.match(/(\d+) passed/);
        if (matches) {
          const categoryPassed = parseInt(matches[1]);
          passedTests += categoryPassed;
          totalTests += categoryPassed;
          console.log(`✅ ${categoryPassed} tests passed`);
        }
        
        const failedMatches = line.match(/(\d+) failed/);
        if (failedMatches) {
          const categoryFailed = parseInt(failedMatches[1]);
          failedTests += categoryFailed;
          totalTests += categoryFailed;
          console.log(`❌ ${categoryFailed} tests failed`);
        }

        const skippedMatches = line.match(/(\d+) skipped/);
        if (skippedMatches) {
          const categorySkipped = parseInt(skippedMatches[1]);
          skippedTests += categorySkipped;
          console.log(`⏭️  ${categorySkipped} tests skipped`);
        }
      }
    }

    return true;
  } catch (error) {
    console.log(`❌ Tests failed with error:`);
    console.log(error.stdout || error.message);
    
    // Try to extract test counts from error output
    const errorOutput = error.stdout || '';
    const lines = errorOutput.split('\n');
    for (const line of lines) {
      if (line.includes('Tests:')) {
        const failedMatches = line.match(/(\d+) failed/);
        if (failedMatches) {
          const categoryFailed = parseInt(failedMatches[1]);
          failedTests += categoryFailed;
          totalTests += categoryFailed;
        }
      }
    }
    
    return false;
  }
}

function generateCoverageReport() {
  console.log('\n📊 Generating Coverage Report...\n');
  
  try {
    const result = execSync(
      'npx jest --coverage --coverageReporters=text --coverageReporters=html',
      { encoding: 'utf8', stdio: 'pipe' }
    );
    
    console.log('Coverage report generated successfully!');
    console.log('HTML report available at: coverage/index.html\n');
    
    // Extract coverage summary from output
    const lines = result.split('\n');
    let inCoverageSection = false;
    
    for (const line of lines) {
      if (line.includes('Coverage summary')) {
        inCoverageSection = true;
      } else if (inCoverageSection && line.includes('All files')) {
        console.log('📈 Coverage Summary:');
        console.log(line);
        break;
      }
    }
    
  } catch (error) {
    console.log('⚠️  Could not generate coverage report');
    console.log(error.message);
  }
}

function checkTestFiles() {
  console.log('🔍 Checking test file existence...\n');
  
  const expectedTestFiles = [
    'tests/content/profile-scraper.test.js',
    'tests/content/ui-manager.test.js', 
    'tests/content/email-finder.test.js',
    'tests/content/utils.test.js',
    'tests/helpers/test-utils.js',
    'tests/setup.js'
  ];

  let missingFiles = [];
  
  for (const file of expectedTestFiles) {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} (missing)`);
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    console.log(`\n⚠️  ${missingFiles.length} test files are missing.`);
    console.log('These files should be created to ensure complete test coverage.\n');
  } else {
    console.log('\n✅ All expected test files are present!\n');
  }

  return missingFiles.length === 0;
}

function printSummary() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`⏭️  Skipped: ${skippedTests}`);
  
  const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;
  console.log(`📈 Success Rate: ${successRate}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 All tests passed! Your code is well protected against regressions.');
  } else {
    console.log(`\n⚠️  ${failedTests} tests failed. Please review and fix failing tests.`);
  }
  
  console.log('\n💡 Next steps:');
  console.log('  - Run individual test suites: npx jest <test-file>');
  console.log('  - Run tests in watch mode: npx jest --watch');
  console.log('  - View coverage report: open coverage/index.html');
  console.log('  - Add more tests for new features to maintain coverage');
}

// Main execution
async function main() {
  // Check if all test files exist
  const allFilesPresent = checkTestFiles();
  
  if (!allFilesPresent) {
    console.log('Some test files are missing. Please create them first.');
    process.exit(1);
  }

  // Run all test categories
  console.log('Starting test execution...\n');
  
  for (const category of testCategories) {
    const success = runTestCategory(category);
    
    if (!success) {
      console.log(`\n⚠️  Category "${category.name}" had test failures.`);
    }
  }

  // Generate coverage report
  generateCoverageReport();

  // Print final summary
  printSummary();

  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = { runTestCategory, checkTestFiles }; 