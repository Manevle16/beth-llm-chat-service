/**
 * Stream Session Manager Service
 * 
 * This service manages active streaming sessions, handles session timeouts,
 * and provides termination capabilities for ongoing streams.
 */

import {
  STREAM_STATUS,
  TERMINATION_REASON,
  createStreamSession,
  createTerminationRequest,
  createTerminationResponse,
  isStreamSession,
  isTerminationRequest,
  isTerminationResponse,
  isSessionExpired,
  canTerminateSession,
  updateSessionWithToken,
  terminateSession,
  completeSession
} from "../types/streamSession.js";
import streamTerminationErrorHandler from "./streamTerminationErrorHandler.js";

class StreamSessionManager {
  constructor() {
    this._activeSessions = new Map(); // Map<sessionId, StreamSession>
    this._cleanupTimer = null;
    this._cleanupInterval = 30000; // 30 seconds default
    this._defaultTimeout = 300000; // 5 minutes default
    this._maxSessions = 100; // Maximum concurrent sessions
    this._isInitialized = false;
    this._stats = {
      totalSessions: 0,
      terminatedSessions: 0,
      completedSessions: 0,
      errorSessions: 0,
      lastCleanup: new Date()
    };
  }

  /**
   * Initialize the stream session manager
   * Starts automatic cleanup timer
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    console.log("🔄 Initializing Stream Session Manager...");

    try {
      // Initialize error handler
      await streamTerminationErrorHandler.initialize();
      
      // Load configuration from environment
      this._loadConfiguration();
      
      // Start automatic cleanup
      this._startCleanupTimer();
      
      this._isInitialized = true;
      console.log("✅ Stream Session Manager initialized successfully");
      console.log(`📊 Configuration: maxSessions=${this._maxSessions}, defaultTimeout=${this._defaultTimeout}ms, cleanupInterval=${this._cleanupInterval}ms`);
      
      // Log initialization event
      streamTerminationErrorHandler.logTerminationEvent('session_manager_initialized', {
        maxSessions: this._maxSessions,
        defaultTimeout: this._defaultTimeout,
        cleanupInterval: this._cleanupInterval
      });
    } catch (error) {
      console.error("❌ Failed to initialize Stream Session Manager:", error.message);
      throw error;
    }
  }

  /**
   * Create a new streaming session
   * @param {string} conversationId - Conversation ID
   * @param {string} model - LLM model name
   * @param {number} timeoutMs - Session timeout in milliseconds (optional)
   * @returns {StreamSession} Created session
   */
  async createSession(conversationId, model, timeoutMs = null) {
    return streamTerminationErrorHandler.executeWithRetry(async () => {
      this._ensureInitialized();

      if (!conversationId || typeof conversationId !== 'string') {
        throw new Error("Invalid conversation ID provided");
      }

      if (!model || typeof model !== 'string') {
        throw new Error("Invalid model name provided");
      }

      // Check if we've reached the maximum number of sessions
      if (this._activeSessions.size >= this._maxSessions) {
        throw new Error(`Maximum number of active sessions (${this._maxSessions}) reached`);
      }

      const sessionTimeout = timeoutMs || this._defaultTimeout;
      const session = createStreamSession(conversationId, model, sessionTimeout);
      
      this._activeSessions.set(session.id, session);
      this._stats.totalSessions++;
      
      // Track session metrics
      streamTerminationErrorHandler.trackSessionMetrics(session.id, {
        status: session.status,
        conversationId: session.conversationId,
        model: session.model,
        timeoutMs: session.timeoutMs,
        createdAt: session.startedAt
      });
      
      // Log session creation event
      streamTerminationErrorHandler.logTerminationEvent('session_created', {
        sessionId: session.id,
        conversationId: session.conversationId,
        model: session.model,
        timeoutMs: session.timeoutMs,
        activeSessions: this._activeSessions.size,
        maxSessions: this._maxSessions
      });
      
      console.log(`📝 Created stream session: ${session.id} for conversation: ${conversationId}`);
      console.log(`📊 Active sessions: ${this._activeSessions.size}/${this._maxSessions}`);
      
      return { ...session };
    }, {
      operationName: 'create_session',
      conversationId,
      maxRetries: 1, // Don't retry session creation failures
      enableLogging: true,
      enableMetrics: true
    });
  }

  /**
   * Get a session by ID
   * @param {string} sessionId - Session ID
   * @returns {StreamSession|null} Session or null if not found
   */
  getSession(sessionId) {
    this._ensureInitialized();

    if (!sessionId || typeof sessionId !== 'string') {
      return null;
    }

    const session = this._activeSessions.get(sessionId);
    return session ? { ...session } : null;
  }

