import { pipeline } from '@huggingface/transformers';
import fs from 'fs/promises';
import path from 'path';
import { HUGGING_FACE_CONFIG } from '../config/huggingface.js';
import { createHFModelMetadata, HF_MODEL_STATUS, HF_SUPPORTED_TASKS } from '../types/huggingfaceModel.js';
import { MODEL_PROVIDER, createModelInfo } from '../types/modelProvider.js';

class HuggingFaceService {
  constructor() {
    this.loadedModels = new Map();
    this.modelMetadata = new Map();
    this.modelPath = HUGGING_FACE_CONFIG.MODEL_STORAGE_PATH;
    this._isInitialized = false;
    this.maxCachedModels = HUGGING_FACE_CONFIG.MAX_CACHED_MODELS;
  }

  /**
   * Initialize the service
   * This is called automatically on first use, but can be called explicitly
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    console.log("🤗 Initializing HuggingFaceService...");

    try {
      // Ensure model storage directory exists
      await this._ensureModelDirectory();
      
      // Scan for existing models
      await this._scanLocalModels();

      this._isInitialized = true;
      console.log(`✅ HuggingFaceService initialized successfully`);
      console.log(`📁 Model storage path: ${this.modelPath}`);
      console.log(`🔢 Max cached models: ${this.maxCachedModels}`);
    } catch (error) {
      console.error("❌ Failed to initialize HuggingFaceService:", error.message);
      // Continue with limited functionality
      this._isInitialized = true;
    }
  }

  /**
   * Ensure service is initialized
   * @private
   */
  async _ensureInitialized() {
    if (!this._isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Ensure model directory exists
   * @private
   */
  async _ensureModelDirectory() {
    try {
      await fs.access(this.modelPath);
      console.log(`✅ Model directory exists: ${this.modelPath}`);
    } catch (error) {
      console.log(`📁 Creating model directory: ${this.modelPath}`);
      await fs.mkdir(this.modelPath, { recursive: true });
    }
  }

  /**
   * Scan local models directory for available models
   * @private
   */
  async _scanLocalModels() {
    try {
      const entries = await fs.readdir(this.modelPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const modelName = entry.name;
          const modelDir = path.join(this.modelPath, modelName);
          
          // Check if this looks like a valid model directory
          if (await this._isValidModelDirectory(modelDir)) {
            const metadata = createHFModelMetadata(modelName, {
              localPath: modelDir,
              task: HF_SUPPORTED_TASKS.TEXT_GENERATION
            });
            
            this.modelMetadata.set(modelName, metadata);
            console.log(`📦 Found local model: ${modelName}`);
          }
        }
      }
      
      console.log(`🔍 Scanned ${this.modelMetadata.size} local models`);
    } catch (error) {
      console.warn(`⚠️  Failed to scan local models: ${error.message}`);
    }
  }

  /**
   * Check if directory contains a valid model
   * @private
   * @param {string} modelDir - Directory to check
   * @returns {Promise<boolean>} True if valid model directory
   */
  async _isValidModelDirectory(modelDir) {
    try {
      const files = await fs.readdir(modelDir);
      
      // Look for common model files
      const modelFiles = [
        'config.json',
        'tokenizer.json',
        'pytorch_model.bin',
        'model.safetensors',
        'tokenizer_config.json'
      ];
      
      // Check if at least one model file exists
      return modelFiles.some(file => files.includes(file));
    } catch (error) {
      return false;
    }
  }

  /**
   * Load a model into memory
   * @param {string} modelName - Name of the model to load
   * @param {Object} options - Loading options
   * @returns {Promise<Object>} Loaded model pipeline
   */
  async loadModel(modelName, options = {}) {
    await this._ensureInitialized();

    if (this.isModelLoaded(modelName)) {
      console.log(`✅ Model ${modelName} already loaded`);
      const metadata = this.modelMetadata.get(modelName);
      metadata.lastUsedAt = new Date();
      return this.loadedModels.get(modelName);
    }

    console.log(`🔄 Loading Hugging Face model: ${modelName}`);

    try {
      // Check if we need to evict models due to cache limit
      await this._evictModelsIfNeeded();

      const task = options.task || HF_SUPPORTED_TASKS.TEXT_GENERATION;
      const modelPath = this._getModelPath(modelName);

      // Create pipeline with timeout
      const loadPromise = pipeline(task, modelName, {
        cache_dir: this.modelPath,
        local_files_only: await this.checkModelExists(modelName),
        ...options
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Model loading timeout')), HUGGING_FACE_CONFIG.MODEL_TIMEOUT_MS);
      });

      const model = await Promise.race([loadPromise, timeoutPromise]);

      // Store loaded model
      this.loadedModels.set(modelName, model);

      // Update metadata
      const metadata = this.modelMetadata.get(modelName) || createHFModelMetadata(modelName, options);
      metadata.isLoaded = true;
      metadata.loadedAt = new Date();
      metadata.lastUsedAt = new Date();
      metadata.config = { ...metadata.config, ...options };
      this.modelMetadata.set(modelName, metadata);

      console.log(`✅ Model ${modelName} loaded successfully`);
      return model;

    } catch (error) {
      console.error(`❌ Failed to load model ${modelName}:`, error.message);
      
      // Update metadata with error
      const metadata = this.modelMetadata.get(modelName) || createHFModelMetadata(modelName, options);
      metadata.isLoaded = false;
      metadata.errorCount += 1;
      this.modelMetadata.set(modelName, metadata);

      throw new Error(`Failed to load Hugging Face model '${modelName}': ${error.message}`);
    }
  }

  /**
   * Unload a model from memory
   * @param {string} modelName - Name of the model to unload
   * @returns {Promise<boolean>} True if model was unloaded
   */
  async unloadModel(modelName) {
    await this._ensureInitialized();

    if (!this.isModelLoaded(modelName)) {
      console.log(`ℹ️  Model ${modelName} is not loaded`);
      return false;
    }

    try {
      // Remove from loaded models
      this.loadedModels.delete(modelName);

      // Update metadata
      const metadata = this.modelMetadata.get(modelName);
      if (metadata) {
        metadata.isLoaded = false;
        metadata.loadedAt = null;
      }

      console.log(`✅ Model ${modelName} unloaded successfully`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to unload model ${modelName}:`, error.message);
      return false;
    }
  }

  /**
   * Check if a model exists locally or can be downloaded
   * @param {string} modelName - Name of the model to check
   * @returns {Promise<boolean>} True if model exists
   */
  async checkModelExists(modelName) {
    await this._ensureInitialized();

    // Check if model is in metadata (local)
    if (this.modelMetadata.has(modelName)) {
      const metadata = this.modelMetadata.get(modelName);
      if (metadata.localPath) {
        try {
          await fs.access(metadata.localPath);
          return true;
        } catch (error) {
          // Local path doesn't exist, remove from metadata
          this.modelMetadata.delete(modelName);
        }
      }
    }

    // Check if model directory exists
    const modelDir = path.join(this.modelPath, modelName);
    try {
      await fs.access(modelDir);
      return await this._isValidModelDirectory(modelDir);
    } catch (error) {
      return false;
    }
  }

  /**
   * List all available models (local and discoverable)
   * @returns {Promise<Array>} Array of model info objects
   */
  async listModels() {
    await this._ensureInitialized();

    const models = [];

    // Add models from metadata
    for (const [modelName, metadata] of this.modelMetadata.entries()) {
      const modelInfo = createModelInfo(modelName, MODEL_PROVIDER.HUGGING_FACE, {
        ...metadata,
        isLoaded: this.isModelLoaded(modelName)
      });
      models.push(modelInfo);
    }

    return models;
  }

  /**
   * Get loaded models
   * @returns {Array<string>} Array of loaded model names
   */
  getLoadedModels() {
    return Array.from(this.loadedModels.keys());
  }

  /**
   * Check if a model is loaded
   * @param {string} modelName - Name of the model to check
   * @returns {boolean} True if model is loaded
   */
  isModelLoaded(modelName) {
    return this.loadedModels.has(modelName);
  }

  /**
   * Get model metadata
   * @param {string} modelName - Name of the model
   * @returns {Object|null} Model metadata or null if not found
   */
  getModelMetadata(modelName) {
    return this.modelMetadata.get(modelName) || null;
  }

  /**
   * Get model path for a given model name
   * @private
   * @param {string} modelName - Name of the model
   * @returns {string} Full path to model directory
   */
  _getModelPath(modelName) {
    return path.join(this.modelPath, modelName);
  }

  /**
   * Evict least recently used models if cache is full
   * @private
   */
  async _evictModelsIfNeeded() {
    if (this.loadedModels.size < this.maxCachedModels) {
      return;
    }

    console.log(`🔄 Cache full (${this.loadedModels.size}/${this.maxCachedModels}), evicting LRU model`);

    // Find least recently used model
    let lruModel = null;
    let oldestTime = Date.now();

    for (const [modelName, _] of this.loadedModels.entries()) {
      const metadata = this.modelMetadata.get(modelName);
      if (metadata && metadata.lastUsedAt) {
        const lastUsed = new Date(metadata.lastUsedAt).getTime();
        if (lastUsed < oldestTime) {
          oldestTime = lastUsed;
          lruModel = modelName;
        }
      }
    }

    if (lruModel) {
      console.log(`🗑️  Evicting LRU model: ${lruModel}`);
      await this.unloadModel(lruModel);
    }
  }

  /**
   * Get service status
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      initialized: this._isInitialized,
      modelPath: this.modelPath,
      loadedModels: this.getLoadedModels(),
      totalModels: this.modelMetadata.size,
      cacheUtilization: `${this.loadedModels.size}/${this.maxCachedModels}`
    };
  }

  /**
   * Generate response with a Hugging Face model
   * @param {string} model - Model name to use
   * @param {string} message - User message
   * @param {Array} conversationHistory - Conversation history
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Generated response
   */
  async generateResponse(model, message, conversationHistory = [], options = {}) {
    await this._ensureInitialized();

    try {
      console.log(`🤗 Generating response with Hugging Face model: ${model}`);
      console.log(`📝 Message: ${message}`);
      console.log(`📚 Context messages: ${conversationHistory.length}`);

      // Load the model if not already loaded
      const pipeline = await this.loadModel(model, options);

      // Build conversation context
      const contextText = this.buildConversationContext(conversationHistory, message, model, options.visionMessage);

      // Update metadata
      let metadata = this.modelMetadata.get(model);
      if (!metadata) {
        metadata = createHFModelMetadata(model, options);
        this.modelMetadata.set(model, metadata);
      }
      metadata.lastUsedAt = new Date();
      metadata.requestCount = (metadata.requestCount || 0) + 1;

      const startTime = Date.now();

      // Generate response using the pipeline
      const result = await pipeline(contextText, {
        max_length: options.maxLength || metadata?.config?.maxLength || 512,
        temperature: options.temperature || metadata?.config?.temperature || 0.7,
        top_p: options.topP || metadata?.config?.topP || 0.9,
        top_k: options.topK || metadata?.config?.topK || 50,
        do_sample: true,
        ...options
      });

      const responseTime = Date.now() - startTime;

      // Extract generated text
      let generatedText = '';
      if (Array.isArray(result)) {
        generatedText = result[0]?.generated_text || result[0]?.text || '';
      } else {
        generatedText = result.generated_text || result.text || '';
      }

      // Remove the input context from the generated text if it's included
      if (generatedText.startsWith(contextText)) {
        generatedText = generatedText.slice(contextText.length).trim();
      }

      // Update metadata with performance info
      if (metadata) {
        metadata.averageResponseTime = metadata.averageResponseTime 
          ? (metadata.averageResponseTime + responseTime) / 2 
          : responseTime;
      }

      console.log(`✅ Hugging Face response generated in ${responseTime}ms`);
      return generatedText;

    } catch (error) {
      console.error(`❌ Error generating response with Hugging Face model ${model}:`, error);

      // Update error count in metadata
      let metadata = this.modelMetadata.get(model);
      if (!metadata) {
        metadata = createHFModelMetadata(model, options);
        this.modelMetadata.set(model, metadata);
      }
      metadata.errorCount = (metadata.errorCount || 0) + 1;

      // Handle specific errors
      if (error.message.includes('model not found') || error.message.includes('does not exist')) {
        throw new Error(`Hugging Face model '${model}' not found. Please ensure it's available locally.`);
      } else if (error.message.includes('timeout')) {
        throw new Error(`Hugging Face model '${model}' timed out during generation.`);
      } else {
        throw new Error(`Hugging Face generation error: ${error.message}`);
      }
    }
  }

  /**
   * Stream response with a Hugging Face model
   * @param {string} model - Model name to use
   * @param {string} message - User message
   * @param {Array} conversationHistory - Conversation history
   * @param {Object} options - Additional options
   * @param {Function} terminationCheck - Optional function to check for termination
   * @param {Array} visionMessage - Optional vision message for image support
   * @returns {AsyncGenerator<string>} Streamed response tokens
   */
  async *streamResponse(model, message, conversationHistory = [], options = {}, terminationCheck = null, visionMessage = null) {
    await this._ensureInitialized();

    try {
      console.log(`🤗 Streaming response with Hugging Face model: ${model}`);
      console.log(`📝 Message: ${message}`);
      console.log(`📚 Context messages: ${conversationHistory.length}`);

      // Load the model if not already loaded
      const pipeline = await this.loadModel(model, options);

      // Build conversation context with vision support
      const contextText = this.buildConversationContext(conversationHistory, message, model, visionMessage);

      // Update metadata
      let metadata = this.modelMetadata.get(model);
      if (!metadata) {
        metadata = createHFModelMetadata(model, options);
        this.modelMetadata.set(model, metadata);
      }
      metadata.lastUsedAt = new Date();
      metadata.requestCount = (metadata.requestCount || 0) + 1;

      const startTime = Date.now();

      // For streaming, we'll generate the full response and then chunk it
      // Note: @huggingface/transformers doesn't support true streaming like Ollama
      // This is a simulation of streaming by chunking the response
      const result = await pipeline(contextText, {
        max_length: options.maxLength || metadata?.config?.maxLength || 512,
        temperature: options.temperature || metadata?.config?.temperature || 0.7,
        top_p: options.topP || metadata?.config?.topP || 0.9,
        top_k: options.topK || metadata?.config?.topK || 50,
        do_sample: true,
        ...options
      });

      // Extract generated text
      let generatedText = '';
      if (Array.isArray(result)) {
        generatedText = result[0]?.generated_text || result[0]?.text || '';
      } else {
        generatedText = result.generated_text || result.text || '';
      }

      // Remove the input context from the generated text if it's included
      if (generatedText.startsWith(contextText)) {
        generatedText = generatedText.slice(contextText.length).trim();
      }

      const responseTime = Date.now() - startTime;

      // Update metadata with performance info
      if (metadata) {
        metadata.averageResponseTime = metadata.averageResponseTime 
          ? (metadata.averageResponseTime + responseTime) / 2 
          : responseTime;
      }

      // Stream the response in chunks
      const chunkSize = HUGGING_FACE_CONFIG.STREAM_CHUNK_SIZE;
      const words = generatedText.split(' ');
      let currentChunk = '';
      
      for (let i = 0; i < words.length; i++) {
        // Check for termination if callback provided
        if (terminationCheck && typeof terminationCheck === 'function') {
          try {
            const shouldTerminate = await terminationCheck();
            if (shouldTerminate) {
              console.log(`🛑 Stream terminated during Hugging Face streaming for model: ${model}`);
              return;
            }
          } catch (checkError) {
            console.warn(`⚠️  Termination check failed: ${checkError.message}`);
          }
        }

        currentChunk += (i > 0 ? ' ' : '') + words[i];
        
        // Yield chunk when it reaches the desired size or at the end
        if (currentChunk.length >= chunkSize || i === words.length - 1) {
          yield currentChunk;
          currentChunk = '';
          
          // Add a small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      console.log(`✅ Hugging Face streaming completed in ${responseTime}ms`);

    } catch (error) {
      console.error(`❌ Error streaming from Hugging Face model ${model}:`, error);

      // Update error count in metadata
      let metadata = this.modelMetadata.get(model);
      if (!metadata) {
        metadata = createHFModelMetadata(model, options);
        this.modelMetadata.set(model, metadata);
      }
      metadata.errorCount = (metadata.errorCount || 0) + 1;

      // Handle specific errors
      if (error.message.includes('model not found') || error.message.includes('does not exist')) {
        throw new Error(`Hugging Face model '${model}' not found. Please ensure it's available locally.`);
      } else if (error.message.includes('timeout')) {
        throw new Error(`Hugging Face model '${model}' timed out during streaming.`);
      } else {
        throw new Error(`Hugging Face streaming error: ${error.message}`);
      }
    }
  }

  /**
   * Build conversation context from history and current message
   * @param {Array} conversationHistory - Conversation history
   * @param {string} currentMessage - Current user message
   * @param {string} model - Model name (for special handling)
   * @param {Array} visionMessage - Optional vision message for image support
   * @returns {string} Formatted context text for Hugging Face models
   */
  buildConversationContext(conversationHistory, currentMessage, model, visionMessage = null) {
    let contextText = '';

    // Add system prompt for Hugging Face models
    contextText += 'You are a helpful AI assistant. Please provide clear and accurate responses.\n\n';

    // Add conversation history
    conversationHistory.forEach((msg) => {
      const role = msg.sender === "user" ? "Human" : "Assistant";
      contextText += `${role}: ${msg.text}\n`;
    });

    // Add current user message
    contextText += `Human: ${currentMessage}\n`;

    // Add image context if vision message is provided
    if (visionMessage && Array.isArray(visionMessage) && visionMessage.length > 0) {
      contextText += `[Note: This message includes ${visionMessage.length} image(s) for context]\n`;
    }

    // Add assistant prompt
    contextText += 'Assistant:';

    return contextText;
  }

  /**
   * Clear all loaded models
   * @returns {Promise<void>}
   */
  async clearCache() {
    console.log("🧹 Clearing all loaded models from cache");
    
    const modelNames = Array.from(this.loadedModels.keys());
    for (const modelName of modelNames) {
      await this.unloadModel(modelName);
    }
    
    console.log("✅ Cache cleared successfully");
  }
}

export default new HuggingFaceService();