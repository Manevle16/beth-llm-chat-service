/**
 * Model Rotation Service
 * 
 * This service orchestrates model loading/unloading operations with error recovery,
 * retry mechanisms, and integration with QueueService for sequential processing.
 */

import { Ollama } from "ollama";
import huggingFaceService from './huggingFaceService.js';
import {
  createRotationError,
  ERROR_CODES,
  OPERATIONS,
  REQUEST_PRIORITY
} from "../types/modelRotation.js";
import configService from "../config/modelRotation.js";
import modelStateTracker from "./modelStateTracker.js";
import memoryMonitor from "./memoryMonitor.js";
import queueService from "./queueService.js";

class ModelRotationService {
  constructor() {
    this._ollama = new Ollama({
      host: process.env.OLLAMA_HOST || "http://localhost:11434"
    });
    // TODO: Add HuggingFaceService, etc.
    this._isInitialized = false;
    this._isRotating = false;
    this._currentRotation = null;
    this._rotationHistory = [];
    this._failedRotations = [];
  }

  /**
   * Initialize the model rotation service
   * Sets up dependencies and validates configuration
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    console.log("🔄 Initializing Model Rotation Service...");

    try {
      // Initialize dependencies
      configService.initialize();
      await modelStateTracker.initialize();
      await memoryMonitor.initialize();
      await queueService.initialize();

      this._isInitialized = true;
      console.log("✅ Model Rotation Service initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Model Rotation Service:", error.message);
      throw error;
    }
  }

  /**
   * Request model rotation
   * @param {string} provider - Model provider (e.g., 'ollama', 'huggingface')
   * @param {string} modelName - Target model to load
   * @param {string} source - Request source
   * @param {'high' | 'normal' | 'low'} priority - Request priority
   * @returns {Promise<Object>} Rotation result
   */
  async requestModelRotation(provider, modelName, source, priority = REQUEST_PRIORITY.NORMAL) {
    this._ensureInitialized();
    if (!provider || !modelName) {
      throw createRotationError(
        ERROR_CODES.INVALID_INPUT,
        "Provider and modelName required",
        OPERATIONS.REQUEST_ROTATION
      );
    }
    if (!source || typeof source !== 'string') {
      throw createRotationError(
        ERROR_CODES.INVALID_INPUT,
        "Invalid source provided",
        OPERATIONS.REQUEST_ROTATION
      );
    }
    console.log(`🔄 Requesting model rotation: ${provider}/${modelName} (${priority} priority) from ${source}`);
    try {
      // Check if model is already active for this provider
      const activeModel = modelStateTracker.getActiveModel(provider);
      if (activeModel === modelName) {
        console.log(`✅ Model ${provider}/${modelName} is already active`);
        return {
          success: true,
          provider,
          model: modelName,
          action: 'no_change',
          message: 'Model already active'
        };
      }
      // Check if model exists for this provider
      const modelExists = await this._checkModelExists(provider, modelName);
      if (!modelExists) {
        throw createRotationError(
          ERROR_CODES.MODEL_NOT_FOUND,
          `Model ${modelName} not found in provider ${provider}`,
          OPERATIONS.REQUEST_ROTATION
        );
      }
      // Enqueue rotation request (queue must now accept provider/modelName)
      const enqueued = await queueService.enqueueRotationRequest({ provider, modelName }, source, priority);
      if (!enqueued) {
        throw createRotationError(
          ERROR_CODES.QUEUE_FULL,
          "Rotation queue is full",
          OPERATIONS.REQUEST_ROTATION
        );
      }
      if (!queueService.getQueueStatus().isProcessing) {
        await this._processRotationQueue();
      }
      return {
        success: true,
        provider,
        model: modelName,
        action: 'queued',
        message: 'Rotation request queued successfully'
      };
    } catch (error) {
      console.error(`❌ Model rotation request failed: ${error.message}`);
      this._recordFailedRotation(provider, modelName, source, error);
      throw error;
    }
  }

  /**
   * Force immediate model rotation (bypasses queue)
   * @param {string} provider - Model provider (e.g., 'ollama', 'huggingface')
   * @param {string} modelName - Target model to load
   * @param {string} source - Request source
   * @returns {Promise<Object>} Rotation result
   */
  async forceModelRotation(provider, modelName, source) {
    this._ensureInitialized();

    console.log(`⚡ Force rotating to model: ${provider}/${modelName} from ${source}`);

    try {
      // Check if model exists for this provider
      const modelExists = await this._checkModelExists(provider, modelName);
      if (!modelExists) {
        throw createRotationError(
          ERROR_CODES.MODEL_NOT_FOUND,
          `Model ${modelName} not found in provider ${provider}`,
          OPERATIONS.FORCE_ROTATION
        );
      }

      // Perform immediate rotation
      const result = await this.performRotation(provider, modelName, source, true);
      
      console.log(`✅ Force rotation completed: ${provider}/${modelName}`);
      return result;

    } catch (error) {
      console.error(`❌ Force rotation failed: ${error.message}`);
      this._recordFailedRotation(provider, modelName, source, error);
      throw error;
    }
  }

