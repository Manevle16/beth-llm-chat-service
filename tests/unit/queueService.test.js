/**
 * QueueService Test Suite
 * 
 * Tests for queue management, priority processing, deduplication, and status monitoring
 */

import queueService from '../../services/queueService.js';
import { REQUEST_PRIORITY } from '../../types/modelRotation.js';

// Test basic queue functionality
console.log('🧪 Testing QueueService...');

// Test 1: Basic initialization
console.log('\n1️⃣  Testing basic initialization...');
try {
  await queueService.initialize();
  console.log('✅ QueueService initialized');
} catch (error) {
  console.log('❌ Initialization failed:', error.message);
}

// Test 2: Get initial queue status
console.log('\n2️⃣  Testing initial queue status...');
try {
  const initialStatus = queueService.getQueueStatus();
  console.log('✅ Initial queue status:', {
    size: initialStatus.size,
    maxSize: initialStatus.maxSize,
    isProcessing: initialStatus.isProcessing,
    utilization: initialStatus.utilization.toFixed(1) + '%'
  });
} catch (error) {
  console.log('❌ Get queue status failed:', error.message);
}

// Test 3: Enqueue normal priority request
console.log('\n3️⃣  Testing enqueue normal priority request...');
try {
  const enqueued = await queueService.enqueueRotationRequest('test-model-1', 'graphql', REQUEST_PRIORITY.NORMAL);
  console.log('✅ Normal priority request enqueued:', enqueued);
} catch (error) {
  console.log('❌ Enqueue normal priority failed:', error.message);
}

// Test 4: Enqueue high priority request
console.log('\n4️⃣  Testing enqueue high priority request...');
try {
  const enqueued = await queueService.enqueueRotationRequest('test-model-2', 'stream', REQUEST_PRIORITY.HIGH);
  console.log('✅ High priority request enqueued:', enqueued);
} catch (error) {
  console.log('❌ Enqueue high priority failed:', error.message);
}

// Test 5: Enqueue low priority request
console.log('\n5️⃣  Testing enqueue low priority request...');
try {
  const enqueued = await queueService.enqueueRotationRequest('test-model-3', 'api', REQUEST_PRIORITY.LOW);
  console.log('✅ Low priority request enqueued:', enqueued);
} catch (error) {
  console.log('❌ Enqueue low priority failed:', error.message);
}

// Test 6: Check queue status after enqueuing
console.log('\n6️⃣  Testing queue status after enqueuing...');
try {
  const status = queueService.getQueueStatus();
  console.log('✅ Queue status after enqueuing:', {
    size: status.size,
    maxSize: status.maxSize,
    isProcessing: status.isProcessing,
    priorityBreakdown: status.priorityBreakdown
  });
} catch (error) {
  console.log('❌ Get queue status failed:', error.message);
}

// Test 7: Test request deduplication
console.log('\n7️⃣  Testing request deduplication...');
try {
  // Try to enqueue the same model from the same source
  const duplicateEnqueued = await queueService.enqueueRotationRequest('test-model-1', 'graphql', REQUEST_PRIORITY.HIGH);
  console.log('✅ Duplicate request handled:', duplicateEnqueued);
  
  const status = queueService.getQueueStatus();
  console.log('✅ Queue size after duplicate (should be same):', status.size);
} catch (error) {
  console.log('❌ Duplicate request test failed:', error.message);
}

// Test 8: Get queue contents
console.log('\n8️⃣  Testing get queue contents...');
try {
  const contents = queueService.getQueueContents();
  console.log('✅ Queue contents:', contents.map(req => ({
    id: req.id,
    targetModel: req.targetModel,
    priority: req.priority,
    source: req.source
  })));
} catch (error) {
  console.log('❌ Get queue contents failed:', error.message);
}

// Test 9: Peek next request
console.log('\n9️⃣  Testing peek next request...');
try {
  const nextRequest = queueService.peekNextRequest();
  console.log('✅ Next request:', nextRequest ? {
    targetModel: nextRequest.targetModel,
    priority: nextRequest.priority,
    source: nextRequest.source
  } : 'null');
} catch (error) {
  console.log('❌ Peek next request failed:', error.message);
}

// Test 10: Process queue
console.log('\n🔟 Testing process queue...');
try {
  const processedCount = await queueService.processQueue();
  console.log('✅ Queue processing completed:', processedCount, 'requests processed');
} catch (error) {
  console.log('❌ Process queue failed:', error.message);
}

// Test 11: Check queue status after processing
console.log('\n1️⃣1️⃣  Testing queue status after processing...');
try {
  const status = queueService.getQueueStatus();
  console.log('✅ Queue status after processing:', {
    size: status.size,
    isProcessing: status.isProcessing,
    lastProcessed: status.lastProcessed ? 'Yes' : 'No'
  });
} catch (error) {
  console.log('❌ Get queue status failed:', error.message);
}

// Test 12: Test queue full scenario
console.log('\n1️⃣2️⃣  Testing queue full scenario...');
try {
  // Fill the queue
  const maxSize = queueService.getQueueStatus().maxSize;
  let enqueuedCount = 0;
  
  for (let i = 0; i < maxSize + 2; i++) {
    const enqueued = await queueService.enqueueRotationRequest(`fill-model-${i}`, 'test', REQUEST_PRIORITY.NORMAL);
    if (enqueued) enqueuedCount++;
  }
  
  console.log('✅ Queue fill test:', `${enqueuedCount}/${maxSize + 2} requests enqueued`);
} catch (error) {
  console.log('❌ Queue fill test failed:', error.message);
}

