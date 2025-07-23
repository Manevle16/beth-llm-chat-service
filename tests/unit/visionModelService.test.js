const { VisionModelService } = require('../../services/visionModelService.js');
const { OllamaService } = require('../../services/ollamaService.js');
const { ImageValidationService } = require('../../services/imageValidationService.js');
const { ImageStorageService } = require('../../services/imageStorageService.js');
const { ImageDatabaseService } = require('../../services/imageDatabaseService.js');
const { ErrorHandlingService } = require('../../services/errorHandlingService.js');
const { VISION_MESSAGE_TYPES, createVisionMessage } = require('../../types/imageUpload.js');
const fs = require('fs/promises');
const path = require('path');

// Mock dependencies
jest.mock('../../services/ollamaService.js');
jest.mock('../../services/imageValidationService.js');
jest.mock('../../services/imageStorageService.js');
jest.mock('../../services/imageDatabaseService.js');
jest.mock('../../services/errorHandlingService.js');
jest.mock('fs/promises');

describe('VisionModelService', () => {
  let visionModelService;
  let mockOllamaService;
  let mockImageValidationService;
  let mockImageStorageService;
  let mockImageDatabaseService;
  let mockErrorHandlingService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockOllamaService = {
      initialize: jest.fn().mockResolvedValue(),
      getModelInfo: jest.fn(),
      listModels: jest.fn(),
      generate: jest.fn(),
      streamGenerate: jest.fn()
    };

    mockImageValidationService = {
      initialize: jest.fn().mockResolvedValue()
    };

    mockImageStorageService = {
      initialize: jest.fn().mockResolvedValue(),
      getImagePath: jest.fn()
    };

    mockImageDatabaseService = {
      initialize: jest.fn().mockResolvedValue(),
      getImageById: jest.fn()
    };

    mockErrorHandlingService = {
      initialize: jest.fn().mockResolvedValue()
    };

    // Mock constructor calls
    OllamaService.mockImplementation(() => mockOllamaService);
    ImageValidationService.mockImplementation(() => mockImageValidationService);
    ImageStorageService.mockImplementation(() => mockImageStorageService);
    ImageDatabaseService.mockImplementation(() => mockImageDatabaseService);
    ErrorHandlingService.mockImplementation(() => mockErrorHandlingService);

    visionModelService = new VisionModelService();
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      await visionModelService.initialize();
      
      expect(visionModelService.initialized).toBe(true);
      expect(mockOllamaService.initialize).toHaveBeenCalled();
      expect(mockImageValidationService.initialize).toHaveBeenCalled();
      expect(mockImageStorageService.initialize).toHaveBeenCalled();
      expect(mockImageDatabaseService.initialize).toHaveBeenCalled();
      expect(mockErrorHandlingService.initialize).toHaveBeenCalled();
    });

    test('should handle initialization failure', async () => {
      mockOllamaService.initialize.mockRejectedValue(new Error('Ollama failed'));
      
      await expect(visionModelService.initialize()).rejects.toThrow('Ollama failed');
      expect(visionModelService.initialized).toBe(false);
    });
  });

  describe('hasVisionCapability', () => {
    beforeEach(async () => {
      await visionModelService.initialize();
    });

    test('should return true for vision-capable model', async () => {
      mockOllamaService.getModelInfo.mockResolvedValue({
        name: 'llava',
        parameters: 'vision-enabled',
        family: 'vision'
      });

      const result = await visionModelService.hasVisionCapability('llava');
      
      expect(result).toBe(true);
      expect(mockOllamaService.getModelInfo).toHaveBeenCalledWith('llava');
    });

    test('should return false for non-vision model', async () => {
      mockOllamaService.getModelInfo.mockResolvedValue({
        name: 'llama2',
        parameters: 'text-only'
      });

      const result = await visionModelService.hasVisionCapability('llama2');
      
      expect(result).toBe(false);
    });

    test('should cache results', async () => {
      mockOllamaService.getModelInfo.mockResolvedValue({
        name: 'llava',
        parameters: 'vision-enabled'
      });

      // First call
      await visionModelService.hasVisionCapability('llava');
      // Second call should use cache
      await visionModelService.hasVisionCapability('llava');
      
      expect(mockOllamaService.getModelInfo).toHaveBeenCalledTimes(1);
    });

    test('should handle API errors gracefully', async () => {
      mockOllamaService.getModelInfo.mockRejectedValue(new Error('API error'));

      const result = await visionModelService.hasVisionCapability('unknown-model');
      
      expect(result).toBe(false);
    });
  });

  describe('convertImageToBase64', () => {
    beforeEach(async () => {
      await visionModelService.initialize();
    });

    test('should convert PNG image to base64', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      fs.readFile.mockResolvedValue(mockBuffer);

      const result = await visionModelService.convertImageToBase64('/path/to/image.png');
      
      expect(result).toMatch(/^data:image\/png;base64,/);
      expect(fs.readFile).toHaveBeenCalledWith('/path/to/image.png');
    });

    test('should convert JPEG image to base64', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      fs.readFile.mockResolvedValue(mockBuffer);

      const result = await visionModelService.convertImageToBase64('/path/to/image.jpg');
      
      expect(result).toMatch(/^data:image\/jpeg;base64,/);
    });

    test('should handle file read errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(visionModelService.convertImageToBase64('/invalid/path.png'))
        .rejects.toThrow('Failed to convert image to base64: File not found');
    });
  });

  describe('getMimeTypeFromExtension', () => {
    test('should return correct MIME types', () => {
      expect(visionModelService.getMimeTypeFromExtension('.png')).toBe('image/png');
      expect(visionModelService.getMimeTypeFromExtension('.jpg')).toBe('image/jpeg');
      expect(visionModelService.getMimeTypeFromExtension('.jpeg')).toBe('image/jpeg');
      expect(visionModelService.getMimeTypeFromExtension('.webp')).toBe('image/webp');
      expect(visionModelService.getMimeTypeFromExtension('.gif')).toBe('image/gif');
    });

    test('should return default for unknown extension', () => {
      expect(visionModelService.getMimeTypeFromExtension('.unknown')).toBe('image/png');
    });
  });

  describe('processImagesForVision', () => {
    beforeEach(async () => {
      await visionModelService.initialize();
    });

    test('should process images correctly', async () => {
      const mockImageRecord = {
        id: 'img-123',
        filename: 'test.png',
        mime_type: 'image/png'
      };

      mockImageDatabaseService.getImageById.mockResolvedValue(mockImageRecord);
      mockImageStorageService.getImagePath.mockResolvedValue('/uploads/images/img-123.png');
      
      const mockBuffer = Buffer.from('fake-image-data');
      fs.readFile.mockResolvedValue(mockBuffer);

      const result = await visionModelService.processImagesForVision(['img-123']);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: VISION_MESSAGE_TYPES.IMAGE,
        image_id: 'img-123',
        filename: 'test.png',
        mime_type: 'image/png'
      });
      expect(result[0].image_url).toMatch(/^data:image\/png;base64,/);
    });

    test('should handle missing image record', async () => {
      mockImageDatabaseService.getImageById.mockResolvedValue(null);

      await expect(visionModelService.processImagesForVision(['img-123']))
        .rejects.toThrow('Image not found: img-123');
    });

    test('should handle missing image file', async () => {
      const mockImageRecord = { id: 'img-123', filename: 'test.png' };
      mockImageDatabaseService.getImageById.mockResolvedValue(mockImageRecord);
      mockImageStorageService.getImagePath.mockResolvedValue(null);

      await expect(visionModelService.processImagesForVision(['img-123']))
        .rejects.toThrow('Image file not found: img-123');
    });
  });

  describe('sendVisionRequest', () => {
    beforeEach(async () => {
      await visionModelService.initialize();
    });

    test('should send vision request successfully', async () => {
      mockOllamaService.getModelInfo.mockResolvedValue({
        name: 'llava',
        parameters: 'vision-enabled'
      });

      const visionMessages = [
        createVisionMessage({
          type: VISION_MESSAGE_TYPES.IMAGE,
          image_url: 'data:image/png;base64,fake-data',
          image_id: 'img-123'
        })
      ];

      const mockResponse = { response: 'Vision analysis result' };
      mockOllamaService.generate.mockResolvedValue(mockResponse);

      const result = await visionModelService.sendVisionRequest(
        'llava',
        'Describe this image',
        visionMessages,
        { temperature: 0.7 }
      );

      expect(result).toEqual(mockResponse);
      expect(mockOllamaService.generate).toHaveBeenCalledWith({
        model: 'llava',
        prompt: 'Describe this image',
        images: ['data:image/png;base64,fake-data'],
        stream: false,
        options: { temperature: 0.7 }
      });
    });

    test('should reject non-vision models', async () => {
      mockOllamaService.getModelInfo.mockResolvedValue({
        name: 'llama2',
        parameters: 'text-only'
      });

      const visionMessages = [
        createVisionMessage({
          type: VISION_MESSAGE_TYPES.IMAGE,
          image_url: 'data:image/png;base64,fake-data'
        })
      ];

      await expect(visionModelService.sendVisionRequest(
        'llama2',
        'Describe this image',
        visionMessages
      )).rejects.toThrow('Model llama2 does not support vision capabilities');
    });
  });

  describe('streamVisionRequest', () => {
    beforeEach(async () => {
      await visionModelService.initialize();
    });

    test('should stream vision request successfully', async () => {
      mockOllamaService.getModelInfo.mockResolvedValue({
        name: 'llava',
        parameters: 'vision-enabled'
      });

      const visionMessages = [
        createVisionMessage({
          type: VISION_MESSAGE_TYPES.IMAGE,
          image_url: 'data:image/png;base64,fake-data'
        })
      ];

      const onChunk = jest.fn();
      mockOllamaService.streamGenerate.mockResolvedValue();

      await visionModelService.streamVisionRequest(
        'llava',
        'Describe this image',
        visionMessages,
        { temperature: 0.7 },
        onChunk
      );

      expect(mockOllamaService.streamGenerate).toHaveBeenCalledWith({
        model: 'llava',
        prompt: 'Describe this image',
        images: ['data:image/png;base64,fake-data'],
        stream: true,
        options: { temperature: 0.7 }
      }, onChunk);
    });
  });

  describe('validateVisionRequest', () => {
    beforeEach(async () => {
      await visionModelService.initialize();
    });

    test('should validate correct request', async () => {
      mockOllamaService.getModelInfo.mockResolvedValue({
        name: 'llava',
        parameters: 'vision-enabled'
      });

      mockImageDatabaseService.getImageById.mockResolvedValue({
        id: 'img-123',
        filename: 'test.png'
      });

      const result = await visionModelService.validateVisionRequest(
        'llava',
        'Describe this image',
        ['img-123']
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid model name', async () => {
      const result = await visionModelService.validateVisionRequest(
        '',
        'Describe this image',
        ['img-123']
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Model name is required and must be a string');
    });

    test('should reject missing prompt', async () => {
      const result = await visionModelService.validateVisionRequest(
        'llava',
        '',
        ['img-123']
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Prompt is required and must be a string');
    });

    test('should reject missing image IDs', async () => {
      const result = await visionModelService.validateVisionRequest(
        'llava',
        'Describe this image',
        []
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one image ID is required');
    });

    test('should reject non-vision models', async () => {
      mockOllamaService.getModelInfo.mockResolvedValue({
        name: 'llama2',
        parameters: 'text-only'
      });

      mockImageDatabaseService.getImageById.mockResolvedValue({
        id: 'img-123',
        filename: 'test.png'
      });

      const result = await visionModelService.validateVisionRequest(
        'llama2',
        'Describe this image',
        ['img-123']
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Model llama2 does not support vision capabilities');
    });
  });

  describe('getVisionCapabilitiesForAllModels', () => {
    beforeEach(async () => {
      await visionModelService.initialize();
    });

    test('should get capabilities for all models', async () => {
      mockOllamaService.listModels.mockResolvedValue([
        { name: 'llava' },
        { name: 'llama2' }
      ]);

      mockOllamaService.getModelInfo
        .mockResolvedValueOnce({ name: 'llava', parameters: 'vision-enabled' })
        .mockResolvedValueOnce({ name: 'llama2', parameters: 'text-only' });

      const result = await visionModelService.getVisionCapabilitiesForAllModels();

      expect(result).toEqual({
        llava: true,
        llama2: false
      });
    });
  });

  describe('clearVisionCapabilityCache', () => {
    test('should clear the cache', async () => {
      await visionModelService.initialize();
      
      // Populate cache
      mockOllamaService.getModelInfo.mockResolvedValue({
        name: 'llava',
        parameters: 'vision-enabled'
      });
      
      await visionModelService.hasVisionCapability('llava');
      expect(visionModelService.visionCapabilities.size).toBe(1);

      // Clear cache
      visionModelService.clearVisionCapabilityCache();
      expect(visionModelService.visionCapabilities.size).toBe(0);
    });
  });

  describe('getStats', () => {
    test('should return service statistics', () => {
      const stats = visionModelService.getStats();
      
      expect(stats).toMatchObject({
        initialized: false,
        cachedCapabilities: 0,
        service: 'VisionModelService'
      });
    });
  });
}); 