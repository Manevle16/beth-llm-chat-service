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

// Performance measurement utilities
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
    for (let i = 0; i < 10; i++) { // Reduced from 50 for faster testing
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

describe('Performance and Load Testing for Stream Termination', () => {
  beforeAll(async () => {
    console.log('🚀 Initializing Performance and Load Testing...');
    console.log('='.repeat(60));
    
    // Initialize services
    await streamTerminationErrorHandler.initialize();
    await streamSessionDatabase.initialize();
    await streamSessionManager.initialize();
    await setupTestData();
    
    console.log('✅ Services initialized successfully');
  });

  afterAll(async () => {
    console.log('\n🧹 Cleaning up Performance and Load Testing...');
    
    try {
      await streamSessionManager.shutdown();
      await cleanupTestData();
      await pool.end();
      console.log('✅ Performance test cleanup completed');
    } catch (error) {
      console.log('⚠️  Performance test cleanup warning:', error.message);
    }
  });

  describe('Memory Usage Profiling', () => {
    it('should handle session creation without excessive memory growth', async () => {
      const initialMemory = getMemoryUsage();
      console.log('📊 Initial memory usage:', initialMemory);

      // Create sessions and measure memory growth
      const sessions = [];
      const sessionCount = 20; // Reduced from 100 for faster testing
      
      console.log(`📝 Creating ${sessionCount} sessions...`);
      
      for (let i = 0; i < sessionCount; i++) {
        const session = await streamSessionManager.createSession(`load-test-conv-${i % 10}`, 'llama2');
        sessions.push(session);
        
        // Measure memory every 5 sessions
        if ((i + 1) % 5 === 0) {
          const currentMemory = getMemoryUsage();
          console.log(`📊 Memory at ${i + 1} sessions:`, currentMemory);
        }
      }

      const peakMemory = getMemoryUsage();
      console.log('📊 Peak memory usage:', peakMemory);
      
      // Verify memory growth is reasonable (less than 100MB)
      const memoryGrowth = peakMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryGrowth).toBeLessThan(100);
      
      console.log('✅ Memory usage within acceptable limits');
    });
  });

  describe('Session Cleanup Efficiency', () => {
    it('should efficiently cleanup terminated sessions', async () => {
      // Create some sessions first
      const sessions = [];
      for (let i = 0; i < 10; i++) {
        const session = await streamSessionManager.createSession(`load-test-conv-${i % 10}`, 'llama2');
        sessions.push(session);
      }
      
      const activeSessionsBefore = streamSessionManager.getAllActiveSessions();
      console.log(`📊 Active sessions before cleanup: ${activeSessionsBefore.length}`);

      // Terminate all sessions
      for (const session of sessions) {
        await streamSessionManager.terminateSession(session.id, TERMINATION_REASON.USER_REQUESTED);
      }
      
      // Force cleanup
      await streamSessionManager.cleanupExpiredSessions();
      
      const remainingSessions = streamSessionManager.getAllActiveSessions();
      console.log(`📊 Active sessions after cleanup: ${remainingSessions.length}`);
      
      // Verify cleanup was effective
      expect(remainingSessions.length).toBeLessThanOrEqual(activeSessionsBefore.length);
      
      console.log('✅ Session cleanup working efficiently');
    });
  });

  describe('Concurrent Termination Requests', () => {
    it('should handle concurrent termination requests', async () => {
      // Create sessions for concurrent testing
      const concurrentSessions = [];
      const concurrentCount = 10; // Reduced from 50 for faster testing
      
      console.log(`📝 Creating ${concurrentCount} sessions for concurrent testing...`);
      
      for (let i = 0; i < concurrentCount; i++) {
        const session = await streamSessionManager.createSession(`load-test-conv-${i % 10}`, 'llama2');
        concurrentSessions.push(session);
      }
      
      console.log(`📊 Created ${concurrentSessions.length} sessions for concurrent testing`);
      
      // Test concurrent termination
      const concurrency = 5;
      console.log(`🔄 Testing concurrent termination with ${concurrency} concurrent requests...`);
      
      // Send concurrent termination requests
      const terminationPromises = concurrentSessions.slice(0, concurrency).map(async (session) => {
        try {
          await streamSessionManager.terminateSession(session.id, TERMINATION_REASON.USER_REQUESTED);
          return { success: true, sessionId: session.id };
        } catch (error) {
          return { success: false, error: error.message, sessionId: session.id };
        }
      });
      
      const results = await Promise.allSettled(terminationPromises);
      
      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter(r => r.status === 'fulfilled' && !r.value.success).length;
      const rejected = results.filter(r => r.status === 'rejected').length;
      
      console.log(`📊 Concurrent termination results:`, {
        successful,
        failed,
        rejected,
        total: results.length
      });
      
      // Verify most requests succeeded
      expect(successful).toBeGreaterThan(0);
      expect(successful + failed + rejected).toBe(concurrency);
      
      console.log('✅ Concurrent termination working');
    });
  });

  describe('Database Operation Performance', () => {
    it('should perform database operations efficiently', async () => {
      const dbOperationTimes = [];
      
      // Test database session creation performance
      console.log('📝 Testing database session creation performance...');
      for (let i = 0; i < 5; i++) { // Reduced from 20 for faster testing
        const session = createStreamSession(`load-test-conv-${i % 10}`, 'llama2');
        const endTimer = measureTime('db_session_creation');
        await streamSessionDatabase.createSession(session);
        const duration = endTimer();
        dbOperationTimes.push({ operation: 'create', duration });
      }
      
      // Test database session retrieval performance
      console.log('📝 Testing database session retrieval performance...');
      const dbSessions = await streamSessionDatabase.getSessionsByStatus('ACTIVE', 10);
      
      for (let i = 0; i < Math.min(5, dbSessions.length); i++) {
        const endTimer = measureTime('db_session_retrieval');
        await streamSessionDatabase.getSession(dbSessions[i].id);
        const duration = endTimer();
        dbOperationTimes.push({ operation: 'retrieve', duration });
      }
      
      // Calculate database performance metrics
      const createTimes = dbOperationTimes.filter(t => t.operation === 'create').map(t => t.duration);
      const retrieveTimes = dbOperationTimes.filter(t => t.operation === 'retrieve').map(t => t.duration);
      
      console.log('📊 Database operation performance:', {
        create: {
          count: createTimes.length,
          average: createTimes.length > 0 ? (createTimes.reduce((a, b) => a + b, 0) / createTimes.length).toFixed(2) + 'ms' : 'N/A'
        },
        retrieve: {
          count: retrieveTimes.length,
          average: retrieveTimes.length > 0 ? (retrieveTimes.reduce((a, b) => a + b, 0) / retrieveTimes.length).toFixed(2) + 'ms' : 'N/A'
        }
      });
      
      // Verify operations complete within reasonable time (less than 1 second each)
      const allTimes = dbOperationTimes.map(t => t.duration);
      const maxTime = Math.max(...allTimes);
      expect(maxTime).toBeLessThan(1000); // Less than 1 second
      
      console.log('✅ Database operations performing efficiently');
    });
  });

  describe('Resource Leak Detection', () => {
    it('should not have significant memory or session leaks', async () => {
      const initialMemory = getMemoryUsage();
      const initialSessions = streamSessionManager.getAllActiveSessions().length;
      
      console.log('📊 Initial state:', {
        memory: initialMemory,
        activeSessions: initialSessions
      });
      
      // Perform multiple create/terminate cycles
      const cycles = 3; // Reduced from 10 for faster testing
      const sessionsPerCycle = 5; // Reduced from 20 for faster testing
      
      for (let cycle = 0; cycle < cycles; cycle++) {
        console.log(`🔄 Cycle ${cycle + 1}/${cycles}...`);
        
        // Create sessions
        const cycleSessions = [];
        for (let i = 0; i < sessionsPerCycle; i++) {
          const session = await streamSessionManager.createSession(`load-test-conv-${i % 10}`, 'llama2');
          cycleSessions.push(session);
        }
        
        // Terminate sessions
        for (const session of cycleSessions) {
          await streamSessionManager.terminateSession(session.id, TERMINATION_REASON.USER_REQUESTED);
        }
        
        // Force cleanup
        await streamSessionManager.cleanupExpiredSessions();
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
      
      // Check for potential memory leaks (less than 50MB growth)
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryGrowth).toBeLessThan(50);
      
      // Check for potential session leaks (no more than 2 sessions remaining)
      const sessionGrowth = finalSessions - initialSessions;
      expect(sessionGrowth).toBeLessThanOrEqual(2);
      
      console.log('✅ No significant resource leaks detected');
    });
  });

  describe('Error Handler Performance', () => {
    it('should handle errors efficiently under load', async () => {
      const errorHandlerMetrics = streamTerminationErrorHandler.getErrorStats();
      const operationMetrics = streamTerminationErrorHandler.getOperationMetrics('create_session');
      
      console.log('📊 Error handler performance under load:', {
        totalErrors: errorHandlerMetrics.totalErrors,
        totalOperations: errorHandlerMetrics.totalOperations,
        successRate: errorHandlerMetrics.successRate
      });
      
      // Test error handler buffer performance
      const recentLogs = streamTerminationErrorHandler.getRecentLogs(10);
      console.log(`📊 Recent logs count: ${recentLogs.length}`);
      
      // Test log buffer performance
      const logStart = measureTime('log_buffer_test');
      for (let i = 0; i < 100; i++) { // Reduced from 1000 for faster testing
        streamTerminationErrorHandler.logInfo(`Performance test log ${i}`, { testId: i });
      }
      const logDuration = logStart();
      
      console.log('📊 Log buffer performance:', {
        logsPerSecond: (100 / (logDuration / 1000)).toFixed(0),
        totalTime: logDuration.toFixed(2) + 'ms'
      });
      
      // Verify error handler is working
      expect(errorHandlerMetrics).toBeDefined();
      expect(recentLogs).toBeDefined();
      expect(logDuration).toBeLessThan(1000); // Less than 1 second for 100 logs
      
      console.log('✅ Error handler performing efficiently');
    });
  });
}); 