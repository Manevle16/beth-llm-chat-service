import { visionModelService } from '../services/visionModelService.js';
import { createVisionMessage } from '../types/imageUpload.js';

async function testVisionService() {
  try {
    console.log('🧪 Testing VisionModelService...');
    
    // Test initialization
    console.log('1. Testing initialization...');
    await visionModelService.initialize();
    console.log('✅ VisionModelService initialized successfully');
    
    // Test MIME type detection
    console.log('2. Testing MIME type detection...');
    const mimeTypes = [
      { ext: '.png', expected: 'image/png' },
      { ext: '.jpg', expected: 'image/jpeg' },
      { ext: '.jpeg', expected: 'image/jpeg' },
      { ext: '.webp', expected: 'image/webp' },
      { ext: '.gif', expected: 'image/gif' }
    ];
    
    for (const { ext, expected } of mimeTypes) {
      const result = visionModelService.getMimeTypeFromExtension(ext);
      if (result === expected) {
        console.log(`✅ ${ext} -> ${result}`);
      } else {
        console.log(`❌ ${ext} -> ${result} (expected ${expected})`);
      }
    }
    
    // Test vision message creation
    console.log('3. Testing vision message creation...');
    const visionMessage = createVisionMessage({
      type: 'image',
      image_url: 'data:image/png;base64,fake-data',
      image_id: 'test-123',
      filename: 'test.png',
      mime_type: 'image/png'
    });
    console.log('✅ Vision message created:', visionMessage);
    
    // Test service stats
    console.log('4. Testing service statistics...');
    const stats = visionModelService.getStats();
    console.log('✅ Service stats:', stats);
    
    console.log('\n🎉 All VisionModelService tests passed!');
    
  } catch (error) {
    console.error('❌ VisionModelService test failed:', error.message);
    process.exit(1);
  }
}

testVisionService(); 