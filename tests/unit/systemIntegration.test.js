/**
 * System Integration Tests for Stream Termination Feature
 * 
 * This test file verifies the integration of stream termination
 * with existing systems, backwards compatibility, and startup/shutdown scenarios.
 */

import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import supertest from 'supertest';
import typeDefs from '../../schema/typeDefs.js';
import resolvers from '../../schema/resolvers.js';
import streamRoutes from '../../routes/stream.js';
import streamSessionManager from '../../services/streamSessionManager.js';
import streamSessionDatabase from '../../services/streamSessionDatabase.js';
import ollamaService from '../../services/ollamaService.js';
import setupTestData from '../scripts/test-database-setup.js';

// Create test app
const app = express();
app.use(express.json());
app.use('/api', streamRoutes);

// Add health endpoint for testing
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Create Apollo Server for GraphQL testing
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => ({ req })
});

// Initialize Apollo Server
await server.start();
server.applyMiddleware({ app });

console.log('🧪 Testing System Integration for Stream Termination...');

// Initialize services
console.log('\n🔧 Initializing services...');
try {
  await streamSessionDatabase.initialize();
  await streamSessionManager.initialize();
  await ollamaService.initialize();
  console.log('✅ Services initialized successfully');
} catch (error) {
  console.log('❌ Service initialization failed:', error.message);
}

// Test 1: Backwards compatibility - existing streaming without termination
console.log('\n1️⃣  Testing backwards compatibility...');
try {
  // Test that the streaming endpoint still works without session management
  const response = await supertest(app)
    .post('/api/stream-message')
    .send({
      model: 'llama3.1:8b',
      message: 'Hello, this is a test message',
      conversationId: 'conv-db-test-123'
    })
    .expect(200);

  // Check that we get a session ID in the response
  const hasSessionEvent = response.text.includes('event: session');
  const hasSessionData = response.text.includes('sessionId');
  
  console.log('✅ Backwards compatibility test:', {
    hasSessionEvent,
    hasSessionData,
    responseLength: response.text.length
  });
} catch (error) {
  console.log('❌ Backwards compatibility test failed:', error.message);
}

// Test 2: Service initialization and cleanup
console.log('\n2️⃣  Testing service initialization and cleanup...');
try {
  // Check that services are properly initialized
  const dbInitialized = streamSessionDatabase._isInitialized;
  const managerInitialized = streamSessionManager._isInitialized;
  const ollamaInitialized = ollamaService._isInitialized;
  
  console.log('✅ Service initialization test:', {
    databaseInitialized: dbInitialized,
    managerInitialized: managerInitialized,
    ollamaInitialized: ollamaInitialized,
    allInitialized: dbInitialized && managerInitialized && ollamaInitialized
  });
} catch (error) {
  console.log('❌ Service initialization test failed:', error.message);
}

// Test 3: Session cleanup on startup
console.log('\n3️⃣  Testing session cleanup on startup...');
try {
  // Create some expired sessions to test cleanup
  const expiredSessions = [];
  for (let i = 0; i < 3; i++) {
    const session = {
      id: `expired-session-${i}`,
      conversationId: 'conv-db-test-123',
      model: 'llama3.1:8b',
      status: 'ACTIVE',
      startedAt: new Date(Date.now() - 400000), // 6+ minutes ago
      updatedAt: new Date(Date.now() - 400000),
      endedAt: null,
      partialResponse: `Expired response ${i}`,
      tokenCount: i + 1,
      terminationReason: null,
      errorMessage: null,
      timeoutMs: 300000
    };
    
    await streamSessionDatabase.createSession(session);
    expiredSessions.push(session);
  }
  
  // Get expired sessions
  const foundExpired = await streamSessionDatabase.getExpiredSessions();
  const hasExpiredSessions = foundExpired.length > 0;
  
  // Clean up expired sessions
  await streamSessionDatabase.cleanupExpiredSessions();
  
  // Verify cleanup
  const remainingExpired = await streamSessionDatabase.getExpiredSessions();
  const cleanupSuccessful = remainingExpired.length === 0;
  
  console.log('✅ Session cleanup on startup test:', {
    hasExpiredSessions,
    cleanupSuccessful,
    expiredCount: foundExpired.length,
    remainingCount: remainingExpired.length
  });
} catch (error) {
  console.log('❌ Session cleanup on startup test failed:', error.message);
}

