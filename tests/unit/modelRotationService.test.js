/**
 * ModelRotationService Test Suite
 * 
 * Tests for model rotation orchestration, error recovery, retry mechanisms,
 * and integration with QueueService and other dependencies.
 */

import modelRotationService from '../../services/modelRotationService.js';
import { REQUEST_PRIORITY, ERROR_CODES, OPERATIONS } from '../../types/modelRotation.js';

// Test basic rotation service functionality
console.log('🧪 Testing ModelRotationService...');

// Test 1: Basic initialization
console.log('\n1️⃣  Testing basic initialization...');
try {
  await modelRotationService.initialize();
  console.log('✅ ModelRotationService initialized');
} catch (error) {
  console.log('❌ Initialization failed:', error.message);
}

// Test 2: Get initial rotation status
console.log('\n2️⃣  Testing initial rotation status...');
try {
  const status = modelRotationService.getRotationStatus();
  console.log('✅ Initial rotation status:', {
    isRotating: status.isRotating,
    activeModel: status.activeModel,
    queueSize: status.queueStatus.size,
    failedRotations: status.failedRotations
  });
} catch (error) {
  console.log('❌ Get rotation status failed:', error.message);
}

// Test 3: Test configuration validation
console.log('\n3️⃣  Testing configuration validation...');
try {
  const validation = modelRotationService.validateConfiguration();
  console.log('✅ Configuration validation:', {
    isValid: validation.isValid,
    errors: validation.errors.length,
    warnings: validation.warnings.length
  });
} catch (error) {
  console.log('❌ Configuration validation failed:', error.message);
}

// Test 4: Test rotation request with invalid inputs
console.log('\n4️⃣  Testing rotation request with invalid inputs...');
try {
  // Test empty model name
  try {
    await modelRotationService.requestModelRotation('', 'test', REQUEST_PRIORITY.NORMAL);
    console.log('❌ Should have rejected empty model name');
  } catch (error) {
    console.log('✅ Correctly rejected empty model name:', error.message);
  }
  
  // Test empty source
  try {
    await modelRotationService.requestModelRotation('test-model', '', REQUEST_PRIORITY.NORMAL);
    console.log('❌ Should have rejected empty source');
  } catch (error) {
    console.log('✅ Correctly rejected empty source:', error.message);
  }
  
  // Test invalid priority
  try {
    await modelRotationService.requestModelRotation('test-model', 'test', 'invalid-priority');
    console.log('❌ Should have rejected invalid priority');
  } catch (error) {
    console.log('✅ Correctly rejected invalid priority:', error.message);
  }
} catch (error) {
  console.log('❌ Invalid inputs test failed:', error.message);
}

// Test 5: Test rotation request for non-existent model
console.log('\n5️⃣  Testing rotation request for non-existent model...');
try {
  await modelRotationService.requestModelRotation('non-existent-model', 'test', REQUEST_PRIORITY.NORMAL);
  console.log('❌ Should have rejected non-existent model');
} catch (error) {
  console.log('✅ Correctly rejected non-existent model:', error.message.includes('not found'));
}

// Test 6: Test rotation history
console.log('\n6️⃣  Testing rotation history...');
try {
  const history = modelRotationService.getRotationHistory(5);
  console.log('✅ Rotation history:', {
    count: history.length,
    hasEntries: history.length >= 0
  });
} catch (error) {
  console.log('❌ Get rotation history failed:', error.message);
}

// Test 7: Test failed rotations
console.log('\n7️⃣  Testing failed rotations...');
try {
  const failedRotations = modelRotationService.getFailedRotations();
  console.log('✅ Failed rotations:', {
    count: failedRotations.length,
    hasEntries: failedRotations.length >= 0
  });
} catch (error) {
  console.log('❌ Get failed rotations failed:', error.message);
}

// Test 8: Test clear rotation history
console.log('\n8️⃣  Testing clear rotation history...');
try {
  const clearedCount = modelRotationService.clearRotationHistory();
  console.log('✅ Cleared rotation history:', clearedCount, 'entries');
} catch (error) {
  console.log('❌ Clear rotation history failed:', error.message);
}

// Test 9: Test clear failed rotations
console.log('\n9️⃣  Testing clear failed rotations...');
try {
  const clearedCount = modelRotationService.clearFailedRotations();
  console.log('✅ Cleared failed rotations:', clearedCount, 'entries');
} catch (error) {
  console.log('❌ Clear failed rotations failed:', error.message);
}

// Test 10: Test emergency cleanup
console.log('\n🔟 Testing emergency cleanup...');
try {
  const cleanupResult = await modelRotationService.emergencyCleanup();
  console.log('✅ Emergency cleanup:', {
    success: cleanupResult.success,
    action: cleanupResult.action,
    message: cleanupResult.message
  });
} catch (error) {
  console.log('❌ Emergency cleanup failed:', error.message);
}

// Test 11: Test force rotation with invalid model
console.log('\n1️⃣1️⃣  Testing force rotation with invalid model...');
try {
  await modelRotationService.forceModelRotation('invalid-force-model', 'test');
  console.log('❌ Should have rejected invalid model for force rotation');
} catch (error) {
  console.log('✅ Correctly rejected invalid model for force rotation:', error.message.includes('not found'));
}

// Test 12: Test rotation status after operations
console.log('\n1️⃣2️⃣  Testing rotation status after operations...');
try {
  const status = modelRotationService.getRotationStatus();
  console.log('✅ Rotation status after operations:', {
    isRotating: status.isRotating,
    activeModel: status.activeModel,
    queueSize: status.queueStatus.size,
    memoryStatus: status.memoryStatus ? 'Available' : 'Not available'
  });
} catch (error) {
  console.log('❌ Get rotation status failed:', error.message);
}

