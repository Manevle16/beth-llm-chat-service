import * as fs from 'fs/promises';
import path from 'path';
import { HUGGING_FACE_CONFIG } from '../config/huggingface.js';
import { createHFModelMetadata, HF_MODEL_STATUS } from '../types/huggingfaceModel.js';

class HuggingFaceModelManager {
  constructor() {
    this.loadedModels = new Map(); // modelName -> model instance
    this.modelMetadata = new Map(); // modelName -> metadata
    this.modelPath = HUGGING_FACE_CONFIG.MODEL_STORAGE_PATH;
    this.maxCachedModels = HUGGING_FACE_CONFIG.MAX_CACHED_MODELS;
    this._isInitialized = false;
  }

  async initialize() {
    if (this._isInitialized) return;
    await this._ensureModelDirectory();
    await this.scanLocalModels();
    this._isInitialized = true;
  }

  async _ensureModelDirectory() {
    try {
      await fs.access(this.modelPath);
    } catch {
      await fs.mkdir(this.modelPath, { recursive: true });
    }
  }

  async scanLocalModels() {
    this.modelMetadata.clear();
    try {
      const entries = await fs.readdir(this.modelPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const modelName = entry.name;
          const modelDir = path.join(this.modelPath, modelName);
          if (await this._isValidModelDirectory(modelDir)) {
            const metadata = createHFModelMetadata(modelName, { localPath: modelDir });
            this.modelMetadata.set(modelName, metadata);
          }
        }
      }
    } catch (err) {
      // ignore
    }
  }

  async _isValidModelDirectory(modelDir) {
    try {
      const files = await fs.readdir(modelDir);
      const modelFiles = [
        'config.json',
        'tokenizer.json',
        'pytorch_model.bin',
        'model.safetensors',
        'tokenizer_config.json'
      ];
      return modelFiles.some(file => files.includes(file));
    } catch {
      return false;
    }
  }

  async loadModel(modelName, modelInstance) {
    await this.initialize();
    if (this.loadedModels.has(modelName)) {
      const metadata = this.modelMetadata.get(modelName);
      metadata.lastUsedAt = new Date();
      return this.loadedModels.get(modelName);
    }
    await this.evictModelsIfNeeded();
    this.loadedModels.set(modelName, modelInstance);
    let metadata = this.modelMetadata.get(modelName) || createHFModelMetadata(modelName);
    metadata.isLoaded = true;
    metadata.loadedAt = new Date();
    metadata.lastUsedAt = new Date();
    this.modelMetadata.set(modelName, metadata);
    return modelInstance;
  }

  async unloadModel(modelName) {
    if (!this.loadedModels.has(modelName)) return false;
    this.loadedModels.delete(modelName);
    const metadata = this.modelMetadata.get(modelName);
    if (metadata) {
      metadata.isLoaded = false;
      metadata.loadedAt = null;
    }
    return true;
  }

  async evictModelsIfNeeded() {
    if (this.loadedModels.size < this.maxCachedModels) return;
    let lruModel = null;
    let oldestTime = Date.now();
    for (const [modelName] of this.loadedModels.entries()) {
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
      await this.unloadModel(lruModel);
    }
  }

  listModels() {
    return Array.from(this.modelMetadata.values());
  }

  getModelMetadata(modelName) {
    return this.modelMetadata.get(modelName) || null;
  }
}

export default new HuggingFaceModelManager(); 