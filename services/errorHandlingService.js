/**
 * Error Handling and Observability Service
 * 
 * This service provides comprehensive error handling, structured logging,
 * retry logic with exponential backoff, and graceful degradation for
 * all model rotation operations.
 */

import {
  createRotationError,
  ERROR_CODES,
  OPERATIONS
} from "../types/modelRotation.js";
import configService from "../config/modelRotation.js";

class ErrorHandlingService {
  constructor() {
    this._isInitialized = false;
    this._errorCounts = new Map();
    this._retryAttempts = new Map();
    this._lastErrorTime = new Map();
    this._circuitBreakerState = new Map();
    this._logBuffer = [];
    this._maxLogBufferSize = 1000;
  }

  /**
   * Initialize the error handling service
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    console.log("🛡️  Initializing Error Handling Service...");

    try {
      configService.initialize();
      this._isInitialized = true;
      console.log("✅ Error Handling Service initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Error Handling Service:", error.message);
      throw error;
    }
  }

  /**
   * Execute operation with comprehensive error handling and retry logic
   * @param {Function} operation - Operation to execute
   * @param {Object} options - Execution options
   * @returns {Promise<any>} Operation result
   */
  async executeWithRetry(operation, options = {}) {
    this._ensureInitialized();

    const {
      operationName = 'unknown',
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
      circuitBreakerThreshold = 5,
      circuitBreakerTimeout = 60000,
      enableLogging = true,
      enableMetrics = true
    } = options;

    const operationId = this._generateOperationId(operationName);
    
    if (enableLogging) {
      this.logInfo(`🔄 Starting operation: ${operationName}`, { operationId, options });
    }

    // Check circuit breaker
    if (this._isCircuitBreakerOpen(operationName, circuitBreakerThreshold, circuitBreakerTimeout)) {
      const error = createRotationError(
        ERROR_CODES.CIRCUIT_BREAKER_OPEN,
        `Circuit breaker is open for operation: ${operationName}`,
        operationName
      );
      
      if (enableLogging) {
        this.logError(`🚨 Circuit breaker open for ${operationName}`, { operationId, error });
      }
      
      throw error;
    }

    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const startTime = Date.now();
      
      try {
        const result = await operation();
        const duration = Date.now() - startTime;

        // Record success
        this._recordSuccess(operationName);
        
        if (enableLogging) {
          this.logInfo(`✅ Operation completed: ${operationName}`, {
            operationId,
            attempt,
            duration,
            success: true
          });
        }

        if (enableMetrics) {
          this._recordMetrics(operationName, 'success', duration);
        }

        return result;

      } catch (error) {
        lastError = error;
        const duration = Date.now() - startTime;

        // Record error
        this._recordError(operationName, error);
        
        if (enableLogging) {
          this.logError(`❌ Operation failed: ${operationName}`, {
            operationId,
            attempt,
            maxRetries,
            duration,
            error: error.message,
            errorCode: error.code || 'UNKNOWN'
          });
        }

        if (enableMetrics) {
          this._recordMetrics(operationName, 'error', duration);
        }

        // Check if we should retry
        if (attempt <= maxRetries && this._shouldRetry(error)) {
          const delay = this._calculateBackoffDelay(attempt, baseDelay, maxDelay, backoffMultiplier);
          
          if (enableLogging) {
            this.logInfo(`⏳ Retrying operation: ${operationName}`, {
              operationId,
              attempt: attempt + 1,
              delay,
              reason: this._getRetryReason(error)
            });
          }

          await this._sleep(delay);
        } else {
          break;
        }
      }
    }

    // All retries exhausted
    if (enableLogging) {
      this.logError(`💥 Operation failed after ${maxRetries + 1} attempts: ${operationName}`, {
        operationId,
        finalError: lastError.message,
        errorCode: lastError.code || 'UNKNOWN'
      });
    }

