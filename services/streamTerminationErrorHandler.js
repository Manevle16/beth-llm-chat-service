/**
 * Stream Termination Error Handling and Observability Service
 * 
 * This service provides comprehensive error handling, structured logging,
 * metrics tracking, and observability specifically for stream termination operations.
 */

class StreamTerminationErrorHandler {
  constructor() {
    this._isInitialized = false;
    this._errorCounts = new Map();
    this._terminationMetrics = new Map();
    this._sessionMetrics = new Map();
    this._logBuffer = [];
    this._maxLogBufferSize = 1000;
    this._startTime = Date.now();
  }

  /**
   * Initialize the error handling service
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    console.log("🛡️  Initializing Stream Termination Error Handler...");

    try {
      this._isInitialized = true;
      console.log("✅ Stream Termination Error Handler initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Stream Termination Error Handler:", error.message);
      throw error;
    }
  }

  /**
   * Execute stream termination operation with comprehensive error handling
   * @param {Function} operation - Operation to execute
   * @param {Object} options - Execution options
   * @returns {Promise<any>} Operation result
   */
  async executeWithRetry(operation, options = {}) {
    this._ensureInitialized();

    const {
      operationName = 'unknown',
      sessionId = null,
      conversationId = null,
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      backoffMultiplier = 2,
      enableMetrics = true
    } = options;

    const enableLogging = false;

    const operationId = this._generateOperationId(operationName);
    const startTime = Date.now();
    
    if (enableLogging) {
      this.logInfo(`🔄 Starting stream termination operation: ${operationName}`, { 
        operationId, 
        sessionId, 
        conversationId,
        options 
      });
    }

    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const result = await operation();
        const duration = Date.now() - startTime;

        // Record success
        this._recordSuccess(operationName, sessionId, conversationId);
        
        if (enableMetrics) {
          this._recordMetrics(operationName, 'success', duration, sessionId, conversationId);
        }
        
        if (enableLogging) {
          this.logInfo(`✅ Stream termination operation completed: ${operationName}`, { 
            operationId, 
            sessionId, 
            conversationId,
            duration,
            attempt 
          });
        }
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        lastError = error;
        
        // Record error
        this._recordError(operationName, error, sessionId, conversationId);
        
        if (enableMetrics) {
          this._recordMetrics(operationName, 'error', duration, sessionId, conversationId, error);
        }
        
        if (enableLogging) {
          this.logError(`❌ Stream termination operation failed: ${operationName}`, { 
            operationId, 
            sessionId, 
            conversationId,
            error: error.message,
            attempt,
            duration 
          });
        }
        
        // Check if we should retry
        if (attempt <= maxRetries && this._shouldRetry(error)) {
          const delay = this._calculateBackoffDelay(attempt, baseDelay, maxDelay, backoffMultiplier);
          
          if (enableLogging) {
            this.logWarn(`⏳ Retrying stream termination operation: ${operationName}`, { 
              operationId, 
              sessionId, 
              conversationId,
              attempt: attempt + 1,
              delay,
              reason: this._getRetryReason(error)
            });
          }
          
          await this._sleep(delay);
          continue;
        }
        
        break;
      }
    }
    
    // All retries exhausted
    if (enableLogging) {
      this.logError(`💥 Stream termination operation failed after ${maxRetries + 1} attempts: ${operationName}`, { 
        operationId, 
        sessionId, 
        conversationId,
        finalError: lastError.message 
      });
    }
    
    throw lastError;
  }

  /**
   * Log stream termination event with structured data
   * @param {string} eventType - Type of termination event
   * @param {Object} data - Event data
   * @param {Object} context - Additional context
   */
  logTerminationEvent(eventType, data = {}, context = {}) {
    this._ensureInitialized();
    
    const eventId = this._generateEventId(eventType);
    const timestamp = new Date().toISOString();
    
    const logData = {
      eventId,
      eventType,
      timestamp,
      ...data,
      ...context
    };
    
    this.logInfo(`📊 Stream termination event: ${eventType}`, logData);
    this._recordTerminationEvent(eventType, data);
  }

  /**
   * Track session metrics
   * @param {string} sessionId - Session ID
   * @param {Object} metrics - Session metrics
   */
  trackSessionMetrics(sessionId, metrics = {}) {
    this._ensureInitialized();
    
    if (!this._sessionMetrics.has(sessionId)) {
      this._sessionMetrics.set(sessionId, {
        created: Date.now(),
        events: [],
        metrics: {}
      });
    }
    
    const sessionData = this._sessionMetrics.get(sessionId);
    sessionData.events.push({
      timestamp: Date.now(),
      ...metrics
    });
    
    // Update aggregated metrics
    Object.assign(sessionData.metrics, metrics);
  
  }

  /**
   * Log structured message with context
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
      ...context
    };
    
    // Add to buffer
    this._logBuffer.push(logEntry);
    if (this._logBuffer.length > this._maxLogBufferSize) {
      this._logBuffer.shift();
    }
    
    // Output to console with emoji
    const emoji = this._getLogEmoji(level);
    const contextStr = Object.keys(context).length > 0 ? ` | ${JSON.stringify(context)}` : '';
    console.log(`${emoji} ${message}${contextStr}`);
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  logInfo(message, context = {}) {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  logWarn(message, context = {}) {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  logError(message, context = {}) {
    this.log('error', message, context);
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  logDebug(message, context = {}) {
    this.log('debug', message, context);
  }

  /**
   * Get comprehensive error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    this._ensureInitialized();
    
    const stats = {
      totalErrors: 0,
      errorCounts: {},
      operationStats: {},
      sessionStats: {},
      uptime: Date.now() - this._startTime,
      recentErrors: []
    };
    
    // Aggregate error counts
    for (const [operation, count] of this._errorCounts) {
      stats.totalErrors += count;
      stats.errorCounts[operation] = count;
    }
    
    // Get operation metrics
    for (const [operation, metrics] of this._terminationMetrics) {
      stats.operationStats[operation] = {
        totalCalls: metrics.totalCalls || 0,
        successCount: metrics.successCount || 0,
        errorCount: metrics.errorCount || 0,
        averageDuration: metrics.totalDuration ? metrics.totalDuration / metrics.totalCalls : 0,
        lastCall: metrics.lastCall || null
      };
    }
    
    // Get session metrics
    stats.sessionStats = {
      totalSessions: this._sessionMetrics.size,
      activeSessions: Array.from(this._sessionMetrics.values()).filter(s => s.metrics.status === 'ACTIVE').length,
      terminatedSessions: Array.from(this._sessionMetrics.values()).filter(s => s.metrics.status === 'TERMINATED').length
    };
    
    // Get recent errors from log buffer
    stats.recentErrors = this._logBuffer
      .filter(entry => entry.level === 'error')
      .slice(-10)
      .map(entry => ({
        timestamp: entry.timestamp,
        message: entry.message,
        context: entry
      }));
    
    return stats;
  }

  /**
   * Get termination metrics for a specific operation
   * @param {string} operationName - Operation name
   * @returns {Object} Operation metrics
   */
  getOperationMetrics(operationName) {
    this._ensureInitialized();
    
    return this._terminationMetrics.get(operationName) || {
      totalCalls: 0,
      successCount: 0,
      errorCount: 0,
      totalDuration: 0,
      lastCall: null
    };
  }

  /**
   * Get session metrics for a specific session
   * @param {string} sessionId - Session ID
   * @returns {Object} Session metrics
   */
  getSessionMetrics(sessionId) {
    this._ensureInitialized();
    
    return this._sessionMetrics.get(sessionId) || null;
  }

  /**
   * Clear error statistics
   */
  clearErrorStats() {
    this._ensureInitialized();
    
    this._errorCounts.clear();
    this._terminationMetrics.clear();
    this._sessionMetrics.clear();
    this._startTime = Date.now();
    
    this.logInfo("🗑️  Cleared all error statistics and metrics");
  }

  /**
   * Clear log buffer
   */
  clearLogBuffer() {
    this._ensureInitialized();
    
    const clearedCount = this._logBuffer.length;
    this._logBuffer = [];
    
    this.logInfo(`🗑️  Cleared log buffer: ${clearedCount} entries removed`);
  }

  /**
   * Get recent logs
   * @param {number} limit - Number of logs to return
   * @param {string} level - Filter by log level
   * @returns {Array} Recent logs
   */
  getRecentLogs(limit = 50, level = null) {
    this._ensureInitialized();
    
    let logs = this._logBuffer;
    
    if (level) {
      logs = logs.filter(entry => entry.level === level);
    }
    
    return logs.slice(-limit);
  }

  /**
   * Ensure service is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this._isInitialized) {
      throw new Error("StreamTerminationErrorHandler not initialized. Call initialize() first.");
    }
  }

  /**
   * Generate operation ID
   * @param {string} operationName - Operation name
   * @returns {string} Operation ID
   * @private
   */
  _generateOperationId(operationName) {
    return `${operationName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate event ID
   * @param {string} eventType - Event type
   * @returns {string} Event ID
   * @private
   */
  _generateEventId(eventType) {
    return `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Record successful operation
   * @param {string} operationName - Operation name
   * @param {string} sessionId - Session ID
   * @param {string} conversationId - Conversation ID
   * @private
   */
  _recordSuccess(operationName, sessionId, conversationId) {
    if (!this._terminationMetrics.has(operationName)) {
      this._terminationMetrics.set(operationName, {
        totalCalls: 0,
        successCount: 0,
        errorCount: 0,
        totalDuration: 0,
        lastCall: null
      });
    }
    
    const metrics = this._terminationMetrics.get(operationName);
    metrics.totalCalls++;
    metrics.successCount++;
    metrics.lastCall = Date.now();
  }

  /**
   * Record operation error
   * @param {string} operationName - Operation name
   * @param {Error} error - Error object
   * @param {string} sessionId - Session ID
   * @param {string} conversationId - Conversation ID
   * @private
   */
  _recordError(operationName, error, sessionId, conversationId) {
    // Update error count
    const currentCount = this._errorCounts.get(operationName) || 0;
    this._errorCounts.set(operationName, currentCount + 1);
    
    // Update operation metrics
    if (!this._terminationMetrics.has(operationName)) {
      this._terminationMetrics.set(operationName, {
        totalCalls: 0,
        successCount: 0,
        errorCount: 0,
        totalDuration: 0,
        lastCall: null
      });
    }
    
    const metrics = this._terminationMetrics.get(operationName);
    metrics.totalCalls++;
    metrics.errorCount++;
    metrics.lastCall = Date.now();
  }

  /**
   * Record termination event
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @private
   */
  _recordTerminationEvent(eventType, data) {
    if (!this._terminationMetrics.has(eventType)) {
      this._terminationMetrics.set(eventType, {
        totalCalls: 0,
        successCount: 0,
        errorCount: 0,
        totalDuration: 0,
        lastCall: null
      });
    }
    
    const metrics = this._terminationMetrics.get(eventType);
    metrics.totalCalls++;
    metrics.lastCall = Date.now();
  }

  /**
   * Check if error should be retried
   * @param {Error} error - Error object
   * @returns {boolean} True if should retry
   * @private
   */
  _shouldRetry(error) {
    // Don't retry on validation errors or permission errors
    if (error.message.includes('not found') || 
        error.message.includes('permission') ||
        error.message.includes('validation') ||
        error.message.includes('invalid')) {
      return false;
    }
    
    // Retry on network errors, timeouts, and temporary failures
    return error.message.includes('timeout') ||
           error.message.includes('connection') ||
           error.message.includes('network') ||
           error.message.includes('temporary');
  }

  /**
   * Calculate backoff delay
   * @param {number} attempt - Attempt number
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
   * @param {Error} error - Error object
   * @returns {string} Retry reason
   * @private
   */
  _getRetryReason(error) {
    if (error.message.includes('timeout')) return 'timeout';
    if (error.message.includes('connection')) return 'connection_error';
    if (error.message.includes('network')) return 'network_error';
    if (error.message.includes('temporary')) return 'temporary_failure';
    return 'unknown_error';
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Sleep promise
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
    switch (level) {
      case 'info': return 'ℹ️';
      case 'warn': return '⚠️';
      case 'error': return '❌';
      case 'debug': return '🔍';
      default: return '📝';
    }
  }

  /**
   * Record metrics for operation
   * @param {string} operationName - Operation name
   * @param {string} outcome - Operation outcome (success/error)
   * @param {number} duration - Operation duration in ms
   * @param {string} sessionId - Session ID
   * @param {string} conversationId - Conversation ID
   * @param {Error} error - Error object (if applicable)
   * @private
   */
  _recordMetrics(operationName, outcome, duration, sessionId, conversationId, error = null) {
    if (!this._terminationMetrics.has(operationName)) {
      this._terminationMetrics.set(operationName, {
        totalCalls: 0,
        successCount: 0,
        errorCount: 0,
        totalDuration: 0,
        lastCall: null
      });
    }
    
    const metrics = this._terminationMetrics.get(operationName);
    metrics.totalCalls++;
    metrics.totalDuration += duration;
    metrics.lastCall = Date.now();
    
    if (outcome === 'success') {
      metrics.successCount++;
    } else {
      metrics.errorCount++;
    }
  }
}

export default new StreamTerminationErrorHandler(); 