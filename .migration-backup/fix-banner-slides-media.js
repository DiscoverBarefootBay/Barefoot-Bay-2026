/**
 * Script to fix banner slides media paths
 * 
 * This script ensures that all banner slide files in the /uploads/banner-slides directory
 * are also available in the /banner-slides directory for production access.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory equivalent to __dirname in CommonJS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const MEDIA_TYPE = 'banner-slides';
const DEVELOPMENT_PATH = path.join(__dirname, 'uploads', MEDIA_TYPE);
const PRODUCTION_PATH = path.join(__dirname, MEDIA_TYPE);

/**
 * Ensure directory exists, creating it if necessary
 * @param {string} dirPath - Directory path to check/create
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Copy files from source to destination, creating destination directory if needed
 * @param {string} sourceDir - Source directory
 * @param {string} destDir - Destination directory
 * @returns {number} - Number of files copied
 */
function syncFiles(sourceDir, destDir) {
  ensureDirectoryExists(sourceDir);
  ensureDirectoryExists(destDir);
  
  let copiedCount = 0;
  let alreadySyncedCount = 0;
  
  try {
    // Read files from source directory
    const files = fs.readdirSync(sourceDir);
    console.log(`Found ${files.length} files in ${sourceDir}`);
    
    // Copy each file to destination if it doesn't exist
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const destPath = path.join(destDir, file);
      
      // Skip directories
      if (fs.statSync(sourcePath).isDirectory()) {
        continue;
      }
      
      // Check if file already exists in destination
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`Copied ${file} to ${destDir}`);
        copiedCount++;
      } else {
        // File already exists
        alreadySyncedCount++;
      }
    }
    
    console.log(`Copied ${copiedCount} files, ${alreadySyncedCount} files already synced`);
    return copiedCount;
  } catch (error) {
    console.error(`Error syncing files from ${sourceDir} to ${destDir}:`, error);
    return 0;
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`Starting banner slides media path fix`);
  
  // Sync files from development to production path
  const devToProdCount = syncFiles(DEVELOPMENT_PATH, PRODUCTION_PATH);
  
  // Sync files from production to development path
  const prodToDevCount = syncFiles(PRODUCTION_PATH, DEVELOPMENT_PATH);
  
  console.log(`\n===== Summary =====`);
  console.log(`Total files fixed: ${devToProdCount + prodToDevCount}`);
  console.log(`- ${devToProdCount} files copied from development to production path`);
  console.log(`- ${prodToDevCount} files copied from production to development path`);
  
  if (devToProdCount + prodToDevCount > 0) {
    console.log(`\n✅ Banner slides media paths have been fixed successfully!`);
  } else {
    console.log(`\n✅ All banner slides media paths are already correctly synced.`);
  }
}

// Run the main function
main().catch(error => {
  console.error('Error in main function:', error);
  process.exit(1);
});