  /**
   * Get current rotation status
   * @returns {Object} Current rotation status
   */
  getRotationStatus() {
    this._ensureInitialized();

    const status = {
      isRotating: this._isRotating,
      currentRotation: this._currentRotation,
      activeModel: modelStateTracker.getActiveModel(),
      queueStatus: queueService.getQueueStatus(),
      memoryStatus: memoryMonitor.getCurrentMemoryUsage(),
      lastRotation: this._rotationHistory.length > 0 ? 
        this._rotationHistory[this._rotationHistory.length - 1] : null,
      failedRotations: this._failedRotations.length
    };

    return status;
  }

  /**
   * Get rotation history
   * @param {number} limit - Number of recent rotations to return
   * @returns {Array} Rotation history
   */
  getRotationHistory(limit = 10) {
    this._ensureInitialized();
    return this._rotationHistory.slice(-limit);
  }

  /**
   * Get failed rotations
   * @returns {Array} Failed rotation attempts
   */
  getFailedRotations() {
    this._ensureInitialized();
    return [...this._failedRotations];
  }

  /**
   * Clear rotation history
   * @returns {number} Number of entries cleared
   */
  clearRotationHistory() {
    const clearedCount = this._rotationHistory.length;
    this._rotationHistory = [];
    console.log(`🗑️  Cleared ${clearedCount} rotation history entries`);
    return clearedCount;
  }

  /**
   * Clear failed rotations
   * @returns {number} Number of failed rotations cleared
   */
  clearFailedRotations() {
    const clearedCount = this._failedRotations.length;
    this._failedRotations = [];
    console.log(`🗑️  Cleared ${clearedCount} failed rotation entries`);
    return clearedCount;
  }

  /**
   * Emergency cleanup - unload all models
   * @returns {Promise<Object>} Cleanup result
   */
  async emergencyCleanup() {
    this._ensureInitialized();

    console.log("🚨 Performing emergency cleanup - unloading all models");

    try {
      const activeModel = modelStateTracker.getActiveModel();
      if (!activeModel) {
        console.log("✅ No active model to unload");
        return {
          success: true,
          action: 'no_cleanup_needed',
          message: 'No active model found'
        };
      }

      // Clear queue first
      await queueService.clearQueue();

      // Unload current model
      await this._unloadModel(activeModel, 'emergency_cleanup');

      console.log("✅ Emergency cleanup completed");
      return {
        success: true,
        action: 'emergency_cleanup',
        message: `Unloaded model: ${activeModel}`
      };

    } catch (error) {
      console.error(`❌ Emergency cleanup failed: ${error.message}`);
      throw createRotationError(
        ERROR_CODES.EMERGENCY_CLEANUP_FAILED,
        `Emergency cleanup failed: ${error.message}`,
        OPERATIONS.EMERGENCY_CLEANUP
      );
    }
  }

  /**
   * Validate rotation configuration
   * @returns {Object} Validation result
   */
  validateConfiguration() {
    this._ensureInitialized();

    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Check configuration service
      const config = configService.getAllSettings();
      if (!config.modelRotationEnabled) {
        validation.warnings.push("Model rotation is disabled");
      }

      // Check memory thresholds
      const memoryThresholds = configService.getMemoryThresholds();
      if (memoryThresholds.warningThreshold >= memoryThresholds.criticalThreshold) {
        validation.errors.push("Warning threshold must be less than critical threshold");
        validation.isValid = false;
      }

      // Check queue configuration
      const queueConfig = configService.getSetting('MAX_QUEUE_SIZE');
      if (queueConfig < 1) {
        validation.errors.push("Queue size must be at least 1");
        validation.isValid = false;
      }

    } catch (error) {
      validation.errors.push(`Configuration validation failed: ${error.message}`);
      validation.isValid = false;
    }

