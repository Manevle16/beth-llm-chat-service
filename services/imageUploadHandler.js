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
  createImageRecord,
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
    const tempFilesToCleanup = [];

    for (const file of files) {
      try {
        // Read file buffer from disk since we're using diskStorage
        const fileBuffer = await fs.readFile(file.path);
        
        // Create image data object
        const imageData = createImageData(
          fileBuffer,
          file.originalname,
          file.mimetype,
          file.size
        );

        // Validate the image with error handling
        const validationResult = await errorHandlingService.executeImageOperation(
          () => imageValidationService.validateImageFile(imageData),
          {
            operationName: 'image_validation',
            maxRetries: 2,
            enableLogging: true
          }
        );
        
        if (!validationResult.isValid) {
          validationErrors.push(...validationResult.errors);
          // Clean up temp file on validation failure
          tempFilesToCleanup.push(file.path);
          continue;
        }

        if (validationResult.warnings.length > 0) {
          validationWarnings.push(...validationResult.warnings);
        }

        // Generate unique ID and create image record
        const imageId = generateImageId();
        const extension = path.extname(file.originalname);
        const filename = `${imageId}${extension}`;
        
        // Store the file in the organized filesystem structure
        const storedImage = await imageStorageService.storeImage(imageData, conversationId);
        
        // Create image record object with the permanent file path
        const imageRecordData = createImageRecord(
          imageId,
          conversationId,
          messageId,
          filename,
          storedImage.path, // Use the permanent path from storage service
          file.size,
          file.mimetype,
          imageData.hash
        );

        // Save to database with error handling
        const imageRecord = await errorHandlingService.executeImageOperation(
          () => imageDatabaseService.saveImageRecord(imageRecordData),
          {
            operationName: 'image_database_save',
            maxRetries: 3,
            enableLogging: true
          }
        );

        processedImages.push({
          id: imageId,
          filename: filename,
          path: storedImage.path, // Use the permanent path
          size: file.size,
          mimeType: file.mimetype,
          hash: imageData.hash,
          record: imageRecord
        });

        // Mark temp file for cleanup (it's now moved to permanent location)
        tempFilesToCleanup.push(file.path);

        // Record success metrics
        errorHandlingService.logInfo(`✅ Successfully processed image: ${file.originalname}`, {
          imageId: imageId,
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
        
        // Mark temp file for cleanup on error
        tempFilesToCleanup.push(file.path);
        
        // Log detailed error information
        errorHandlingService.logError(`❌ Failed to process image: ${file.originalname}`, {
          error: errorResult.error,
          recoveryAction: errorResult.recoveryAction,
          shouldRetry: errorResult.shouldRetry
        });
      }
    }

    // Clean up temporary files
    await this.cleanupTempFiles(tempFilesToCleanup);

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

    // Check if we have images and assume vision is supported
    let visionSupported = true; // Assume vision is supported
    let visionMessage = null;

    if (images.length > 0) {
      try {
        // Extract image IDs from processed images
        const imageIds = images.map(img => img.id);
        
        // Process images for vision with error handling
        visionMessage = await errorHandlingService.executeImageOperation(
          () => visionModelService.processImagesForVision(imageIds),
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
      } catch (error) {
        // Handle vision model errors with structured error handling
        const errorResult = errorHandlingService.handleVisionModelError(error, {
          model,
          operation: 'vision_processing',
          imageCount: images.length
        });

        validationResult.warnings.push(
          `Could not create vision message for model ${model}. Images may be ignored. Error: ${errorResult.error.message}`
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
   * Clean up temporary files
   */
  async cleanupTempFiles(filePaths) {
    if (!filePaths || filePaths.length === 0) {
      return;
    }

    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
        console.log(`🗑️  Cleaned up temporary file: ${filePath}`);
      } catch (error) {
        console.warn(`⚠️  Failed to clean up temporary file: ${filePath}`, error.message);
      }
    }
  }

  /**
   * Clean up uploaded files on error
   */
  async cleanupOnError(files) {
    if (!files || files.length === 0) {
      return;
    }

    const filePaths = files.map(file => file.path);
    await this.cleanupTempFiles(filePaths);
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