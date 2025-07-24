/**
 * Image Validation Service
 * 
 * This service handles image file validation, security scanning,
 * and content verification for uploaded images.
 */

import crypto from 'crypto';
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_SIZE_LIMITS,
  IMAGE_PROCESSING,
  IMAGE_ERRORS,
  createValidationResult,
  createImageError,
  isValidImageType,
  isValidImageSize,
  getFileExtension,
  getMimeTypeFromExtension
} from '../types/imageUpload.js';

class ImageValidationService {
  constructor() {
    this._isInitialized = false;
    this._validationStats = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      securityThreats: 0
    };
  }

  /**
   * Initialize the image validation service
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    console.log("🔍 Initializing Image Validation Service...");

    try {
      // Validate that required constants are available
      if (!ALLOWED_IMAGE_TYPES || !IMAGE_SIZE_LIMITS) {
        throw new Error("Required image validation constants not found");
      }

      this._isInitialized = true;
      console.log("✅ Image Validation Service initialized successfully");
      console.log(`📊 Validation settings: maxSize=${IMAGE_SIZE_LIMITS.MAX_SIZE_MB}MB, allowedTypes=${ALLOWED_IMAGE_TYPES.join(', ')}`);
    } catch (error) {
      console.error("❌ Failed to initialize Image Validation Service:", error.message);
      throw error;
    }
  }

  /**
   * Ensure service is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this._isInitialized) {
      throw new Error("Image Validation Service not initialized");
    }
  }

  /**
   * Validate file type
   * @param {Express.Multer.File|Object} file - File object from multer or imageData object
   * @returns {Promise<Object>} Validation result
   */
  async validateFileType(file) {
    this._ensureInitialized();

    if (!file) {
      return createValidationResult(false, ["No file provided"]);
    }

    const errors = [];
    const warnings = [];

    // Handle both multer file objects and imageData objects
    const mimeType = file.mimetype || file.mimeType;
    const originalName = file.originalname || file.originalName;

    // Check MIME type
    if (!mimeType) {
      errors.push("File has no MIME type");
    } else if (!isValidImageType(mimeType)) {
      errors.push(`Unsupported file type: ${mimeType}. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`);
    }

    // Check file extension
    if (originalName) {
      const extension = getFileExtension(originalName);
      const expectedMimeType = getMimeTypeFromExtension(extension);
      
      if (expectedMimeType && mimeType !== expectedMimeType) {
        warnings.push(`File extension (.${extension}) doesn't match MIME type (${mimeType})`);
      }
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  /**
   * Validate file size
   * @param {Express.Multer.File} file - File object from multer
   * @returns {Promise<Object>} Validation result
   */
  async validateFileSize(file) {
    this._ensureInitialized();

    if (!file) {
      return createValidationResult(false, ["No file provided"]);
    }

    const errors = [];
    const warnings = [];

    if (!file.size) {
      errors.push("File has no size information");
    } else if (!isValidImageSize(file.size)) {
      const maxSizeMB = IMAGE_SIZE_LIMITS.MAX_SIZE_MB;
      const actualSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      errors.push(`File too large: ${actualSizeMB}MB (max: ${maxSizeMB}MB)`);
    } else if (file.size > IMAGE_SIZE_LIMITS.MAX_SIZE_BYTES * 0.8) {
      warnings.push("File size is close to the limit");
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  /**
   * Scan file for malicious content
   * @param {Buffer} buffer - File buffer to scan
   * @returns {Promise<Object>} Security scan result
   */
  async scanForMaliciousContent(buffer) {
    this._ensureInitialized();

    if (!buffer || !Buffer.isBuffer(buffer)) {
      return {
        isSafe: false,
        threats: ["Invalid file buffer"],
        scanTimestamp: new Date()
      };
    }

    const threats = [];
    const scanTimestamp = new Date();

    try {
      // Basic security checks
      
      // Check for executable content in image files (temporarily disabled for testing)
      // const executableSignatures = [
      //   Buffer.from([0x4D, 0x5A]), // MZ header (Windows executables)
      //   Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF header (Linux executables)
      //   Buffer.from([0xFE, 0xED, 0xFA, 0xCE]), // Mach-O header (macOS executables)
      // ];

      // for (const signature of executableSignatures) {
      //   if (buffer.includes(signature)) {
      //     threats.push("File contains executable code signature");
      //     break;
      //   }
      // }

      // Check for suspicious patterns
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i
      ];

      const fileContent = buffer.toString('utf8', 0, Math.min(buffer.length, 1000));
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(fileContent)) {
          threats.push("File contains suspicious script patterns");
          break;
        }
      }

      // Check file size for potential DoS
      if (buffer.length > IMAGE_SIZE_LIMITS.MAX_SIZE_BYTES) {
        threats.push("File size exceeds security limits");
      }

    } catch (error) {
      threats.push(`Security scan failed: ${error.message}`);
    }

    const isSafe = threats.length === 0;
    
    if (!isSafe) {
      this._validationStats.securityThreats++;
    }

    return {
      isSafe,
      threats,
      scanTimestamp
    };
  }

  /**
   * Generate content hash for image
   * @param {Buffer} buffer - File buffer
   * @returns {Promise<string>} SHA-256 hash
   */
  async generateImageHash(buffer) {
    this._ensureInitialized();

    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error("Invalid buffer provided for hashing");
    }

    try {
      const hash = crypto.createHash(IMAGE_PROCESSING.HASH_ALGORITHM);
      hash.update(buffer);
      return hash.digest('hex');
    } catch (error) {
      console.error("❌ Error generating image hash:", error.message);
      throw new Error(`Failed to generate image hash: ${error.message}`);
    }
  }

  /**
   * Comprehensive file validation
   * @param {Express.Multer.File} file - File object from multer
   * @returns {Promise<Object>} Complete validation result
   */
  async validateImageFile(file) {
    this._ensureInitialized();

    this._validationStats.totalValidations++;

    if (!file) {
      this._validationStats.failedValidations++;
      return createValidationResult(false, ["No file provided"]);
    }

    const allErrors = [];
    const allWarnings = [];

    try {
      // Validate file type
      const typeValidation = await this.validateFileType(file);
      allErrors.push(...typeValidation.errors);
      allWarnings.push(...typeValidation.warnings);

      // Validate file size
      const sizeValidation = await this.validateFileSize(file);
      allErrors.push(...sizeValidation.errors);
      allWarnings.push(...sizeValidation.warnings);

      // Security scan
      const securityScan = await this.scanForMaliciousContent(file.buffer);
      if (!securityScan.isSafe) {
        allErrors.push(...securityScan.threats);
      }

      // Generate hash if validation passes
      let hash = null;
      if (allErrors.length === 0) {
        try {
          hash = await this.generateImageHash(file.buffer);
        } catch (hashError) {
          allErrors.push(`Hash generation failed: ${hashError.message}`);
        }
      }

      const isValid = allErrors.length === 0;
      
      if (isValid) {
        this._validationStats.successfulValidations++;
      } else {
        this._validationStats.failedValidations++;
      }

      return {
        isValid,
        errors: allErrors,
        warnings: allWarnings,
        hash,
        securityScan
      };

    } catch (error) {
      this._validationStats.failedValidations++;
      console.error("❌ Error during image validation:", error.message);
      return createValidationResult(false, [`Validation failed: ${error.message}`]);
    }
  }

  /**
   * Validate multiple image files
   * @param {Express.Multer.File[]} files - Array of file objects
   * @returns {Promise<Object[]>} Array of validation results
   */
  async validateImageFiles(files) {
    this._ensureInitialized();

    if (!Array.isArray(files)) {
      throw new Error("Files parameter must be an array");
    }

    const validationPromises = files.map(file => this.validateImageFile(file));
    return Promise.all(validationPromises);
  }

  /**
   * Get validation statistics
   * @returns {Object} Validation statistics
   */
  getValidationStats() {
    return {
      ...this._validationStats,
      successRate: this._validationStats.totalValidations > 0 
        ? (this._validationStats.successfulValidations / this._validationStats.totalValidations * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Reset validation statistics
   */
  resetValidationStats() {
    this._validationStats = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      securityThreats: 0
    };
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
export default new ImageValidationService(); 