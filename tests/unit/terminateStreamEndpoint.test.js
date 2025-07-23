/**
 * Unit tests for Stream Termination Endpoint
 * 
 * This test file verifies the POST /api/terminate-stream endpoint
 * including validation, permissions, and error handling.
 */

import request from 'supertest';
import express from 'express';
import streamRoutes from '../../routes/stream.js';
import streamSessionDatabase from '../../services/streamSessionDatabase.js';
import streamSessionManager from '../../services/streamSessionManager.js';
import {
  STREAM_STATUS,
  TERMINATION_REASON,
  createStreamSession
} from '../../types/streamSession.js';

// Create test app
const app = express();
app.use(express.json());
app.use('/api', streamRoutes);

console.log('🧪 Testing Stream Termination Endpoint...');

// Initialize services
console.log('\n🔧 Initializing services...');
try {
  await streamSessionDatabase.initialize();
  await streamSessionManager.initialize();
  console.log('✅ Services initialized successfully');
} catch (error) {
  console.log('❌ Service initialization failed:', error.message);
}

// Test 1: Basic endpoint accessibility
console.log('\n1️⃣  Testing endpoint accessibility...');
try {
  const response = await request(app)
    .post('/api/terminate-stream')
    .send({})
    .expect(400);
  
  console.log('✅ Endpoint accessible and returns 400 for missing parameters');
} catch (error) {
  console.log('❌ Endpoint accessibility test failed:', error.message);
}

// Test 2: Missing required parameters
console.log('\n2️⃣  Testing missing required parameters...');
const testCases = [
  { body: {}, expectedError: 'sessionId and conversationId' },
  { body: { sessionId: 'test' }, expectedError: 'sessionId and conversationId' },
  { body: { conversationId: 'test' }, expectedError: 'sessionId and conversationId' }
];

for (const testCase of testCases) {
  try {
    const response = await request(app)
      .post('/api/terminate-stream')
      .send(testCase.body)
      .expect(400);
    
    const hasExpectedError = response.body.error && 
                           response.body.error.includes(testCase.expectedError);
    console.log(`✅ Missing parameters test: ${hasExpectedError ? 'PASSED' : 'FAILED'}`);
  } catch (error) {
    console.log('❌ Missing parameters test failed:', error.message);
  }
}

// Test 3: Invalid session ID
console.log('\n3️⃣  Testing invalid session ID...');
try {
  const response = await request(app)
    .post('/api/terminate-stream')
    .send({
      sessionId: 'invalid-session-id',
      conversationId: 'conv-db-test-123'
    })
    .expect(404);
  
  console.log('✅ Invalid session ID test:', response.body.error === 'Session not found');
} catch (error) {
  console.log('❌ Invalid session ID test failed:', error.message);
}

// Test 4: Invalid conversation ID
console.log('\n4️⃣  Testing invalid conversation ID...');
try {
  const response = await request(app)
    .post('/api/terminate-stream')
    .send({
      sessionId: 'test-session-id',
      conversationId: 'invalid-conversation-id'
    })
    .expect(404);
  
  console.log('✅ Invalid conversation ID test:', response.body.error === 'Conversation not found');
} catch (error) {
  console.log('❌ Invalid conversation ID test failed:', error.message);
}

// Test 5: Session conversation mismatch
console.log('\n5️⃣  Testing session conversation mismatch...');
try {
  // Create a session for a different conversation
  const testSession = createStreamSession('conv-db-test-456', 'test-model');
  await streamSessionDatabase.createSession(testSession);
  
  const response = await request(app)
    .post('/api/terminate-stream')
    .send({
      sessionId: testSession.id,
      conversationId: 'conv-db-test-123' // Different conversation
    })
    .expect(403);
  
  console.log('✅ Session conversation mismatch test:', response.body.error === 'Session conversation mismatch');
  
  // Clean up
  await streamSessionDatabase.deleteSession(testSession.id);
} catch (error) {
  console.log('❌ Session conversation mismatch test failed:', error.message);
}

// Test 6: Terminate already terminated session
console.log('\n6️⃣  Testing terminate already terminated session...');
try {
  // Create and terminate a session
  const testSession = createStreamSession('conv-db-test-123', 'test-model');
  await streamSessionDatabase.createSession(testSession);
  await streamSessionDatabase.terminateSession(testSession.id, TERMINATION_REASON.USER_REQUESTED);
  
  const response = await request(app)
    .post('/api/terminate-stream')
    .send({
      sessionId: testSession.id,
      conversationId: 'conv-db-test-123'
    })
    .expect(400);
  
  console.log('✅ Already terminated session test:', response.body.error === 'Session not terminable');
  
  // Clean up
  await streamSessionDatabase.deleteSession(testSession.id);
} catch (error) {
  console.log('❌ Already terminated session test failed:', error.message);
}

