/**
 * Image Serving Routes
 * 
 * This module provides endpoints for serving uploaded images
 * with proper access control and caching headers.
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import pool from '../config/database.js';
import imageDatabaseService from '../services/imageDatabaseService.js';
import imageUploadHandler from '../services/imageUploadHandler.js';
import errorHandlingService from '../services/errorHandlingService.js';
import imageCleanupService from '../services/imageCleanupService.js';
import { createImageError, IMAGE_ERRORS } from '../types/imageUpload.js';

const router = express.Router();

/**
 * GET /api/images/metrics
 * Get image processing metrics and statistics
 */
router.get('/metrics', async (req, res) => {
  try {
    // Initialize services if needed
    if (!imageUploadHandler.isInitialized) {
      await imageUploadHandler.initialize();
    }

    const metrics = {
      imageUpload: imageUploadHandler.getMetrics(),
      errorHandling: errorHandlingService.getImageProcessingMetrics(),
      database: await imageDatabaseService.getDatabaseStats(),
      timestamp: new Date().toISOString()
    };

    res.json(metrics);

  } catch (error) {
    console.error('Error getting image metrics:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: IMAGE_ERRORS.STORAGE_ERROR
    });
  }
});

/**
 * GET /api/images/errors
 * Get recent image processing errors
 */
router.get('/errors', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const errors = imageUploadHandler.getRecentErrors(parseInt(limit));

    res.json({
      errors,
      total: errors.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting image errors:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: IMAGE_ERRORS.STORAGE_ERROR
    });
  }
});

/**
 * GET /api/images/cleanup/stats
 * Get cleanup service statistics
 */
router.get('/cleanup/stats', async (req, res) => {
  try {
    const stats = imageCleanupService.getCleanupStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting cleanup stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: IMAGE_ERRORS.STORAGE_ERROR
    });
  }
});

/**
 * POST /api/images/cleanup/trigger
 * Manually trigger cleanup process
 */
router.post('/cleanup/trigger', async (req, res) => {
  try {
    await imageCleanupService.triggerCleanup();
    res.json({
      message: 'Cleanup process triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error triggering cleanup:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: IMAGE_ERRORS.STORAGE_ERROR
    });
  }
});

/**
 * GET /api/images/storage/stats
 * Get storage statistics
 */
router.get('/storage/stats', async (req, res) => {
  try {
    const stats = await imageCleanupService.getStorageStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting storage stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: IMAGE_ERRORS.STORAGE_ERROR
    });
  }
});

/**
 * POST /api/images/storage/optimize
 * Optimize storage by removing orphaned files
 */
router.post('/storage/optimize', async (req, res) => {
  try {
    const result = await imageCleanupService.optimizeStorage();
    res.json({
      message: 'Storage optimization completed',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error optimizing storage:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: IMAGE_ERRORS.STORAGE_ERROR
    });
  }
});

/**
 * GET /api/images/:imageId
 * Serve an image by its ID with access control
 */
