/**
 * Model Provider Types and Interfaces
 * 
 * This module defines all data models, interfaces, and constants
 * for the multi-provider model support feature.
 */

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * @typedef {Object} ModelProviderInterface
 * @property {function(): string} getProviderName - Returns the provider name
 * @property {function(): string} getProviderPrefix - Returns the provider prefix for model names
 * @property {function(): Promise<boolean>} healthCheck - Checks if the provider is healthy
 * @property {function(): Promise<Array<ModelInfo>>} listModels - Lists available models
 * @property {function(string, Object): Promise<Object>} generateResponse - Generates a response
 * @property {function(string, Object, function): Promise<void>} streamResponse - Streams a response
 * @property {function(): Promise<void>} initialize - Initializes the provider
 * @property {function(): Promise<void>} shutdown - Shuts down the provider
 */
export const ModelProviderInterface = {
  getProviderName: () => '',
  getProviderPrefix: () => '',
  healthCheck: async () => false,
  listModels: async () => [],
  generateResponse: async () => ({}),
  streamResponse: async () => {},
  initialize: async () => {},
  shutdown: async () => {}
};

/**
 * @typedef {Object} ModelInfo
 * @property {string} name - The name of the model
 * @property {string} provider - The provider name (e.g., 'ollama', 'huggingface')
 * @property {string} displayName - Human-readable display name
 * @property {string} description - Model description
 * @property {ModelCapabilities} capabilities - Model capabilities
 * @property {ModelMetadata} metadata - Additional model metadata
 * @property {boolean} available - Whether the model is currently available
 * @property {Date} lastUpdated - When the model info was last updated
 */
export const ModelInfo = {
  name: '',
  provider: '',
  displayName: '',
  description: '',
  capabilities: {},
  metadata: {},
  available: true,
  lastUpdated: new Date()
};

/**
 * @typedef {Object} ModelCapabilities
 * @property {boolean} textGeneration - Can generate text
 * @property {boolean} streaming - Supports streaming responses
 * @property {boolean} vision - Supports vision/image input
 * @property {number} maxTokens - Maximum tokens for input/output
 * @property {number} contextLength - Maximum context length
 * @property {Array<string>} supportedFormats - Supported input/output formats
 * @property {Object} parameters - Model-specific parameters
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
 * @typedef {Object} ModelMetadata
 * @property {string} version - Model version
 * @property {string} license - Model license
 * @property {string} author - Model author/creator
 * @property {string} architecture - Model architecture
 * @property {number} parameterCount - Number of parameters
 * @property {string} language - Primary language
 * @property {Array<string>} tags - Model tags/categories
 * @property {Object} performance - Performance metrics
 * @property {Date} releaseDate - When the model was released
 */
export const ModelMetadata = {
  version: '',
  license: '',
  author: '',
  architecture: '',
  parameterCount: 0,
  language: 'en',
  tags: [],
  performance: {},
  releaseDate: new Date()
};

/**
 * @typedef {Object} ModelConfig
 * @property {string} modelName - The name of the model
 * @property {string} provider - The provider name
 * @property {Object} parameters - Model-specific parameters
 * @property {number} maxTokens - Maximum tokens for generation
 * @property {number} temperature - Temperature for generation
 * @property {number} topP - Top-p sampling parameter
 * @property {number} topK - Top-k sampling parameter
 * @property {boolean} streaming - Whether to use streaming
 * @property {Object} advanced - Advanced configuration options
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
 * @typedef {Object} ProviderConfig
 * @property {string} name - Provider name
 * @property {string} displayName - Human-readable display name
 * @property {boolean} enabled - Whether the provider is enabled
 * @property {number} priority - Provider priority (lower = higher priority)
 * @property {Object} connection - Connection configuration
 * @property {Object} authentication - Authentication configuration
 * @property {Object} limits - Provider-specific limits
 * @property {Object} features - Supported features
 * @property {Date} createdAt - When the config was created
 * @property {Date} updatedAt - When the config was last updated
 */
export const ProviderConfig = {
  name: '',
  displayName: '',
  enabled: true,
  priority: 0,
  connection: {},
  authentication: {},
  limits: {},
  features: {},
  createdAt: new Date(),
  updatedAt: new Date()
};

