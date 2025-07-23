/**
 * Performance and Load Testing for Stream Termination Feature
 * 
 * Tests system stability under high load including:
 * - Memory usage profiling of active session tracking
 * - Efficient cleanup of terminated sessions
 * - System stability under concurrent termination requests
 * - Performance benchmarks for session operations
 * - Resource leak detection
 */

import streamSessionManager from '../../services/streamSessionManager.js';
import streamSessionDatabase from '../../services/streamSessionDatabase.js';
import streamTerminationErrorHandler from '../../services/streamTerminationErrorHandler.js';
import { createStreamSession, STREAM_STATUS, TERMINATION_REASON } from '../../types/streamSession.js';
import pool from '../../config/database.js';

console.log('🚀 Performance and Load Testing for Stream Termination...');

// Performance measurement utilities
const performanceMetrics = {
  sessionCreation: [],
  sessionTermination: [],
  memoryUsage: [],
  databaseOperations: [],
  concurrentOperations: []
};

function measureTime(operation) {
  const start = process.hrtime.bigint();
  return () => {
    const end = process.hrtime.bigint();
    return Number(end - start) / 1000000; // Convert to milliseconds
  };
}

function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024) // MB
  };
}

// Helper function to setup test data
async function setupTestData() {
  try {
    // Insert test conversations for load testing
    const conversations = [];
    for (let i = 0; i < 50; i++) {
      conversations.push(`(` +
        `'load-test-conv-${i}', ` +
        `'Load Test Conversation ${i}', ` +
        `'llama2', ` +
        `FALSE, ` +
        `CURRENT_TIMESTAMP, ` +
        `CURRENT_TIMESTAMP` +
      `)`);
    }
    
    await pool.query(`
      INSERT INTO conversations (id, tab_name, llm_model, is_private, created_at, updated_at) 
      VALUES ${conversations.join(', ')}
      ON CONFLICT (id) DO UPDATE SET 
        tab_name = EXCLUDED.tab_name,
        updated_at = CURRENT_TIMESTAMP
    `);
    console.log('✅ Load test data setup completed');
  } catch (error) {
    console.log('⚠️  Load test data setup warning:', error.message);
  }
}

// Helper function to cleanup test data
async function cleanupTestData() {
  try {
    await pool.query('DELETE FROM stream_sessions WHERE conversation_id LIKE \'load-test-conv-%\'');
    await pool.query('DELETE FROM conversations WHERE id LIKE \'load-test-conv-%\'');
    console.log('✅ Load test data cleanup completed');
  } catch (error) {
    console.log('⚠️  Load test data cleanup warning:', error.message);
  }
}

// Initialize services
console.log('\n1️⃣  Initializing services...');
try {
  await streamTerminationErrorHandler.initialize();
  await streamSessionDatabase.initialize();
  await streamSessionManager.initialize();
  await setupTestData();
  console.log('✅ Services initialized successfully');
} catch (error) {
  console.log('❌ Service initialization failed:', error.message);
  process.exit(1);
}

// Test 1: Memory usage profiling
console.log('\n2️⃣  Testing memory usage profiling...');
try {
  const initialMemory = getMemoryUsage();
  console.log('📊 Initial memory usage:', initialMemory);

  // Create sessions and measure memory growth
  const sessions = [];
  const sessionCount = 100;
  
  console.log(`📝 Creating ${sessionCount} sessions...`);
  
  for (let i = 0; i < sessionCount; i++) {
    const endTimer = measureTime('session_creation');
    const session = await streamSessionManager.createSession(`load-test-conv-${i % 50}`, 'llama2');
    const duration = endTimer();
    
    sessions.push(session);
    performanceMetrics.sessionCreation.push(duration);
    
    // Measure memory every 10 sessions
    if ((i + 1) % 10 === 0) {
      const currentMemory = getMemoryUsage();
      performanceMetrics.memoryUsage.push({
        sessionCount: i + 1,
        memory: currentMemory,
        delta: {
          rss: currentMemory.rss - initialMemory.rss,
          heapUsed: currentMemory.heapUsed - initialMemory.heapUsed
        }
      });
      console.log(`📊 Memory at ${i + 1} sessions:`, currentMemory);
    }
  }

  const peakMemory = getMemoryUsage();
  console.log('📊 Peak memory usage:', peakMemory);
  console.log('📊 Memory growth:', {
    rss: peakMemory.rss - initialMemory.rss,
    heapUsed: peakMemory.heapUsed - initialMemory.heapUsed
  });

  // Calculate session creation performance
  const avgCreationTime = performanceMetrics.sessionCreation.reduce((a, b) => a + b, 0) / performanceMetrics.sessionCreation.length;
  const maxCreationTime = Math.max(...performanceMetrics.sessionCreation);
  const minCreationTime = Math.min(...performanceMetrics.sessionCreation);
  
  console.log('📊 Session creation performance:', {
    average: avgCreationTime.toFixed(2) + 'ms',
    max: maxCreationTime.toFixed(2) + 'ms',
    min: minCreationTime.toFixed(2) + 'ms'
  });

} catch (error) {
  console.log('❌ Memory profiling test failed:', error.message);
}

