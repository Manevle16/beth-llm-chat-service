# Design Document

## Overview

This design document outlines the integration of Hugging Face models using the @huggingface/transformers library into the existing LLM chat service. The integration will extend the current architecture to support both Ollama and Hugging Face models through a unified interface, maintaining consistency with existing patterns while adding new capabilities.

The design follows the established service-oriented architecture with proper separation of concerns, error handling, and state management. The integration will be transparent to client applications, allowing seamless switching between Ollama and Hugging Face models.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    Client[Client Application] --> API[GraphQL/REST API]
    API --> ModelRouter[Model Router Service]
    ModelRouter --> OllamaService[Ollama Service]
    ModelRouter --> HuggingFaceService[Hugging Face Service]
    
    HuggingFaceService --> HFTransformers[@huggingface/transformers]
    HuggingFaceService --> ModelStorage[Local Model Storage]
    HuggingFaceService --> ModelStateTracker[Model State Tracker]
    
    ModelRouter --> ModelRotationService[Model Rotation Service]
    ModelRotationService --> QueueService[Queue Service]
    ModelRotationService --> MemoryMonitor[Memory Monitor]
    
    subgraph "Configuration"
        Config[Configuration Service]
        HFConfig[HF Configuration]
    end
    
    subgraph "Database"
        DB[(PostgreSQL)]
        StreamSessions[Stream Sessions]
        Messages[Messages]
    end
```

### Service Layer Design

The integration will introduce several new services while extending existing ones:

1. **HuggingFaceService** - Core service for HF model operations
2. **ModelRouterService** - Routes requests to appropriate model provider
3. **HuggingFaceModelManager** - Manages HF model lifecycle
4. **Extended ModelRotationService** - Supports both Ollama and HF models
5. **Extended Configuration** - HF-specific configuration management

## Components and Interfaces

### 1. HuggingFaceService

Primary service for handling Hugging Face model operations:

```javascript
class HuggingFaceService {
  constructor() {
    this.pipeline = null;
    this.loadedModels = new Map();
    this.modelPath = null;
    this._isInitialized = false;
  }

  async initialize()
  async listModels()
  async generateResponse(model, message, conversationHistory, options)
  async *streamResponse(model, message, conversationHistory, options, terminationCheck)
  async loadModel(modelName)
  async unloadModel(modelName)
  async checkModelExists(modelName)
  getLoadedModels()
  isModelLoaded(modelName)
}
```

### 2. ModelRouterService

Routes requests to the appropriate model provider based on model name:

```javascript
class ModelRouterService {
  constructor() {
    this.providers = new Map();
    this.modelProviderMap = new Map();
  }

  registerProvider(name, service)
  async routeRequest(model, operation, ...args)
  async listAllModels()
  getProviderForModel(modelName)
  async generateResponse(model, message, conversationHistory, options)
  async *streamResponse(model, message, conversationHistory, options, terminationCheck)
}
```

### 3. HuggingFaceModelManager

Manages the lifecycle of Hugging Face models:

```javascript
class HuggingFaceModelManager {
  constructor() {
    this.modelCache = new Map();
    this.modelMetadata = new Map();
    this.maxCacheSize = 3;
  }

  async loadModel(modelName, options)
  async unloadModel(modelName)
  async getModel(modelName)
  async scanLocalModels()
  async downloadModel(modelName, options)
  getCacheStatus()
  clearCache()
}
```

### 4. Configuration Extensions

Extended configuration to support Hugging Face settings:

```javascript
// config/huggingface.js
export const HUGGING_FACE_CONFIG = {
  MODEL_STORAGE_PATH: process.env.HF_MODEL_PATH || './models/huggingface',
  MAX_CACHED_MODELS: parseInt(process.env.HF_MAX_CACHED_MODELS) || 3,
  DEFAULT_TASK: process.env.HF_DEFAULT_TASK || 'text-generation',
  ENABLE_GPU: process.env.HF_ENABLE_GPU === 'true',
  MODEL_TIMEOUT_MS: parseInt(process.env.HF_MODEL_TIMEOUT_MS) || 30000,
  STREAM_CHUNK_SIZE: parseInt(process.env.HF_STREAM_CHUNK_SIZE) || 50
};
```

## Data Models

### 1. Model Provider Types

```javascript
// types/modelProvider.js
export const MODEL_PROVIDER = {
  OLLAMA: 'ollama',
  HUGGING_FACE: 'huggingface'
};

