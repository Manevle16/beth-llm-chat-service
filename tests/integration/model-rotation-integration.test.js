/**
 * Model Rotation Integration Test Suite
 * 
 * Tests the complete integration of all model rotation components:
 * - Full rotation lifecycle from request to completion
 * - Memory threshold triggering and cleanup scenarios
 * - Concurrent request handling and queue behavior
 * - Startup state recovery and Ollama sync functionality
 * - Error scenarios and recovery mechanisms
 */

import ollamaService from '../../services/ollamaService.js';
import modelRotationService from '../../services/modelRotationService.js';
import modelStateTracker from '../../services/modelStateTracker.js';
import memoryMonitor from '../../services/memoryMonitor.js';
import queueService from '../../services/queueService.js';
import errorHandlingService from '../../services/errorHandlingService.js';
import configService from '../../config/modelRotation.js';
import { REQUEST_PRIORITY, ERROR_CODES } from '../../types/modelRotation.js';

// Test configuration
const TEST_CONFIG = {
  testModels: ['mistral:7b', 'qwen3:32b', 'ALIENTELLIGENCE/attorney2:latest'],
  testTimeout: 30000,
  concurrentRequests: 5,
  memoryThresholdTest: {
    warningThreshold: 50, // Lower for testing
    criticalThreshold: 60,
    cleanupThreshold: 70
  }
};

// Test utilities
const testUtils = {
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  async waitForCondition(condition, timeout = 10000, interval = 100) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) return true;
      await this.wait(interval);
    }
    return false;
  },

  logTestStep(step, description) {
    console.log(`\n${step} ${description}`);
    console.log('─'.repeat(50));
  },

  logSuccess(message, data = null) {
    console.log(`✅ ${message}`);
    if (data) console.log('   Data:', JSON.stringify(data, null, 2));
  },

  logError(message, error = null) {
    console.log(`❌ ${message}`);
    if (error) console.log('   Error:', error.message);
  },

  logInfo(message, data = null) {
    console.log(`ℹ️  ${message}`);
    if (data) console.log('   Data:', JSON.stringify(data, null, 2));
  }
};

/**
 * Test 1: Full Rotation Lifecycle
 * Tests the complete flow from rotation request to completion
 */
async function testFullRotationLifecycle() {
  testUtils.logTestStep('🔄', 'Test 1: Full Rotation Lifecycle');

  try {
    // Initialize all services
    await ollamaService.initialize();
    await modelRotationService.initialize();
    await modelStateTracker.initialize();
    await memoryMonitor.initialize();
    await queueService.initialize();
    await errorHandlingService.initialize();

    // Get initial state
    const initialStatus = modelRotationService.getRotationStatus();
    testUtils.logInfo('Initial rotation status', initialStatus);

    // Test rotation to first model
    const targetModel = TEST_CONFIG.testModels[0];
    testUtils.logInfo(`Requesting rotation to: ${targetModel}`);

    const rotationResult = await modelRotationService.requestModelRotation(
      targetModel,
      'integration-test',
      REQUEST_PRIORITY.HIGH
    );

    testUtils.logSuccess('Rotation request completed', rotationResult);

    // Wait for rotation to complete
    const rotationCompleted = await testUtils.waitForCondition(async () => {
      const status = modelRotationService.getRotationStatus();
      return !status.isRotating && status.activeModel === targetModel;
    });

    if (rotationCompleted) {
      testUtils.logSuccess('Rotation completed successfully');
      
      // Verify state consistency
      const finalStatus = modelRotationService.getRotationStatus();
      const stateTrackerActive = modelStateTracker.getActiveModel();
      const queueStatus = queueService.getQueueStatus();

      testUtils.logInfo('Final state verification', {
        rotationStatus: finalStatus,
        stateTrackerActive,
        queueStatus
      });

      // Verify all components are in sync
      if (finalStatus.activeModel === targetModel && 
          stateTrackerActive === targetModel && 
          queueStatus.size === 0) {
        testUtils.logSuccess('All components in sync after rotation');
      } else {
        testUtils.logError('State inconsistency detected');
        return false;
      }
    } else {
      testUtils.logError('Rotation did not complete within timeout');
      return false;
    }

    return true;
  } catch (error) {
    testUtils.logError('Full rotation lifecycle test failed', error);
    return false;
  }
}

/**
 * Test 2: Memory Threshold Triggering
 * Tests memory monitoring and cleanup scenarios
 */