// Test 2: Efficient cleanup of terminated sessions
console.log('\n3️⃣  Testing efficient cleanup of terminated sessions...');
try {
  const activeSessions = streamSessionManager.getAllActiveSessions();
  console.log(`📊 Active sessions before cleanup: ${activeSessions.length}`);

  // Terminate all sessions and measure cleanup performance
  const terminationTimes = [];
  const cleanupStart = measureTime('bulk_termination');
  
  for (const session of activeSessions) {
    const endTimer = measureTime('session_termination');
    await streamSessionManager.terminateSession(session.id, TERMINATION_REASON.USER_REQUESTED);
    const duration = endTimer();
    terminationTimes.push(duration);
    performanceMetrics.sessionTermination.push(duration);
  }
  
  const cleanupDuration = cleanupStart();
  
  // Force cleanup
  await streamSessionManager.cleanupExpiredSessions();
  
  const remainingSessions = streamSessionManager.getAllActiveSessions();
  console.log(`📊 Active sessions after cleanup: ${remainingSessions.length}`);
  
  // Calculate termination performance
  const avgTerminationTime = terminationTimes.reduce((a, b) => a + b, 0) / terminationTimes.length;
  const maxTerminationTime = Math.max(...terminationTimes);
  const minTerminationTime = Math.min(...terminationTimes);
  
  console.log('📊 Session termination performance:', {
    totalSessions: terminationTimes.length,
    totalTime: cleanupDuration.toFixed(2) + 'ms',
    average: avgTerminationTime.toFixed(2) + 'ms',
    max: maxTerminationTime.toFixed(2) + 'ms',
    min: minTerminationTime.toFixed(2) + 'ms'
  });

  const finalMemory = getMemoryUsage();
  console.log('📊 Memory after cleanup:', finalMemory);

} catch (error) {
  console.log('❌ Cleanup efficiency test failed:', error.message);
}

