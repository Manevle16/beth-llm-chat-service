/**
 * Image Upload Integration Tests
 *
 * These tests verify the image upload API endpoints including:
 * - Health check
 * - Image retrieval (404)
 * - Image metrics and errors endpoints
 * - (If possible) image upload and deletion via endpoints
 */

import express from 'express';
import request from 'supertest';
import path from 'path';
import { fileURLToPath } from 'url';
import imageRoutes from '../../routes/images.js';
import pool from '../../config/database.js';
import imageCleanupService from '../../services/imageCleanupService.js';
import imageStorageService from '../../services/imageStorageService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create test app
const app = express();
app.use(express.json());

// Add health endpoint for testing
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Mount image routes
app.use('/api/images', imageRoutes);

describe('Image Upload Integration Tests (API only)', () => {
  let testImageId;
  let testConversationId;

  beforeAll(async () => {
    // Create a test conversation ID
    testConversationId = `test-conv-${Date.now()}`;
  });

  describe('Basic Endpoint Tests', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return 404 for non-existent image', async () => {
      const response = await request(app)
        .get('/api/images/non-existent-image-id')
        .expect(404);
      expect(response.body).toHaveProperty('error', 'Image not found');
    });

    it('should return image metrics', async () => {
      const response = await request(app)
        .get('/api/images/metrics')
        .expect(200);
      expect(response.body).toHaveProperty('imageUpload');
      expect(response.body).toHaveProperty('errorHandling');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return recent errors', async () => {
      const response = await request(app)
        .get('/api/images/errors?limit=5')
        .expect(200);
      expect(response.body).toHaveProperty('errors');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.errors)).toBe(true);
    });
  });

  // The following tests require a real file upload endpoint and file system/database setup.
  // If the /api/images POST endpoint exists and is public, you can uncomment and adapt this block:
  /*
  describe('Image Upload and Deletion (if supported by API)', () => {
    it('should upload an image', async () => {
      const testImagePath = path.join(__dirname, '../images/apple-fruit-isolated-on-white-background-photo.jpg');
      const response = await request(app)
        .post('/api/images')
        .field('conversationId', testConversationId)
        .attach('images', testImagePath)
        .expect(201);
      expect(response.body).toHaveProperty('id');
      testImageId = response.body.id;
    });

    it('should delete the uploaded image', async () => {
      if (!testImageId) return;
      await request(app)
        .delete(`/api/images/${testImageId}?conversationId=${testConversationId}`)
        .expect(200);
    });
  });
  */

  // All other tests that require direct access to service/database internals are omitted.

  afterAll(async () => {
    // Shutdown services that may have open handles
    await imageCleanupService.shutdown();
    await imageStorageService.shutdown();
    // Close database pool
    await pool.end();
  });
}); 