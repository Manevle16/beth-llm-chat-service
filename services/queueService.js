/**
 * Queue Service for Model Rotation Requests
 * 
 * This service manages concurrent model rotation requests using a FIFO queue
 * with priority-based processing, size limits, and request deduplication.
 */

import {
  createRotationRequest,
  REQUEST_PRIORITY,
  isRotationRequest
} from "../types/modelRotation.js";
import configService from "../config/modelRotation.js";
import modelRotationService from './modelRotationService.js';

class QueueService {
  constructor() {
    this._queue = [];
    this._isProcessing = false;
    this._lastProcessed = null;
    this._pendingRequests = 0;
    this._maxQueueSize = 10;
    this._processingInterval = 1000;
    this._processingTimer = null;
    this._isInitialized = false;
  }

  /**
   * Initialize the queue service
   * Loads configuration and starts processing
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    console.log("📋 Initializing Queue Service...");

    try {
      // Ensure configuration is loaded
      configService.initialize();
      
      // Load queue configuration
      this._maxQueueSize = configService.getSetting('MAX_QUEUE_SIZE') || 10;
      this._processingInterval = configService.getSetting('QUEUE_PROCESSING_INTERVAL_MS') || 1000;
      
      this._isInitialized = true;
      console.log("✅ Queue Service initialized successfully");
      console.log(`📊 Queue configuration: maxSize=${this._maxQueueSize}, interval=${this._processingInterval}ms`);
    } catch (error) {
      console.error("❌ Failed to initialize Queue Service:", error.message);
      throw error;
    }
  }

  /**
   * Enqueue a rotation request
   * @param {Object} modelRef - { provider, modelName }
   * @param {string} source - Request source
   * @param {'high' | 'normal' | 'low'} priority - Request priority
   * @returns {Promise<boolean>} True if enqueued, false if rejected
   */
  async enqueueRotationRequest(modelRef, source, priority = REQUEST_PRIORITY.NORMAL) {
    this._ensureInitialized();
    if (!modelRef || typeof modelRef.provider !== 'string' || typeof modelRef.modelName !== 'string') {
      throw new Error("Invalid modelRef provided (must have provider and modelName)");
    }
    if (!source || typeof source !== 'string') {
      throw new Error("Invalid source provided");
    }
    if (!Object.values(REQUEST_PRIORITY).includes(priority)) {
      throw new Error("Invalid priority level provided");
    }
    // Check if queue is full
    if (this._queue.length >= this._maxQueueSize) {
      console.warn(`⚠️  Queue is full (${this._queue.length}/${this._maxQueueSize}), rejecting request for ${modelRef.provider}/${modelRef.modelName}`);
      return false;
    }
    // Check for duplicate requests (same provider, model, and source)
    const duplicateIndex = this._queue.findIndex(request =>
      request.provider === modelRef.provider &&
      request.modelName === modelRef.modelName &&
      request.source === source
    );
    if (duplicateIndex !== -1) {
      console.log(`🔄 Duplicate request found for ${modelRef.provider}/${modelRef.modelName} from ${source}, updating priority`);
      // Update priority if new request has higher priority
      const existingRequest = this._queue[duplicateIndex];
      if (this._getPriorityWeight(priority) > this._getPriorityWeight(existingRequest.priority)) {
        existingRequest.priority = priority;
        existingRequest.timestamp = new Date();
        console.log(`✅ Updated priority for ${modelRef.provider}/${modelRef.modelName} to ${priority}`);
      }
      return true;
    }
    // Create new request
    const request = createRotationRequest(modelRef, source, priority);
    // Insert based on priority (higher priority first)
    const insertIndex = this._findInsertIndex(priority);
    this._queue.splice(insertIndex, 0, request);
    this._pendingRequests++;
    console.log(`📥 Enqueued rotation request: ${modelRef.provider}/${modelRef.modelName} (${priority} priority) from ${source}`);
    console.log(`📊 Queue status: ${this._queue.length}/${this._maxQueueSize} requests`);
    return true;
  }

  /**
   * Process the queue
   * @returns {Promise<number>} Number of requests processed
   */
  async processQueue() {
    this._ensureInitialized();

    if (this._isProcessing) {
      console.log("⏳ Queue is already being processed");
      return 0;
    }

    if (this._queue.length === 0) {
      return 0;
    }

    console.log(`🔄 Processing queue with ${this._queue.length} requests...`);
    
    this._isProcessing = true;
    let processedCount = 0;

    try {
      while (this._queue.length > 0) {
        const request = this._queue.shift();
        
        console.log(`⚡ Processing request: ${request.provider}/${request.modelName} (${request.priority} priority) from ${request.source}`);
        
        // Simulate processing time
        await this._processRequest(request);
        
        this._lastProcessed = new Date();
        this._pendingRequests = Math.max(0, this._pendingRequests - 1);
        processedCount++;
        
        console.log(`✅ Processed request: ${request.provider}/${request.modelName}`);
      }
    } catch (error) {
      console.error("❌ Error processing queue:", error.message);
    } finally {
      this._isProcessing = false;
    }

    console.log(`✅ Queue processing completed: ${processedCount} requests processed`);
    return processedCount;
  }

  /**
   * Get current queue status
   * @returns {Object} Queue status information
   */
  getQueueStatus() {
    this._ensureInitialized();

    const status = {
      size: this._queue.length,
      maxSize: this._maxQueueSize,
      isProcessing: this._isProcessing,
      lastProcessed: this._lastProcessed ? this._lastProcessed.toISOString() : null,
      pendingRequests: this._pendingRequests,
      utilization: this._queue.length / this._maxQueueSize * 100
    };

    // Add priority breakdown
    status.priorityBreakdown = {
      high: this._queue.filter(req => req.priority === REQUEST_PRIORITY.HIGH).length,
      normal: this._queue.filter(req => req.priority === REQUEST_PRIORITY.NORMAL).length,
      low: this._queue.filter(req => req.priority === REQUEST_PRIORITY.LOW).length
    };

    return status;
  }

