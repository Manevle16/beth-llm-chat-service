/**
 * Unit tests for GraphQL terminateStream Mutation
 * 
 * This test file verifies the GraphQL terminateStream mutation
 * including input validation, access control, and session management.
 */

import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import typeDefs from '../../schema/typeDefs.js';
import resolvers from '../../schema/resolvers.js';
import streamSessionDatabase from '../../services/streamSessionDatabase.js';
import streamSessionManager from '../../services/streamSessionManager.js';
import {
  STREAM_STATUS,
  TERMINATION_REASON,
  createStreamSession
} from '../../types/streamSession.js';

// Create test app
const app = express();
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => ({ req })
});

// Initialize Apollo Server
await server.start();
server.applyMiddleware({ app });

console.log('🧪 Testing GraphQL terminateStream Mutation...');

// Helper function to extract GraphQL response data
function extractGraphQLResult(response) {
  return response.body?.singleResult?.data?.terminateStream || 
         response.data?.terminateStream ||
         response.body?.data?.terminateStream ||
         null;
}

// Initialize services
console.log('\n🔧 Initializing services...');
try {
  await streamSessionDatabase.initialize();
  await streamSessionManager.initialize();
  console.log('✅ Services initialized successfully');
} catch (error) {
  console.log('❌ Service initialization failed:', error.message);
}

// Test 1: Basic successful termination
console.log('\n1️⃣  Testing basic successful termination...');
try {
  // Create a test session first
  const testSession = createStreamSession('conv-db-test-123', 'llama3.1:8b');
  testSession.partialResponse = 'Hello, this is a partial response';
  testSession.tokenCount = 5;
  
  await streamSessionDatabase.createSession(testSession);
  streamSessionManager.createSession(testSession.conversationId, testSession.model);
  
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
      sessionId: 'test-session-123',
      conversationId: 'conv-db-test-123'
    }
  };
  
  const response = await server.executeOperation({
    query: mutation,
    variables
  });
  
  // Handle different response structures
  const result = extractGraphQLResult(response);
  
  console.log('✅ Basic termination test:', {
    success: result.success,
    sessionId: result.sessionId,
    message: result.message,
    tokenCount: result.tokenCount,
    finalStatus: result.finalStatus
  });
} catch (error) {
  console.log('❌ Basic termination test failed:', error.message);
}

// Test 2: Missing required parameters
console.log('\n2️⃣  Testing missing required parameters...');
const missingParamTests = [
  {
    name: 'Missing sessionId',
    input: { conversationId: 'conv-db-test-123' },
    expectedError: 'Session ID and conversation ID are required'
  },
  {
    name: 'Missing conversationId',
    input: { sessionId: 'test-session-456' },
    expectedError: 'Session ID and conversation ID are required'
  },
  {
    name: 'Empty input',
    input: {},
    expectedError: 'Session ID and conversation ID are required'
  }
];

for (const testCase of missingParamTests) {
  try {
    const mutation = `
      mutation TerminateStream($input: TerminateStreamInput!) {
        terminateStream(input: $input) {
          success
          sessionId
          message
          error
        }
      }
    `;
    
    const response = await server.executeOperation({
      query: mutation,
      variables: { input: testCase.input }
    });
    
    const result = extractGraphQLResult(response);
    const hasExpectedError = result?.message?.includes(testCase.expectedError);
    
    console.log(`✅ ${testCase.name}: ${hasExpectedError ? 'PASSED' : 'FAILED'}`);
  } catch (error) {
    console.log(`❌ ${testCase.name} failed:`, error.message);
  }
}

// Test 3: Invalid conversation ID
console.log('\n3️⃣  Testing invalid conversation ID...');
try {
  const mutation = `
    mutation TerminateStream($input: TerminateStreamInput!) {
      terminateStream(input: $input) {
        success
        sessionId
        message
        error
      }
    }
  `;
  
  const variables = {
    input: {
      sessionId: 'test-session-789',
      conversationId: 'invalid-conversation-id'
    }
  };
  
  const response = await server.executeOperation({
    query: mutation,
    variables
  });
  
  const result = extractGraphQLResult(response);
  const hasError = result?.message?.includes('Conversation not found');
  
  console.log('✅ Invalid conversation ID test:', hasError);
} catch (error) {
  console.log('❌ Invalid conversation ID test failed:', error.message);
}

