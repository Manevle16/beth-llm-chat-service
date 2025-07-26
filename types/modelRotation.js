/**
 * Model Rotation Types and Interfaces
 * 
 * This module defines all data models, interfaces, and constants
 * for the model rotation strategy feature.
 */

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * @typedef {Object} ModelMetadata
 * @property {string} name - The name of the model
 * @property {string} provider - The provider of the model (e.g., 'ollama', 'huggingface')
 * @property {Date} loadedAt - When the model was loaded
 * @property {Date} lastUsedAt - When the model was last used
 * @property {number} memoryUsage - Memory usage in bytes
 * @property {number} requestCount - Number of requests processed
 */
export const ModelMetadata = {
  name: '',
  provider: '',
  loadedAt: new Date(),
  lastUsedAt: new Date(),
  memoryUsage: 0,
  requestCount: 0
};

/**
 * @typedef {Object} RotationRequest
 * @property {string} provider - The provider of the model
 * @property {string} modelName - The name of the model
 * @property {string} id - Unique request identifier
 * @property {'high' | 'normal' | 'low'} priority - Request priority
 * @property {Date} timestamp - When the request was created
 * @property {string} source - Source of the request (e.g., 'graphql', 'stream')
 */
export const RotationRequest = {
  id: '',
  targetModel: '',
  priority: 'normal',
  timestamp: new Date(),
  source: ''
};

/**
 * @typedef {Object} MemoryStats
 * @property {number} totalMemory - Total system memory in bytes
 * @property {number} usedMemory - Used memory in bytes
 * @property {number} availableMemory - Available memory in bytes
 * @property {number} modelMemory - Memory used by models in bytes
 * @property {Date} timestamp - When the stats were collected
 */
export const MemoryStats = {
  totalMemory: 0,
  usedMemory: 0,
  availableMemory: 0,
  modelMemory: 0,
  timestamp: new Date()
};

/**
 * @typedef {Object} RotationConfig
 * @property {boolean} enableAutoRotation - Whether auto-rotation is enabled
 * @property {number} maxConcurrentModels - Maximum models that can be loaded
 * @property {number} rotationTimeoutMs - Timeout for rotation operations
 * @property {number} retryAttempts - Number of retry attempts for failed operations
 * @property {number} retryDelayMs - Delay between retry attempts
 */
export const RotationConfig = {
  enableAutoRotation: true,
  maxConcurrentModels: 1,
  rotationTimeoutMs: 30000,
  retryAttempts: 3,
  retryDelayMs: 1000
};

/**
 * @typedef {Object} MemoryThresholds
 * @property {number} warningThreshold - Warning threshold percentage (0-100)
 * @property {number} criticalThreshold - Critical threshold percentage (0-100)
 * @property {number} cleanupThreshold - Cleanup threshold percentage (0-100)
 */
export const MemoryThresholds = {
  warningThreshold: 70,
  criticalThreshold: 85,
  cleanupThreshold: 90
};

/**
 * @typedef {Object} QueueStatus
 * @property {number} size - Current queue size
 * @property {number} maxSize - Maximum queue size
 * @property {boolean} isProcessing - Whether queue is currently processing
 * @property {Date} lastProcessed - When last item was processed
 * @property {number} pendingRequests - Number of pending requests
 */
export const QueueStatus = {
  size: 0,
  maxSize: 10,
  isProcessing: false,
  lastProcessed: new Date(),
  pendingRequests: 0
};

/**
 * @typedef {Object} RotationError
 * @property {string} code - Error code
 * @property {string} message - Error message
 * @property {string} modelName - Model involved in the error
 * @property {Date} timestamp - When the error occurred
 * @property {string} operation - Operation that failed
 */
export const RotationError = {
  code: '',
  message: '',
  modelName: '',
  timestamp: new Date(),
  operation: ''
};

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default configuration values for model rotation
 */
export const DEFAULT_CONFIG = {
  // Model Rotation Configuration
  MODEL_ROTATION_ENABLED: true,
  MAX_CONCURRENT_MODELS: 1,
  ROTATION_TIMEOUT_MS: 30000,
  ROTATION_RETRY_ATTEMPTS: 3,
  ROTATION_RETRY_DELAY_MS: 1000,

  // Memory Monitoring Configuration
  MEMORY_WARNING_THRESHOLD: 70,
  MEMORY_CRITICAL_THRESHOLD: 85,
  MEMORY_CLEANUP_THRESHOLD: 90,
  MEMORY_MONITORING_ENABLED: true,

  // Queue Configuration
  MAX_QUEUE_SIZE: 10,
  QUEUE_PROCESSING_INTERVAL_MS: 1000
};

/**
 * Memory threshold constants (percentages)
 */
export const MEMORY_THRESHOLDS = {
  WARNING: 70,
  CRITICAL: 85,
  CLEANUP: 90,
  EMERGENCY: 95
};

