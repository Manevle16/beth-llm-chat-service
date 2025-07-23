/**
 * Image Upload Handler Service
 * 
 * This service handles multipart form data processing for image uploads
 * and integrates with the existing image validation, storage, and database services.
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { 
  createImageData, 
  createValidationResult, 
  createImageError,
  IMAGE_ERRORS,
  IMAGE_SIZE_LIMITS,
  ALLOWED_IMAGE_TYPES,
  generateImageId
} from '../types/imageUpload.js';
import imageValidationService from './imageValidationService.js';
import imageStorageService from './imageStorageService.js';
import imageDatabaseService from './imageDatabaseService.js';
import { visionModelService } from './visionModelService.js';
import errorHandlingService from './errorHandlingService.js';

class ImageUploadHandler {
  constructor() {
    this.upload = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the upload handler
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure upload directory exists
      const uploadPath = process.env.IMAGE_STORAGE_PATH || './uploads/images';
      await fs.mkdir(uploadPath, { recursive: true });

      // Configure multer for file uploads
      const storage = multer.diskStorage({
        destination: async (req, file, cb) => {
          try {
            await fs.mkdir(uploadPath, { recursive: true });
            cb(null, uploadPath);
          } catch (error) {
            cb(error);
          }
        },
        filename: (req, file, cb) => {
          const uniqueId = generateImageId();
          const extension = path.extname(file.originalname);
          const filename = `${uniqueId}${extension}`;
          cb(null, filename);
        }
      });

      const fileFilter = (req, file, cb) => {
        if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`Invalid file type: ${file.mimetype}`), false);
        }
      };

      this.upload = multer({
        storage,
        fileFilter,
        limits: {
          fileSize: IMAGE_SIZE_LIMITS.MAX_SIZE_BYTES,
          files: 5 // Maximum 5 images per request
        }
      });

      // Initialize dependent services
      await imageValidationService.initialize();
      await imageStorageService.initialize();
      await imageDatabaseService.initialize();
      await visionModelService.initialize();
      await errorHandlingService.initialize();

      this.isInitialized = true;
      console.log('✅ ImageUploadHandler initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize ImageUploadHandler:', error);
      throw error;
    }
  }

  /**
   * Get multer upload middleware
   */
  getUploadMiddleware() {
    if (!this.isInitialized) {
      throw new Error('ImageUploadHandler not initialized');
    }
    return this.upload.array('images', 5);
  }

  /**
   * Process uploaded files and validate them
   */
  async processUploadedFiles(files, conversationId, messageId) {
    if (!files || files.length === 0) {
      return {
        images: [],
        validationResult: createValidationResult(true, [], [])
      };
    }

    const processedImages = [];
    const validationErrors = [];
    const validationWarnings = [];

    for (const file of files) {
      try {
        // Create image data object
        const imageData = createImageData(
          file.buffer,
          file.originalname,
          file.mimetype,
          file.size
        );

        // Validate the image with error handling
        const validationResult = await errorHandlingService.executeImageOperation(
          () => imageValidationService.validateImage(imageData),
          {
            operationName: 'image_validation',
            maxRetries: 2,
            enableLogging: true
          }
        );
        
        if (!validationResult.isValid) {
          validationErrors.push(...validationResult.errors);
          continue;
        }

        if (validationResult.warnings.length > 0) {
          validationWarnings.push(...validationResult.warnings);
        }

        // Store the image with error handling
        const storedImage = await errorHandlingService.executeImageOperation(
          () => imageStorageService.storeImage(imageData, file.path),
          {
            operationName: 'image_storage',
            maxRetries: 3,
            enableLogging: true
          }
        );
        
        // Save to database with error handling
        const imageRecord = await errorHandlingService.executeImageOperation(
          () => imageDatabaseService.createImageRecord(
            storedImage.id,
            conversationId,
            messageId,
            storedImage.filename,
            storedImage.path,
            storedImage.size,
            storedImage.mimeType,
            storedImage.hash
          ),
          {
            operationName: 'image_database_save',
            maxRetries: 3,
            enableLogging: true
          }
        );

        processedImages.push({
          ...storedImage,
          record: imageRecord
        });

        // Record success metrics
        errorHandlingService.logInfo(`✅ Successfully processed image: ${file.originalname}`, {
          imageId: storedImage.id,
          filename: file.originalname,
          size: file.size
        });

      } catch (error) {
        // Handle image processing errors with structured error handling
        const errorResult = errorHandlingService.handleImageProcessingError(error, {
          imageId: null,
          operation: 'file_processing',
          filename: file.originalname
        });

        validationErrors.push(`Failed to process ${file.originalname}: ${errorResult.error.message}`);
        
        // Log detailed error information
        errorHandlingService.logError(`❌ Failed to process image: ${file.originalname}`, {
          error: errorResult.error,
          recoveryAction: errorResult.recoveryAction,
          shouldRetry: errorResult.shouldRetry
        });
      }
    }

    return {
      images: processedImages,
      validationResult: createValidationResult(
        validationErrors.length === 0,
        validationErrors,
        validationWarnings
      )
    };
  }

  /**
   * Process a request that may contain both text and images
   */
  async processRequest(req, conversationId, messageId) {
    const { message, model } = req.body;
    const files = req.files || [];

    // Process uploaded images
    const { images, validationResult } = await this.processUploadedFiles(
      files, 
      conversationId, 
      messageId
    );

    // Check if we have images and if the model supports vision
    let visionSupported = false;
    let visionMessage = null;

    if (images.length > 0) {
      try {
        // Check vision support with error handling
        visionSupported = await errorHandlingService.executeImageOperation(
          () => visionModelService.supportsVision(model),
          {
            operationName: 'vision_support_check',
            maxRetries: 2,
            enableLogging: true
          }
        );
        
        if (visionSupported) {
          // Create vision message with error handling
          visionMessage = await errorHandlingService.executeImageOperation(
            () => visionModelService.createVisionMessage(message, images),
            {
              operationName: 'vision_message_creation',
              maxRetries: 2,
              enableLogging: true
            }
          );

          errorHandlingService.logInfo(`✅ Vision message created for model ${model}`, {
            model,
            imageCount: images.length,
            messageLength: message.length
          });
        } else {
          validationResult.warnings.push(
            `Model ${model} does not support vision. Images will be ignored.`
          );
        }
      } catch (error) {
        // Handle vision model errors with structured error handling
        const errorResult = errorHandlingService.handleVisionModelError(error, {
          model,
          operation: 'vision_processing',
          imageCount: images.length
        });

        validationResult.warnings.push(
          `Could not verify vision support for model ${model}. Images may be ignored. Error: ${errorResult.error.message}`
        );

        errorHandlingService.logWarn(`⚠️ Vision processing failed for model ${model}`, {
          error: errorResult.error,
          recoveryAction: errorResult.recoveryAction,
          fallbackToText: true
        });
      }
    }

    return {
      message,
      model,
      images,
      visionSupported,
      visionMessage,
      validationResult
    };
  }

  /**
   * Clean up uploaded files on error
   */
  async cleanupOnError(files) {
    if (!files || files.length === 0) {
      return;
    }

    for (const file of files) {
      try {
        await fs.unlink(file.path);
        console.log(`Cleaned up file: ${file.path}`);
      } catch (error) {
        console.error(`Failed to cleanup file ${file.path}:`, error);
      }
    }
  }

  /**
   * Get upload configuration
   */
  getUploadConfig() {
    return {
      maxFileSize: IMAGE_SIZE_LIMITS.MAX_SIZE_BYTES,
      maxFiles: 5,
      allowedTypes: ALLOWED_IMAGE_TYPES,
      storagePath: process.env.IMAGE_STORAGE_PATH || './uploads/images'
    };
  }

  /**
   * Validate upload configuration
   */
  async validateConfiguration() {
    const config = this.getUploadConfig();
    const errors = [];

    // Check storage path
    try {
      await fs.access(config.storagePath);
    } catch (error) {
      errors.push(`Storage path not accessible: ${config.storagePath}`);
    }

    // Check file size limit
    if (config.maxFileSize <= 0) {
      errors.push('Invalid max file size');
    }

    // Check allowed types
    if (!Array.isArray(config.allowedTypes) || config.allowedTypes.length === 0) {
      errors.push('No allowed file types configured');
    }

    return {
      isValid: errors.length === 0,
      errors,
      config
    };
  }

  /**
   * Get image processing metrics
   */
  getMetrics() {
    return {
      uploadConfig: this.getUploadConfig(),
      errorHandling: errorHandlingService.getImageProcessingMetrics(),
      isInitialized: this.isInitialized,
      service: 'ImageUploadHandler'
    };
  }

  /**
   * Get recent error logs
   */
  getRecentErrors(limit = 10) {
    return errorHandlingService.getRecentLogs(limit, 'error');
  }
}

// Export singleton instance
const imageUploadHandler = new ImageUploadHandler();
export default imageUploadHandler; 