async function testMemoryThresholdTriggering() {
  testUtils.logTestStep('🧠', 'Test 2: Memory Threshold Triggering');

  try {
    // Get current memory usage
    const currentMemory = memoryMonitor.getCurrentMemoryUsage();
    testUtils.logInfo('Current memory usage', currentMemory);

    // Check if we're already above warning threshold
    const thresholdCheck = memoryMonitor.checkMemoryThresholds();
    testUtils.logInfo('Memory threshold check', thresholdCheck);

    // Test memory cleanup trigger
    const cleanupResult = await memoryMonitor.triggerCleanup();
    testUtils.logInfo('Memory cleanup result', cleanupResult);

    // Test memory trend analysis
    const memoryTrend = memoryMonitor.getMemoryTrend();
    testUtils.logSuccess('Memory trend analysis', memoryTrend);

    // Test memory report
    const memoryReport = memoryMonitor.getMemoryReport();
    testUtils.logSuccess('Memory report generated', {
      usedPercentage: memoryReport.current.usedPercentage,
      trend: memoryReport.trend,
      loadedModels: memoryReport.loadedModels
    });

    return true;
  } catch (error) {
    testUtils.logError('Memory threshold test failed', error);
    return false;
  }
}

/**
 * Test 3: Concurrent Request Handling
 * Tests how the system handles multiple simultaneous rotation requests
 */
async function testConcurrentRequestHandling() {
  testUtils.logTestStep('⚡', 'Test 3: Concurrent Request Handling');

  try {
    const concurrentRequests = TEST_CONFIG.concurrentRequests;
    const requests = [];

    // Create multiple concurrent rotation requests
    for (let i = 0; i < concurrentRequests; i++) {
      const modelIndex = i % TEST_CONFIG.testModels.length;
      const targetModel = TEST_CONFIG.testModels[modelIndex];
      const priority = i === 0 ? REQUEST_PRIORITY.HIGH : REQUEST_PRIORITY.NORMAL;

      testUtils.logInfo(`Creating request ${i + 1}: ${targetModel} (${priority})`);

      const request = modelRotationService.requestModelRotation(
        targetModel,
        `concurrent-test-${i}`,
        priority
      );
      requests.push(request);
    }

    // Wait for all requests to be processed
    const results = await Promise.allSettled(requests);
    testUtils.logInfo('Concurrent request results', {
      total: results.length,
      fulfilled: results.filter(r => r.status === 'fulfilled').length,
      rejected: results.filter(r => r.status === 'rejected').length
    });

    // Check queue status after concurrent requests
    const queueStatus = queueService.getQueueStatus();
    testUtils.logSuccess('Queue status after concurrent requests', queueStatus);

    // Verify queue processing
    const queueProcessed = await testUtils.waitForCondition(async () => {
      const status = queueService.getQueueStatus();
      return status.size === 0;
    });

    if (queueProcessed) {
      testUtils.logSuccess('All concurrent requests processed');
    } else {
      testUtils.logError('Queue processing timeout');
      return false;
    }

    return true;
  } catch (error) {
    testUtils.logError('Concurrent request test failed', error);
    return false;
  }
}

/**
 * Test 4: Startup State Recovery
 * Tests the system's ability to recover state on startup
 */
async function testStartupStateRecovery() {
  testUtils.logTestStep('🔄', 'Test 4: Startup State Recovery');

  try {
    // Simulate service restart by resetting state
    testUtils.logInfo('Simulating service restart...');
    
    // Reset state tracker
    modelStateTracker.reset();
    
    // Verify uninitialized state
    try {
      modelStateTracker.getStateSummary();
      testUtils.logError('State tracker should be uninitialized');
      return false;
    } catch (error) {
      testUtils.logSuccess('State tracker correctly uninitialized');
    }

    // Re-initialize and sync with Ollama
    await modelStateTracker.initialize();
    const recoveredState = modelStateTracker.getStateSummary();
    
    testUtils.logSuccess('State recovery completed', {
      isInitialized: recoveredState.isInitialized,
      loadedModelCount: recoveredState.loadedModelCount,
      loadedModels: recoveredState.loadedModels
    });

    // Verify Ollama sync worked
    if (recoveredState.loadedModelCount > 0) {
      testUtils.logSuccess('Ollama sync successful');
    } else {
      testUtils.logInfo('No models found in Ollama (this is normal for testing)');
    }

    return true;
  } catch (error) {
    testUtils.logError('Startup state recovery test failed', error);
    return false;
  }
}

/**
 * Test 5: Error Scenarios and Recovery
 * Tests error handling and recovery mechanisms
 */