/**
 * Request priority levels
 */
export const REQUEST_PRIORITY = {
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'low'
};

/**
 * Error codes for rotation operations
 */
export const ERROR_CODES = {
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  MODEL_LOAD_FAILED: 'MODEL_LOAD_FAILED',
  MODEL_UNLOAD_FAILED: 'MODEL_UNLOAD_FAILED',
  MEMORY_EXHAUSTED: 'MEMORY_EXHAUSTED',
  QUEUE_FULL: 'QUEUE_FULL',
  TIMEOUT: 'TIMEOUT',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR'
};

/**
 * Operation types for logging and error handling
 */
export const OPERATIONS = {
  LOAD_MODEL: 'load_model',
  UNLOAD_MODEL: 'unload_model',
  ROTATE_MODEL: 'rotate_model',
  CHECK_MEMORY: 'check_memory',
  CLEANUP_MODELS: 'cleanup_models',
  SYNC_STATE: 'sync_state'
};

/**
 * Queue status constants
 */
export const QUEUE_STATUS = {
  IDLE: 'idle',
  PROCESSING: 'processing',
  FULL: 'full',
  ERROR: 'error'
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a new ModelMetadata object
 * @param {string} name - Model name
 * @param {string} provider - Provider name
 * @returns {ModelMetadata} New model metadata
 */
export function createModelMetadata(name, provider = '') {
  return {
    name,
    provider,
    loadedAt: new Date(),
    lastUsedAt: new Date(),
    memoryUsage: 0,
    requestCount: 0
  };
}

/**
 * Create a new RotationRequest object
 * @param {string} targetModel - Target model name
 * @param {string} source - Request source
 * @param {'high' | 'normal' | 'low'} priority - Request priority
 * @returns {RotationRequest} New rotation request
 */
export function createRotationRequest({ provider, modelName }, source, priority = REQUEST_PRIORITY.NORMAL) {
  return {
    id: generateRequestId(),
    provider,
    modelName,
    priority,
    timestamp: new Date(),
    source
  };
}

/**
 * Create a new RotationError object
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {string} modelName - Model name
 * @param {string} operation - Operation that failed
 * @returns {RotationError} New rotation error
 */
export function createRotationError(code, message, modelName, operation) {
  return {
    code,
    message,
    modelName,
    timestamp: new Date(),
    operation
  };
}

/**
 * Generate a unique request ID
 * @returns {string} Unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate memory thresholds
 * @param {MemoryThresholds} thresholds - Memory thresholds to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function validateMemoryThresholds(thresholds) {
  return (
    thresholds.warningThreshold >= 0 && thresholds.warningThreshold <= 100 &&
    thresholds.criticalThreshold >= 0 && thresholds.criticalThreshold <= 100 &&
    thresholds.cleanupThreshold >= 0 && thresholds.cleanupThreshold <= 100 &&
    thresholds.warningThreshold < thresholds.criticalThreshold &&
    thresholds.criticalThreshold < thresholds.cleanupThreshold
  );
}

/**
 * Validate rotation configuration
 * @param {RotationConfig} config - Configuration to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function validateRotationConfig(config) {
  return (
    typeof config.enableAutoRotation === 'boolean' &&
    config.maxConcurrentModels > 0 &&
    config.rotationTimeoutMs > 0 &&
    config.retryAttempts >= 0 &&
    config.retryDelayMs >= 0
  );
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if an object is a valid ModelMetadata
 * @param {any} obj - Object to check
 * @returns {boolean} True if valid ModelMetadata
 */
export function isModelMetadata(obj) {
  return (
    obj &&
    typeof obj.name === 'string' &&
    obj.loadedAt instanceof Date &&
    obj.lastUsedAt instanceof Date &&
    typeof obj.memoryUsage === 'number' &&
    typeof obj.requestCount === 'number'
  );
}

/**
 * Check if an object is a valid RotationRequest
 * @param {any} obj - Object to check
 * @returns {boolean} True if valid RotationRequest
 */
export function isRotationRequest(obj) {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.provider === 'string' &&
    typeof obj.modelName === 'string' &&
    Object.values(REQUEST_PRIORITY).includes(obj.priority) &&
    obj.timestamp instanceof Date &&
    typeof obj.source === 'string'
  );
}

/**
 * Check if an object is a valid MemoryStats
 * @param {any} obj - Object to check
 * @returns {boolean} True if valid MemoryStats
 */
export function isMemoryStats(obj) {
  return (
    obj &&
    typeof obj.totalMemory === 'number' &&
    typeof obj.usedMemory === 'number' &&
    typeof obj.availableMemory === 'number' &&
    typeof obj.modelMemory === 'number' &&
    obj.timestamp instanceof Date
  );
} 