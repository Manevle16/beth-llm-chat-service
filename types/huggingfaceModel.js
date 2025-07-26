import { MODEL_PROVIDER } from './modelProvider.js';

/**
 * Creates Hugging Face model metadata object
 * @param {string} modelName - Name of the model
 * @param {Object} config - Configuration options
 * @returns {Object} HF model metadata
 */
export const createHFModelMetadata = (modelName, config = {}) => ({
  name: modelName,
  provider: MODEL_PROVIDER.HUGGING_FACE,
  task: config.task || 'text-generation',
  localPath: config.localPath || null,
  isLoaded: false,
  loadedAt: null,
  lastUsedAt: null,
  memoryUsage: 0,
  requestCount: 0,
  errorCount: 0,
  averageResponseTime: 0,
  config: {
    maxLength: config.maxLength || 512,
    temperature: config.temperature || 0.7,
    topP: config.topP || 0.9,
    topK: config.topK || 50,
    ...config
  }
});

/**
 * Hugging Face model status enumeration
 */
export const HF_MODEL_STATUS = {
  UNLOADED: 'unloaded',
  LOADING: 'loading',
  LOADED: 'loaded',
  ERROR: 'error'
};

/**
 * Supported Hugging Face tasks
 */
export const HF_SUPPORTED_TASKS = {
  TEXT_GENERATION: 'text-generation',
  TEXT2TEXT_GENERATION: 'text2text-generation',
  CONVERSATIONAL: 'conversational',
  QUESTION_ANSWERING: 'question-answering',
  SUMMARIZATION: 'summarization'
};

/**
 * Creates a Hugging Face model configuration object
 * @param {Object} options - Configuration options
 * @returns {Object} HF model configuration
 */
export const createHFModelConfig = (options = {}) => ({
  task: options.task || HF_SUPPORTED_TASKS.TEXT_GENERATION,
  maxLength: options.maxLength || 512,
  temperature: options.temperature || 0.7,
  topP: options.topP || 0.9,
  topK: options.topK || 50,
  doSample: options.doSample !== false,
  numBeams: options.numBeams || 1,
  repetitionPenalty: options.repetitionPenalty || 1.0,
  lengthPenalty: options.lengthPenalty || 1.0,
  earlyStopping: options.earlyStopping || false,
  padTokenId: options.padTokenId || null,
  eosTokenId: options.eosTokenId || null
});

export default {
  createHFModelMetadata,
  createHFModelConfig,
  HF_MODEL_STATUS,
  HF_SUPPORTED_TASKS
};