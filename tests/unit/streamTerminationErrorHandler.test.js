/**
 * Unit tests for StreamTerminationErrorHandler
 * 
 * Tests error handling, retry logic, metrics tracking, and observability features
 */

import streamTerminationErrorHandler from "../../services/streamTerminationErrorHandler.js";

describe('StreamTerminationErrorHandler', () => {
  
  beforeAll(async () => {
    await streamTerminationErrorHandler.initialize();
  });

  beforeEach(() => {
    // Clean up before each test to ensure isolation
    streamTerminationErrorHandler.clearLogBuffer();
    streamTerminationErrorHandler.clearErrorStats();
  });

  afterEach(() => {
    // Clean up after each test
    streamTerminationErrorHandler.clearLogBuffer();
    streamTerminationErrorHandler.clearErrorStats();
  });

  describe('Basic initialization', () => {
    test('should initialize successfully', async () => {
      expect(streamTerminationErrorHandler).toBeDefined();
      // Re-initialize to test the initialization
      await streamTerminationErrorHandler.initialize();
      expect(true).toBe(true); // If we get here, initialization succeeded
    });
  });

  describe('Error handling and retry logic', () => {
    test('should execute successful operations', async () => {
      const successOperation = async () => "success";
      const successResult = await streamTerminationErrorHandler.executeWithRetry(successOperation, {
        operationName: "test_success",
        sessionId: "test-session-1",
        conversationId: "test-conversation-1"
      });
      expect(successResult).toBe("success");
    });

    test('should retry on temporary errors', async () => {
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
      
      expect(retryResult).toBe("retry success");
      expect(attemptCount).toBe(3);
    });

    test('should not retry on validation errors', async () => {
      const validationOperation = async () => {
        throw new Error("invalid session ID");
      };
      
      await expect(streamTerminationErrorHandler.executeWithRetry(validationOperation, {
        operationName: "test_validation_error",
        sessionId: "test-session-3",
        maxRetries: 3
      })).rejects.toThrow("invalid session ID");
    });
  });

  describe('Logging and observability', () => {
    test('should log termination events', () => {
      const eventData = {
        sessionId: "test-session-5",
        conversationId: "test-conversation-5",
        reason: "USER_REQUESTED",
        tokenCount: 150,
        partialResponseLength: 500
      };
      
      expect(() => {
        streamTerminationErrorHandler.logTerminationEvent("session_terminated", eventData);
      }).not.toThrow();
    });

    test('should track session metrics', () => {
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
      
      expect(sessionMetrics).toBeDefined();
      expect(sessionMetrics.metrics.status).toBe("ACTIVE");
      expect(sessionMetrics.metrics.tokenCount).toBe(100);
    });

    test('should handle different log levels', () => {
      expect(() => {
        streamTerminationErrorHandler.logInfo("Info message", { context: "test" });
        streamTerminationErrorHandler.logWarn("Warning message", { context: "test" });
        streamTerminationErrorHandler.logError("Error message", { context: "test" });
        streamTerminationErrorHandler.logDebug("Debug message", { context: "test" });
      }).not.toThrow();
    });
  });

  describe('Metrics and statistics', () => {
    test('should track error statistics', async () => {
      // Get initial stats
      const initialStats = streamTerminationErrorHandler.getErrorStats();
      const initialTotalErrors = initialStats.totalErrors;
      
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
      expect(stats.totalErrors).toBeGreaterThan(initialTotalErrors);
      expect(stats.operationStats.test_stats_success?.successCount).toBeGreaterThan(0);
      expect(stats.operationStats.test_stats_error?.errorCount).toBeGreaterThan(0);
    });

    test('should track operation metrics', async () => {
      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return "slow success";
      };
      
      await streamTerminationErrorHandler.executeWithRetry(slowOperation, {
        operationName: "test_duration",
        enableMetrics: true
      });
      
      const metrics = streamTerminationErrorHandler.getOperationMetrics("test_duration");
      expect(metrics.totalCalls).toBeGreaterThan(0);
      expect(metrics.successCount).toBeGreaterThan(0);
      expect(metrics.totalDuration).toBeGreaterThan(0);
    });
  });

  describe('Error recovery and concurrent operations', () => {
    test('should handle concurrent operations', async () => {
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
      expect(resolvedResults).toEqual(['result-0', 'result-1', 'result-2']);
    });
  });

  describe('Utility functions', () => {
    test('should generate unique operation IDs', () => {
      const id1 = streamTerminationErrorHandler._generateOperationId("test_op");
      const id2 = streamTerminationErrorHandler._generateOperationId("test_op");
      
      expect(id1).not.toBe(id2);
      expect(/^test_op_\d+_[a-z0-9]+$/.test(id1)).toBe(true);
      expect(/^test_op_\d+_[a-z0-9]+$/.test(id2)).toBe(true);
    });

    test('should generate unique event IDs', () => {
      const eventId1 = streamTerminationErrorHandler._generateEventId("test_event");
      const eventId2 = streamTerminationErrorHandler._generateEventId("test_event");
      
      expect(eventId1).not.toBe(eventId2);
      expect(/^test_event_\d+_[a-z0-9]+$/.test(eventId1)).toBe(true);
      expect(/^test_event_\d+_[a-z0-9]+$/.test(eventId2)).toBe(true);
    });

    test('should calculate backoff delays correctly', () => {
      const delay1 = streamTerminationErrorHandler._calculateBackoffDelay(1, 1000, 10000, 2);
      const delay2 = streamTerminationErrorHandler._calculateBackoffDelay(2, 1000, 10000, 2);
      const delay3 = streamTerminationErrorHandler._calculateBackoffDelay(3, 1000, 10000, 2);
      
      expect(delay1).toBe(1000);
      expect(delay2).toBe(2000);
      expect(delay3).toBe(4000);
    });

    test('should make correct retry decisions', () => {
      const retryableError = new Error("connection timeout");
      const nonRetryableError = new Error("invalid session ID");
      
      expect(streamTerminationErrorHandler._shouldRetry(retryableError)).toBe(true);
      expect(streamTerminationErrorHandler._shouldRetry(nonRetryableError)).toBe(false);
    });
  });

  describe('Cleanup and resource management', () => {
    test('should clear logs and stats', () => {
      // Generate some logs and stats
      streamTerminationErrorHandler.logInfo("Test log");
      streamTerminationErrorHandler.logError("Test error");
      
      let logs = streamTerminationErrorHandler.getRecentLogs(10);
      let stats = streamTerminationErrorHandler.getErrorStats();
      
      expect(logs.length).toBeGreaterThan(0);
      // Note: stats.totalErrors might be 0 if no errors were recorded in this test
      // We'll just check that the stats object exists
      expect(stats).toBeDefined();
      
      // Clear everything
      streamTerminationErrorHandler.clearLogBuffer();
      streamTerminationErrorHandler.clearErrorStats();
      
      logs = streamTerminationErrorHandler.getRecentLogs(10);
      stats = streamTerminationErrorHandler.getErrorStats();
      
      // After clearing, logs should only contain the clear operation log entries
      // (both clearLogBuffer() and clearErrorStats() add log entries when clearing)
      expect(logs.length).toBe(2);
      expect(logs[0].message).toContain("Cleared log buffer");
      expect(logs[1].message).toContain("Cleared all error statistics");
      expect(stats.totalErrors).toBe(0);
    });
  });

  describe('Log filtering', () => {
    test('should filter logs by level', () => {
      // Add logs of different levels
      streamTerminationErrorHandler.logInfo("Info message");
      streamTerminationErrorHandler.logWarn("Warning message");
      streamTerminationErrorHandler.logError("Error message");
      
      const allLogs = streamTerminationErrorHandler.getRecentLogs(10);
      const infoLogs = streamTerminationErrorHandler.getRecentLogs(10, "info");
      const errorLogs = streamTerminationErrorHandler.getRecentLogs(10, "error");
      
      expect(allLogs.length).toBeGreaterThan(0);
      expect(infoLogs.length).toBeGreaterThan(0);
      expect(errorLogs.length).toBeGreaterThan(0);
    });
  });
}); 