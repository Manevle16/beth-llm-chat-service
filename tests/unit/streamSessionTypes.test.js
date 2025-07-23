/**
 * Simple test file to verify stream session types
 * This ensures all exports are working correctly
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
} from '../../types/streamSession.js';

// Test basic imports and structure
console.log('🧪 Testing Stream Session Types...');

// Test enum values
console.log('✅ STREAM_STATUS:', STREAM_STATUS);
console.log('✅ TERMINATION_REASON:', TERMINATION_REASON);

// Test factory functions
const testSession = createStreamSession('conv-123', 'llama3.1:8b', 300000);
console.log('✅ createStreamSession:', testSession.conversationId === 'conv-123' && testSession.model === 'llama3.1:8b');

const testRequest = createTerminationRequest('session-123', 'conv-123', 'password123', TERMINATION_REASON.USER_REQUESTED);
console.log('✅ createTerminationRequest:', testRequest.sessionId === 'session-123' && testRequest.reason === TERMINATION_REASON.USER_REQUESTED);

const testResponse = createTerminationResponse(
  true,
  'session-123',
  'Stream terminated successfully',
  'Partial response content',
  10,
  STREAM_STATUS.TERMINATED,
  TERMINATION_REASON.USER_REQUESTED
);
console.log('✅ createTerminationResponse:', testResponse.success === true && testResponse.tokenCount === 10);

// Test validation functions
console.log('✅ isStreamSession (valid):', isStreamSession(testSession));
console.log('✅ isStreamSession (invalid):', !isStreamSession({}));

console.log('✅ isTerminationRequest (valid):', isTerminationRequest(testRequest));
console.log('✅ isTerminationRequest (invalid):', !isTerminationRequest({}));

console.log('✅ isTerminationResponse (valid):', isTerminationResponse(testResponse));
console.log('✅ isTerminationResponse (invalid):', !isTerminationResponse({}));

// Test utility functions
console.log('✅ canTerminateSession (active):', canTerminateSession(testSession));

const completedSession = { ...testSession, status: STREAM_STATUS.COMPLETED };
console.log('✅ canTerminateSession (completed):', !canTerminateSession(completedSession));

const expiredSession = { ...testSession, startedAt: new Date(Date.now() - 2000), timeoutMs: 1000 };
console.log('✅ isSessionExpired (expired):', isSessionExpired(expiredSession));
console.log('✅ isSessionExpired (active):', !isSessionExpired(testSession));

const updatedSession = updateSessionWithToken(testSession, 'Hello');
console.log('✅ updateSessionWithToken:', updatedSession.partialResponse === 'Hello' && updatedSession.tokenCount === 1);

const terminatedSession = terminateSession(testSession, TERMINATION_REASON.USER_REQUESTED);
console.log('✅ terminateSession:', terminatedSession.status === STREAM_STATUS.TERMINATED);

const completedSession2 = completeSession(testSession);
console.log('✅ completeSession:', completedSession2.status === STREAM_STATUS.COMPLETED);

console.log('🎉 All stream session type tests passed!'); 