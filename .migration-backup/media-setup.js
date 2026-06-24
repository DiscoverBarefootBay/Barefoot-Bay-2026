/**
 * Media Setup Script
 * 
 * This script ensures critical media files are copied to the correct locations
 * for both development and production environments.
 * 
 * Run this script before deployment to ensure all required assets are in place.
 * 
 * Usage:
 * node media-setup.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define critical files that must be available in production
const CRITICAL_FILES = [
  {
    source: './uploads/icons/Asset1.svg',
    destinations: [
      './public/icons/Asset1.svg',
      './public/Asset1.svg'  // Also copy to root public for fallback
    ]
  },
  // Add other critical files here if needed
];

// Create directories if they don't exist
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Copy a file from source to destination
function copyFile(source, destination) {
  try {
    // Make sure the destination directory exists
    const destDir = path.dirname(destination);
    ensureDirectoryExists(destDir);
    
    // Copy the file
    fs.copyFileSync(source, destination);
    console.log(`✅ Successfully copied ${source} to ${destination}`);
    return true;
  } catch (error) {
    console.error(`❌ Error copying ${source} to ${destination}:`, error.message);
    return false;
  }
}

// Main function to process critical files
function setupMediaFiles() {
  console.log('📦 Setting up critical media files for production...');
  
  let successCount = 0;
  let errorCount = 0;
  
  // Process each critical file
  CRITICAL_FILES.forEach(file => {
    // Check if source exists
    if (!fs.existsSync(file.source)) {
      console.error(`❌ Source file not found: ${file.source}`);
      errorCount++;
      return;
    }
    
    // Copy to all destinations
    file.destinations.forEach(destination => {
      if (copyFile(file.source, destination)) {
        successCount++;
      } else {
        errorCount++;
      }
    });
  });
  
  console.log('\n📊 Summary:');
  console.log(`- ${successCount} files successfully copied`);
  console.log(`- ${errorCount} errors encountered`);
  
  if (errorCount === 0) {
    console.log('✅ All media files are set up for production!');
  } else {
    console.log('⚠️ Some files could not be copied. Check the errors above.');
  }
}

// Run the script
setupMediaFiles();