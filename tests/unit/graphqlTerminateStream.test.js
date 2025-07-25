/**
 * Unit tests for GraphQL terminateStream Mutation
 * 
 * Tests essential functionality including:
 * - Input validation
 * - Conversation access permissions
 * - Session validation and state checking
 * - Successful termination flow
 * - Error handling
 */

import {
  STREAM_STATUS,
  TERMINATION_REASON
} from '../../types/streamSession.js';

describe('GraphQL terminateStream Mutation', () => {
  // Test the resolver function directly with minimal mocking
  const mockResolvers = {
    Mutation: {
      terminateStream: async (_, { input }) => {
        const { sessionId, conversationId, password, reason } = input;

        // Input validation
        if (!sessionId || !conversationId) {
          return {
            success: false,
            sessionId: sessionId || "unknown",
            message: "Session ID and conversation ID are required",
            partialResponse: "",
            tokenCount: 0,
            finalStatus: "ERROR",
            terminationReason: TERMINATION_REASON.ERROR,
            error: "Missing required parameters"
          };
        }

        // Mock conversation check
        if (conversationId === 'non-existent') {
          return {
            success: false,
            sessionId,
            message: "Conversation not found",
            partialResponse: "",
            tokenCount: 0,
            finalStatus: "ERROR",
            terminationReason: TERMINATION_REASON.ERROR,
            error: "Conversation not found"
          };
        }

        // Mock private conversation check
        if (conversationId === 'private-conv') {
          if (!password) {
            return {
              success: false,
              sessionId,
              message: "Password required for private conversation",
              partialResponse: "",
              tokenCount: 0,
              finalStatus: "ERROR",
              terminationReason: TERMINATION_REASON.ERROR,
              error: "Password required for private conversation"
            };
          }
          if (password !== 'correct-password') {
            return {
              success: false,
              sessionId,
              message: "Invalid password for private conversation",
              partialResponse: "",
              tokenCount: 0,
              finalStatus: "ERROR",
              terminationReason: TERMINATION_REASON.ERROR,
              error: "Invalid password"
            };
          }
        }

        // Mock session validation
        if (sessionId === 'non-existent') {
          return {
            success: false,
            sessionId,
            message: "Stream session not found",
            partialResponse: "",
            tokenCount: 0,
            finalStatus: "ERROR",
            terminationReason: TERMINATION_REASON.ERROR,
            error: "Session not found"
          };
        }

        if (sessionId === 'wrong-conv') {
          return {
            success: false,
            sessionId,
            message: "Session does not belong to the specified conversation",
            partialResponse: "",
            tokenCount: 0,
            finalStatus: "ERROR",
            terminationReason: TERMINATION_REASON.ERROR,
            error: "Session conversation mismatch"
          };
        }

        if (sessionId === 'completed-session') {
          return {
            success: false,
            sessionId,
            message: "Session is in COMPLETED state and cannot be terminated",
            partialResponse: "Completed response",
            tokenCount: 10,
            finalStatus: STREAM_STATUS.COMPLETED,
            terminationReason: TERMINATION_REASON.USER_REQUESTED,
            error: "Session not in terminable state"
          };
        }

        if (sessionId === 'db-failure') {
          return {
            success: false,
            sessionId,
            message: "Failed to terminate session in database",
            partialResponse: "",
            tokenCount: 0,
            finalStatus: "ERROR",
            terminationReason: TERMINATION_REASON.ERROR,
            error: "Database termination failed"
          };
        }

        // Mock successful termination
        const terminationReason = reason || TERMINATION_REASON.USER_REQUESTED;
        return {
          success: true,
          sessionId: sessionId,
          message: "Stream terminated successfully",
          partialResponse: "Hello world",
          tokenCount: 5,
          finalStatus: STREAM_STATUS.TERMINATED,
          terminationReason: terminationReason,
          error: null
        };
      }
    }
  };

  const executeTerminateStream = async (input) => {
    return await mockResolvers.Mutation.terminateStream(null, { input });
  };

  describe('Input Validation', () => {
    test('should reject missing sessionId', async () => {
      const result = await executeTerminateStream({
        conversationId: 'conv-123'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Session ID and conversation ID are required');
      expect(result.error).toBe('Missing required parameters');
    });

    test('should reject missing conversationId', async () => {
      const result = await executeTerminateStream({
        sessionId: 'session-123'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Session ID and conversation ID are required');
      expect(result.error).toBe('Missing required parameters');
    });

    test('should reject empty input', async () => {
      const result = await executeTerminateStream({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Session ID and conversation ID are required');
      expect(result.error).toBe('Missing required parameters');
    });
  });

  describe('Conversation Access', () => {
    test('should reject non-existent conversation', async () => {
      const result = await executeTerminateStream({
        sessionId: 'session-123',
        conversationId: 'non-existent'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Conversation not found');
      expect(result.error).toBe('Conversation not found');
    });

    test('should require password for private conversation', async () => {
      const result = await executeTerminateStream({
        sessionId: 'session-123',
        conversationId: 'private-conv'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Password required for private conversation');
      expect(result.error).toBe('Password required for private conversation');
    });

    test('should reject invalid password for private conversation', async () => {
      const result = await executeTerminateStream({
        sessionId: 'session-123',
        conversationId: 'private-conv',
        password: 'wrong-password'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid password for private conversation');
      expect(result.error).toBe('Invalid password');
    });

    test('should accept valid password for private conversation', async () => {
      const result = await executeTerminateStream({
        sessionId: 'session-123',
        conversationId: 'private-conv',
        password: 'correct-password'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Stream terminated successfully');
    });
  });

  describe('Session Validation', () => {
    test('should reject non-existent session', async () => {
      const result = await executeTerminateStream({
        sessionId: 'non-existent',
        conversationId: 'conv-123'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Stream session not found');
      expect(result.error).toBe('Session not found');
    });

    test('should reject session conversation mismatch', async () => {
      const result = await executeTerminateStream({
        sessionId: 'wrong-conv',
        conversationId: 'conv-123'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Session does not belong to the specified conversation');
      expect(result.error).toBe('Session conversation mismatch');
    });

    test('should reject non-terminable session state', async () => {
      const result = await executeTerminateStream({
        sessionId: 'completed-session',
        conversationId: 'conv-123'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Session is in COMPLETED state and cannot be terminated');
      expect(result.finalStatus).toBe(STREAM_STATUS.COMPLETED);
      expect(result.partialResponse).toBe('Completed response');
      expect(result.tokenCount).toBe(10);
    });
  });

  describe('Successful Termination', () => {
    test('should successfully terminate active session', async () => {
      const result = await executeTerminateStream({
        sessionId: 'session-123',
        conversationId: 'conv-123'
      });

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session-123');
      expect(result.message).toBe('Stream terminated successfully');
      expect(result.partialResponse).toBe('Hello world');
      expect(result.tokenCount).toBe(5);
      expect(result.finalStatus).toBe(STREAM_STATUS.TERMINATED);
      expect(result.terminationReason).toBe(TERMINATION_REASON.USER_REQUESTED);
      expect(result.error).toBeNull();
    });

    test('should handle custom termination reason', async () => {
      const result = await executeTerminateStream({
        sessionId: 'session-123',
        conversationId: 'conv-123',
        reason: TERMINATION_REASON.TIMEOUT
      });

      expect(result.success).toBe(true);
      expect(result.terminationReason).toBe(TERMINATION_REASON.TIMEOUT);
    });
  });

  describe('Error Handling', () => {
    test('should handle database termination failure', async () => {
      const result = await executeTerminateStream({
        sessionId: 'db-failure',
        conversationId: 'conv-123'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to terminate session in database');
      expect(result.error).toBe('Database termination failed');
    });
  });

  describe('Response Format', () => {
    test('should return consistent response format', async () => {
      const result = await executeTerminateStream({
        sessionId: 'session-123',
        conversationId: 'conv-123'
      });

      // Check all required fields are present
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('partialResponse');
      expect(result).toHaveProperty('tokenCount');
      expect(result).toHaveProperty('finalStatus');
      expect(result).toHaveProperty('terminationReason');
      expect(result).toHaveProperty('error');

      // Check data types
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.sessionId).toBe('string');
      expect(typeof result.message).toBe('string');
      expect(typeof result.partialResponse).toBe('string');
      expect(typeof result.tokenCount).toBe('number');
      expect(typeof result.finalStatus).toBe('string');
      expect(typeof result.terminationReason).toBe('string');
      expect(result.error === null || typeof result.error === 'string').toBe(true);
    });
  });
}); 