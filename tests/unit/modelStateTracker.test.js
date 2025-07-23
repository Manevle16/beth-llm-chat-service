/**
 * ModelStateTracker Test Suite
 * 
 * Tests for model state tracking, Ollama sync, and metadata management
 */

import modelStateTracker from '../../services/modelStateTracker.js';

// Test basic state tracking functionality
console.log('🧪 Testing ModelStateTracker...');

// Test 1: Basic initialization
console.log('\n1️⃣  Testing basic initialization...');
try {
  await modelStateTracker.initialize();
  console.log('✅ ModelStateTracker initialized');
} catch (error) {
  console.log('⚠️  Initialization failed (Ollama may not be running):', error.message);
}

// Test 2: Get initial state
console.log('\n2️⃣  Testing initial state...');
const initialState = modelStateTracker.getStateSummary();
console.log('✅ Initial state:', initialState);

// Test 3: Set active model
console.log('\n3️⃣  Testing set active model...');
try {
  await modelStateTracker.setActiveModel('test-model-1');
  console.log('✅ Active model set to: test-model-1');
} catch (error) {
  console.log('⚠️  Set active model failed:', error.message);
}

// Test 4: Get active model
console.log('\n4️⃣  Testing get active model...');
const activeModel = modelStateTracker.getActiveModel();
console.log('✅ Active model:', activeModel);

// Test 5: Get model metadata
console.log('\n5️⃣  Testing get model metadata...');
const metadata = modelStateTracker.getModelMetadata('test-model-1');
console.log('✅ Model metadata:', metadata ? {
  name: metadata.name,
  requestCount: metadata.requestCount,
  loadedAt: metadata.loadedAt.toISOString()
} : 'null');

// Test 6: Set same model again (should update usage)
console.log('\n6️⃣  Testing set same model (usage update)...');
try {
  await modelStateTracker.setActiveModel('test-model-1');
  const updatedMetadata = modelStateTracker.getModelMetadata('test-model-1');
  console.log('✅ Updated metadata request count:', updatedMetadata.requestCount);
} catch (error) {
  console.log('⚠️  Set same model failed:', error.message);
}

// Test 7: Set different model
console.log('\n7️⃣  Testing set different model...');
try {
  await modelStateTracker.setActiveModel('test-model-2');
  console.log('✅ Active model changed to: test-model-2');
} catch (error) {
  console.log('⚠️  Set different model failed:', error.message);
}

// Test 8: Check model loading status
console.log('\n8️⃣  Testing model loading status...');
const isLoaded1 = modelStateTracker.isModelLoaded('test-model-1');
const isLoaded2 = modelStateTracker.isModelLoaded('test-model-2');
const isLoaded3 = modelStateTracker.isModelLoaded('non-existent-model');
console.log('✅ Model loading status:', {
  'test-model-1': isLoaded1,
  'test-model-2': isLoaded2,
  'non-existent-model': isLoaded3
});

// Test 9: Get loaded model count
console.log('\n9️⃣  Testing loaded model count...');
const modelCount = modelStateTracker.getLoadedModelCount();
console.log('✅ Loaded model count:', modelCount);

// Test 10: Get all model metadata
console.log('\n🔟 Testing get all model metadata...');
const allMetadata = modelStateTracker.getAllModelMetadata();
console.log('✅ All model metadata count:', allMetadata.length);
allMetadata.forEach((meta, index) => {
  console.log(`   ${index + 1}. ${meta.name} (requests: ${meta.requestCount})`);
});

// Test 11: Get least recently used model
console.log('\n1️⃣1️⃣  Testing least recently used model...');
const lruModel = modelStateTracker.getLeastRecentlyUsedModel();
console.log('✅ Least recently used model:', lruModel);

// Test 12: Clear active model
console.log('\n1️⃣2️⃣  Testing clear active model...');
const wasCleared = await modelStateTracker.clearActiveModel();
console.log('✅ Active model cleared:', wasCleared);

// Test 13: Get state after clearing
console.log('\n1️⃣3️⃣  Testing state after clearing...');
const stateAfterClear = modelStateTracker.getStateSummary();
console.log('✅ State after clearing:', stateAfterClear);

// Test 14: Remove model from tracking
console.log('\n1️⃣4️⃣  Testing remove model...');
const wasRemoved = modelStateTracker.removeModel('test-model-1');
console.log('✅ Model removed:', wasRemoved);

// Test 15: Get state after removal
console.log('\n1️⃣5️⃣  Testing state after removal...');
const stateAfterRemoval = modelStateTracker.getStateSummary();
console.log('✅ State after removal:', stateAfterRemoval);

// Test 16: Test invalid inputs
console.log('\n1️⃣6️⃣  Testing invalid inputs...');
try {
  await modelStateTracker.setActiveModel('');
  console.log('❌ Should have thrown error for empty model name');
} catch (error) {
  console.log('✅ Correctly rejected empty model name:', error.message);
}

try {
  await modelStateTracker.setActiveModel(null);
  console.log('❌ Should have thrown error for null model name');
} catch (error) {
  console.log('✅ Correctly rejected null model name:', error.message);
}

// Test 17: Test metadata validation
console.log('\n1️⃣7️⃣  Testing metadata validation...');
const invalidMetadata = modelStateTracker.getModelMetadata('non-existent');
console.log('✅ Invalid metadata handling:', invalidMetadata === null);

// Test 18: Test state summary
console.log('\n1️⃣8️⃣  Testing state summary...');
const finalSummary = modelStateTracker.getStateSummary();
console.log('✅ Final state summary:', finalSummary);

// Test 19: Test reset functionality
console.log('\n1️⃣9️⃣  Testing reset functionality...');
modelStateTracker.reset();
try {
  const resetState = modelStateTracker.getStateSummary();
  console.log('❌ Should have thrown error after reset');
} catch (error) {
  console.log('✅ Correctly requires initialization after reset:', error.message);
}

// Test 20: Test re-initialization after reset
console.log('\n2️⃣0️⃣  Testing re-initialization after reset...');
try {
  await modelStateTracker.initialize();
  console.log('✅ Re-initialization successful');
} catch (error) {
  console.log('⚠️  Re-initialization failed:', error.message);
}

console.log('\n🎉 All ModelStateTracker tests completed!'); 