// Test 4: Session not found
console.log('\n4️⃣  Testing session not found...');
try {
  const mutation = `
    mutation TerminateStream($input: TerminateStreamInput!) {
      terminateStream(input: $input) {
        success
        sessionId
        message
        error
      }
    }
  `;
  
  const variables = {
    input: {
      sessionId: 'non-existent-session',
      conversationId: 'conv-db-test-123'
    }
  };
  
  const response = await server.executeOperation({
    query: mutation,
    variables
  });
  
  const result = extractGraphQLResult(response);
  const hasError = result?.message?.includes('Stream session not found');
  
  console.log('✅ Session not found test:', hasError);
} catch (error) {
  console.log('❌ Session not found test failed:', error.message);
}

// Test 5: Session conversation mismatch
console.log('\n5️⃣  Testing session conversation mismatch...');
try {
  // Create a session for a different conversation
  const mismatchSession = createStreamSession('conv-db-test-456', 'llama3.1:8b');
  mismatchSession.partialResponse = 'Test response';
  mismatchSession.tokenCount = 3;
  
  await streamSessionDatabase.createSession(mismatchSession);
  
  const mutation = `
    mutation TerminateStream($input: TerminateStreamInput!) {
      terminateStream(input: $input) {
        success
        sessionId
        message
        error
      }
    }
  `;
  
  const variables = {
    input: {
      sessionId: 'mismatch-session-123',
      conversationId: 'conv-db-test-123' // Different conversation
    }
  };
  
  const response = await server.executeOperation({
    query: mutation,
    variables
  });
  
  const result = extractGraphQLResult(response);
  const hasError = result?.message?.includes('Session does not belong to the specified conversation');
  
  console.log('✅ Session conversation mismatch test:', hasError);
} catch (error) {
  console.log('❌ Session conversation mismatch test failed:', error.message);
}

// Test 6: Session not in terminable state
console.log('\n6️⃣  Testing session not in terminable state...');
try {
  // Create a completed session
  const completedSession = createStreamSession('conv-db-test-123', 'llama3.1:8b');
  completedSession.status = STREAM_STATUS.COMPLETED;
  completedSession.partialResponse = 'Completed response';
  completedSession.tokenCount = 10;
  
  await streamSessionDatabase.createSession(completedSession);
  
  const mutation = `
    mutation TerminateStream($input: TerminateStreamInput!) {
      terminateStream(input: $input) {
        success
        sessionId
        message
        finalStatus
        error
      }
    }
  `;
  
  const variables = {
    input: {
      sessionId: 'completed-session-123',
      conversationId: 'conv-db-test-123'
    }
  };
  
  const response = await server.executeOperation({
    query: mutation,
    variables
  });
  
  const result = extractGraphQLResult(response);
  const hasError = result?.message?.includes('Session is in COMPLETED state and cannot be terminated');
  
  console.log('✅ Session not terminable test:', hasError);
} catch (error) {
  console.log('❌ Session not terminable test failed:', error.message);
}

// Test 7: Private conversation without password
console.log('\n7️⃣  Testing private conversation without password...');
try {
  const mutation = `
    mutation TerminateStream($input: TerminateStreamInput!) {
      terminateStream(input: $input) {
        success
        sessionId
        message
        error
      }
    }
  `;
  
  const variables = {
    input: {
      sessionId: 'test-session-123',
      conversationId: 'private-conversation-id'
    }
  };
  
  const response = await server.executeOperation({
    query: mutation,
    variables
  });
  
  const result = extractGraphQLResult(response);
  const hasError = result?.message?.includes('Password required for private conversation');
  
  console.log('✅ Private conversation without password test:', hasError);
} catch (error) {
  console.log('❌ Private conversation without password test failed:', error.message);
}

// Test 8: Private conversation with invalid password
console.log('\n8️⃣  Testing private conversation with invalid password...');
try {
  const mutation = `
    mutation TerminateStream($input: TerminateStreamInput!) {
      terminateStream(input: $input) {
        success
        sessionId
        message
        error
      }
    }
  `;
  
  const variables = {
    input: {
      sessionId: 'test-session-123',
      conversationId: 'private-conversation-id',
      password: 'wrong-password'
    }
  };
  
  const response = await server.executeOperation({
    query: mutation,
    variables
  });
  
  const result = extractGraphQLResult(response);
  const hasError = result?.message?.includes('Invalid password for private conversation');
  
  console.log('✅ Private conversation with invalid password test:', hasError);
} catch (error) {
  console.log('❌ Private conversation with invalid password test failed:', error.message);
}

