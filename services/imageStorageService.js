/**
 * Image Storage Service
 * 
 * This service manages secure file system storage for uploaded images,
 * including file operations, serving capabilities, and cleanup procedures.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  IMAGE_PROCESSING,
  createStoredImage,
  generateImageId,
  getFileExtension,
  formatFileSize
} from '../types/imageUpload.js';

import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImageStorageService {
  constructor() {
    this._isInitialized = false;
    this._storagePath = null;
    this._storageStats = {
      totalImages: 0,
      totalSize: 0,
      oldestImage: null,
      storagePath: null,
      availableSpace: 0
    };
    this._cleanupTimer = null;
  }

  /**
   * Initialize the image storage service
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    console.log("💾 Initializing Image Storage Service...");

    try {
      // Set storage path from environment or use default
      this._storagePath = process.env.IMAGE_STORAGE_PATH || path.join(__dirname, '../uploads/images');
      
      // Ensure storage directory exists
      await this._ensureStorageDirectory();
      
      // Initialize storage statistics
      await this._updateStorageStats();
      
      // Start cleanup timer
      this._startCleanupTimer();
      
      this._isInitialized = true;
      console.log("✅ Image Storage Service initialized successfully");
      console.log(`📁 Storage path: ${this._storagePath}`);
      console.log(`📊 Initial stats: ${this._storageStats.totalImages} images, ${formatFileSize(this._storageStats.totalSize)}`);
    } catch (error) {
      console.error("❌ Failed to initialize Image Storage Service:", error.message);
      throw error;
    }
  }

  /**
   * Ensure storage directory exists
   * @private
   */
  async _ensureStorageDirectory() {
    try {
      await fs.access(this._storagePath);
    } catch (error) {
      console.log(`📁 Creating storage directory: ${this._storagePath}`);
      await fs.mkdir(this._storagePath, { recursive: true });
    }
  }

  /**
   * Update storage statistics
   * @private
   */
  async _updateStorageStats() {
    try {
      const files = await fs.readdir(this._storagePath);
      let totalSize = 0;
      let oldestImage = null;

      for (const filename of files) {
        const filePath = path.join(this._storagePath, filename);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          totalSize += stats.size;
          
          if (!oldestImage || stats.mtime < oldestImage) {
            oldestImage = stats.mtime;
          }
        }
      }

      // Get available space
      const diskStats = await fs.statfs(this._storagePath);
      const availableSpace = diskStats.bavail * diskStats.bsize;

      this._storageStats = {
        totalImages: files.length,
        totalSize,
        oldestImage,
        storagePath: this._storagePath,
        availableSpace
      };
    } catch (error) {
      console.warn("⚠️ Failed to update storage stats:", error.message);
    }
  }

  /**
   * Start cleanup timer
   * @private
   */
  _startCleanupTimer() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
    }

    this._cleanupTimer = setInterval(async () => {
      try {
        await this.cleanupExpiredImages();
      } catch (error) {
        console.error("❌ Error during cleanup:", error.message);
      }
    }, IMAGE_PROCESSING.CLEANUP_INTERVAL_MS);

    console.log(`🧹 Cleanup timer started (${IMAGE_PROCESSING.CLEANUP_INTERVAL_MS}ms interval)`);
  }

  /**
   * Ensure service is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this._isInitialized) {
      throw new Error("Image Storage Service not initialized");
    }
  }

  /**
   * Store image in file system (organized by year/month)
   * @param {Object} imageData - Image data object
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Stored image information
   */
  async storeImage(imageData, conversationId) {
    this._ensureInitialized();

    if (!imageData || !imageData.buffer || !imageData.originalName) {
      throw new Error("Invalid image data provided");
    }

    // Check available disk space before accepting upload
    const { availableSpace } = await this.getFilesystemStats();
    if (availableSpace < imageData.size) {
      throw new Error("Insufficient disk space for image upload");
    }

    try {
      // Organize by year/month
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const subdir = path.join(this._storagePath, String(year), month);
      await fs.mkdir(subdir, { recursive: true, mode: 0o755 });

      // Generate unique ID and filename
      const imageId = generateImageId();
      const extension = getFileExtension(imageData.originalName);
      const filename = `${imageId}.${extension}`;
      const filePath = path.join(subdir, filename);

      // Write file to disk with 644 permissions
      await fs.writeFile(filePath, imageData.buffer, { mode: 0o644 });

      // Create stored image object
      const storedImage = createStoredImage(
        imageId,
        filename,
        filePath,
        imageData.size,
        imageData.mimeType,
        imageData.hash
      );

      // Update storage statistics
      await this._updateStorageStats();

      console.log(`💾 Image stored: ${filename} (${formatFileSize(imageData.size)})`);
      return storedImage;

    } catch (error) {
      console.error("❌ Error storing image:", error.message);
      throw new Error(`Failed to store image: ${error.message}`);
    }
  }

  /**
   * Retrieve image from file system
   * @param {string} imageId - Image ID
   * @returns {Promise<Buffer>} Image buffer
   */
  async retrieveImage(imageId) {
    this._ensureInitialized();

    if (!imageId) {
      throw new Error("Image ID is required");
    }

    try {
      // Find image file by ID
      const files = await fs.readdir(this._storagePath);
      const imageFile = files.find(file => file.startsWith(imageId));

      if (!imageFile) {
        throw new Error(`Image not found: ${imageId}`);
      }

      const filePath = path.join(this._storagePath, imageFile);
      const buffer = await fs.readFile(filePath);

      console.log(`📖 Image retrieved: ${imageFile} (${formatFileSize(buffer.length)})`);
      return buffer;

    } catch (error) {
      console.error("❌ Error retrieving image:", error.message);
      throw new Error(`Failed to retrieve image: ${error.message}`);
    }
  }

  /**
   * Serve image with MIME type information
   * @param {string} imageId - Image ID
   * @returns {Promise<Object>} Image buffer and MIME type
   */
  async serveImage(imageId) {
    this._ensureInitialized();

    try {
      const buffer = await this.retrieveImage(imageId);
      
      // Determine MIME type from file extension
      const files = await fs.readdir(this._storagePath);
      const imageFile = files.find(file => file.startsWith(imageId));
      const extension = getFileExtension(imageFile);
      
      const mimeTypes = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'webp': 'image/webp'
      };

      const mimeType = mimeTypes[extension] || 'application/octet-stream';

      return { buffer, mimeType };

    } catch (error) {
      console.error("❌ Error serving image:", error.message);
      throw new Error(`Failed to serve image: ${error.message}`);
    }
  }

  /**
   * Delete image from file system
   * @param {string} imageId - Image ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteImage(imageId) {
    this._ensureInitialized();

    if (!imageId) {
      throw new Error("Image ID is required");
    }

    try {
      // Find image file by ID
      const files = await fs.readdir(this._storagePath);
      const imageFile = files.find(file => file.startsWith(imageId));

      if (!imageFile) {
        console.warn(`⚠️ Image not found for deletion: ${imageId}`);
        return false;
      }

      const filePath = path.join(this._storagePath, imageFile);
      await fs.unlink(filePath);

      // Update storage statistics
      await this._updateStorageStats();

      console.log(`🗑️ Image deleted: ${imageFile}`);
      return true;

    } catch (error) {
      console.error("❌ Error deleting image:", error.message);
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Clean up expired images
   * @returns {Promise<number>} Number of images cleaned up
   */
  async cleanupExpiredImages() {
    this._ensureInitialized();

    try {
      const files = await fs.readdir(this._storagePath);
      const now = new Date();
      const retentionMs = IMAGE_PROCESSING.RETENTION_DAYS * 24 * 60 * 60 * 1000;
      let cleanedCount = 0;

      for (const filename of files) {
        const filePath = path.join(this._storagePath, filename);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && (now - stats.mtime) > retentionMs) {
          await fs.unlink(filePath);
          cleanedCount++;
          console.log(`🧹 Cleaned up expired image: ${filename}`);
        }
      }

      if (cleanedCount > 0) {
        await this._updateStorageStats();
        console.log(`🧹 Cleanup completed: ${cleanedCount} expired images removed`);
      }

      return cleanedCount;

    } catch (error) {
      console.error("❌ Error during cleanup:", error.message);
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage statistics
   */
  async getStorageStats() {
    this._ensureInitialized();
    await this._updateStorageStats();
    return { ...this._storageStats };
  }

  /**
   * Get filesystem stats, including available disk space
   */
  async getFilesystemStats() {
    // Use os.freemem() as a fallback, but prefer statvfs if available
    try {
      const stat = await fs.stat(this._storagePath);
      // Node.js does not have statvfs, so use os.freemem() for available RAM as a proxy
      // For real disk space, a native module or external tool would be needed
      return {
        availableSpace: os.freemem(),
        storagePath: this._storagePath,
        // ...other stats
      };
    } catch (e) {
      return { availableSpace: 0, storagePath: this._storagePath };
    }
  }

  /**
   * Generate image URL for serving
   * @param {string} imageId - Image ID
   * @returns {string} Image serving URL
   */
  generateImageUrl(imageId) {
    this._ensureInitialized();
    
    if (!imageId) {
      throw new Error("Image ID is required");
    }

    const baseUrl = process.env.IMAGE_SERVE_ENDPOINT || '/api/images';
    return `${baseUrl}/${imageId}`;
  }

  /**
   * Check if image exists
   * @param {string} imageId - Image ID
   * @returns {Promise<boolean>} Existence status
   */
  async imageExists(imageId) {
    this._ensureInitialized();

    try {
      const files = await fs.readdir(this._storagePath);
      return files.some(file => file.startsWith(imageId));
    } catch (error) {
      console.error("❌ Error checking image existence:", error.message);
      return false;
    }
  }

  /**
   * Get image file information
   * @param {string} imageId - Image ID
   * @returns {Promise<Object>} Image file information
   */
  async getImageInfo(imageId) {
    this._ensureInitialized();

    try {
      const files = await fs.readdir(this._storagePath);
      const imageFile = files.find(file => file.startsWith(imageId));

      if (!imageFile) {
        throw new Error(`Image not found: ${imageId}`);
      }

      const filePath = path.join(this._storagePath, imageFile);
      const stats = await fs.stat(filePath);

      return {
        id: imageId,
        filename: imageFile,
        path: filePath,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      };

    } catch (error) {
      console.error("❌ Error getting image info:", error.message);
      throw new Error(`Failed to get image info: ${error.message}`);
    }
  }

  /**
   * Shutdown the service
   */
  async shutdown() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }

    console.log("🛑 Image Storage Service shutdown complete");
  }

  /**
   * Check if service is initialized
   * @returns {boolean} Initialization status
   */
  isInitialized() {
    return this._isInitialized;
  }
}

// Export singleton instance
export default new ImageStorageService(); 