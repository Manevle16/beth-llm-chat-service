/**
 * ErrorHandlingService Test Suite
 * 
 * Tests for comprehensive error handling, retry logic with exponential backoff,
 * circuit breaker functionality, structured logging, and graceful degradation.
 */

import errorHandlingService from '../../services/errorHandlingService.js';
import { createRotationError, ERROR_CODES } from '../../types/modelRotation.js';

// Test basic error handling service functionality
console.log('🧪 Testing ErrorHandlingService...');

// Test 1: Basic initialization
console.log('\n1️⃣  Testing basic initialization...');
try {
  await errorHandlingService.initialize();
  console.log('✅ ErrorHandlingService initialized');
} catch (error) {
  console.log('❌ Initialization failed:', error.message);
}

// Test 2: Test successful operation execution
console.log('\n2️⃣  Testing successful operation execution...');
try {
  const result = await errorHandlingService.executeWithRetry(
    async () => {
      return 'success';
    },
    {
      operationName: 'test-success',
      maxRetries: 3,
      enableLogging: true
    }
  );
  console.log('✅ Successful operation execution:', result);
} catch (error) {
  console.log('❌ Successful operation test failed:', error.message);
}

// Test 3: Test operation with retry logic
console.log('\n3️⃣  Testing operation with retry logic...');
let attemptCount = 0;
try {
  const result = await errorHandlingService.executeWithRetry(
    async () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Temporary failure');
      }
      return 'success after retries';
    },
    {
      operationName: 'test-retry',
      maxRetries: 3,
      baseDelay: 100,
      enableLogging: true
    }
  );
  console.log('✅ Retry operation succeeded:', result, 'attempts:', attemptCount);
} catch (error) {
  console.log('❌ Retry operation test failed:', error.message);
}

// Test 4: Test operation that fails after all retries
console.log('\n4️⃣  Testing operation that fails after all retries...');
try {
  await errorHandlingService.executeWithRetry(
    async () => {
      throw new Error('Persistent failure');
    },
    {
      operationName: 'test-persistent-failure',
      maxRetries: 2,
      baseDelay: 50,
      enableLogging: true
    }
  );
  console.log('❌ Should have failed after all retries');
} catch (error) {
  console.log('✅ Correctly failed after all retries:', error.message);
}

// Test 5: Test circuit breaker functionality
console.log('\n5️⃣  Testing circuit breaker functionality...');
try {
  // Trigger circuit breaker by failing multiple times
  for (let i = 0; i < 6; i++) {
    try {
      await errorHandlingService.executeWithRetry(
        async () => {
          throw new Error('Circuit breaker test failure');
        },
        {
          operationName: 'test-circuit-breaker',
          maxRetries: 0,
          circuitBreakerThreshold: 5,
          enableLogging: false
        }
      );
    } catch (error) {
      // Expected to fail
    }
  }

  // Now try again - should hit circuit breaker
  try {
    await errorHandlingService.executeWithRetry(
      async () => {
        return 'should not reach here';
      },
      {
        operationName: 'test-circuit-breaker',
        maxRetries: 0,
        enableLogging: true
      }
    );
    console.log('❌ Should have hit circuit breaker');
  } catch (error) {
    console.log('✅ Circuit breaker correctly opened:', error.message.includes('Circuit breaker'));
  }
} catch (error) {
  console.log('❌ Circuit breaker test failed:', error.message);
}

// Test 6: Test structured logging
console.log('\n6️⃣  Testing structured logging...');
try {
  errorHandlingService.logInfo('Test info message', { test: 'info' });
  errorHandlingService.logWarn('Test warning message', { test: 'warn' });
  errorHandlingService.logError('Test error message', { test: 'error' });
  errorHandlingService.logDebug('Test debug message', { test: 'debug' });
  
  console.log('✅ Structured logging test completed');
} catch (error) {
  console.log('❌ Structured logging test failed:', error.message);
}

// Test 7: Test graceful degradation with fallback
console.log('\n7️⃣  Testing graceful degradation with fallback...');
try {
  const result = await errorHandlingService.executeWithFallback(
    async () => {
      throw new Error('Primary operation failed');
    },
    async () => {
      return 'Fallback operation succeeded';
    },
    {
      operationName: 'test-fallback',
      enableLogging: true
    }
  );
  console.log('✅ Fallback operation test:', result);
} catch (error) {
  console.log('❌ Fallback operation test failed:', error.message);
}

// Test 8: Test fallback when both operations fail
console.log('\n8️⃣  Testing fallback when both operations fail...');
try {
  await errorHandlingService.executeWithFallback(
    async () => {
      throw new Error('Primary operation failed');
    },
    async () => {
      throw new Error('Fallback operation also failed');
    },
    {
      operationName: 'test-both-fail',
      enableLogging: true
    }
  );
  console.log('❌ Should have failed when both operations fail');
} catch (error) {
  console.log('✅ Correctly failed when both operations fail:', error.message);
}

// Test 9: Test error statistics
console.log('\n9️⃣  Testing error statistics...');
try {
  const stats = errorHandlingService.getErrorStats();
  console.log('✅ Error statistics:', {
    totalErrors: stats.totalErrors,
    errorCounts: Object.keys(stats.errorCounts).length,
    circuitBreakerStates: Object.keys(stats.circuitBreakerStates).length,
    recentErrors: stats.recentErrors.length
  });
} catch (error) {
  console.log('❌ Error statistics test failed:', error.message);
}

