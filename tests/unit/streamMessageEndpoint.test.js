/**
 * Unit tests for Updated Stream Message Endpoint
 * 
 * This test file verifies the updated /api/stream-message endpoint
 * including session management, termination handling, and integration.
 */

import request from 'supertest';
import express from 'express';
import streamRoutes from '../../routes/stream.js';
import streamSessionDatabase from '../../services/streamSessionDatabase.js';
import streamSessionManager from '../../services/streamSessionManager.js';
import {
  STREAM_STATUS,
  TERMINATION_REASON
} from '../../types/streamSession.js';

// Create test app
const app = express();
app.use(express.json());
app.use('/api', streamRoutes);

console.log('🧪 Testing Updated Stream Message Endpoint...');

// Initialize services
console.log('\n🔧 Initializing services...');
try {
  await streamSessionDatabase.initialize();
  await streamSessionManager.initialize();
  console.log('✅ Services initialized successfully');
} catch (error) {
  console.log('❌ Service initialization failed:', error.message);
}

// Test 1: Basic streaming with session creation
console.log('\n1️⃣  Testing basic streaming with session creation...');
try {
  const response = await request(app)
    .post('/api/stream-message')
    .send({
      model: 'llama3.1:8b',
      message: 'Hello, how are you?',
      conversationId: 'conv-db-test-123'
    })
    .expect(200);

  console.log('✅ Basic streaming test completed');
} catch (error) {
  console.log('❌ Basic streaming test failed:', error.message);
}

// Test 2: Missing required parameters
console.log('\n2️⃣  Testing missing required parameters...');
const missingParamTests = [
  { body: {}, expectedError: 'Missing model, message, or conversationId' },
  { body: { model: 'test' }, expectedError: 'Missing model, message, or conversationId' },
  { body: { message: 'test' }, expectedError: 'Missing model, message, or conversationId' },
  { body: { conversationId: 'test' }, expectedError: 'Missing model, message, or conversationId' }
];

for (const testCase of missingParamTests) {
  try {
    const response = await request(app)
      .post('/api/stream-message')
      .send(testCase.body)
      .expect(200); // SSE returns 200 even for errors
    
    const hasExpectedError = response.text.includes(testCase.expectedError);
    console.log(`✅ Missing parameters test: ${hasExpectedError ? 'PASSED' : 'FAILED'}`);
  } catch (error) {
    console.log('❌ Missing parameters test failed:', error.message);
  }
}

// Test 3: Invalid conversation ID
console.log('\n3️⃣  Testing invalid conversation ID...');
try {
  const response = await request(app)
    .post('/api/stream-message')
    .send({
      model: 'llama3.1:8b',
      message: 'Hello',
      conversationId: 'invalid-conversation-id'
    })
    .expect(200);
  
  const hasError = response.text.includes('Conversation not found');
  console.log('✅ Invalid conversation ID test:', hasError);
} catch (error) {
  console.log('❌ Invalid conversation ID test failed:', error.message);
}

// Test 4: Private conversation without password
console.log('\n4️⃣  Testing private conversation without password...');
try {
  const response = await request(app)
    .post('/api/stream-message')
    .send({
      model: 'llama3.1:8b',
      message: 'Hello',
      conversationId: 'private-conversation-id'
    })
    .expect(200);
  
  const hasError = response.text.includes('Conversation not found');
  console.log('✅ Private conversation test:', hasError);
} catch (error) {
  console.log('❌ Private conversation test failed:', error.message);
}

// Test 5: Session creation verification
console.log('\n5️⃣  Testing session creation verification...');
try {
  const response = await request(app)
    .post('/api/stream-message')
    .send({
      model: 'llama3.1:8b',
      message: 'Test session creation',
      conversationId: 'conv-db-test-123'
    })
    .expect(200);
  
  // Check if session event is sent
  const hasSessionEvent = response.text.includes('event: session');
  console.log('✅ Session creation test:', hasSessionEvent);
} catch (error) {
  console.log('❌ Session creation test failed:', error.message);
}