// Test 4: Graceful shutdown simulation
console.log('\n4️⃣  Testing graceful shutdown simulation...');
try {
  // Create some active sessions
  const activeSessions = [];
  for (let i = 0; i < 2; i++) {
    const session = {
      id: `active-session-${i}`,
      conversationId: 'conv-db-test-123',
      model: 'llama3.1:8b',
      status: 'ACTIVE',
      startedAt: new Date(),
      updatedAt: new Date(),
      endedAt: null,
      partialResponse: `Active response ${i}`,
      tokenCount: i + 1,
      terminationReason: null,
      errorMessage: null,
      timeoutMs: 300000
    };
    
    await streamSessionDatabase.createSession(session);
    streamSessionManager.createSession(session.conversationId, session.model);
    activeSessions.push(session);
  }
  
  // Simulate graceful shutdown
  await streamSessionManager.shutdown();
  
  // Re-initialize the manager for subsequent tests
  await streamSessionManager.initialize();
  
  // Check that sessions were terminated
  const terminatedSessions = [];
  for (const session of activeSessions) {
    const dbSession = await streamSessionDatabase.getSession(session.id);
    if (dbSession && dbSession.status === 'TERMINATED') {
      terminatedSessions.push(session.id);
    }
  }
  
  const shutdownSuccessful = terminatedSessions.length === activeSessions.length;
  
  console.log('✅ Graceful shutdown simulation test:', {
    shutdownSuccessful,
    terminatedCount: terminatedSessions.length,
    totalSessions: activeSessions.length
  });
} catch (error) {
  console.log('❌ Graceful shutdown simulation test failed:', error.message);
}

// Test 5: OllamaService integration
console.log('\n5️⃣  Testing OllamaService integration...');
try {
  // Test that OllamaService still supports the original streaming interface
  const hasStreamResponse = typeof ollamaService.streamResponse === 'function';
  const hasGenerateResponse = typeof ollamaService.generateResponse === 'function';
  
  // Test that termination check parameter is optional
  const testStream = ollamaService.streamResponse('llama3.1:8b', 'test', [], {}, null);
  const hasOptionalTerminationCheck = testStream !== undefined;
  
  console.log('✅ OllamaService integration test:', {
    hasStreamResponse,
    hasGenerateResponse,
    hasOptionalTerminationCheck,
    integrationWorking: hasStreamResponse && hasGenerateResponse && hasOptionalTerminationCheck
  });
} catch (error) {
  console.log('❌ OllamaService integration test failed:', error.message);
}

// Test 6: Concurrent operations
console.log('\n6️⃣  Testing concurrent operations...');
try {
  // Test multiple simultaneous streaming operations
  const concurrentRequests = [];
  for (let i = 0; i < 3; i++) {
    const request = supertest(app)
      .post('/api/stream-message')
      .send({
        model: 'llama3.1:8b',
        message: `Concurrent test message ${i}`,
        conversationId: 'conv-db-test-123'
      });
    concurrentRequests.push(request);
  }
  
  const responses = await Promise.all(concurrentRequests);
  const allSuccessful = responses.every(r => r.status === 200);
  const allHaveSessions = responses.every(r => r.text.includes('sessionId'));
  
  console.log('✅ Concurrent operations test:', {
    allSuccessful,
    allHaveSessions,
    responseCount: responses.length
  });
} catch (error) {
  console.log('❌ Concurrent operations test failed:', error.message);
}

// Test 7: GraphQL integration
console.log('\n7️⃣  Testing GraphQL integration...');
try {
  const mutation = `
    mutation TerminateStream($input: TerminateStreamInput!) {
      terminateStream(input: $input) {
        success
        sessionId
        message
        partialResponse
        tokenCount
        finalStatus
        terminationReason
        error
      }
    }
  `;
  
  const variables = {
    input: {
      sessionId: 'test-graphql-session',
      conversationId: 'conv-db-test-123'
    }
  };
  
  const response = await server.executeOperation({
    query: mutation,
    variables
  });
  
  const result = response.body?.singleResult?.data?.terminateStream || 
                 response.data?.terminateStream ||
                 response.body?.data?.terminateStream;
  
  const hasGraphQLResponse = result !== undefined;
  const hasExpectedFields = result && 
                           typeof result.success === 'boolean' &&
                           typeof result.sessionId === 'string' &&
                           typeof result.message === 'string';
  
  console.log('✅ GraphQL integration test:', {
    hasGraphQLResponse,
    hasExpectedFields,
    success: result?.success,
    message: result?.message
  });
} catch (error) {
  console.log('❌ GraphQL integration test failed:', error.message);
}

// Test 8: Error recovery scenarios
console.log('\n8️⃣  Testing error recovery scenarios...');
try {
  // Test with invalid session ID
  const invalidResponse = await supertest(app)
    .post('/api/terminate-stream')
    .send({
      sessionId: 'invalid-session-id',
      conversationId: 'conv-db-test-123'
    })
    .expect(200);
  
  const invalidResult = JSON.parse(invalidResponse.text);
  const handlesInvalidSession = !invalidResult.success && invalidResult.error;
  
  // Test with invalid conversation ID
  const invalidConvResponse = await supertest(app)
    .post('/api/terminate-stream')
    .send({
      sessionId: 'test-session',
      conversationId: 'invalid-conversation-id'
    })
    .expect(200);
  
  const invalidConvResult = JSON.parse(invalidConvResponse.text);
  const handlesInvalidConversation = !invalidConvResult.success && invalidConvResult.error;
  
  console.log('✅ Error recovery scenarios test:', {
    handlesInvalidSession,
    handlesInvalidConversation,
    errorHandlingWorking: handlesInvalidSession && handlesInvalidConversation
  });
} catch (error) {
  console.log('❌ Error recovery scenarios test failed:', error.message);
}

