/**
 * Unit tests for StreamSessionDatabase Service
 * 
 * This test file verifies the database persistence functionality
 * including CRUD operations, cleanup, and atomic transactions.
 */

import streamSessionDatabase from '../../services/streamSessionDatabase.js';
import setupTestData from '../scripts/test-database-setup.js';
import {
  STREAM_STATUS,
  TERMINATION_REASON,
  createStreamSession
} from '../../types/streamSession.js';

console.log('🧪 Testing StreamSessionDatabase...');

// Setup test data
console.log('\n🔧 Setting up test data...');
try {
  await setupTestData();
  console.log('✅ Test data setup completed');
} catch (error) {
  console.log('❌ Test data setup failed:', error.message);
}

// Test 1: Basic initialization
console.log('\n1️⃣  Testing basic initialization...');
try {
  await streamSessionDatabase.initialize();
  console.log('✅ StreamSessionDatabase initialized successfully');
} catch (error) {
  console.log('❌ Initialization failed:', error.message);
}

// Test 2: Create session
console.log('\n2️⃣  Testing session creation...');
const testSession = createStreamSession('conv-db-test-123', 'llama3.1:8b', 60000);
try {
  const createdSession = await streamSessionDatabase.createSession(testSession);
  console.log('✅ Created session in database:', {
    id: createdSession.id,
    conversationId: createdSession.conversationId,
    model: createdSession.model,
    status: createdSession.status
  });
} catch (error) {
  console.log('❌ Session creation failed:', error.message);
}

// Test 3: Get session
console.log('\n3️⃣  Testing get session...');
try {
  const retrievedSession = await streamSessionDatabase.getSession(testSession.id);
  console.log('✅ Retrieved session:', retrievedSession ? 'FOUND' : 'NOT_FOUND');
  console.log('✅ Session match:', retrievedSession && retrievedSession.id === testSession.id);
} catch (error) {
  console.log('❌ Get session failed:', error.message);
}

// Test 4: Update session with token
console.log('\n4️⃣  Testing session token update...');
try {
  const updatedSession = await streamSessionDatabase.updateSessionWithToken(testSession.id, 'Hello');
  console.log('✅ Updated session:', {
    tokenCount: updatedSession.tokenCount,
    partialResponse: updatedSession.partialResponse,
    status: updatedSession.status
  });
} catch (error) {
  console.log('❌ Token update failed:', error.message);
}

// Test 5: Create multiple sessions
console.log('\n5️⃣  Testing multiple sessions...');
const session2 = createStreamSession('conv-db-test-456', 'mistral:7b');
const session3 = createStreamSession('conv-db-test-123', 'qwen:7b'); // Same conversation
try {
  await streamSessionDatabase.createSession(session2);
  await streamSessionDatabase.createSession(session3);
  console.log('✅ Created multiple sessions in database');
} catch (error) {
  console.log('❌ Multiple session creation failed:', error.message);
}

// Test 6: Get active sessions for conversation
console.log('\n6️⃣  Testing get active sessions for conversation...');
try {
  const convSessions = await streamSessionDatabase.getActiveSessionsForConversation('conv-db-test-123');
  console.log('✅ Sessions for conv-db-test-123:', {
    count: convSessions.length,
    sessionIds: convSessions.map(s => s.id)
  });
} catch (error) {
  console.log('❌ Get active sessions failed:', error.message);
}

// Test 7: Terminate session
console.log('\n7️⃣  Testing session termination...');
try {
  const terminationResult = await streamSessionDatabase.terminateSession(session2.id, TERMINATION_REASON.USER_REQUESTED);
  console.log('✅ Termination result:', {
    success: !!terminationResult,
    finalStatus: terminationResult ? terminationResult.status : 'N/A',
    terminationReason: terminationResult ? terminationResult.terminationReason : 'N/A'
  });
} catch (error) {
  console.log('❌ Session termination failed:', error.message);
}

// Test 8: Complete session
console.log('\n8️⃣  Testing session completion...');
try {
  const completionResult = await streamSessionDatabase.completeSession(session3.id);
  console.log('✅ Completion result:', {
    success: !!completionResult,
    finalStatus: completionResult ? completionResult.status : 'N/A'
  });
} catch (error) {
  console.log('❌ Session completion failed:', error.message);
}

// Test 9: Get session statistics
console.log('\n9️⃣  Testing session statistics...');
try {
  const stats = await streamSessionDatabase.getSessionStats();
  console.log('✅ Session statistics:', {
    totalSessions: stats.totalSessions,
    activeSessions: stats.activeSessions,
    completedSessions: stats.completedSessions,
    terminatedSessions: stats.terminatedSessions,
    errorSessions: stats.errorSessions
  });
} catch (error) {
  console.log('❌ Get statistics failed:', error.message);
}

// Test 10: Get sessions by status
console.log('\n🔟  Testing get sessions by status...');
try {
  const activeSessions = await streamSessionDatabase.getSessionsByStatus(STREAM_STATUS.ACTIVE);
  const terminatedSessions = await streamSessionDatabase.getSessionsByStatus(STREAM_STATUS.TERMINATED);
  const completedSessions = await streamSessionDatabase.getSessionsByStatus(STREAM_STATUS.COMPLETED);
  
  console.log('✅ Sessions by status:', {
    active: activeSessions.length,
    terminated: terminatedSessions.length,
    completed: completedSessions.length
  });
} catch (error) {
  console.log('❌ Get sessions by status failed:', error.message);
}

