/**
 * Stream Session Database Service
 * 
 * This service handles all database operations for stream sessions,
 * including CRUD operations, cleanup, and atomic state updates.
 */

import pool from "../config/database.js";
import {
  STREAM_STATUS,
  TERMINATION_REASON,
  isStreamSession,
  isSessionExpired
} from "../types/streamSession.js";
import streamTerminationErrorHandler from "./streamTerminationErrorHandler.js";

class StreamSessionDatabase {
  constructor() {
    this._isInitialized = false;
  }

  /**
   * Initialize the database service
   * Creates the stream_sessions table if it doesn't exist
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    console.log("🔄 Initializing Stream Session Database...");

    try {
      // Initialize error handler
      await streamTerminationErrorHandler.initialize();
      
      await this._createTableIfNotExists();
      this._isInitialized = true;
      console.log("✅ Stream Session Database initialized successfully");
      
      // Log initialization event
      streamTerminationErrorHandler.logTerminationEvent('database_initialized', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("❌ Failed to initialize Stream Session Database:", error.message);
      throw error;
    }
  }

  /**
   * Create a new stream session in the database
   * @param {Object} session - Stream session object
   * @returns {Promise<Object>} Created session
   */
  async createSession(session) {
    return streamTerminationErrorHandler.executeWithRetry(async () => {
      this._ensureInitialized();

      if (!isStreamSession(session)) {
        throw new Error("Invalid stream session object");
      }

      const query = `
        INSERT INTO stream_sessions (
          id, conversation_id, model, status, started_at, updated_at,
          partial_response, token_count, timeout_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const values = [
        session.id,
        session.conversationId,
        session.model,
        session.status,
        session.startedAt,
        session.updatedAt,
        session.partialResponse,
        session.tokenCount,
        session.timeoutMs
      ];

      const result = await pool.query(query, values);
      
      // Log session creation
      streamTerminationErrorHandler.logTerminationEvent('database_session_created', {
        sessionId: session.id,
        conversationId: session.conversationId,
        model: session.model,
        timestamp: new Date().toISOString()
      });
      
      console.log(`📝 Created stream session in database: ${session.id}`);
      return this._mapRowToSession(result.rows[0]);
    }, {
      operationName: 'create_session_db',
      sessionId: session?.id,
      conversationId: session?.conversationId,
      maxRetries: 3, // Allow retries for database operations
      enableLogging: true,
      enableMetrics: true
    });
  }

  /**
   * Get a stream session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session or null if not found
   */
  async getSession(sessionId) {
    this._ensureInitialized();

    if (!sessionId || typeof sessionId !== 'string') {
      return null;
    }

    const query = `
      SELECT * FROM stream_sessions 
      WHERE id = $1
    `;

    try {
      const result = await pool.query(query, [sessionId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this._mapRowToSession(result.rows[0]);
    } catch (error) {
      console.error("❌ Error getting stream session:", error.message);
      throw new Error(`Failed to get stream session: ${error.message}`);
    }
  }

  /**
   * Get all active sessions for a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Array>} Array of active sessions
   */
  async getActiveSessionsForConversation(conversationId) {
    this._ensureInitialized();

    if (!conversationId || typeof conversationId !== 'string') {
      return [];
    }

    const query = `
      SELECT * FROM stream_sessions 
      WHERE conversation_id = $1 AND status = $2
      ORDER BY started_at DESC
    `;

    try {
      const result = await pool.query(query, [conversationId, STREAM_STATUS.ACTIVE]);
      return result.rows.map(row => this._mapRowToSession(row));
    } catch (error) {
      console.error("❌ Error getting active sessions for conversation:", error.message);
      throw new Error(`Failed to get active sessions: ${error.message}`);
    }
  }

  /**
   * Update session with new token
   * @param {string} sessionId - Session ID
   * @param {string} token - New token
   * @returns {Promise<Object|null>} Updated session or null if not found
   */
  async updateSessionWithToken(sessionId, token) {
    this._ensureInitialized();

    if (!sessionId || typeof sessionId !== 'string') {
      return null;
    }

    if (!token || typeof token !== 'string') {
      return null;
    }

    const query = `
      UPDATE stream_sessions 
      SET partial_response = partial_response || $2,
          token_count = token_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = $3
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [sessionId, token, STREAM_STATUS.ACTIVE]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this._mapRowToSession(result.rows[0]);
    } catch (error) {
      console.error("❌ Error updating session with token:", error.message);
      throw new Error(`Failed to update session: ${error.message}`);
    }
  }

  /**
   * Terminate a stream session
   * @param {string} sessionId - Session ID
   * @param {string} reason - Termination reason
   * @param {string} errorMessage - Error message (optional)
   * @returns {Promise<Object|null>} Terminated session or null if not found
   */
  async terminateSession(sessionId, reason, errorMessage = null) {
    return streamTerminationErrorHandler.executeWithRetry(async () => {
      this._ensureInitialized();

      if (!sessionId || typeof sessionId !== 'string') {
        return null;
      }

      const query = `
        UPDATE stream_sessions 
        SET status = $2,
            ended_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP,
            termination_reason = $3,
            error_message = $4
        WHERE id = $1 AND status = 'ACTIVE'
        RETURNING *
      `;

      const newStatus = errorMessage ? STREAM_STATUS.ERROR : STREAM_STATUS.TERMINATED;

      const result = await pool.query(query, [sessionId, newStatus, reason, errorMessage]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const terminatedSession = this._mapRowToSession(result.rows[0]);
      
      // Log termination event
      streamTerminationErrorHandler.logTerminationEvent('database_session_terminated', {
        sessionId: sessionId,
        reason: reason,
        errorMessage: errorMessage,
        tokenCount: terminatedSession.tokenCount,
        partialResponseLength: terminatedSession.partialResponse.length,
        timestamp: new Date().toISOString()
      });
      
      console.log(`⏹️  Terminated stream session in database: ${sessionId} (${reason})`);
      return terminatedSession;
    }, {
      operationName: 'terminate_session_db',
      sessionId,
      maxRetries: 3, // Allow retries for database operations
      enableLogging: true,
      enableMetrics: true
    });
  }

  /**
   * Complete a stream session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Completed session or null if not found
   */
  async completeSession(sessionId) {
    this._ensureInitialized();

    if (!sessionId || typeof sessionId !== 'string') {
      return null;
    }

    const query = `
      UPDATE stream_sessions 
      SET status = $2,
          ended_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'ACTIVE'
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [sessionId, STREAM_STATUS.COMPLETED]);
      
      if (result.rows.length === 0) {
        return null;
      }

      console.log(`✅ Completed stream session in database: ${sessionId}`);
      return this._mapRowToSession(result.rows[0]);
    } catch (error) {
      console.error("❌ Error completing session:", error.message);
      throw new Error(`Failed to complete session: ${error.message}`);
    }
  }

  /**
   * Delete a stream session
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteSession(sessionId) {
    this._ensureInitialized();

    if (!sessionId || typeof sessionId !== 'string') {
      return false;
    }

    const query = `
      DELETE FROM stream_sessions 
      WHERE id = $1
    `;

    try {
      const result = await pool.query(query, [sessionId]);
      
      if (result.rowCount > 0) {
        console.log(`🗑️  Deleted stream session from database: ${sessionId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error("❌ Error deleting session:", error.message);
      throw new Error(`Failed to delete session: ${error.message}`);
    }
  }

  /**
   * Get all expired sessions
   * @returns {Promise<Array>} Array of expired sessions
   */
  async getExpiredSessions() {
    this._ensureInitialized();

    const query = `
      SELECT * FROM stream_sessions 
      WHERE status = $1 
      AND started_at < (CURRENT_TIMESTAMP - INTERVAL '1 millisecond' * timeout_ms)
      ORDER BY started_at ASC
    `;

    try {
      const result = await pool.query(query, [STREAM_STATUS.ACTIVE]);
      return result.rows.map(row => this._mapRowToSession(row));
    } catch (error) {
      console.error("❌ Error getting expired sessions:", error.message);
      throw new Error(`Failed to get expired sessions: ${error.message}`);
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} Number of sessions cleaned up
   */
  async cleanupExpiredSessions() {
    this._ensureInitialized();

    console.log("🧹 Cleaning up expired sessions in database...");

    try {
      // First, get expired sessions
      const expiredSessions = await this.getExpiredSessions();
      
      if (expiredSessions.length === 0) {
        console.log("✅ No expired sessions to clean up in database");
        return 0;
      }

      // Terminate all expired sessions
      let cleanedCount = 0;
      for (const session of expiredSessions) {
        try {
          await this.terminateSession(session.id, TERMINATION_REASON.TIMEOUT);
          cleanedCount++;
        } catch (error) {
          console.error(`⚠️  Failed to terminate expired session ${session.id}:`, error.message);
        }
      }

      console.log(`✅ Cleaned up ${cleanedCount} expired sessions in database`);
      return cleanedCount;
    } catch (error) {
      console.error("❌ Error during database cleanup:", error.message);
      throw new Error(`Failed to cleanup expired sessions: ${error.message}`);
    }
  }

  /**
   * Get session statistics
   * @returns {Promise<Object>} Session statistics
   */
  async getSessionStats() {
    this._ensureInitialized();

    const query = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_sessions,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_sessions,
        COUNT(CASE WHEN status = 'TERMINATED' THEN 1 END) as terminated_sessions,
        COUNT(CASE WHEN status = 'ERROR' THEN 1 END) as error_sessions,
        AVG(CASE WHEN ended_at IS NOT NULL THEN EXTRACT(EPOCH FROM (ended_at - started_at)) END) as avg_duration_seconds,
        MAX(updated_at) as last_activity
      FROM stream_sessions
    `;

    try {
      const result = await pool.query(query);
      const stats = result.rows[0];
      
      return {
        totalSessions: parseInt(stats.total_sessions) || 0,
        activeSessions: parseInt(stats.active_sessions) || 0,
        completedSessions: parseInt(stats.completed_sessions) || 0,
        terminatedSessions: parseInt(stats.terminated_sessions) || 0,
        errorSessions: parseInt(stats.error_sessions) || 0,
        avgDurationSeconds: parseFloat(stats.avg_duration_seconds) || 0,
        lastActivity: stats.last_activity
      };
    } catch (error) {
      console.error("❌ Error getting session statistics:", error.message);
      throw new Error(`Failed to get session statistics: ${error.message}`);
    }
  }

  /**
   * Get sessions by status
   * @param {string} status - Session status
   * @param {number} limit - Maximum number of sessions to return
   * @returns {Promise<Array>} Array of sessions
   */
  async getSessionsByStatus(status, limit = 100) {
    this._ensureInitialized();

    if (!Object.values(STREAM_STATUS).includes(status)) {
      throw new Error("Invalid session status");
    }

    const query = `
      SELECT * FROM stream_sessions 
      WHERE status = $1
      ORDER BY updated_at DESC
      LIMIT $2
    `;

    try {
      const result = await pool.query(query, [status, limit]);
      return result.rows.map(row => this._mapRowToSession(row));
    } catch (error) {
      console.error("❌ Error getting sessions by status:", error.message);
      throw new Error(`Failed to get sessions by status: ${error.message}`);
    }
  }

  /**
   * Save partial response to database and create message
   * @param {string} sessionId - Session ID
   * @param {string} conversationId - Conversation ID
   * @param {string} partialResponse - Partial response content
   * @returns {Promise<Object>} Created message
   */
  async savePartialResponseAsMessage(sessionId, conversationId, partialResponse) {
    this._ensureInitialized();

    if (!sessionId || !conversationId || !partialResponse) {
      throw new Error("Missing required parameters for saving partial response");
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update the session with final partial response
      const updateSessionQuery = `
        UPDATE stream_sessions 
        SET partial_response = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      await client.query(updateSessionQuery, [sessionId, partialResponse]);

      // Create a message with the partial response
      const insertMessageQuery = `
        INSERT INTO messages (conversation_id, text, sender)
        VALUES ($1, $2, 'llm')
        RETURNING *
      `;
      const messageResult = await client.query(insertMessageQuery, [conversationId, partialResponse]);

      await client.query('COMMIT');

      console.log(`💾 Saved partial response as message for session: ${sessionId}`);
      return messageResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("❌ Error saving partial response:", error.message);
      throw new Error(`Failed to save partial response: ${error.message}`);
    } finally {
      client.release();
    }
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
      throw new Error("StreamSessionDatabase not initialized. Call initialize() first.");
    }
  }

  /**
   * Create the stream_sessions table if it doesn't exist
   * @private
   */
  async _createTableIfNotExists() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS stream_sessions (
        id VARCHAR(255) PRIMARY KEY,
        conversation_id VARCHAR(255) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        model VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED', 'TERMINATED', 'ERROR')),
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP WITH TIME ZONE,
        partial_response TEXT DEFAULT '',
        token_count INTEGER DEFAULT 0,
        termination_reason VARCHAR(30) CHECK (termination_reason IN ('USER_REQUESTED', 'TIMEOUT', 'ERROR', 'SERVER_SHUTDOWN')),
        error_message TEXT,
        timeout_ms INTEGER DEFAULT 300000,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_stream_sessions_conversation_id ON stream_sessions(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_stream_sessions_status ON stream_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_stream_sessions_started_at ON stream_sessions(started_at);
      CREATE INDEX IF NOT EXISTS idx_stream_sessions_updated_at ON stream_sessions(updated_at);
      CREATE INDEX IF NOT EXISTS idx_stream_sessions_ended_at ON stream_sessions(ended_at);
      CREATE INDEX IF NOT EXISTS idx_stream_sessions_expired ON stream_sessions(started_at) WHERE status = 'ACTIVE';
    `;

    try {
      await pool.query(createTableQuery);
      await pool.query(createIndexesQuery);
      console.log("✅ Stream sessions table and indexes created/verified");
    } catch (error) {
      console.error("❌ Error creating stream sessions table:", error.message);
      throw error;
    }
  }

  /**
   * Map database row to session object
   * @param {Object} row - Database row
   * @returns {Object} Session object
   * @private
   */
  _mapRowToSession(row) {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      model: row.model,
      status: row.status,
      startedAt: row.started_at,
      updatedAt: row.updated_at,
      endedAt: row.ended_at,
      partialResponse: row.partial_response || '',
      tokenCount: row.token_count || 0,
      terminationReason: row.termination_reason,
      errorMessage: row.error_message,
      timeoutMs: row.timeout_ms || 300000
    };
  }
}

// Export singleton instance
export default new StreamSessionDatabase(); 