export const createModelInfo = (name, provider, metadata = {}) => ({
  name,
  provider,
  metadata: {
    size: metadata.size || 0,
    task: metadata.task || 'text-generation',
    loadedAt: metadata.loadedAt || null,
    lastUsedAt: metadata.lastUsedAt || null,
    memoryUsage: metadata.memoryUsage || 0,
    ...metadata
  }
});
```

### 2. Hugging Face Model Metadata

```javascript
// types/huggingfaceModel.js
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
```

### 3. Extended Stream Session

```javascript
// Extend existing stream session to include provider info
export const createStreamSession = (conversationId, model, provider = null) => ({
  id: generateSessionId(),
  conversationId,
  model,
  provider: provider || detectProviderFromModel(model),
  status: STREAM_STATUS.ACTIVE,
  createdAt: new Date(),
  lastActivityAt: new Date(),
  tokenCount: 0,
  partialResponse: '',
  terminationReason: null
});
```

## Error Handling

### 1. Hugging Face Specific Errors

```javascript
// types/huggingfaceErrors.js
export const HF_ERROR_CODES = {
  MODEL_NOT_FOUND: 'HF_MODEL_NOT_FOUND',
  MODEL_LOAD_FAILED: 'HF_MODEL_LOAD_FAILED',
  PIPELINE_ERROR: 'HF_PIPELINE_ERROR',
  GENERATION_FAILED: 'HF_GENERATION_FAILED',
  MEMORY_EXCEEDED: 'HF_MEMORY_EXCEEDED',
  TIMEOUT: 'HF_TIMEOUT',
  INVALID_CONFIG: 'HF_INVALID_CONFIG'
};

export const createHFError = (code, message, operation, details = {}) => ({
  code,
  message,
  operation,
  provider: MODEL_PROVIDER.HUGGING_FACE,
  timestamp: new Date(),
  details
});
```

### 2. Error Recovery Strategies

- **Model Loading Failures**: Retry with exponential backoff, fallback to CPU if GPU fails
- **Generation Errors**: Retry with different parameters, fallback to Ollama models
- **Memory Issues**: Unload least recently used models, reduce batch size
- **Timeout Handling**: Configurable timeouts with graceful degradation

## Testing Strategy

### 1. Unit Tests

- **HuggingFaceService**: Model loading, generation, streaming, error handling
- **ModelRouterService**: Request routing, provider selection, fallback logic
- **HuggingFaceModelManager**: Model lifecycle, caching, metadata management
- **Configuration**: Environment variable parsing, validation, defaults

### 2. Integration Tests

- **End-to-End Model Usage**: Complete request flow from API to response
- **Model Rotation**: HF models in rotation with Ollama models
- **Stream Termination**: Proper cleanup of HF streaming sessions
- **Error Scenarios**: Network failures, model failures, memory issues

### 3. Performance Tests

- **Model Loading Time**: Benchmark model initialization
- **Generation Speed**: Compare HF vs Ollama response times
- **Memory Usage**: Monitor memory consumption patterns
- **Concurrent Requests**: Test multiple simultaneous HF model requests

### 4. Load Tests

- **High Concurrency**: Multiple users with different models
- **Model Switching**: Rapid switching between providers
- **Long-Running Streams**: Extended streaming sessions
- **Memory Pressure**: Sustained high memory usage scenarios

## Implementation Phases

### Phase 1: Core Infrastructure
- HuggingFaceService implementation
- ModelRouterService implementation
- Basic configuration and error handling
- Unit tests for core services

### Phase 2: Model Management
- HuggingFaceModelManager implementation
- Model discovery and metadata
- Local storage management
- Model lifecycle tests

### Phase 3: API Integration
- Extend GraphQL resolvers
- Update availableModels query
- Modify stream-message endpoint
- Integration tests

### Phase 4: Advanced Features
- Model rotation integration
- Performance optimization
- Memory management
- Load testing and optimization

### Phase 5: Production Readiness
- Comprehensive error handling
- Monitoring and logging
- Documentation
- Performance tuning

## Security Considerations

### 1. Model Storage Security
- Secure local model storage with appropriate file permissions
- Validation of model files before loading
- Protection against path traversal attacks

### 2. Resource Management
- Memory usage limits to prevent DoS
- CPU usage monitoring and throttling
- Disk space management for model storage

### 3. Input Validation
- Sanitization of model names and parameters
- Validation of conversation history
- Protection against injection attacks

## Performance Considerations

### 1. Model Loading Optimization
- Lazy loading of models on first use
- Model caching with LRU eviction
- Parallel model loading where possible

### 2. Generation Optimization
- Streaming response implementation
- Batch processing for multiple requests
- GPU utilization when available

### 3. Memory Management
- Automatic model unloading based on usage
- Memory monitoring and alerts
- Garbage collection optimization

## Monitoring and Observability

### 1. Metrics Collection
- Model loading times and success rates
- Generation response times and token counts
- Memory usage per model
- Error rates by error type

### 2. Logging Strategy
- Structured logging with correlation IDs
- Model operation audit trail
- Performance metrics logging
- Error context preservation

### 3. Health Checks
- Model availability checks
- Memory usage monitoring
- Disk space monitoring
- Service dependency checks