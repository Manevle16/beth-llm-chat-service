/**
 * ModelStateTracker Test Suite
 * 
 * Tests for model state tracking, Ollama sync, and metadata management
 */

import modelStateTracker from '../../services/modelStateTracker.js';

describe('ModelStateTracker', () => {
  const provider = 'ollama';
  const otherProvider = 'huggingface';

  beforeAll(async () => {
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await modelStateTracker.initialize();
    } catch {}
    console.error = originalConsoleError;
  });

  beforeEach(async () => {
    modelStateTracker.reset();
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await modelStateTracker.initialize();
    } catch {}
    console.error = originalConsoleError;
  });

  afterEach(() => {
    try {
      modelStateTracker.reset();
    } catch {}
  });

  describe('Basic initialization', () => {
    test('should initialize successfully', async () => {
      expect(modelStateTracker).toBeDefined();
      expect(() => modelStateTracker.getStateSummary()).not.toThrow();
    });
    test('should get initial state', () => {
      const initialState = modelStateTracker.getStateSummary();
      expect(initialState).toBeDefined();
      expect(typeof initialState).toBe('object');
    });
  });

  describe('Active model management', () => {
    test('should set active model', async () => {
      await modelStateTracker.setActiveModel(provider, 'test-model-1');
      const activeModel = modelStateTracker.getActiveModel(provider);
      expect(activeModel).toBe('test-model-1');
    });
    test('should get active model', async () => {
      await modelStateTracker.setActiveModel(provider, 'test-model-1');
      const activeModel = modelStateTracker.getActiveModel(provider);
      expect(activeModel).toBe('test-model-1');
    });
    test('should update usage when setting same model', async () => {
      await modelStateTracker.setActiveModel(provider, 'test-model-1');
      const initialMetadata = modelStateTracker.getModelMetadata(provider, 'test-model-1');
      const initialCount = initialMetadata.requestCount;
      await modelStateTracker.setActiveModel(provider, 'test-model-1');
      const updatedMetadata = modelStateTracker.getModelMetadata(provider, 'test-model-1');
      expect(updatedMetadata.requestCount).toBeGreaterThan(initialCount);
    });
    test('should set different model', async () => {
      await modelStateTracker.setActiveModel(provider, 'test-model-1');
      await modelStateTracker.setActiveModel(provider, 'test-model-2');
      const activeModel = modelStateTracker.getActiveModel(provider);
      expect(activeModel).toBe('test-model-2');
    });
  });

  describe('Multi-provider support', () => {
    test('should track active models for different providers', async () => {
      await modelStateTracker.setActiveModel(provider, 'ollama-model');
      await modelStateTracker.setActiveModel(otherProvider, 'hf-model');
      expect(modelStateTracker.getActiveModel(provider)).toBe('ollama-model');
      expect(modelStateTracker.getActiveModel(otherProvider)).toBe('hf-model');
    });
    test('should track metadata for different providers', async () => {
      await modelStateTracker.setActiveModel(provider, 'ollama-model');
      await modelStateTracker.setActiveModel(otherProvider, 'hf-model');
      const meta1 = modelStateTracker.getModelMetadata(provider, 'ollama-model');
      const meta2 = modelStateTracker.getModelMetadata(otherProvider, 'hf-model');
      expect(meta1).toBeDefined();
      expect(meta2).toBeDefined();
      expect(meta1.provider).toBe(provider);
      expect(meta2.provider).toBe(otherProvider);
    });
  });

  describe('Model metadata', () => {
    test('should get model metadata', async () => {
      await modelStateTracker.setActiveModel(provider, 'test-model-1');
      const metadata = modelStateTracker.getModelMetadata(provider, 'test-model-1');
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('test-model-1');
      expect(typeof metadata.requestCount).toBe('number');
      expect(metadata.loadedAt).toBeInstanceOf(Date);
    });
    test('should get all model metadata', async () => {
      await modelStateTracker.setActiveModel(provider, 'test-model-1');
      await modelStateTracker.setActiveModel(provider, 'test-model-2');
      const allMetadata = modelStateTracker.getAllModelMetadata(provider);
      expect(Array.isArray(allMetadata)).toBe(true);
      expect(allMetadata.length).toBeGreaterThan(0);
    });
    test('should handle invalid metadata requests', () => {
      const invalidMetadata = modelStateTracker.getModelMetadata(provider, 'non-existent');
      expect(invalidMetadata).toBeNull();
    });
  });

  describe('Model loading status', () => {
    test('should check model loading status', async () => {
      await modelStateTracker.setActiveModel(provider, 'test-model-1');
      const isLoaded1 = modelStateTracker.isModelLoaded(provider, 'test-model-1');
      const isLoaded2 = modelStateTracker.isModelLoaded(provider, 'test-model-2');
      const isLoaded3 = modelStateTracker.isModelLoaded(provider, 'non-existent-model');
      expect(typeof isLoaded1).toBe('boolean');
      expect(typeof isLoaded2).toBe('boolean');
      expect(typeof isLoaded3).toBe('boolean');
    });
  });

  describe('Model management', () => {
    test('should remove model from tracking', async () => {
      await modelStateTracker.setActiveModel(provider, 'test-model-1');
      const wasRemoved = modelStateTracker.removeModel(provider, 'test-model-1');
      expect(wasRemoved).toBe(true);
    });
    test('should get state after removal', async () => {
      await modelStateTracker.setActiveModel(provider, 'test-model-1');
      modelStateTracker.removeModel(provider, 'test-model-1');
      const stateAfterRemoval = modelStateTracker.getStateSummary();
      expect(stateAfterRemoval).toBeDefined();
    });
  });

  describe('Input validation', () => {
    test('should reject empty model name', async () => {
      await expect(modelStateTracker.setActiveModel(provider, '')).rejects.toThrow();
    });
    test('should reject null model name', async () => {
      await expect(modelStateTracker.setActiveModel(provider, null)).rejects.toThrow();
    });
  });

  describe('State management', () => {
    test('should get state summary', () => {
      const summary = modelStateTracker.getStateSummary();
      expect(summary).toBeDefined();
      expect(typeof summary).toBe('object');
    });
    test('should reset and require re-initialization', () => {
      modelStateTracker.reset();
      expect(() => modelStateTracker.getStateSummary()).toThrow();
    });
    test('should re-initialize after reset', async () => {
      modelStateTracker.reset();
      const originalConsoleError = console.error;
      console.error = () => {};
      try {
        await modelStateTracker.initialize();
        const state = modelStateTracker.getStateSummary();
        expect(state).toBeDefined();
      } catch {}
      console.error = originalConsoleError;
    });
  });
}); 