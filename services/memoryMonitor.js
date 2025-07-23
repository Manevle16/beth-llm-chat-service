/**
 * Memory Monitor Service
 * 
 * This service monitors system memory usage and provides configurable
 * thresholds for automatic cleanup triggers and LRU-based model eviction.
 */

import os from "os";
import {
  createRotationError,
  ERROR_CODES,
  OPERATIONS,
  isMemoryStats
} from "../types/modelRotation.js";
import configService from "../config/modelRotation.js";
import modelStateTracker from "./modelStateTracker.js";

class MemoryMonitorService {
  constructor() {
    this._baselineMetrics = null;
    this._lastCheckTime = null;
    this._isInitialized = false;
    this._cleanupCallbacks = [];
  }

  /**
   * Initialize the memory monitor service
   * Establishes baseline metrics and validates configuration
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    console.log("🧠 Initializing Memory Monitor Service...");

    try {
      // Ensure configuration is loaded
      configService.initialize();
      
      // Initialize model state tracker if not already done
      await modelStateTracker.initialize();
      
      // Establish baseline metrics
      this._baselineMetrics = this._getCurrentMemoryStats();
      this._lastCheckTime = new Date();
      
      this._isInitialized = true;
      console.log("✅ Memory Monitor Service initialized successfully");
      console.log("📊 Baseline memory usage:", this._formatMemoryStats(this._baselineMetrics));
    } catch (error) {
      console.error("❌ Failed to initialize Memory Monitor Service:", error.message);
      throw error;
    }
  }

  /**
   * Get current memory usage statistics
   * @returns {Object} Memory statistics object
   */
  getCurrentMemoryUsage() {
    this._ensureInitialized();
    return this._getCurrentMemoryStats();
  }

  /**
   * Check if memory usage exceeds configured thresholds
   * @returns {Promise<boolean>} True if thresholds exceeded, false otherwise
   */
  async checkMemoryThresholds() {
    this._ensureInitialized();

    const currentStats = this.getCurrentMemoryUsage();
    const thresholds = configService.getMemoryThresholds();
    
    const usedPercentage = this._calculateUsedPercentage(currentStats);
    
    console.log(`🧠 Memory usage: ${usedPercentage.toFixed(1)}% (${this._formatBytes(currentStats.usedMemory)})`);

    // Check each threshold level
    if (usedPercentage >= thresholds.cleanupThreshold) {
      console.warn(`⚠️  Memory usage (${usedPercentage.toFixed(1)}%) exceeds cleanup threshold (${thresholds.cleanupThreshold}%)`);
      return true;
    } else if (usedPercentage >= thresholds.criticalThreshold) {
      console.warn(`⚠️  Memory usage (${usedPercentage.toFixed(1)}%) exceeds critical threshold (${thresholds.criticalThreshold}%)`);
      return true;
    } else if (usedPercentage >= thresholds.warningThreshold) {
      console.log(`📊 Memory usage (${usedPercentage.toFixed(1)}%) exceeds warning threshold (${thresholds.warningThreshold}%)`);
      return false; // Warning level doesn't trigger cleanup
    }

    return false;
  }

  /**
   * Trigger automatic cleanup when memory thresholds are exceeded
   * @returns {Promise<boolean>} True if cleanup was performed, false otherwise
   */
  async triggerCleanup() {
    this._ensureInitialized();

    console.log("🧹 Triggering memory cleanup...");

    try {
      const needsCleanup = await this.checkMemoryThresholds();
      
      if (!needsCleanup) {
        console.log("✅ Memory usage is within acceptable limits, no cleanup needed");
        return false;
      }

      // Get LRU model for eviction
      const lruModel = modelStateTracker.getLeastRecentlyUsedModel();
      
      if (!lruModel) {
        console.log("⚠️  No models available for cleanup");
        return false;
      }

      console.log(`🗑️  Evicting least recently used model: ${lruModel}`);
      
      // Remove the LRU model from tracking
      const wasRemoved = modelStateTracker.removeModel(lruModel);
      
      if (wasRemoved) {
        console.log(`✅ Successfully evicted model: ${lruModel}`);
        
        // Log cleanup metrics
        await this.logMemoryMetrics(lruModel, OPERATIONS.CLEANUP_MODELS);
        
        // Execute cleanup callbacks
        this._executeCleanupCallbacks(lruModel);
        
        return true;
      } else {
        console.warn(`⚠️  Failed to evict model: ${lruModel}`);
        return false;
      }
    } catch (error) {
      console.error("❌ Memory cleanup failed:", error.message);
      return false;
    }
  }

  /**
   * Log memory metrics for a specific operation
   * @param {string} modelName - Name of the model involved
   * @param {string} operation - Operation being performed
   * @returns {Promise<void>}
   */
  async logMemoryMetrics(modelName, operation) {
    this._ensureInitialized();

    const currentStats = this.getCurrentMemoryUsage();
    const usedPercentage = this._calculateUsedPercentage(currentStats);
    const thresholds = configService.getMemoryThresholds();

    const metrics = {
      timestamp: new Date().toISOString(),
      modelName,
      operation,
      memoryUsage: {
        total: this._formatBytes(currentStats.totalMemory),
        used: this._formatBytes(currentStats.usedMemory),
        available: this._formatBytes(currentStats.availableMemory),
        usedPercentage: usedPercentage.toFixed(1) + '%'
      },
      thresholds: {
        warning: thresholds.warningThreshold + '%',
        critical: thresholds.criticalThreshold + '%',
        cleanup: thresholds.cleanupThreshold + '%'
      },
      baseline: this._baselineMetrics ? {
        used: this._formatBytes(this._baselineMetrics.usedMemory),
        usedPercentage: this._calculateUsedPercentage(this._baselineMetrics).toFixed(1) + '%'
      } : null
    };

    console.log("📊 Memory Metrics:", JSON.stringify(metrics, null, 2));
  }