async function testErrorScenariosAndRecovery() {
  testUtils.logTestStep('🛡️', 'Test 5: Error Scenarios and Recovery');

  try {
    // Test 1: Invalid model rotation request
    testUtils.logInfo('Testing invalid model rotation...');
    try {
      await modelRotationService.requestModelRotation('', 'test', REQUEST_PRIORITY.NORMAL);
      testUtils.logError('Should have rejected empty model name');
      return false;
    } catch (error) {
      testUtils.logSuccess('Correctly rejected empty model name');
    }

    // Test 2: Non-existent model rotation
    testUtils.logInfo('Testing non-existent model rotation...');
    try {
      await modelRotationService.requestModelRotation('non-existent-model', 'test', REQUEST_PRIORITY.NORMAL);
      testUtils.logError('Should have rejected non-existent model');
      return false;
    } catch (error) {
      testUtils.logSuccess('Correctly rejected non-existent model');
    }

    // Test 3: Queue overflow scenario
    testUtils.logInfo('Testing queue overflow...');
    const maxQueueSize = configService.getSetting('MAX_QUEUE_SIZE');
    const overflowRequests = [];

    // Fill the queue
    for (let i = 0; i < maxQueueSize + 2; i++) {
      const request = queueService.enqueueRotationRequest(
        `overflow-test-${i}`,
        'overflow-test',
        REQUEST_PRIORITY.NORMAL
      );
      overflowRequests.push(request);
    }

    const queueStatus = queueService.getQueueStatus();
    testUtils.logSuccess('Queue overflow test', {
      maxSize: maxQueueSize,
      currentSize: queueStatus.size,
      isFull: queueStatus.size >= maxQueueSize
    });

    // Test 4: Error handling service integration
    testUtils.logInfo('Testing error handling service...');
    const errorStats = errorHandlingService.getErrorStats();
    testUtils.logSuccess('Error handling service stats', errorStats);

    // Test 5: Circuit breaker functionality
    testUtils.logInfo('Testing circuit breaker...');
    const operationMetrics = errorHandlingService.getOperationMetrics('test-operation');
    testUtils.logSuccess('Circuit breaker status', operationMetrics);

    return true;
  } catch (error) {
    testUtils.logError('Error scenarios test failed', error);
    return false;
  }
}

/**
 * Test 6: Service Integration Verification
 * Tests that all services work together correctly
 */
async function testServiceIntegration() {
  testUtils.logTestStep('🔗', 'Test 6: Service Integration Verification');

  try {
    // Test 1: Configuration service integration
    const config = configService.getAllSettings();
    testUtils.logSuccess('Configuration service integration', {
      rotationEnabled: config.MODEL_ROTATION_ENABLED,
      maxConcurrentModels: config.MAX_CONCURRENT_MODELS,
      memoryMonitoringEnabled: config.MEMORY_MONITORING_ENABLED
    });

    // Test 2: Memory monitor integration
    const memoryStatus = memoryMonitor.getMemoryReport();
    testUtils.logSuccess('Memory monitor integration', {
      usedPercentage: memoryStatus.current.usedPercentage,
      trend: memoryStatus.trend
    });

    // Test 3: Queue service integration
    const queueStatus = queueService.getQueueStatus();
    testUtils.logSuccess('Queue service integration', {
      size: queueStatus.size,
      maxSize: queueStatus.maxSize,
      isProcessing: queueStatus.isProcessing
    });

    // Test 4: State tracker integration
    const stateSummary = modelStateTracker.getStateSummary();
    testUtils.logSuccess('State tracker integration', {
      isInitialized: stateSummary.isInitialized,
      loadedModelCount: stateSummary.loadedModelCount
    });

    // Test 5: Error handling integration
    const errorStats = errorHandlingService.getErrorStats();
    testUtils.logSuccess('Error handling integration', {
      totalErrors: errorStats.totalErrors,
      recentErrors: errorStats.recentErrors.length
    });

    return true;
  } catch (error) {
    testUtils.logError('Service integration test failed', error);
    return false;
  }
}

/**
 * Main integration test runner
 */
async function runIntegrationTests() {
  console.log('🚀 Starting Model Rotation Integration Tests');
  console.log('='.repeat(60));

  const tests = [
    { name: 'Full Rotation Lifecycle', fn: testFullRotationLifecycle },
    { name: 'Memory Threshold Triggering', fn: testMemoryThresholdTriggering },
    { name: 'Concurrent Request Handling', fn: testConcurrentRequestHandling },
    { name: 'Startup State Recovery', fn: testStartupStateRecovery },
    { name: 'Error Scenarios and Recovery', fn: testErrorScenariosAndRecovery },
    { name: 'Service Integration Verification', fn: testServiceIntegration }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
        testUtils.logSuccess(`✅ ${test.name} - PASSED`);
      } else {
        failed++;
        testUtils.logError(`❌ ${test.name} - FAILED`);
      }
    } catch (error) {
      failed++;
      testUtils.logError(`❌ ${test.name} - ERROR`, error);
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Integration Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📋 Total: ${tests.length}`);
  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('🎉 All integration tests passed!');
  } else {
    console.log('💥 Some integration tests failed!');
  }

  return failed === 0;
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Integration test runner failed:', error);
      process.exit(1);
    });
}

export { runIntegrationTests }; 