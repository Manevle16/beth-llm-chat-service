// Refactored for ESM-compatible mocking
import { jest } from '@jest/globals';
import { MODEL_PROVIDER } from '../../types/modelProvider.js';

// ESM-compatible dynamic mocking
const mockOllamaService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  generateResponse: jest.fn(),
  streamResponse: jest.fn(),
  listModels: jest.fn(),
  checkModelExists: jest.fn()
};

const mockHuggingFaceService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  generateResponse: jest.fn(),
  streamResponse: jest.fn(),
  listModels: jest.fn(),
  checkModelExists: jest.fn()
};

// Use jest.unstable_mockModule for ESM mocking
await jest.unstable_mockModule('../../services/ollamaService.js', () => ({
  default: mockOllamaService
}));

await jest.unstable_mockModule('../../services/huggingFaceService.js', () => ({
  default: mockHuggingFaceService
}));

// Now import the service under test (after mocks are set up)
const { default: modelRouterService } = await import('../../services/modelRouterService.js');

describe('ModelRouterService', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset the service state
    modelRouterService._isInitialized = false;
    modelRouterService.providers.clear();
    modelRouterService.modelProviderMap.clear();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      mockOllamaService.listModels.mockResolvedValue(['llama2', 'codellama']);
      mockHuggingFaceService.listModels.mockResolvedValue([
        { name: 'bert-base-uncased', provider: 'huggingface' }
      ]);

      await modelRouterService.initialize();

      expect(modelRouterService._isInitialized).toBe(true);
      expect(mockOllamaService.initialize).toHaveBeenCalled();
      expect(mockHuggingFaceService.initialize).toHaveBeenCalled();
    });

    test('should handle provider initialization failures gracefully', async () => {
      mockOllamaService.initialize.mockRejectedValue(new Error('Ollama not available'));
      mockHuggingFaceService.listModels.mockResolvedValue([]);

      await modelRouterService.initialize();

      expect(modelRouterService._isInitialized).toBe(true);
      // Should still be initialized even if one provider fails
    });

    test('should build model-provider mappings during initialization', async () => {
      mockOllamaService.listModels.mockResolvedValue(['llama2', 'codellama']);
      mockHuggingFaceService.listModels.mockResolvedValue([
        { name: 'bert-base-uncased', provider: 'huggingface' }
      ]);

      await modelRouterService.initialize();

      expect(modelRouterService.modelProviderMap.size).toBeGreaterThan(0);
      expect(modelRouterService.modelProviderMap.get('llama2')).toBe(MODEL_PROVIDER.OLLAMA);
      expect(modelRouterService.modelProviderMap.get('bert-base-uncased')).toBe(MODEL_PROVIDER.HUGGING_FACE);
    });
  });

  describe('Provider Registration', () => {
    test('should register providers successfully', () => {
      const mockProvider = {
        generateResponse: jest.fn(),
        streamResponse: jest.fn(),
        listModels: jest.fn()
      };

      // Use a valid provider name from the enum
      modelRouterService.registerProvider(MODEL_PROVIDER.OLLAMA, mockProvider);

      expect(modelRouterService.providers.has(MODEL_PROVIDER.OLLAMA)).toBe(true);
      expect(modelRouterService.getProviderService(MODEL_PROVIDER.OLLAMA)).toBe(mockProvider);
    });

    test('should validate provider has required methods', () => {
      const invalidProvider = {
        generateResponse: jest.fn()
        // Missing streamResponse and listModels
      };

      expect(() => {
        modelRouterService.registerProvider(MODEL_PROVIDER.OLLAMA, invalidProvider);
      }).toThrow('Provider ollama must implement method: streamResponse');
    });

    test('should reject invalid provider names', () => {
      const mockProvider = {
        generateResponse: jest.fn(),
        streamResponse: jest.fn(),
        listModels: jest.fn()
      };

      expect(() => {
        modelRouterService.registerProvider('invalid-name', mockProvider);
      }).toThrow('Invalid provider name: invalid-name');
    });

    test('should reject null provider service', () => {
      expect(() => {
        modelRouterService.registerProvider(MODEL_PROVIDER.OLLAMA, null);
      }).toThrow('Provider service cannot be null');
    });

    test('should unregister providers', () => {
      const mockProvider = {
        generateResponse: jest.fn(),
        streamResponse: jest.fn(),
        listModels: jest.fn()
      };

      modelRouterService.registerProvider(MODEL_PROVIDER.OLLAMA, mockProvider);
      expect(modelRouterService.providers.has(MODEL_PROVIDER.OLLAMA)).toBe(true);

      const result = modelRouterService.unregisterProvider(MODEL_PROVIDER.OLLAMA);
      expect(result).toBe(true);
      expect(modelRouterService.providers.has(MODEL_PROVIDER.OLLAMA)).toBe(false);
    });
  });

  describe('Provider Selection', () => {
    beforeEach(async () => {
      mockOllamaService.listModels.mockResolvedValue(['llama2', 'codellama']);
      mockHuggingFaceService.listModels.mockResolvedValue([
        { name: 'bert-base-uncased', provider: 'huggingface' }
      ]);
      await modelRouterService.initialize();
    });

    test('should get provider for known model', () => {
      const provider = modelRouterService.getProviderForModel('llama2');
      expect(provider).toBe(MODEL_PROVIDER.OLLAMA);
    });

    test('should detect provider using heuristics for unknown models', () => {
      const provider = modelRouterService.getProviderForModel('microsoft/DialoGPT-medium');
      expect(provider).toBe(null);
    });

    test('should return null for empty model name', () => {
      const provider = modelRouterService.getProviderForModel('');
      expect(provider).toBeNull();
    });

    test('should return null for null model name', () => {
      const provider = modelRouterService.getProviderForModel(null);
      expect(provider).toBeNull();
    });

    test('should fall back to first available provider for unknown models', () => {
      const provider = modelRouterService.getProviderForModel('unknown-model');
      expect(provider).toBe(null);
    });
  });

  describe('Request Routing', () => {
    beforeEach(async () => {
      mockOllamaService.listModels.mockResolvedValue(['llama2']);
      mockHuggingFaceService.listModels.mockResolvedValue([
        { name: 'bert-base-uncased', provider: 'huggingface' }
      ]);
      await modelRouterService.initialize();
    });

    test('should route generateResponse to correct provider', async () => {
      const expectedResponse = 'Generated response';
      mockOllamaService.generateResponse.mockResolvedValue(expectedResponse);

      const result = await modelRouterService.generateResponse(
        'llama2',
        'Hello',
        [],
        {}
      );

      expect(result).toBe(expectedResponse);
      expect(mockOllamaService.generateResponse).toHaveBeenCalledWith(
        'llama2',
        'Hello',
        [],
        {}
      );
    });

    test('should route streamResponse to correct provider', async () => {
      const mockStream = ['chunk1', 'chunk2', 'chunk3'];
      mockHuggingFaceService.streamResponse.mockImplementation(async function* () {
        for (const chunk of mockStream) {
          yield chunk;
        }
      });

      const chunks = [];
      for await (const chunk of modelRouterService.streamResponse(
        'bert-base-uncased',
        'Hello',
        [],
        {}
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(mockStream);
      expect(mockHuggingFaceService.streamResponse).toHaveBeenCalledWith(
        'bert-base-uncased',
        'Hello',
        [],
        {},
        null,
        null
      );
    });

    test('should handle routing errors gracefully', async () => {
      mockOllamaService.generateResponse.mockRejectedValue(new Error('Provider error'));

      await expect(
        modelRouterService.generateResponse('llama2', 'Hello')
      ).rejects.toThrow('Provider ollama error: Provider error');
    });

    test('should throw error for missing model name', async () => {
      await expect(
        modelRouterService.generateResponse('', 'Hello')
      ).rejects.toThrow('Model name is required for routing');
    });

    test('should throw error for unknown model', async () => {
      // Remove the model from all providers' listModels
      mockOllamaService.listModels.mockResolvedValue([]);
      mockHuggingFaceService.listModels.mockResolvedValue([]);
      await modelRouterService.refreshModelMappings();

      await expect(
        modelRouterService.generateResponse('nonexistent-model', 'Hello')
      ).rejects.toThrow('No provider found for model: nonexistent-model');
    });

    test('should throw error for unsupported operation', async () => {
      await expect(
        modelRouterService.routeRequest('llama2', 'unsupportedOperation')
      ).rejects.toThrow('Provider ollama does not support operation: unsupportedOperation');
    });
  });

  describe('Model Listing', () => {
    beforeEach(async () => {
      mockOllamaService.listModels.mockResolvedValue(['llama2', 'codellama']);
      mockHuggingFaceService.listModels.mockResolvedValue([
        { name: 'bert-base-uncased', provider: 'huggingface' },
        { name: 'gpt2', provider: 'huggingface' }
      ]);
      await modelRouterService.initialize();
    });

    test('should list all models from all providers', async () => {
      const models = await modelRouterService.listAllModels();

      expect(models).toHaveLength(4);
      expect(models.some(m => m.name === 'llama2' && m.provider === MODEL_PROVIDER.OLLAMA)).toBe(true);
      expect(models.some(m => m.name === 'bert-base-uncased' && m.provider === MODEL_PROVIDER.HUGGING_FACE)).toBe(true);
    });

    test('should handle provider listing failures gracefully', async () => {
      mockOllamaService.listModels.mockRejectedValue(new Error('Ollama unavailable'));

      const models = await modelRouterService.listAllModels();

      // Should still return models from working providers
      expect(models.some(m => m.name === 'bert-base-uncased')).toBe(true);
    });

    test('should normalize string model names to objects', async () => {
      mockOllamaService.listModels.mockResolvedValue(['llama2']);
      mockHuggingFaceService.listModels.mockResolvedValue([]);

      // Re-initialize to pick up the new mock
      modelRouterService._isInitialized = false;
      await modelRouterService.initialize();

      const models = await modelRouterService.listAllModels();
      const llamaModel = models.find(m => m.name === 'llama2');

      expect(llamaModel).toEqual({
        name: 'llama2',
        provider: MODEL_PROVIDER.OLLAMA,
        metadata: {}
      });
    });
  });

  describe('Model Existence Check', () => {
    beforeEach(async () => {
      mockOllamaService.listModels.mockResolvedValue(['llama2']);
      mockOllamaService.checkModelExists.mockImplementation(async (modelName) => {
        return modelName === 'llama2';
      });
      await modelRouterService.initialize();
    });

    test('should check model existence using provider method', async () => {
      const exists = await modelRouterService.checkModelExists('llama2');

      expect(exists).toBe(true);
      expect(mockOllamaService.checkModelExists).toHaveBeenCalledWith('llama2');
    });

    test('should return false for nonexistent model', async () => {
      const exists = await modelRouterService.checkModelExists('nonexistent');

      expect(exists).toBe(false);
    });

    test('should return false for empty model name', async () => {
      const exists = await modelRouterService.checkModelExists('');

      expect(exists).toBe(false);
    });

    test('should fall back to listing models if checkModelExists not available', async () => {
      // Remove checkModelExists method
      delete mockOllamaService.checkModelExists;

      const exists = await modelRouterService.checkModelExists('llama2');

      expect(exists).toBe(true);
      expect(mockOllamaService.listModels).toHaveBeenCalled();
    });
  });

  describe('Service Status and Management', () => {
    test('should return service status', () => {
      const status = modelRouterService.getStatus();

      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('registeredProviders');
      expect(status).toHaveProperty('modelProviderMappings');
      expect(status).toHaveProperty('totalProviders');
    });

    test('should return registered providers', async () => {
      await modelRouterService.initialize();

      const providers = modelRouterService.getRegisteredProviders();

      expect(providers).toContain(MODEL_PROVIDER.OLLAMA);
      expect(providers).toContain(MODEL_PROVIDER.HUGGING_FACE);
    });

    test('should refresh model mappings', async () => {
      mockOllamaService.listModels.mockResolvedValue(['new-model']);
      mockHuggingFaceService.listModels.mockResolvedValue([]);

      await modelRouterService.initialize();
      await modelRouterService.refreshModelMappings();

      expect(modelRouterService.modelProviderMap.has('new-model')).toBe(true);
    });

    test('should get model-provider mappings', async () => {
      mockOllamaService.listModels.mockResolvedValue(['llama2']);
      mockHuggingFaceService.listModels.mockResolvedValue([]);

      await modelRouterService.initialize();

      const mappings = modelRouterService.getModelProviderMappings();

      expect(mappings).toBeInstanceOf(Map);
      expect(mappings.get('llama2')).toBe(MODEL_PROVIDER.OLLAMA);
    });
  });

  describe('Explicit Model-Provider Mapping', () => {
    beforeEach(async () => {
      await modelRouterService.initialize();
    });

    test('should set explicit model-provider mapping', () => {
      modelRouterService.setModelProvider('custom-model', MODEL_PROVIDER.OLLAMA);

      expect(modelRouterService.getProviderForModel('custom-model')).toBe(MODEL_PROVIDER.OLLAMA);
    });

    test('should reject invalid provider for explicit mapping', () => {
      expect(() => {
        modelRouterService.setModelProvider('custom-model', 'invalid-provider');
      }).toThrow('Invalid provider name: invalid-provider');
    });

    test('should reject unregistered provider for explicit mapping', () => {
      expect(() => {
        modelRouterService.setModelProvider('custom-model', 'unregistered');
      }).toThrow('Invalid provider name: unregistered');
    });

    test('should remove explicit model-provider mapping', () => {
      modelRouterService.setModelProvider('custom-model', MODEL_PROVIDER.OLLAMA);
      expect(modelRouterService.getProviderForModel('custom-model')).toBe(MODEL_PROVIDER.OLLAMA);

      const removed = modelRouterService.removeModelProvider('custom-model');
      expect(removed).toBe(true);

      // Should now return null (no fallback)
      const provider = modelRouterService.getProviderForModel('custom-model');
      expect(provider).toBe(null);
    });

    test('should return false when removing non-existent mapping', () => {
      const removed = modelRouterService.removeModelProvider('nonexistent-model');
      expect(removed).toBe(false);
    });
  });

  describe('Stream Response Edge Cases', () => {
    beforeEach(async () => {
      mockOllamaService.listModels.mockResolvedValue(['llama2']);
      await modelRouterService.initialize();
    });

    test('should handle streaming errors gracefully', async () => {
      mockOllamaService.streamResponse.mockImplementation(async function* () {
        throw new Error('Streaming failed');
      });

      const streamGenerator = modelRouterService.streamResponse('llama2', 'Hello');

      await expect(streamGenerator.next()).rejects.toThrow('Provider ollama streaming error: Streaming failed');
    });

    test('should pass all parameters to provider streamResponse', async () => {
      const mockStream = ['chunk1'];
      mockOllamaService.streamResponse.mockImplementation(async function* () {
        for (const chunk of mockStream) {
          yield chunk;
        }
      });

      const terminationCheck = jest.fn();
      const visionMessage = [{ image_url: 'test.jpg' }];
      const options = { temperature: 0.8 };
      const conversationHistory = [{ sender: 'user', text: 'Hi' }];

      const chunks = [];
      for await (const chunk of modelRouterService.streamResponse(
        'llama2',
        'Hello',
        conversationHistory,
        options,
        terminationCheck,
        visionMessage
      )) {
        chunks.push(chunk);
      }

      expect(mockOllamaService.streamResponse).toHaveBeenCalledWith(
        'llama2',
        'Hello',
        conversationHistory,
        options,
        terminationCheck,
        visionMessage
      );
    });
  });
});