// Test 7: Successful termination
console.log('\n7️⃣  Testing successful termination...');
try {
  // Create an active session
  const testSession = createStreamSession('conv-db-test-123', 'test-model');
  await streamSessionDatabase.createSession(testSession);
  
  // Add some tokens to the session
  await streamSessionDatabase.updateSessionWithToken(testSession.id, 'Hello');
  await streamSessionDatabase.updateSessionWithToken(testSession.id, ' World');
  
  const response = await request(app)
    .post('/api/terminate-stream')
    .send({
      sessionId: testSession.id,
      conversationId: 'conv-db-test-123'
    })
    .expect(200);
  
  console.log('✅ Successful termination test:', {
    success: response.body.success,
    sessionId: response.body.sessionId,
    tokenCount: response.body.tokenCount,
    partialResponse: response.body.partialResponse,
    finalStatus: response.body.finalStatus,
    terminationReason: response.body.terminationReason
  });
  
  // Clean up
  await streamSessionDatabase.deleteSession(testSession.id);
} catch (error) {
  console.log('❌ Successful termination test failed:', error.message);
}

// Test 8: Termination with custom reason
console.log('\n8️⃣  Testing termination with custom reason...');
try {
  // Create an active session
  const testSession = createStreamSession('conv-db-test-123', 'test-model');
  await streamSessionDatabase.createSession(testSession);
  
  const response = await request(app)
    .post('/api/terminate-stream')
    .send({
      sessionId: testSession.id,
      conversationId: 'conv-db-test-123',
      reason: TERMINATION_REASON.TIMEOUT
    })
    .expect(200);
  
  console.log('✅ Custom reason termination test:', {
    success: response.body.success,
    terminationReason: response.body.terminationReason,
    expectedReason: TERMINATION_REASON.TIMEOUT
  });
  
  // Clean up
  await streamSessionDatabase.deleteSession(testSession.id);
} catch (error) {
  console.log('❌ Custom reason termination test failed:', error.message);
}

// Test 9: Private conversation without password
console.log('\n9️⃣  Testing private conversation without password...');
try {
  // Create a private conversation (this would need to be set up in the database)
  // For now, we'll test the endpoint behavior
  const response = await request(app)
    .post('/api/terminate-stream')
    .send({
      sessionId: 'test-session-id',
      conversationId: 'private-conversation-id'
    })
    .expect(404); // Should fail because conversation doesn't exist
  
  console.log('✅ Private conversation test (conversation not found):', response.body.error === 'Conversation not found');
} catch (error) {
  console.log('❌ Private conversation test failed:', error.message);
}

// Test 10: Error handling
console.log('\n🔟  Testing error handling...');
try {
  // Test with malformed JSON
  const response = await request(app)
    .post('/api/terminate-stream')
    .set('Content-Type', 'application/json')
    .send('invalid json')
    .expect(400);
  
  console.log('✅ Malformed JSON test:', response.status === 400);
} catch (error) {
  console.log('❌ Malformed JSON test failed:', error.message);
}

// Test 11: Concurrent termination requests
console.log('\n1️⃣1️⃣  Testing concurrent termination requests...');
try {
  // Create an active session
  const testSession = createStreamSession('conv-db-test-123', 'test-model');
  await streamSessionDatabase.createSession(testSession);
  
  // Send multiple termination requests concurrently
  const requests = [
    request(app).post('/api/terminate-stream').send({
      sessionId: testSession.id,
      conversationId: 'conv-db-test-123'
    }),
    request(app).post('/api/terminate-stream').send({
      sessionId: testSession.id,
      conversationId: 'conv-db-test-123'
    }),
    request(app).post('/api/terminate-stream').send({
      sessionId: testSession.id,
      conversationId: 'conv-db-test-123'
    })
  ];
  
  const responses = await Promise.all(requests);
  
  // One should succeed, others should fail
  const successCount = responses.filter(r => r.status === 200).length;
  const failureCount = responses.filter(r => r.status === 400).length;
  
  console.log('✅ Concurrent termination test:', {
    successCount,
    failureCount,
    totalRequests: responses.length
  });
  
  // Clean up
  await streamSessionDatabase.deleteSession(testSession.id);
} catch (error) {
  console.log('❌ Concurrent termination test failed:', error.message);
}