    return validation;
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
      throw new Error("ModelRotationService not initialized. Call initialize() first.");
    }
  }

  /**
   * Check if model exists in Ollama
   * @param {string} provider - Model provider (e.g., 'ollama', 'huggingface')
   * @param {string} modelName - Model name to check
   * @returns {Promise<boolean>} True if model exists
   * @private
   */
  async _checkModelExists(provider, modelName) {
    if (provider === 'ollama') {
      try {
        const models = await this._ollama.list();
        return models.models.some(m => m.name === modelName);
      } catch (error) {
        console.warn(`⚠️  Could not check if model ${modelName} exists for provider ${provider}:`, error.message);
        return false;
      }
    }
    if (provider === 'huggingface') {
      try {
        return await huggingFaceService.checkModelExists(modelName);
      } catch (error) {
        console.warn(`⚠️  Could not check if model ${modelName} exists for provider ${provider}:`, error.message);
        return false;
      }
    }
    return false;
  }

  /**
   * Process the rotation queue
   * @returns {Promise<number>} Number of rotations processed
   * @private
   */
  async _processRotationQueue() {
    if (this._isRotating) {
      console.log("⏳ Rotation already in progress, skipping queue processing");
      return 0;
    }

    console.log("🔄 Processing rotation queue...");
    
    this._isRotating = true;
    let processedCount = 0;

    try {
      const processed = await queueService.processQueue();
      
      // Process each request in the queue
      const queueContents = queueService.getQueueContents();
      for (const request of queueContents) {
        try {
          await this.performRotation(request.provider, request.modelName, request.source, false);
          processedCount++;
        } catch (error) {
          console.error(`❌ Failed to process rotation request: ${error.message}`);
          this._recordFailedRotation(request.provider, request.modelName, request.source, error);
        }
      }

    } catch (error) {
      console.error("❌ Queue processing failed:", error.message);
    } finally {
      this._isRotating = false;
    }

    console.log(`✅ Rotation queue processing completed: ${processedCount} rotations`);
    return processedCount;
  }

  /**
   * Perform actual model rotation
   * @param {string} provider - Model provider (e.g., 'ollama', 'huggingface')
   * @param {string} modelName - Target model to load
   * @param {string} source - Request source
   * @param {boolean} isForced - Whether this is a forced rotation
   * @returns {Promise<Object>} Rotation result
   */
  async performRotation(provider, modelName, source, isForced = false) {
    const rotationStart = new Date();
    this._currentRotation = {
      provider,
      modelName,
      source,
      startTime: rotationStart,
      isForced,
      status: 'in_progress'
    };

    console.log(`🔄 Starting rotation to ${provider}/${modelName} (${isForced ? 'forced' : 'queued'})`);

    try {
      // Check memory before rotation
      const memoryBefore = memoryMonitor.getCurrentMemoryUsage();
      console.log(`🧠 Memory before rotation: ${(memoryBefore.usedMemory / 1024 / 1024 / 1024).toFixed(2)} GB`);

      // Unload current model for this provider if different
      const activeModel = modelStateTracker.getActiveModel(provider);
      if (activeModel && activeModel !== modelName) {
        console.log(`📤 Unloading current model: ${provider}/${activeModel}`);
        await this._unloadModel(provider, activeModel, source);
      }

      // Load target model for this provider
      console.log(`📥 Loading target model: ${provider}/${modelName}`);
      await this._loadModel(provider, modelName, source);

      // Update state tracker
      await modelStateTracker.setActiveModel(provider, modelName);
      // Debug output
      console.log(`[DEBUG] After setActiveModel:`, provider, modelName, modelStateTracker.getStateSummary());

      // Check memory after rotation
      const memoryAfter = memoryMonitor.getCurrentMemoryUsage();
      console.log(`🧠 Memory after rotation: ${(memoryAfter.usedMemory / 1024 / 1024 / 1024).toFixed(2)} GB`);

      // Record successful rotation
      const rotationEnd = new Date();
      this._rotationHistory.push({
        provider,
        modelName,
        source,
        startTime: rotationStart,
        endTime: rotationEnd,
        durationMs: rotationEnd - rotationStart,
        isForced,
        status: 'success'
      });
      this._isRotating = false;
      this._currentRotation = null;
      return {
        success: true,
        provider,
        model: modelName,
        action: isForced ? 'forced' : 'rotated',
        message: 'Model rotation completed successfully'
      };
    } catch (error) {
      this._isRotating = false;
      this._currentRotation = null;
      this._recordFailedRotation(provider, modelName, source, error);
      throw error;
    }
  }

  /**
   * Load a model with retry logic
   * @param {string} provider - Model provider (e.g., 'ollama', 'huggingface')
   * @param {string} modelName - Model to load
   * @param {string} source - Request source
   * @returns {Promise<void>}
   * @private
   */
  async _loadModel(provider, modelName, source) {
    if (provider === 'ollama') {
      // Ollama loads model on demand
      return true;
    }
    if (provider === 'huggingface') {
      try {
        await huggingFaceService.loadModel(modelName);
        return true;
      } catch (error) {
        throw new Error(`Failed to load Hugging Face model ${modelName}: ${error.message}`);
      }
    }
    return true;
  }

  /**
   * Unload a model
   * @param {string} provider - Model provider (e.g., 'ollama', 'huggingface')
   * @param {string} modelName - Model to unload
   * @param {string} source - Request source
   * @returns {Promise<void>}
   * @private
   */
  async _unloadModel(provider, modelName, source) {
    if (provider === 'ollama') {
      // Ollama unloads model on demand
      return true;
    }
    if (provider === 'huggingface') {
      try {
        await huggingFaceService.unloadModel(modelName);
        return true;
      } catch (error) {
        console.warn(`⚠️  Failed to unload Hugging Face model ${modelName}: ${error.message}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Record a failed rotation
   * @param {string} provider - Model provider (e.g., 'ollama', 'huggingface')
   * @param {string} modelName - Model that failed to rotate
   * @param {string} source - Request source
   * @param {Error} error - Error that occurred
   * @private
   */
  _recordFailedRotation(provider, modelName, source, error) {
    this._failedRotations.push({ provider, modelName, source, error, timestamp: new Date() });
  }
}

// Export singleton instance
export default new ModelRotationService(); 