/**
 * @typedef {Object} ProviderHealth
 * @property {string} provider - Provider name
 * @property {boolean} healthy - Whether the provider is healthy
 * @property {string} status - Health status message
 * @property {number} responseTime - Response time in milliseconds
 * @property {Date} lastChecked - When health was last checked
 * @property {Object} metrics - Health metrics
 */
export const ProviderHealth = {
  provider: '',
  healthy: false,
  status: '',
  responseTime: 0,
  lastChecked: new Date(),
  metrics: {}
};

/**
 * @typedef {Object} GenerationRequest
 * @property {string} model - Model name with provider prefix
 * @property {string} prompt - Input prompt
 * @property {Object} config - Generation configuration
 * @property {boolean} streaming - Whether to stream the response
 * @property {string} sessionId - Session identifier
 * @property {Object} metadata - Request metadata
 */
export const GenerationRequest = {
  model: '',
  prompt: '',
  config: {},
  streaming: true,
  sessionId: '',
  metadata: {}
};

/**
 * @typedef {Object} GenerationResponse
 * @property {string} text - Generated text
 * @property {string} model - Model used for generation
 * @property {string} provider - Provider used
 * @property {Object} usage - Token usage information
 * @property {number} responseTime - Response time in milliseconds
 * @property {Object} metadata - Response metadata
 */
export const GenerationResponse = {
  text: '',
  model: '',
  provider: '',
  usage: {},
  responseTime: 0,
  metadata: {}
};

// ============================================================================
// CONSTANTS
// ============================================================================

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
 * Provider prefixes for model names
 */
export const PROVIDER_PREFIXES = {
  OLLAMA: 'ollama:',
  HUGGINGFACE: 'hf:',
  OPENAI: 'openai:',
  ANTHROPIC: 'anthropic:'
};

/**
 * Hugging Face specific error codes
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
 * Provider operations for logging and error handling
 */
export const PROVIDER_OPERATIONS = {
  // Provider management
  INITIALIZE_PROVIDER: 'initialize_provider',
  SHUTDOWN_PROVIDER: 'shutdown_provider',
  HEALTH_CHECK: 'health_check',
  
  // Model operations
  LIST_MODELS: 'list_models',
  LOAD_MODEL: 'load_model',
  UNLOAD_MODEL: 'unload_model',
  
  // Generation operations
  GENERATE_RESPONSE: 'generate_response',
  STREAM_RESPONSE: 'stream_response',
  
  // Configuration operations
  UPDATE_CONFIG: 'update_config',
  VALIDATE_CONFIG: 'validate_config',
  
  // Registry operations
  REGISTER_PROVIDER: 'register_provider',
  UNREGISTER_PROVIDER: 'unregister_provider',
  ROUTE_REQUEST: 'route_request'
};

/**
 * Default configuration values for providers
 */
export const DEFAULT_PROVIDER_CONFIG = {
  // General provider settings
  ENABLED: true,
  PRIORITY: 0,
  HEALTH_CHECK_INTERVAL: 30000,
  CONNECTION_TIMEOUT: 30000,
  
  // Hugging Face specific defaults
  HF_MODEL_CACHE_DIR: './models/huggingface',
  HF_MAX_MODELS_IN_MEMORY: 1,
  HF_DEVICE: 'cpu',
  HF_PRECISION: 'float32',
  
  // Ollama specific defaults
  OLLAMA_BASE_URL: 'http://localhost:11434',
  OLLAMA_TIMEOUT: 30000,
  
  // Generation defaults
  DEFAULT_MAX_TOKENS: 2048,
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_TOP_P: 0.9,
  DEFAULT_TOP_K: 40
};

/**
 * Model name patterns for provider detection
 */
export const MODEL_NAME_PATTERNS = {
  OLLAMA: /^ollama:/,
  HUGGINGFACE: /^hf:/,
  OPENAI: /^openai:/,
  ANTHROPIC: /^anthropic:/
};

/**
 * Health status constants
 */
export const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  UNHEALTHY: 'unhealthy',
  DEGRADED: 'degraded',
  UNKNOWN: 'unknown'
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates a ModelInfo object
 * @param {Object} modelInfo - The model info to validate
 * @returns {boolean} - Whether the model info is valid
 */
export function isValidModelInfo(modelInfo) {
  return !!(modelInfo &&
    typeof modelInfo.name === 'string' &&
    typeof modelInfo.provider === 'string' &&
    typeof modelInfo.displayName === 'string' &&
    typeof modelInfo.available === 'boolean' &&
    modelInfo.capabilities &&
    modelInfo.metadata);
}

