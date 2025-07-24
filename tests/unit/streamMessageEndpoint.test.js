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

describe('Stream Message Endpoint', () => {
  beforeAll(async () => {
    // Initialize services
    await streamSessionDatabase.initialize();
    await streamSessionManager.initialize();
  });

  afterAll(async () => {
    // Cleanup
    await streamSessionManager.shutdown();
  });

  describe('Parameter Validation', () => {
    test('should reject missing required parameters', async () => {
      const testCases = [
        { body: {}, expectedError: 'Missing model, message, or conversationId' },
        { body: { model: 'test' }, expectedError: 'Missing model, message, or conversationId' },
        { body: { message: 'test' }, expectedError: 'Missing model, message, or conversationId' },
        { body: { conversationId: 'test' }, expectedError: 'Missing model, message, or conversationId' }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/stream-message')
          .send(testCase.body)
          .expect(200); // SSE returns 200 even for errors
        
        expect(response.text).toContain(testCase.expectedError);
      }
    });

    test('should reject invalid conversation ID', async () => {
      const response = await request(app)
        .post('/api/stream-message')
        .send({
          model: 'llama3.1:8b',
          message: 'Hello',
          conversationId: 'invalid-conversation-id'
        })
        .expect(200);
      
      expect(response.text).toContain('Conversation not found');
    });
  });

  describe('Response Format', () => {
    test('should return valid SSE format for valid request', async () => {
      const response = await request(app)
        .post('/api/stream-message')
        .send({
          model: 'llama3.1:8b',
          message: 'Test response format',
          conversationId: 'conv-db-test-123'
        })
        .expect(200);
      
      // Check for required SSE events
      expect(response.text).toContain('event: session');
      expect(response.text).toContain('data: ');
      expect(response.text).toContain('event: end');
    });

    test('should include session ID in response', async () => {
      const response = await request(app)
        .post('/api/stream-message')
        .send({
          model: 'llama3.1:8b',
          message: 'Test session ID',
          conversationId: 'conv-db-test-123'
        })
        .expect(200);
      
      // Extract session ID from response
      const sessionMatch = response.text.match(/event: session\ndata: ({[^}]+})/);
      expect(sessionMatch).toBeTruthy();
      
      const sessionData = JSON.parse(sessionMatch[1]);
      expect(sessionData).toHaveProperty('sessionId');
      expect(typeof sessionData.sessionId).toBe('string');
    });
  });

  describe('Statistics', () => {
    test('should provide session statistics', async () => {
      const stats = await streamSessionDatabase.getSessionStats();
      
      expect(stats).toHaveProperty('totalSessions');
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('completedSessions');
      expect(stats).toHaveProperty('terminatedSessions');
      expect(stats).toHaveProperty('errorSessions');
    });

    test('should provide memory manager statistics', async () => {
      const stats = streamSessionManager.getSessionStats();
      
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('totalSessions');
      expect(stats).toHaveProperty('terminatedSessions');
      expect(stats).toHaveProperty('completedSessions');
    });
  });
}); 