// Test 3: System stability under concurrent termination requests
console.log('\n4️⃣  Testing system stability under concurrent termination requests...');
try {
  // Create sessions for concurrent testing
  const concurrentSessions = [];
  const concurrentCount = 50;
  
  console.log(`📝 Creating ${concurrentCount} sessions for concurrent testing...`);
  
  for (let i = 0; i < concurrentCount; i++) {
    const session = await streamSessionManager.createSession(`load-test-conv-${i % 50}`, 'llama2');
    concurrentSessions.push(session);
  }
  
  console.log(`📊 Created ${concurrentSessions.length} sessions for concurrent testing`);
  
  // Test concurrent termination with different concurrency levels
  const concurrencyLevels = [5, 10, 20, 50];
  
  for (const concurrency of concurrencyLevels) {
    console.log(`\n🔄 Testing concurrent termination with ${concurrency} concurrent requests...`);
    
    // Create fresh sessions for this test
    const testSessions = [];
    for (let i = 0; i < concurrency; i++) {
      const session = await streamSessionManager.createSession(`load-test-conv-${i % 50}`, 'llama2');
      testSessions.push(session);
    }
    
    const concurrentStart = measureTime('concurrent_termination');
    
    // Send concurrent termination requests
    const terminationPromises = testSessions.map(async (session, index) => {
      const endTimer = measureTime('concurrent_termination_single');
      try {
        await streamSessionManager.terminateSession(session.id, TERMINATION_REASON.USER_REQUESTED);
        const duration = endTimer();
        return { success: true, duration, sessionId: session.id };
      } catch (error) {
        const duration = endTimer();
        return { success: false, duration, error: error.message, sessionId: session.id };
      }
    });
    
    const results = await Promise.allSettled(terminationPromises);
    const concurrentDuration = concurrentStart();
    
    // Analyze results
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'fulfilled' && !r.value.success).length;
    const rejected = results.filter(r => r.status === 'rejected').length;
    
    const durations = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value.duration);
    
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    
    console.log(`📊 Concurrent termination results (${concurrency} concurrent):`, {
      successful,
      failed,
      rejected,
      totalTime: concurrentDuration.toFixed(2) + 'ms',
      averageTime: avgDuration.toFixed(2) + 'ms',
      maxTime: maxDuration.toFixed(2) + 'ms',
      minTime: minDuration.toFixed(2) + 'ms'
    });
    
    performanceMetrics.concurrentOperations.push({
      concurrency,
      successful,
      failed,
      rejected,
      totalTime: concurrentDuration,
      averageTime: avgDuration,
      maxTime: maxDuration,
      minTime: minDuration
    });
  }

} catch (error) {
  console.log('❌ Concurrent termination test failed:', error.message);
}

// Test 4: Database operation performance
console.log('\n5️⃣  Testing database operation performance...');
try {
  const dbOperationTimes = [];
  
  // Test database session creation performance
  console.log('📝 Testing database session creation performance...');
  for (let i = 0; i < 20; i++) {
    const session = createStreamSession(`load-test-conv-${i % 50}`, 'llama2');
    const endTimer = measureTime('db_session_creation');
    await streamSessionDatabase.createSession(session);
    const duration = endTimer();
    dbOperationTimes.push({ operation: 'create', duration });
  }
  
  // Test database session retrieval performance
  console.log('📝 Testing database session retrieval performance...');
  const dbSessions = await streamSessionDatabase.getSessionsByStatus('ACTIVE', 100);
  
  for (let i = 0; i < Math.min(20, dbSessions.length); i++) {
    const endTimer = measureTime('db_session_retrieval');
    await streamSessionDatabase.getSession(dbSessions[i].id);
    const duration = endTimer();
    dbOperationTimes.push({ operation: 'retrieve', duration });
  }
  
  // Test database session termination performance
  console.log('📝 Testing database session termination performance...');
  for (let i = 0; i < Math.min(20, dbSessions.length); i++) {
    const endTimer = measureTime('db_session_termination');
    await streamSessionDatabase.terminateSession(dbSessions[i].id, TERMINATION_REASON.USER_REQUESTED);
    const duration = endTimer();
    dbOperationTimes.push({ operation: 'terminate', duration });
  }
  
  // Calculate database performance metrics
  const createTimes = dbOperationTimes.filter(t => t.operation === 'create').map(t => t.duration);
  const retrieveTimes = dbOperationTimes.filter(t => t.operation === 'retrieve').map(t => t.duration);
  const terminateTimes = dbOperationTimes.filter(t => t.operation === 'terminate').map(t => t.duration);
  
  console.log('📊 Database operation performance:', {
    create: {
      count: createTimes.length,
      average: createTimes.length > 0 ? (createTimes.reduce((a, b) => a + b, 0) / createTimes.length).toFixed(2) + 'ms' : 'N/A',
      max: createTimes.length > 0 ? Math.max(...createTimes).toFixed(2) + 'ms' : 'N/A',
      min: createTimes.length > 0 ? Math.min(...createTimes).toFixed(2) + 'ms' : 'N/A'
    },
    retrieve: {
      count: retrieveTimes.length,
      average: retrieveTimes.length > 0 ? (retrieveTimes.reduce((a, b) => a + b, 0) / retrieveTimes.length).toFixed(2) + 'ms' : 'N/A',
      max: retrieveTimes.length > 0 ? Math.max(...retrieveTimes).toFixed(2) + 'ms' : 'N/A',
      min: retrieveTimes.length > 0 ? Math.min(...retrieveTimes).toFixed(2) + 'ms' : 'N/A'
    },
    terminate: {
      count: terminateTimes.length,
      average: terminateTimes.length > 0 ? (terminateTimes.reduce((a, b) => a + b, 0) / terminateTimes.length).toFixed(2) + 'ms' : 'N/A',
      max: terminateTimes.length > 0 ? Math.max(...terminateTimes).toFixed(2) + 'ms' : 'N/A',
      min: terminateTimes.length > 0 ? Math.min(...terminateTimes).toFixed(2) + 'ms' : 'N/A'
    }
  });
  
  performanceMetrics.databaseOperations = dbOperationTimes;

} catch (error) {
  console.log('❌ Database performance test failed:', error.message);
}