  /**
   * Get all active sessions for a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {StreamSession[]} Array of active sessions
   */
  getSessionsForConversation(conversationId) {
    this._ensureInitialized();

    if (!conversationId || typeof conversationId !== 'string') {
      return [];
    }

    const sessions = [];
    for (const session of this._activeSessions.values()) {
      if (session.conversationId === conversationId && session.status === STREAM_STATUS.ACTIVE) {
        sessions.push({ ...session });
      }
    }

    return sessions;
  }

  /**
   * Update session with new token
   * @param {string} sessionId - Session ID
   * @param {string} token - New token received
   * @returns {StreamSession|null} Updated session or null if not found
   */
  updateSessionWithToken(sessionId, token) {
    this._ensureInitialized();

    if (!sessionId || typeof sessionId !== 'string') {
      return null;
    }

    if (!token || typeof token !== 'string') {
      return null;
    }

    const session = this._activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    const updatedSession = updateSessionWithToken(session, token);
    this._activeSessions.set(sessionId, updatedSession);
    
    return { ...updatedSession };
  }

  /**
   * Terminate a streaming session
   * @param {string} sessionId - Session ID to terminate
   * @param {TERMINATION_REASON} reason - Reason for termination
   * @param {string} errorMessage - Error message (optional)
   * @returns {StreamTerminationResponse} Termination response
   */
  terminateSession(sessionId, reason = TERMINATION_REASON.USER_REQUESTED, errorMessage = null) {
    return streamTerminationErrorHandler.executeWithRetry(async () => {
      this._ensureInitialized();

      if (!sessionId || typeof sessionId !== 'string') {
        const response = createTerminationResponse(
          false,
          sessionId,
          "Invalid session ID provided",
          "",
          0,
          STREAM_STATUS.ERROR,
          null,
          "Invalid session ID"
        );
        
        streamTerminationErrorHandler.logError(`Invalid session ID: ${sessionId}`, { sessionId, reason });
        return response;
      }

      const session = this._activeSessions.get(sessionId);
      if (!session) {
        const response = createTerminationResponse(
          false,
          sessionId,
          "Session not found",
          "",
          0,
          STREAM_STATUS.ERROR,
          null,
          "Session not found"
        );
        
        streamTerminationErrorHandler.logError(`Session not found: ${sessionId}`, { sessionId, reason });
        return response;
      }

      if (!canTerminateSession(session)) {
        const response = createTerminationResponse(
          false,
          sessionId,
          "Session cannot be terminated",
          session.partialResponse,
          session.tokenCount,
          session.status,
          null,
          "Session is not in a terminable state"
        );
        
        streamTerminationErrorHandler.logWarn(`Session not terminable: ${sessionId}`, { 
          sessionId, 
          reason, 
          currentStatus: session.status 
        });
        return response;
      }

      const terminatedSession = terminateSession(session, reason, errorMessage);
      this._activeSessions.set(sessionId, terminatedSession);
      
      // Update statistics
      if (reason === TERMINATION_REASON.ERROR) {
        this._stats.errorSessions++;
      } else {
        this._stats.terminatedSessions++;
      }

      // Track termination metrics
      streamTerminationErrorHandler.trackSessionMetrics(sessionId, {
        status: terminatedSession.status,
        terminationReason: terminatedSession.terminationReason,
        errorMessage: terminatedSession.errorMessage,
        tokenCount: terminatedSession.tokenCount,
        partialResponseLength: terminatedSession.partialResponse.length,
        terminatedAt: terminatedSession.endedAt
      });
      
      // Log termination event
      streamTerminationErrorHandler.logTerminationEvent('session_terminated', {
        sessionId: sessionId,
        conversationId: session.conversationId,
        reason: reason,
        errorMessage: errorMessage,
        tokenCount: terminatedSession.tokenCount,
        partialResponseLength: terminatedSession.partialResponse.length,
        sessionDuration: terminatedSession.endedAt - terminatedSession.startedAt
      });

      console.log(`⏹️  Terminated stream session: ${sessionId} (${reason})`);
      console.log(`📊 Session stats: ${terminatedSession.tokenCount} tokens, ${terminatedSession.partialResponse.length} chars`);

      return createTerminationResponse(
        true,
        sessionId,
        "Stream terminated successfully",
        terminatedSession.partialResponse,
        terminatedSession.tokenCount,
        terminatedSession.status,
        terminatedSession.terminationReason,
        null
      );
    }, {
      operationName: 'terminate_session',
      sessionId,
      conversationId: this._activeSessions.get(sessionId)?.conversationId,
      maxRetries: 2, // Allow retries for termination operations
      enableLogging: true,
      enableMetrics: true
    });
  }

