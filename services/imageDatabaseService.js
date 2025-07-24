/**
 * Image Database Service
 * 
 * This service manages image metadata in PostgreSQL database,
 * including CRUD operations, relationship management, and integrity validation.
 */

import fs from 'fs/promises';
import pool from '../config/database.js';
import {
  createImageRecord,
  createImageDisplayData,
  isValidImageRecord
} from '../types/imageUpload.js';

class ImageDatabaseService {
  constructor() {
    this._isInitialized = false;
    this._databaseStats = {
      totalRecords: 0,
      totalSize: 0,
      lastCleanup: null
    };
  }

  /**
   * Initialize the image database service
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    console.log("🗄️ Initializing Image Database Service...");

    try {
      // Ensure database connection
      const client = await pool.connect();
      client.release();

      // Create images table if it doesn't exist
      await this._createImagesTable();
      
      // Add has_images column to messages table if it doesn't exist
      await this._addHasImagesColumn();
      
      // Initialize database statistics
      await this._updateDatabaseStats();
      
      this._isInitialized = true;
      console.log("✅ Image Database Service initialized successfully");
      console.log(`📊 Database stats: ${this._databaseStats.totalRecords} image records`);
    } catch (error) {
      console.error("❌ Failed to initialize Image Database Service:", error.message);
      throw error;
    }
  }

  /**
   * Create images table if it doesn't exist
   * @private
   */
  async _createImagesTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS images (
        id VARCHAR(255) PRIMARY KEY,
        conversation_id VARCHAR(255) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        deleted_at TIMESTAMP WITH TIME ZONE
      );
    `;

    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_images_conversation_id ON images(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_images_message_id ON images(message_id);
      CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at);
      CREATE INDEX IF NOT EXISTS idx_images_expires_at ON images(expires_at);
      CREATE INDEX IF NOT EXISTS idx_images_content_hash ON images(content_hash);
    `;

