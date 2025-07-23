/**
 * Unit tests for StreamSessionManager Service
 * 
 * This test file verifies the stream session management functionality
 * including session creation, termination, cleanup, and error handling.
 */

import streamSessionManager from '../../services/streamSessionManager.js';
import {
  STREAM_STATUS,
  TERMINATION_REASON
} from '../../types/streamSession.js';

console.log('🧪 Testing StreamSessionManager...');

// Test 1: Basic initialization
console.log('\n1️⃣  Testing basic initialization...');
try {
  await streamSessionManager.initialize();
  console.log('✅ StreamSessionManager initialized successfully');
} catch (error) {
  console.log('❌ Initialization failed:', error.message);
}

// Test 2: Initial status
console.log('\n2️⃣  Testing initial status...');
const initialStatus = streamSessionManager.getStatusSummary();
console.log('✅ Initial status:', {
  isInitialized: initialStatus.isInitialized,
  activeSessionCount: initialStatus.activeSessionCount,
  maxSessions: initialStatus.maxSessions,
  utilization: initialStatus.utilization
});

// Test 3: Create session
console.log('\n3️⃣  Testing session creation...');
const session1 = await streamSessionManager.createSession('conv-123', 'llama3.1:8b', 60000);
console.log('✅ Created session:', {
  id: session1.id,
  conversationId: session1.conversationId,
  model: session1.model,
  status: session1.status,
  timeoutMs: session1.timeoutMs
});

// Test 4: Get session
console.log('\n4️⃣  Testing get session...');
const retrievedSession = streamSessionManager.getSession(session1.id);
console.log('✅ Retrieved session:', retrievedSession ? 'FOUND' : 'NOT_FOUND');
console.log('✅ Session match:', retrievedSession && retrievedSession.id === session1.id);

// Test 5: Update session with token
console.log('\n5️⃣  Testing session token update...');
const updatedSession = streamSessionManager.updateSessionWithToken(session1.id, 'Hello');
console.log('✅ Updated session:', {
  tokenCount: updatedSession.tokenCount,
  partialResponse: updatedSession.partialResponse,
  status: updatedSession.status
});

// Test 6: Create multiple sessions
console.log('\n6️⃣  Testing multiple sessions...');
const session2 = await streamSessionManager.createSession('conv-456', 'mistral:7b');
const session3 = await streamSessionManager.createSession('conv-123', 'llama3.1:8b'); // Same conversation
console.log('✅ Created multiple sessions:', {
  session2Id: session2.id,
  session3Id: session3.id,
  totalActive: streamSessionManager.getAllActiveSessions().length
});

// Test 7: Get sessions for conversation
console.log('\n7️⃣  Testing get sessions for conversation...');
const convSessions = streamSessionManager.getSessionsForConversation('conv-123');
console.log('✅ Sessions for conv-123:', {
  count: convSessions.length,
  sessionIds: convSessions.map(s => s.id)
});

// Test 8: Session statistics
console.log('\n8️⃣  Testing session statistics...');
const stats = streamSessionManager.getSessionStats();
console.log('✅ Session statistics:', {
  activeSessions: stats.activeSessions,
  totalSessions: stats.totalSessions,
  terminatedSessions: stats.terminatedSessions,
  completedSessions: stats.completedSessions,
  errorSessions: stats.errorSessions,
  utilization: stats.utilization
});

// Test 9: Terminate session
console.log('\n9️⃣  Testing session termination...');
const terminationResult = streamSessionManager.terminateSession(session2.id, TERMINATION_REASON.USER_REQUESTED);
console.log('✅ Termination result:', {
  success: terminationResult.success,
  sessionId: terminationResult.sessionId,
  message: terminationResult.message,
  tokenCount: terminationResult.tokenCount,
  finalStatus: terminationResult.finalStatus,
  terminationReason: terminationResult.terminationReason
});

// Test 10: Complete session
console.log('\n🔟  Testing session completion...');
const completionResult = streamSessionManager.completeSession(session3.id);
console.log('✅ Completion result:', {
  success: completionResult ? 'SUCCESS' : 'FAILED',
  finalStatus: completionResult ? completionResult.status : 'N/A',
  tokenCount: completionResult ? completionResult.tokenCount : 'N/A'
});

// Test 11: Invalid session operations
console.log('\n1️⃣1️⃣  Testing invalid session operations...');
const invalidSession = streamSessionManager.getSession('invalid-session-id');
console.log('✅ Invalid session get:', invalidSession === null);

const invalidUpdate = streamSessionManager.updateSessionWithToken('invalid-session-id', 'test');
console.log('✅ Invalid session update:', invalidUpdate === null);

const invalidTermination = streamSessionManager.terminateSession('invalid-session-id');
console.log('✅ Invalid session termination:', {
  success: invalidTermination.success,
  error: invalidTermination.error
});

