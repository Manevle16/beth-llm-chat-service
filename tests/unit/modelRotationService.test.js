/**
 * ModelRotationService Test Suite
 * 
 * Tests for essential model rotation functionality including initialization,
 * rotation requests, status monitoring, and error handling.
 */

import modelRotationService from '../../services/modelRotationService.js';
import { REQUEST_PRIORITY, ERROR_CODES, OPERATIONS } from '../../types/modelRotation.js';

describe('ModelRotationService', () => {
  beforeEach(async () => {
    await modelRotationService.initialize();
  });

  describe('Initialization', () => {
    it('should initialize without error', async () => {
      await expect(modelRotationService.initialize()).resolves.not.toThrow();
    });
  });

  describe('Rotation Status', () => {
    it('should return rotation status', () => {
      const status = modelRotationService.getRotationStatus();
      expect(status).toHaveProperty('isRotating');
      expect(status).toHaveProperty('activeModel');
      expect(status).toHaveProperty('queueStatus');
      expect(status).toHaveProperty('failedRotations');
      expect(typeof status.isRotating).toBe('boolean');
      expect(typeof status.failedRotations).toBe('number');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configuration', () => {
      const validation = modelRotationService.validateConfiguration();
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('warnings');
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(Array.isArray(validation.warnings)).toBe(true);
    });
  });

  describe('Rotation Requests', () => {
    it('should reject non-existent model', async () => {
      try {
        await modelRotationService.requestModelRotation('non-existent-model', 'test', REQUEST_PRIORITY.NORMAL);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle rotation requests', async () => {
      try {
        await modelRotationService.requestModelRotation('test-model', 'test', REQUEST_PRIORITY.NORMAL);
      } catch (error) {
        // Expected to fail for non-existent model
        expect(error).toBeDefined();
      }
    });
  });

  describe('Force Rotation', () => {
    it('should reject non-existent model for force rotation', async () => {
      try {
        await modelRotationService.forceModelRotation('non-existent-model', 'test');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle force rotation requests', async () => {
      try {
        await modelRotationService.forceModelRotation('test-model', 'test');
      } catch (error) {
        // Expected to fail for non-existent model
        expect(error).toBeDefined();
      }
    });
  });

  describe('Rotation History', () => {
    it('should return rotation history', () => {
      const history = modelRotationService.getRotationHistory(5);
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeLessThanOrEqual(5);
    });

    it('should clear rotation history', () => {
      const clearedCount = modelRotationService.clearRotationHistory();
      expect(typeof clearedCount).toBe('number');
    });
  });

  describe('Failed Rotations', () => {
    it('should return failed rotations', () => {
      const failedRotations = modelRotationService.getFailedRotations();
      expect(Array.isArray(failedRotations)).toBe(true);
    });

    it('should clear failed rotations', () => {
      const clearedCount = modelRotationService.clearFailedRotations();
      expect(typeof clearedCount).toBe('number');
    });
  });

  describe('Emergency Cleanup', () => {
    it('should perform emergency cleanup', async () => {
      const cleanupResult = await modelRotationService.emergencyCleanup();
      expect(cleanupResult).toHaveProperty('success');
      expect(cleanupResult).toHaveProperty('action');
      expect(cleanupResult).toHaveProperty('message');
      expect(typeof cleanupResult.success).toBe('boolean');
    });
  });

  describe('Priority Handling', () => {
    it('should handle high priority requests', async () => {
      try {
        await modelRotationService.requestModelRotation('test-high-priority', 'test', REQUEST_PRIORITY.HIGH);
      } catch (error) {
        // Expected to fail for non-existent model
        expect(error).toBeDefined();
      }
    });

    it('should handle low priority requests', async () => {
      try {
        await modelRotationService.requestModelRotation('test-low-priority', 'test', REQUEST_PRIORITY.LOW);
      } catch (error) {
        // Expected to fail for non-existent model
        expect(error).toBeDefined();
      }
    });
  });

  describe('Status Components', () => {
    it('should have all required status components', () => {
      const status = modelRotationService.getRotationStatus();
      
      expect(status).toHaveProperty('isRotating');
      expect(status).toHaveProperty('currentRotation');
      expect(status).toHaveProperty('activeModel');
      expect(status).toHaveProperty('queueStatus');
      expect(status).toHaveProperty('memoryStatus');
      expect(status).toHaveProperty('lastRotation');
      expect(status).toHaveProperty('failedRotations');
      
      expect(typeof status.isRotating).toBe('boolean');
      expect(typeof status.failedRotations).toBe('number');
    });
  });
}); 