    try {
      await pool.query(createTableQuery);
      await pool.query(createIndexesQuery);
      console.log("✅ Images table and indexes created/verified");
    } catch (error) {
      console.error("❌ Error creating images table:", error.message);
      throw error;
    }
  }

  /**
   * Add has_images column to messages table if it doesn't exist
   * @private
   */
  async _addHasImagesColumn() {
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'has_images';
    `;

    const addColumnQuery = `
      ALTER TABLE messages ADD COLUMN has_images BOOLEAN DEFAULT FALSE;
    `;

    const createIndexQuery = `
      CREATE INDEX IF NOT EXISTS idx_messages_has_images ON messages(has_images);
    `;

    try {
      const result = await pool.query(checkColumnQuery);
      
      if (result.rows.length === 0) {
        await pool.query(addColumnQuery);
        await pool.query(createIndexQuery);
        console.log("✅ Added has_images column to messages table");
      } else {
        console.log("✅ has_images column already exists in messages table");
      }
    } catch (error) {
      console.error("❌ Error adding has_images column:", error.message);
      throw error;
    }
  }

  /**
   * Update database statistics
   * @private
   */
  async _updateDatabaseStats() {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_records,
          COALESCE(SUM(file_size), 0) as total_size,
          MAX(created_at) as last_created
        FROM images 
        WHERE deleted_at IS NULL;
      `;

      const result = await pool.query(statsQuery);
      const row = result.rows[0];

      this._databaseStats = {
        totalRecords: parseInt(row.total_records),
        totalSize: parseInt(row.total_size),
        lastCreated: row.last_created
      };
    } catch (error) {
      console.warn("⚠️ Failed to update database stats:", error.message);
    }
  }

  /**
   * Ensure service is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this._isInitialized) {
      throw new Error("Image Database Service not initialized");
    }
  }

  /**
   * Save image record to database
   * @param {Object} imageRecord - Image record object
   * @returns {Promise<Object>} Saved image record
   */
  async saveImageRecord(imageRecord) {
    this._ensureInitialized();

    if (!isValidImageRecord(imageRecord)) {
      throw new Error("Invalid image record provided");
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO images (
          id, conversation_id, message_id, filename, file_path, 
          file_size, mime_type, content_hash, base64_data, created_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
      `;

      const values = [
        imageRecord.id,
        imageRecord.conversation_id,
        imageRecord.message_id,
        imageRecord.filename,
        imageRecord.file_path,
        imageRecord.file_size,
        imageRecord.mime_type,
        imageRecord.content_hash,
        imageRecord.base64_data || null,
        imageRecord.created_at,
        imageRecord.expires_at
      ];

      const result = await client.query(insertQuery, values);
      await client.query('COMMIT');

      console.log(`💾 Image record saved: ${imageRecord.id}`);
      await this._updateDatabaseStats();

      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      console.error("❌ Error saving image record:", error.message);
      throw new Error(`Failed to save image record: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Link image to message
   * @param {string} imageId - Image ID
   * @param {string} messageId - Message ID
   * @param {string} conversationId - Conversation ID
   */
  async linkImageToMessage(imageId, messageId, conversationId) {
    this._ensureInitialized();

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update image record with message ID
      const updateImageQuery = `
        UPDATE images 
        SET message_id = $1 
        WHERE id = $2 AND conversation_id = $3;
      `;
      await client.query(updateImageQuery, [messageId, imageId, conversationId]);

      // Update message to indicate it has images
      const updateMessageQuery = `
        UPDATE messages 
        SET has_images = TRUE 
        WHERE id = $1;
      `;
      await client.query(updateMessageQuery, [messageId]);

      await client.query('COMMIT');
      console.log(`🔗 Image ${imageId} linked to message ${messageId}`);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error("❌ Error linking image to message:", error.message);
      throw new Error(`Failed to link image to message: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Get images for a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object[]>} Array of image records
   */
  async getImagesForConversation(conversationId) {
    this._ensureInitialized();

    try {
      const query = `
        SELECT * FROM images 
        WHERE conversation_id = $1 AND deleted_at IS NULL
        ORDER BY created_at ASC;
      `;

      const result = await pool.query(query, [conversationId]);
      console.log(`📖 Retrieved ${result.rows.length} images for conversation ${conversationId}`);
      return result.rows;

    } catch (error) {
      console.error("❌ Error getting images for conversation:", error.message);
      throw new Error(`Failed to get images for conversation: ${error.message}`);
    }
  }

  /**
   * Get images for a specific message
   * @param {string} messageId - Message ID
   * @returns {Promise<Object[]>} Array of image records
   */
  async getImagesForMessage(messageId) {
    this._ensureInitialized();

    try {
      const query = `
        SELECT * FROM images 
        WHERE message_id = $1 AND deleted_at IS NULL
        ORDER BY created_at ASC;
      `;

      const result = await pool.query(query, [messageId]);
      console.log(`📖 Retrieved ${result.rows.length} images for message ${messageId}`);
      return result.rows;

    } catch (error) {
      console.error("❌ Error getting images for message:", error.message);
      throw new Error(`Failed to get images for message: ${error.message}`);
    }
  }

  /**
   * Get image by ID
   * @param {string} imageId - Image ID
   * @returns {Promise<Object|null>} Image record or null if not found
   */
  async getImageById(imageId) {
    this._ensureInitialized();

    try {
      const query = `
        SELECT * FROM images 
        WHERE id = $1 AND deleted_at IS NULL;
      `;

      const result = await pool.query(query, [imageId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      console.log(`📖 Retrieved image ${imageId}`);
      return result.rows[0];

    } catch (error) {
      console.error("❌ Error getting image by ID:", error.message);
      throw new Error(`Failed to get image by ID: ${error.message}`);
    }
  }

  /**
   * Get images by conversation ID
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object[]>} Array of image records
   */
  async getImagesByConversation(conversationId) {
    this._ensureInitialized();

    try {
      const query = `
        SELECT * FROM images 
        WHERE conversation_id = $1 AND deleted_at IS NULL
        ORDER BY created_at ASC;
      `;

      const result = await pool.query(query, [conversationId]);
      console.log(`📖 Retrieved ${result.rows.length} images for conversation ${conversationId}`);
      return result.rows;

    } catch (error) {
      console.error("❌ Error getting images for conversation:", error.message);
      throw new Error(`Failed to get images for conversation: ${error.message}`);
    }
  }

  /**
   * Delete a single image by ID
   * @param {string} imageId - Image ID
   * @returns {Promise<boolean>} True if image was deleted
   */
  async deleteImage(imageId) {
    this._ensureInitialized();

    try {
      const deleteQuery = `
        UPDATE images 
        SET deleted_at = CURRENT_TIMESTAMP 
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id;
      `;

      const result = await pool.query(deleteQuery, [imageId]);
      
      if (result.rows.length === 0) {
        return false;
      }

      console.log(`🗑️ Soft deleted image ${imageId}`);
      await this._updateDatabaseStats();

      return true;

    } catch (error) {
      console.error("❌ Error deleting image:", error.message);
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Delete images for a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<number>} Number of images deleted
   */
  async deleteImagesForConversation(conversationId) {
    this._ensureInitialized();

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Soft delete images
      const deleteQuery = `
        UPDATE images 
        SET deleted_at = CURRENT_TIMESTAMP 
        WHERE conversation_id = $1 AND deleted_at IS NULL
        RETURNING id;
      `;

      const result = await client.query(deleteQuery, [conversationId]);
      await client.query('COMMIT');

      const deletedCount = result.rows.length;
      console.log(`🗑️ Soft deleted ${deletedCount} images for conversation ${conversationId}`);
      await this._updateDatabaseStats();

      return deletedCount;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error("❌ Error deleting images for conversation:", error.message);
      throw new Error(`Failed to delete images for conversation: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Validate image integrity
   * @returns {Promise<Object>} Integrity report
   */
  async validateImageIntegrity() {
    this._ensureInitialized();

    try {
      // Get all image records
      const query = `
        SELECT id, file_path, created_at 
        FROM images 
        WHERE deleted_at IS NULL;
      `;

      const result = await pool.query(query);
      const images = result.rows;

      const missingFiles = [];
      const orphanedFiles = [];

      // Check each image file exists
      for (const image of images) {
        try {
          await fs.access(image.file_path);
        } catch (error) {
          missingFiles.push(image.file_path);
        }
      }

      const report = {
        totalImages: images.length,
        validImages: images.length - missingFiles.length,
        missingFiles,
        orphanedFiles,
        scanTimestamp: new Date()
      };

      console.log(`🔍 Integrity scan completed: ${report.validImages}/${report.totalImages} valid images`);
      return report;

    } catch (error) {
      console.error("❌ Error validating image integrity:", error.message);
      throw new Error(`Failed to validate image integrity: ${error.message}`);
    }
  }

  /**
   * Get image display data
   * @param {string} imageId - Image ID
   * @returns {Promise<Object>} Image display data
   */
  async getImageDisplayData(imageId) {
    this._ensureInitialized();

    try {
      const query = `
        SELECT id, filename, file_size, mime_type, created_at
        FROM images 
        WHERE id = $1 AND deleted_at IS NULL;
      `;

      const result = await pool.query(query, [imageId]);
      
      if (result.rows.length === 0) {
        throw new Error(`Image not found: ${imageId}`);
      }

      const image = result.rows[0];
      const displayUrl = `/api/images/${imageId}`;

      return createImageDisplayData(
        image.id,
        image.filename,
        displayUrl,
        image.mime_type,
        image.file_size,
        image.created_at
      );

    } catch (error) {
      console.error("❌ Error getting image display data:", error.message);
      throw new Error(`Failed to get image display data: ${error.message}`);
    }
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>} Database statistics
   */
  async getDatabaseStats() {
    this._ensureInitialized();
    await this._updateDatabaseStats();
    return { ...this._databaseStats };
  }

  /**
   * Execute a database query (public method for other services)
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async executeQuery(query, params = []) {
    this._ensureInitialized();
    
    try {
      const result = await pool.query(query, params);
      return result;
    } catch (error) {
      console.error("❌ Database query error:", error.message);
      throw error;
    }
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
export default new ImageDatabaseService(); 