/**
 * Stream Session Types and Interfaces
 * 
 * This module defines all data models, interfaces, and constants
 * for the stream termination feature.
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Stream status enumeration
 * @readonly
 * @enum {string}
 */
export const STREAM_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  TERMINATED: 'TERMINATED',
  ERROR: 'ERROR'
};

/**
 * Stream termination reason enumeration
 * @readonly
 * @enum {string}
 */
export const TERMINATION_REASON = {
  USER_REQUESTED: 'USER_REQUESTED',
  TIMEOUT: 'TIMEOUT',
  ERROR: 'ERROR',
  SERVER_SHUTDOWN: 'SERVER_SHUTDOWN'
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * @typedef {Object} StreamSession
 * @property {string} id - Unique session identifier
 * @property {string} conversationId - Associated conversation ID
 * @property {string} model - LLM model being used
 * @property {STREAM_STATUS} status - Current stream status
 * @property {Date} startedAt - When the stream started
 * @property {Date} updatedAt - When the session was last updated
 * @property {Date} endedAt - When the stream ended (if completed/terminated)
 * @property {string} partialResponse - Partial response content (if terminated)
 * @property {number} tokenCount - Number of tokens received
 * @property {TERMINATION_REASON} terminationReason - Reason for termination (if applicable)
 * @property {string} errorMessage - Error message (if status is ERROR)
 * @property {number} timeoutMs - Session timeout in milliseconds
 */
export const StreamSession = {
  id: '',
  conversationId: '',
  model: '',
  status: STREAM_STATUS.ACTIVE,
  startedAt: new Date(),
  updatedAt: new Date(),
  endedAt: null,
  partialResponse: '',
  tokenCount: 0,
  terminationReason: null,
  errorMessage: null,
  timeoutMs: 300000 // 5 minutes default
};

/**
 * @typedef {Object} StreamTerminationRequest
 * @property {string} sessionId - Session ID to terminate
 * @property {string} conversationId - Conversation ID for validation
 * @property {string} password - Password for private conversations
 * @property {TERMINATION_REASON} reason - Reason for termination
 */
export const StreamTerminationRequest = {
  sessionId: '',
  conversationId: '',
  password: null,
  reason: TERMINATION_REASON.USER_REQUESTED
};

/**
 * @typedef {Object} StreamTerminationResponse
 * @property {boolean} success - Whether termination was successful
 * @property {string} sessionId - Session ID that was terminated
 * @property {string} message - Response message
 * @property {string} partialResponse - Partial response content
 * @property {number} tokenCount - Number of tokens received
 * @property {STREAM_STATUS} finalStatus - Final status of the stream
 * @property {TERMINATION_REASON} terminationReason - Reason for termination
 * @property {string} error - Error message if termination failed
 */
export const StreamTerminationResponse = {
  success: false,
  sessionId: '',
  message: '',
  partialResponse: '',
  tokenCount: 0,
  finalStatus: STREAM_STATUS.ACTIVE,
  terminationReason: null,
  error: null
};

/**
 * @typedef {Object} StreamSessionStats
 * @property {number} activeSessions - Number of currently active sessions
 * @property {number} totalSessions - Total sessions created
 * @property {number} terminatedSessions - Number of terminated sessions
 * @property {number} completedSessions - Number of completed sessions
 * @property {number} errorSessions - Number of sessions that ended in error
 * @property {Date} lastCleanup - When the last cleanup was performed
 */
export const StreamSessionStats = {
  activeSessions: 0,
  totalSessions: 0,
  terminatedSessions: 0,
  completedSessions: 0,
  errorSessions: 0,
  lastCleanup: new Date()
};

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new stream session
 * @param {string} conversationId - Conversation ID
 * @param {string} model - LLM model name
 * @param {number} timeoutMs - Session timeout in milliseconds
 * @returns {StreamSession} New stream session
 */
export function createStreamSession(conversationId, model, timeoutMs = 300000) {
  return {
    id: generateSessionId(),
    conversationId,
    model,
    status: STREAM_STATUS.ACTIVE,
    startedAt: new Date(),
    updatedAt: new Date(),
    endedAt: null,
    partialResponse: '',
    tokenCount: 0,
    terminationReason: null,
    errorMessage: null,
    timeoutMs
  };
}

/**
 * Create a stream termination request
 * @param {string} sessionId - Session ID to terminate
 * @param {string} conversationId - Conversation ID
 * @param {string} password - Password for private conversations
 * @param {TERMINATION_REASON} reason - Termination reason
 * @returns {StreamTerminationRequest} Termination request
 */
export function createTerminationRequest(sessionId, conversationId, password = null, reason = TERMINATION_REASON.USER_REQUESTED) {
  return {
    sessionId,
    conversationId,
    password,
    reason
  };
}

/**
 * Create a stream termination response
 * @param {boolean} success - Whether termination was successful
 * @param {string} sessionId - Session ID
 * @param {string} message - Response message
 * @param {string} partialResponse - Partial response content
 * @param {number} tokenCount - Token count
 * @param {STREAM_STATUS} finalStatus - Final status
 * @param {TERMINATION_REASON} terminationReason - Termination reason
 * @param {string} error - Error message
 * @returns {StreamTerminationResponse} Termination response
 */
export function createTerminationResponse(success, sessionId, message, partialResponse = '', tokenCount = 0, finalStatus = STREAM_STATUS.ACTIVE, terminationReason = null, error = null) {
  return {
    success,
    sessionId,
    message,
    partialResponse,
    tokenCount,
    finalStatus,
    terminationReason,
    error
  };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate stream session object
 * @param {Object} obj - Object to validate
 * @returns {boolean} True if valid stream session
 */
export function isStreamSession(obj) {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.conversationId === 'string' &&
    typeof obj.model === 'string' &&
    Object.values(STREAM_STATUS).includes(obj.status) &&
    obj.startedAt instanceof Date &&
    obj.updatedAt instanceof Date &&
    typeof obj.tokenCount === 'number' &&
    typeof obj.timeoutMs === 'number';
}

/**
 * Validate termination request object
 * @param {Object} obj - Object to validate
 * @returns {boolean} True if valid termination request
 */
export function isTerminationRequest(obj) {
  return obj &&
    typeof obj.sessionId === 'string' &&
    typeof obj.conversationId === 'string' &&
    (obj.password === null || typeof obj.password === 'string') &&
    Object.values(TERMINATION_REASON).includes(obj.reason);
}

/**
 * Validate termination response object
 * @param {Object} obj - Object to validate
 * @returns {boolean} True if valid termination response
 */
export function isTerminationResponse(obj) {
  return obj &&
    typeof obj.success === 'boolean' &&
    typeof obj.sessionId === 'string' &&
    typeof obj.message === 'string' &&
    typeof obj.partialResponse === 'string' &&
    typeof obj.tokenCount === 'number' &&
    Object.values(STREAM_STATUS).includes(obj.finalStatus) &&
    (obj.terminationReason === null || Object.values(TERMINATION_REASON).includes(obj.terminationReason)) &&
    (obj.error === null || typeof obj.error === 'string');
}

/**
 * Check if a stream session has expired
 * @param {StreamSession} session - Stream session to check
 * @returns {boolean} True if session has expired
 */
export function isSessionExpired(session) {
  if (!session || !session.startedAt || !session.timeoutMs) {
    return false;
  }
  
  const now = new Date();
  const elapsed = now.getTime() - session.startedAt.getTime();
  return elapsed > session.timeoutMs;
}

/**
 * Check if a stream session can be terminated
 * @param {StreamSession} session - Stream session to check
 * @returns {boolean} True if session can be terminated
 */
export function canTerminateSession(session) {
  return session && 
         session.status === STREAM_STATUS.ACTIVE && 
         !isSessionExpired(session);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique session ID
 * @returns {string} Unique session ID
 */
function generateSessionId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `stream_${timestamp}_${random}`;
}

/**
 * Update session with new token
 * @param {StreamSession} session - Session to update
 * @param {string} token - New token received
 * @returns {StreamSession} Updated session
 */
export function updateSessionWithToken(session, token) {
  if (!session || session.status !== STREAM_STATUS.ACTIVE) {
    return session;
  }

  return {
    ...session,
    partialResponse: session.partialResponse + token,
    tokenCount: session.tokenCount + 1,
    updatedAt: new Date()
  };
}

/**
 * Mark session as terminated
 * @param {StreamSession} session - Session to terminate
 * @param {TERMINATION_REASON} reason - Termination reason
 * @param {string} errorMessage - Error message (optional)
 * @returns {StreamSession} Terminated session
 */
export function terminateSession(session, reason, errorMessage = null) {
  if (!session) {
    return session;
  }

  return {
    ...session,
    status: errorMessage ? STREAM_STATUS.ERROR : STREAM_STATUS.TERMINATED,
    endedAt: new Date(),
    updatedAt: new Date(),
    terminationReason: reason,
    errorMessage
  };
}

/**
 * Mark session as completed
 * @param {StreamSession} session - Session to complete
 * @returns {StreamSession} Completed session
 */
export function completeSession(session) {
  if (!session) {
    return session;
  }

  return {
    ...session,
    status: STREAM_STATUS.COMPLETED,
    endedAt: new Date(),
    updatedAt: new Date()
  };
} 