  /**
   * Get baseline memory metrics
   * @returns {Object} Baseline memory statistics
   */
  getBaselineMetrics() {
    this._ensureInitialized();
    return this._baselineMetrics ? { ...this._baselineMetrics } : null;
  }

  /**
   * Register a callback to be executed during cleanup
   * @param {Function} callback - Function to call during cleanup
   */
  registerCleanupCallback(callback) {
    if (typeof callback === 'function') {
      this._cleanupCallbacks.push(callback);
      console.log("✅ Registered cleanup callback");
    }
  }

  /**
   * Get memory usage trend (comparing current to baseline)
   * @returns {Object} Memory trend information
   */
  getMemoryTrend() {
    this._ensureInitialized();

    if (!this._baselineMetrics) {
      return { trend: 'unknown', change: 0 };
    }

    const currentStats = this.getCurrentMemoryUsage();
    const baselineUsed = this._baselineMetrics.usedMemory;
    const currentUsed = currentStats.usedMemory;
    
    const change = currentUsed - baselineUsed;
    const changePercentage = (change / baselineUsed) * 100;
    
    let trend = 'stable';
    if (changePercentage > 10) {
      trend = 'increasing';
    } else if (changePercentage < -10) {
      trend = 'decreasing';
    }

    return {
      trend,
      change: changePercentage.toFixed(1) + '%',
      changeBytes: this._formatBytes(Math.abs(change)),
      baseline: this._formatBytes(baselineUsed),
      current: this._formatBytes(currentUsed)
    };
  }

  /**
   * Get detailed memory report
   * @returns {Object} Comprehensive memory report
   */
  getMemoryReport() {
    this._ensureInitialized();

    const currentStats = this.getCurrentMemoryUsage();
    const thresholds = configService.getMemoryThresholds();
    const trend = this.getMemoryTrend();
    const usedPercentage = this._calculateUsedPercentage(currentStats);

    return {
      current: {
        total: this._formatBytes(currentStats.totalMemory),
        used: this._formatBytes(currentStats.usedMemory),
        available: this._formatBytes(currentStats.availableMemory),
        usedPercentage: usedPercentage.toFixed(1) + '%'
      },
      thresholds: {
        warning: thresholds.warningThreshold + '%',
        critical: thresholds.criticalThreshold + '%',
        cleanup: thresholds.cleanupThreshold + '%'
      },
      trend,
      baseline: this._baselineMetrics ? {
        used: this._formatBytes(this._baselineMetrics.usedMemory),
        timestamp: this._baselineMetrics.timestamp.toISOString()
      } : null,
      lastCheck: this._lastCheckTime ? this._lastCheckTime.toISOString() : null,
      loadedModels: modelStateTracker.getLoadedModelCount()
    };
  }

  /**
   * Reset baseline metrics
   * Useful after significant memory changes
   */
  resetBaseline() {
    console.log("🔄 Resetting memory baseline...");
    this._baselineMetrics = this._getCurrentMemoryStats();
    this._lastCheckTime = new Date();
    console.log("✅ Memory baseline reset");
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
      throw new Error("MemoryMonitorService not initialized. Call initialize() first.");
    }
  }

  /**
   * Get current memory statistics from the OS
   * @returns {Object} Current memory statistics
   * @private
   */
  _getCurrentMemoryStats() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    // Calculate model memory usage from state tracker
    let modelMemory = 0;
    try {
      const allMetadata = modelStateTracker.getAllModelMetadata();
      modelMemory = allMetadata.reduce((total, metadata) => total + (metadata.memoryUsage || 0), 0);
    } catch (error) {
      console.warn("⚠️  Could not calculate model memory usage:", error.message);
    }

    return {
      totalMemory,
      usedMemory,
      availableMemory: freeMemory,
      modelMemory,
      timestamp: new Date()
    };
  }

  /**
   * Calculate used memory percentage
   * @param {Object} stats - Memory statistics
   * @returns {number} Used memory percentage
   * @private
   */
  _calculateUsedPercentage(stats) {
    if (!stats || !stats.totalMemory || stats.totalMemory === 0) {
      return 0;
    }
    return (stats.usedMemory / stats.totalMemory) * 100;
  }

  /**
   * Format bytes to human readable string
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted string
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format memory statistics for logging
   * @param {Object} stats - Memory statistics
   * @returns {string} Formatted string
   * @private
   */
  _formatMemoryStats(stats) {
    if (!isMemoryStats(stats)) {
      return 'Invalid memory stats';
    }
    
    const usedPercentage = this._calculateUsedPercentage(stats);
    return `${usedPercentage.toFixed(1)}% used (${this._formatBytes(stats.usedMemory)} / ${this._formatBytes(stats.totalMemory)})`;
  }

  /**
   * Execute registered cleanup callbacks
   * @param {string} evictedModel - Name of the evicted model
   * @private
   */
  _executeCleanupCallbacks(evictedModel) {
    console.log(`🔄 Executing ${this._cleanupCallbacks.length} cleanup callbacks...`);
    
    this._cleanupCallbacks.forEach((callback, index) => {
      try {
        callback(evictedModel);
        console.log(`✅ Cleanup callback ${index + 1} executed successfully`);
      } catch (error) {
        console.error(`❌ Cleanup callback ${index + 1} failed:`, error.message);
      }
    });
  }
}

// Export singleton instance
export default new MemoryMonitorService(); 