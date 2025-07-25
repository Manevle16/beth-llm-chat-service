/**
 * ErrorHandlingService Test Suite
 * 
 * Tests for essential error handling functionality including retry logic,
 * circuit breaker, fallback operations, and logging.
 */

import errorHandlingService from '../../services/errorHandlingService.js';
import { createRotationError, ERROR_CODES } from '../../types/modelRotation.js';

describe('ErrorHandlingService', () => {
  beforeEach(async () => {
    await errorHandlingService.initialize();
    errorHandlingService.clearErrorStats();
    errorHandlingService.clearLogBuffer();
  });

  describe('Initialization', () => {
    it('should initialize without error', async () => {
      await expect(errorHandlingService.initialize()).resolves.not.toThrow();
    });
  });

  describe('Retry Logic', () => {
    it('should execute operation successfully on first try', async () => {
      const result = await errorHandlingService.executeWithRetry(
        async () => 'success',
        { maxRetries: 2, baseDelay: 1, enableLogging: false }
      );
      expect(result).toBe('success');
    });

    it('should fail after all retries exhausted', async () => {
      await expect(
        errorHandlingService.executeWithRetry(
          async () => { throw new Error('fail'); },
          { maxRetries: 1, baseDelay: 1, enableLogging: false }
        )
      ).rejects.toThrow('fail');
    });

    it('should not retry non-retryable errors', async () => {
      await expect(
        errorHandlingService.executeWithRetry(
          async () => {
            throw createRotationError(
              ERROR_CODES.INVALID_INPUT,
              'Invalid input',
              'test'
            );
          },
          { maxRetries: 2, enableLogging: false }
        )
      ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_INPUT });
    });
  });

  describe('Circuit Breaker', () => {
    it('should track error counts for operations', async () => {
      const opName = 'test-op';
      
      // Trigger some failures
      for (let i = 0; i < 3; i++) {
        try {
          await errorHandlingService.executeWithRetry(
            async () => { throw new Error('fail'); },
            { operationName: opName, maxRetries: 0, enableLogging: false }
          );
        } catch {}
      }
      
      // Check that errors are tracked
      const stats = errorHandlingService.getErrorStats();
      expect(stats.errorCounts[opName]).toBeGreaterThan(0);
    });

    it('should reset circuit breaker', () => {
      expect(typeof errorHandlingService.resetCircuitBreaker('test-op')).toBe('boolean');
    });
  });

  describe('Fallback', () => {
    it('should use fallback if primary fails', async () => {
      const result = await errorHandlingService.executeWithFallback(
        async () => { throw new Error('fail'); },
        async () => 'fallback',
        { enableLogging: false }
      );
      expect(result).toBe('fallback');
    });

    it('should throw if both primary and fallback fail', async () => {
      await expect(
        errorHandlingService.executeWithFallback(
          async () => { throw new Error('fail'); },
          async () => { throw new Error('fallback fail'); },
          { enableLogging: false }
        )
      ).rejects.toThrow('fail');
    });
  });

  describe('Logging', () => {
    it('should log at all levels without error', () => {
      expect(() => {
        errorHandlingService.logInfo('info');
        errorHandlingService.logWarn('warn');
        errorHandlingService.logError('error');
        errorHandlingService.logDebug('debug');
      }).not.toThrow();
    });

    it('should clear log buffer', () => {
      errorHandlingService.logInfo('test');
      expect(typeof errorHandlingService.clearLogBuffer()).toBe('number');
    });
  });

  describe('Error Statistics', () => {
    it('should return error statistics', () => {
      const stats = errorHandlingService.getErrorStats();
      expect(stats).toHaveProperty('totalErrors');
      expect(stats).toHaveProperty('errorCounts');
      expect(stats).toHaveProperty('retryAttempts');
      expect(stats).toHaveProperty('circuitBreakerStates');
      expect(stats).toHaveProperty('recentErrors');
    });

    it('should clear error statistics', () => {
      const clearedCount = errorHandlingService.clearErrorStats();
      expect(typeof clearedCount).toBe('number');
    });
  });
}); 