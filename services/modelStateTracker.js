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
    this._activeModels = new Map(); // Map<provider, modelName>
    this._modelMetadata = new Map(); // Map<provider, Map<modelName, ModelMetadata>>
    this._isInitialized = false;
    this._ollama = new Ollama({
      host: process.env.OLLAMA_HOST || "http://localhost:11434"
    });
  }

  async initialize() {
    if (this._isInitialized) return;
    await this.syncWithProviders();
    this._isInitialized = true;
  }

  // Sync state from all providers (Ollama, HuggingFace, etc.)
  async syncWithProviders() {
    await this.syncWithOllama();
    // TODO: Add syncWithHuggingFace, etc.
  }

  // Sync Ollama models
  async syncWithOllama() {
    const provider = 'ollama';
    try {
      const models = await this._ollama.list();
      if (!this._modelMetadata.has(provider)) {
        this._modelMetadata.set(provider, new Map());
      }
      const providerMap = this._modelMetadata.get(provider);
      providerMap.clear();
      this._activeModels.delete(provider);
      for (const model of models.models) {
        const modelName = model.name;
        const metadata = createModelMetadata(modelName, provider);
        metadata.memoryUsage = model.size || 0;
        providerMap.set(modelName, metadata);
      }
      // If only one model is loaded, consider it active
      if (models.models.length === 1) {
        this._activeModels.set(provider, models.models[0].name);
      }
    } catch (error) {
      // ignore for now
    }
  }

  // Set active model for a provider
  async setActiveModel(provider, modelName) {
    this._ensureInitialized();
    if (!provider || !modelName) throw new Error('Provider and modelName required');
    if (!this._modelMetadata.has(provider)) {
      this._modelMetadata.set(provider, new Map());
    }
    const providerMap = this._modelMetadata.get(provider);
    if (!providerMap.has(modelName)) {
      providerMap.set(modelName, createModelMetadata(modelName, provider));
    }
    this._activeModels.set(provider, modelName);
    this._updateModelUsage(provider, modelName);
    // Debug output
    console.log(`[DEBUG] setActiveModel called:`, provider, modelName, this.getStateSummary());
  }

  // Get active model for a provider
  getActiveModel(provider) {
    this._ensureInitialized();
    return this._activeModels.get(provider) || null;
  }

  // Get metadata for a specific model/provider
  getModelMetadata(provider, modelName) {
    this._ensureInitialized();
    if (!this._modelMetadata.has(provider)) return null;
    return this._modelMetadata.get(provider).get(modelName) || null;
  }

  // Get all metadata for a provider
  getAllModelMetadata(provider) {
    this._ensureInitialized();
    if (!this._modelMetadata.has(provider)) return [];
    return Array.from(this._modelMetadata.get(provider).values());
  }

  // Check if a model is loaded for a provider
  isModelLoaded(provider, modelName) {
    this._ensureInitialized();
    if (!this._modelMetadata.has(provider)) return false;
    return this._modelMetadata.get(provider).has(modelName);
  }

  // Remove a model from tracking for a provider
  removeModel(provider, modelName) {
    this._ensureInitialized();
    if (!this._modelMetadata.has(provider)) return false;
    const providerMap = this._modelMetadata.get(provider);
    const wasRemoved = providerMap.delete(modelName);
    if (wasRemoved && this._activeModels.get(provider) === modelName) {
      this._activeModels.delete(provider);
    }
    return wasRemoved;
  }

  // Get state summary for all providers
  getStateSummary() {
    this._ensureInitialized();
    const summary = {};
    for (const [provider, providerMap] of this._modelMetadata.entries()) {
      summary[provider] = {
        activeModel: this._activeModels.get(provider) || null,
        loadedModelCount: providerMap.size,
        loadedModels: Array.from(providerMap.keys())
      };
    }
    summary.isInitialized = this._isInitialized;
    return summary;
  }

  // Reset all state
  reset() {
    this._activeModels.clear();
    this._modelMetadata.clear();
    this._isInitialized = false;
  }

  // PRIVATE: Ensure initialized
  _ensureInitialized() {
    if (!this._isInitialized) {
      throw new Error("ModelStateTracker not initialized. Call initialize() first.");
    }
  }

  // PRIVATE: Update model usage
  _updateModelUsage(provider, modelName) {
    if (this._modelMetadata.has(provider)) {
      const providerMap = this._modelMetadata.get(provider);
      if (providerMap.has(modelName)) {
        const metadata = providerMap.get(modelName);
        metadata.lastUsedAt = new Date();
        metadata.requestCount++;
        providerMap.set(modelName, metadata);
      }
    }
  }
}

export default new ModelStateTracker(); 