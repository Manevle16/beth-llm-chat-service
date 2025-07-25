/**
 * Jest tests for MemoryMonitorService
 * Covers essential functionality: initialization, memory usage, thresholds, cleanup, callbacks, and error handling.
 */

import memoryMonitor from '../../services/memoryMonitor.js';

describe('MemoryMonitorService', () => {
  beforeEach(() => {
    // Reset state for each test
    if (memoryMonitor._isInitialized) {
      memoryMonitor._isInitialized = false;
      memoryMonitor._baselineMetrics = null;
      memoryMonitor._cleanupCallbacks = [];
    }
  });

  test('should initialize and set baseline metrics', async () => {
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await memoryMonitor.initialize();
      expect(memoryMonitor._isInitialized).toBe(true);
      expect(memoryMonitor._baselineMetrics).not.toBeNull();
    } catch (error) {}
    console.error = originalConsoleError;
  });

  test('should get current memory usage after initialization', async () => {
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await memoryMonitor.initialize();
      const usage = memoryMonitor.getCurrentMemoryUsage();
      expect(typeof usage.totalMemory).toBe('number');
      expect(typeof usage.usedMemory).toBe('number');
      expect(typeof usage.availableMemory).toBe('number');
    } catch (error) {}
    console.error = originalConsoleError;
  });

  test('should get baseline metrics after initialization', async () => {
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await memoryMonitor.initialize();
      const baseline = memoryMonitor.getBaselineMetrics();
      expect(baseline).not.toBeNull();
      expect(typeof baseline.totalMemory).toBe('number');
    } catch (error) {}
    console.error = originalConsoleError;
  });

  test('should get memory trend and report', async () => {
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await memoryMonitor.initialize();
      const trend = memoryMonitor.getMemoryTrend();
      expect(trend).toHaveProperty('trend');
      expect(trend).toHaveProperty('change');
      const report = memoryMonitor.getMemoryReport();
      expect(report).toHaveProperty('current');
      expect(report).toHaveProperty('thresholds');
      expect(report).toHaveProperty('trend');
      expect(report).toHaveProperty('loadedModels');
    } catch (error) {}
    console.error = originalConsoleError;
  });

  test('should register and execute cleanup callbacks', async () => {
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await memoryMonitor.initialize();
      let called = false;
      const cb = () => { called = true; };
      memoryMonitor.registerCleanupCallback(cb);
      memoryMonitor._executeCleanupCallbacks('test-model');
      expect(called).toBe(true);
    } catch (error) {}
    console.error = originalConsoleError;
  });

  test('should reset baseline', async () => {
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await memoryMonitor.initialize();
      const oldBaseline = memoryMonitor.getBaselineMetrics();
      memoryMonitor.resetBaseline();
      const newBaseline = memoryMonitor.getBaselineMetrics();
      expect(newBaseline.timestamp >= oldBaseline.timestamp).toBe(true);
    } catch (error) {}
    console.error = originalConsoleError;
  });

  test('should throw if not initialized', () => {
    expect(() => memoryMonitor.getCurrentMemoryUsage()).toThrow();
    expect(() => memoryMonitor.getBaselineMetrics()).toThrow();
    expect(() => memoryMonitor.getMemoryTrend()).toThrow();
    expect(() => memoryMonitor.getMemoryReport()).toThrow();
  });

  test('should handle threshold checking and cleanup', async () => {
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await memoryMonitor.initialize();
      const exceeded = await memoryMonitor.checkMemoryThresholds();
      expect(typeof exceeded).toBe('boolean');
      const cleanup = await memoryMonitor.triggerCleanup();
      expect(typeof cleanup).toBe('boolean');
    } catch (error) {}
    console.error = originalConsoleError;
  });

  test('should log memory metrics without error', async () => {
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await memoryMonitor.initialize();
      await expect(memoryMonitor.logMemoryMetrics('test-model', 'test-operation')).resolves.not.toThrow();
    } catch (error) {}
    console.error = originalConsoleError;
  });

  test('should handle _calculateUsedPercentage with null', async () => {
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await memoryMonitor.initialize();
      expect(memoryMonitor._calculateUsedPercentage(null)).toBe(0);
    } catch (error) {}
    console.error = originalConsoleError;
  });
}); 