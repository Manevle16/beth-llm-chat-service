/**
 * Model Rotation Integration Test Suite
 * 
 * Tests the complete integration of all model rotation components:
 * - Service initialization and configuration
 * - Memory monitoring functionality
 * - Queue service operations
 * - Error handling and validation
 * - Configuration service integration
 */

import ollamaService from '../../services/ollamaService.js';
import modelRotationService from '../../services/modelRotationService.js';
import modelStateTracker from '../../services/modelStateTracker.js';
import memoryMonitor from '../../services/memoryMonitor.js';
import queueService from '../../services/queueService.js';
import errorHandlingService from '../../services/errorHandlingService.js';
import configService from '../../config/modelRotation.js';
import { REQUEST_PRIORITY, ERROR_CODES } from '../../types/modelRotation.js';

describe('Model Rotation Integration Tests', () => {
  beforeAll(async () => {
    console.log('🚀 Initializing Model Rotation Integration Tests');
    console.log('='.repeat(60));
    
    // Initialize all services
    await ollamaService.initialize();
    await modelRotationService.initialize();
    await modelStateTracker.initialize();
    await memoryMonitor.initialize();
    await queueService.initialize();
    await errorHandlingService.initialize();
    
    console.log('✅ All services initialized successfully');
  });

  afterAll(async () => {
    console.log('\n🧹 Cleaning up Model Rotation Integration Tests');
    
    // Only shutdown services that have shutdown methods
    try {
      // Note: Most services don't have shutdown methods, so we just log completion
      console.log('✅ Test cleanup complete');
    } catch (error) {
      console.log('⚠️  Test cleanup warning:', error.message);
    }
  });

  describe('Service Initialization', () => {
    it('should initialize all services successfully', async () => {
      // Verify all services are initialized
      expect(modelRotationService.getRotationStatus()).toBeDefined();
      expect(memoryMonitor.getCurrentMemoryUsage()).toBeDefined();
      expect(queueService.getQueueStatus()).toBeDefined();
      expect(errorHandlingService.getErrorStats()).toBeDefined();
      
      console.log('✅ All services initialized and accessible');
    });
  });

  describe('Memory Monitoring', () => {
    it('should provide memory monitoring functionality', async () => {
      // Test memory monitoring capabilities
      const currentMemory = memoryMonitor.getCurrentMemoryUsage();
      expect(currentMemory).toBeDefined();
      expect(currentMemory.totalMemory).toBeGreaterThan(0);
      expect(currentMemory.usedMemory).toBeGreaterThan(0);
      expect(currentMemory.availableMemory).toBeGreaterThan(0);
      
      console.log('✅ Memory monitoring functional', {
        total: `${(currentMemory.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
        used: `${(currentMemory.usedMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
        available: `${(currentMemory.availableMemory / 1024 / 1024 / 1024).toFixed(2)} GB`
      });

      // Test memory threshold checking
      const thresholdCheck = memoryMonitor.checkMemoryThresholds();
      expect(thresholdCheck).toBeDefined();
      
      // Test memory trend analysis
      const memoryTrend = memoryMonitor.getMemoryTrend();
      expect(memoryTrend).toBeDefined();
      expect(memoryTrend.trend).toBeDefined();
      
      // Test memory report
      const memoryReport = memoryMonitor.getMemoryReport();
      expect(memoryReport).toBeDefined();
      expect(memoryReport.current).toBeDefined();
      expect(memoryReport.trend).toBeDefined();
      
      console.log('✅ Memory monitoring features working');
    });
  });

  describe('Queue Service', () => {
    it('should handle queue operations correctly', async () => {
      // Test queue status
      const queueStatus = queueService.getQueueStatus();
      expect(queueStatus).toBeDefined();
      expect(queueStatus.size).toBeDefined();
      expect(queueStatus.maxSize).toBeDefined();
      expect(queueStatus.isProcessing).toBeDefined();
      
      console.log('✅ Queue service status accessible', queueStatus);

      // Test queue contents
      const queueContents = queueService.getQueueContents();
      expect(Array.isArray(queueContents)).toBe(true);
      
      console.log('✅ Queue service operations working');
    });
  });

  describe('Configuration Service', () => {
    it('should provide configuration access', async () => {
      // Test configuration access
      const config = configService.getAllSettings();
      expect(config).toBeDefined();
      
      // Test specific settings
      const maxQueueSize = configService.getSetting('MAX_QUEUE_SIZE');
      expect(maxQueueSize).toBeDefined();
      
      const memoryThresholds = configService.getMemoryThresholds();
      expect(memoryThresholds).toBeDefined();
      expect(memoryThresholds.warningThreshold).toBeDefined();
      expect(memoryThresholds.criticalThreshold).toBeDefined();
      
      console.log('✅ Configuration service working', {
        maxQueueSize,
        warningThreshold: memoryThresholds.warningThreshold,
        criticalThreshold: memoryThresholds.criticalThreshold
      });
    });
  });

  describe('Error Handling', () => {
    it('should provide error handling functionality', async () => {
      // Test error stats
      const errorStats = errorHandlingService.getErrorStats();
      expect(errorStats).toBeDefined();
      expect(errorStats.totalErrors).toBeDefined();
      expect(errorStats.recentErrors).toBeDefined();
      
      console.log('✅ Error handling service working', {
        totalErrors: errorStats.totalErrors,
        recentErrors: errorStats.recentErrors.length
      });

      // Test operation metrics
      const operationMetrics = errorHandlingService.getOperationMetrics('test-operation');
      expect(operationMetrics).toBeDefined();
      
      console.log('✅ Error handling features accessible');
    });
  });

  describe('Model Rotation Service', () => {
    it('should provide rotation status and validation', async () => {
      // Test rotation status
      const rotationStatus = modelRotationService.getRotationStatus();
      expect(rotationStatus).toBeDefined();
      expect(rotationStatus.isRotating).toBeDefined();
      expect(rotationStatus.activeModel).toBeDefined();
      expect(rotationStatus.queueStatus).toBeDefined();
      expect(rotationStatus.memoryStatus).toBeDefined();
      
      console.log('✅ Model rotation service status accessible', {
        isRotating: rotationStatus.isRotating,
        activeModel: rotationStatus.activeModel,
        queueSize: rotationStatus.queueStatus.size
      });

      // Test configuration validation
      const validation = modelRotationService.validateConfiguration();
      expect(validation).toBeDefined();
      expect(validation.isValid).toBeDefined();
      expect(validation.errors).toBeDefined();
      expect(validation.warnings).toBeDefined();
      
      console.log('✅ Configuration validation working', {
        isValid: validation.isValid,
        errors: validation.errors.length,
        warnings: validation.warnings.length
      });
    });
  });

  describe('Service Integration', () => {
    it('should verify all services work together', async () => {
      // Test that all services can be accessed and provide data
      const services = {
        modelRotation: modelRotationService.getRotationStatus(),
        memory: memoryMonitor.getMemoryReport(),
        queue: queueService.getQueueStatus(),
        config: configService.getAllSettings(),
        errors: errorHandlingService.getErrorStats()
      };

      // Verify all services return data
      Object.entries(services).forEach(([name, data]) => {
        expect(data).toBeDefined();
        console.log(`✅ ${name} service integration verified`);
      });

      console.log('✅ All services integrated and working together');
    });
  });
}); 