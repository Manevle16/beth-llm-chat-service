#!/usr/bin/env node

/**
 * Migration Script: Add Base64 Storage to Images Table
 * 
 * This script adds a base64_data column to the images table and migrates
 * existing images to store base64 data directly in the database instead
 * of relying on file system storage.
 */

import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'beth_chat_service',
  password: process.env.DB_PASSWORD || 'your_password_here',
  port: process.env.DB_PORT || 5432,
});

async function migrateToBase64Storage() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting migration to base64 storage...');
    
    // Check if base64_data column already exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'images' AND column_name = 'base64_data'
    `;
    
    const columnExists = await client.query(checkColumnQuery);
    
    if (columnExists.rows.length > 0) {
      console.log('✅ base64_data column already exists');
    } else {
      // Add base64_data column
      console.log('📝 Adding base64_data column to images table...');
      await client.query(`
        ALTER TABLE images 
        ADD COLUMN base64_data TEXT
      `);
      console.log('✅ base64_data column added successfully');
    }
    
    // Get all images that don't have base64_data yet
    const imagesQuery = `
      SELECT id, file_path, mime_type 
      FROM images 
      WHERE base64_data IS NULL 
      AND deleted_at IS NULL
    `;
    
    const images = await client.query(imagesQuery);
    console.log(`📊 Found ${images.rows.length} images to migrate`);
    
    if (images.rows.length > 0) {
      // Migrate existing images to base64
      for (const image of images.rows) {
        try {
          console.log(`🔄 Migrating image: ${image.id}`);
          
          // Check if file exists
          try {
            await fs.access(image.file_path);
          } catch (error) {
            console.log(`⚠️  File not found for image ${image.id}: ${image.file_path}`);
            continue;
          }
          
          // Read file and convert to base64
          const fileBuffer = await fs.readFile(image.file_path);
          const base64Data = fileBuffer.toString('base64');
          const dataUrl = `data:${image.mime_type};base64,${base64Data}`;
          
          // Update database with base64 data
          await client.query(`
            UPDATE images 
            SET base64_data = $1 
            WHERE id = $2
          `, [dataUrl, image.id]);
          
          console.log(`✅ Migrated image: ${image.id}`);
          
        } catch (error) {
          console.error(`❌ Failed to migrate image ${image.id}:`, error.message);
        }
      }
    }
    
    // Skip index creation for base64_data column (data too large for index)
    console.log('ℹ️  Skipping index creation for base64_data column (data too large)');
    
    console.log('🎉 Migration completed successfully!');
    
    // Show migration summary
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_images,
        COUNT(base64_data) as images_with_base64,
        COUNT(*) - COUNT(base64_data) as images_without_base64
      FROM images 
      WHERE deleted_at IS NULL
    `;
    
    const summary = await client.query(summaryQuery);
    const stats = summary.rows[0];
    
    console.log('\n📊 Migration Summary:');
    console.log(`   Total images: ${stats.total_images}`);
    console.log(`   With base64 data: ${stats.images_with_base64}`);
    console.log(`   Without base64 data: ${stats.images_without_base64}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function rollbackMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Rolling back base64 storage migration...');
    
    // Remove base64_data column
    await client.query(`
      ALTER TABLE images 
      DROP COLUMN IF EXISTS base64_data
    `);
    
    console.log('✅ Rollback completed successfully');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    if (command === '--rollback') {
      await rollbackMigration();
    } else {
      await migrateToBase64Storage();
    }
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
main(); 