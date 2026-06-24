/**
 * Emergency script to copy media files from /uploads/ subdirectories to root locations
 * 
 * This script:
 * 1. Scans all files in the /uploads directory and subdirectories
 * 2. Creates corresponding files in the root directory structure
 * 3. Ensures that files can be accessed via both /uploads/path and /path
 * 
 * Usage:
 * node emergency-media-fix.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the media folder mapping
const MEDIA_FOLDERS = [
  'banner-slides',
  'calendar',
  'forum-media',
  'vendor-media',
  'community-media',
  'content-media',
  'avatars',
  'icons',
  'Real Estate'
];

// Check if a directory exists and create it if it doesn't
function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
    return true;
  }
  return false;
}

// Copy a file, creating any necessary directories
function copyFileWithDirs(source, dest) {
  try {
    // Ensure the destination directory exists
    const destDir = path.dirname(dest);
    ensureDirExists(destDir);
    
    // Copy the file
    fs.copyFileSync(source, dest);
    console.log(`Copied ${source} -> ${dest}`);
    return true;
  } catch (err) {
    console.error(`Error copying ${source} to ${dest}:`, err.message);
    return false;
  }
}

// Process a single media folder
function processMediaFolder(folderName) {
  const uploadsDir = path.join(__dirname, 'uploads', folderName);
  const rootDir = path.join(__dirname, folderName);
  
  // Skip if uploads directory doesn't exist
  if (!fs.existsSync(uploadsDir)) {
    console.log(`Skipping ${folderName} - uploads directory doesn't exist`);
    return {
      processed: 0,
      copied: 0,
      errors: 0
    };
  }
  
  // Ensure the root directory exists
  ensureDirExists(rootDir);
  
  let processed = 0;
  let copied = 0;
  let errors = 0;
  
  // Function to recursively process files in a directory
  function processDirectory(sourceDir, targetDir) {
    const files = fs.readdirSync(sourceDir);
    
    files.forEach(file => {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);
      const stats = fs.statSync(sourcePath);
      
      if (stats.isDirectory()) {
        // Ensure target subdirectory exists
        ensureDirExists(targetPath);
        // Process the subdirectory recursively
        const subResults = processDirectory(sourcePath, targetPath);
        processed += subResults.processed;
        copied += subResults.copied;
        errors += subResults.errors;
      } else {
        // Process a file
        processed++;
        if (!fs.existsSync(targetPath)) {
          if (copyFileWithDirs(sourcePath, targetPath)) {
            copied++;
          } else {
            errors++;
          }
        } else {
          console.log(`File already exists: ${targetPath}`);
        }
      }
    });
    
    return { processed, copied, errors };
  }
  
  const results = processDirectory(uploadsDir, rootDir);
  console.log(`${folderName} Summary: ${results.processed} files processed, ${results.copied} copied, ${results.errors} errors`);
  return results;
}

/**
 * Main function to process all media folders
 */
async function main() {
  console.log('Starting emergency media fix...');
  
  let totalProcessed = 0;
  let totalCopied = 0;
  let totalErrors = 0;
  
  for (const folder of MEDIA_FOLDERS) {
    console.log(`\nProcessing ${folder} media...`);
    const results = processMediaFolder(folder);
    totalProcessed += results.processed;
    totalCopied += results.copied;
    totalErrors += results.errors;
  }
  
  console.log('\n===== SUMMARY =====');
  console.log(`Total files processed: ${totalProcessed}`);
  console.log(`Total files copied: ${totalCopied}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log('Emergency media fix completed.');
}

// Run the main function
main().catch(err => {
  console.error('Error in main function:', err);
  process.exit(1);
});