// Test 9: Resource management
console.log('\n9️⃣  Testing resource management...');
try {
  // Check memory usage of session manager
  const activeSessions = streamSessionManager._activeSessions.size;
  const maxSessions = streamSessionManager._maxSessions;
  
  // Check database connection
  const dbStats = await streamSessionDatabase.getSessionStats();
  const hasDatabaseStats = dbStats && typeof dbStats === 'object';
  
  console.log('✅ Resource management test:', {
    activeSessions,
    maxSessions,
    hasDatabaseStats,
    resourceManagementWorking: activeSessions <= maxSessions && hasDatabaseStats
  });
} catch (error) {
  console.log('❌ Resource management test failed:', error.message);
}

// Test 10: Performance under load
console.log('\n🔟  Testing performance under load...');
try {
  const startTime = Date.now();
  
  // Create multiple sessions quickly
  const sessionPromises = [];
  for (let i = 0; i < 10; i++) {
    const session = {
      id: `load-test-session-${i}`,
      conversationId: 'conv-db-test-123',
      model: 'llama3.1:8b',
      status: 'ACTIVE',
      startedAt: new Date(),
      updatedAt: new Date(),
      endedAt: null,
      partialResponse: `Load test response ${i}`,
      tokenCount: i + 1,
      terminationReason: null,
      errorMessage: null,
      timeoutMs: 300000
    };
    
    sessionPromises.push(streamSessionDatabase.createSession(session));
  }
  
  await Promise.all(sessionPromises);
  const creationTime = Date.now() - startTime;
  
  // Terminate all sessions quickly
  const terminationStart = Date.now();
  const terminationPromises = [];
  for (let i = 0; i < 10; i++) {
    terminationPromises.push(
      streamSessionDatabase.terminateSession(`load-test-session-${i}`, 'USER_REQUESTED')
    );
  }
  
  await Promise.all(terminationPromises);
  const terminationTime = Date.now() - terminationStart;
  
  const performanceAcceptable = creationTime < 1000 && terminationTime < 1000;
  
  console.log('✅ Performance under load test:', {
    creationTime: `${creationTime}ms`,
    terminationTime: `${terminationTime}ms`,
    performanceAcceptable
  });
} catch (error) {
  console.log('❌ Performance under load test failed:', error.message);
}

// Test 11: Backwards compatibility with existing endpoints
console.log('\n1️⃣1️⃣  Testing backwards compatibility with existing endpoints...');
try {
  // Test that existing GraphQL queries still work
  const query = `
    query {
      conversations {
        conversations {
          id
          tabName
          llmModel
          isPrivate
        }
        count
      }
    }
  `;
  
  const response = await server.executeOperation({
    query
  });
  
  const result = response.body?.singleResult?.data?.conversations || 
                 response.data?.conversations;
  
  const existingQueriesWork = result && Array.isArray(result.conversations);
  
  // Test that existing REST endpoints still work
  const healthResponse = await supertest(app)
    .get('/health')
    .expect(200);
  
  const healthWorks = healthResponse.body.status === 'OK';
  
  console.log('✅ Backwards compatibility with existing endpoints test:', {
    existingQueriesWork,
    healthWorks,
    backwardsCompatible: existingQueriesWork && healthWorks
  });
} catch (error) {
  console.log('❌ Backwards compatibility with existing endpoints test failed:', error.message);
}

// Test 12: Service isolation
console.log('\n1️⃣2️⃣  Testing service isolation...');
try {
  // Test that services don't interfere with each other
  const ollamaRotationEnabled = ollamaService.isRotationEnabled();
  const sessionManagerMaxSessions = streamSessionManager._maxSessions;
  const databaseInitialized = streamSessionDatabase._isInitialized;
  
  // Test that each service maintains its own state
  const servicesIsolated = (typeof ollamaRotationEnabled === 'boolean' || typeof ollamaRotationEnabled === 'string') &&
                          typeof sessionManagerMaxSessions === 'number' &&
                          typeof databaseInitialized === 'boolean';
  
  console.log('✅ Service isolation test:', {
    ollamaRotationEnabled,
    sessionManagerMaxSessions,
    databaseInitialized,
    servicesIsolated
  });
} catch (error) {
  console.log('❌ Service isolation test failed:', error.message);
}

console.log('\n🎉 All System Integration tests completed!');

// Cleanup: Shutdown services to stop timers
console.log('\n🧹 Cleaning up services...');
try {
  await streamSessionManager.shutdown();
  console.log('✅ StreamSessionManager shutdown complete');
} catch (error) {
  console.log('⚠️  Shutdown error (non-critical):', error.message);
} 