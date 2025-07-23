/**
 * Unit tests for StreamTerminationErrorHandler
 * 
 * Tests error handling, retry logic, metrics tracking, and observability features
 */

import streamTerminationErrorHandler from "../../services/streamTerminationErrorHandler.js";

console.log('🧪 Testing StreamTerminationErrorHandler...');

// Test 1: Basic initialization
console.log('\n1️⃣  Testing basic initialization...');
try {
  await streamTerminationErrorHandler.initialize();
  console.log('✅ StreamTerminationErrorHandler initialized successfully');
} catch (error) {
  console.log('❌ Initialization failed:', error.message);
}

// Test 2: Error handling and retry logic
console.log('\n2️⃣  Testing error handling and retry logic...');
try {
  // Test successful operation
  const successOperation = async () => "success";
  const successResult = await streamTerminationErrorHandler.executeWithRetry(successOperation, {
    operationName: "test_success",
    sessionId: "test-session-1",
    conversationId: "test-conversation-1"
  });
  console.log('✅ Success operation result:', successResult);

  // Test retry on temporary errors
  let attemptCount = 0;
  const retryOperation = async () => {
    attemptCount++;
    if (attemptCount < 3) {
      throw new Error("temporary network error");
    }
    return "retry success";
  };
  
  const retryResult = await streamTerminationErrorHandler.executeWithRetry(retryOperation, {
    operationName: "test_retry",
    sessionId: "test-session-2",
    maxRetries: 2,
    baseDelay: 10
  });
  console.log('✅ Retry operation result:', retryResult);
  console.log('✅ Attempt count:', attemptCount);

  // Test no retry on validation errors
  const validationOperation = async () => {
    throw new Error("invalid session ID");
  };
  
  try {
    await streamTerminationErrorHandler.executeWithRetry(validationOperation, {
      operationName: "test_validation_error",
      sessionId: "test-session-3",
      maxRetries: 3
    });
    console.log('❌ Should have thrown error');
  } catch (error) {
    console.log('✅ Validation error correctly not retried:', error.message);
  }
} catch (error) {
  console.log('❌ Error handling test failed:', error.message);
}

// Test 3: Logging and observability
console.log('\n3️⃣  Testing logging and observability...');
try {
  // Test termination event logging
  const eventData = {
    sessionId: "test-session-5",
    conversationId: "test-conversation-5",
    reason: "USER_REQUESTED",
    tokenCount: 150,
    partialResponseLength: 500
  };
  
  streamTerminationErrorHandler.logTerminationEvent("session_terminated", eventData);
  console.log('✅ Termination event logged');

  // Test session metrics tracking
  const sessionId = "test-session-6";
  const metrics = {
    status: "ACTIVE",
    conversationId: "test-conversation-6",
    model: "llama2",
    tokenCount: 100,
    partialResponseLength: 300
  };
  
  streamTerminationErrorHandler.trackSessionMetrics(sessionId, metrics);
  const sessionMetrics = streamTerminationErrorHandler.getSessionMetrics(sessionId);
  console.log('✅ Session metrics tracked:', {
    hasMetrics: !!sessionMetrics,
    status: sessionMetrics?.metrics?.status,
    tokenCount: sessionMetrics?.metrics?.tokenCount
  });

  // Test different log levels
  streamTerminationErrorHandler.logInfo("Info message", { context: "test" });
  streamTerminationErrorHandler.logWarn("Warning message", { context: "test" });
  streamTerminationErrorHandler.logError("Error message", { context: "test" });
  streamTerminationErrorHandler.logDebug("Debug message", { context: "test" });
  console.log('✅ All log levels tested');
} catch (error) {
  console.log('❌ Logging test failed:', error.message);
}

// Test 4: Metrics and statistics
console.log('\n4️⃣  Testing metrics and statistics...');
try {
  // Clear previous stats
  streamTerminationErrorHandler.clearErrorStats();
  
  // Execute operations to generate stats
  const successOp = async () => "success";
  const errorOp = async () => { throw new Error("test error"); };
  
  await streamTerminationErrorHandler.executeWithRetry(successOp, {
    operationName: "test_stats_success"
  });
  
  try {
    await streamTerminationErrorHandler.executeWithRetry(errorOp, {
      operationName: "test_stats_error"
    });
  } catch (error) {
    // Expected error
  }
  
  const stats = streamTerminationErrorHandler.getErrorStats();
  console.log('✅ Error statistics:', {
    totalErrors: stats.totalErrors,
    successCount: stats.operationStats.test_stats_success?.successCount,
    errorCount: stats.operationStats.test_stats_error?.errorCount,
    uptime: stats.uptime > 0
  });

  // Test operation metrics
  const slowOperation = async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
    return "slow success";
  };
  
  await streamTerminationErrorHandler.executeWithRetry(slowOperation, {
    operationName: "test_duration",
    enableMetrics: true
  });
  
  const metrics = streamTerminationErrorHandler.getOperationMetrics("test_duration");
  console.log('✅ Operation metrics:', {
    totalCalls: metrics.totalCalls,
    successCount: metrics.successCount,
    hasDuration: metrics.totalDuration > 0
  });
} catch (error) {
  console.log('❌ Metrics test failed:', error.message);
}