router.get('/:imageId', async (req, res) => {
  const { imageId } = req.params;
  const { conversationId, password } = req.query;

  try {
    // Initialize image database service if not already done
    if (!imageDatabaseService.isInitialized()) {
      await imageDatabaseService.initialize();
    }

    // Validate image ID
    if (!imageId || imageId.length < 10) {
      return res.status(400).json({
        error: 'Invalid image ID',
        code: IMAGE_ERRORS.INVALID_FILE_TYPE
      });
    }

    // Get image record from database
    const imageRecord = await imageDatabaseService.getImageById(imageId);
    
    if (!imageRecord) {
      return res.status(404).json({
        error: 'Image not found',
        code: IMAGE_ERRORS.STORAGE_ERROR
      });
    }

    // Check if image is expired
    if (imageRecord.expires_at && new Date() > new Date(imageRecord.expires_at)) {
      return res.status(410).json({
        error: 'Image has expired',
        code: IMAGE_ERRORS.STORAGE_ERROR
      });
    }

    // Get conversation to check access permissions
    const conversationQuery = `
      SELECT id, is_private, password_hash
      FROM conversations
      WHERE id = $1
    `;
    const conversationResult = await pool.query(conversationQuery, [imageRecord.conversation_id]);
    
    if (conversationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Conversation not found',
        code: IMAGE_ERRORS.STORAGE_ERROR
      });
    }

    const conversation = conversationResult.rows[0];

    // Check if conversation is private and password is required
    if (conversation.is_private) {
      if (!password) {
        return res.status(401).json({
          error: 'Password required for private conversation',
          code: IMAGE_ERRORS.STORAGE_ERROR
        });
      }

      // In a real implementation, you would hash and compare the password
      if (conversation.password_hash && password !== conversation.password_hash) {
        return res.status(403).json({
          error: 'Invalid password for private conversation',
          code: IMAGE_ERRORS.STORAGE_ERROR
        });
      }
    }

    // Check if file exists
    const filePath = imageRecord.file_path;
    try {
      await fs.access(filePath);
    } catch (error) {
      console.error(`Image file not found: ${filePath}`);
      return res.status(404).json({
        error: 'Image file not found',
        code: IMAGE_ERRORS.STORAGE_ERROR
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', imageRecord.mime_type);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('ETag', `"${imageRecord.content_hash}"`);
    res.setHeader('Last-Modified', new Date(imageRecord.created_at).toUTCString());

    // Check if client has cached version
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === `"${imageRecord.content_hash}"`) {
      return res.status(304).end(); // Not Modified
    }

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    // Handle stream errors
    fileStream.on('error', (error) => {
      console.error('Error streaming image:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Error serving image',
          code: IMAGE_ERRORS.STORAGE_ERROR
        });
      }
    });

  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: IMAGE_ERRORS.STORAGE_ERROR
    });
  }
});

/**
 * GET /api/images/:imageId/info
 * Get image metadata without serving the file
 */
router.get('/:imageId/info', async (req, res) => {
  const { imageId } = req.params;
  const { conversationId, password } = req.query;

  try {
    // Initialize image database service if not already done
    if (!imageDatabaseService.isInitialized()) {
      await imageDatabaseService.initialize();
    }

    // Validate image ID
    if (!imageId || imageId.length < 10) {
      return res.status(400).json({
        error: 'Invalid image ID',
        code: IMAGE_ERRORS.INVALID_FILE_TYPE
      });
    }

    // Get image record from database
    const imageRecord = await imageDatabaseService.getImageById(imageId);
    
    if (!imageRecord) {
      return res.status(404).json({
        error: 'Image not found',
        code: IMAGE_ERRORS.STORAGE_ERROR
      });
    }

    // Check if image is expired
    if (imageRecord.expires_at && new Date() > new Date(imageRecord.expires_at)) {
      return res.status(410).json({
        error: 'Image has expired',
        code: IMAGE_ERRORS.STORAGE_ERROR
      });
    }

    // Get conversation to check access permissions
    const conversationQuery = `
      SELECT id, is_private, password_hash
      FROM conversations
      WHERE id = $1
    `;
    const conversationResult = await pool.query(conversationQuery, [imageRecord.conversation_id]);
    
    if (conversationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Conversation not found',
        code: IMAGE_ERRORS.STORAGE_ERROR
      });
    }

    const conversation = conversationResult.rows[0];

    // Check if conversation is private and password is required
    if (conversation.is_private) {
      if (!password) {
        return res.status(401).json({
          error: 'Password required for private conversation',
          code: IMAGE_ERRORS.STORAGE_ERROR
        });
      }

      if (conversation.password_hash && password !== conversation.password_hash) {
        return res.status(403).json({
          error: 'Invalid password for private conversation',
          code: IMAGE_ERRORS.STORAGE_ERROR
        });
      }
    }

    // Return image metadata
    res.json({
      id: imageRecord.id,
      filename: imageRecord.filename,
      mimeType: imageRecord.mime_type,
      size: imageRecord.file_size,
      createdAt: imageRecord.created_at,
      expiresAt: imageRecord.expires_at,
      conversationId: imageRecord.conversation_id,
      messageId: imageRecord.message_id,
      displayUrl: `/api/images/${imageRecord.id}?conversationId=${imageRecord.conversation_id}`
    });

  } catch (error) {
    console.error('Error getting image info:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: IMAGE_ERRORS.STORAGE_ERROR
    });
  }
});