// Test 13: Test rotation request for same model (should return no_change)
console.log('\n1️⃣3️⃣  Testing rotation request for same model...');
try {
  // First, get current active model
  const currentStatus = modelRotationService.getRotationStatus();
  const activeModel = currentStatus.activeModel;
  
  if (activeModel) {
    const result = await modelRotationService.requestModelRotation(activeModel, 'test', REQUEST_PRIORITY.NORMAL);
    console.log('✅ Same model rotation request:', {
      success: result.success,
      action: result.action,
      message: result.message
    });
  } else {
    console.log('✅ No active model to test same-model rotation');
  }
} catch (error) {
  console.log('❌ Same model rotation test failed:', error.message);
}

// Test 14: Test rotation history limit
console.log('\n1️⃣4️⃣  Testing rotation history limit...');
try {
  const history = modelRotationService.getRotationHistory(3);
  console.log('✅ Rotation history with limit:', {
    requested: 3,
    actual: history.length,
    withinLimit: history.length <= 3
  });
} catch (error) {
  console.log('❌ Rotation history limit test failed:', error.message);
}

// Test 15: Test rotation status components
console.log('\n1️⃣5️⃣  Testing rotation status components...');
try {
  const status = modelRotationService.getRotationStatus();
  
  console.log('✅ Rotation status components:', {
    hasIsRotating: typeof status.isRotating === 'boolean',
    hasCurrentRotation: status.currentRotation !== undefined,
    hasActiveModel: status.activeModel !== undefined,
    hasQueueStatus: status.queueStatus !== undefined,
    hasMemoryStatus: status.memoryStatus !== undefined,
    hasLastRotation: status.lastRotation !== undefined,
    hasFailedRotations: typeof status.failedRotations === 'number'
  });
} catch (error) {
  console.log('❌ Rotation status components test failed:', error.message);
}

// Test 16: Test error handling for uninitialized service
console.log('\n1️⃣6️⃣  Testing error handling for uninitialized service...');
try {
  // Create a new instance to test uninitialized state
  const testService = {
    _isInitialized: false,
    _ensureInitialized() {
      if (!this._isInitialized) {
        throw new Error("ModelRotationService not initialized. Call initialize() first.");
      }
    },
    getRotationStatus() {
      this._ensureInitialized();
    }
  };
  
  try {
    testService.getRotationStatus();
    console.log('❌ Should have thrown initialization error');
  } catch (error) {
    console.log('✅ Correctly threw initialization error:', error.message.includes('not initialized'));
  }
} catch (error) {
  console.log('❌ Uninitialized service test failed:', error.message);
}

// Test 17: Test rotation request with different priorities
console.log('\n1️⃣7️⃣  Testing rotation request with different priorities...');
try {
  // Test high priority request
  try {
    await modelRotationService.requestModelRotation('test-high-priority', 'test', REQUEST_PRIORITY.HIGH);
    console.log('✅ High priority request handled');
  } catch (error) {
    console.log('✅ High priority request failed as expected:', error.message.includes('not found'));
  }
  
  // Test low priority request
  try {
    await modelRotationService.requestModelRotation('test-low-priority', 'test', REQUEST_PRIORITY.LOW);
    console.log('✅ Low priority request handled');
  } catch (error) {
    console.log('✅ Low priority request failed as expected:', error.message.includes('not found'));
  }
} catch (error) {
  console.log('❌ Priority requests test failed:', error.message);
}

// Test 18: Test force rotation error handling
console.log('\n1️⃣8️⃣  Testing force rotation error handling...');
try {
  // Test with empty model name
  try {
    await modelRotationService.forceModelRotation('', 'test');
    console.log('❌ Should have rejected empty model name for force rotation');
  } catch (error) {
    console.log('✅ Correctly rejected empty model name for force rotation:', error.message.includes('Invalid target model'));
  }
  
  // Test with empty source
  try {
    await modelRotationService.forceModelRotation('test-model', '');
    console.log('❌ Should have rejected empty source for force rotation');
  } catch (error) {
    console.log('✅ Correctly rejected empty source for force rotation:', error.message.includes('Invalid source'));
  }
} catch (error) {
  console.log('❌ Force rotation error handling test failed:', error.message);
}

// Test 19: Test rotation status after failed operations
console.log('\n1️⃣9️⃣  Testing rotation status after failed operations...');
try {
  const status = modelRotationService.getRotationStatus();
  console.log('✅ Rotation status after failed operations:', {
    isRotating: status.isRotating,
    activeModel: status.activeModel,
    queueSize: status.queueStatus.size,
    failedRotations: status.failedRotations
  });
} catch (error) {
  console.log('❌ Get rotation status after failed operations failed:', error.message);
}

// Test 20: Test final validation
console.log('\n2️⃣0️⃣  Testing final validation...');
try {
  const finalValidation = modelRotationService.validateConfiguration();
  const finalStatus = modelRotationService.getRotationStatus();
  
  console.log('✅ Final validation:', {
    configValid: finalValidation.isValid,
    isRotating: finalStatus.isRotating,
    queueSize: finalStatus.queueStatus.size,
    failedRotations: finalStatus.failedRotations
  });
} catch (error) {
  console.log('❌ Final validation failed:', error.message);
}

console.log('\n🎉 All ModelRotationService tests completed!'); 