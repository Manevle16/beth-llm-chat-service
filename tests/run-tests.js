#!/usr/bin/env node

/**
 * Test Runner Script
 * 
 * This script runs all tests in the project, organized by category.
 * Usage:
 *   node tests/run-tests.js                    # Run all tests
 *   node tests/run-tests.js unit               # Run only unit tests
 *   node tests/run-tests.js integration        # Run only integration tests
 *   node tests/run-tests.js scripts            # Run only script tests
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Test categories
const TEST_CATEGORIES = {
  unit: 'tests/unit',
  integration: 'tests/integration',
  scripts: 'tests/scripts'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Get all test files in a directory
 * @param {string} dirPath - Directory path
 * @returns {Promise<string[]>} Array of test file paths
 */
async function getTestFiles(dirPath) {
  try {
    const files = await readdir(dirPath);
    return files
      .filter(file => extname(file) === '.js' && file.includes('.test.'))
      .map(file => join(dirPath, file));
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Directory ${dirPath} not found or empty${colors.reset}`);
    return [];
  }
}

/**
 * Run a single test file
 * @param {string} testFile - Path to test file
 * @returns {Promise<boolean>} Success status
 */
async function runTestFile(testFile) {
  try {
    console.log(`${colors.blue}🧪 Running: ${testFile}${colors.reset}`);
    
    // Use dynamic import with file:// protocol
    const testModule = await import(`file://${process.cwd()}/${testFile}`);
    
    // If the module has a default export that's a function, call it
    if (typeof testModule.default === 'function') {
      await testModule.default();
    }
    
    console.log(`${colors.green}✅ Passed: ${testFile}${colors.reset}\n`);
    return true;
  } catch (error) {
    console.log(`${colors.red}❌ Failed: ${testFile}${colors.reset}`);
    console.log(`${colors.red}   Error: ${error.message}${colors.reset}\n`);
    return false;
  }
}

/**
 * Run all tests in a category
 * @param {string} category - Test category
 * @returns {Promise<{passed: number, failed: number, total: number}>} Test results
 */
async function runTestCategory(category) {
  const dirPath = TEST_CATEGORIES[category];
  if (!dirPath) {
    console.log(`${colors.red}❌ Unknown test category: ${category}${colors.reset}`);
    return { passed: 0, failed: 0, total: 0 };
  }

  console.log(`${colors.bright}${colors.cyan}📁 Running ${category} tests...${colors.reset}\n`);
  
  const testFiles = await getTestFiles(dirPath);
  if (testFiles.length === 0) {
    console.log(`${colors.yellow}⚠️  No test files found in ${category}${colors.reset}\n`);
    return { passed: 0, failed: 0, total: 0 };
  }

  let passed = 0;
  let failed = 0;

  for (const testFile of testFiles) {
    const success = await runTestFile(testFile);
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }

  return { passed, failed, total: testFiles.length };
}

/**
 * Run all tests
 * @returns {Promise<void>}
 */
async function runAllTests() {
  console.log(`${colors.bright}${colors.magenta}🚀 Starting Test Suite${colors.reset}\n`);

  const startTime = Date.now();
  let totalPassed = 0;
  let totalFailed = 0;
  let totalTests = 0;

  // Run each test category
  for (const category of Object.keys(TEST_CATEGORIES)) {
    const results = await runTestCategory(category);
    totalPassed += results.passed;
    totalFailed += results.failed;
    totalTests += results.total;
  }

  const endTime = Date.now();
  const duration = endTime - startTime;

  // Print summary
  console.log(`${colors.bright}${colors.magenta}📊 Test Summary${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.green}✅ Passed: ${totalPassed}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${totalFailed}${colors.reset}`);
  console.log(`${colors.blue}📋 Total: ${totalTests}${colors.reset}`);
  console.log(`${colors.yellow}⏱️  Duration: ${duration}ms${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

  if (totalFailed === 0) {
    console.log(`${colors.bright}${colors.green}🎉 All tests passed!${colors.reset}`);
  } else {
    console.log(`${colors.bright}${colors.red}💥 Some tests failed!${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const category = args[0];

  if (category) {
    // Run specific category
    const results = await runTestCategory(category);
    console.log(`${colors.bright}${colors.magenta}📊 ${category} Test Summary${colors.reset}`);
    console.log(`${colors.green}✅ Passed: ${results.passed}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${results.failed}${colors.reset}`);
    console.log(`${colors.blue}📋 Total: ${results.total}${colors.reset}`);
    
    if (results.failed > 0) {
      process.exit(1);
    }
  } else {
    // Run all tests
    await runAllTests();
  }
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(`${colors.red}💥 Test runner failed: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

export { runAllTests, runTestCategory, runTestFile }; 