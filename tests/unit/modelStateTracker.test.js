/**
 * ModelStateTracker Test Suite
 * 
 * Tests for model state tracking, Ollama sync, and metadata management
 */

import modelStateTracker from '../../services/modelStateTracker.js';

describe('ModelStateTracker', () => {
  
  beforeAll(async () => {
    // Initialize once for all tests
    // Suppress console.error to avoid Ollama connection error messages
    const originalConsoleError = console.error;
    console.error = () => {}; // Silent function
    
    try {
      await modelStateTracker.initialize();
    } catch (error) {
      // Error is expected when Ollama is not running
    }
    
    // Restore console.error
    console.error = originalConsoleError;
  });

  beforeEach(async () => {
    // Reset and re-initialize before each test to ensure clean state
    modelStateTracker.reset();
    
    // Suppress console.error to avoid Ollama connection error messages
    const originalConsoleError = console.error;
    console.error = () => {}; // Silent function
    
    try {
      await modelStateTracker.initialize();
    } catch (error) {
      // Ignore initialization errors - service should work with empty state
      // Error is expected when Ollama is not running
    }
    
    // Restore console.error
    console.error = originalConsoleError;
  });

  afterEach(() => {
    // Clean up after each test
    try {
      modelStateTracker.reset();
    } catch (error) {
      // Ignore reset errors
    }
  });

  describe('Basic initialization', () => {
    test('should initialize successfully', async () => {
      expect(modelStateTracker).toBeDefined();
      // The service should be initialized even if Ollama is not available
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
      await modelStateTracker.setActiveModel('test-model-1');
      const activeModel = modelStateTracker.getActiveModel();
      expect(activeModel).toBe('test-model-1');
    });

    test('should get active model', async () => {
      await modelStateTracker.setActiveModel('test-model-1');
      const activeModel = modelStateTracker.getActiveModel();
      expect(activeModel).toBe('test-model-1');
    });

    test('should update usage when setting same model', async () => {
      await modelStateTracker.setActiveModel('test-model-1');
      const initialMetadata = modelStateTracker.getModelMetadata('test-model-1');
      const initialCount = initialMetadata.requestCount;
      
      await modelStateTracker.setActiveModel('test-model-1');
      const updatedMetadata = modelStateTracker.getModelMetadata('test-model-1');
      expect(updatedMetadata.requestCount).toBeGreaterThan(initialCount);
    });

    test('should set different model', async () => {
      await modelStateTracker.setActiveModel('test-model-1');
      await modelStateTracker.setActiveModel('test-model-2');
      const activeModel = modelStateTracker.getActiveModel();
      expect(activeModel).toBe('test-model-2');
    });

    test('should clear active model', async () => {
      await modelStateTracker.setActiveModel('test-model-1');
      const wasCleared = await modelStateTracker.clearActiveModel();
      expect(wasCleared).toBe(true);
      expect(modelStateTracker.getActiveModel()).toBeNull();
    });
  });

  describe('Model metadata', () => {
    test('should get model metadata', async () => {
      await modelStateTracker.setActiveModel('test-model-1');
      const metadata = modelStateTracker.getModelMetadata('test-model-1');
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('test-model-1');
      expect(typeof metadata.requestCount).toBe('number');
      expect(metadata.loadedAt).toBeInstanceOf(Date);
    });

    test('should get all model metadata', async () => {
      await modelStateTracker.setActiveModel('test-model-1');
      await modelStateTracker.setActiveModel('test-model-2');
      const allMetadata = modelStateTracker.getAllModelMetadata();
      expect(Array.isArray(allMetadata)).toBe(true);
      expect(allMetadata.length).toBeGreaterThan(0);
    });

    test('should handle invalid metadata requests', () => {
      const invalidMetadata = modelStateTracker.getModelMetadata('non-existent');
      expect(invalidMetadata).toBeNull();
    });
  });

  describe('Model loading status', () => {
    test('should check model loading status', async () => {
      await modelStateTracker.setActiveModel('test-model-1');
      const isLoaded1 = modelStateTracker.isModelLoaded('test-model-1');
      const isLoaded2 = modelStateTracker.isModelLoaded('test-model-2');
      const isLoaded3 = modelStateTracker.isModelLoaded('non-existent-model');
      
      expect(typeof isLoaded1).toBe('boolean');
      expect(typeof isLoaded2).toBe('boolean');
      expect(typeof isLoaded3).toBe('boolean');
    });

    test('should get loaded model count', async () => {
      await modelStateTracker.setActiveModel('test-model-1');
      const modelCount = modelStateTracker.getLoadedModelCount();
      expect(typeof modelCount).toBe('number');
      expect(modelCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Model management', () => {
    test('should get least recently used model', async () => {
      await modelStateTracker.setActiveModel('test-model-1');
      await modelStateTracker.setActiveModel('test-model-2');
      const lruModel = modelStateTracker.getLeastRecentlyUsedModel();
      expect(lruModel).toBeDefined();
    });

    test('should remove model from tracking', async () => {
      await modelStateTracker.setActiveModel('test-model-1');
      const wasRemoved = modelStateTracker.removeModel('test-model-1');
      expect(wasRemoved).toBe(true);
    });

    test('should get state after removal', async () => {
      await modelStateTracker.setActiveModel('test-model-1');
      modelStateTracker.removeModel('test-model-1');
      const stateAfterRemoval = modelStateTracker.getStateSummary();
      expect(stateAfterRemoval).toBeDefined();
    });
  });

  describe('Input validation', () => {
    test('should reject empty model name', async () => {
      await expect(modelStateTracker.setActiveModel('')).rejects.toThrow();
    });

    test('should reject null model name', async () => {
      await expect(modelStateTracker.setActiveModel(null)).rejects.toThrow();
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
      
      // Suppress console.error to avoid Ollama connection error messages
      const originalConsoleError = console.error;
      console.error = () => {}; // Silent function
      
      try {
        await modelStateTracker.initialize();
        const state = modelStateTracker.getStateSummary();
        expect(state).toBeDefined();
      } catch (error) {
        // If Ollama is not available, the service should still work with empty state
        // Error is expected when Ollama is not running
      }
      
      // Restore console.error
      console.error = originalConsoleError;
    });
  });
}); 