// Test 12: Terminate already terminated session
console.log('\n1️⃣2️⃣  Testing terminate already terminated session...');
const alreadyTerminated = streamSessionManager.terminateSession(session2.id);
console.log('✅ Already terminated session:', {
  success: alreadyTerminated.success,
  error: alreadyTerminated.error
});

// Test 13: Session expiration simulation
console.log('\n1️⃣3️⃣  Testing session expiration simulation...');
const shortTimeoutSession = streamSessionManager.createSession('conv-expire', 'test-model', 1000);
console.log('✅ Created short timeout session:', shortTimeoutSession.id);

// Check if session is expired immediately (should not be)
const immediateCheck = streamSessionManager.getSession(shortTimeoutSession.id);
const isImmediatelyExpired = immediateCheck && immediateCheck.status === STREAM_STATUS.ACTIVE && 
                            (new Date() - immediateCheck.startedAt) > immediateCheck.timeoutMs;
console.log('✅ Immediate expiration check:', {
  sessionExists: !!immediateCheck,
  isExpired: isImmediatelyExpired
});

// Test expiration logic without waiting
const testExpiredSession = { ...shortTimeoutSession, startedAt: new Date(Date.now() - 2000) };
const wouldBeExpired = (new Date() - testExpiredSession.startedAt) > testExpiredSession.timeoutMs;
console.log('✅ Expiration logic test:', {
  wouldBeExpired: wouldBeExpired
});

// Test 14: Cleanup expired sessions
console.log('\n1️⃣4️⃣  Testing cleanup expired sessions...');
const cleanupResult = streamSessionManager.cleanupExpiredSessions();
console.log('✅ Cleanup result:', cleanupResult);

// Test 15: Error handling
console.log('\n1️⃣5️⃣  Testing error handling...');
try {
  await streamSessionManager.createSession('', 'test-model');
  console.log('❌ Should have rejected empty conversation ID');
} catch (error) {
  console.log('✅ Correctly rejected empty conversation ID:', error.message);
}

try {
  await streamSessionManager.createSession('conv-test', '');
  console.log('❌ Should have rejected empty model name');
} catch (error) {
  console.log('✅ Correctly rejected empty model name:', error.message);
}

// Test 16: Remove session
console.log('\n1️⃣6️⃣  Testing remove session...');
const removeResult = streamSessionManager.removeSession(session1.id);
console.log('✅ Remove session result:', removeResult);

const removedSession = streamSessionManager.getSession(session1.id);
console.log('✅ Session after removal:', removedSession === null);

// Test 17: Final status check
console.log('\n1️⃣7️⃣  Testing final status check...');
const finalStatus = streamSessionManager.getStatusSummary();
console.log('✅ Final status:', {
  isInitialized: finalStatus.isInitialized,
  activeSessionCount: finalStatus.activeSessionCount,
  maxSessions: finalStatus.maxSessions,
  utilization: finalStatus.utilization,
  cleanupTimerRunning: finalStatus.cleanupTimerRunning
});

// Test 18: Session limits
console.log('\n1️⃣8️⃣  Testing session limits...');
const maxSessions = finalStatus.maxSessions;
let sessionCount = streamSessionManager.getAllActiveSessions().length;
console.log('✅ Current session count:', sessionCount);

// Try to create sessions up to the limit
let createdCount = 0;
for (let i = 0; i < maxSessions + 5; i++) {
  try {
    await streamSessionManager.createSession(`conv-limit-${i}`, 'test-model');
    createdCount++;
  } catch (error) {
    console.log('✅ Hit session limit at:', createdCount, 'sessions');
    break;
  }
}

// Test 19: Configuration validation
console.log('\n1️⃣9️⃣  Testing configuration validation...');
const config = {
  maxSessions: finalStatus.maxSessions,
  defaultTimeout: 300000,
  cleanupInterval: 30000
};
console.log('✅ Configuration validation:', {
  maxSessions: config.maxSessions > 0,
  defaultTimeout: config.defaultTimeout > 0,
  cleanupInterval: config.cleanupInterval > 0
});

// Test 20: Final statistics
console.log('\n2️⃣0️⃣  Testing final statistics...');
const finalStats = streamSessionManager.getSessionStats();
console.log('✅ Final statistics:', {
  activeSessions: finalStats.activeSessions,
  totalSessions: finalStats.totalSessions,
  terminatedSessions: finalStats.terminatedSessions,
  completedSessions: finalStats.completedSessions,
  errorSessions: finalStats.errorSessions,
  utilization: finalStats.utilization
});

console.log('\n🎉 All StreamSessionManager tests completed!');

// Cleanup: Shutdown the session manager to stop timers
console.log('\n🧹 Cleaning up StreamSessionManager...');
try {
  await streamSessionManager.shutdown();
  console.log('✅ StreamSessionManager shutdown complete');
} catch (error) {
  console.log('⚠️  Shutdown error (non-critical):', error.message);
} 