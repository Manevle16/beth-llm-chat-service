import { MODEL_PROVIDER, detectProviderFromModel, isValidProvider } from '../types/modelProvider.js';
import ollamaService from './ollamaService.js';
import huggingFaceService from './huggingFaceService.js';

/**
 * ModelRouterService - Routes requests to appropriate model providers
 * Provides a unified interface for interacting with different model providers
 */
class ModelRouterService {
  constructor() {
    this.providers = new Map();
    this.modelProviderMap = new Map();
    this._isInitialized = false;
  }

  /**
   * Initialize the service and register default providers
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    console.log("🔀 Initializing ModelRouterService...");

    try {
      // Register default providers
      this.registerProvider(MODEL_PROVIDER.OLLAMA, ollamaService);
      this.registerProvider(MODEL_PROVIDER.HUGGING_FACE, huggingFaceService);

      // Initialize providers
      await this._initializeProviders();

      // Build model-to-provider mapping
      await this._buildModelProviderMap();

      this._isInitialized = true;
      console.log("✅ ModelRouterService initialized successfully");
      console.log(`📊 Registered providers: ${Array.from(this.providers.keys()).join(', ')}`);
    } catch (error) {
      console.error("❌ Failed to initialize ModelRouterService:", error.message);
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
   * Initialize all registered providers
   * @private
   */
  async _initializeProviders() {
    const initPromises = [];

    for (const [providerName, provider] of this.providers.entries()) {
      if (provider && typeof provider.initialize === 'function') {
        console.log(`🔧 Initializing provider: ${providerName}`);
        initPromises.push(
          provider.initialize().catch(error => {
            console.warn(`⚠️  Failed to initialize provider ${providerName}: ${error.message}`);
          })
        );
      }
    }

    await Promise.all(initPromises);
  }

  /**
   * Build mapping of models to their providers
   * @private
   */
  async _buildModelProviderMap() {
    this.modelProviderMap.clear();

    for (const [providerName, provider] of this.providers.entries()) {
      try {
        if (provider && typeof provider.listModels === 'function') {
          const models = await provider.listModels();
          
          if (Array.isArray(models)) {
            models.forEach(model => {
              const modelName = typeof model === 'string' ? model : model.name;
              if (modelName) {
                this.modelProviderMap.set(modelName, providerName);
              }
            });
          }
        }
      } catch (error) {
        console.warn(`⚠️  Failed to list models for provider ${providerName}: ${error.message}`);
      }
    }

    console.log(`🗺️  Built model-provider mapping for ${this.modelProviderMap.size} models`);
  }

  /**
   * Register a model provider
   * @param {string} name - Provider name (from MODEL_PROVIDER enum)
   * @param {Object} service - Provider service instance
   */
  registerProvider(name, service) {
    if (!isValidProvider(name)) {
      throw new Error(`Invalid provider name: ${name}`);
    }

    if (!service) {
      throw new Error(`Provider service cannot be null for: ${name}`);
    }

    // Validate that the service has required methods
    const requiredMethods = ['generateResponse', 'streamResponse', 'listModels'];
    for (const method of requiredMethods) {
      if (typeof service[method] !== 'function') {
        throw new Error(`Provider ${name} must implement method: ${method}`);
      }
    }

    this.providers.set(name, service);
    console.log(`✅ Registered provider: ${name}`);
  }