/**
 * DELETE /api/images/:imageId
 * Delete an image (admin only or conversation owner)
 */
router.delete('/:imageId', async (req, res) => {
  const { imageId } = req.params;
  const { conversationId, password } = req.query;

  try {
    // Initialize image database service if not already done
    if (!imageDatabaseService.isInitialized()) {
      await imageDatabaseService.initialize();
    }

    // Validate image ID
    if (!imageId || imageId.length < 10) {
      return res.status(400).json({
        error: 'Invalid image ID',
        code: IMAGE_ERRORS.INVALID_FILE_TYPE
      });
    }

    // Get image record from database
    const imageRecord = await imageDatabaseService.getImageById(imageId);
    
    if (!imageRecord) {
      return res.status(404).json({
        error: 'Image not found',
        code: IMAGE_ERRORS.STORAGE_ERROR
      });
    }

    // Get conversation to check access permissions
    const conversationQuery = `
      SELECT id, is_private, password_hash
      FROM conversations
      WHERE id = $1
    `;
    const conversationResult = await pool.query(conversationQuery, [imageRecord.conversation_id]);
    
    if (conversationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Conversation not found',
        code: IMAGE_ERRORS.STORAGE_ERROR
      });
    }

    const conversation = conversationResult.rows[0];

    // Check if conversation is private and password is required
    if (conversation.is_private) {
      if (!password) {
        return res.status(401).json({
          error: 'Password required for private conversation',
          code: IMAGE_ERRORS.STORAGE_ERROR
        });
      }

      if (conversation.password_hash && password !== conversation.password_hash) {
        return res.status(403).json({
          error: 'Invalid password for private conversation',
          code: IMAGE_ERRORS.STORAGE_ERROR
        });
      }
    }

    // Delete the image
    await imageDatabaseService.deleteImage(imageId);

    res.json({
      message: 'Image deleted successfully',
      imageId
    });

  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: IMAGE_ERRORS.STORAGE_ERROR
    });
  }
});

/**
 * GET /api/images/conversation/:conversationId
 * Get all images for a conversation
 */
router.get('/conversation/:conversationId', async (req, res) => {
  const { conversationId } = req.params;
  const { password } = req.query;

  try {
    // Initialize image database service if not already done
    if (!imageDatabaseService.isInitialized()) {
      await imageDatabaseService.initialize();
    }

    // Validate conversation ID
    if (!conversationId) {
      return res.status(400).json({
        error: 'Invalid conversation ID',
        code: IMAGE_ERRORS.INVALID_FILE_TYPE
      });
    }

    // Get conversation to check access permissions
    const conversationQuery = `
      SELECT id, is_private, password_hash
      FROM conversations
      WHERE id = $1
    `;
    const conversationResult = await pool.query(conversationQuery, [conversationId]);
    
    if (conversationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Conversation not found',
        code: IMAGE_ERRORS.STORAGE_ERROR
      });
    }

    const conversation = conversationResult.rows[0];

    // Check if conversation is private and password is required
    if (conversation.is_private) {
      if (!password) {
        return res.status(401).json({
          error: 'Password required for private conversation',
          code: IMAGE_ERRORS.STORAGE_ERROR
        });
      }

      if (conversation.password_hash && password !== conversation.password_hash) {
        return res.status(403).json({
          error: 'Invalid password for private conversation',
          code: IMAGE_ERRORS.STORAGE_ERROR
        });
      }
    }

    // Get all images for the conversation
    const images = await imageDatabaseService.getImagesByConversation(conversationId);

    // Filter out expired images
    const validImages = images.filter(img => 
      !img.expires_at || new Date() <= new Date(img.expires_at)
    );

    // Format response
    const formattedImages = validImages.map(img => ({
      id: img.id,
      filename: img.filename,
      mimeType: img.mime_type,
      size: img.file_size,
      createdAt: img.created_at,
      expiresAt: img.expires_at,
      messageId: img.message_id,
      displayUrl: `/api/images/${img.id}?conversationId=${conversationId}`
    }));

    res.json({
      conversationId,
      images: formattedImages,
      total: formattedImages.length
    });

  } catch (error) {
    console.error('Error getting conversation images:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: IMAGE_ERRORS.STORAGE_ERROR
    });
  }
});

export default router; 