// Test 9: Custom termination reason
console.log('\n9️⃣  Testing custom termination reason...');
try {
  // Create a test session
  const customReasonSession = createStreamSession('conv-db-test-123', 'llama3.1:8b');
  customReasonSession.partialResponse = 'Custom reason test';
  customReasonSession.tokenCount = 4;
  
  await streamSessionDatabase.createSession(customReasonSession);
  
  const mutation = `
    mutation TerminateStream($input: TerminateStreamInput!) {
      terminateStream(input: $input) {
        success
        sessionId
        message
        terminationReason
        error
      }
    }
  `;
  
  const variables = {
    input: {
      sessionId: 'custom-reason-session-123',
      conversationId: 'conv-db-test-123',
      reason: 'CUSTOM_REASON'
    }
  };
  
  const response = await server.executeOperation({
    query: mutation,
    variables
  });
  
  const result = extractGraphQLResult(response);
  const hasCustomReason = result?.terminationReason === 'CUSTOM_REASON';
  
  console.log('✅ Custom termination reason test:', hasCustomReason);
} catch (error) {
  console.log('❌ Custom termination reason test failed:', error.message);
}

// Test 10: Partial response saving
console.log('\n🔟  Testing partial response saving...');
try {
  // Create a session with substantial partial response
  const partialResponseSession = createStreamSession('conv-db-test-123', 'llama3.1:8b');
  partialResponseSession.partialResponse = 'This is a substantial partial response that should be saved as a message in the conversation.';
  partialResponseSession.tokenCount = 15;
  
  await streamSessionDatabase.createSession(partialResponseSession);
  
  const mutation = `
    mutation TerminateStream($input: TerminateStreamInput!) {
      terminateStream(input: $input) {
        success
        sessionId
        message
        partialResponse
        tokenCount
        finalStatus
        error
      }
    }
  `;
  
  const variables = {
    input: {
      sessionId: 'partial-response-session-123',
      conversationId: 'conv-db-test-123'
    }
  };
  
  const response = await server.executeOperation({
    query: mutation,
    variables
  });
  
  const result = extractGraphQLResult(response);
  const hasPartialResponse = result?.partialResponse && result.partialResponse.length > 0;
  
  console.log('✅ Partial response saving test:', {
    success: result.success,
    hasPartialResponse,
    tokenCount: result.tokenCount,
    finalStatus: result.finalStatus
  });
} catch (error) {
  console.log('❌ Partial response saving test failed:', error.message);
}

// Test 11: Error handling
console.log('\n1️⃣1️⃣  Testing error handling...');
try {
  // Test with invalid input that should cause an error
  const mutation = `
    mutation TerminateStream($input: TerminateStreamInput!) {
      terminateStream(input: $input) {
        success
        sessionId
        message
        error
      }
    }
  `;
  
  const variables = {
    input: {
      sessionId: null, // Invalid session ID
      conversationId: 'conv-db-test-123'
    }
  };
  
  const response = await server.executeOperation({
    query: mutation,
    variables
  });
  
  const result = extractGraphQLResult(response);
  const hasError = !result?.success && result?.error;
  
  console.log('✅ Error handling test:', {
    success: result.success,
    hasError,
    errorMessage: result.error
  });
} catch (error) {
  console.log('❌ Error handling test failed:', error.message);
}

// Test 12: Response format validation
console.log('\n1️⃣2️⃣  Testing response format validation...');
try {
  // Create a test session
  const formatTestSession = createStreamSession('conv-db-test-123', 'llama3.1:8b');
  formatTestSession.partialResponse = 'Format test response';
  formatTestSession.tokenCount = 6;
  
  await streamSessionDatabase.createSession(formatTestSession);
  
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
      sessionId: 'format-test-session-123',
      conversationId: 'conv-db-test-123'
    }
  };
  
  const response = await server.executeOperation({
    query: mutation,
    variables
  });
  
  const result = extractGraphQLResult(response);
  
  // Check all required fields are present
  const hasAllFields = result?.success !== undefined &&
                      result?.sessionId !== undefined &&
                      result?.message !== undefined &&
                      result?.partialResponse !== undefined &&
                      result?.tokenCount !== undefined &&
                      result?.finalStatus !== undefined &&
                      result?.terminationReason !== undefined &&
                      result?.error !== undefined;
  
  console.log('✅ Response format validation test:', {
    hasAllFields,
    success: result.success,
    sessionId: result.sessionId,
    tokenCount: result.tokenCount,
    finalStatus: result.finalStatus
  });
} catch (error) {
  console.log('❌ Response format validation test failed:', error.message);
}

