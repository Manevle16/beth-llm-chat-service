#!/usr/bin/env node

/**
 * Cleanup Script: Remove Old Image Files
 * 
 * This script removes old image files from the uploads directory
 * since we now store base64 data directly in the database.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function cleanupOldImageFiles() {
  try {
    console.log('🧹 Starting cleanup of old image files...');
    
    const uploadsPath = process.env.IMAGE_STORAGE_PATH || path.join(__dirname, '../uploads/images');
    
    // Check if uploads directory exists
    try {
      await fs.access(uploadsPath);
    } catch (error) {
      console.log('ℹ️  Uploads directory does not exist, nothing to clean up');
      return;
    }
    
    // Get all files in the uploads directory
    const files = await fs.readdir(uploadsPath);
    const imageFiles = files.filter(file => 
      file.match(/\.(jpg|jpeg|png|webp)$/i)
    );
    
    if (imageFiles.length === 0) {
      console.log('ℹ️  No image files found in uploads directory');
      return;
    }
    
    console.log(`📊 Found ${imageFiles.length} image files to clean up`);
    
    let cleanedCount = 0;
    let totalSize = 0;
    
    for (const file of imageFiles) {
      try {
        const filePath = path.join(uploadsPath, file);
        const stats = await fs.stat(filePath);
        
        await fs.unlink(filePath);
        cleanedCount++;
        totalSize += stats.size;
        
        console.log(`🗑️  Removed: ${file} (${formatBytes(stats.size)})`);
        
      } catch (error) {
        console.warn(`⚠️  Failed to remove ${file}:`, error.message);
      }
    }
    
    console.log(`\n✅ Cleanup completed successfully!`);
    console.log(`   Files removed: ${cleanedCount}`);
    console.log(`   Space freed: ${formatBytes(totalSize)}`);
    
    // Try to remove the uploads directory if it's empty
    try {
      const remainingFiles = await fs.readdir(uploadsPath);
      if (remainingFiles.length === 0) {
        await fs.rmdir(uploadsPath);
        console.log(`🗑️  Removed empty uploads directory: ${uploadsPath}`);
      } else {
        console.log(`ℹ️  Uploads directory still contains ${remainingFiles.length} non-image files`);
      }
    } catch (error) {
      console.log(`ℹ️  Could not remove uploads directory: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Main execution
async function main() {
  try {
    await cleanupOldImageFiles();
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main(); 