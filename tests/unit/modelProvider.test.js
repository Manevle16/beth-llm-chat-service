/**
 * Unit tests for Model Provider Types and Validation Functions
 */

import {
  // Types and interfaces
  ModelInfo,
  ModelCapabilities,
  ModelMetadata,
  ModelConfig,
  ProviderConfig,
  ProviderHealth,
  GenerationRequest,
  GenerationResponse,
  
  // Constants
  PROVIDER_NAMES,
  PROVIDER_PREFIXES,
  HUGGINGFACE_ERROR_CODES,
  PROVIDER_OPERATIONS,
  DEFAULT_PROVIDER_CONFIG,
  MODEL_NAME_PATTERNS,
  HEALTH_STATUS,
  
  // Validation functions
  isValidModelInfo,
  isValidProviderConfig,
  isValidModelConfig,
  isValidGenerationRequest,
  
  // Utility functions
  createModelInfo,
  createProviderConfig,
  createModelConfig,
  extractProviderFromModel,
  addProviderPrefix,
  removeProviderPrefix
} from '../../types/modelProvider.js';

describe('Model Provider Types and Validation', () => {
  
  describe('Constants', () => {
    test('should have correct provider names', () => {
      expect(PROVIDER_NAMES.OLLAMA).toBe('ollama');
      expect(PROVIDER_NAMES.HUGGINGFACE).toBe('huggingface');
      expect(PROVIDER_NAMES.OPENAI).toBe('openai');
      expect(PROVIDER_NAMES.ANTHROPIC).toBe('anthropic');
    });

    test('should have correct provider prefixes', () => {
      expect(PROVIDER_PREFIXES.OLLAMA).toBe('ollama:');
      expect(PROVIDER_PREFIXES.HUGGINGFACE).toBe('hf:');
      expect(PROVIDER_PREFIXES.OPENAI).toBe('openai:');
      expect(PROVIDER_PREFIXES.ANTHROPIC).toBe('anthropic:');
    });

    test('should have Hugging Face error codes', () => {
      expect(HUGGINGFACE_ERROR_CODES.MODEL_NOT_FOUND).toBe('HF_MODEL_NOT_FOUND');
      expect(HUGGINGFACE_ERROR_CODES.MODEL_LOAD_FAILED).toBe('HF_MODEL_LOAD_FAILED');
      expect(HUGGINGFACE_ERROR_CODES.MODEL_INFERENCE_FAILED).toBe('HF_MODEL_INFERENCE_FAILED');
      expect(HUGGINGFACE_ERROR_CODES.TOKENIZATION_ERROR).toBe('HF_TOKENIZATION_ERROR');
      expect(HUGGINGFACE_ERROR_CODES.MEMORY_ERROR).toBe('HF_MEMORY_ERROR');
      expect(HUGGINGFACE_ERROR_CODES.CONFIGURATION_ERROR).toBe('HF_CONFIGURATION_ERROR');
      expect(HUGGINGFACE_ERROR_CODES.AUTHENTICATION_ERROR).toBe('HF_AUTHENTICATION_ERROR');
      expect(HUGGINGFACE_ERROR_CODES.RATE_LIMIT_ERROR).toBe('HF_RATE_LIMIT_ERROR');
      expect(HUGGINGFACE_ERROR_CODES.CONNECTION_ERROR).toBe('HF_CONNECTION_ERROR');
      expect(HUGGINGFACE_ERROR_CODES.UNKNOWN_ERROR).toBe('HF_UNKNOWN_ERROR');
    });

    test('should have provider operations', () => {
      expect(PROVIDER_OPERATIONS.INITIALIZE_PROVIDER).toBe('initialize_provider');
      expect(PROVIDER_OPERATIONS.SHUTDOWN_PROVIDER).toBe('shutdown_provider');
      expect(PROVIDER_OPERATIONS.HEALTH_CHECK).toBe('health_check');
      expect(PROVIDER_OPERATIONS.LIST_MODELS).toBe('list_models');
      expect(PROVIDER_OPERATIONS.GENERATE_RESPONSE).toBe('generate_response');
      expect(PROVIDER_OPERATIONS.STREAM_RESPONSE).toBe('stream_response');
      expect(PROVIDER_OPERATIONS.REGISTER_PROVIDER).toBe('register_provider');
      expect(PROVIDER_OPERATIONS.ROUTE_REQUEST).toBe('route_request');
    });

    test('should have health status constants', () => {
      expect(HEALTH_STATUS.HEALTHY).toBe('healthy');
      expect(HEALTH_STATUS.UNHEALTHY).toBe('unhealthy');
      expect(HEALTH_STATUS.DEGRADED).toBe('degraded');
      expect(HEALTH_STATUS.UNKNOWN).toBe('unknown');
    });

    test('should have model name patterns', () => {
      expect(MODEL_NAME_PATTERNS.OLLAMA).toBeInstanceOf(RegExp);
      expect(MODEL_NAME_PATTERNS.HUGGINGFACE).toBeInstanceOf(RegExp);
      expect(MODEL_NAME_PATTERNS.OPENAI).toBeInstanceOf(RegExp);
      expect(MODEL_NAME_PATTERNS.ANTHROPIC).toBeInstanceOf(RegExp);
    });
  });

  describe('Type Templates', () => {
    test('should have ModelInfo template with correct structure', () => {
      expect(ModelInfo).toHaveProperty('name');
      expect(ModelInfo).toHaveProperty('provider');
      expect(ModelInfo).toHaveProperty('displayName');
      expect(ModelInfo).toHaveProperty('description');
      expect(ModelInfo).toHaveProperty('capabilities');
      expect(ModelInfo).toHaveProperty('metadata');
      expect(ModelInfo).toHaveProperty('available');
      expect(ModelInfo).toHaveProperty('lastUpdated');
      
      expect(ModelInfo.name).toBe('');
      expect(ModelInfo.provider).toBe('');
      expect(ModelInfo.available).toBe(true);
      expect(ModelInfo.lastUpdated).toBeInstanceOf(Date);
    });

    test('should have ModelCapabilities template with correct structure', () => {
      expect(ModelCapabilities).toHaveProperty('textGeneration');
      expect(ModelCapabilities).toHaveProperty('streaming');
      expect(ModelCapabilities).toHaveProperty('vision');
      expect(ModelCapabilities).toHaveProperty('maxTokens');
      expect(ModelCapabilities).toHaveProperty('contextLength');
      expect(ModelCapabilities).toHaveProperty('supportedFormats');
      expect(ModelCapabilities).toHaveProperty('parameters');
      
      expect(ModelCapabilities.textGeneration).toBe(true);
      expect(ModelCapabilities.streaming).toBe(true);
      expect(ModelCapabilities.vision).toBe(false);
      expect(ModelCapabilities.maxTokens).toBe(4096);
      expect(ModelCapabilities.contextLength).toBe(4096);
      expect(ModelCapabilities.supportedFormats).toEqual(['text']);
      expect(ModelCapabilities.parameters).toEqual({});
    });

    test('should have ModelConfig template with correct structure', () => {
      expect(ModelConfig).toHaveProperty('modelName');
      expect(ModelConfig).toHaveProperty('provider');
      expect(ModelConfig).toHaveProperty('parameters');
      expect(ModelConfig).toHaveProperty('maxTokens');
      expect(ModelConfig).toHaveProperty('temperature');
      expect(ModelConfig).toHaveProperty('topP');
      expect(ModelConfig).toHaveProperty('topK');
      expect(ModelConfig).toHaveProperty('streaming');
      expect(ModelConfig).toHaveProperty('advanced');
      
      expect(ModelConfig.modelName).toBe('');
      expect(ModelConfig.provider).toBe('');
      expect(ModelConfig.maxTokens).toBe(2048);
      expect(ModelConfig.temperature).toBe(0.7);
      expect(ModelConfig.topP).toBe(0.9);
      expect(ModelConfig.topK).toBe(40);
      expect(ModelConfig.streaming).toBe(true);
    });
  });

  describe('Validation Functions', () => {
    describe('isValidModelInfo', () => {
      test('should validate correct ModelInfo object', () => {
        const validModelInfo = {
          name: 'test-model',
          provider: 'ollama',
          displayName: 'Test Model',
          available: true,
          capabilities: { textGeneration: true },
          metadata: { version: '1.0' }
        };
        
        expect(isValidModelInfo(validModelInfo)).toBe(true);
      });

      test('should reject invalid ModelInfo object', () => {
        expect(isValidModelInfo(null)).toBe(false);
        expect(isValidModelInfo(undefined)).toBe(false);
        expect(isValidModelInfo({})).toBe(false);
        expect(isValidModelInfo({ name: 'test' })).toBe(false);
        expect(isValidModelInfo({ name: 'test', provider: 'ollama' })).toBe(false);
      });

      test('should reject ModelInfo with wrong types', () => {
        const invalidModelInfo = {
          name: 123, // should be string
          provider: 'ollama',
          displayName: 'Test Model',
          available: 'true', // should be boolean
          capabilities: { textGeneration: true },
          metadata: { version: '1.0' }
        };
        
        expect(isValidModelInfo(invalidModelInfo)).toBe(false);
      });
    });

    describe('isValidProviderConfig', () => {
      test('should validate correct ProviderConfig object', () => {
        const validProviderConfig = {
          name: 'ollama',
          displayName: 'Ollama',
          enabled: true,
          priority: 0
        };
        
        expect(isValidProviderConfig(validProviderConfig)).toBe(true);
      });

      test('should reject invalid ProviderConfig object', () => {
        expect(isValidProviderConfig(null)).toBe(false);
        expect(isValidProviderConfig(undefined)).toBe(false);
        expect(isValidProviderConfig({})).toBe(false);
        expect(isValidProviderConfig({ name: 'test' })).toBe(false);
      });

      test('should reject ProviderConfig with wrong types', () => {
        const invalidProviderConfig = {
          name: 123, // should be string
          displayName: 'Ollama',
          enabled: 'true', // should be boolean
          priority: '0' // should be number
        };
        
        expect(isValidProviderConfig(invalidProviderConfig)).toBe(false);
      });
    });

    describe('isValidModelConfig', () => {
      test('should validate correct ModelConfig object', () => {
        const validModelConfig = {
          modelName: 'llama2',
          provider: 'ollama',
          maxTokens: 2048,
          temperature: 0.7
        };
        
        expect(isValidModelConfig(validModelConfig)).toBe(true);
      });

      test('should reject invalid ModelConfig object', () => {
        expect(isValidModelConfig(null)).toBe(false);
        expect(isValidModelConfig(undefined)).toBe(false);
        expect(isValidModelConfig({})).toBe(false);
        expect(isValidModelConfig({ modelName: 'test' })).toBe(false);
      });

      test('should reject ModelConfig with invalid temperature', () => {
        const invalidModelConfig = {
          modelName: 'llama2',
          provider: 'ollama',
          maxTokens: 2048,
          temperature: 3.0 // should be <= 2
        };
        
        expect(isValidModelConfig(invalidModelConfig)).toBe(false);
      });

      test('should reject ModelConfig with negative temperature', () => {
        const invalidModelConfig = {
          modelName: 'llama2',
          provider: 'ollama',
          maxTokens: 2048,
          temperature: -0.5 // should be >= 0
        };
        
        expect(isValidModelConfig(invalidModelConfig)).toBe(false);
      });
    });

    describe('isValidGenerationRequest', () => {
      test('should validate correct GenerationRequest object', () => {
        const validRequest = {
          model: 'ollama:llama2',
          prompt: 'Hello, world!',
          streaming: true
        };
        
        expect(isValidGenerationRequest(validRequest)).toBe(true);
      });

      test('should reject invalid GenerationRequest object', () => {
        expect(isValidGenerationRequest(null)).toBe(false);
        expect(isValidGenerationRequest(undefined)).toBe(false);
        expect(isValidGenerationRequest({})).toBe(false);
        expect(isValidGenerationRequest({ model: 'test' })).toBe(false);
        expect(isValidGenerationRequest({ model: 'test', prompt: '' })).toBe(false); // empty prompt
      });

      test('should reject GenerationRequest with wrong types', () => {
        const invalidRequest = {
          model: 123, // should be string
          prompt: 'Hello, world!',
          streaming: 'true' // should be boolean
        };
        
        expect(isValidGenerationRequest(invalidRequest)).toBe(false);
      });
    });
  });

  describe('Utility Functions', () => {
    describe('createModelInfo', () => {
      test('should create valid ModelInfo object', () => {
        const modelInfo = createModelInfo('llama2', 'ollama', 'Llama 2');
        
        expect(modelInfo.name).toBe('llama2');
        expect(modelInfo.provider).toBe('ollama');
        expect(modelInfo.displayName).toBe('Llama 2');
        expect(modelInfo.available).toBe(true);
        expect(modelInfo.capabilities).toBeDefined();
        expect(modelInfo.metadata).toBeDefined();
        expect(modelInfo.lastUpdated).toBeInstanceOf(Date);
      });
    });

    describe('createProviderConfig', () => {
      test('should create valid ProviderConfig object', () => {
        const providerConfig = createProviderConfig('ollama', 'Ollama');
        
        expect(providerConfig.name).toBe('ollama');
        expect(providerConfig.displayName).toBe('Ollama');
        expect(providerConfig.enabled).toBe(true);
        expect(providerConfig.priority).toBe(0);
        expect(providerConfig.createdAt).toBeInstanceOf(Date);
        expect(providerConfig.updatedAt).toBeInstanceOf(Date);
      });
    });

    describe('createModelConfig', () => {
      test('should create valid ModelConfig object', () => {
        const modelConfig = createModelConfig('llama2', 'ollama');
        
        expect(modelConfig.modelName).toBe('llama2');
        expect(modelConfig.provider).toBe('ollama');
        expect(modelConfig.maxTokens).toBe(DEFAULT_PROVIDER_CONFIG.DEFAULT_MAX_TOKENS);
        expect(modelConfig.temperature).toBe(DEFAULT_PROVIDER_CONFIG.DEFAULT_TEMPERATURE);
        expect(modelConfig.topP).toBe(DEFAULT_PROVIDER_CONFIG.DEFAULT_TOP_P);
        expect(modelConfig.topK).toBe(DEFAULT_PROVIDER_CONFIG.DEFAULT_TOP_K);
        expect(modelConfig.streaming).toBe(true);
      });
    });

    describe('extractProviderFromModel', () => {
      test('should extract provider from prefixed model names', () => {
        expect(extractProviderFromModel('hf:gpt2')).toBe('huggingface');
        expect(extractProviderFromModel('ollama:llama2')).toBe('ollama');
        expect(extractProviderFromModel('openai:gpt-4')).toBe('openai');
        expect(extractProviderFromModel('anthropic:claude')).toBe('anthropic');
      });

      test('should default to ollama for unprefixed model names', () => {
        expect(extractProviderFromModel('llama2')).toBe('ollama');
        expect(extractProviderFromModel('gpt2')).toBe('ollama');
        expect(extractProviderFromModel('unknown-model')).toBe('ollama');
      });
    });

    describe('addProviderPrefix', () => {
      test('should add provider prefix to model names', () => {
        expect(addProviderPrefix('llama2', 'ollama')).toBe('ollama:llama2');
        expect(addProviderPrefix('gpt2', 'huggingface')).toBe('hf:gpt2');
        expect(addProviderPrefix('gpt-4', 'openai')).toBe('openai:gpt-4');
        expect(addProviderPrefix('claude', 'anthropic')).toBe('anthropic:claude');
      });

      test('should not add prefix if already present', () => {
        expect(addProviderPrefix('ollama:llama2', 'ollama')).toBe('ollama:llama2');
        expect(addProviderPrefix('hf:gpt2', 'huggingface')).toBe('hf:gpt2');
      });

      test('should handle unknown providers gracefully', () => {
        expect(addProviderPrefix('test-model', 'unknown')).toBe('test-model');
      });
    });

    describe('removeProviderPrefix', () => {
      test('should remove provider prefix from model names', () => {
        expect(removeProviderPrefix('ollama:llama2')).toBe('llama2');
        expect(removeProviderPrefix('hf:gpt2')).toBe('gpt2');
        expect(removeProviderPrefix('openai:gpt-4')).toBe('gpt-4');
        expect(removeProviderPrefix('anthropic:claude')).toBe('claude');
      });

      test('should return original name if no prefix found', () => {
        expect(removeProviderPrefix('llama2')).toBe('llama2');
        expect(removeProviderPrefix('gpt2')).toBe('gpt2');
        expect(removeProviderPrefix('unknown-model')).toBe('unknown-model');
      });
    });
  });
}); 