/**
 * Image Upload Types and Interfaces
 * 
 * This module defines all types, interfaces, and constants related to
 * image upload functionality for the Beth LLM Chat Service.
 */

// Supported image formats
export const IMAGE_UPLOAD_TYPES = {
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  WEBP: 'image/webp'
};

// Vision message types for Ollama API
export const VISION_MESSAGE_TYPES = {
  IMAGE: 'image',
  TEXT: 'text'
};

// Allowed MIME types for upload
export const ALLOWED_IMAGE_TYPES = [
  IMAGE_UPLOAD_TYPES.PNG,
  IMAGE_UPLOAD_TYPES.JPEG,
  IMAGE_UPLOAD_TYPES.WEBP
];

// File size limits (in bytes)
export const IMAGE_SIZE_LIMITS = {
  MAX_SIZE_MB: 10,
  MAX_SIZE_BYTES: 10 * 1024 * 1024 // 10MB
};

// Image processing constants
export const IMAGE_PROCESSING = {
  HASH_ALGORITHM: 'sha256',
  RETENTION_DAYS: 30,
  CLEANUP_INTERVAL_MS: 24 * 60 * 60 * 1000 // 24 hours
};

// Type definitions for documentation purposes
// These are not actual interfaces but serve as documentation for expected object structures

/**
 * Validation result object structure
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether the validation passed
 * @property {string[]} errors - Array of error messages
 * @property {string[]} warnings - Array of warning messages
 */

/**
 * Security scan result object structure
 * @typedef {Object} SecurityResult
 * @property {boolean} isSafe - Whether the file is safe
 * @property {string[]} threats - Array of detected threats
 * @property {Date} scanTimestamp - When the scan was performed
 */

/**
 * Image data object structure for processing
 * @typedef {Object} ImageData
 * @property {Buffer} buffer - Image file buffer
 * @property {string} originalName - Original filename
 * @property {string} mimeType - MIME type of the image
 * @property {number} size - File size in bytes
 * @property {string} hash - Content hash of the image
 */

/**
 * Stored image object structure for file system
 * @typedef {Object} StoredImage
 * @property {string} id - Unique image identifier
 * @property {string} filename - Stored filename
 * @property {string} path - File system path
 * @property {number} size - File size in bytes
 * @property {string} mimeType - MIME type of the image
 * @property {string} hash - Content hash of the image
 * @property {Date} createdAt - When the image was stored
 */

/**
 * Image record object structure for database
 * @typedef {Object} ImageRecord
 * @property {string} id - Unique image identifier
 * @property {string} conversation_id - Associated conversation ID
 * @property {string} message_id - Associated message ID
 * @property {string} filename - Stored filename
 * @property {string} file_path - File system path
 * @property {number} file_size - File size in bytes
 * @property {string} mime_type - MIME type of the image
 * @property {string} content_hash - Content hash of the image
 * @property {Date} created_at - When the record was created
 * @property {Date} expires_at - When the image expires
 * @property {Date|null} deleted_at - When the image was deleted
 */

/**
 * Image display data object structure for frontend
 * @typedef {Object} ImageDisplayData
 * @property {string} id - Unique image identifier
 * @property {string} filename - Display filename
 * @property {string} displayUrl - URL for serving the image
 * @property {string} mimeType - MIME type of the image
 * @property {number} size - File size in bytes
 * @property {Date} createdAt - When the image was created
 */

/**
 * Storage statistics object structure
 * @typedef {Object} StorageStats
 * @property {number} totalImages - Total number of stored images
 * @property {number} totalSize - Total size of all images in bytes
 * @property {Date} oldestImage - Date of the oldest image
 * @property {string} storagePath - Path to storage directory
 * @property {number} availableSpace - Available space in bytes
 */

/**
 * Vision message object structure for Ollama API
 * @typedef {Object} VisionMessage
 * @property {string} role - Message role (user, assistant, etc.)
 * @property {Array<{type: string, text?: string, image_url?: {url: string}}>} content - Message content
 */

/**
 * Processed request object structure
 * @typedef {Object} ProcessedRequest
 * @property {string} message - Text message
 * @property {ImageData[]} images - Array of image data
 * @property {string} model - Model name
 * @property {string} conversationId - Conversation identifier
 * @property {string} password - Optional password for private conversations
 */

