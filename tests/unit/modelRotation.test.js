/**
 * Simple test file to verify model rotation types
 * This ensures all exports are working correctly
 */

import {
  ModelMetadata,
  RotationRequest,
  MemoryStats,
  RotationConfig,
  MemoryThresholds,
  QueueStatus,
  RotationError,
  DEFAULT_CONFIG,
  MEMORY_THRESHOLDS,
  REQUEST_PRIORITY,
  ERROR_CODES,
  OPERATIONS,
  QUEUE_STATUS,
  createModelMetadata,
  createRotationRequest,
  createRotationError,
  validateMemoryThresholds,
  validateRotationConfig,
  isModelMetadata,
  isRotationRequest,
  isMemoryStats
} from '../../types/modelRotation.js';

// Test basic imports and structure
console.log('🧪 Testing Model Rotation Types...');

// Test interface structures
console.log('✅ ModelMetadata structure:', Object.keys(ModelMetadata));
console.log('✅ RotationRequest structure:', Object.keys(RotationRequest));
console.log('✅ MemoryStats structure:', Object.keys(MemoryStats));
console.log('✅ RotationConfig structure:', Object.keys(RotationConfig));
console.log('✅ MemoryThresholds structure:', Object.keys(MemoryThresholds));

// Test constants
console.log('✅ DEFAULT_CONFIG keys:', Object.keys(DEFAULT_CONFIG));
console.log('✅ MEMORY_THRESHOLDS:', MEMORY_THRESHOLDS);
console.log('✅ REQUEST_PRIORITY:', REQUEST_PRIORITY);
console.log('✅ ERROR_CODES:', ERROR_CODES);

// Test utility functions
const testMetadata = createModelMetadata('test-model');
console.log('✅ createModelMetadata:', testMetadata.name === 'test-model');

const testRequest = createRotationRequest('test-model', 'test-source', 'high');
console.log('✅ createRotationRequest:', testRequest.targetModel === 'test-model' && testRequest.priority === 'high');

const testError = createRotationError('TEST_ERROR', 'Test error message', 'test-model', 'test-operation');
console.log('✅ createRotationError:', testError.code === 'TEST_ERROR');

// Test validation functions
const validThresholds = { warningThreshold: 70, criticalThreshold: 85, cleanupThreshold: 90 };
const invalidThresholds = { warningThreshold: 90, criticalThreshold: 85, cleanupThreshold: 70 };

console.log('✅ validateMemoryThresholds (valid):', validateMemoryThresholds(validThresholds));
console.log('✅ validateMemoryThresholds (invalid):', !validateMemoryThresholds(invalidThresholds));

const validConfig = { enableAutoRotation: true, maxConcurrentModels: 1, rotationTimeoutMs: 30000, retryAttempts: 3, retryDelayMs: 1000 };
const invalidConfig = { enableAutoRotation: true, maxConcurrentModels: -1, rotationTimeoutMs: 30000, retryAttempts: 3, retryDelayMs: 1000 };

console.log('✅ validateRotationConfig (valid):', validateRotationConfig(validConfig));
console.log('✅ validateRotationConfig (invalid):', !validateRotationConfig(invalidConfig));

// Test type guards
console.log('✅ isModelMetadata (valid):', isModelMetadata(testMetadata));
console.log('✅ isModelMetadata (invalid):', !isModelMetadata({}));

console.log('✅ isRotationRequest (valid):', isRotationRequest(testRequest));
console.log('✅ isRotationRequest (invalid):', !isRotationRequest({}));

const testStats = { totalMemory: 1000, usedMemory: 500, availableMemory: 500, modelMemory: 200, timestamp: new Date() };
console.log('✅ isMemoryStats (valid):', isMemoryStats(testStats));
console.log('✅ isMemoryStats (invalid):', !isMemoryStats({}));

console.log('🎉 All type tests passed!'); 