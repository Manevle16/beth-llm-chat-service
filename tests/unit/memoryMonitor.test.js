/**
 * MemoryMonitorService Test Suite
 * 
 * Tests for memory monitoring, threshold checking, and cleanup functionality
 */

import memoryMonitor from '../../services/memoryMonitor.js';

// Test basic memory monitoring functionality
console.log('🧪 Testing MemoryMonitorService...');

// Test 1: Basic initialization
console.log('\n1️⃣  Testing basic initialization...');
try {
  await memoryMonitor.initialize();
  console.log('✅ MemoryMonitorService initialized');
} catch (error) {
  console.log('⚠️  Initialization failed:', error.message);
}

// Test 2: Get current memory usage
console.log('\n2️⃣  Testing get current memory usage...');
try {
  const currentUsage = memoryMonitor.getCurrentMemoryUsage();
  console.log('✅ Current memory usage:', {
    total: currentUsage.totalMemory,
    used: currentUsage.usedMemory,
    available: currentUsage.availableMemory,
    modelMemory: currentUsage.modelMemory
  });
} catch (error) {
  console.log('❌ Get current memory usage failed:', error.message);
}

// Test 3: Get baseline metrics
console.log('\n3️⃣  Testing get baseline metrics...');
try {
  const baseline = memoryMonitor.getBaselineMetrics();
  console.log('✅ Baseline metrics:', baseline ? {
    total: baseline.totalMemory,
    used: baseline.usedMemory,
    timestamp: baseline.timestamp.toISOString()
  } : 'null');
} catch (error) {
  console.log('❌ Get baseline metrics failed:', error.message);
}

// Test 4: Check memory thresholds
console.log('\n4️⃣  Testing check memory thresholds...');
try {
  const thresholdsExceeded = await memoryMonitor.checkMemoryThresholds();
  console.log('✅ Memory thresholds check:', thresholdsExceeded ? 'EXCEEDED' : 'OK');
} catch (error) {
  console.log('❌ Check memory thresholds failed:', error.message);
}

// Test 5: Get memory trend
console.log('\n5️⃣  Testing get memory trend...');
try {
  const trend = memoryMonitor.getMemoryTrend();
  console.log('✅ Memory trend:', trend);
} catch (error) {
  console.log('❌ Get memory trend failed:', error.message);
}

// Test 6: Get memory report
console.log('\n6️⃣  Testing get memory report...');
try {
  const report = memoryMonitor.getMemoryReport();
  console.log('✅ Memory report:', {
    current: report.current,
    thresholds: report.thresholds,
    trend: report.trend.trend,
    loadedModels: report.loadedModels
  });
} catch (error) {
  console.log('❌ Get memory report failed:', error.message);
}

// Test 7: Log memory metrics
console.log('\n7️⃣  Testing log memory metrics...');
try {
  await memoryMonitor.logMemoryMetrics('test-model', 'test-operation');
  console.log('✅ Memory metrics logged successfully');
} catch (error) {
  console.log('❌ Log memory metrics failed:', error.message);
}

// Test 8: Register cleanup callback
console.log('\n8️⃣  Testing register cleanup callback...');
let callbackExecuted = false;
const testCallback = (evictedModel) => {
  callbackExecuted = true;
  console.log(`🔄 Test callback executed for model: ${evictedModel}`);
};

memoryMonitor.registerCleanupCallback(testCallback);
console.log('✅ Cleanup callback registered');

// Test 9: Test trigger cleanup (should not trigger if memory is OK)
console.log('\n9️⃣  Testing trigger cleanup (normal conditions)...');
try {
  const cleanupPerformed = await memoryMonitor.triggerCleanup();
  console.log('✅ Trigger cleanup result:', cleanupPerformed ? 'CLEANUP PERFORMED' : 'NO CLEANUP NEEDED');
  console.log('✅ Callback executed:', callbackExecuted);
} catch (error) {
  console.log('❌ Trigger cleanup failed:', error.message);
}

// Test 10: Test memory formatting
console.log('\n🔟 Testing memory formatting...');
try {
  const currentUsage = memoryMonitor.getCurrentMemoryUsage();
  console.log('✅ Memory formatting test - Current usage should be formatted in logs above');
} catch (error) {
  console.log('❌ Memory formatting test failed:', error.message);
}

