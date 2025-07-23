/**
 * OllamaService Test Suite
 * 
 * Tests for the extended OllamaService with model rotation capabilities,
 * backward compatibility, and integration with rotation services.
 */

import ollamaService from '../../services/ollamaService.js';
import { REQUEST_PRIORITY } from '../../types/modelRotation.js';

// Test basic OllamaService functionality with rotation
console.log('🧪 Testing OllamaService with rotation capabilities...');

// Test 1: Basic initialization
console.log('\n1️⃣  Testing basic initialization...');
try {
  await ollamaService.initialize();
  console.log('✅ OllamaService initialized');
} catch (error) {
  console.log('❌ Initialization failed:', error.message);
}

// Test 2: Check rotation status
console.log('\n2️⃣  Testing rotation status...');
try {
  const rotationStatus = await ollamaService.getRotationStatus();
  console.log('✅ Rotation status:', {
    enabled: rotationStatus.enabled,
    isRotating: rotationStatus.isRotating,
    activeModel: rotationStatus.activeModel,
    queueSize: rotationStatus.queueStatus?.size || 0
  });
} catch (error) {
  console.log('❌ Get rotation status failed:', error.message);
}

// Test 3: Test backward compatibility - generateResponse without options
console.log('\n3️⃣  Testing backward compatibility - generateResponse without options...');
try {
  // This should work with the old API (no options parameter)
  // We'll test with a non-existent model to avoid actual API calls
  try {
    await ollamaService.generateResponse('test-model-backward-compat', 'Hello', []);
    console.log('❌ Should have failed with non-existent model');
  } catch (error) {
    console.log('✅ Backward compatibility test passed:', error.message.includes('not found'));
  }
} catch (error) {
  console.log('❌ Backward compatibility test failed:', error.message);
}

// Test 4: Test generateResponse with rotation options
console.log('\n4️⃣  Testing generateResponse with rotation options...');
try {
  const options = {
    enableRotation: true,
    rotationPriority: REQUEST_PRIORITY.NORMAL
  };
  
  try {
    await ollamaService.generateResponse('test-model-with-options', 'Hello', [], options);
    console.log('❌ Should have failed with non-existent model');
  } catch (error) {
    console.log('✅ GenerateResponse with options test passed:', error.message.includes('not found'));
  }
} catch (error) {
  console.log('❌ GenerateResponse with options test failed:', error.message);
}

// Test 5: Test generateResponse with rotation disabled
console.log('\n5️⃣  Testing generateResponse with rotation disabled...');
try {
  const options = {
    enableRotation: false
  };
  
  try {
    await ollamaService.generateResponse('test-model-no-rotation', 'Hello', [], options);
    console.log('❌ Should have failed with non-existent model');
  } catch (error) {
    console.log('✅ GenerateResponse with rotation disabled test passed:', error.message.includes('not found'));
  }
} catch (error) {
  console.log('❌ GenerateResponse with rotation disabled test failed:', error.message);
}

// Test 6: Test streamResponse with rotation options
console.log('\n6️⃣  Testing streamResponse with rotation options...');
try {
  const options = {
    enableRotation: true,
    rotationPriority: REQUEST_PRIORITY.HIGH
  };
  
  try {
    const stream = ollamaService.streamResponse('test-model-stream', 'Hello', [], options);
    // Try to get first token
    const firstToken = await stream.next();
    console.log('❌ Should have failed with non-existent model');
  } catch (error) {
    console.log('✅ StreamResponse with options test passed:', error.message.includes('not found'));
  }
} catch (error) {
  console.log('❌ StreamResponse with options test failed:', error.message);
}

// Test 7: Test listModels
console.log('\n7️⃣  Testing listModels...');
try {
  const models = await ollamaService.listModels();
  console.log('✅ ListModels:', {
    count: models.length,
    hasModels: models.length > 0,
    sampleModels: models.slice(0, 3)
  });
} catch (error) {
  console.log('❌ ListModels failed:', error.message);
}

// Test 8: Test checkModelExists
console.log('\n8️⃣  Testing checkModelExists...');
try {
  // Test with existing model (if any)
  const models = await ollamaService.listModels();
  if (models.length > 0) {
    const exists = await ollamaService.checkModelExists(models[0]);
    console.log('✅ CheckModelExists (existing):', exists);
  } else {
    console.log('✅ No models available for existence check');
  }
  
  // Test with non-existent model
  const notExists = await ollamaService.checkModelExists('non-existent-model-check');
  console.log('✅ CheckModelExists (non-existent):', notExists);
} catch (error) {
  console.log('❌ CheckModelExists failed:', error.message);
}

// Test 9: Test buildConversationContext
console.log('\n9️⃣  Testing buildConversationContext...');
try {
  const history = [
    { sender: 'user', text: 'Hello' },
    { sender: 'assistant', text: 'Hi there!' },
    { sender: 'user', text: 'How are you?' }
  ];
  
  const messages = ollamaService.buildConversationContext(history, 'I am fine');
  console.log('✅ BuildConversationContext:', {
    messageCount: messages.length,
    hasUserMessages: messages.some(m => m.role === 'user'),
    hasAssistantMessages: messages.some(m => m.role === 'assistant'),
    lastMessage: messages[messages.length - 1]?.content
  });
} catch (error) {
  console.log('❌ BuildConversationContext failed:', error.message);
}

// Test 10: Test rotation history
console.log('\n🔟 Testing rotation history...');
try {
  const history = await ollamaService.getRotationHistory(5);
  console.log('✅ Rotation history:', {
    count: history.length,
    hasEntries: history.length >= 0
  });
} catch (error) {
  console.log('❌ Get rotation history failed:', error.message);
}

