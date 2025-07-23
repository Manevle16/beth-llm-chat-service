import ollamaService from './ollamaService.js';
import imageValidationService from './imageValidationService.js';
import imageStorageService from './imageStorageService.js';
import imageDatabaseService from './imageDatabaseService.js';
import errorHandlingService from './errorHandlingService.js';
import { 
  VISION_MESSAGE_TYPES, 
  IMAGE_UPLOAD_TYPES,
  createVisionMessage,
  createValidationResult 
} from '../types/imageUpload.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Service for handling vision model integration with Ollama
 * Supports vision capability detection, image processing, and vision API calls
 */
class VisionModelService {
  constructor() {
    this.ollamaService = null;
    this.imageValidationService = null;
    this.imageStorageService = null;
    this.imageDatabaseService = null;
    this.errorHandlingService = null;
    this.visionCapabilities = new Map(); // Cache for model vision capabilities
    this.initialized = false;
  }

  /**
   * Initialize the vision model service
   */
  async initialize() {
    try {
          this.ollamaService = ollamaService;
    this.imageValidationService = imageValidationService;
    this.imageStorageService = imageStorageService;
    this.imageDatabaseService = imageDatabaseService;
    this.errorHandlingService = errorHandlingService;

          // All services are already initialized as singletons

      this.initialized = true;
      console.log('✅ VisionModelService initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize VisionModelService:', error);
      throw error;
    }
  }

  /**
   * Check if a model supports vision capabilities
   * @param {string} modelName - The name of the model to check
   * @returns {Promise<boolean>} - True if model supports vision
   */
  async hasVisionCapability(modelName) {
    try {
      // Check cache first
      if (this.visionCapabilities.has(modelName)) {
        return this.visionCapabilities.get(modelName);
      }

      // Query Ollama for model details
      const modelInfo = await this.ollamaService.getModelInfo(modelName);
      
      // Check if model supports vision (look for vision-related parameters)
      const hasVision = modelInfo && (
        modelInfo.parameters?.includes('vision') ||
        modelInfo.modelfile?.includes('vision') ||
        modelInfo.family?.toLowerCase().includes('vision') ||
        modelInfo.name?.toLowerCase().includes('vision') ||
        modelInfo.details?.capabilities?.includes('vision')
      );

      // Cache the result
      this.visionCapabilities.set(modelName, hasVision);
      
      return hasVision;
    } catch (error) {
      console.warn(`⚠️ Could not determine vision capability for model ${modelName}:`, error.message);
      // Default to false for safety
      this.visionCapabilities.set(modelName, false);
      return false;
    }
  }