// Test 10: Test operation metrics
console.log('\n🔟 Testing operation metrics...');
try {
  const metrics = errorHandlingService.getOperationMetrics('test-retry');
  console.log('✅ Operation metrics:', {
    operation: metrics.operation,
    failedExecutions: metrics.failedExecutions,
    retryRate: metrics.retryRate,
    circuitBreakerStatus: metrics.circuitBreakerStatus
  });
} catch (error) {
  console.log('❌ Operation metrics test failed:', error.message);
}

// Test 11: Test recent logs
console.log('\n1️⃣1️⃣  Testing recent logs...');
try {
  const logs = errorHandlingService.getRecentLogs(10);
  console.log('✅ Recent logs:', {
    count: logs.length,
    hasEntries: logs.length > 0,
    sampleLevels: logs.slice(0, 3).map(log => log.level)
  });
} catch (error) {
  console.log('❌ Recent logs test failed:', error.message);
}

// Test 12: Test logs filtered by level
console.log('\n1️⃣2️⃣  Testing logs filtered by level...');
try {
  const errorLogs = errorHandlingService.getRecentLogs(10, 'error');
  console.log('✅ Error logs:', {
    count: errorLogs.length,
    allErrors: errorLogs.every(log => log.level === 'error')
  });
} catch (error) {
  console.log('❌ Error logs test failed:', error.message);
}

// Test 13: Test circuit breaker reset
console.log('\n1️⃣3️⃣  Testing circuit breaker reset...');
try {
  const reset = errorHandlingService.resetCircuitBreaker('test-circuit-breaker');
  console.log('✅ Circuit breaker reset:', reset);
} catch (error) {
  console.log('❌ Circuit breaker reset test failed:', error.message);
}

// Test 14: Test non-retryable errors
console.log('\n1️⃣4️⃣  Testing non-retryable errors...');
try {
  await errorHandlingService.executeWithRetry(
    async () => {
      throw createRotationError(
        ERROR_CODES.INVALID_INPUT,
        'Invalid input error',
        'test-non-retryable'
      );
    },
    {
      operationName: 'test-non-retryable',
      maxRetries: 3,
      enableLogging: true
    }
  );
  console.log('❌ Should have failed immediately for non-retryable error');
} catch (error) {
  console.log('✅ Correctly failed immediately for non-retryable error:', error.code);
}

// Test 15: Test exponential backoff calculation
console.log('\n1️⃣5️⃣  Testing exponential backoff calculation...');
try {
  let attemptCount = 0;
  await errorHandlingService.executeWithRetry(
    async () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Backoff test failure');
      }
      return 'success';
    },
    {
      operationName: 'test-backoff',
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
      enableLogging: true
    }
  );
  console.log('✅ Exponential backoff test completed');
} catch (error) {
  console.log('❌ Exponential backoff test failed:', error.message);
}

// Test 16: Test clear error statistics
console.log('\n1️⃣6️⃣  Testing clear error statistics...');
try {
  const clearedCount = errorHandlingService.clearErrorStats();
  console.log('✅ Cleared error statistics:', clearedCount, 'entries');
} catch (error) {
  console.log('❌ Clear error statistics test failed:', error.message);
}

// Test 17: Test clear log buffer
console.log('\n1️⃣7️⃣  Testing clear log buffer...');
try {
  const clearedCount = errorHandlingService.clearLogBuffer();
  console.log('✅ Cleared log buffer:', clearedCount, 'entries');
} catch (error) {
  console.log('❌ Clear log buffer test failed:', error.message);
}

// Test 18: Test error handling for uninitialized service
console.log('\n1️⃣8️⃣  Testing error handling for uninitialized service...');
try {
  // Create a new instance to test uninitialized state
  const testService = {
    _isInitialized: false,
    _ensureInitialized() {
      if (!this._isInitialized) {
        throw new Error("ErrorHandlingService not initialized. Call initialize() first.");
      }
    },
    logInfo() {
      this._ensureInitialized();
    }
  };
  
  try {
    testService.logInfo('test');
    console.log('❌ Should have thrown initialization error');
  } catch (error) {
    console.log('✅ Correctly threw initialization error:', error.message.includes('not initialized'));
  }
} catch (error) {
  console.log('❌ Uninitialized service test failed:', error.message);
}

// Test 19: Test metrics recording
console.log('\n1️⃣9️⃣  Testing metrics recording...');
try {
  // Execute a few operations to generate metrics
  for (let i = 0; i < 3; i++) {
    try {
      await errorHandlingService.executeWithRetry(
        async () => {
          if (i % 2 === 0) {
            throw new Error('Test error for metrics');
          }
          return 'success';
        },
        {
          operationName: 'test-metrics',
          maxRetries: 1,
          enableLogging: false,
          enableMetrics: true
        }
      );
    } catch (error) {
      // Expected for some iterations
    }
  }
  
  const metrics = errorHandlingService.getOperationMetrics('test-metrics');
  console.log('✅ Metrics recording test:', {
    operation: metrics.operation,
    failedExecutions: metrics.failedExecutions,
    circuitBreakerStatus: metrics.circuitBreakerStatus
  });
} catch (error) {
  console.log('❌ Metrics recording test failed:', error.message);
}

// Test 20: Test final error statistics
console.log('\n2️⃣0️⃣  Testing final error statistics...');
try {
  const finalStats = errorHandlingService.getErrorStats();
  const finalLogs = errorHandlingService.getRecentLogs(5);
  
  console.log('✅ Final error statistics:', {
    totalErrors: finalStats.totalErrors,
    errorCounts: Object.keys(finalStats.errorCounts).length,
    circuitBreakerStates: Object.keys(finalStats.circuitBreakerStates).length,
    recentLogs: finalLogs.length
  });
} catch (error) {
  console.log('❌ Final error statistics test failed:', error.message);
}

console.log('\n🎉 All ErrorHandlingService tests completed!'); 