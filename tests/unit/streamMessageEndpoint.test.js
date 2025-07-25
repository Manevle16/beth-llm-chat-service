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
    it('should reject missing required parameters', async () => {
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

    it('should reject invalid conversation ID', async () => {
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

  describe('Statistics', () => {
    it('should provide session statistics', async () => {
      const stats = await streamSessionDatabase.getSessionStats();
      
      expect(stats).toHaveProperty('totalSessions');
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('completedSessions');
      expect(stats).toHaveProperty('terminatedSessions');
      expect(stats).toHaveProperty('errorSessions');
    });

    it('should provide memory manager statistics', async () => {
      const stats = streamSessionManager.getSessionStats();
      
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('totalSessions');
      expect(stats).toHaveProperty('terminatedSessions');
      expect(stats).toHaveProperty('completedSessions');
    });
  });
}); 