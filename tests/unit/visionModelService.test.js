/**
 * Unit tests for VisionModelService
 */

import { VisionModelService } from '../../services/visionModelService.js';

describe('VisionModelService', () => {
  let visionModelService;

  beforeEach(() => {
    visionModelService = new VisionModelService();
  });

  describe('initialization', () => {
    it('should create service instance', () => {
      expect(visionModelService).toBeDefined();
      expect(visionModelService.initialized).toBe(false);
      expect(visionModelService.visionCapabilities).toBeDefined();
    });
  });

  describe('getMimeTypeFromExtension', () => {
    it('should return correct MIME types', () => {
      expect(visionModelService.getMimeTypeFromExtension('.png')).toBe('image/png');
      expect(visionModelService.getMimeTypeFromExtension('.jpg')).toBe('image/jpeg');
      expect(visionModelService.getMimeTypeFromExtension('.jpeg')).toBe('image/jpeg');
      expect(visionModelService.getMimeTypeFromExtension('.webp')).toBe('image/webp');
      expect(visionModelService.getMimeTypeFromExtension('.gif')).toBe('image/gif');
    });

    it('should return default for unknown extension', () => {
      expect(visionModelService.getMimeTypeFromExtension('.unknown')).toBe('image/png');
    });

    it('should handle null and undefined extensions', () => {
      expect(visionModelService.getMimeTypeFromExtension(null)).toBe('image/png');
      expect(visionModelService.getMimeTypeFromExtension(undefined)).toBe('image/png');
    });
  });

  describe('clearVisionCapabilityCache', () => {
    it('should clear the cache', () => {
      // Manually add some entries to the cache
      visionModelService.visionCapabilities.set('test-model-1', true);
      visionModelService.visionCapabilities.set('test-model-2', false);
      
      expect(visionModelService.visionCapabilities.size).toBe(2);

      // Clear cache
      visionModelService.clearVisionCapabilityCache();
      expect(visionModelService.visionCapabilities.size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return service statistics', () => {
      const stats = visionModelService.getStats();
      
      expect(stats).toMatchObject({
        initialized: false,
        cachedCapabilities: 0,
        service: 'VisionModelService'
      });
    });

    it('should reflect cache size in statistics', () => {
      // Add some entries to the cache
      visionModelService.visionCapabilities.set('test-model-1', true);
      visionModelService.visionCapabilities.set('test-model-2', false);
      
      const stats = visionModelService.getStats();
      expect(stats.cachedCapabilities).toBe(2);
    });
  });

  describe('vision capability cache', () => {
    it('should store and retrieve vision capabilities', () => {
      visionModelService.visionCapabilities.set('llava', true);
      visionModelService.visionCapabilities.set('llama2', false);
      
      expect(visionModelService.visionCapabilities.get('llava')).toBe(true);
      expect(visionModelService.visionCapabilities.get('llama2')).toBe(false);
      expect(visionModelService.visionCapabilities.has('unknown-model')).toBe(false);
    });
  });
}); 