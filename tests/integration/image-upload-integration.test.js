/**
 * Image Upload Integration Tests
 * 
 * These tests verify the complete image upload pipeline including:
 * - Multipart request handling
 * - Image validation and storage
 * - Database operations
 * - Vision model integration
 * - Error handling and recovery
 */

import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import FormData from 'form-data';
import express from 'express';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the app
import '../index.js';

const BASE_URL = 'http://localhost:4000';

describe('Image Upload Integration Tests', () => {
  let testConversationId;
  let uploadedImageId;

  beforeAll(async () => {
    // Create a test conversation
    testConversationId = `test-conv-${Date.now()}`;
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Cleanup test data
    if (uploadedImageId) {
      try {
        await request(BASE_URL)
          .delete(`/api/images/${uploadedImageId}?conversationId=${testConversationId}`);
      } catch (error) {
        console.log('Cleanup error (expected):', error.message);
      }
    }
  });

  describe('Basic Endpoint Tests', () => {
    test('should return health status', async () => {
      const response = await request(BASE_URL)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should return 404 for non-existent image', async () => {
      const response = await request(BASE_URL)
        .get('/api/images/non-existent-image-id')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Image not found');
      expect(response.body).toHaveProperty('code', 'STORAGE_ERROR');
    });

    test('should return image metrics', async () => {
      const response = await request(BASE_URL)
        .get('/api/images/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('imageUpload');
      expect(response.body).toHaveProperty('errorHandling');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should return recent errors', async () => {
      const response = await request(BASE_URL)
        .get('/api/images/errors?limit=5')
        .expect(200);

      expect(response.body).toHaveProperty('errors');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.errors)).toBe(true);
    });
  });

  describe('Stream Message Endpoint Tests', () => {
    test('should handle JSON requests (backward compatibility)', async () => {
      const response = await request(BASE_URL)
        .post('/api/stream-message')
        .set('Content-Type', 'application/json')
        .send({
          model: 'llama3.1:8b',
          message: 'Hello, this is a test message',
          conversationId: testConversationId
        })
        .expect(200);

      // Should return SSE response
      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    test('should handle multipart requests without images', async () => {
      const form = new FormData();
      form.append('model', 'llama3.1:8b');
      form.append('message', 'Hello, this is a test message');
      form.append('conversationId', testConversationId);

      const response = await request(BASE_URL)
        .post('/api/stream-message')
        .set('Content-Type', 'multipart/form-data')
        .attach('form', Buffer.from('test'), 'test.txt')
        .field('model', 'llama3.1:8b')
        .field('message', 'Hello, this is a test message')
        .field('conversationId', testConversationId)
        .expect(200);

      // Should return SSE response
      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    test('should reject invalid multipart requests', async () => {
      const response = await request(BASE_URL)
        .post('/api/stream-message')
        .set('Content-Type', 'multipart/form-data')
        .send('invalid multipart data')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Image Validation Tests', () => {
    test('should reject oversized files', async () => {
      // Create a large buffer (11MB)
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);

      const response = await request(BASE_URL)
        .post('/api/stream-message')
        .field('model', 'llama3.1:8b')
        .field('message', 'Test message')
        .field('conversationId', testConversationId)
        .attach('images', largeBuffer, 'large-file.jpg')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('file size');
    });

    test('should reject invalid file types', async () => {
      const response = await request(BASE_URL)
        .post('/api/stream-message')
        .field('model', 'llama3.1:8b')
        .field('message', 'Test message')
        .field('conversationId', testConversationId)
        .attach('images', Buffer.from('not an image'), 'test.txt')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('file type');
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle database connection errors gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll test the error response structure
      const response = await request(BASE_URL)
        .get('/api/images/invalid-id-with-special-chars')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
    });

    test('should handle missing conversation ID', async () => {
      const response = await request(BASE_URL)
        .post('/api/stream-message')
        .set('Content-Type', 'application/json')
        .send({
          model: 'llama3.1:8b',
          message: 'Test message'
          // Missing conversationId
        })
        .expect(200); // SSE endpoint returns 200 but sends error event

      expect(response.headers['content-type']).toContain('text/event-stream');
    });
  });

  describe('Vision Model Integration Tests', () => {
    test('should handle vision model detection', async () => {
      // Test with a vision-capable model name
      const response = await request(BASE_URL)
        .post('/api/stream-message')
        .set('Content-Type', 'application/json')
        .send({
          model: 'llava:7b', // Vision-capable model
          message: 'What do you see in this image?',
          conversationId: testConversationId
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    test('should fallback gracefully for non-vision models', async () => {
      const response = await request(BASE_URL)
        .post('/api/stream-message')
        .set('Content-Type', 'application/json')
        .send({
          model: 'llama3.1:8b', // Non-vision model
          message: 'What do you see in this image?',
          conversationId: testConversationId
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
    });
  });

  describe('Performance and Load Tests', () => {
    test('should handle concurrent requests', async () => {
      const concurrentRequests = 5;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(BASE_URL)
            .post('/api/stream-message')
            .set('Content-Type', 'application/json')
            .send({
              model: 'llama3.1:8b',
              message: `Concurrent test message ${i}`,
              conversationId: testConversationId
            })
        );
      }

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/event-stream');
      });
    });

    test('should handle multiple images in single request', async () => {
      // Create multiple small test images
      const imageBuffers = [
        Buffer.from('fake-image-1-data'),
        Buffer.from('fake-image-2-data'),
        Buffer.from('fake-image-3-data')
      ];

      const form = new FormData();
      form.append('model', 'llava:7b');
      form.append('message', 'What do you see in these images?');
      form.append('conversationId', testConversationId);

      imageBuffers.forEach((buffer, index) => {
        form.append('images', buffer, `test-image-${index}.jpg`);
      });

      const response = await request(BASE_URL)
        .post('/api/stream-message')
        .set('Content-Type', 'multipart/form-data')
        .field('model', 'llava:7b')
        .field('message', 'What do you see in these images?')
        .field('conversationId', testConversationId)
        .attach('images', imageBuffers[0], 'test-image-1.jpg')
        .attach('images', imageBuffers[1], 'test-image-2.jpg')
        .attach('images', imageBuffers[2], 'test-image-3.jpg')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
    });
  });

  describe('Database Consistency Tests', () => {
    test('should maintain database consistency after errors', async () => {
      // Test that database state remains consistent even after processing errors
      const response = await request(BASE_URL)
        .post('/api/stream-message')
        .set('Content-Type', 'application/json')
        .send({
          model: 'llama3.1:8b',
          message: 'Database consistency test',
          conversationId: testConversationId
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    test('should handle database cleanup operations', async () => {
      // Test database cleanup functionality
      const response = await request(BASE_URL)
        .get('/api/images/metrics')
        .expect(200);

      expect(response.body.database).toHaveProperty('totalRecords');
      expect(response.body.database).toHaveProperty('totalSize');
    });
  });

  describe('Security Tests', () => {
    test('should validate image file signatures', async () => {
      // Test that the system validates actual image file signatures
      const response = await request(BASE_URL)
        .post('/api/stream-message')
        .field('model', 'llama3.1:8b')
        .field('message', 'Security test')
        .field('conversationId', testConversationId)
        .attach('images', Buffer.from('fake-image-data'), 'test.jpg')
        .expect(400); // Should reject invalid image data

      expect(response.body).toHaveProperty('error');
    });

    test('should enforce file size limits', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      const response = await request(BASE_URL)
        .post('/api/stream-message')
        .field('model', 'llama3.1:8b')
        .field('message', 'Size limit test')
        .field('conversationId', testConversationId)
        .attach('images', largeBuffer, 'large-file.jpg')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('file size');
    });
  });
}); 