// Test 13: Performance test
console.log('\n1️⃣3️⃣  Testing performance...');
try {
  const startTime = Date.now();
  
  // Create a test session
  const perfTestSession = createStreamSession('conv-db-test-123', 'llama3.1:8b');
  perfTestSession.partialResponse = 'Performance test response';
  perfTestSession.tokenCount = 8;
  
  await streamSessionDatabase.createSession(perfTestSession);
  
  const mutation = `
    mutation TerminateStream($input: TerminateStreamInput!) {
      terminateStream(input: $input) {
        success
        sessionId
        message
      }
    }
  `;
  
  const variables = {
    input: {
      sessionId: 'perf-test-session-123',
      conversationId: 'conv-db-test-123'
    }
  };
  
  const response = await server.executeOperation({
    query: mutation,
    variables
  });
  
  const duration = Date.now() - startTime;
  const result = extractGraphQLResult(response);
  
  console.log('✅ Performance test:', {
    duration: `${duration}ms`,
    success: result.success,
    acceptable: duration < 1000 // Should complete in under 1 second
  });
} catch (error) {
  console.log('❌ Performance test failed:', error.message);
}

// Test 14: Concurrent termination requests
console.log('\n1️⃣4️⃣  Testing concurrent termination requests...');
try {
  // Create multiple test sessions
  const concurrentSessions = [];
  for (let i = 0; i < 3; i++) {
    const session = createStreamSession('conv-db-test-123', 'llama3.1:8b');
    session.partialResponse = `Concurrent test response ${i}`;
    session.tokenCount = i + 1;
    
    await streamSessionDatabase.createSession(session);
    concurrentSessions.push(session);
  }
  
  const mutation = `
    mutation TerminateStream($input: TerminateStreamInput!) {
      terminateStream(input: $input) {
        success
        sessionId
        message
      }
    }
  `;
  
  // Execute concurrent termination requests
  const concurrentRequests = concurrentSessions.map(session => 
    server.executeOperation({
      query: mutation,
      variables: {
        input: {
          sessionId: session.id,
          conversationId: session.conversationId
        }
      }
    })
  );
  
  const responses = await Promise.all(concurrentRequests);
  const successCount = responses.filter(r => 
    extractGraphQLResult(r)?.success
  ).length;
  
  console.log('✅ Concurrent termination requests test:', {
    successCount,
    totalRequests: responses.length,
    allSuccessful: successCount === responses.length
  });
} catch (error) {
  console.log('❌ Concurrent termination requests test failed:', error.message);
}

// Test 15: Integration with session management
console.log('\n1️⃣5️⃣  Testing integration with session management...');
try {
  // Create a test session
  const integrationSession = createStreamSession('conv-db-test-123', 'llama3.1:8b');
  integrationSession.partialResponse = 'Integration test response';
  integrationSession.tokenCount = 7;
  
  await streamSessionDatabase.createSession(integrationSession);
  streamSessionManager.createSession(integrationSession.conversationId, integrationSession.model);
  
  // Check session exists in both managers
  const dbSession = await streamSessionDatabase.getSession(integrationSession.id);
  const memorySession = streamSessionManager.getSession(integrationSession.id);
  
  const mutation = `
    mutation TerminateStream($input: TerminateStreamInput!) {
      terminateStream(input: $input) {
        success
        sessionId
        message
        finalStatus
      }
    }
  `;
  
  const variables = {
    input: {
      sessionId: 'integration-test-session-123',
      conversationId: 'conv-db-test-123'
    }
  };
  
  const response = await server.executeOperation({
    query: mutation,
    variables
  });
  
  const result = extractGraphQLResult(response);
  
  // Check session was terminated in both managers
  const dbSessionAfter = await streamSessionDatabase.getSession(integrationSession.id);
  const memorySessionAfter = streamSessionManager.getSession(integrationSession.id);
  
  console.log('✅ Integration with session management test:', {
    success: result.success,
    finalStatus: result.finalStatus,
    dbSessionBefore: !!dbSession,
    memorySessionBefore: !!memorySession,
    dbSessionAfter: dbSessionAfter?.status,
    memorySessionAfter: memorySessionAfter?.status,
    integrationWorking: result.success && dbSessionAfter?.status === 'TERMINATED'
  });
} catch (error) {
  console.log('❌ Integration with session management test failed:', error.message);
}

console.log('\n🎉 All GraphQL terminateStream Mutation tests completed!');

// Cleanup: Shutdown services to stop timers
console.log('\n🧹 Cleaning up services...');
try {
  await streamSessionManager.shutdown();
  console.log('✅ StreamSessionManager shutdown complete');
} catch (error) {
  console.log('⚠️  Shutdown error (non-critical):', error.message);
} 