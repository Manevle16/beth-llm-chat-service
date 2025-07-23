#!/usr/bin/env node

/**
 * Database Migration Script for Image Upload Feature
 * 
 * This script creates the images table and adds the has_images column
 * to the messages table for the image upload feature.
 */

import pool from '../config/database.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class ImageSchemaMigration {
  constructor() {
    this.migrationSteps = [
      {
        name: 'Create images table',
        query: `
          CREATE TABLE IF NOT EXISTS images (
            id VARCHAR(255) PRIMARY KEY,
            conversation_id VARCHAR(255) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
            filename VARCHAR(255) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_size INTEGER NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            content_hash VARCHAR(64) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE
          );
        `
      },
      {
        name: 'Create images table indexes',
        query: `
          CREATE INDEX IF NOT EXISTS idx_images_conversation_id ON images(conversation_id);
          CREATE INDEX IF NOT EXISTS idx_images_message_id ON images(message_id);
          CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at);
          CREATE INDEX IF NOT EXISTS idx_images_expires_at ON images(expires_at);
          CREATE INDEX IF NOT EXISTS idx_images_content_hash ON images(content_hash);
        `
      },
      {
        name: 'Add has_images column to messages table',
        query: `
          DO $$ 
          BEGIN 
            IF NOT EXISTS (
              SELECT column_name 
              FROM information_schema.columns 
              WHERE table_name = 'messages' AND column_name = 'has_images'
            ) THEN
              ALTER TABLE messages ADD COLUMN has_images BOOLEAN DEFAULT FALSE;
            END IF;
          END $$;
        `
      },
      {
        name: 'Create has_images index',
        query: `
          CREATE INDEX IF NOT EXISTS idx_messages_has_images ON messages(has_images);
        `
      }
    ];
  }

  /**
   * Run the migration
   */
  async run() {
    console.log("🚀 Starting Image Schema Migration...");
    console.log("=====================================");

    const client = await pool.connect();

    try {
      // Test database connection
      await client.query('SELECT NOW()');
      console.log("✅ Database connection established");

      // Check if tables exist
      await this._checkExistingTables(client);

      // Run migration steps
      for (let i = 0; i < this.migrationSteps.length; i++) {
        const step = this.migrationSteps[i];
        console.log(`\n${i + 1}. ${step.name}...`);
        
        try {
          await client.query(step.query);
          console.log(`   ✅ ${step.name} completed successfully`);
        } catch (error) {
          console.error(`   ❌ ${step.name} failed:`, error.message);
          throw error;
        }
      }

      // Verify migration
      await this._verifyMigration(client);

      console.log("\n🎉 Migration completed successfully!");
      console.log("=====================================");

    } catch (error) {
      console.error("\n❌ Migration failed:", error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check existing tables
   * @private
   */
  async _checkExistingTables(client) {
    console.log("\n📋 Checking existing tables...");

    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('conversations', 'messages', 'stream_sessions')
      ORDER BY table_name;
    `;

    const result = await client.query(tablesQuery);
    const existingTables = result.rows.map(row => row.table_name);

    console.log("   Existing tables:", existingTables.join(', '));

    if (!existingTables.includes('conversations') || !existingTables.includes('messages')) {
      throw new Error("Required tables (conversations, messages) not found. Please run the main database schema first.");
    }
  }

  /**
   * Verify migration was successful
   * @private
   */
  async _verifyMigration(client) {
    console.log("\n🔍 Verifying migration...");

    // Check images table
    const imagesTableQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'images'
      ORDER BY ordinal_position;
    `;

    const imagesResult = await client.query(imagesTableQuery);
    console.log(`   Images table columns: ${imagesResult.rows.length}`);

    // Check has_images column
    const hasImagesQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'has_images';
    `;

    const hasImagesResult = await client.query(hasImagesQuery);
    
    if (hasImagesResult.rows.length > 0) {
      console.log("   ✅ has_images column exists in messages table");
    } else {
      console.log("   ⚠️ has_images column not found in messages table");
    }

    // Check indexes
    const indexesQuery = `
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE tablename IN ('images', 'messages')
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname;
    `;

    const indexesResult = await client.query(indexesQuery);
    console.log(`   Indexes created: ${indexesResult.rows.length}`);

    // Show sample data structure
    console.log("\n📊 Sample data structure:");
    console.log("   images table:", imagesResult.rows.map(row => `${row.column_name} (${row.data_type})`).join(', '));
  }

  /**
   * Rollback migration (for testing)
   */
  async rollback() {
    console.log("🔄 Rolling back Image Schema Migration...");

    const client = await pool.connect();

    try {
      // Drop indexes first
      await client.query('DROP INDEX IF EXISTS idx_messages_has_images;');
      await client.query('DROP INDEX IF EXISTS idx_images_content_hash;');
      await client.query('DROP INDEX IF EXISTS idx_images_expires_at;');
      await client.query('DROP INDEX IF EXISTS idx_images_created_at;');
      await client.query('DROP INDEX IF EXISTS idx_images_message_id;');
      await client.query('DROP INDEX IF EXISTS idx_images_conversation_id;');

      // Drop images table
      await client.query('DROP TABLE IF EXISTS images CASCADE;');

      // Remove has_images column
      await client.query('ALTER TABLE messages DROP COLUMN IF EXISTS has_images;');

      console.log("✅ Rollback completed successfully");

    } catch (error) {
      console.error("❌ Rollback failed:", error.message);
      throw error;
    } finally {
      client.release();
    }
  }
}

// Main execution
async function main() {
  const migration = new ImageSchemaMigration();

  try {
    if (process.argv.includes('--rollback')) {
      await migration.rollback();
    } else {
      await migration.run();
    }
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default ImageSchemaMigration; 