  /**
   * Complete a streaming session (normal completion)
   * @param {string} sessionId - Session ID to complete
   * @returns {StreamSession|null} Completed session or null if not found
   */
  completeSession(sessionId) {
    this._ensureInitialized();

    if (!sessionId || typeof sessionId !== 'string') {
      return null;
    }

    const session = this._activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    const completedSession = completeSession(session);
    this._activeSessions.set(sessionId, completedSession);
    
    this._stats.completedSessions++;
    
    console.log(`✅ Completed stream session: ${sessionId}`);
    console.log(`📊 Final stats: ${completedSession.tokenCount} tokens, ${completedSession.partialResponse.length} chars`);

    return { ...completedSession };
  }

  /**
   * Remove a session from tracking
   * @param {string} sessionId - Session ID to remove
   * @returns {boolean} True if removed, false if not found
   */
  removeSession(sessionId) {
    this._ensureInitialized();

    if (!sessionId || typeof sessionId !== 'string') {
      return false;
    }

    const wasRemoved = this._activeSessions.delete(sessionId);
    
    if (wasRemoved) {
      console.log(`🗑️  Removed session from tracking: ${sessionId}`);
    }

    return wasRemoved;
  }

  /**
   * Get all active sessions
   * @returns {StreamSession[]} Array of all active sessions
   */
  getAllActiveSessions() {
    this._ensureInitialized();

    const sessions = [];
    for (const session of this._activeSessions.values()) {
      if (session.status === STREAM_STATUS.ACTIVE) {
        sessions.push({ ...session });
      }
    }

    return sessions;
  }

  /**
   * Get session statistics
   * @returns {Object} Session statistics
   */
  getSessionStats() {
    this._ensureInitialized();

    const now = new Date();
    const activeSessions = this.getAllActiveSessions();
    
    return {
      activeSessions: activeSessions.length,
      totalSessions: this._stats.totalSessions,
      terminatedSessions: this._stats.terminatedSessions,
      completedSessions: this._stats.completedSessions,
      errorSessions: this._stats.errorSessions,
      lastCleanup: this._stats.lastCleanup,
      maxSessions: this._maxSessions,
      utilization: ((activeSessions.length / this._maxSessions) * 100).toFixed(1) + '%'
    };
  }

  /**
   * Clean up expired sessions
   * @returns {number} Number of sessions cleaned up
   */
  cleanupExpiredSessions() {
    return streamTerminationErrorHandler.executeWithRetry(async () => {
      this._ensureInitialized();

      console.log("🧹 Cleaning up expired sessions...");
      
      let cleanedCount = 0;
      let errorCount = 0;
      const expiredSessions = [];
      const now = new Date();

      // Log cleanup start
      streamTerminationErrorHandler.logTerminationEvent('cleanup_started', {
        totalSessions: this._activeSessions.size,
        timestamp: now.toISOString()
      });

      for (const [sessionId, session] of this._activeSessions.entries()) {
        if (isSessionExpired(session)) {
          expiredSessions.push({ sessionId, session });
        }
      }

      // Log found expired sessions
      streamTerminationErrorHandler.logInfo(`Found ${expiredSessions.length} expired sessions`, {
        expiredCount: expiredSessions.length,
        totalSessions: this._activeSessions.size
      });

      for (const { sessionId, session } of expiredSessions) {
        try {
          const terminatedSession = terminateSession(session, TERMINATION_REASON.TIMEOUT);
          this._activeSessions.set(sessionId, terminatedSession);
          this._stats.terminatedSessions++;
          cleanedCount++;
          
          // Track cleanup metrics
          streamTerminationErrorHandler.trackSessionMetrics(sessionId, {
            status: terminatedSession.status,
            terminationReason: terminatedSession.terminationReason,
            cleanedAt: now,
            tokenCount: terminatedSession.tokenCount
          });
        
        } catch (error) {
          errorCount++;
          streamTerminationErrorHandler.logError(`Failed to clean up expired session: ${sessionId}`, {
            sessionId,
            error: error.message
          });
        }
      }

      this._stats.lastCleanup = now;
      
      // Log cleanup completion
      streamTerminationErrorHandler.logTerminationEvent('cleanup_completed', {
        totalSessions: this._activeSessions.size,
        expiredSessions: expiredSessions.length,
        cleanedCount,
        errorCount,
        timestamp: now.toISOString()
      });
      
      if (cleanedCount > 0) {
        console.log(`✅ Cleaned up ${cleanedCount} expired sessions`);
      } else {
        console.log("✅ No expired sessions to clean up");
      }

      return cleanedCount;
    }, {
      operationName: 'cleanup_expired_sessions',
      maxRetries: 1, // Don't retry cleanup failures
      enableLogging: true,
      enableMetrics: true
    });
  }