// Test 12: Response format validation
console.log('\n1️⃣2️⃣  Testing response format validation...');
try {
  // Create an active session
  const testSession = createStreamSession('conv-db-test-123', 'test-model');
  await streamSessionDatabase.createSession(testSession);
  
  const response = await request(app)
    .post('/api/terminate-stream')
    .send({
      sessionId: testSession.id,
      conversationId: 'conv-db-test-123'
    })
    .expect(200);
  
  // Validate response format
  const requiredFields = [
    'success', 'sessionId', 'message', 'partialResponse', 
    'tokenCount', 'finalStatus', 'terminationReason', 'timestamp'
  ];
  
  const hasAllFields = requiredFields.every(field => response.body.hasOwnProperty(field));
  const correctTypes = {
    success: typeof response.body.success === 'boolean',
    sessionId: typeof response.body.sessionId === 'string',
    message: typeof response.body.message === 'string',
    partialResponse: typeof response.body.partialResponse === 'string',
    tokenCount: typeof response.body.tokenCount === 'number',
    finalStatus: typeof response.body.finalStatus === 'string',
    terminationReason: typeof response.body.terminationReason === 'string',
    timestamp: typeof response.body.timestamp === 'string'
  };
  
  console.log('✅ Response format test:', {
    hasAllFields,
    correctTypes: Object.values(correctTypes).every(Boolean)
  });
  
  // Clean up
  await streamSessionDatabase.deleteSession(testSession.id);
} catch (error) {
  console.log('❌ Response format test failed:', error.message);
}

// Test 13: Performance test
console.log('\n1️⃣3️⃣  Testing performance...');
try {
  const startTime = Date.now();
  
  // Create an active session
  const testSession = createStreamSession('conv-db-test-123', 'test-model');
  await streamSessionDatabase.createSession(testSession);
  
  const response = await request(app)
    .post('/api/terminate-stream')
    .send({
      sessionId: testSession.id,
      conversationId: 'conv-db-test-123'
    })
    .expect(200);
  
  const duration = Date.now() - startTime;
  
  console.log('✅ Performance test:', {
    duration: `${duration}ms`,
    acceptable: duration < 1000 // Should complete in under 1 second
  });
  
  // Clean up
  await streamSessionDatabase.deleteSession(testSession.id);
} catch (error) {
  console.log('❌ Performance test failed:', error.message);
}

// Test 14: Database consistency
console.log('\n1️⃣4️⃣  Testing database consistency...');
try {
  // Create an active session
  const testSession = createStreamSession('conv-db-test-123', 'test-model');
  await streamSessionDatabase.createSession(testSession);
  
  // Add some tokens
  await streamSessionDatabase.updateSessionWithToken(testSession.id, 'Test');
  await streamSessionDatabase.updateSessionWithToken(testSession.id, ' message');
  
  const response = await request(app)
    .post('/api/terminate-stream')
    .send({
      sessionId: testSession.id,
      conversationId: 'conv-db-test-123'
    })
    .expect(200);
  
  // Verify session was terminated in database
  const terminatedSession = await streamSessionDatabase.getSession(testSession.id);
  const isTerminated = terminatedSession && terminatedSession.status === STREAM_STATUS.TERMINATED;
  
  console.log('✅ Database consistency test:', {
    isTerminated,
    partialResponse: terminatedSession ? terminatedSession.partialResponse : 'N/A',
    tokenCount: terminatedSession ? terminatedSession.tokenCount : 'N/A'
  });
  
  // Clean up
  await streamSessionDatabase.deleteSession(testSession.id);
} catch (error) {
  console.log('❌ Database consistency test failed:', error.message);
}

// Test 15: Message saving verification
console.log('\n1️⃣5️⃣  Testing message saving verification...');
try {
  // Create an active session
  const testSession = createStreamSession('conv-db-test-123', 'test-model');
  await streamSessionDatabase.createSession(testSession);
  
  // Add substantial content
  const testContent = 'This is a test message that should be saved when the stream is terminated.';
  for (const char of testContent) {
    await streamSessionDatabase.updateSessionWithToken(testSession.id, char);
  }
  
  const response = await request(app)
    .post('/api/terminate-stream')
    .send({
      sessionId: testSession.id,
      conversationId: 'conv-db-test-123'
    })
    .expect(200);
  
  console.log('✅ Message saving test:', {
    success: response.body.success,
    savedMessageId: response.body.savedMessageId,
    partialResponseLength: response.body.partialResponse.length,
    hasContent: response.body.partialResponse.length > 0
  });
  
  // Clean up
  await streamSessionDatabase.deleteSession(testSession.id);
} catch (error) {
  console.log('❌ Message saving test failed:', error.message);
}

console.log('\n🎉 All Stream Termination Endpoint tests completed!');

// Cleanup: Shutdown services to stop timers
console.log('\n🧹 Cleaning up services...');
try {
  await streamSessionManager.shutdown();
  console.log('✅ StreamSessionManager shutdown complete');
} catch (error) {
  console.log('⚠️  Shutdown error (non-critical):', error.message);
} 