// Test 13: Test remove specific request
console.log('\n1️⃣3️⃣  Testing remove specific request...');
try {
  const contents = queueService.getQueueContents();
  if (contents.length > 0) {
    const requestToRemove = contents[0];
    const removed = queueService.removeRequest(requestToRemove.id);
    console.log('✅ Remove specific request:', removed ? 'SUCCESS' : 'FAILED');
  } else {
    console.log('✅ No requests to remove');
  }
} catch (error) {
  console.log('❌ Remove specific request failed:', error.message);
}

// Test 14: Test clear queue
console.log('\n1️⃣4️⃣  Testing clear queue...');
try {
  const clearedCount = await queueService.clearQueue();
  console.log('✅ Queue cleared:', clearedCount, 'requests removed');
} catch (error) {
  console.log('❌ Clear queue failed:', error.message);
}

// Test 15: Test auto-processing
console.log('\n1️⃣5️⃣  Testing auto-processing...');
try {
  // Add some test requests
  await queueService.enqueueRotationRequest('auto-test-1', 'test', REQUEST_PRIORITY.NORMAL);
  await queueService.enqueueRotationRequest('auto-test-2', 'test', REQUEST_PRIORITY.HIGH);
  
  // Start auto-processing
  const started = queueService.startAutoProcessing();
  console.log('✅ Auto-processing started:', started);
  
  // Wait a bit for processing
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Stop auto-processing
  const stopped = queueService.stopAutoProcessing();
  console.log('✅ Auto-processing stopped:', stopped);
  
  const status = queueService.getQueueStatus();
  console.log('✅ Queue status after auto-processing:', {
    size: status.size,
    isProcessing: status.isProcessing
  });
} catch (error) {
  console.log('❌ Auto-processing test failed:', error.message);
}

// Test 16: Test queue statistics
console.log('\n1️⃣6️⃣  Testing queue statistics...');
try {
  const stats = queueService.getQueueStats();
  console.log('✅ Queue statistics:', {
    totalRequests: stats.totalRequests,
    currentQueueSize: stats.currentQueueSize,
    maxQueueSize: stats.maxQueueSize,
    utilization: stats.utilization,
    isProcessing: stats.isProcessing,
    isAutoProcessing: stats.isAutoProcessing
  });
} catch (error) {
  console.log('❌ Queue statistics failed:', error.message);
}

// Test 17: Test priority ordering
console.log('\n1️⃣7️⃣  Testing priority ordering...');
try {
  // Clear queue and add requests in different order
  await queueService.clearQueue();
  
  await queueService.enqueueRotationRequest('low-priority', 'test', REQUEST_PRIORITY.LOW);
  await queueService.enqueueRotationRequest('high-priority', 'test', REQUEST_PRIORITY.HIGH);
  await queueService.enqueueRotationRequest('normal-priority', 'test', REQUEST_PRIORITY.NORMAL);
  
  const contents = queueService.getQueueContents();
  console.log('✅ Priority ordering:', contents.map(req => req.priority));
  
  // Verify high priority is first
  const isHighPriorityFirst = contents[0] && contents[0].priority === REQUEST_PRIORITY.HIGH;
  console.log('✅ High priority first:', isHighPriorityFirst);
} catch (error) {
  console.log('❌ Priority ordering test failed:', error.message);
}

// Test 18: Test invalid inputs
console.log('\n1️⃣8️⃣  Testing invalid inputs...');
try {
  // Test invalid model name
  try {
    await queueService.enqueueRotationRequest('', 'test', REQUEST_PRIORITY.NORMAL);
    console.log('❌ Should have rejected empty model name');
  } catch (error) {
    console.log('✅ Correctly rejected empty model name:', error.message);
  }
  
  // Test invalid source
  try {
    await queueService.enqueueRotationRequest('test-model', '', REQUEST_PRIORITY.NORMAL);
    console.log('❌ Should have rejected empty source');
  } catch (error) {
    console.log('✅ Correctly rejected empty source:', error.message);
  }
  
  // Test invalid priority
  try {
    await queueService.enqueueRotationRequest('test-model', 'test', 'invalid-priority');
    console.log('❌ Should have rejected invalid priority');
  } catch (error) {
    console.log('✅ Correctly rejected invalid priority:', error.message);
  }
} catch (error) {
  console.log('❌ Invalid inputs test failed:', error.message);
}

// Test 19: Test concurrent processing prevention
console.log('\n1️⃣9️⃣  Testing concurrent processing prevention...');
try {
  await queueService.enqueueRotationRequest('concurrent-test', 'test', REQUEST_PRIORITY.NORMAL);
  
  // Start processing
  const process1 = queueService.processQueue();
  const process2 = queueService.processQueue();
  
  const [result1, result2] = await Promise.all([process1, process2]);
  console.log('✅ Concurrent processing results:', { result1, result2 });
} catch (error) {
  console.log('❌ Concurrent processing test failed:', error.message);
}

// Test 20: Test final queue state
console.log('\n2️⃣0️⃣  Testing final queue state...');
try {
  const finalStatus = queueService.getQueueStatus();
  const finalStats = queueService.getQueueStats();
  
  console.log('✅ Final queue status:', {
    size: finalStatus.size,
    isProcessing: finalStatus.isProcessing,
    isAutoProcessing: finalStats.isAutoProcessing
  });
} catch (error) {
  console.log('❌ Final queue state test failed:', error.message);
}

console.log('\n🎉 All QueueService tests completed!'); 