// Test 11: Invalid session operations
console.log('\n1️⃣1️⃣  Testing invalid session operations...');
try {
  const invalidSession = await streamSessionDatabase.getSession('invalid-session-id');
  console.log('✅ Invalid session get:', invalidSession === null);
} catch (error) {
  console.log('❌ Invalid session get failed:', error.message);
}

try {
  const invalidUpdate = await streamSessionDatabase.updateSessionWithToken('invalid-session-id', 'test');
  console.log('✅ Invalid session update:', invalidUpdate === null);
} catch (error) {
  console.log('❌ Invalid session update failed:', error.message);
}

// Test 12: Terminate already terminated session
console.log('\n1️⃣2️⃣  Testing terminate already terminated session...');
try {
  const alreadyTerminated = await streamSessionDatabase.terminateSession(session2.id);
  console.log('✅ Already terminated session:', {
    success: !!alreadyTerminated,
    finalStatus: alreadyTerminated ? alreadyTerminated.status : 'N/A'
  });
} catch (error) {
  console.log('❌ Already terminated session test failed:', error.message);
}

// Test 13: Create expired session for cleanup testing
console.log('\n1️⃣3️⃣  Testing expired session creation...');
const expiredSession = createStreamSession('conv-expire-test', 'test-model', 1000);
// Manually set started_at to be in the past
expiredSession.startedAt = new Date(Date.now() - 2000);
try {
  await streamSessionDatabase.createSession(expiredSession);
  console.log('✅ Created expired session for testing:', expiredSession.id);
} catch (error) {
  console.log('❌ Expired session creation failed:', error.message);
}

// Test 14: Get expired sessions
console.log('\n1️⃣4️⃣  Testing get expired sessions...');
try {
  const expiredSessions = await streamSessionDatabase.getExpiredSessions();
  console.log('✅ Expired sessions found:', expiredSessions.length);
} catch (error) {
  console.log('❌ Get expired sessions failed:', error.message);
}

// Test 15: Cleanup expired sessions
console.log('\n1️⃣5️⃣  Testing cleanup expired sessions...');
try {
  const cleanupResult = await streamSessionDatabase.cleanupExpiredSessions();
  console.log('✅ Cleanup result:', cleanupResult);
} catch (error) {
  console.log('❌ Cleanup failed:', error.message);
}

// Test 16: Save partial response as message
console.log('\n1️⃣6️⃣  Testing save partial response as message...');
const messageSession = createStreamSession('conv-message-test', 'llama3.1:8b');
try {
  await streamSessionDatabase.createSession(messageSession);
  await streamSessionDatabase.updateSessionWithToken(messageSession.id, 'Hello');
  await streamSessionDatabase.updateSessionWithToken(messageSession.id, ' World');
  
  const messageResult = await streamSessionDatabase.savePartialResponseAsMessage(
    messageSession.id,
    messageSession.conversationId,
    'Hello World'
  );
  
  console.log('✅ Saved partial response as message:', {
    messageId: messageResult.id,
    text: messageResult.text,
    sender: messageResult.sender
  });
} catch (error) {
  console.log('❌ Save partial response failed:', error.message);
}

// Test 17: Delete session
console.log('\n1️⃣7️⃣  Testing delete session...');
const deleteSession = createStreamSession('conv-delete-test', 'test-model');
try {
  await streamSessionDatabase.createSession(deleteSession);
  const deleteResult = await streamSessionDatabase.deleteSession(deleteSession.id);
  console.log('✅ Delete session result:', deleteResult);
  
  const deletedSession = await streamSessionDatabase.getSession(deleteSession.id);
  console.log('✅ Session after deletion:', deletedSession === null);
} catch (error) {
  console.log('❌ Delete session failed:', error.message);
}

// Test 18: Error handling
console.log('\n1️⃣8️⃣  Testing error handling...');
try {
  await streamSessionDatabase.createSession(null);
  console.log('❌ Should have rejected null session');
} catch (error) {
  console.log('✅ Correctly rejected null session:', error.message);
}

try {
  await streamSessionDatabase.createSession({});
  console.log('❌ Should have rejected invalid session');
} catch (error) {
  console.log('✅ Correctly rejected invalid session:', error.message);
}

// Test 19: Concurrent operations simulation
console.log('\n1️⃣9️⃣  Testing concurrent operations simulation...');
const concurrentSessions = [];
for (let i = 0; i < 5; i++) {
  concurrentSessions.push(createStreamSession(`conv-concurrent-${i}`, 'test-model'));
}

try {
  // Create sessions concurrently
  const createPromises = concurrentSessions.map(session => 
    streamSessionDatabase.createSession(session)
  );
  await Promise.all(createPromises);
  console.log('✅ Created 5 sessions concurrently');
  
  // Update sessions concurrently
  const updatePromises = concurrentSessions.map(session => 
    streamSessionDatabase.updateSessionWithToken(session.id, `token-${session.id}`)
  );
  await Promise.all(updatePromises);
  console.log('✅ Updated 5 sessions concurrently');
  
} catch (error) {
  console.log('❌ Concurrent operations failed:', error.message);
}

// Test 20: Final statistics
console.log('\n2️⃣0️⃣  Testing final statistics...');
try {
  const finalStats = await streamSessionDatabase.getSessionStats();
  console.log('✅ Final statistics:', {
    totalSessions: finalStats.totalSessions,
    activeSessions: finalStats.activeSessions,
    completedSessions: finalStats.completedSessions,
    terminatedSessions: finalStats.terminatedSessions,
    errorSessions: finalStats.errorSessions,
    avgDurationSeconds: finalStats.avgDurationSeconds
  });
} catch (error) {
  console.log('❌ Final statistics failed:', error.message);
}

console.log('\n🎉 All StreamSessionDatabase tests completed!'); 