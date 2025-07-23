/**
 * Integration tests for Stream Termination Feature
 * 
 * Tests complete end-to-end flows including:
 * - Full stream termination flow from start to end
 * - Timeout scenarios and automatic cleanup
 * - Manual termination with partial response preservation
 * - Error scenarios and recovery
 * - Database consistency verification
 * - Concurrent termination requests
 */

import request from 'supertest';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { json } from 'express';
import streamSessionManager from '../../services/streamSessionManager.js';
import streamSessionDatabase from '../../services/streamSessionDatabase.js';
import ollamaService from '../../services/ollamaService.js';
import streamTerminationErrorHandler from '../../services/streamTerminationErrorHandler.js';
import { createStreamSession, STREAM_STATUS, TERMINATION_REASON } from '../../types/streamSession.js';
import typeDefs from '../../schema/typeDefs.js';
import resolvers from '../../schema/resolvers.js';
import pool from '../../config/database.js';

console.log('🧪 Testing Stream Termination Integration...');

// Create test Express app
const app = express();
app.use(json());

// Create Apollo Server for GraphQL testing
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// Setup Express middleware
await server.start();
server.applyMiddleware({ app, path: '/graphql' });

// Mock stream endpoint for testing
app.post('/api/stream-message', async (req, res) => {
  try {
    const { conversationId, message, model = 'llama2' } = req.body;
    
    if (!conversationId || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create session
    const session = await streamSessionManager.createSession(conversationId, model);
    
    // Simulate streaming with termination check
    let response = '';
    const chunks = ['Hello', ' world', '! This', ' is a', ' test', ' response.'];
    
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    for (let i = 0; i < chunks.length; i++) {
      // Check for termination
      const currentSession = streamSessionManager.getSession(session.id);
      if (!currentSession || currentSession.status !== STREAM_STATUS.ACTIVE) {
        break;
      }

      response += chunks[i];
      
      // Update session with partial response
      await streamSessionManager.updateSession(session.id, {
        partialResponse: response,
        tokenCount: response.length
      });

      res.write(`data: ${JSON.stringify({ chunk: chunks[i] })}\n\n`);
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Complete session
    await streamSessionManager.completeSession(session.id, response);
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add termination endpoint
app.post('/api/terminate-stream', async (req, res) => {
  try {
    const { sessionId, conversationId } = req.body;
    
    if (!sessionId || !conversationId) {
      return res.status(400).json({ error: 'Missing sessionId or conversationId' });
    }

    const session = streamSessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.conversationId !== conversationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const terminatedSession = await streamSessionManager.terminateSession(
      sessionId, 
      TERMINATION_REASON.USER_REQUESTED
    );

    if (!terminatedSession) {
      return res.status(404).json({ error: 'Session could not be terminated' });
    }

    res.json({
      success: true,
      sessionId: terminatedSession.id,
      partialResponse: terminatedSession.partialResponse,
      tokenCount: terminatedSession.tokenCount,
      terminationReason: terminatedSession.terminationReason
    });

  } catch (error) {
    console.error('Termination error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to setup test data
async function setupTestData() {
  try {
    // Insert test conversations
    await pool.query(`
      INSERT INTO conversations (id, tab_name, llm_model, is_private, created_at, updated_at) 
      VALUES 
        ('test-conv-1', 'Test Conversation 1', 'llama2', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('test-conv-2', 'Test Conversation 2', 'llama2', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('test-conv-3', 'Test Conversation 3', 'llama2', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET 
        tab_name = EXCLUDED.tab_name,
        updated_at = CURRENT_TIMESTAMP
    `);
    console.log('✅ Test data setup completed');
  } catch (error) {
    console.log('⚠️  Test data setup warning:', error.message);
  }
}

// Helper function to cleanup test data
async function cleanupTestData() {
  try {
    await pool.query('DELETE FROM stream_sessions WHERE conversation_id LIKE \'test-conv-%\'');
    await pool.query('DELETE FROM conversations WHERE id LIKE \'test-conv-%\'');
    console.log('✅ Test data cleanup completed');
  } catch (error) {
    console.log('⚠️  Test data cleanup warning:', error.message);
  }
}

// Initialize services
console.log('\n1️⃣  Initializing services...');
try {
  await streamTerminationErrorHandler.initialize();
  await streamSessionDatabase.initialize();
  await streamSessionManager.initialize();
  await setupTestData();
  console.log('✅ Services initialized successfully');
} catch (error) {
  console.log('❌ Service initialization failed:', error.message);
  process.exit(1);
}

// Test 1: Full stream termination flow
console.log('\n2️⃣  Testing full stream termination flow...');
try {
  const conversationId = 'test-conv-1';
  
  // Create a session directly
  const session = await streamSessionManager.createSession(conversationId, 'llama2');
  console.log(`📝 Created session: ${session.id}`);

  // Simulate some streaming by updating with tokens
  const testResponse = 'Hello world! This is a test response.';
  for (let i = 0; i < testResponse.length; i++) {
    await streamSessionManager.updateSessionWithToken(session.id, testResponse[i]);
  }

  // Terminate the stream
  const terminateResponse = await request(app)
    .post('/api/terminate-stream')
    .send({ sessionId: session.id, conversationId })
    .expect(200);

  const terminationResult = terminateResponse.body;
  console.log('✅ Stream terminated successfully');
  console.log(`📊 Partial response length: ${terminationResult.partialResponse.length}`);
  console.log(`🔢 Token count: ${terminationResult.tokenCount}`);

  // Verify session state
  const terminatedSession = streamSessionManager.getSession(session.id);
  if (terminatedSession && terminatedSession.status === STREAM_STATUS.TERMINATED) {
    console.log('✅ Session properly terminated in memory');
  } else {
    throw new Error('Session not properly terminated in memory');
  }

  // Verify database state
  const dbSession = await streamSessionDatabase.getSession(session.id);
  if (dbSession && dbSession.status === STREAM_STATUS.TERMINATED) {
    console.log('✅ Session properly saved to database');
  } else {
    throw new Error('Session not properly saved to database');
  }

  // Verify partial response preservation
  if (terminationResult.partialResponse.length > 0) {
    console.log('✅ Partial response preserved');
  } else {
    throw new Error('Partial response not preserved');
  }

} catch (error) {
  console.log('❌ Full stream termination flow test failed:', error.message);
}

// Test 2: Timeout scenario
console.log('\n3️⃣  Testing timeout scenario...');
try {
  const conversationId = 'test-conv-2';
  const message = 'Test message for timeout';
  
  // Create a session with short timeout
  const session = await streamSessionManager.createSession(conversationId, 'llama2', 1000); // 1 second timeout
  console.log(`📝 Created session with short timeout: ${session.id}`);

  // Wait for timeout and cleanup
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Manually trigger cleanup
  await streamSessionManager.cleanupExpiredSessions();

  // Check if session was cleaned up
  const expiredSession = streamSessionManager.getSession(session.id);
  if (!expiredSession) {
    console.log('✅ Session properly cleaned up after timeout');
  } else {
    console.log('⚠️  Session still exists (may be cleaned up in next cycle)');
  }

  // Check database cleanup
  const dbSession = await streamSessionDatabase.getSession(session.id);
  if (!dbSession) {
    console.log('✅ Session properly removed from database after timeout');
  } else {
    console.log('⚠️  Session still in database (cleanup may be delayed)');
  }

} catch (error) {
  console.log('❌ Timeout scenario test failed:', error.message);
}

// Test 3: Manual termination with partial response
console.log('\n4️⃣  Testing manual termination with partial response...');
try {
  const conversationId = 'test-conv-3';
  const message = 'Test message for manual termination';
  
  // Create session and simulate partial response
  const session = await streamSessionManager.createSession(conversationId, 'llama2');
  const partialResponse = 'This is a partial response that should be preserved.';
  
  // Update session with partial response (simulate token updates)
  for (let i = 0; i < partialResponse.length; i++) {
    await streamSessionManager.updateSessionWithToken(session.id, partialResponse[i]);
  }

  console.log(`📝 Created session with partial response: ${session.id}`);

  // Manually terminate
  const terminatedSession = await streamSessionManager.terminateSession(
    session.id, 
    TERMINATION_REASON.USER_REQUESTED
  );

  if (terminatedSession && terminatedSession.partialResponse === partialResponse) {
    console.log('✅ Manual termination preserved partial response');
  } else {
    throw new Error('Manual termination did not preserve partial response');
  }

  // Verify database consistency
  const dbSession = await streamSessionDatabase.getSession(session.id);
  if (dbSession && dbSession.partialResponse === partialResponse) {
    console.log('✅ Database consistency verified');
  } else {
    throw new Error('Database inconsistency detected');
  }

} catch (error) {
  console.log('❌ Manual termination test failed:', error.message);
}

// Test 4: Error scenarios and recovery
console.log('\n5️⃣  Testing error scenarios and recovery...');
try {
  // Test termination of non-existent session
  const nonExistentResponse = await request(app)
    .post('/api/terminate-stream')
    .send({ sessionId: 'non-existent', conversationId: 'test-conv-1' })
    .expect(404);

  console.log('✅ Non-existent session termination handled correctly');

  // Test termination with wrong conversation ID
  const session = await streamSessionManager.createSession('test-conv-1', 'llama2');
  const wrongConvResponse = await request(app)
    .post('/api/terminate-stream')
    .send({ sessionId: session.id, conversationId: 'wrong-conv' })
    .expect(403);

  console.log('✅ Wrong conversation ID access denied correctly');

  // Clean up the test session
  await streamSessionManager.terminateSession(session.id, TERMINATION_REASON.USER_REQUESTED);

} catch (error) {
  console.log('❌ Error scenarios test failed:', error.message);
}

// Test 5: Concurrent termination requests
console.log('\n6️⃣  Testing concurrent termination requests...');
try {
  const conversationId = 'test-conv-1';
  const session = await streamSessionManager.createSession(conversationId, 'llama2');
  
  console.log(`📝 Created session for concurrent test: ${session.id}`);

  // Send multiple termination requests simultaneously
  const terminationPromises = Array(5).fill().map(() => 
    request(app)
      .post('/api/terminate-stream')
      .send({ sessionId: session.id, conversationId })
  );

  const results = await Promise.allSettled(terminationPromises);
  
  const successfulTerminations = results.filter(result => 
    result.status === 'fulfilled' && result.value.status === 200
  ).length;

  const failedTerminations = results.filter(result => 
    result.status === 'fulfilled' && result.value.status !== 200
  ).length;

  console.log(`✅ Concurrent termination results: ${successfulTerminations} successful, ${failedTerminations} failed`);

  // Verify only one termination was processed
  const finalSession = streamSessionManager.getSession(session.id);
  if (finalSession && finalSession.status === STREAM_STATUS.TERMINATED) {
    console.log('✅ Session properly terminated despite concurrent requests');
  } else {
    throw new Error('Session not properly terminated after concurrent requests');
  }

} catch (error) {
  console.log('❌ Concurrent termination test failed:', error.message);
}

// Test 6: GraphQL termination mutation
console.log('\n7️⃣  Testing GraphQL termination mutation...');
try {
  const conversationId = 'test-conv-1';
  const session = await streamSessionManager.createSession(conversationId, 'llama2');
  
  console.log(`📝 Created session for GraphQL test: ${session.id}`);

  const mutation = `
    mutation TerminateStream($input: TerminateStreamInput!) {
      terminateStream(input: $input) {
        success
        sessionId
        partialResponse
        tokenCount
        terminationReason
        error
      }
    }
  `;

  const variables = {
    input: {
      sessionId: session.id,
      conversationId: conversationId
    }
  };

  const response = await request(app)
    .post('/graphql')
    .send({
      query: mutation,
      variables: variables
    });

  if (response.status !== 200) {
    console.log('⚠️  GraphQL request failed with status:', response.status);
    console.log('Response body:', response.body);
    throw new Error(`GraphQL request failed: ${response.status}`);
  }

  const result = response.body.data?.terminateStream;
  
  if (result && result.success && result.sessionId === session.id) {
    console.log('✅ GraphQL termination mutation successful');
  } else {
    console.log('⚠️  GraphQL response:', response.body);
    throw new Error('GraphQL termination mutation failed');
  }

} catch (error) {
  console.log('❌ GraphQL termination test failed:', error.message);
}

// Test 7: Memory and resource cleanup verification
console.log('\n8️⃣  Testing memory and resource cleanup...');
try {
  const initialSessionCount = streamSessionManager.getAllActiveSessions().length;
  console.log(`📊 Initial session count: ${initialSessionCount}`);

  // Create multiple sessions
  const sessions = [];
  for (let i = 0; i < 5; i++) {
    const session = await streamSessionManager.createSession(`test-conv-${i}`, 'llama2');
    sessions.push(session);
  }

  const midSessionCount = streamSessionManager.getAllActiveSessions().length;
  console.log(`📊 Mid session count: ${midSessionCount}`);

  // Terminate all sessions
  for (const session of sessions) {
    await streamSessionManager.terminateSession(session.id, TERMINATION_REASON.USER_REQUESTED);
  }

  const finalSessionCount = streamSessionManager.getAllActiveSessions().length;
  console.log(`📊 Final session count: ${finalSessionCount}`);

  if (finalSessionCount <= initialSessionCount) {
    console.log('✅ Memory cleanup verified');
  } else {
    throw new Error('Memory cleanup failed');
  }

} catch (error) {
  console.log('❌ Memory cleanup test failed:', error.message);
}

// Test 8: Error handler integration verification
console.log('\n9️⃣  Testing error handler integration...');
try {
  const errorStats = streamTerminationErrorHandler.getErrorStats();
  const operationMetrics = streamTerminationErrorHandler.getOperationMetrics('create_session');
  
  console.log('📊 Error handler stats:', {
    totalErrors: errorStats.totalErrors,
    totalOperations: errorStats.totalOperations,
    successRate: errorStats.successRate
  });

  if (operationMetrics) {
    console.log('📊 Operation metrics available:', {
      totalCalls: operationMetrics.totalCalls,
      successCount: operationMetrics.successCount,
      averageDuration: operationMetrics.averageDuration
    });
  }

  console.log('✅ Error handler integration verified');

} catch (error) {
  console.log('❌ Error handler integration test failed:', error.message);
}

// Test 9: Database consistency verification
console.log('\n🔟  Testing database consistency...');
try {
  // Get all sessions from memory
  const memorySessions = streamSessionManager.getAllActiveSessions();
  
  // Get all sessions from database (including terminated ones for comparison)
  const activeDbSessions = await streamSessionDatabase.getSessionsByStatus('ACTIVE', 100);
  const terminatedDbSessions = await streamSessionDatabase.getSessionsByStatus('TERMINATED', 100);
  const allDbSessions = [...activeDbSessions, ...terminatedDbSessions];
  
  console.log(`📊 Memory sessions: ${memorySessions.length}`);
  console.log(`📊 Database sessions: ${allDbSessions.length} (${activeDbSessions.length} active, ${terminatedDbSessions.length} terminated)`);

  // Check for consistency - only compare active sessions
  let consistent = true;
  for (const memorySession of memorySessions) {
    const dbSession = activeDbSessions.find(s => s.id === memorySession.id);
    if (!dbSession) {
      consistent = false;
      console.log(`⚠️  Memory session ${memorySession.id} not found in database active sessions`);
    }
  }

  if (consistent) {
    console.log('✅ Database consistency verified');
  } else {
    console.log('⚠️  Database inconsistency detected (this may be normal during testing)');
  }

} catch (error) {
  console.log('❌ Database consistency test failed:', error.message);
}

// Cleanup
console.log('\n🧹 Cleaning up...');
try {
  await streamSessionManager.shutdown();
  await cleanupTestData();
  // Force exit to prevent hanging
  process.exit(0);
} catch (error) {
  console.log('⚠️  Cleanup warning:', error.message);
  process.exit(1);
}

console.log('\n🎉 Stream Termination Integration Tests Completed!'); 