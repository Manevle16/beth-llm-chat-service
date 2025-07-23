#!/usr/bin/env node

/**
 * Test Script for Image Database Operations
 * 
 * This script tests the image database operations to ensure
 * the schema changes work correctly.
 */

import pool from '../config/database.js';
import imageDatabaseService from '../services/imageDatabaseService.js';
import {
  createImageRecord,
  generateImageId
} from '../types/imageUpload.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class ImageDatabaseTest {
  constructor() {
    this.testConversationId = 'test-conversation-image-db';
    this.testMessageId = 999999; // High number to avoid conflicts
  }

  /**
   * Run all tests
   */
  async runTests() {
    console.log("🧪 Starting Image Database Tests...");
    console.log("=====================================");

    try {
      // Initialize the service
      await imageDatabaseService.initialize();
      console.log("✅ Image Database Service initialized");

      // Test 1: Create test conversation
      await this._createTestConversation();
      console.log("✅ Test conversation created");

      // Test 2: Create test message
      await this._createTestMessage();
      console.log("✅ Test message created");

      // Test 3: Save image record
      const imageRecord = await this._testSaveImageRecord();
      console.log("✅ Image record saved");

      // Test 4: Link image to message
      await this._testLinkImageToMessage(imageRecord.id);
      console.log("✅ Image linked to message");

      // Test 5: Retrieve images for conversation
      await this._testGetImagesForConversation();
      console.log("✅ Images retrieved for conversation");

      // Test 6: Retrieve images for message
      await this._testGetImagesForMessage();
      console.log("✅ Images retrieved for message");

      // Test 7: Get image display data
      await this._testGetImageDisplayData(imageRecord.id);
      console.log("✅ Image display data retrieved");

      // Test 8: Database statistics
      await this._testDatabaseStats();
      console.log("✅ Database statistics retrieved");

      // Test 9: Clean up test data
      await this._cleanupTestData();
      console.log("✅ Test data cleaned up");

      console.log("\n🎉 All tests passed successfully!");
      console.log("=====================================");

    } catch (error) {
      console.error("\n❌ Test failed:", error.message);
      throw error;
    } finally {
      await pool.end();
    }
  }

  /**
   * Create test conversation
   * @private
   */
  async _createTestConversation() {
    const query = `
      INSERT INTO conversations (id, tab_name, llm_model, is_private)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING;
    `;

    await pool.query(query, [
      this.testConversationId,
      'Test Conversation for Image DB',
      'llama3.1:8b',
      false
    ]);
  }

  /**
   * Create test message
   * @private
   */
  async _createTestMessage() {
    const query = `
      INSERT INTO messages (conversation_id, text, sender)
      VALUES ($1, $2, $3)
      RETURNING id;
    `;

    const result = await pool.query(query, [
      this.testConversationId,
      'Test message with image',
      'user'
    ]);

    this.testMessageId = result.rows[0].id;
  }

  /**
   * Test saving image record
   * @private
   */
  async _testSaveImageRecord() {
    const imageId = generateImageId();
    const imageRecord = createImageRecord(
      imageId,
      this.testConversationId,
      this.testMessageId,
      'test-image.png',
      '/path/to/test-image.png',
      1024,
      'image/png',
      'test-hash-1234567890abcdef'
    );

    const savedRecord = await imageDatabaseService.saveImageRecord(imageRecord);
    
    if (!savedRecord || savedRecord.id !== imageId) {
      throw new Error('Failed to save image record');
    }

    return savedRecord;
  }

  /**
   * Test linking image to message
   * @private
   */
  async _testLinkImageToMessage(imageId) {
    await imageDatabaseService.linkImageToMessage(
      imageId,
      this.testMessageId,
      this.testConversationId
    );

    // Verify the link was created
    const images = await imageDatabaseService.getImagesForMessage(this.testMessageId);
    if (images.length === 0) {
      throw new Error('Image not linked to message');
    }
  }

  /**
   * Test getting images for conversation
   * @private
   */
  async _testGetImagesForConversation() {
    const images = await imageDatabaseService.getImagesForConversation(this.testConversationId);
    
    if (images.length === 0) {
      throw new Error('No images found for conversation');
    }

    console.log(`   Found ${images.length} images for conversation`);
  }

  /**
   * Test getting images for message
   * @private
   */
  async _testGetImagesForMessage() {
    const images = await imageDatabaseService.getImagesForMessage(this.testMessageId);
    
    if (images.length === 0) {
      throw new Error('No images found for message');
    }

    console.log(`   Found ${images.length} images for message`);
  }

  /**
   * Test getting image display data
   * @private
   */
  async _testGetImageDisplayData(imageId) {
    const displayData = await imageDatabaseService.getImageDisplayData(imageId);
    
    if (!displayData || !displayData.displayUrl) {
      throw new Error('Invalid image display data');
    }

    console.log(`   Image display URL: ${displayData.displayUrl}`);
  }

  /**
   * Test database statistics
   * @private
   */
  async _testDatabaseStats() {
    const stats = await imageDatabaseService.getDatabaseStats();
    
    if (typeof stats.totalRecords !== 'number') {
      throw new Error('Invalid database statistics');
    }

    console.log(`   Database stats: ${stats.totalRecords} records, ${stats.totalSize} bytes`);
  }

  /**
   * Clean up test data
   * @private
   */
  async _cleanupTestData() {
    // Delete test conversation (this will cascade delete images and messages)
    const deleteQuery = `
      DELETE FROM conversations WHERE id = $1;
    `;

    await pool.query(deleteQuery, [this.testConversationId]);
    console.log("   Test data cleaned up");
  }
}

// Main execution
async function main() {
  const test = new ImageDatabaseTest();

  try {
    await test.runTests();
  } catch (error) {
    console.error("Test failed:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default ImageDatabaseTest; 