// Test 5: Resource leak detection
console.log('\n6️⃣  Testing resource leak detection...');
try {
  const initialMemory = getMemoryUsage();
  const initialSessions = streamSessionManager.getAllActiveSessions().length;
  
  console.log('📊 Initial state:', {
    memory: initialMemory,
    activeSessions: initialSessions
  });
  
  // Perform multiple create/terminate cycles
  const cycles = 10;
  const sessionsPerCycle = 20;
  
  for (let cycle = 0; cycle < cycles; cycle++) {
    console.log(`🔄 Cycle ${cycle + 1}/${cycles}...`);
    
    // Create sessions
    const cycleSessions = [];
    for (let i = 0; i < sessionsPerCycle; i++) {
      const session = await streamSessionManager.createSession(`load-test-conv-${i % 50}`, 'llama2');
      cycleSessions.push(session);
    }
    
    // Terminate sessions
    for (const session of cycleSessions) {
      await streamSessionManager.terminateSession(session.id, TERMINATION_REASON.USER_REQUESTED);
    }
    
    // Force cleanup
    await streamSessionManager.cleanupExpiredSessions();
    
    // Measure memory every 2 cycles
    if ((cycle + 1) % 2 === 0) {
      const currentMemory = getMemoryUsage();
      const currentSessions = streamSessionManager.getAllActiveSessions().length;
      
      console.log(`📊 After cycle ${cycle + 1}:`, {
        memory: currentMemory,
        activeSessions: currentSessions,
        memoryDelta: {
          rss: currentMemory.rss - initialMemory.rss,
          heapUsed: currentMemory.heapUsed - initialMemory.heapUsed
        }
      });
    }
  }
  
  const finalMemory = getMemoryUsage();
  const finalSessions = streamSessionManager.getAllActiveSessions().length;
  
  console.log('📊 Final state:', {
    memory: finalMemory,
    activeSessions: finalSessions,
    memoryGrowth: {
      rss: finalMemory.rss - initialMemory.rss,
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed
    }
  });
  
  // Check for potential memory leaks
  const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
  if (memoryGrowth > 50) { // More than 50MB growth
    console.log('⚠️  Potential memory leak detected - significant memory growth');
  } else {
    console.log('✅ No significant memory leak detected');
  }
  
  if (finalSessions > initialSessions + 5) { // More than 5 sessions remaining
    console.log('⚠️  Potential session leak detected - sessions not properly cleaned up');
  } else {
    console.log('✅ No significant session leak detected');
  }

} catch (error) {
  console.log('❌ Resource leak detection test failed:', error.message);
}

