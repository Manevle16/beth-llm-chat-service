/**
 * Jest tests for MemoryMonitorService
 * Covers essential functionality: initialization, memory usage, thresholds, cleanup, callbacks, and error handling.
 */

import memoryMonitor from '../../services/memoryMonitor.js';

describe('MemoryMonitorService', () => {
  beforeEach(async () => {
    // Reset state for each test
    if (memoryMonitor._isInitialized) {
      memoryMonitor._isInitialized = false;
      memoryMonitor._baselineMetrics = null;
      memoryMonitor._cleanupCallbacks = [];
    }
  });

  test('should initialize and set baseline metrics', async () => {
    await memoryMonitor.initialize();
    expect(memoryMonitor._isInitialized).toBe(true);
    expect(memoryMonitor._baselineMetrics).not.toBeNull();
  });

  test('should get current memory usage after initialization', async () => {
    await memoryMonitor.initialize();
    const usage = memoryMonitor.getCurrentMemoryUsage();
    expect(typeof usage.totalMemory).toBe('number');
    expect(typeof usage.usedMemory).toBe('number');
    expect(typeof usage.availableMemory).toBe('number');
  });

  test('should get baseline metrics after initialization', async () => {
    await memoryMonitor.initialize();
    const baseline = memoryMonitor.getBaselineMetrics();
    expect(baseline).not.toBeNull();
    expect(typeof baseline.totalMemory).toBe('number');
  });

  test('should get memory trend and report', async () => {
    await memoryMonitor.initialize();
    const trend = memoryMonitor.getMemoryTrend();
    expect(trend).toHaveProperty('trend');
    expect(trend).toHaveProperty('change');
    const report = memoryMonitor.getMemoryReport();
    expect(report).toHaveProperty('current');
    expect(report).toHaveProperty('thresholds');
    expect(report).toHaveProperty('trend');
    expect(report).toHaveProperty('loadedModels');
  });

  test('should register and execute cleanup callbacks', async () => {
    await memoryMonitor.initialize();
    let called = false;
    const cb = () => { called = true; };
    memoryMonitor.registerCleanupCallback(cb);
    // Simulate callback execution
    memoryMonitor._executeCleanupCallbacks('test-model');
    expect(called).toBe(true);
  });

  test('should reset baseline', async () => {
    await memoryMonitor.initialize();
    const oldBaseline = memoryMonitor.getBaselineMetrics();
    memoryMonitor.resetBaseline();
    const newBaseline = memoryMonitor.getBaselineMetrics();
    expect(newBaseline.timestamp >= oldBaseline.timestamp).toBe(true);
  });

  test('should throw if not initialized', () => {
    expect(() => memoryMonitor.getCurrentMemoryUsage()).toThrow();
    expect(() => memoryMonitor.getBaselineMetrics()).toThrow();
    expect(() => memoryMonitor.getMemoryTrend()).toThrow();
    expect(() => memoryMonitor.getMemoryReport()).toThrow();
  });

  test('should handle threshold checking and cleanup', async () => {
    await memoryMonitor.initialize();
    // This will depend on actual system memory, but should not throw
    const exceeded = await memoryMonitor.checkMemoryThresholds();
    expect(typeof exceeded).toBe('boolean');
    const cleanup = await memoryMonitor.triggerCleanup();
    expect(typeof cleanup).toBe('boolean');
  });

  test('should log memory metrics without error', async () => {
    await memoryMonitor.initialize();
    await expect(memoryMonitor.logMemoryMetrics('test-model', 'test-operation')).resolves.not.toThrow();
  });

  test('should handle _calculateUsedPercentage with null', async () => {
    await memoryMonitor.initialize();
    // Should not throw, should return 0
    expect(memoryMonitor._calculateUsedPercentage(null)).toBe(0);
  });
}); 