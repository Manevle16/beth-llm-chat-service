/**
 * Model State Tracker Service
 * 
 * This service tracks currently loaded models in Ollama and maintains
 * metadata about model usage, loading times, and state synchronization.
 */

import { Ollama } from "ollama";
import {
  createModelMetadata,
  isModelMetadata,
  ModelMetadata
} from "../types/modelRotation.js";
import configService from "../config/modelRotation.js";

class ModelStateTracker {
  constructor() {
    this._activeModel = null;
    this._modelMetadata = new Map(); // Map<modelName, ModelMetadata>
    this._isInitialized = false;
    this._ollama = new Ollama({
      host: process.env.OLLAMA_HOST || "http://localhost:11434"
    });
  }

  /**
   * Initialize the state tracker
   * Syncs with Ollama to recover current state
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    console.log("🔄 Initializing Model State Tracker...");

    try {
      await this.syncWithOllama();
      this._isInitialized = true;
      console.log("✅ Model State Tracker initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Model State Tracker:", error.message);
      // Continue with empty state - will sync when Ollama becomes available
      this._isInitialized = true;
    }
  }

  /**
   * Get the currently active model
   * @returns {string|null} Name of active model or null if none
   */
  getActiveModel() {
    this._ensureInitialized();
    return this._activeModel;
  }

  /**
   * Set the active model and update metadata
   * @param {string} modelName - Name of the model to set as active
   */
  async setActiveModel(modelName) {
    this._ensureInitialized();

    if (!modelName || typeof modelName !== 'string') {
      throw new Error("Invalid model name provided");
    }

    console.log(`🔄 Setting active model: ${modelName}`);

    // If same model is already active, just update last used time
    if (this._activeModel === modelName) {
      this._updateModelUsage(modelName);
      console.log(`✅ Model ${modelName} already active, updated usage time`);
      return;
    }

    // Clear previous active model
    if (this._activeModel) {
      await this.clearActiveModel();
    }

    // Set new active model
    this._activeModel = modelName;
    
    // Create or update metadata
    if (!this._modelMetadata.has(modelName)) {
      this._modelMetadata.set(modelName, createModelMetadata(modelName));
    } else {
      this._updateModelUsage(modelName);
    }

    console.log(`✅ Active model set to: ${modelName}`);
  }

  /**
   * Clear the active model
   * @returns {boolean} True if model was cleared, false if none was active
   */
  async clearActiveModel() {
    this._ensureInitialized();

    if (!this._activeModel) {
      return false;
    }

    const modelName = this._activeModel;
    console.log(`🔄 Clearing active model: ${modelName}`);

    // Update metadata before clearing
    if (this._modelMetadata.has(modelName)) {
      const metadata = this._modelMetadata.get(modelName);
      metadata.lastUsedAt = new Date();
      this._modelMetadata.set(modelName, metadata);
    }

    this._activeModel = null;
    console.log(`✅ Active model cleared: ${modelName}`);
    return true;
  }

  /**
   * Sync state with Ollama to recover current loaded models
   * @returns {Promise<void>}
   */
  async syncWithOllama() {
    console.log("🔄 Syncing model state with Ollama...");

    try {
      // Check if Ollama is running
      const models = await this._ollama.list();
      console.log(`📋 Found ${models.models.length} models in Ollama`);

      // Clear current state
      this._activeModel = null;
      this._modelMetadata.clear();

      // Process loaded models
      for (const model of models.models) {
        const modelName = model.name;
        
        // Create metadata for each model
        const metadata = createModelMetadata(modelName);
        metadata.memoryUsage = model.size || 0;
        
        this._modelMetadata.set(modelName, metadata);
        
        // If only one model is loaded, consider it active
        if (models.models.length === 1) {
          this._activeModel = modelName;
          console.log(`✅ Detected single active model: ${modelName}`);
        }
      }

      console.log("✅ Model state synced with Ollama");
    } catch (error) {
      console.error("❌ Failed to sync with Ollama:", error.message);
      throw new Error(`Ollama sync failed: ${error.message}`);
    }
  }