// Test 6: Error handler performance under load
console.log('\n7️⃣  Testing error handler performance under load...');
try {
  const errorHandlerMetrics = streamTerminationErrorHandler.getErrorStats();
  const operationMetrics = streamTerminationErrorHandler.getOperationMetrics('create_session');
  
  console.log('📊 Error handler performance under load:', {
    totalErrors: errorHandlerMetrics.totalErrors,
    totalOperations: errorHandlerMetrics.totalOperations,
    successRate: errorHandlerMetrics.successRate,
    operationMetrics: operationMetrics ? {
      totalCalls: operationMetrics.totalCalls,
      successCount: operationMetrics.successCount,
      averageDuration: operationMetrics.averageDuration
    } : 'N/A'
  });
  
  // Test error handler buffer performance
  const recentLogs = streamTerminationErrorHandler.getRecentLogs(100);
  console.log(`📊 Recent logs count: ${recentLogs.length}`);
  
  // Test log buffer performance
  const logStart = measureTime('log_buffer_test');
  for (let i = 0; i < 1000; i++) {
    streamTerminationErrorHandler.logInfo(`Performance test log ${i}`, { testId: i });
  }
  const logDuration = logStart();
  
  console.log('📊 Log buffer performance:', {
    logsPerSecond: (1000 / (logDuration / 1000)).toFixed(0),
    totalTime: logDuration.toFixed(2) + 'ms'
  });

} catch (error) {
  console.log('❌ Error handler performance test failed:', error.message);
}

// Generate performance report
console.log('\n📊 Performance Test Summary');
console.log('============================');

const finalMemory = getMemoryUsage();
console.log('Final Memory Usage:', finalMemory);

console.log('\nSession Creation Performance:');
if (performanceMetrics.sessionCreation.length > 0) {
  const avg = performanceMetrics.sessionCreation.reduce((a, b) => a + b, 0) / performanceMetrics.sessionCreation.length;
  console.log(`  Average: ${avg.toFixed(2)}ms`);
  console.log(`  Max: ${Math.max(...performanceMetrics.sessionCreation).toFixed(2)}ms`);
  console.log(`  Min: ${Math.min(...performanceMetrics.sessionCreation).toFixed(2)}ms`);
}

console.log('\nSession Termination Performance:');
if (performanceMetrics.sessionTermination.length > 0) {
  const avg = performanceMetrics.sessionTermination.reduce((a, b) => a + b, 0) / performanceMetrics.sessionTermination.length;
  console.log(`  Average: ${avg.toFixed(2)}ms`);
  console.log(`  Max: ${Math.max(...performanceMetrics.sessionTermination).toFixed(2)}ms`);
  console.log(`  Min: ${Math.min(...performanceMetrics.sessionTermination).toFixed(2)}ms`);
}

console.log('\nConcurrent Operation Performance:');
performanceMetrics.concurrentOperations.forEach(op => {
  console.log(`  ${op.concurrency} concurrent: ${op.successful}/${op.concurrency} successful, avg ${op.averageTime.toFixed(2)}ms`);
});

console.log('\nDatabase Operation Performance:');
const dbOps = performanceMetrics.databaseOperations;
if (dbOps.length > 0) {
  const createOps = dbOps.filter(op => op.operation === 'create');
  const retrieveOps = dbOps.filter(op => op.operation === 'retrieve');
  const terminateOps = dbOps.filter(op => op.operation === 'terminate');
  
  if (createOps.length > 0) {
    const avg = createOps.reduce((a, b) => a + b.duration, 0) / createOps.length;
    console.log(`  Create: ${avg.toFixed(2)}ms avg (${createOps.length} ops)`);
  }
  if (retrieveOps.length > 0) {
    const avg = retrieveOps.reduce((a, b) => a + b.duration, 0) / retrieveOps.length;
    console.log(`  Retrieve: ${avg.toFixed(2)}ms avg (${retrieveOps.length} ops)`);
  }
  if (terminateOps.length > 0) {
    const avg = terminateOps.reduce((a, b) => a + b.duration, 0) / terminateOps.length;
    console.log(`  Terminate: ${avg.toFixed(2)}ms avg (${terminateOps.length} ops)`);
  }
}

// Cleanup
console.log('\n🧹 Cleaning up...');
try {
  await streamSessionManager.shutdown();
  await cleanupTestData();
  console.log('✅ Performance test cleanup completed');
  process.exit(0);
} catch (error) {
  console.log('⚠️  Performance test cleanup warning:', error.message);
  process.exit(1);
} 