    throw lastError;
  }

  /**
   * Execute operation with graceful degradation
   * @param {Function} primaryOperation - Primary operation to try
   * @param {Function} fallbackOperation - Fallback operation if primary fails
   * @param {Object} options - Execution options
   * @returns {Promise<any>} Operation result
   */
  async executeWithFallback(primaryOperation, fallbackOperation, options = {}) {
    this._ensureInitialized();

    const {
      operationName = 'unknown',
      enableLogging = true,
      enableMetrics = true
    } = options;

    const operationId = this._generateOperationId(operationName);

    if (enableLogging) {
      this.logInfo(`🔄 Starting operation with fallback: ${operationName}`, { operationId });
    }

    try {
      // Try primary operation
      const startTime = Date.now();
      const result = await primaryOperation();
      const duration = Date.now() - startTime;

      if (enableLogging) {
        this.logInfo(`✅ Primary operation succeeded: ${operationName}`, {
          operationId,
          duration,
          usedFallback: false
        });
      }

      if (enableMetrics) {
        this._recordMetrics(operationName, 'primary_success', duration);
      }

      return result;

    } catch (primaryError) {
      if (enableLogging) {
        this.logWarn(`⚠️  Primary operation failed, trying fallback: ${operationName}`, {
          operationId,
          primaryError: primaryError.message
        });
      }

      try {
        // Try fallback operation
        const startTime = Date.now();
        const fallbackResult = await fallbackOperation();
        const duration = Date.now() - startTime;

        if (enableLogging) {
          this.logInfo(`✅ Fallback operation succeeded: ${operationName}`, {
            operationId,
            duration,
            usedFallback: true
          });
        }

        if (enableMetrics) {
          this._recordMetrics(operationName, 'fallback_success', duration);
        }

        return fallbackResult;

      } catch (fallbackError) {
        if (enableLogging) {
          this.logError(`💥 Both primary and fallback operations failed: ${operationName}`, {
            operationId,
            primaryError: primaryError.message,
            fallbackError: fallbackError.message
          });
        }

        if (enableMetrics) {
          this._recordMetrics(operationName, 'both_failed', 0);
        }

        // Throw the primary error as it's likely more relevant
        throw primaryError;
      }
    }
  }

  /**
   * Structured logging with different levels
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  log(level, message, context = {}) {
    this._ensureInitialized();

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      context,
      service: 'model-rotation'
    };

    // Add to buffer
    this._logBuffer.push(logEntry);
    if (this._logBuffer.length > this._maxLogBufferSize) {
      this._logBuffer.shift();
    }

    // Console output with emoji
    const emoji = this._getLogEmoji(level);
    const contextStr = Object.keys(context).length > 0 ? ` | ${JSON.stringify(context)}` : '';
    
    console.log(`${emoji} ${message}${contextStr}`);
  }

  /**
   * Log info level message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  logInfo(message, context = {}) {
    this.log('info', message, context);
  }

  /**
   * Log warning level message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  logWarn(message, context = {}) {
    this.log('warn', message, context);
  }

  /**
   * Log error level message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  logError(message, context = {}) {
    this.log('error', message, context);
  }

  /**
   * Log debug level message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  logDebug(message, context = {}) {
    this.log('debug', message, context);
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    this._ensureInitialized();

    const stats = {
      totalErrors: 0,
      errorCounts: {},
      retryAttempts: {},
      circuitBreakerStates: {},
      recentErrors: []
    };

    // Aggregate error counts
    for (const [operation, count] of this._errorCounts) {
      stats.totalErrors += count;
      stats.errorCounts[operation] = count;
    }

    // Add retry attempts
    for (const [operation, attempts] of this._retryAttempts) {
      stats.retryAttempts[operation] = attempts;
    }

    // Add circuit breaker states
    for (const [operation, state] of this._circuitBreakerState) {
      stats.circuitBreakerStates[operation] = {
        isOpen: state.isOpen,
        lastFailureTime: state.lastFailureTime,
        failureCount: state.failureCount
      };
    }

    // Add recent errors from log buffer
    const recentErrors = this._logBuffer
      .filter(entry => entry.level === 'error')
      .slice(-10)
      .map(entry => ({
        timestamp: entry.timestamp,
        message: entry.message,
        context: entry.context
      }));

    stats.recentErrors = recentErrors;

    return stats;
  }

  /**
   * Get operation metrics
   * @param {string} operationName - Operation name to get metrics for
   * @returns {Object} Operation metrics
   */
  getOperationMetrics(operationName) {
    this._ensureInitialized();

    const metrics = {
      operation: operationName,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0,
      errorRate: 0,
      retryRate: 0,
      circuitBreakerStatus: 'closed'
    };

    // Calculate metrics from stored data
    const errorCount = this._errorCounts.get(operationName) || 0;
    const retryAttempts = this._retryAttempts.get(operationName) || 0;
    const circuitBreaker = this._circuitBreakerState.get(operationName);

    if (circuitBreaker) {
      metrics.circuitBreakerStatus = circuitBreaker.isOpen ? 'open' : 'closed';
    }

    // This is a simplified version - in a real implementation,
    // you'd store more detailed metrics
    metrics.failedExecutions = errorCount;
    metrics.retryRate = retryAttempts;

    return metrics;
  }

  /**
   * Clear error statistics
   * @returns {number} Number of entries cleared
   */
  clearErrorStats() {
    const clearedCount = this._errorCounts.size + this._retryAttempts.size + this._circuitBreakerState.size;
    
    this._errorCounts.clear();
    this._retryAttempts.clear();
    this._circuitBreakerState.clear();
    
    this.logInfo(`🗑️  Cleared ${clearedCount} error statistics entries`);
    return clearedCount;
  }

  /**
   * Clear log buffer
   * @returns {number} Number of log entries cleared
   */
  clearLogBuffer() {
    const clearedCount = this._logBuffer.length;
    this._logBuffer = [];
    
    this.logInfo(`🗑️  Cleared ${clearedCount} log buffer entries`);
    return clearedCount;
  }

  /**
   * Get recent logs
   * @param {number} limit - Number of recent logs to return
   * @param {string} level - Filter by log level
   * @returns {Array} Recent log entries
   */
  getRecentLogs(limit = 50, level = null) {
    this._ensureInitialized();

    let logs = [...this._logBuffer];

    if (level) {
      logs = logs.filter(entry => entry.level === level);
    }

    return logs.slice(-limit);
  }

  /**
   * Reset circuit breaker for an operation
   * @param {string} operationName - Operation name
   * @returns {boolean} True if reset, false if not found
   */
  resetCircuitBreaker(operationName) {
    this._ensureInitialized();

    const circuitBreaker = this._circuitBreakerState.get(operationName);
    if (circuitBreaker) {
      circuitBreaker.isOpen = false;
      circuitBreaker.failureCount = 0;
      circuitBreaker.lastFailureTime = null;
      
      this.logInfo(`🔄 Reset circuit breaker for operation: ${operationName}`);
      return true;
    }

    return false;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Ensure the service is initialized before use
   * @private
   */
  _ensureInitialized() {
    if (!this._isInitialized) {
      throw new Error("ErrorHandlingService not initialized. Call initialize() first.");
    }
  }

  /**
   * Generate unique operation ID
   * @param {string} operationName - Operation name
   * @returns {string} Unique operation ID
   * @private
   */
  _generateOperationId(operationName) {
    return `${operationName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if circuit breaker is open
   * @param {string} operationName - Operation name
   * @param {number} threshold - Failure threshold
   * @param {number} timeout - Circuit breaker timeout
   * @returns {boolean} True if circuit breaker is open
   * @private
   */
  _isCircuitBreakerOpen(operationName, threshold, timeout) {
    const circuitBreaker = this._circuitBreakerState.get(operationName);
    
    if (!circuitBreaker) {
      return false;
    }

    if (!circuitBreaker.isOpen) {
      return false;
    }

    // Check if timeout has passed
    const now = Date.now();
    if (circuitBreaker.lastFailureTime && (now - circuitBreaker.lastFailureTime) > timeout) {
      // Reset circuit breaker
      circuitBreaker.isOpen = false;
      circuitBreaker.failureCount = 0;
      return false;
    }

    return true;
  }

  /**
   * Record successful operation
   * @param {string} operationName - Operation name
   * @private
   */
  _recordSuccess(operationName) {
    // Reset circuit breaker on success
    const circuitBreaker = this._circuitBreakerState.get(operationName);
    if (circuitBreaker) {
      circuitBreaker.failureCount = 0;
      circuitBreaker.isOpen = false;
    }
  }

  /**
   * Record failed operation
   * @param {string} operationName - Operation name
   * @param {Error} error - Error that occurred
   * @private
   */
  _recordError(operationName, error) {
    // Update error count
    const currentCount = this._errorCounts.get(operationName) || 0;
    this._errorCounts.set(operationName, currentCount + 1);

    // Update circuit breaker
    let circuitBreaker = this._circuitBreakerState.get(operationName);
    if (!circuitBreaker) {
      circuitBreaker = {
        isOpen: false,
        failureCount: 0,
        lastFailureTime: null
      };
      this._circuitBreakerState.set(operationName, circuitBreaker);
    }

    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = Date.now();

    // Check if circuit breaker should open
    const threshold = configService.getSetting('CIRCUIT_BREAKER_THRESHOLD') || 5;
    if (circuitBreaker.failureCount >= threshold) {
      circuitBreaker.isOpen = true;
    }
  }

  /**
   * Check if operation should be retried
   * @param {Error} error - Error that occurred
   * @returns {boolean} True if should retry
   * @private
   */
  _shouldRetry(error) {
    // Don't retry on certain error types
    const nonRetryableErrors = [
      ERROR_CODES.INVALID_INPUT,
      ERROR_CODES.MODEL_NOT_FOUND,
      ERROR_CODES.CIRCUIT_BREAKER_OPEN
    ];

    return !nonRetryableErrors.includes(error.code);
  }

  /**
   * Calculate backoff delay
   * @param {number} attempt - Current attempt number
   * @param {number} baseDelay - Base delay in ms
   * @param {number} maxDelay - Maximum delay in ms
   * @param {number} multiplier - Backoff multiplier
   * @returns {number} Delay in ms
   * @private
   */
  _calculateBackoffDelay(attempt, baseDelay, maxDelay, multiplier) {
    const delay = baseDelay * Math.pow(multiplier, attempt - 1);
    return Math.min(delay, maxDelay);
  }

  /**
   * Get retry reason from error
   * @param {Error} error - Error that occurred
   * @returns {string} Retry reason
   * @private
   */
  _getRetryReason(error) {
    if (error.message.includes('timeout')) {
      return 'timeout';
    } else if (error.message.includes('connection')) {
      return 'connection_error';
    } else if (error.message.includes('rate limit')) {
      return 'rate_limit';
    } else {
      return 'unknown_error';
    }
  }

  /**
   * Sleep for specified duration
   * @param {number} ms - Duration in milliseconds
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get emoji for log level
   * @param {string} level - Log level
   * @returns {string} Emoji
   * @private
   */
  _getLogEmoji(level) {
    const emojis = {
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      debug: '🔍'
    };
    return emojis[level] || '📝';
  }

  /**
   * Record metrics for operation
   * @param {string} operationName - Operation name
   * @param {string} outcome - Operation outcome
   * @param {number} duration - Operation duration
   * @private
   */
  _recordMetrics(operationName, outcome, duration) {
    // In a real implementation, this would send metrics to a monitoring system
    // For now, we'll just log it
    this.logDebug(`📊 Metrics: ${operationName} | ${outcome} | ${duration}ms`);
  }
}

// Export singleton instance
export default new ErrorHandlingService(); 