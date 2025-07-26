/**
 * QueueService Test Suite
 * 
 * Tests for essential queue management functionality including enqueueing,
 * priority processing, deduplication, and status monitoring.
 */

import queueService from '../../services/queueService.js';
import { REQUEST_PRIORITY } from '../../types/modelRotation.js';

describe('QueueService', () => {
  const provider = 'ollama';
  const otherProvider = 'huggingface';

  beforeEach(async () => {
    await queueService.initialize();
    await queueService.clearQueue();
  });

  describe('Initialization', () => {
    it('should initialize without error', async () => {
      await expect(queueService.initialize()).resolves.not.toThrow();
    });
  });

  describe('Queue Status', () => {
    it('should return initial queue status', () => {
      const status = queueService.getQueueStatus();
      expect(status).toHaveProperty('size');
      expect(status).toHaveProperty('maxSize');
      expect(status).toHaveProperty('isProcessing');
      expect(status).toHaveProperty('utilization');
      expect(typeof status.size).toBe('number');
      expect(['number', 'string']).toContain(typeof status.maxSize);
      expect(typeof status.isProcessing).toBe('boolean');
    });
  });

  describe('Enqueue Operations', () => {
    it('should enqueue normal priority request', async () => {
      const result = await queueService.enqueueRotationRequest({ provider, modelName: 'test-model-1' }, 'graphql', REQUEST_PRIORITY.NORMAL);
      expect(result).toBe(true);
      const status = queueService.getQueueStatus();
      expect(status.size).toBe(1);
    });
    it('should enqueue high priority request', async () => {
      const result = await queueService.enqueueRotationRequest({ provider, modelName: 'test-model-2' }, 'stream', REQUEST_PRIORITY.HIGH);
      expect(result).toBe(true);
      const status = queueService.getQueueStatus();
      expect(status.size).toBe(1);
    });
    it('should enqueue low priority request', async () => {
      const result = await queueService.enqueueRotationRequest({ provider, modelName: 'test-model-3' }, 'api', REQUEST_PRIORITY.LOW);
      expect(result).toBe(true);
      const status = queueService.getQueueStatus();
      expect(status.size).toBe(1);
    });
    it('should reject invalid modelRef', async () => {
      await expect(
        queueService.enqueueRotationRequest({}, 'test', REQUEST_PRIORITY.NORMAL)
      ).rejects.toThrow('Invalid modelRef provided');
    });
    it('should reject invalid source', async () => {
      await expect(
        queueService.enqueueRotationRequest({ provider, modelName: 'test-model' }, '', REQUEST_PRIORITY.NORMAL)
      ).rejects.toThrow('Invalid source provided');
    });
    it('should reject invalid priority', async () => {
      await expect(
        queueService.enqueueRotationRequest({ provider, modelName: 'test-model' }, 'test', 'invalid-priority')
      ).rejects.toThrow('Invalid priority level provided');
    });
  });

  describe('Deduplication', () => {
    it('should handle duplicate requests', async () => {
      // Enqueue first request
      const result1 = await queueService.enqueueRotationRequest({ provider, modelName: 'test-model' }, 'graphql', REQUEST_PRIORITY.NORMAL);
      expect(result1).toBe(true);
      // Enqueue duplicate request
      const result2 = await queueService.enqueueRotationRequest({ provider, modelName: 'test-model' }, 'graphql', REQUEST_PRIORITY.HIGH);
      expect(result2).toBe(true);
      // Queue size should remain 1
      const status = queueService.getQueueStatus();
      expect(status.size).toBe(1);
    });
    it('should allow same modelName for different providers', async () => {
      await queueService.enqueueRotationRequest({ provider, modelName: 'shared-model' }, 'graphql', REQUEST_PRIORITY.NORMAL);
      await queueService.enqueueRotationRequest({ provider: otherProvider, modelName: 'shared-model' }, 'graphql', REQUEST_PRIORITY.NORMAL);
      const contents = queueService.getQueueContents();
      expect(contents.length).toBe(2);
      expect(contents.some(r => r.provider === provider && r.modelName === 'shared-model')).toBe(true);
      expect(contents.some(r => r.provider === otherProvider && r.modelName === 'shared-model')).toBe(true);
    });
  });

  describe('Queue Contents', () => {
    it('should return queue contents', async () => {
      await queueService.enqueueRotationRequest({ provider, modelName: 'test-model' }, 'test', REQUEST_PRIORITY.NORMAL);
      const contents = queueService.getQueueContents();
      expect(Array.isArray(contents)).toBe(true);
      expect(contents.length).toBe(1);
      expect(contents[0]).toHaveProperty('provider', provider);
      expect(contents[0]).toHaveProperty('modelName', 'test-model');
      expect(contents[0]).toHaveProperty('priority', REQUEST_PRIORITY.NORMAL);
    });
  });

  describe('Peek Operations', () => {
    it('should peek next request', async () => {
      await queueService.enqueueRotationRequest({ provider, modelName: 'test-model' }, 'test', REQUEST_PRIORITY.NORMAL);
      const nextRequest = queueService.peekNextRequest();
      expect(nextRequest).toBeTruthy();
      expect(nextRequest.provider).toBe(provider);
      expect(nextRequest.modelName).toBe('test-model');
    });
    it('should return null when queue is empty', () => {
      const nextRequest = queueService.peekNextRequest();
      expect(nextRequest).toBeNull();
    });
  });

  describe('Priority Ordering', () => {
    it('should order requests by priority', async () => {
      // Add requests in different order
      await queueService.enqueueRotationRequest({ provider, modelName: 'low-priority' }, 'test', REQUEST_PRIORITY.LOW);
      await queueService.enqueueRotationRequest({ provider, modelName: 'high-priority' }, 'test', REQUEST_PRIORITY.HIGH);
      await queueService.enqueueRotationRequest({ provider, modelName: 'normal-priority' }, 'test', REQUEST_PRIORITY.NORMAL);
      const contents = queueService.getQueueContents();
      expect(contents.length).toBe(3);
      // High priority should be first
      expect(contents[0].priority).toBe(REQUEST_PRIORITY.HIGH);
      expect(contents[0].modelName).toBe('high-priority');
    });
  });

  describe('Queue Management', () => {
    it('should remove specific request', async () => {
      await queueService.enqueueRotationRequest({ provider, modelName: 'test-model' }, 'test', REQUEST_PRIORITY.NORMAL);
      const contents = queueService.getQueueContents();
      const requestToRemove = contents[0];
      const removed = queueService.removeRequest(requestToRemove.id);
      expect(removed).toBe(true);
      const newContents = queueService.getQueueContents();
      expect(newContents.length).toBe(0);
    });
    it('should clear queue', async () => {
      await queueService.enqueueRotationRequest({ provider, modelName: 'test-model-1' }, 'test', REQUEST_PRIORITY.NORMAL);
      await queueService.enqueueRotationRequest({ provider, modelName: 'test-model-2' }, 'test', REQUEST_PRIORITY.HIGH);
      const clearedCount = await queueService.clearQueue();
      expect(clearedCount).toBe(2);
      const status = queueService.getQueueStatus();
      expect(status.size).toBe(0);
    });
  });

  describe('Queue Statistics', () => {
    it('should return queue statistics', () => {
      const stats = queueService.getQueueStats();
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('currentQueueSize');
      expect(stats).toHaveProperty('maxQueueSize');
      expect(stats).toHaveProperty('utilization');
      expect(stats).toHaveProperty('isProcessing');
      expect(stats).toHaveProperty('isAutoProcessing');
    });
  });

  describe('Auto Processing', () => {
    it('should start and stop auto processing', () => {
      const started = queueService.startAutoProcessing();
      expect(started).toBe(true);
      const isRunning = queueService.isAutoProcessingRunning();
      expect(isRunning).toBe(true);
      const stopped = queueService.stopAutoProcessing();
      expect(stopped).toBe(true);
      const isStillRunning = queueService.isAutoProcessingRunning();
      expect(isStillRunning).toBe(false);
    });
  });
}); 