/**
 * Integrity report object structure
 * @typedef {Object} IntegrityReport
 * @property {number} totalImages - Total number of images checked
 * @property {number} validImages - Number of valid images
 * @property {string[]} missingFiles - Array of missing file paths
 * @property {string[]} orphanedFiles - Array of orphaned file paths
 * @property {Date} scanTimestamp - When the scan was performed
 */

/**
 * Image settings object structure
 * @typedef {Object} ImageSettings
 * @property {boolean} uploadEnabled - Whether image upload is enabled
 * @property {string} storagePath - Path to storage directory
 * @property {number} maxSizeMB - Maximum file size in MB
 * @property {number} retentionDays - Number of days to retain images
 * @property {string[]} allowedTypes - Array of allowed MIME types
 */

/**
 * Storage settings object structure
 * @typedef {Object} StorageSettings
 * @property {string} path - Storage directory path
 * @property {number} cleanupInterval - Cleanup interval in milliseconds
 * @property {number} maxConcurrentUploads - Maximum concurrent uploads
 */

/**
 * Security settings object structure
 * @typedef {Object} SecuritySettings
 * @property {boolean} scanningEnabled - Whether security scanning is enabled
 * @property {boolean} hashVerificationEnabled - Whether hash verification is enabled
 * @property {string[]} allowedTypes - Array of allowed file types
 */

// Factory functions for creating type instances
export function createValidationResult(isValid = true, errors = [], warnings = []) {
  return {
    isValid,
    errors: Array.isArray(errors) ? errors : [errors],
    warnings: Array.isArray(warnings) ? warnings : [warnings]
  };
}

export function createImageData(buffer, originalName, mimeType, size) {
  return {
    buffer,
    originalName,
    mimeType,
    size,
    hash: '' // Will be generated by validation service
  };
}

export function createStoredImage(id, filename, path, size, mimeType, hash) {
  return {
    id,
    filename,
    path,
    size,
    mimeType,
    hash,
    createdAt: new Date()
  };
}

export function createImageRecord(id, conversationId, messageId, filename, filePath, fileSize, mimeType, contentHash) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (IMAGE_PROCESSING.RETENTION_DAYS * 24 * 60 * 60 * 1000));
  
  return {
    id,
    conversation_id: conversationId,
    message_id: messageId,
    filename,
    file_path: filePath,
    file_size: fileSize,
    mime_type: mimeType,
    content_hash: contentHash,
    created_at: now,
    expires_at: expiresAt,
    deleted_at: null
  };
}

export function createImageDisplayData(id, filename, displayUrl, mimeType, size, createdAt) {
  return {
    id,
    filename,
    displayUrl,
    mimeType,
    size,
    createdAt: createdAt || new Date()
  };
}

export function createVisionMessage(role, content) {
  return {
    role,
    content: Array.isArray(content) ? content : [content]
  };
}

// Validation functions
export function isValidImageType(mimeType) {
  return ALLOWED_IMAGE_TYPES.includes(mimeType);
}

export function isValidImageSize(sizeInBytes) {
  return sizeInBytes > 0 && sizeInBytes <= IMAGE_SIZE_LIMITS.MAX_SIZE_BYTES;
}

export function isValidImageData(imageData) {
  return imageData && 
         imageData.buffer && 
         imageData.originalName && 
         imageData.mimeType && 
         imageData.size > 0;
}

export function isValidStoredImage(storedImage) {
  return storedImage && 
         storedImage.id && 
         storedImage.filename && 
         storedImage.path && 
         storedImage.size > 0;
}

export function isValidImageRecord(imageRecord) {
  return imageRecord && 
         imageRecord.id && 
         imageRecord.conversation_id && 
         imageRecord.filename && 
         imageRecord.file_path && 
         imageRecord.file_size > 0;
}

// Utility functions
export function generateImageId() {
  return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

export function getMimeTypeFromExtension(extension) {
  const mimeTypes = {
    'png': IMAGE_UPLOAD_TYPES.PNG,
    'jpg': IMAGE_UPLOAD_TYPES.JPEG,
    'jpeg': IMAGE_UPLOAD_TYPES.JPEG,
    'webp': IMAGE_UPLOAD_TYPES.WEBP
  };
  return mimeTypes[extension] || null;
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Error types
export const IMAGE_ERRORS = {
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  VISION_NOT_SUPPORTED: 'VISION_NOT_SUPPORTED',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  SECURITY_THREAT: 'SECURITY_THREAT'
};

// Create error messages
export function createImageError(type, message, details = null) {
  return {
    type,
    message,
    details,
    timestamp: new Date()
  };
} 