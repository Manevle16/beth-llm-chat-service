/**
 * Image Cleanup Service
 * 
 * This service handles automatic cleanup of expired images,
 * memory management, and performance optimization for the image upload system.
 */

import fs from 'fs/promises';
import path from 'path';
import imageDatabaseService from './imageDatabaseService.js';
import errorHandlingService from './errorHandlingService.js';
import { IMAGE_PROCESSING } from '../types/imageUpload.js';

class ImageCleanupService {
  constructor() {
    this._isInitialized = false;
    this._cleanupInterval = null;
    this._cleanupIntervalMs = 24 * 60 * 60 * 1000; // 24 hours
    this._lastCleanupTime = null;
    this._cleanupStats = {
      totalCleanups: 0,
      totalImagesRemoved: 0,
      totalStorageFreed: 0,
      lastCleanupDuration: 0
    };
  }

  /**
   * Initialize the cleanup service
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    console.log("🧹 Initializing Image Cleanup Service...");

    try {
      // Initialize dependent services
      await imageDatabaseService.initialize();
      await errorHandlingService.initialize();

      // Start automatic cleanup
      this._startAutomaticCleanup();

      this._isInitialized = true;
      console.log("✅ Image Cleanup Service initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Image Cleanup Service:", error);
      throw error;
    }
  }

  /**
   * Start automatic cleanup process
   * @private
   */
  _startAutomaticCleanup() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
    }

    this._cleanupInterval = setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        errorHandlingService.logError("❌ Automatic cleanup failed", {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }, this._cleanupIntervalMs);

    console.log(`🔄 Automatic cleanup scheduled every ${this._cleanupIntervalMs / (1000 * 60 * 60)} hours`);
  }

  /**
   * Perform cleanup of expired images
   */
  async performCleanup() {
    const startTime = Date.now();
    console.log("🧹 Starting image cleanup process...");

    try {
      // Get expired images from database
      const expiredImages = await this._getExpiredImages();
      
      if (expiredImages.length === 0) {
        console.log("✅ No expired images found");
        this._updateCleanupStats(0, 0, Date.now() - startTime);
        return;
      }

      console.log(`📋 Found ${expiredImages.length} expired images to clean up`);

      let removedCount = 0;
      let freedStorage = 0;

      // Process each expired image
      for (const image of expiredImages) {
        try {
          const result = await this._cleanupSingleImage(image);
          if (result.success) {
            removedCount++;
            freedStorage += result.freedStorage;
          }
        } catch (error) {
          errorHandlingService.logError(`❌ Failed to cleanup image ${image.id}`, {
            imageId: image.id,
            error: error.message
          });
        }
      }

      // Update cleanup statistics
      this._updateCleanupStats(removedCount, freedStorage, Date.now() - startTime);

      console.log(`✅ Cleanup completed: ${removedCount}/${expiredImages.length} images removed, ${this._formatBytes(freedStorage)} freed`);

    } catch (error) {
      errorHandlingService.logError("❌ Image cleanup process failed", {
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Get expired images from database
   * @private
   */
  async _getExpiredImages() {
    const query = `
      SELECT id, filename, file_path, file_size, created_at, expires_at
      FROM images 
      WHERE expires_at < CURRENT_TIMESTAMP 
      AND deleted_at IS NULL
      ORDER BY expires_at ASC
    `;

    const result = await imageDatabaseService.executeQuery(query);
    return result.rows || [];
  }

  /**
   * Cleanup a single image
   * @param {Object} image - Image record
   * @private
   */
  async _cleanupSingleImage(image) {
    let freedStorage = 0;

    try {
      // Check if file exists and get its size
      try {
        const stats = await fs.stat(image.file_path);
        freedStorage = stats.size;
      } catch (error) {
        // File doesn't exist, which is fine for cleanup
        console.log(`⚠️ File not found for cleanup: ${image.file_path}`);
      }

      // Remove file from filesystem
      try {
        await fs.unlink(image.file_path);
      } catch (error) {
        // File might already be deleted
        console.log(`⚠️ Could not delete file: ${image.file_path}`);
      }

      // Mark as deleted in database
      await imageDatabaseService.executeQuery(
        'UPDATE images SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
        [image.id]
      );

      errorHandlingService.logInfo(`🗑️ Cleaned up expired image: ${image.id}`, {
        imageId: image.id,
        filename: image.filename,
        freedStorage
      });

      return {
        success: true,
        freedStorage
      };

    } catch (error) {
      errorHandlingService.logError(`❌ Failed to cleanup image ${image.id}`, {
        imageId: image.id,
        error: error.message
      });

      return {
        success: false,
        freedStorage: 0,
        error: error.message
      };
    }
  }

  /**
   * Update cleanup statistics
   * @param {number} removedCount - Number of images removed
   * @param {number} freedStorage - Storage freed in bytes
   * @param {number} duration - Cleanup duration in ms
   * @private
   */
  _updateCleanupStats(removedCount, freedStorage, duration) {
    this._cleanupStats.totalCleanups++;
    this._cleanupStats.totalImagesRemoved += removedCount;
    this._cleanupStats.totalStorageFreed += freedStorage;
    this._cleanupStats.lastCleanupDuration = duration;
    this._lastCleanupTime = new Date();
  }

  /**
   * Get cleanup statistics
   */
  getCleanupStats() {
    return {
      ...this._cleanupStats,
      lastCleanupTime: this._lastCleanupTime,
      nextCleanupTime: this._lastCleanupTime ? 
        new Date(this._lastCleanupTime.getTime() + this._cleanupIntervalMs) : null,
      cleanupIntervalMs: this._cleanupIntervalMs,
      isInitialized: this._isInitialized
    };
  }

  /**
   * Manually trigger cleanup
   */
  async triggerCleanup() {
    console.log("🔄 Manual cleanup triggered");
    await this.performCleanup();
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    try {
      const storagePath = process.env.IMAGE_STORAGE_PATH || './uploads/images';
      
      // Get total storage usage
      const totalStats = await this._getDirectoryStats(storagePath);
      
      // Get database stats
      const dbStats = await imageDatabaseService.getDatabaseStats();
      
      return {
        storagePath,
        totalFiles: totalStats.fileCount,
        totalSize: totalStats.totalSize,
        averageFileSize: totalStats.fileCount > 0 ? totalStats.totalSize / totalStats.fileCount : 0,
        databaseRecords: dbStats.totalRecords,
        databaseSize: dbStats.totalSize,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      errorHandlingService.logError("❌ Failed to get storage stats", {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get directory statistics
   * @param {string} dirPath - Directory path
   * @private
   */
  async _getDirectoryStats(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      let totalSize = 0;
      let fileCount = 0;

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        try {
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            totalSize += stats.size;
            fileCount++;
          }
        } catch (error) {
          // Skip files that can't be accessed
          console.log(`⚠️ Could not access file: ${filePath}`);
        }
      }

      return { fileCount, totalSize };
    } catch (error) {
      return { fileCount: 0, totalSize: 0 };
    }
  }

  /**
   * Optimize storage by removing orphaned files
   */
  async optimizeStorage() {
    console.log("🔧 Starting storage optimization...");

    try {
      // Get all files in storage directory
      const storagePath = process.env.IMAGE_STORAGE_PATH || './uploads/images';
      const files = await fs.readdir(storagePath);
      
      // Get all image records from database
      const dbImages = await imageDatabaseService.executeQuery(
        'SELECT file_path FROM images WHERE deleted_at IS NULL'
      );

      const dbFilePaths = new Set(dbImages.rows.map(img => img.file_path));
      let orphanedFiles = 0;
      let freedStorage = 0;

      // Check each file in storage
      for (const file of files) {
        const filePath = path.join(storagePath, file);
        
        try {
          const stats = await fs.stat(filePath);
          if (stats.isFile() && !dbFilePaths.has(filePath)) {
            // This is an orphaned file
            await fs.unlink(filePath);
            orphanedFiles++;
            freedStorage += stats.size;
            
            errorHandlingService.logInfo(`🗑️ Removed orphaned file: ${file}`, {
              filename: file,
              size: stats.size
            });
          }
        } catch (error) {
          console.log(`⚠️ Could not process file: ${filePath}`);
        }
      }

      console.log(`✅ Storage optimization completed: ${orphanedFiles} orphaned files removed, ${this._formatBytes(freedStorage)} freed`);

      return {
        orphanedFiles,
        freedStorage,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      errorHandlingService.logError("❌ Storage optimization failed", {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Bytes to format
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Shutdown the cleanup service
   */
  async shutdown() {
    console.log("🛑 Shutting down Image Cleanup Service...");

    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }

    this._isInitialized = false;
    console.log("✅ Image Cleanup Service shutdown complete");
  }

  /**
   * Check if service is initialized
   */
  isInitialized() {
    return this._isInitialized;
  }
}

// Export singleton instance
export default new ImageCleanupService(); 