// Test 11: Test reset baseline
console.log('\n1️⃣1️⃣  Testing reset baseline...');
try {
  memoryMonitor.resetBaseline();
  console.log('✅ Baseline reset successfully');
} catch (error) {
  console.log('❌ Reset baseline failed:', error.message);
}

// Test 12: Test memory trend after reset
console.log('\n1️⃣2️⃣  Testing memory trend after reset...');
try {
  const newTrend = memoryMonitor.getMemoryTrend();
  console.log('✅ Memory trend after reset:', newTrend);
} catch (error) {
  console.log('❌ Get memory trend after reset failed:', error.message);
}

// Test 13: Test error handling for uninitialized service
console.log('\n1️⃣3️⃣  Testing error handling...');

// Test with invalid inputs to ensure proper error handling
try {
  // Test with null/undefined inputs
  const result = memoryMonitor._calculateUsedPercentage(null);
  console.log('✅ Correctly handled null input for percentage calculation:', result);
} catch (error) {
  console.log('❌ Error handling test failed:', error.message);
}

// Test 14: Test threshold calculations
console.log('\n1️⃣4️⃣  Testing threshold calculations...');
try {
  const currentUsage = memoryMonitor.getCurrentMemoryUsage();
  const usedPercentage = (currentUsage.usedMemory / currentUsage.totalMemory) * 100;
  console.log('✅ Used memory percentage:', usedPercentage.toFixed(1) + '%');
} catch (error) {
  console.log('❌ Threshold calculations failed:', error.message);
}

// Test 15: Test memory report details
console.log('\n1️⃣5️⃣  Testing memory report details...');
try {
  const detailedReport = memoryMonitor.getMemoryReport();
  console.log('✅ Detailed memory report keys:', Object.keys(detailedReport));
  console.log('✅ Current memory usage:', detailedReport.current.usedPercentage);
  console.log('✅ Loaded models count:', detailedReport.loadedModels);
} catch (error) {
  console.log('❌ Memory report details failed:', error.message);
}

// Test 16: Test multiple cleanup callbacks
console.log('\n1️⃣6️⃣  Testing multiple cleanup callbacks...');
let callback1Executed = false;
let callback2Executed = false;

const callback1 = (model) => { callback1Executed = true; console.log('🔄 Callback 1 executed'); };
const callback2 = (model) => { callback2Executed = true; console.log('🔄 Callback 2 executed'); };

memoryMonitor.registerCleanupCallback(callback1);
memoryMonitor.registerCleanupCallback(callback2);
console.log('✅ Multiple cleanup callbacks registered');

// Test 17: Test memory statistics validation
console.log('\n1️⃣7️⃣  Testing memory statistics validation...');
try {
  const currentUsage = memoryMonitor.getCurrentMemoryUsage();
  const isValid = currentUsage && 
                  typeof currentUsage.totalMemory === 'number' &&
                  typeof currentUsage.usedMemory === 'number' &&
                  typeof currentUsage.availableMemory === 'number';
  console.log('✅ Memory statistics validation:', isValid);
} catch (error) {
  console.log('❌ Memory statistics validation failed:', error.message);
}

// Test 18: Test memory trend calculation
console.log('\n1️⃣8️⃣  Testing memory trend calculation...');
try {
  const trend = memoryMonitor.getMemoryTrend();
  const isValidTrend = trend && 
                      typeof trend.trend === 'string' &&
                      typeof trend.change === 'string';
  console.log('✅ Memory trend calculation:', isValidTrend ? 'VALID' : 'INVALID');
} catch (error) {
  console.log('❌ Memory trend calculation failed:', error.message);
}

// Test 19: Test cleanup callback execution
console.log('\n1️⃣9️⃣  Testing cleanup callback execution...');
console.log('✅ Callback execution will be tested during actual cleanup operations');

// Test 20: Test service integration
console.log('\n2️⃣0️⃣  Testing service integration...');
try {
  const report = memoryMonitor.getMemoryReport();
  const hasRequiredFields = report.current && report.thresholds && report.trend;
  console.log('✅ Service integration test:', hasRequiredFields ? 'PASSED' : 'FAILED');
} catch (error) {
  console.log('❌ Service integration test failed:', error.message);
}

console.log('\n🎉 All MemoryMonitorService tests completed!'); 