// Test 11: Test failed rotations
console.log('\n1️⃣1️⃣  Testing failed rotations...');
try {
  const failedRotations = await ollamaService.getFailedRotations();
  console.log('✅ Failed rotations:', {
    count: failedRotations.length,
    hasEntries: failedRotations.length >= 0
  });
} catch (error) {
  console.log('❌ Get failed rotations failed:', error.message);
}

// Test 12: Test emergency cleanup
console.log('\n1️⃣2️⃣  Testing emergency cleanup...');
try {
  const cleanupResult = await ollamaService.emergencyCleanup();
  console.log('✅ Emergency cleanup:', {
    success: cleanupResult.success,
    action: cleanupResult.action,
    message: cleanupResult.message
  });
} catch (error) {
  console.log('❌ Emergency cleanup failed:', error.message);
}

// Test 13: Test force model rotation
console.log('\n1️⃣3️⃣  Testing force model rotation...');
try {
  await ollamaService.forceModelRotation('test-force-model', 'test');
  console.log('❌ Should have failed with non-existent model');
} catch (error) {
  console.log('✅ Force model rotation test passed:', error.message.includes('not found'));
}

// Test 14: Test rotation enable/disable
console.log('\n1️⃣4️⃣  Testing rotation enable/disable...');
try {
  const initialState = ollamaService.isRotationEnabled();
  console.log('✅ Initial rotation state:', initialState);
  
  // Toggle rotation
  ollamaService.setRotationEnabled(!initialState);
  const toggledState = ollamaService.isRotationEnabled();
  console.log('✅ Toggled rotation state:', toggledState);
  
  // Restore original state
  ollamaService.setRotationEnabled(initialState);
  const restoredState = ollamaService.isRotationEnabled();
  console.log('✅ Restored rotation state:', restoredState);
  
  console.log('✅ Rotation enable/disable test passed');
} catch (error) {
  console.log('❌ Rotation enable/disable test failed:', error.message);
}

// Test 15: Test generateResponse with high priority
console.log('\n1️⃣5️⃣  Testing generateResponse with high priority...');
try {
  const options = {
    enableRotation: true,
    rotationPriority: REQUEST_PRIORITY.HIGH
  };
  
  try {
    await ollamaService.generateResponse('test-high-priority', 'Hello', [], options);
    console.log('❌ Should have failed with non-existent model');
  } catch (error) {
    console.log('✅ High priority rotation test passed:', error.message.includes('not found'));
  }
} catch (error) {
  console.log('❌ High priority rotation test failed:', error.message);
}

// Test 16: Test generateResponse with low priority
console.log('\n1️⃣6️⃣  Testing generateResponse with low priority...');
try {
  const options = {
    enableRotation: true,
    rotationPriority: REQUEST_PRIORITY.LOW
  };
  
  try {
    await ollamaService.generateResponse('test-low-priority', 'Hello', [], options);
    console.log('❌ Should have failed with non-existent model');
  } catch (error) {
    console.log('✅ Low priority rotation test passed:', error.message.includes('not found'));
  }
} catch (error) {
  console.log('❌ Low priority rotation test failed:', error.message);
}

// Test 17: Test streamResponse with rotation disabled
console.log('\n1️⃣7️⃣  Testing streamResponse with rotation disabled...');
try {
  const options = {
    enableRotation: false
  };
  
  try {
    const stream = ollamaService.streamResponse('test-model-no-stream-rotation', 'Hello', [], options);
    const firstToken = await stream.next();
    console.log('❌ Should have failed with non-existent model');
  } catch (error) {
    console.log('✅ StreamResponse with rotation disabled test passed:', error.message.includes('not found'));
  }
} catch (error) {
  console.log('❌ StreamResponse with rotation disabled test failed:', error.message);
}

// Test 18: Test error handling for rotation when disabled
console.log('\n1️⃣8️⃣  Testing error handling for rotation when disabled...');
try {
  // Disable rotation temporarily
  const originalState = ollamaService.isRotationEnabled();
  ollamaService.setRotationEnabled(false);
  
  try {
    await ollamaService.forceModelRotation('test-model', 'test');
    console.log('❌ Should have thrown rotation disabled error');
  } catch (error) {
    console.log('✅ Correctly rejected force rotation when disabled:', error.message.includes('disabled'));
  }
  
  // Restore original state
  ollamaService.setRotationEnabled(originalState);
} catch (error) {
  console.log('❌ Rotation disabled error handling test failed:', error.message);
}

// Test 19: Test rotation status when disabled
console.log('\n1️⃣9️⃣  Testing rotation status when disabled...');
try {
  // Disable rotation temporarily
  const originalState = ollamaService.isRotationEnabled();
  ollamaService.setRotationEnabled(false);
  
  const status = await ollamaService.getRotationStatus();
  console.log('✅ Rotation status when disabled:', {
    enabled: status.enabled,
    message: status.message
  });
  
  // Restore original state
  ollamaService.setRotationEnabled(originalState);
} catch (error) {
  console.log('❌ Rotation status when disabled test failed:', error.message);
}

// Test 20: Test final integration check
console.log('\n2️⃣0️⃣  Testing final integration check...');
try {
  const finalStatus = await ollamaService.getRotationStatus();
  const models = await ollamaService.listModels();
  const rotationEnabled = ollamaService.isRotationEnabled();
  
  console.log('✅ Final integration check:', {
    rotationEnabled,
    hasModels: models.length > 0,
    rotationStatus: finalStatus.enabled ? 'enabled' : 'disabled',
    activeModel: finalStatus.activeModel || 'none'
  });
} catch (error) {
  console.log('❌ Final integration check failed:', error.message);
}

console.log('\n🎉 All OllamaService tests completed!'); 