/**
 * Validates a ProviderConfig object
 * @param {Object} providerConfig - The provider config to validate
 * @returns {boolean} - Whether the provider config is valid
 */
export function isValidProviderConfig(providerConfig) {
  return !!(providerConfig &&
    typeof providerConfig.name === 'string' &&
    typeof providerConfig.displayName === 'string' &&
    typeof providerConfig.enabled === 'boolean' &&
    typeof providerConfig.priority === 'number');
}

/**
 * Validates a ModelConfig object
 * @param {Object} modelConfig - The model config to validate
 * @returns {boolean} - Whether the model config is valid
 */
export function isValidModelConfig(modelConfig) {
  return !!(modelConfig &&
    typeof modelConfig.modelName === 'string' &&
    typeof modelConfig.provider === 'string' &&
    typeof modelConfig.maxTokens === 'number' &&
    typeof modelConfig.temperature === 'number' &&
    modelConfig.temperature >= 0 && modelConfig.temperature <= 2);
}

/**
 * Validates a GenerationRequest object
 * @param {Object} request - The generation request to validate
 * @returns {boolean} - Whether the generation request is valid
 */
export function isValidGenerationRequest(request) {
  return !!(request &&
    typeof request.model === 'string' &&
    typeof request.prompt === 'string' &&
    request.prompt.length > 0 &&
    typeof request.streaming === 'boolean');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a new ModelInfo object
 * @param {string} name - Model name
 * @param {string} provider - Provider name
 * @param {string} displayName - Display name
 * @returns {Object} - New ModelInfo object
 */
export function createModelInfo(name, provider, displayName) {
  return {
    name,
    provider,
    displayName,
    description: '',
    capabilities: { ...ModelCapabilities },
    metadata: { ...ModelMetadata },
    available: true,
    lastUpdated: new Date()
  };
}

/**
 * Creates a new ProviderConfig object
 * @param {string} name - Provider name
 * @param {string} displayName - Display name
 * @returns {Object} - New ProviderConfig object
 */
export function createProviderConfig(name, displayName) {
  return {
    name,
    displayName,
    enabled: true,
    priority: 0,
    connection: {},
    authentication: {},
    limits: {},
    features: {},
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Creates a new ModelConfig object
 * @param {string} modelName - Model name
 * @param {string} provider - Provider name
 * @returns {Object} - New ModelConfig object
 */
export function createModelConfig(modelName, provider) {
  return {
    modelName,
    provider,
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
 * Extracts provider name from model name
 * @param {string} modelName - Model name with optional provider prefix
 * @returns {string} - Provider name
 */
export function extractProviderFromModel(modelName) {
  if (MODEL_NAME_PATTERNS.HUGGINGFACE.test(modelName)) {
    return PROVIDER_NAMES.HUGGINGFACE;
  }
  if (MODEL_NAME_PATTERNS.OLLAMA.test(modelName)) {
    return PROVIDER_NAMES.OLLAMA;
  }
  if (MODEL_NAME_PATTERNS.OPENAI.test(modelName)) {
    return PROVIDER_NAMES.OPENAI;
  }
  if (MODEL_NAME_PATTERNS.ANTHROPIC.test(modelName)) {
    return PROVIDER_NAMES.ANTHROPIC;
  }
  // Default to Ollama for backward compatibility
  return PROVIDER_NAMES.OLLAMA;
}

/**
 * Adds provider prefix to model name
 * @param {string} modelName - Base model name
 * @param {string} provider - Provider name
 * @returns {string} - Model name with provider prefix
 */
export function addProviderPrefix(modelName, provider) {
  const prefix = PROVIDER_PREFIXES[provider.toUpperCase()];
  if (prefix && !modelName.startsWith(prefix)) {
    return prefix + modelName;
  }
  return modelName;
}

/**
 * Removes provider prefix from model name
 * @param {string} modelName - Model name with provider prefix
 * @returns {string} - Base model name without prefix
 */
export function removeProviderPrefix(modelName) {
  for (const [provider, prefix] of Object.entries(PROVIDER_PREFIXES)) {
    if (modelName.startsWith(prefix)) {
      return modelName.substring(prefix.length);
    }
  }
  return modelName;
} 