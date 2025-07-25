/**
 * Jest tests for Stream Termination Endpoint
 * Covers essential functionality: parameter validation, permissions, session management, and error handling.
 */

import request from 'supertest';
import express from 'express';
import streamRoutes from '../../routes/stream.js';
import streamSessionDatabase from '../../services/streamSessionDatabase.js';
import streamSessionManager from '../../services/streamSessionManager.js';
import pool from '../../config/database.js';
import {
  STREAM_STATUS,
  TERMINATION_REASON,
  createStreamSession
} from '../../types/streamSession.js';

// Create test app
const app = express();
app.use(express.json());
app.use('/api', streamRoutes);

describe('Stream Termination Endpoint', () => {
  beforeEach(async () => {
    // Initialize services for each test
    await streamSessionDatabase.initialize();
    await streamSessionManager.initialize();
  });

  afterEach(async () => {
    // Cleanup after each test
    await streamSessionManager.shutdown();
  });

  test('should return 400 for missing required parameters', async () => {
    const testCases = [
      { body: {}, expectedError: 'sessionId and conversationId' },
      { body: { sessionId: 'test' }, expectedError: 'sessionId and conversationId' },
      { body: { conversationId: 'test' }, expectedError: 'sessionId and conversationId' }
    ];

    for (const testCase of testCases) {
      const response = await request(app)
        .post('/api/terminate-stream')
        .send(testCase.body)
        .expect(400);
      
      expect(response.body.error).toContain(testCase.expectedError);
    }
  });

  test('should return 404 for non-existent conversation', async () => {
    const response = await request(app)
      .post('/api/terminate-stream')
      .send({
        sessionId: 'test-session-id',
        conversationId: 'non-existent-conversation'
      })
      .expect(404);
    
    expect(response.body.error).toBe('Conversation not found');
  });

  test('should return 404 for non-existent session', async () => {
    // Create a conversation in the database first
    await pool.query(`
      INSERT INTO conversations (id, tab_name, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, ['conv-123', 'Test Conversation']);

    const response = await request(app)
      .post('/api/terminate-stream')
      .send({
        sessionId: 'non-existent-session',
        conversationId: 'conv-123'
      })
      .expect(404);
    
    expect(response.body.error).toBe('Session not found');
    
    // Cleanup
    await pool.query('DELETE FROM conversations WHERE id = $1', ['conv-123']);
  });

  test('should return 403 for session conversation mismatch', async () => {
    // Create conversations in the database
    await pool.query(`
      INSERT INTO conversations (id, tab_name, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW()), ($3, $4, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, ['conv-123', 'Test Conversation 1', 'conv-456', 'Test Conversation 2']);

    // Create session for different conversation
    const testSession = createStreamSession('conv-456', 'test-model');
    await streamSessionDatabase.createSession(testSession);

    const response = await request(app)
      .post('/api/terminate-stream')
      .send({
        sessionId: testSession.id,
        conversationId: 'conv-123' // Different conversation
      })
      .expect(403);
    
    expect(response.body.error).toBe('Session conversation mismatch');
    
    // Cleanup
    await streamSessionDatabase.deleteSession(testSession.id);
    await pool.query('DELETE FROM conversations WHERE id IN ($1, $2)', ['conv-123', 'conv-456']);
  });

  test('should return 400 for non-terminable session', async () => {
    // Create conversation in the database
    await pool.query(`
      INSERT INTO conversations (id, tab_name, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, ['conv-123', 'Test Conversation']);

    // Create and terminate session
    const testSession = createStreamSession('conv-123', 'test-model');
    await streamSessionDatabase.createSession(testSession);
    await streamSessionDatabase.terminateSession(testSession.id, TERMINATION_REASON.USER_REQUESTED);

    const response = await request(app)
      .post('/api/terminate-stream')
      .send({
        sessionId: testSession.id,
        conversationId: 'conv-123'
      })
      .expect(400);
    
    expect(response.body.error).toBe('Session not terminable');
    
    // Cleanup
    await streamSessionDatabase.deleteSession(testSession.id);
    await pool.query('DELETE FROM conversations WHERE id = $1', ['conv-123']);
  });

  test('should successfully terminate active session', async () => {
    // Create conversation in the database
    await pool.query(`
      INSERT INTO conversations (id, tab_name, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, ['conv-123', 'Test Conversation']);

    // Create active session
    const testSession = createStreamSession('conv-123', 'test-model');
    await streamSessionDatabase.createSession(testSession);
    
    // Add some tokens
    await streamSessionDatabase.updateSessionWithToken(testSession.id, 'Hello');
    await streamSessionDatabase.updateSessionWithToken(testSession.id, ' World');

    const response = await request(app)
      .post('/api/terminate-stream')
      .send({
        sessionId: testSession.id,
        conversationId: 'conv-123'
      })
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.sessionId).toBe(testSession.id);
    expect(response.body.terminationReason).toBe(TERMINATION_REASON.USER_REQUESTED);
    expect(response.body.finalStatus).toBe(STREAM_STATUS.TERMINATED);
    expect(response.body.tokenCount).toBe(2);
    expect(response.body.partialResponse).toContain('Hello World');
    
    // Cleanup
    await streamSessionDatabase.deleteSession(testSession.id);
    await pool.query('DELETE FROM conversations WHERE id = $1', ['conv-123']);
  });

  test('should handle custom termination reason', async () => {
    // Create conversation in the database
    await pool.query(`
      INSERT INTO conversations (id, tab_name, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, ['conv-123', 'Test Conversation']);

    // Create active session
    const testSession = createStreamSession('conv-123', 'test-model');
    await streamSessionDatabase.createSession(testSession);

    const response = await request(app)
      .post('/api/terminate-stream')
      .send({
        sessionId: testSession.id,
        conversationId: 'conv-123',
        reason: TERMINATION_REASON.TIMEOUT
      })
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.terminationReason).toBe(TERMINATION_REASON.TIMEOUT);
    
    // Cleanup
    await streamSessionDatabase.deleteSession(testSession.id);
    await pool.query('DELETE FROM conversations WHERE id = $1', ['conv-123']);
  });

  test('should require password for private conversation', async () => {
    // Create private conversation in the database
    await pool.query(`
      INSERT INTO conversations (id, tab_name, is_private, password_hash, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, ['conv-123', 'Private Conversation', true, 'hashed-password']);

    const response = await request(app)
      .post('/api/terminate-stream')
      .send({
        sessionId: 'test-session-id',
        conversationId: 'conv-123'
        // No password provided
      })
      .expect(401);
    
    expect(response.body.error).toBe('Password required');
    
    // Cleanup
    await pool.query('DELETE FROM conversations WHERE id = $1', ['conv-123']);
  });

  test('should validate password for private conversation', async () => {
    // Create private conversation in the database
    await pool.query(`
      INSERT INTO conversations (id, tab_name, is_private, password_hash, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, ['conv-123', 'Private Conversation', true, 'correct-password']);

    const response = await request(app)
      .post('/api/terminate-stream')
      .send({
        sessionId: 'test-session-id',
        conversationId: 'conv-123',
        password: 'wrong-password'
      })
      .expect(401);
    
    expect(response.body.error).toBe('Invalid password');
    
    // Cleanup
    await pool.query('DELETE FROM conversations WHERE id = $1', ['conv-123']);
  });

  test('should handle malformed JSON', async () => {
    const response = await request(app)
      .post('/api/terminate-stream')
      .set('Content-Type', 'application/json')
      .send('invalid json')
      .expect(400);
    
    expect(response.status).toBe(400);
  });

  test('should return proper response format', async () => {
    // Create conversation in the database
    await pool.query(`
      INSERT INTO conversations (id, tab_name, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, ['conv-123', 'Test Conversation']);

    // Create active session
    const testSession = createStreamSession('conv-123', 'test-model');
    await streamSessionDatabase.createSession(testSession);

    const response = await request(app)
      .post('/api/terminate-stream')
      .send({
        sessionId: testSession.id,
        conversationId: 'conv-123'
      })
      .expect(200);
    
    // Validate response format
    const requiredFields = [
      'success', 'sessionId', 'message', 'partialResponse', 
      'tokenCount', 'finalStatus', 'terminationReason', 'timestamp'
    ];
    
    requiredFields.forEach(field => {
      expect(response.body).toHaveProperty(field);
    });
    
    expect(typeof response.body.success).toBe('boolean');
    expect(typeof response.body.sessionId).toBe('string');
    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.partialResponse).toBe('string');
    expect(typeof response.body.tokenCount).toBe('number');
    expect(typeof response.body.finalStatus).toBe('string');
    expect(typeof response.body.terminationReason).toBe('string');
    expect(typeof response.body.timestamp).toBe('string');
    
    // Cleanup
    await streamSessionDatabase.deleteSession(testSession.id);
    await pool.query('DELETE FROM conversations WHERE id = $1', ['conv-123']);
  });
}); 