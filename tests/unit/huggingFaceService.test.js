import { jest } from '@jest/globals';

// Mock the @huggingface/transformers module
const mockPipeline = jest.fn();
jest.unstable_mockModule('@huggingface/transformers', () => ({
  pipeline: mockPipeline
}));

// Mock the configuration
jest.unstable_mockModule('../../config/huggingface.js', () => ({
  HUGGING_FACE_CONFIG: {
    MODEL_STORAGE_PATH: '/test/models/huggingface',
    MAX_CACHED_MODELS: 2,
    DEFAULT_TASK: 'text-generation',
    ENABLE_GPU: false,
    MODEL_TIMEOUT_MS: 5000,
    STREAM_CHUNK_SIZE: 50
  }
}));

// Mock fs/promises
const mockFs = {
  access: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn()
};
jest.unstable_mockModule('fs/promises', () => ({
  default: mockFs,
  ...mockFs
}));

describe('HuggingFaceService', () => {
  let HuggingFaceService;
  let service;

  beforeAll(async () => {
    // Import the service after mocking
    const module = await import('../../services/huggingFaceService.js');
    HuggingFaceService = module.default;
    service = HuggingFaceService;
  });

  beforeEach(() => {
    // Reset service state
    service.loadedModels.clear();
    service.modelMetadata.clear();
    service._isInitialized = false;
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default fs mocks
    mockFs.access.mockResolvedValue();
    mockFs.mkdir.mockResolvedValue();
    mockFs.readdir.mockResolvedValue([]);
  });

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      expect(service.loadedModels).toBeInstanceOf(Map);
      expect(service.modelMetadata).toBeInstanceOf(Map);
      expect(service.modelPath).toBe('/test/models/huggingface');
      expect(service._isInitialized).toBe(false);
      expect(service.maxCachedModels).toBe(2);
    });
  });

  describe('initialize()', () => {
    test('should initialize successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await service.initialize();
      
      expect(service._isInitialized).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith('/test/models/huggingface');
      expect(mockFs.readdir).toHaveBeenCalledWith('/test/models/huggingface', { withFileTypes: true });
      expect(consoleSpy).toHaveBeenCalledWith('🤗 Initializing HuggingFaceService...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ HuggingFaceService initialized successfully');
      
      consoleSpy.mockRestore();
    });

    test('should create model directory if it does not exist', async () => {
      mockFs.access.mockRejectedValueOnce(new Error('Directory not found'));
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await service.initialize();
      
      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/models/huggingface', { recursive: true });
      expect(consoleSpy).toHaveBeenCalledWith('📁 Creating model directory: /test/models/huggingface');
      
      consoleSpy.mockRestore();
    });

    test('should not reinitialize if already initialized', async () => {
      service._isInitialized = true;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await service.initialize();
      
      expect(consoleSpy).not.toHaveBeenCalledWith('🤗 Initializing HuggingFaceService...');
      consoleSpy.mockRestore();
    });

    test('should handle initialization errors gracefully', async () => {
      mockFs.access.mockRejectedValue(new Error('Permission denied'));
      mockFs.mkdir.mockRejectedValue(new Error('Cannot create directory'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await service.initialize();
      
      expect(service._isInitialized).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to initialize HuggingFaceService:', 'Cannot create directory');
      
      consoleSpy.mockRestore();
    });
  });

  describe('_scanLocalModels()', () => {
    test('should scan and find valid model directories', async () => {
      const mockDirents = [
        { name: 'model1', isDirectory: () => true },
        { name: 'model2', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false }
      ];
      
      mockFs.readdir.mockResolvedValue(mockDirents);
      mockFs.readdir.mockImplementation((_, options) => {
        if (options && options.withFileTypes) {
          return Promise.resolve(mockDirents);
        }
        // For individual model directories
        return Promise.resolve(['config.json', 'tokenizer.json']);
      });
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await service.initialize();
      
      expect(service.modelMetadata.size).toBe(2);
      expect(service.modelMetadata.has('model1')).toBe(true);
      expect(service.modelMetadata.has('model2')).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('📦 Found local model: model1');
      expect(consoleSpy).toHaveBeenCalledWith('📦 Found local model: model2');
      
      consoleSpy.mockRestore();
    });

    test('should handle scan errors gracefully', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await service.initialize();
      
      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Failed to scan local models: Permission denied');
      consoleSpy.mockRestore();
    });
  });

  describe('loadModel()', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    test('should load a model successfully', async () => {
      const mockModel = { generate: jest.fn() };
      mockPipeline.mockResolvedValue(mockModel);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await service.loadModel('test-model');
      
      expect(result).toBe(mockModel);
      expect(service.isModelLoaded('test-model')).toBe(true);
      expect(service.modelMetadata.has('test-model')).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Loading Hugging Face model: test-model');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Model test-model loaded successfully');
      
      consoleSpy.mockRestore();
    });

    test('should return already loaded model', async () => {
      const mockModel = { generate: jest.fn() };
      service.loadedModels.set('test-model', mockModel);
      service.modelMetadata.set('test-model', { lastUsedAt: new Date() });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await service.loadModel('test-model');
      
      expect(result).toBe(mockModel);
      expect(mockPipeline).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✅ Model test-model already loaded');
      
      consoleSpy.mockRestore();
    });

    test('should handle model loading timeout', async () => {
      mockPipeline.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 10000)));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await expect(service.loadModel('test-model')).rejects.toThrow('Failed to load Hugging Face model \'test-model\': Model loading timeout');
      
      expect(service.isModelLoaded('test-model')).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to load model test-model:', 'Model loading timeout');
      
      consoleSpy.mockRestore();
    });

    test('should handle model loading errors', async () => {
      mockPipeline.mockRejectedValue(new Error('Model not found'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await expect(service.loadModel('test-model')).rejects.toThrow('Failed to load Hugging Face model \'test-model\': Model not found');
      
      expect(service.isModelLoaded('test-model')).toBe(false);
      const metadata = service.modelMetadata.get('test-model');
      expect(metadata.errorCount).toBe(1);
      
      consoleSpy.mockRestore();
    });

    test('should evict LRU model when cache is full', async () => {
      // Load models to fill cache
      const mockModel1 = { generate: jest.fn() };
      const mockModel2 = { generate: jest.fn() };
      const mockModel3 = { generate: jest.fn() };
      
      service.loadedModels.set('model1', mockModel1);
      service.loadedModels.set('model2', mockModel2);
      service.modelMetadata.set('model1', { lastUsedAt: new Date(Date.now() - 1000) });
      service.modelMetadata.set('model2', { lastUsedAt: new Date() });
      
      mockPipeline.mockResolvedValue(mockModel3);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await service.loadModel('model3');
      
      expect(service.isModelLoaded('model1')).toBe(false);
      expect(service.isModelLoaded('model2')).toBe(true);
      expect(service.isModelLoaded('model3')).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Cache full (2/2), evicting LRU model');
      expect(consoleSpy).toHaveBeenCalledWith('🗑️  Evicting LRU model: model1');
      
      consoleSpy.mockRestore();
    });
  });

  describe('unloadModel()', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    test('should unload a loaded model', async () => {
      const mockModel = { generate: jest.fn() };
      service.loadedModels.set('test-model', mockModel);
      service.modelMetadata.set('test-model', { isLoaded: true, loadedAt: new Date() });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await service.unloadModel('test-model');
      
      expect(result).toBe(true);
      expect(service.isModelLoaded('test-model')).toBe(false);
      const metadata = service.modelMetadata.get('test-model');
      expect(metadata.isLoaded).toBe(false);
      expect(metadata.loadedAt).toBe(null);
      expect(consoleSpy).toHaveBeenCalledWith('✅ Model test-model unloaded successfully');
      
      consoleSpy.mockRestore();
    });

    test('should handle unloading non-loaded model', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await service.unloadModel('non-existent-model');
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('ℹ️  Model non-existent-model is not loaded');
      
      consoleSpy.mockRestore();
    });
  });

  describe('checkModelExists()', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    test('should return true for model in metadata with valid local path', async () => {
      service.modelMetadata.set('test-model', { localPath: '/test/path' });
      mockFs.access.mockResolvedValue();
      
      const result = await service.checkModelExists('test-model');
      
      expect(result).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith('/test/path');
    });

    test('should return true for model with valid directory', async () => {
      mockFs.access.mockResolvedValue();
      mockFs.readdir.mockResolvedValue(['config.json', 'tokenizer.json']);
      
      const result = await service.checkModelExists('test-model');
      
      expect(result).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith('/test/models/huggingface/test-model');
    });

    test('should return false for non-existent model', async () => {
      mockFs.access.mockRejectedValue(new Error('Not found'));
      
      const result = await service.checkModelExists('non-existent-model');
      
      expect(result).toBe(false);
    });

    test('should remove invalid model from metadata', async () => {
      service.modelMetadata.set('test-model', { localPath: '/invalid/path' });
      mockFs.access.mockRejectedValue(new Error('Not found'));
      
      const result = await service.checkModelExists('test-model');
      
      expect(result).toBe(false);
      expect(service.modelMetadata.has('test-model')).toBe(false);
    });
  });

  describe('listModels()', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    test('should return list of available models', async () => {
      service.modelMetadata.set('model1', { name: 'model1', task: 'text-generation' });
      service.modelMetadata.set('model2', { name: 'model2', task: 'text-generation' });
      service.loadedModels.set('model1', { generate: jest.fn() });
      
      const models = await service.listModels();
      
      expect(models).toHaveLength(2);
      expect(models[0].name).toBe('model1');
      expect(models[0].provider).toBe('huggingface');
      expect(models[0].metadata.isLoaded).toBe(true);
      expect(models[1].name).toBe('model2');
      expect(models[1].metadata.isLoaded).toBe(false);
    });

    test('should return empty array when no models available', async () => {
      const models = await service.listModels();
      
      expect(models).toHaveLength(0);
    });
  });

  describe('Utility methods', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    test('getLoadedModels() should return array of loaded model names', () => {
      service.loadedModels.set('model1', {});
      service.loadedModels.set('model2', {});
      
      const loadedModels = service.getLoadedModels();
      
      expect(loadedModels).toEqual(['model1', 'model2']);
    });

    test('isModelLoaded() should return correct status', () => {
      service.loadedModels.set('loaded-model', {});
      
      expect(service.isModelLoaded('loaded-model')).toBe(true);
      expect(service.isModelLoaded('not-loaded-model')).toBe(false);
    });

    test('getModelMetadata() should return metadata or null', () => {
      const metadata = { name: 'test-model' };
      service.modelMetadata.set('test-model', metadata);
      
      expect(service.getModelMetadata('test-model')).toBe(metadata);
      expect(service.getModelMetadata('non-existent')).toBe(null);
    });

    test('getStatus() should return service status', () => {
      service.loadedModels.set('model1', {});
      service.modelMetadata.set('model1', {});
      service.modelMetadata.set('model2', {});
      
      const status = service.getStatus();
      
      expect(status).toEqual({
        initialized: true,
        modelPath: '/test/models/huggingface',
        loadedModels: ['model1'],
        totalModels: 2,
        cacheUtilization: '1/2'
      });
    });
  });

  describe('generateResponse()', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    test('should generate response successfully', async () => {
      const contextText = 'You are a helpful AI assistant. Please provide clear and accurate responses.\n\nHuman: Hello\nAssistant:';
      const mockModel = jest.fn().mockResolvedValue([{ generated_text: contextText + 'This is a generated response' }]);
      mockPipeline.mockResolvedValue(mockModel);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const response = await service.generateResponse('test-model', 'Hello', [], {});
      
      expect(response).toBe('This is a generated response');
      expect(mockModel).toHaveBeenCalledWith(
        expect.stringContaining('Hello'),
        expect.objectContaining({
          max_length: 512,
          temperature: 0.7,
          top_p: 0.9,
          top_k: 50,
          do_sample: true
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith('🤗 Generating response with Hugging Face model: test-model');
      
      consoleSpy.mockRestore();
    });

    test('should handle conversation history', async () => {
      const contextText = 'You are a helpful AI assistant. Please provide clear and accurate responses.\n\nHuman: Previous question\nAssistant: Previous answer\nHuman: Current question\nAssistant:';
      const mockModel = jest.fn().mockResolvedValue([{ generated_text: contextText + 'Response with context' }]);
      mockPipeline.mockResolvedValue(mockModel);
      
      const conversationHistory = [
        { sender: 'user', text: 'Previous question' },
        { sender: 'llm', text: 'Previous answer' }
      ];
      
      const response = await service.generateResponse('test-model', 'Current question', conversationHistory);
      
      expect(response).toBe('Response with context');
      expect(mockModel).toHaveBeenCalledWith(
        expect.stringContaining('Previous question'),
        expect.any(Object)
      );
      expect(mockModel).toHaveBeenCalledWith(
        expect.stringContaining('Previous answer'),
        expect.any(Object)
      );
    });

    test('should handle vision messages', async () => {
      const contextText = 'You are a helpful AI assistant. Please provide clear and accurate responses.\n\nHuman: Describe image\n[Note: This message includes 1 image(s) for context]\nAssistant:';
      const mockModel = jest.fn().mockResolvedValue([{ generated_text: contextText + 'Response about images' }]);
      mockPipeline.mockResolvedValue(mockModel);
      
      const visionMessage = [
        { image_url: 'base64data', filename: 'test.jpg' }
      ];
      
      const response = await service.generateResponse('test-model', 'Describe image', [], { visionMessage });
      
      expect(response).toBe('Response about images');
      expect(mockModel).toHaveBeenCalledWith(
        expect.stringContaining('1 image(s) for context'),
        expect.any(Object)
      );
    });

    test('should update metadata on successful generation', async () => {
      const mockModel = jest.fn().mockResolvedValue([{ generated_text: 'Test response' }]);
      mockPipeline.mockResolvedValue(mockModel);
      
      // Add a small delay to ensure response time is measurable
      mockModel.mockImplementation(async (...args) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return [{ generated_text: 'Test response' }];
      });
      
      await service.generateResponse('test-model', 'Hello', []);
      
      const metadata = service.modelMetadata.get('test-model');
      expect(metadata.requestCount).toBe(1);
      expect(metadata.lastUsedAt).toBeInstanceOf(Date);
      expect(typeof metadata.averageResponseTime).toBe('number');
    });

    test('should handle generation errors', async () => {
      const mockModel = jest.fn().mockRejectedValue(new Error('Generation failed'));
      mockPipeline.mockResolvedValue(mockModel);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await expect(service.generateResponse('test-model', 'Hello', [])).rejects.toThrow('Hugging Face generation error: Generation failed');
      
      const metadata = service.modelMetadata.get('test-model');
      expect(metadata.errorCount).toBe(1);
      
      consoleSpy.mockRestore();
    });

    test('should handle model not found errors', async () => {
      const mockModel = jest.fn().mockRejectedValue(new Error('model not found'));
      mockPipeline.mockResolvedValue(mockModel);
      
      await expect(service.generateResponse('test-model', 'Hello', [])).rejects.toThrow('Hugging Face model \'test-model\' not found. Please ensure it\'s available locally.');
    });

    test('should use custom options', async () => {
      const mockModel = jest.fn().mockResolvedValue([{ generated_text: 'Custom response' }]);
      mockPipeline.mockResolvedValue(mockModel);
      
      const options = {
        maxLength: 256,
        temperature: 0.5,
        topP: 0.8,
        topK: 40
      };
      
      await service.generateResponse('test-model', 'Hello', [], options);
      
      expect(mockModel).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          max_length: 256,
          temperature: 0.5,
          top_p: 0.8,
          top_k: 40
        })
      );
    });
  });

  describe('streamResponse()', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    test('should stream response in chunks', async () => {
      const contextText = 'You are a helpful AI assistant. Please provide clear and accurate responses.\n\nHuman: Hello\nAssistant:';
      const mockModel = jest.fn().mockResolvedValue([{ 
        generated_text: contextText + 'This is a long generated response that should be chunked into multiple parts for streaming' 
      }]);
      mockPipeline.mockResolvedValue(mockModel);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const chunks = [];
      for await (const chunk of service.streamResponse('test-model', 'Hello', [])) {
        chunks.push(chunk);
      }
      
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join('')).toBe('This is a long generated response that should be chunked into multiple parts for streaming');
      expect(consoleSpy).toHaveBeenCalledWith('🤗 Streaming response with Hugging Face model: test-model');
      
      consoleSpy.mockRestore();
    });

    test('should handle termination check', async () => {
      const mockModel = jest.fn().mockResolvedValue([{ 
        generated_text: 'Context\n\nLong response that should be terminated early' 
      }]);
      mockPipeline.mockResolvedValue(mockModel);
      
      let callCount = 0;
      const terminationCheck = jest.fn(() => {
        callCount++;
        return callCount > 2; // Terminate after 2 calls
      });
      
      const chunks = [];
      for await (const chunk of service.streamResponse('test-model', 'Hello', [], {}, terminationCheck)) {
        chunks.push(chunk);
      }
      
      expect(terminationCheck).toHaveBeenCalled();
      expect(chunks.length).toBeLessThan(10); // Should be terminated early
    });

    test('should handle streaming errors', async () => {
      const mockModel = jest.fn().mockRejectedValue(new Error('Streaming failed'));
      mockPipeline.mockResolvedValue(mockModel);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const generator = service.streamResponse('test-model', 'Hello', []);
      await expect(generator.next()).rejects.toThrow('Hugging Face streaming error: Streaming failed');
      
      consoleSpy.mockRestore();
    });

    test('should handle vision messages in streaming', async () => {
      const contextText = 'You are a helpful AI assistant. Please provide clear and accurate responses.\n\nHuman: Describe\n[Note: This message includes 1 image(s) for context]\nAssistant:';
      const mockModel = jest.fn().mockResolvedValue([{ 
        generated_text: contextText + 'Streaming response about the images' 
      }]);
      mockPipeline.mockResolvedValue(mockModel);
      
      const visionMessage = [
        { image_url: 'base64data', filename: 'test.jpg' }
      ];
      
      const chunks = [];
      for await (const chunk of service.streamResponse('test-model', 'Describe', [], {}, null, visionMessage)) {
        chunks.push(chunk);
      }
      
      expect(chunks.join('')).toBe('Streaming response about the images');
      expect(mockModel).toHaveBeenCalledWith(
        expect.stringContaining('1 image(s) for context'),
        expect.any(Object)
      );
    });

    test('should update metadata during streaming', async () => {
      const contextText = 'You are a helpful AI assistant. Please provide clear and accurate responses.\n\nHuman: Hello\nAssistant:';
      const mockModel = jest.fn().mockResolvedValue([{ generated_text: contextText + 'Streaming response' }]);
      mockPipeline.mockResolvedValue(mockModel);
      
      // Add a small delay to ensure response time is measurable
      mockModel.mockImplementation(async (...args) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return [{ generated_text: contextText + 'Streaming response' }];
      });
      
      const chunks = [];
      for await (const chunk of service.streamResponse('test-model', 'Hello', [])) {
        chunks.push(chunk);
      }
      
      const metadata = service.modelMetadata.get('test-model');
      expect(metadata.requestCount).toBe(1);
      expect(metadata.lastUsedAt).toBeInstanceOf(Date);
      expect(typeof metadata.averageResponseTime).toBe('number');
    });
  });

  describe('buildConversationContext()', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    test('should build basic context', () => {
      const context = service.buildConversationContext([], 'Hello', 'test-model');
      
      expect(context).toContain('You are a helpful AI assistant');
      expect(context).toContain('Human: Hello');
      expect(context).toContain('Assistant:');
    });

    test('should include conversation history', () => {
      const history = [
        { sender: 'user', text: 'First message' },
        { sender: 'llm', text: 'First response' }
      ];
      
      const context = service.buildConversationContext(history, 'Second message', 'test-model');
      
      expect(context).toContain('Human: First message');
      expect(context).toContain('Assistant: First response');
      expect(context).toContain('Human: Second message');
    });

    test('should include vision message context', () => {
      const visionMessage = [
        { image_url: 'base64data1', filename: 'test1.jpg' },
        { image_url: 'base64data2', filename: 'test2.jpg' }
      ];
      
      const context = service.buildConversationContext([], 'Describe images', 'test-model', visionMessage);
      
      expect(context).toContain('2 image(s) for context');
    });

    test('should handle empty vision message', () => {
      const context = service.buildConversationContext([], 'Hello', 'test-model', []);
      
      expect(context).not.toContain('image(s) for context');
    });

    test('should handle null vision message', () => {
      const context = service.buildConversationContext([], 'Hello', 'test-model', null);
      
      expect(context).not.toContain('image(s) for context');
    });
  });

  describe('clearCache()', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    test('should clear all loaded models', async () => {
      service.loadedModels.set('model1', {});
      service.loadedModels.set('model2', {});
      service.modelMetadata.set('model1', { isLoaded: true });
      service.modelMetadata.set('model2', { isLoaded: true });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await service.clearCache();
      
      expect(service.loadedModels.size).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('🧹 Clearing all loaded models from cache');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Cache cleared successfully');
      
      consoleSpy.mockRestore();
    });
  });
});