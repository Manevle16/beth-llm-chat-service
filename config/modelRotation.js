/**
 * Model Rotation Configuration Service
 * 
 * This service handles loading and validation of model rotation configuration
 * from environment variables with sensible defaults and fallback mechanisms.
 */

import dotenv from "dotenv";
import {
  RotationConfig,
  MemoryThresholds,
  DEFAULT_CONFIG,
  validateRotationConfig,
  validateMemoryThresholds
} from "../types/modelRotation.js";

// Ensure environment variables are loaded
dotenv.config();

class ConfigurationService {
  constructor() {
    this._rotationConfig = null;
    this._memoryThresholds = null;
    this._isInitialized = false;
  }

  /**
   * Initialize the configuration service
   * Loads and validates all configuration settings
   */
  initialize() {
    if (this._isInitialized) {
      return;
    }

    console.log("⚙️  Initializing Model Rotation Configuration...");

    try {
      this._loadRotationConfig();
      this._loadMemoryThresholds();
      this._validateConfiguration();
      
      this._isInitialized = true;
      console.log("✅ Model Rotation Configuration initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Model Rotation Configuration:", error.message);
      this._useFallbackConfiguration();
    }
  }

  /**
   * Get the rotation configuration
   * @returns {RotationConfig} Rotation configuration object
   */
  getRotationConfig() {
    this._ensureInitialized();
    return { ...this._rotationConfig };
  }

  /**
   * Get the memory thresholds configuration
   * @returns {MemoryThresholds} Memory thresholds object
   */
  getMemoryThresholds() {
    this._ensureInitialized();
    return { ...this._memoryThresholds };
  }

  /**
   * Check if the model rotation feature is enabled
   * @returns {boolean} True if enabled, false otherwise
   */
  isFeatureEnabled() {
    this._ensureInitialized();
    return this._rotationConfig.enableAutoRotation;
  }

  /**
   * Validate the current configuration
   * @returns {boolean} True if valid, false otherwise
   */
  validateConfiguration() {
    this._ensureInitialized();
    
    const rotationValid = validateRotationConfig(this._rotationConfig);
    const memoryValid = validateMemoryThresholds(this._memoryThresholds);
    
    if (!rotationValid) {
      console.warn("⚠️  Invalid rotation configuration detected");
    }
    
    if (!memoryValid) {
      console.warn("⚠️  Invalid memory thresholds detected");
    }
    
    return rotationValid && memoryValid;
  }

  /**
   * Get a specific configuration value
   * @param {string} key - Configuration key
   * @returns {any} Configuration value
   */
  getSetting(key) {
    this._ensureInitialized();
    
    // Check rotation config first
    if (key in this._rotationConfig) {
      return this._rotationConfig[key];
    }
    
    // Check memory thresholds
    if (key in this._memoryThresholds) {
      return this._memoryThresholds[key];
    }
    
    // Check environment variables directly
    return process.env[key];
  }

  /**
   * Get all configuration as a flat object
   * @returns {Object} All configuration settings
   */
  getAllSettings() {
    this._ensureInitialized();
    
    return {
      ...this._rotationConfig,
      ...this._memoryThresholds,
      featureEnabled: this.isFeatureEnabled()
    };
  }

