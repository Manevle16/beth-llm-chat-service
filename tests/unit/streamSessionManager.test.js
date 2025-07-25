/**
 * Jest tests for StreamSessionManager
 * Covers essential functionality: initialization, session management, state updates, error handling, and cleanup.
 */

import streamSessionManager from '../../services/streamSessionManager.js';
import {
  STREAM_STATUS,
  TERMINATION_REASON
} from '../../types/streamSession.js';

describe('StreamSessionManager', () => {
  beforeEach(async () => {
    // Reset state for each test
    if (streamSessionManager._isInitialized) {
      await streamSessionManager.shutdown();
      streamSessionManager._isInitialized = false;
      streamSessionManager._activeSessions.clear();
    }
  });

  afterAll(async () => {
    // Cleanup after all tests
    if (streamSessionManager._isInitialized) {
      await streamSessionManager.shutdown();
    }
  });

  test('should initialize and set up configuration', async () => {
    await streamSessionManager.initialize();
    expect(streamSessionManager._isInitialized).toBe(true);
    expect(streamSessionManager._maxSessions).toBeGreaterThan(0);
    expect(streamSessionManager._defaultTimeout).toBeGreaterThan(0);
  });

  test('should create and retrieve sessions', async () => {
    await streamSessionManager.initialize();
    const session = await streamSessionManager.createSession('conv-123', 'test-model', 60000);
    expect(session).toHaveProperty('id');
    expect(session.conversationId).toBe('conv-123');
    expect(session.model).toBe('test-model');
    expect(session.status).toBe(STREAM_STATUS.ACTIVE);
    
    const retrieved = streamSessionManager.getSession(session.id);
    expect(retrieved).toEqual(session);
  });

  test('should update session with tokens', async () => {
    await streamSessionManager.initialize();
    const session = await streamSessionManager.createSession('conv-123', 'test-model');
    const updated = streamSessionManager.updateSessionWithToken(session.id, 'Hello');
    expect(updated.tokenCount).toBe(1);
    expect(updated.partialResponse).toContain('Hello');
  });

  test('should get sessions for conversation', async () => {
    await streamSessionManager.initialize();
    const session1 = await streamSessionManager.createSession('conv-123', 'model1');
    const session2 = await streamSessionManager.createSession('conv-123', 'model2');
    const session3 = await streamSessionManager.createSession('conv-456', 'model3');
    
    const convSessions = streamSessionManager.getSessionsForConversation('conv-123');
    expect(convSessions).toHaveLength(2);
    expect(convSessions.map(s => s.id)).toContain(session1.id);
    expect(convSessions.map(s => s.id)).toContain(session2.id);
  });

  test('should complete sessions', async () => {
    await streamSessionManager.initialize();
    const session = await streamSessionManager.createSession('conv-123', 'test-model');
    const result = streamSessionManager.completeSession(session.id);
    
    expect(result).toBeTruthy();
    expect(result.status).toBe(STREAM_STATUS.COMPLETED);
    
    const completed = streamSessionManager.getSession(session.id);
    expect(completed.status).toBe(STREAM_STATUS.COMPLETED);
  });

  test('should remove sessions', async () => {
    await streamSessionManager.initialize();
    const session = await streamSessionManager.createSession('conv-123', 'test-model');
    const result = streamSessionManager.removeSession(session.id);
    
    expect(result).toBe(true);
    const removed = streamSessionManager.getSession(session.id);
    expect(removed).toBeNull();
  });

  test('should handle invalid session operations', async () => {
    await streamSessionManager.initialize();
    
    // Invalid session get
    const invalidSession = streamSessionManager.getSession('invalid-id');
    expect(invalidSession).toBeNull();
    
    // Invalid session update
    const invalidUpdate = streamSessionManager.updateSessionWithToken('invalid-id', 'test');
    expect(invalidUpdate).toBeNull();
  });

  test('should reject invalid inputs for session creation', async () => {
    await streamSessionManager.initialize();
    
    // Empty conversation ID
    await expect(streamSessionManager.createSession('', 'test-model')).rejects.toThrow('Invalid conversation ID');
    
    // Empty model name
    await expect(streamSessionManager.createSession('conv-123', '')).rejects.toThrow('Invalid model name');
  });

  test('should provide session statistics', async () => {
    await streamSessionManager.initialize();
    const session1 = await streamSessionManager.createSession('conv-123', 'model1');
    const session2 = await streamSessionManager.createSession('conv-456', 'model2');
    
    streamSessionManager.completeSession(session2.id);
    
    const stats = streamSessionManager.getSessionStats();
    expect(stats).toHaveProperty('activeSessions');
    expect(stats).toHaveProperty('totalSessions');
    expect(stats).toHaveProperty('terminatedSessions');
    expect(stats).toHaveProperty('completedSessions');
    expect(stats).toHaveProperty('utilization');
  });

  test('should provide status summary', async () => {
    await streamSessionManager.initialize();
    const status = streamSessionManager.getStatusSummary();
    
    expect(status).toHaveProperty('isInitialized');
    expect(status).toHaveProperty('activeSessionCount');
    expect(status).toHaveProperty('maxSessions');
    expect(status).toHaveProperty('utilization');
    expect(status.isInitialized).toBe(true);
  });

  test('should handle session limits', async () => {
    await streamSessionManager.initialize();
    const maxSessions = streamSessionManager._maxSessions;
    
    // Create sessions up to limit
    const sessions = [];
    for (let i = 0; i < maxSessions; i++) {
      const session = await streamSessionManager.createSession(`conv-${i}`, 'test-model');
      sessions.push(session);
    }
    
    expect(streamSessionManager.getAllActiveSessions()).toHaveLength(maxSessions);
    
    // Try to create one more - should fail
    await expect(streamSessionManager.createSession('conv-overflow', 'test-model'))
      .rejects.toThrow('Maximum number of active sessions');
  });

  test('should handle terminateSession method exists', async () => {
    await streamSessionManager.initialize();
    const session = await streamSessionManager.createSession('conv-123', 'test-model');
    
    // Just verify the method exists and can be called without throwing
    expect(typeof streamSessionManager.terminateSession).toBe('function');
    expect(() => streamSessionManager.terminateSession(session.id)).not.toThrow();
  });

  test('should handle cleanupExpiredSessions method exists', async () => {
    await streamSessionManager.initialize();
    
    // Just verify the method exists and can be called without throwing
    expect(typeof streamSessionManager.cleanupExpiredSessions).toBe('function');
    expect(() => streamSessionManager.cleanupExpiredSessions()).not.toThrow();
  });
}); 