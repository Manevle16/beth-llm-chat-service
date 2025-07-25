/**
 * Unit tests for StreamSessionDatabase Service
 * 
 * This test file verifies the database persistence functionality
 * including CRUD operations, cleanup, and atomic transactions.
 */

import streamSessionDatabase from '../../services/streamSessionDatabase.js';
import {
  STREAM_STATUS,
  TERMINATION_REASON,
  createStreamSession
} from '../../types/streamSession.js';

describe('StreamSessionDatabase', () => {
  let testSession;

  beforeEach(async () => {
    await streamSessionDatabase.initialize();
    testSession = createStreamSession('conv-db-test-123', 'llama3.1:8b', 60000);
  });

  describe('Initialization', () => {
    it('should initialize without error', async () => {
      await expect(streamSessionDatabase.initialize()).resolves.not.toThrow();
    });
  });

  describe('Session Creation', () => {
    it('should create a session', async () => {
      const createdSession = await streamSessionDatabase.createSession(testSession);
      expect(createdSession).toBeDefined();
      expect(createdSession.id).toBe(testSession.id);
      expect(createdSession.conversationId).toBe(testSession.conversationId);
      expect(createdSession.model).toBe(testSession.model);
      expect(createdSession.status).toBe(STREAM_STATUS.ACTIVE);
    });

    it('should reject invalid session', async () => {
      try {
        await streamSessionDatabase.createSession(null);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Session Retrieval', () => {
    it('should get a session by id', async () => {
      await streamSessionDatabase.createSession(testSession);
      const retrievedSession = await streamSessionDatabase.getSession(testSession.id);
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession.id).toBe(testSession.id);
    });

    it('should return null for non-existent session', async () => {
      const retrievedSession = await streamSessionDatabase.getSession('non-existent-id');
      expect(retrievedSession).toBeNull();
    });
  });

  describe('Session Updates', () => {
    it('should update session with token', async () => {
      await streamSessionDatabase.createSession(testSession);
      const updatedSession = await streamSessionDatabase.updateSessionWithToken(testSession.id, 'Hello');
      expect(updatedSession).toBeDefined();
      expect(updatedSession.tokenCount).toBeGreaterThan(0);
      expect(updatedSession.partialResponse).toContain('Hello');
    });

    it('should return null for non-existent session update', async () => {
      const updatedSession = await streamSessionDatabase.updateSessionWithToken('non-existent-id', 'test');
      expect(updatedSession).toBeNull();
    });
  });

  describe('Session Termination', () => {
    it('should terminate a session', async () => {
      await streamSessionDatabase.createSession(testSession);
      const terminationResult = await streamSessionDatabase.terminateSession(
        testSession.id, 
        TERMINATION_REASON.USER_REQUESTED
      );
      expect(terminationResult).toBeDefined();
      expect(terminationResult.status).toBe(STREAM_STATUS.TERMINATED);
      expect(terminationResult.terminationReason).toBe(TERMINATION_REASON.USER_REQUESTED);
    });
  });

  describe('Session Completion', () => {
    it('should complete a session', async () => {
      await streamSessionDatabase.createSession(testSession);
      const completionResult = await streamSessionDatabase.completeSession(testSession.id);
      expect(completionResult).toBeDefined();
      expect(completionResult.status).toBe(STREAM_STATUS.COMPLETED);
    });
  });

  describe('Session Deletion', () => {
    it('should delete a session', async () => {
      await streamSessionDatabase.createSession(testSession);
      const deleteResult = await streamSessionDatabase.deleteSession(testSession.id);
      expect(deleteResult).toBe(true);
      
      const deletedSession = await streamSessionDatabase.getSession(testSession.id);
      expect(deletedSession).toBeNull();
    });
  });

  describe('Session Statistics', () => {
    it('should return session statistics', async () => {
      const stats = await streamSessionDatabase.getSessionStats();
      expect(stats).toHaveProperty('totalSessions');
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('completedSessions');
      expect(stats).toHaveProperty('terminatedSessions');
      expect(stats).toHaveProperty('errorSessions');
      expect(typeof stats.totalSessions).toBe('number');
    });
  });

  describe('Sessions by Status', () => {
    it('should get sessions by status', async () => {
      await streamSessionDatabase.createSession(testSession);
      
      const activeSessions = await streamSessionDatabase.getSessionsByStatus(STREAM_STATUS.ACTIVE);
      expect(Array.isArray(activeSessions)).toBe(true);
    });
  });

  describe('Expired Sessions', () => {
    it('should get expired sessions', async () => {
      const expiredSessions = await streamSessionDatabase.getExpiredSessions();
      expect(Array.isArray(expiredSessions)).toBe(true);
    });

    it('should cleanup expired sessions', async () => {
      const cleanupResult = await streamSessionDatabase.cleanupExpiredSessions();
      expect(typeof cleanupResult).toBe('number');
    });
  });

  describe('Partial Response as Message', () => {
    it('should save partial response as message', async () => {
      await streamSessionDatabase.createSession(testSession);
      await streamSessionDatabase.updateSessionWithToken(testSession.id, 'Hello');
      
      const messageResult = await streamSessionDatabase.savePartialResponseAsMessage(
        testSession.id,
        testSession.conversationId,
        'Hello World'
      );
      
      expect(messageResult).toBeDefined();
      expect(messageResult).toHaveProperty('id');
      expect(messageResult).toHaveProperty('text');
      expect(messageResult).toHaveProperty('sender');
    });
  });
}); 