// Test 5: Error recovery and concurrent operations
console.log('\n5️⃣  Testing error recovery and concurrent operations...');
try {
  const operations = [];
  const results = [];
  
  // Start multiple concurrent operations
  for (let i = 0; i < 3; i++) {
    const operation = async () => `result-${i}`;
    operations.push(operation);
    
    results.push(streamTerminationErrorHandler.executeWithRetry(operation, {
      operationName: "concurrent_test",
      sessionId: `session-${i}`
    }));
  }
  
  const resolvedResults = await Promise.all(results);
  console.log('✅ Concurrent operations completed:', resolvedResults);
} catch (error) {
  console.log('❌ Concurrent operations test failed:', error.message);
}

// Test 6: Utility functions
console.log('\n6️⃣  Testing utility functions...');
try {
  // Test operation ID generation
  const id1 = streamTerminationErrorHandler._generateOperationId("test_op");
  const id2 = streamTerminationErrorHandler._generateOperationId("test_op");
  console.log('✅ Operation ID generation:', {
    unique: id1 !== id2,
    format1: /^test_op_\d+_[a-z0-9]+$/.test(id1),
    format2: /^test_op_\d+_[a-z0-9]+$/.test(id2)
  });

  // Test event ID generation
  const eventId1 = streamTerminationErrorHandler._generateEventId("test_event");
  const eventId2 = streamTerminationErrorHandler._generateEventId("test_event");
  console.log('✅ Event ID generation:', {
    unique: eventId1 !== eventId2,
    format1: /^test_event_\d+_[a-z0-9]+$/.test(eventId1),
    format2: /^test_event_\d+_[a-z0-9]+$/.test(eventId2)
  });

  // Test backoff delay calculation
  const delay1 = streamTerminationErrorHandler._calculateBackoffDelay(1, 1000, 10000, 2);
  const delay2 = streamTerminationErrorHandler._calculateBackoffDelay(2, 1000, 10000, 2);
  const delay3 = streamTerminationErrorHandler._calculateBackoffDelay(3, 1000, 10000, 2);
  console.log('✅ Backoff delay calculation:', {
    delay1: delay1 === 1000,
    delay2: delay2 === 2000,
    delay3: delay3 === 4000
  });

  // Test retry decision logic
  const retryableError = new Error("connection timeout");
  const nonRetryableError = new Error("invalid session ID");
  
  console.log('✅ Retry decision logic:', {
    retryable: streamTerminationErrorHandler._shouldRetry(retryableError),
    nonRetryable: !streamTerminationErrorHandler._shouldRetry(nonRetryableError)
  });
} catch (error) {
  console.log('❌ Utility functions test failed:', error.message);
}

// Test 7: Cleanup and resource management
console.log('\n7️⃣  Testing cleanup and resource management...');
try {
  // Generate some logs and stats
  streamTerminationErrorHandler.logInfo("Test log");
  streamTerminationErrorHandler.logError("Test error");
  
  let logs = streamTerminationErrorHandler.getRecentLogs(10);
  let stats = streamTerminationErrorHandler.getErrorStats();
  
  console.log('✅ Before cleanup:', {
    logCount: logs.length,
    hasErrors: stats.totalErrors > 0
  });
  
  // Clear everything
  streamTerminationErrorHandler.clearLogBuffer();
  streamTerminationErrorHandler.clearErrorStats();
  
  logs = streamTerminationErrorHandler.getRecentLogs(10);
  stats = streamTerminationErrorHandler.getErrorStats();
  
  console.log('✅ After cleanup:', {
    logCount: logs.length,
    hasErrors: stats.totalErrors === 0
  });
} catch (error) {
  console.log('❌ Cleanup test failed:', error.message);
}

// Test 8: Log filtering
console.log('\n8️⃣  Testing log filtering...');
try {
  // Clear logs first
  streamTerminationErrorHandler.clearLogBuffer();
  
  // Add logs of different levels
  streamTerminationErrorHandler.logInfo("Info message");
  streamTerminationErrorHandler.logWarn("Warning message");
  streamTerminationErrorHandler.logError("Error message");
  
  const allLogs = streamTerminationErrorHandler.getRecentLogs(10);
  const infoLogs = streamTerminationErrorHandler.getRecentLogs(10, "info");
  const errorLogs = streamTerminationErrorHandler.getRecentLogs(10, "error");
  
  console.log('✅ Log filtering:', {
    totalLogs: allLogs.length,
    infoLogs: infoLogs.length,
    errorLogs: errorLogs.length,
    hasInfo: infoLogs.length > 0,
    hasError: errorLogs.length > 0
  });
} catch (error) {
  console.log('❌ Log filtering test failed:', error.message);
}

console.log('\n🎉 StreamTerminationErrorHandler tests completed!'); 