  /**
   * Clear the queue
   * @returns {Promise<number>} Number of requests cleared
   */
  async clearQueue() {
    this._ensureInitialized();

    const clearedCount = this._queue.length;
    
    if (clearedCount > 0) {
      console.log(`🗑️  Clearing queue with ${clearedCount} requests...`);
      this._queue = [];
      this._pendingRequests = 0;
      console.log(`✅ Queue cleared: ${clearedCount} requests removed`);
    } else {
      console.log("📋 Queue is already empty");
    }

    return clearedCount;
  }

  /**
   * Get all requests in the queue
   * @returns {Array} Array of rotation requests
   */
  getQueueContents() {
    this._ensureInitialized();
    return [...this._queue];
  }

  /**
   * Remove a specific request from the queue
   * @param {string} requestId - ID of the request to remove
   * @returns {boolean} True if removed, false if not found
   */
  removeRequest(requestId) {
    this._ensureInitialized();

    const index = this._queue.findIndex(request => request.id === requestId);
    
    if (index !== -1) {
      const request = this._queue[index];
      this._queue.splice(index, 1);
      this._pendingRequests = Math.max(0, this._pendingRequests - 1);
      
      console.log(`🗑️  Removed request: ${request.provider}/${request.modelName} (ID: ${requestId})`);
      return true;
    }

    return false;
  }

  /**
   * Get the next request without removing it
   * @returns {Object|null} Next request or null if queue is empty
   */
  peekNextRequest() {
    this._ensureInitialized();
    return this._queue.length > 0 ? { ...this._queue[0] } : null;
  }

  /**
   * Start automatic queue processing
   * @returns {boolean} True if started, false if already running
   */
  startAutoProcessing() {
    this._ensureInitialized();

    if (this._processingTimer) {
      console.log("⚠️  Auto-processing is already running");
      return false;
    }

    console.log(`🔄 Starting auto-processing with ${this._processingInterval}ms interval`);
    
    this._processingTimer = setInterval(async () => {
      try {
        await this.processQueue();
      } catch (error) {
        console.error("❌ Auto-processing error:", error.message);
      }
    }, this._processingInterval);

    return true;
  }

  /**
   * Stop automatic queue processing
   * @returns {boolean} True if stopped, false if not running
   */
  stopAutoProcessing() {
    if (this._processingTimer) {
      clearInterval(this._processingTimer);
      this._processingTimer = null;
      console.log("⏹️  Auto-processing stopped");
      return true;
    }

    return false;
  }

  /**
   * Check if auto-processing is running
   * @returns {boolean} True if running, false otherwise
   */
  isAutoProcessingRunning() {
    return this._processingTimer !== null;
  }

  /**
   * Get queue statistics
   * @returns {Object} Queue statistics
   */
  getQueueStats() {
    this._ensureInitialized();

    const now = new Date();
    const stats = {
      totalRequests: this._queue.length + this._pendingRequests,
      currentQueueSize: this._queue.length,
      maxQueueSize: this._maxQueueSize,
      utilization: (this._queue.length / this._maxQueueSize * 100).toFixed(1) + '%',
      isProcessing: this._isProcessing,
      isAutoProcessing: this.isAutoProcessingRunning(),
      lastProcessed: this._lastProcessed ? {
        timestamp: this._lastProcessed.toISOString(),
        age: Math.floor((now - this._lastProcessed) / 1000) + 's ago'
      } : null
    };

    // Priority distribution
    const priorityCounts = {};
    Object.values(REQUEST_PRIORITY).forEach(priority => {
      priorityCounts[priority] = this._queue.filter(req => req.priority === priority).length;
    });
    stats.priorityDistribution = priorityCounts;

    return stats;
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
      throw new Error("QueueService not initialized. Call initialize() first.");
    }
  }

  /**
   * Get priority weight for sorting
   * @param {string} priority - Priority level
   * @returns {number} Priority weight
   * @private
   */
  _getPriorityWeight(priority) {
    const weights = {
      [REQUEST_PRIORITY.HIGH]: 3,
      [REQUEST_PRIORITY.NORMAL]: 2,
      [REQUEST_PRIORITY.LOW]: 1
    };
    return weights[priority] || 0;
  }

  /**
   * Find the correct insert index based on priority
   * @param {string} priority - Priority level
   * @returns {number} Insert index
   * @private
   */
  _findInsertIndex(priority) {
    const priorityWeight = this._getPriorityWeight(priority);
    
    for (let i = 0; i < this._queue.length; i++) {
      const currentWeight = this._getPriorityWeight(this._queue[i].priority);
      if (priorityWeight > currentWeight) {
        return i;
      }
    }
    
    return this._queue.length;
  }

  /**
   * Process a single request
   * @param {Object} request - Rotation request to process
   * @returns {Promise<void>}
   * @private
   */
  async _processRequest(request) {
    // Call the actual model rotation logic
    await modelRotationService.performRotation(request.provider, request.modelName, request.source, false);
    // Optionally, you can add logging here if needed
  }

  /**
   * Validate rotation request
   * @param {Object} request - Request to validate
   * @returns {boolean} True if valid, false otherwise
   * @private
   */
  _validateRequest(request) {
    return isRotationRequest(request);
  }
}

// Export singleton instance
export default new QueueService(); 