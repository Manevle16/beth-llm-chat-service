/**
 * Model provider enumeration
 */
export const MODEL_PROVIDER = {
  OLLAMA: 'ollama',
  HUGGING_FACE: 'huggingface'
};

/**
 * Creates a unified model info object
 * @param {string} name - Model name
 * @param {string} provider - Model provider (from MODEL_PROVIDER enum)
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Model info object
 */
export const createModelInfo = (name, provider, displayName) => ({
  name: name || '',
  provider: provider || '',
  displayName: displayName || '',
  description: '',
  capabilities: ModelCapabilities,
  metadata: {},
  available: true,
  lastUpdated: new Date()
});

/**
 * Model status enumeration
 */
export const MODEL_STATUS = {
  UNLOADED: 'unloaded',
  LOADING: 'loading',
  LOADED: 'loaded',
  ERROR: 'error',
  UNAVAILABLE: 'unavailable'
};

/**
 * Health status constants for providers
 */
export const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  UNHEALTHY: 'unhealthy',
  DEGRADED: 'degraded',
  UNKNOWN: 'unknown'
};

/**
 * Detects provider from model name
 * @param {string} modelName - Name of the model
 * @returns {string} Provider name
 */
export const detectProviderFromModel = (modelName) => {
  if (!modelName) return MODEL_PROVIDER.OLLAMA;
  
  // Simple heuristic: if model name contains certain patterns, assume HF
  const hfPatterns = [
    'microsoft/',
    'google/',
    'facebook/',
    'huggingface/',
    'bert-',
    'gpt2',
    't5-',
    'distilbert'
  ];
  
  const lowerModelName = modelName.toLowerCase();
  const isHuggingFace = hfPatterns.some(pattern => lowerModelName.includes(pattern));
  
  return isHuggingFace ? MODEL_PROVIDER.HUGGING_FACE : MODEL_PROVIDER.OLLAMA;
};

/**
 * Validates provider name
 * @param {string} provider - Provider name to validate
 * @returns {boolean} True if valid provider
 */
export const isValidProvider = (provider) => {
  return Object.values(MODEL_PROVIDER).includes(provider);
};

/**
 * Gets all supported providers
 * @returns {Array} Array of provider names
 */
export const getSupportedProviders = () => {
  return Object.values(MODEL_PROVIDER);
};

/**
 * Default provider configuration for model providers
 */
export const DEFAULT_PROVIDER_CONFIG = {
  ollama: {
    maxConcurrentModels: 1,
    enableAutoRotation: false,
    rotationTimeoutMs: 30000,
    retryAttempts: 3,
    retryDelayMs: 1000,
    // Add more Ollama-specific defaults as needed
  },
  huggingface: {
    modelPath: process.env.HF_MODEL_PATH || '/Users/mattnevle/Models/huggingface',
    maxConcurrentModels: 1,
    enableAutoRotation: false,
    rotationTimeoutMs: 30000,
    retryAttempts: 3,
    retryDelayMs: 1000,
    // Add more Hugging Face-specific defaults as needed
  }
};

/**
 * GenerationRequest template and validator
 */
export const GenerationRequest = {
  model: '',
  prompt: '',
  streaming: true
};

export function isValidGenerationRequest(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return (
    typeof obj.model === 'string' &&
    typeof obj.prompt === 'string' &&
    obj.prompt.length > 0 &&
    typeof obj.streaming === 'boolean'
  );
}

/**
 * GenerationResponse template
 */
export const GenerationResponse = {
  model: '',
  provider: '',
  response: '',
  usage: {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0
  },
  finishReason: '',
  streaming: false
};

/**
 * Hugging Face error codes
 */
export const HUGGINGFACE_ERROR_CODES = {
  MODEL_NOT_FOUND: 'HF_MODEL_NOT_FOUND',
  MODEL_LOAD_FAILED: 'HF_MODEL_LOAD_FAILED',
  MODEL_INFERENCE_FAILED: 'HF_MODEL_INFERENCE_FAILED',
  TOKENIZATION_ERROR: 'HF_TOKENIZATION_ERROR',
  MEMORY_ERROR: 'HF_MEMORY_ERROR',
  CONFIGURATION_ERROR: 'HF_CONFIGURATION_ERROR',
  AUTHENTICATION_ERROR: 'HF_AUTHENTICATION_ERROR',
  RATE_LIMIT_ERROR: 'HF_RATE_LIMIT_ERROR',
  CONNECTION_ERROR: 'HF_CONNECTION_ERROR',
  UNKNOWN_ERROR: 'HF_UNKNOWN_ERROR'
};

/**
 * Model name patterns for provider prefixes
 */
export const MODEL_NAME_PATTERNS = {
  OLLAMA: /^ollama:/,
  HUGGINGFACE: /^hf:/,
  OPENAI: /^openai:/,
  ANTHROPIC: /^anthropic:/
};

/**
 * ModelCapabilities template
 */
export const ModelCapabilities = {
  textGeneration: true,
  streaming: true,
  vision: false,
  maxTokens: 4096,
  contextLength: 4096,
  supportedFormats: ['text'],
  parameters: {}
};