  /**
   * Get metadata for a specific model
   * @param {string} modelName - Name of the model
   * @returns {ModelMetadata|null} Model metadata or null if not found
   */
  getModelMetadata(modelName) {
    this._ensureInitialized();
    
    if (!modelName || typeof modelName !== 'string') {
      return null;
    }

    return this._modelMetadata.get(modelName) || null;
  }

  /**
   * Get metadata for all tracked models
   * @returns {ModelMetadata[]} Array of all model metadata
   */
  getAllModelMetadata() {
    this._ensureInitialized();
    return Array.from(this._modelMetadata.values());
  }

  /**
   * Check if a model is currently loaded
   * @param {string} modelName - Name of the model to check
   * @returns {boolean} True if model is loaded, false otherwise
   */
  isModelLoaded(modelName) {
    this._ensureInitialized();
    
    if (!modelName || typeof modelName !== 'string') {
      return false;
    }

    return this._modelMetadata.has(modelName);
  }

  /**
   * Get the number of loaded models
   * @returns {number} Number of currently loaded models
   */
  getLoadedModelCount() {
    this._ensureInitialized();
    return this._modelMetadata.size;
  }

  /**
   * Get the least recently used model
   * @returns {string|null} Name of least recently used model or null if none
   */
  getLeastRecentlyUsedModel() {
    this._ensureInitialized();

    if (this._modelMetadata.size === 0) {
      return null;
    }

    let lruModel = null;
    let earliestTime = new Date();

    for (const [modelName, metadata] of this._modelMetadata) {
      if (metadata.lastUsedAt < earliestTime) {
        earliestTime = metadata.lastUsedAt;
        lruModel = modelName;
      }
    }

    return lruModel;
  }

  /**
   * Remove a model from tracking
   * @param {string} modelName - Name of the model to remove
   * @returns {boolean} True if model was removed, false if not found
   */
  removeModel(modelName) {
    this._ensureInitialized();

    if (!modelName || typeof modelName !== 'string') {
      return false;
    }

    const wasRemoved = this._modelMetadata.delete(modelName);
    
    // If this was the active model, clear it
    if (wasRemoved && this._activeModel === modelName) {
      this._activeModel = null;
    }

    if (wasRemoved) {
      console.log(`🗑️  Removed model from tracking: ${modelName}`);
    }

    return wasRemoved;
  }

  /**
   * Get current state summary
   * @returns {Object} Summary of current state
   */
  getStateSummary() {
    this._ensureInitialized();

    return {
      activeModel: this._activeModel,
      loadedModelCount: this._modelMetadata.size,
      loadedModels: Array.from(this._modelMetadata.keys()),
      isInitialized: this._isInitialized
    };
  }

  /**
   * Reset the state tracker
   * Clears all state and metadata
   */
  reset() {
    console.log("🔄 Resetting Model State Tracker...");
    
    this._activeModel = null;
    this._modelMetadata.clear();
    this._isInitialized = false;
    
    console.log("✅ Model State Tracker reset");
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Ensure the service is initialized before use
   * @private
   */
  _ensureInitialized() {
    if (!this._isInitialized) {
      throw new Error("ModelStateTracker not initialized. Call initialize() first.");
    }
  }

  /**
   * Update model usage statistics
   * @param {string} modelName - Name of the model
   * @private
   */
  _updateModelUsage(modelName) {
    if (this._modelMetadata.has(modelName)) {
      const metadata = this._modelMetadata.get(modelName);
      metadata.lastUsedAt = new Date();
      metadata.requestCount++;
      this._modelMetadata.set(modelName, metadata);
    }
  }

  /**
   * Validate model metadata
   * @param {ModelMetadata} metadata - Metadata to validate
   * @returns {boolean} True if valid, false otherwise
   * @private
   */
  _validateMetadata(metadata) {
    return isModelMetadata(metadata);
  }
}

// Export singleton instance
export default new ModelStateTracker(); 