  /**
   * Convert a local image file to base64 for Ollama vision API
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<string>} - Base64 encoded image data
   */
  async convertImageToBase64(imagePath) {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64Data = imageBuffer.toString('base64');
      
      // Get MIME type from file extension
      const ext = path.extname(imagePath).toLowerCase();
      const mimeType = this.getMimeTypeFromExtension(ext);
      
      return `data:${mimeType};base64,${base64Data}`;
    } catch (error) {
      throw new Error(`Failed to convert image to base64: ${error.message}`);
    }
  }

  /**
   * Get MIME type from file extension
   * @param {string} extension - File extension (e.g., '.png')
   * @returns {string} - MIME type
   */
  getMimeTypeFromExtension(extension) {
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    };
    
    return mimeTypes[extension] || 'image/png';
  }

  /**
   * Process images for vision model input
   * @param {Array<string>} imageIds - Array of image IDs to process
   * @returns {Promise<Array>} - Array of vision message objects
   */
  async processImagesForVision(imageIds) {
    try {
      const visionMessages = [];
      
      for (const imageId of imageIds) {
        // Get image record from database
        const imageRecord = await this.imageDatabaseService.getImageById(imageId);
        if (!imageRecord) {
          throw new Error(`Image not found: ${imageId}`);
        }

        // Validate image file exists
        const imagePath = await this.imageStorageService.getImagePath(imageId);
        if (!imagePath) {
          throw new Error(`Image file not found: ${imageId}`);
        }

        // Convert to base64
        const base64Data = await this.convertImageToBase64(imagePath);
        
        // Create vision message
        const visionMessage = createVisionMessage({
          type: VISION_MESSAGE_TYPES.IMAGE,
          image_url: base64Data,
          image_id: imageId,
          filename: imageRecord.filename,
          mime_type: imageRecord.mime_type
        });
        
        visionMessages.push(visionMessage);
      }
      
      return visionMessages;
    } catch (error) {
      throw new Error(`Failed to process images for vision: ${error.message}`);
    }
  }

  /**
   * Send a vision request to Ollama with image data
   * @param {string} modelName - The model to use
   * @param {string} prompt - Text prompt
   * @param {Array} visionMessages - Array of vision message objects
   * @param {Object} options - Additional options for the request
   * @returns {Promise<Object>} - Ollama response
   */
  async sendVisionRequest(modelName, prompt, visionMessages, options = {}) {
    try {
      // Check vision capability
      const hasVision = await this.hasVisionCapability(modelName);
      if (!hasVision) {
        throw new Error(`Model ${modelName} does not support vision capabilities`);
      }

      // Prepare vision request payload
      const visionPayload = {
        model: modelName,
        prompt: prompt,
        images: visionMessages.map(msg => msg.image_url),
        stream: options.stream || false,
        options: {
          ...options,
          // Remove non-Ollama options
          stream: undefined,
          images: undefined
        }
      };

      // Send request to Ollama
      const response = await this.ollamaService.generate(visionPayload);
      return response;
    } catch (error) {
      throw new Error(`Vision request failed: ${error.message}`);
    }
  }

  /**
   * Stream a vision request to Ollama with image data
   * @param {string} modelName - The model to use
   * @param {string} prompt - Text prompt
   * @param {Array} visionMessages - Array of vision message objects
   * @param {Object} options - Additional options for the request
   * @param {Function} onChunk - Callback for each response chunk
   * @returns {Promise<void>}
   */
  async streamVisionRequest(modelName, prompt, visionMessages, options = {}, onChunk) {
    try {
      // Check vision capability
      const hasVision = await this.hasVisionCapability(modelName);
      if (!hasVision) {
        throw new Error(`Model ${modelName} does not support vision capabilities`);
      }

      // Prepare vision request payload
      const visionPayload = {
        model: modelName,
        prompt: prompt,
        images: visionMessages.map(msg => msg.image_url),
        stream: true,
        options: {
          ...options,
          // Remove non-Ollama options
          stream: undefined,
          images: undefined
        }
      };

      // Stream request to Ollama
      await this.ollamaService.streamGenerate(visionPayload, onChunk);
    } catch (error) {
      throw new Error(`Vision stream request failed: ${error.message}`);
    }
  }

  /**
   * Validate vision request parameters
   * @param {string} modelName - The model name
   * @param {string} prompt - The text prompt
   * @param {Array} imageIds - Array of image IDs
   * @returns {Promise<Object>} - Validation result
   */
  async validateVisionRequest(modelName, prompt, imageIds) {
    try {
      const errors = [];

      // Validate model name
      if (!modelName || typeof modelName !== 'string') {
        errors.push('Model name is required and must be a string');
      }

      // Validate prompt
      if (!prompt || typeof prompt !== 'string') {
        errors.push('Prompt is required and must be a string');
      }

      // Validate image IDs
      if (!Array.isArray(imageIds) || imageIds.length === 0) {
        errors.push('At least one image ID is required');
      }

      // Check if images exist in database
      for (const imageId of imageIds) {
        const imageRecord = await this.imageDatabaseService.getImageById(imageId);
        if (!imageRecord) {
          errors.push(`Image not found: ${imageId}`);
        }
      }

      // Check vision capability if no other errors
      if (errors.length === 0) {
        const hasVision = await this.hasVisionCapability(modelName);
        if (!hasVision) {
          errors.push(`Model ${modelName} does not support vision capabilities`);
        }
      }

      return createValidationResult({
        isValid: errors.length === 0,
        errors: errors
      });
    } catch (error) {
      return createValidationResult({
        isValid: false,
        errors: [`Validation failed: ${error.message}`]
      });
    }
  }

  /**
   * Get vision capabilities for all available models
   * @returns {Promise<Object>} - Map of model names to vision capability
   */
  async getVisionCapabilitiesForAllModels() {
    try {
      const models = await this.ollamaService.listModels();
      const capabilities = {};

      for (const model of models) {
        capabilities[model.name] = await this.hasVisionCapability(model.name);
      }

      return capabilities;
    } catch (error) {
      throw new Error(`Failed to get vision capabilities: ${error.message}`);
    }
  }

  /**
   * Clear vision capability cache
   */
  clearVisionCapabilityCache() {
    this.visionCapabilities.clear();
  }

  /**
   * Get service statistics
   * @returns {Object} - Service statistics
   */
  getStats() {
    return {
      initialized: this.initialized,
      cachedCapabilities: this.visionCapabilities.size,
      service: 'VisionModelService'
    };
  }
}

// Export singleton instance
const visionModelService = new VisionModelService();
export { VisionModelService, visionModelService }; 