/**
 * ModelInfo template
 */
export const ModelInfo = {
  name: '',
  provider: '',
  displayName: '',
  description: '',
  capabilities: ModelCapabilities,
  metadata: {},
  available: true,
  lastUpdated: new Date()
};

/**
 * ModelMetadata template
 */
export const ModelMetadata = {
  version: '',
  size: 0,
  lastLoaded: null,
  lastUsed: null,
  errorCount: 0
};

/**
 * ModelConfig template
 */
export const ModelConfig = {
  modelName: '',
  provider: '',
  parameters: {},
  maxTokens: 2048,
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  streaming: true,
  advanced: {}
};

/**
 * ProviderConfig template
 */
export const ProviderConfig = {
  name: '',
  displayName: '',
  enabled: true,
  priority: 0,
  createdAt: new Date(),
  updatedAt: new Date()
};

/**
 * ProviderHealth template
 */
export const ProviderHealth = {
  name: '',
  status: 'unknown',
  lastChecked: new Date(),
  details: {}
};

/**
 * Provider names
 */
export const PROVIDER_NAMES = {
  OLLAMA: 'ollama',
  HUGGINGFACE: 'huggingface',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic'
};

/**
 * Provider prefixes
 */
export const PROVIDER_PREFIXES = {
  OLLAMA: 'ollama:',
  HUGGINGFACE: 'hf:',
  OPENAI: 'openai:',
  ANTHROPIC: 'anthropic:'
};

/**
 * Provider operations
 */
export const PROVIDER_OPERATIONS = {
  INITIALIZE_PROVIDER: 'initialize_provider',
  SHUTDOWN_PROVIDER: 'shutdown_provider',
  HEALTH_CHECK: 'health_check',
  LIST_MODELS: 'list_models',
  GENERATE_RESPONSE: 'generate_response',
  STREAM_RESPONSE: 'stream_response',
  REGISTER_PROVIDER: 'register_provider',
  ROUTE_REQUEST: 'route_request'
};

/**
 * Utility: Add provider prefix to model name
 */
export function addProviderPrefix(modelName, provider) {
  if (!modelName || !provider) return modelName;
  const prefixMap = {
    ollama: 'ollama:',
    huggingface: 'hf:',
    openai: 'openai:',
    anthropic: 'anthropic:'
  };
  const prefix = prefixMap[provider];
  if (!prefix) return modelName;
  if (modelName.startsWith(prefix)) return modelName;
  return prefix + modelName;
}

/**
 * Utility: Remove provider prefix from model name
 */
export function removeProviderPrefix(modelName) {
  if (!modelName) return modelName;
  return modelName.replace(/^(ollama:|hf:|openai:|anthropic:)/, '');
}

/**
 * Utility: Extract provider from prefixed model name
 */
export function extractProviderFromModel(modelName) {
  if (!modelName) return 'ollama';
  if (modelName.startsWith('hf:')) return 'huggingface';
  if (modelName.startsWith('ollama:')) return 'ollama';
  if (modelName.startsWith('openai:')) return 'openai';
  if (modelName.startsWith('anthropic:')) return 'anthropic';
  return 'ollama';
}

/**
 * Utility: Create provider config
 */
export function createProviderConfig(name, displayName) {
  return {
    name: name || '',
    displayName: displayName || '',
    enabled: true,
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Utility: Create model config
 */
export function createModelConfig(modelName, provider) {
  return {
    modelName: modelName || '',
    provider: provider || '',
    parameters: {},
    maxTokens: DEFAULT_PROVIDER_CONFIG.DEFAULT_MAX_TOKENS,
    temperature: DEFAULT_PROVIDER_CONFIG.DEFAULT_TEMPERATURE,
    topP: DEFAULT_PROVIDER_CONFIG.DEFAULT_TOP_P,
    topK: DEFAULT_PROVIDER_CONFIG.DEFAULT_TOP_K,
    streaming: true,
    advanced: {}
  };
}

/**
 * Validation: ModelConfig
 */
export function isValidModelConfig(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return (
    typeof obj.modelName === 'string' &&
    typeof obj.provider === 'string' &&
    typeof obj.maxTokens === 'number' &&
    typeof obj.temperature === 'number' &&
    obj.temperature >= 0 && obj.temperature <= 2
  );
}

/**
 * Validation: ModelInfo
 */
export function isValidModelInfo(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return (
    typeof obj.name === 'string' &&
    typeof obj.provider === 'string' &&
    typeof obj.displayName === 'string' &&
    typeof obj.available === 'boolean' &&
    typeof obj.capabilities === 'object' &&
    typeof obj.metadata === 'object'
  );
}

/**
 * Validation: ProviderConfig
 */
export function isValidProviderConfig(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return (
    typeof obj.name === 'string' &&
    typeof obj.displayName === 'string' &&
    typeof obj.enabled === 'boolean' &&
    typeof obj.priority === 'number'
  );
}

export default {
  MODEL_PROVIDER,
  MODEL_STATUS,
  createModelInfo,
  detectProviderFromModel,
  isValidProvider,
  getSupportedProviders
};