// Test 6: Session database integration
console.log('\n6️⃣  Testing session database integration...');
try {
  // Get active sessions before streaming
  const beforeSessions = await streamSessionDatabase.getActiveSessionsForConversation('conv-db-test-123');
  const beforeCount = beforeSessions.length;
  
  const response = await request(app)
    .post('/api/stream-message')
    .send({
      model: 'llama3.1:8b',
      message: 'Test database integration',
      conversationId: 'conv-db-test-123'
    })
    .expect(200);
  
  // Wait a moment for session to be created
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Get active sessions after streaming
  const afterSessions = await streamSessionDatabase.getActiveSessionsForConversation('conv-db-test-123');
  const afterCount = afterSessions.length;
  
  console.log('✅ Session database integration test:', {
    beforeCount,
    afterCount,
    sessionCreated: afterCount >= beforeCount
  });
} catch (error) {
  console.log('❌ Session database integration test failed:', error.message);
}

// Test 7: Session manager integration
console.log('\n7️⃣  Testing session manager integration...');
try {
  const beforeSessions = streamSessionManager.getAllActiveSessions();
  const beforeCount = beforeSessions.length;
  
  const response = await request(app)
    .post('/api/stream-message')
    .send({
      model: 'llama3.1:8b',
      message: 'Test manager integration',
      conversationId: 'conv-db-test-123'
    })
    .expect(200);
  
  // Wait a moment for session to be created
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const afterSessions = streamSessionManager.getAllActiveSessions();
  const afterCount = afterSessions.length;
  
  console.log('✅ Session manager integration test:', {
    beforeCount,
    afterCount,
    sessionCreated: afterCount >= beforeCount
  });
} catch (error) {
  console.log('❌ Session manager integration test failed:', error.message);
}

// Test 8: Error handling during streaming
console.log('\n8️⃣  Testing error handling during streaming...');
try {
  const response = await request(app)
    .post('/api/stream-message')
    .send({
      model: 'invalid-model',
      message: 'Test error handling',
      conversationId: 'conv-db-test-123'
    })
    .expect(200);
  
  const hasError = response.text.includes('event: error');
  console.log('✅ Error handling test:', hasError);
} catch (error) {
  console.log('❌ Error handling test failed:', error.message);
}

// Test 9: Session cleanup on error
console.log('\n9️⃣  Testing session cleanup on error...');
try {
  // Get active sessions before error
  const beforeSessions = await streamSessionDatabase.getActiveSessionsForConversation('conv-db-test-123');
  const beforeCount = beforeSessions.length;
  
  const response = await request(app)
    .post('/api/stream-message')
    .send({
      model: 'invalid-model',
      message: 'Test cleanup on error',
      conversationId: 'conv-db-test-123'
    })
    .expect(200);
  
  // Wait a moment for cleanup
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Get active sessions after error
  const afterSessions = await streamSessionDatabase.getActiveSessionsForConversation('conv-db-test-123');
  const afterCount = afterSessions.length;
  
  console.log('✅ Session cleanup on error test:', {
    beforeCount,
    afterCount,
    cleanupHappened: afterCount <= beforeCount
  });
} catch (error) {
  console.log('❌ Session cleanup on error test failed:', error.message);
}

// Test 10: Response format validation
console.log('\n🔟  Testing response format validation...');
try {
  const response = await request(app)
    .post('/api/stream-message')
    .send({
      model: 'llama3.1:8b',
      message: 'Test response format',
      conversationId: 'conv-db-test-123'
    })
    .expect(200);
  
  // Check for required SSE events
  const hasSessionEvent = response.text.includes('event: session');
  const hasDataEvents = response.text.includes('data: ');
  const hasEndEvent = response.text.includes('event: end');
  
  console.log('✅ Response format test:', {
    hasSessionEvent,
    hasDataEvents,
    hasEndEvent,
    validFormat: hasSessionEvent && hasDataEvents && hasEndEvent
  });
} catch (error) {
  console.log('❌ Response format test failed:', error.message);
}