  /**
   * Reload configuration from environment variables
   * Useful for runtime configuration updates
   */
  reloadConfiguration() {
    console.log("🔄 Reloading Model Rotation Configuration...");
    this._isInitialized = false;
    this.initialize();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Load rotation configuration from environment variables
   * @private
   */
  _loadRotationConfig() {
    this._rotationConfig = {
      enableAutoRotation: this._parseBoolean(
        process.env.MODEL_ROTATION_ENABLED,
        DEFAULT_CONFIG.MODEL_ROTATION_ENABLED
      ),
      maxConcurrentModels: this._parseInt(
        process.env.MAX_CONCURRENT_MODELS,
        DEFAULT_CONFIG.MAX_CONCURRENT_MODELS
      ),
      rotationTimeoutMs: this._parseInt(
        process.env.ROTATION_TIMEOUT_MS,
        DEFAULT_CONFIG.ROTATION_TIMEOUT_MS
      ),
      retryAttempts: this._parseInt(
        process.env.ROTATION_RETRY_ATTEMPTS,
        DEFAULT_CONFIG.ROTATION_RETRY_ATTEMPTS
      ),
      retryDelayMs: this._parseInt(
        process.env.ROTATION_RETRY_DELAY_MS,
        DEFAULT_CONFIG.ROTATION_RETRY_DELAY_MS
      )
    };

    console.log("📋 Rotation Config:", {
      enableAutoRotation: this._rotationConfig.enableAutoRotation,
      maxConcurrentModels: this._rotationConfig.maxConcurrentModels,
      rotationTimeoutMs: this._rotationConfig.rotationTimeoutMs,
      retryAttempts: this._rotationConfig.retryAttempts,
      retryDelayMs: this._rotationConfig.retryDelayMs
    });
  }

  /**
   * Load memory thresholds from environment variables
   * @private
   */
  _loadMemoryThresholds() {
    this._memoryThresholds = {
      warningThreshold: this._parseInt(
        process.env.MEMORY_WARNING_THRESHOLD,
        DEFAULT_CONFIG.MEMORY_WARNING_THRESHOLD
      ),
      criticalThreshold: this._parseInt(
        process.env.MEMORY_CRITICAL_THRESHOLD,
        DEFAULT_CONFIG.MEMORY_CRITICAL_THRESHOLD
      ),
      cleanupThreshold: this._parseInt(
        process.env.MEMORY_CLEANUP_THRESHOLD,
        DEFAULT_CONFIG.MEMORY_CLEANUP_THRESHOLD
      )
    };

    console.log("🧠 Memory Thresholds:", {
      warningThreshold: `${this._memoryThresholds.warningThreshold}%`,
      criticalThreshold: `${this._memoryThresholds.criticalThreshold}%`,
      cleanupThreshold: `${this._memoryThresholds.cleanupThreshold}%`
    });
  }

  /**
   * Validate the loaded configuration
   * @private
   */
  _validateConfiguration() {
    const rotationValid = validateRotationConfig(this._rotationConfig);
    const memoryValid = validateMemoryThresholds(this._memoryThresholds);

    if (!rotationValid) {
      throw new Error("Invalid rotation configuration");
    }

    if (!memoryValid) {
      throw new Error("Invalid memory thresholds configuration");
    }

    console.log("✅ Configuration validation passed");
  }

  /**
   * Use fallback configuration when validation fails
   * @private
   */
  _useFallbackConfiguration() {
    console.warn("⚠️  Using fallback configuration due to validation errors");
    
    this._rotationConfig = {
      enableAutoRotation: false,
      maxConcurrentModels: 1,
      rotationTimeoutMs: 30000,
      retryAttempts: 3,
      retryDelayMs: 1000
    };

    this._memoryThresholds = {
      warningThreshold: 70,
      criticalThreshold: 85,
      cleanupThreshold: 90
    };

    this._isInitialized = true;
    console.log("🔄 Fallback configuration applied");
  }

  /**
   * Ensure the service is initialized before use
   * @private
   */
  _ensureInitialized() {
    if (!this._isInitialized) {
      this.initialize();
    }
  }

  /**
   * Parse boolean value from environment variable
   * @param {string} value - Environment variable value
   * @param {boolean} defaultValue - Default value if parsing fails
   * @returns {boolean} Parsed boolean value
   * @private
   */
  _parseBoolean(value, defaultValue) {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
      return true;
    }
    if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
      return false;
    }
    
    console.warn(`⚠️  Invalid boolean value: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }

  /**
   * Parse integer value from environment variable
   * @param {string} value - Environment variable value
   * @param {number} defaultValue - Default value if parsing fails
   * @returns {number} Parsed integer value
   * @private
   */
  _parseInt(value, defaultValue) {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      console.warn(`⚠️  Invalid integer value: ${value}, using default: ${defaultValue}`);
      return defaultValue;
    }
    
    return parsed;
  }
}

// Export singleton instance
export default new ConfigurationService(); 