  /**
   * Unregister a model provider
   * @param {string} name - Provider name to unregister
   * @returns {boolean} True if provider was unregistered
   */
  unregisterProvider(name) {
    if (this.providers.has(name)) {
      this.providers.delete(name);
      
      // Remove models from mapping that belong to this provider
      for (const [modelName, providerName] of this.modelProviderMap.entries()) {
        if (providerName === name) {
          this.modelProviderMap.delete(modelName);
        }
      }
      
      console.log(`🗑️  Unregistered provider: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Get the provider for a specific model
   * @param {string} modelName - Name of the model
   * @returns {string|null} Provider name or null if not found
   */
  getProviderForModel(modelName) {
    if (!modelName) return null;

    // First check explicit mapping
    if (this.modelProviderMap.has(modelName)) {
      return this.modelProviderMap.get(modelName);
    }

    // Fall back to heuristic detection, but only if the provider is registered and the model exists in its list
    const detectedProvider = detectProviderFromModel(modelName);
    if (this.providers.has(detectedProvider)) {
      // Check if the provider actually has this model
      const provider = this.getProviderService(detectedProvider);
      if (provider && typeof provider.listModels === 'function') {
        // Synchronously check the last known model list (from modelProviderMap)
        for (const [mappedModel, providerName] of this.modelProviderMap.entries()) {
          if (mappedModel === modelName && providerName === detectedProvider) {
            return detectedProvider;
          }
        }
      }
    }

    // No provider found for this model
    return null;
  }

  /**
   * Get the service instance for a provider
   * @param {string} providerName - Name of the provider
   * @returns {Object|null} Provider service instance or null if not found
   */
  getProviderService(providerName) {
    return this.providers.get(providerName) || null;
  }

  /**
   * Route a request to the appropriate provider
   * @param {string} model - Model name
   * @param {string} operation - Operation name (e.g., 'generateResponse', 'streamResponse')
   * @param {...any} args - Arguments to pass to the operation
   * @returns {Promise<any>} Result from the provider operation
   */
  async routeRequest(model, operation, ...args) {
    await this._ensureInitialized();

    if (!model) {
      throw new Error("Model name is required for routing");
    }

    if (!operation) {
      throw new Error("Operation name is required for routing");
    }

    // Get the provider for this model
    const providerName = this.getProviderForModel(model);
    if (!providerName) {
      throw new Error(`No provider found for model: ${model}`);
    }

    // Get the provider service
    const provider = this.getProviderService(providerName);
    if (!provider) {
      throw new Error(`Provider service not found: ${providerName}`);
    }

    // Check if the provider supports the operation
    if (typeof provider[operation] !== 'function') {
      throw new Error(`Provider ${providerName} does not support operation: ${operation}`);
    }

    console.log(`🔀 Routing ${operation} for model ${model} to provider: ${providerName}`);

    try {
      // Route the request to the appropriate provider
      return await provider[operation](model, ...args);
    } catch (error) {
      console.error(`❌ Error routing ${operation} to ${providerName} for model ${model}:`, error.message);
      throw new Error(`Provider ${providerName} error: ${error.message}`);
    }
  }

  /**
   * Generate response using the appropriate provider
   * @param {string} model - Model name to use
   * @param {string} message - User message
   * @param {Array} conversationHistory - Conversation history
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Generated response
   */
  async generateResponse(model, message, conversationHistory = [], options = {}) {
    return await this.routeRequest(model, 'generateResponse', message, conversationHistory, options);
  }

  /**
   * Stream response using the appropriate provider
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

    if (!model) {
      throw new Error("Model name is required for streaming");
    }

    // Get the provider for this model
    const providerName = this.getProviderForModel(model);
    if (!providerName) {
      throw new Error(`No provider found for model: ${model}`);
    }

    // Get the provider service
    const provider = this.getProviderService(providerName);
    if (!provider) {
      throw new Error(`Provider service not found: ${providerName}`);
    }

    // Check if the provider supports streaming
    if (typeof provider.streamResponse !== 'function') {
      throw new Error(`Provider ${providerName} does not support streaming`);
    }

    console.log(`🔀 Routing streamResponse for model ${model} to provider: ${providerName}`);

    try {
      // Stream from the appropriate provider
      for await (const chunk of provider.streamResponse(model, message, conversationHistory, options, terminationCheck, visionMessage)) {
        yield chunk;
      }
    } catch (error) {
      console.error(`❌ Error streaming from ${providerName} for model ${model}:`, error.message);
      throw new Error(`Provider ${providerName} streaming error: ${error.message}`);
    }
  }

  /**
   * List all available models from all providers
   * @returns {Promise<Array>} Array of model info objects
   */
  async listAllModels() {
    await this._ensureInitialized();

    const allModels = [];

    for (const [providerName, provider] of this.providers.entries()) {
      try {
        if (typeof provider.listModels === 'function') {
          const models = await provider.listModels();
          
          if (Array.isArray(models)) {
            // Ensure each model has provider information
            const providerModels = models.map(model => {
              if (typeof model === 'string') {
                return {
                  name: model,
                  provider: providerName,
                  metadata: {}
                };
              } else if (model && typeof model === 'object') {
                return {
                  ...model,
                  provider: model.provider || providerName
                };
              }
              return null;
            }).filter(Boolean);

            allModels.push(...providerModels);
          }
        }
      } catch (error) {
        console.warn(`⚠️  Failed to list models from provider ${providerName}: ${error.message}`);
      }
    }

    console.log(`📋 Listed ${allModels.length} models from ${this.providers.size} providers`);
    return allModels;
  }

  /**
   * Check if a model exists in any provider
   * @param {string} modelName - Name of the model to check
   * @returns {Promise<boolean>} True if model exists
   */
  async checkModelExists(modelName) {
    await this._ensureInitialized();

    if (!modelName) return false;

    // Get the provider for this model
    const providerName = this.getProviderForModel(modelName);
    if (!providerName) return false;

    // Get the provider service
    const provider = this.getProviderService(providerName);
    if (!provider) return false;

    try {
      // Check if provider has checkModelExists method
      if (typeof provider.checkModelExists === 'function') {
        return await provider.checkModelExists(modelName);
      }

      // Fall back to listing models and checking
      const models = await provider.listModels();
      if (Array.isArray(models)) {
        return models.some(model => {
          const name = typeof model === 'string' ? model : model.name;
          return name === modelName;
        });
      }

      return false;
    } catch (error) {
      console.warn(`⚠️  Failed to check model existence for ${modelName}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get registered providers
   * @returns {Array<string>} Array of registered provider names
   */
  getRegisteredProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Get service status
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      initialized: this._isInitialized,
      registeredProviders: this.getRegisteredProviders(),
      modelProviderMappings: this.modelProviderMap.size,
      totalProviders: this.providers.size
    };
  }

  /**
   * Refresh model-provider mappings
   * @returns {Promise<void>}
   */
  async refreshModelMappings() {
    console.log("🔄 Refreshing model-provider mappings...");
    await this._buildModelProviderMap();
    console.log("✅ Model-provider mappings refreshed");
  }

  /**
   * Get model-provider mappings
   * @returns {Map} Map of model names to provider names
   */
  getModelProviderMappings() {
    return new Map(this.modelProviderMap);
  }

  /**
   * Set explicit model-provider mapping
   * @param {string} modelName - Name of the model
   * @param {string} providerName - Name of the provider
   */
  setModelProvider(modelName, providerName) {
    if (!isValidProvider(providerName)) {
      throw new Error(`Invalid provider name: ${providerName}`);
    }

    if (!this.providers.has(providerName)) {
      throw new Error(`Provider not registered: ${providerName}`);
    }

    this.modelProviderMap.set(modelName, providerName);
    console.log(`🔗 Set explicit mapping: ${modelName} -> ${providerName}`);
  }

  /**
   * Remove explicit model-provider mapping
   * @param {string} modelName - Name of the model
   * @returns {boolean} True if mapping was removed
   */
  removeModelProvider(modelName) {
    if (this.modelProviderMap.has(modelName)) {
      this.modelProviderMap.delete(modelName);
      console.log(`🗑️  Removed explicit mapping for: ${modelName}`);
      return true;
    }
    return false;
  }
}

export default new ModelRouterService();