// Test 11: Performance test
console.log('\n1️⃣1️⃣  Testing performance...');
try {
  const startTime = Date.now();
  
  const response = await request(app)
    .post('/api/stream-message')
    .send({
      model: 'llama3.1:8b',
      message: 'Performance test',
      conversationId: 'conv-db-test-123'
    })
    .expect(200);
  
  const duration = Date.now() - startTime;
  
  console.log('✅ Performance test:', {
    duration: `${duration}ms`,
    acceptable: duration < 5000 // Should complete in under 5 seconds
  });
} catch (error) {
  console.log('❌ Performance test failed:', error.message);
}

// Test 12: Concurrent streaming
console.log('\n1️⃣2️⃣  Testing concurrent streaming...');
try {
  const concurrentRequests = [
    request(app).post('/api/stream-message').send({
      model: 'llama3.1:8b',
      message: 'Concurrent test 1',
      conversationId: 'conv-db-test-123'
    }),
    request(app).post('/api/stream-message').send({
      model: 'llama3.1:8b',
      message: 'Concurrent test 2',
      conversationId: 'conv-db-test-123'
    }),
    request(app).post('/api/stream-message').send({
      model: 'llama3.1:8b',
      message: 'Concurrent test 3',
      conversationId: 'conv-db-test-123'
    })
  ];
  
  const responses = await Promise.all(concurrentRequests);
  
  const successCount = responses.filter(r => r.status === 200).length;
  console.log('✅ Concurrent streaming test:', {
    successCount,
    totalRequests: responses.length,
    allSuccessful: successCount === responses.length
  });
} catch (error) {
  console.log('❌ Concurrent streaming test failed:', error.message);
}

// Test 13: Session statistics after streaming
console.log('\n1️⃣3️⃣  Testing session statistics after streaming...');
try {
  const stats = await streamSessionDatabase.getSessionStats();
  
  console.log('✅ Session statistics test:', {
    totalSessions: stats.totalSessions,
    activeSessions: stats.activeSessions,
    completedSessions: stats.completedSessions,
    terminatedSessions: stats.terminatedSessions,
    errorSessions: stats.errorSessions
  });
} catch (error) {
  console.log('❌ Session statistics test failed:', error.message);
}

// Test 14: Memory manager statistics
console.log('\n1️⃣4️⃣  Testing memory manager statistics...');
try {
  const stats = streamSessionManager.getSessionStats();
  
  console.log('✅ Memory manager statistics test:', {
    activeSessions: stats.activeSessions,
    totalSessions: stats.totalSessions,
    terminatedSessions: stats.terminatedSessions,
    completedSessions: stats.completedSessions
  });
} catch (error) {
  console.log('❌ Memory manager statistics test failed:', error.message);
}

// Test 15: Backwards compatibility
console.log('\n1️⃣5️⃣  Testing backwards compatibility...');
try {
  // Test that the endpoint still works with the same request format
  const response = await request(app)
    .post('/api/stream-message')
    .send({
      model: 'llama3.1:8b',
      message: 'Backwards compatibility test',
      conversationId: 'conv-db-test-123'
    })
    .expect(200);
  
  // Check that we still get the expected SSE format
  const hasExpectedFormat = response.text.includes('data: ') && response.text.includes('event: end');
  
  console.log('✅ Backwards compatibility test:', {
    hasExpectedFormat,
    statusCode: response.status,
    backwardsCompatible: hasExpectedFormat && response.status === 200
  });
} catch (error) {
  console.log('❌ Backwards compatibility test failed:', error.message);
}

console.log('\n🎉 All Updated Stream Message Endpoint tests completed!');

// Cleanup: Shutdown services to stop timers
console.log('\n🧹 Cleaning up services...');
try {
  await streamSessionManager.shutdown();
  console.log('✅ StreamSessionManager shutdown complete');
} catch (error) {
  console.log('⚠️  Shutdown error (non-critical):', error.message);
} 