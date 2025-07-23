#!/usr/bin/env node

/**
 * Integration Test Runner
 * 
 * Runs all integration tests for the model rotation system
 */

import { runIntegrationTests } from './model-rotation-integration.test.js';
import { runPerformanceTests } from './performance-load.test.js';

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
 * Main integration test runner
 */
async function runAllIntegrationTests() {
  console.log(`${colors.bright}${colors.magenta}🚀 Starting All Integration Tests${colors.reset}`);
  console.log('='.repeat(60));

  const testSuites = [
    { name: 'Model Rotation Integration', fn: runIntegrationTests },
    { name: 'Performance and Load Testing', fn: runPerformanceTests }
  ];

  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of testSuites) {
    console.log(`\n${colors.cyan}📁 Running ${suite.name}...${colors.reset}`);
    
    try {
      const success = await suite.fn();
      if (success) {
        totalPassed++;
        console.log(`${colors.green}✅ ${suite.name} - PASSED${colors.reset}`);
      } else {
        totalFailed++;
        console.log(`${colors.red}❌ ${suite.name} - FAILED${colors.reset}`);
      }
    } catch (error) {
      totalFailed++;
      console.log(`${colors.red}❌ ${suite.name} - ERROR: ${error.message}${colors.reset}`);
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bright}${colors.magenta}📊 Integration Test Summary${colors.reset}`);
  console.log('='.repeat(60));
  console.log(`${colors.green}✅ Passed: ${totalPassed}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${totalFailed}${colors.reset}`);
  console.log(`${colors.blue}📋 Total: ${testSuites.length}${colors.reset}`);
  console.log('='.repeat(60));

  if (totalFailed === 0) {
    console.log(`${colors.bright}${colors.green}🎉 All integration tests passed!${colors.reset}`);
  } else {
    console.log(`${colors.bright}${colors.red}💥 Some integration tests failed!${colors.reset}`);
  }

  return totalFailed === 0;
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllIntegrationTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(`${colors.red}💥 Integration test runner failed: ${error.message}${colors.reset}`);
      process.exit(1);
    });
}

export { runAllIntegrationTests }; 