  /**
   * Get session status summary
   * @returns {Object} Session status summary
   */
  getStatusSummary() {
    this._ensureInitialized();

    const activeSessions = this.getAllActiveSessions();
    const now = new Date();
    
    return {
      isInitialized: this._isInitialized,
      activeSessionCount: activeSessions.length,
      maxSessions: this._maxSessions,
      utilization: ((activeSessions.length / this._maxSessions) * 100).toFixed(1) + '%',
      cleanupTimerRunning: this._cleanupTimer !== null,
      lastCleanup: this._stats.lastCleanup ? {
        timestamp: this._stats.lastCleanup.toISOString(),
        age: Math.floor((now - this._stats.lastCleanup) / 1000) + 's ago'
      } : null,
      stats: this.getSessionStats()
    };
  }

  /**
   * Stop the session manager and cleanup resources
   */
  async shutdown() {
    return streamTerminationErrorHandler.executeWithRetry(async () => {
      console.log("🔄 Shutting down Stream Session Manager...");

      // Log shutdown start
      streamTerminationErrorHandler.logTerminationEvent('shutdown_started', {
        activeSessions: this._activeSessions.size,
        timestamp: new Date().toISOString()
      });

      // Stop cleanup timer
      if (this._cleanupTimer) {
        clearInterval(this._cleanupTimer);
        this._cleanupTimer = null;
        streamTerminationErrorHandler.logInfo("Stopped cleanup timer");
      }

      // Terminate all active sessions
      const activeSessions = this.getAllActiveSessions();
      let terminatedCount = 0;
      let errorCount = 0;

      for (const session of activeSessions) {
        try {
          this.terminateSession(session.id, TERMINATION_REASON.SERVER_SHUTDOWN);
          terminatedCount++;
        } catch (error) {
          errorCount++;
          streamTerminationErrorHandler.logError(`Failed to terminate session during shutdown: ${session.id}`, {
            sessionId: session.id,
            error: error.message
          });
        }
      }

      // Clear all sessions
      this._activeSessions.clear();
      
      this._isInitialized = false;
      
      // Log shutdown completion
      streamTerminationErrorHandler.logTerminationEvent('shutdown_completed', {
        totalSessions: activeSessions.length,
        terminatedCount,
        errorCount,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ Stream Session Manager shutdown complete. Terminated ${terminatedCount} active sessions`);
    }, {
      operationName: 'shutdown',
      maxRetries: 1, // Don't retry shutdown
      enableLogging: true,
      enableMetrics: true
    });
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
      throw new Error("StreamSessionManager not initialized. Call initialize() first.");
    }
  }

  /**
   * Load configuration from environment variables
   * @private
   */
  _loadConfiguration() {
    // Load from environment variables with defaults
    this._maxSessions = parseInt(process.env.MAX_STREAM_SESSIONS) || 100;
    this._defaultTimeout = parseInt(process.env.STREAM_SESSION_TIMEOUT_MS) || 300000; // 5 minutes
    this._cleanupInterval = parseInt(process.env.STREAM_CLEANUP_INTERVAL_MS) || 30000; // 30 seconds
    
    // Use longer interval during tests to prevent interference
    if (process.env.NODE_ENV === 'test' || process.argv.includes('--test')) {
      this._cleanupInterval = 300000; // 5 minutes during tests
    }

    // Validate configuration
    if (this._maxSessions <= 0) {
      throw new Error("MAX_STREAM_SESSIONS must be greater than 0");
    }

    if (this._defaultTimeout <= 0) {
      throw new Error("STREAM_SESSION_TIMEOUT_MS must be greater than 0");
    }

    if (this._cleanupInterval <= 0) {
      throw new Error("STREAM_CLEANUP_INTERVAL_MS must be greater than 0");
    }

    console.log(`⚙️  Loaded configuration: maxSessions=${this._maxSessions}, defaultTimeout=${this._defaultTimeout}ms, cleanupInterval=${this._cleanupInterval}ms`);
  }

  /**
   * Start the automatic cleanup timer
   * @private
   */
  _startCleanupTimer() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
    }

    this._cleanupTimer = setInterval(() => {
      try {
        this.cleanupExpiredSessions();
      } catch (error) {
        console.error("❌ Error during automatic cleanup:", error.message);
      }
    }, this._cleanupInterval);

    console.log(`🔄 Started automatic cleanup timer (${this._cleanupInterval}ms interval)`);
  }

  /**
   * Stop the automatic cleanup timer
   * @private
   */
  _stopCleanupTimer() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
      console.log("⏹️  Stopped automatic cleanup timer");
    }
  }
}

// Export singleton instance
export default new StreamSessionManager(); 