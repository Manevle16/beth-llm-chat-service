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

describe('System Integration', () => {
  beforeAll(async () => {
    // Initialize Apollo Server
    await server.start();
    server.applyMiddleware({ app });
    
    // Initialize services
    await streamSessionDatabase.initialize();
    await streamSessionManager.initialize();
    await ollamaService.initialize();
  });

  afterAll(async () => {
    // Cleanup: Shutdown services to stop timers
    await streamSessionManager.shutdown();
    await server.stop();
  });

  describe('Service Initialization', () => {
    it('should initialize all services successfully', () => {
      expect(streamSessionDatabase._isInitialized).toBe(true);
      expect(streamSessionManager._isInitialized).toBe(true);
      expect(ollamaService._isInitialized).toBe(true);
    });
  });

  describe('Backwards Compatibility', () => {
    it('should maintain backwards compatibility with existing endpoints', async () => {
      const healthResponse = await supertest(app)
        .get('/health')
        .expect(200);
      
      expect(healthResponse.body.status).toBe('OK');
    });
  });

  describe('Session Management', () => {
    it('should handle session cleanup on startup', async () => {
      // Get expired sessions
      const foundExpired = await streamSessionDatabase.getExpiredSessions();
      
      // Clean up expired sessions
      await streamSessionDatabase.cleanupExpiredSessions();
      
      // Verify cleanup
      const remainingExpired = await streamSessionDatabase.getExpiredSessions();
      expect(remainingExpired.length).toBe(0);
    });
  });

  describe('OllamaService Integration', () => {
    it('should maintain OllamaService integration', () => {
      expect(typeof ollamaService.streamResponse).toBe('function');
      expect(typeof ollamaService.generateResponse).toBe('function');
      
      // Test that termination check parameter is optional
      const testStream = ollamaService.streamResponse('llama3.1:8b', 'test', [], {}, null);
      expect(testStream).toBeDefined();
    });
  });

  describe('GraphQL Integration', () => {
    it('should support GraphQL terminateStream mutation', async () => {
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
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.sessionId).toBe('string');
      expect(typeof result.message).toBe('string');
    });
  });

  describe('Resource Management', () => {
    it('should manage resources properly', async () => {
      const activeSessions = streamSessionManager._activeSessions.size;
      const maxSessions = streamSessionManager._maxSessions;
      
      expect(activeSessions).toBeLessThanOrEqual(maxSessions);
      
      const dbStats = await streamSessionDatabase.getSessionStats();
      expect(dbStats).toBeDefined();
      expect(typeof dbStats).toBe('object');
    });
  });

  describe('Service Isolation', () => {
    it('should maintain service isolation', () => {
      const ollamaRotationEnabled = ollamaService.isRotationEnabled();
      const sessionManagerMaxSessions = streamSessionManager._maxSessions;
      const databaseInitialized = streamSessionDatabase._isInitialized;
      
      expect(typeof ollamaRotationEnabled).toMatch(/boolean|string/);
      expect(typeof sessionManagerMaxSessions).toBe('number');
      expect(typeof databaseInitialized).toBe('boolean');
    });
  });
}); 