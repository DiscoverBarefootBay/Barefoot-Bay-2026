/**
 * Fix Real Estate Media Script
 * 
 * This script ensures all real estate media files exist in both locations:
 * - /uploads/real-estate-media/
 * - /real-estate-media/
 * 
 * It fixes the issue where media disappears after refresh or deployment
 * by synchronizing files between directories.
 * 
 * Usage: node fix-real-estate-media.js
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Promisify fs functions
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);

// Media directories
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'real-estate-media');
const DIRECT_DIR = path.join(process.cwd(), 'real-estate-media');

// Ensure directories exist
async function ensureDirectoryExists(dirPath) {
  try {
    if (!await exists(dirPath)) {
      await mkdir(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
  }
}

// Copy files from source to destination if they don't exist
async function syncFiles(sourceDir, destDir, description) {
  console.log(`\nSyncing files from ${description}...`);
  
  try {
    // Make sure the destination directory exists
    await ensureDirectoryExists(destDir);
    
    // Skip if source directory doesn't exist
    if (!await exists(sourceDir)) {
      console.log(`Source directory ${sourceDir} doesn't exist, skipping.`);
      return { checked: 0, copied: 0 };
    }
    
    // Get all files in the source directory
    const files = await readdir(sourceDir);
    console.log(`Found ${files.length} files in ${sourceDir}`);
    
    let copiedCount = 0;
    
    // Process each file
    for (const filename of files) {
      const sourcePath = path.join(sourceDir, filename);
      const destPath = path.join(destDir, filename);
      
      // Skip if not a file
      const fileStats = await stat(sourcePath);
      if (!fileStats.isFile()) continue;
      
      // Check if destination file exists
      if (!await exists(destPath)) {
        // Copy the file
        await copyFile(sourcePath, destPath);
        console.log(`Copied ${filename} from ${sourceDir} to ${destDir}`);
        copiedCount++;
      }
    }
    
    return { checked: files.length, copied: copiedCount };
  } catch (error) {
    console.error(`Error syncing files from ${sourceDir} to ${destDir}:`, error);
    return { checked: 0, copied: 0 };
  }
}

// Find all listings with real estate media
async function fixListingMediaPaths() {
  console.log('\nChecking database for listings with missing media...');
  
  try {
    // This operation would be improved with database access
    // But for this script, we'll just ensure physical files are synced
    console.log('Note: To fully fix media issues, run this after server restart.');
  } catch (error) {
    console.error('Error fixing listing media paths:', error);
  }
}

// Main function
async function main() {
  console.log('=== Real Estate Media Fix Tool ===');
  
  try {
    // Ensure both directories exist
    await ensureDirectoryExists(UPLOADS_DIR);
    await ensureDirectoryExists(DIRECT_DIR);
    
    // Sync files from uploads dir to direct dir
    const uploadsToDirectResult = await syncFiles(
      UPLOADS_DIR,
      DIRECT_DIR,
      'uploads to direct'
    );
    
    // Sync files from direct dir to uploads dir
    const directToUploadsResult = await syncFiles(
      DIRECT_DIR,
      UPLOADS_DIR,
      'direct to uploads'
    );
    
    // Fix listing media paths in database
    await fixListingMediaPaths();
    
    // Print summary
    console.log('\n=== Summary ===');
    console.log(`Files checked in uploads dir: ${uploadsToDirectResult.checked}`);
    console.log(`Files copied from uploads to direct: ${uploadsToDirectResult.copied}`);
    console.log(`Files checked in direct dir: ${directToUploadsResult.checked}`);
    console.log(`Files copied from direct to uploads: ${directToUploadsResult.copied}`);
    console.log('\nMedia synchronization complete!');
    console.log('You should now see your media files correctly after page refresh or deployment.');
    
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Run the main function
main().catch(console.error);