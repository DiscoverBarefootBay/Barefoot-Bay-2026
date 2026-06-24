/**
 * Emergency script to copy media files from /uploads/ to root locations
 * 
 * This script:
 * 1. Scans all files in the /uploads directory and subdirectories
 * 2. Creates corresponding files in the root directory structure
 * 3. Ensures that files can be accessed via both /uploads/path and /path
 * 
 * Usage:
 * node copy-media-files.js
 */

import fs from 'fs';
import path from 'path';

// Define the source and destinations
const UPLOADS_DIR = './uploads';

// Function to recursively scan directories
function scanDirectory(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      results.push(...scanDirectory(fullPath));
    } else {
      // Add file to results
      results.push(fullPath);
    }
  }
  
  return results;
}

// Function to copy a file while creating directories as needed
function copyFileWithDirs(source, dest) {
  const destDir = path.dirname(dest);
  
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Copy the file
  fs.copyFileSync(source, dest);
}

// Main function
async function main() {
  console.log('Starting media file copy process...');
  
  try {
    // Check if uploads directory exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      console.error(`Error: ${UPLOADS_DIR} directory does not exist!`);
      process.exit(1);
    }
    
    // Scan all files in uploads directory
    console.log('Scanning uploads directory for files...');
    const files = scanDirectory(UPLOADS_DIR);
    console.log(`Found ${files.length} files in uploads directory.`);
    
    // Copy files to root path equivalents
    let copied = 0;
    let skipped = 0;
    
    for (const file of files) {
      // Get the path relative to uploads directory
      const relativePath = path.relative(UPLOADS_DIR, file);
      
      // Calculate destination path (without /uploads prefix)
      const destPath = `./${relativePath}`;
      
      // Skip if destination already exists
      if (fs.existsSync(destPath)) {
        skipped++;
        continue;
      }
      
      // Copy the file
      try {
        copyFileWithDirs(file, destPath);
        copied++;
        console.log(`Copied: ${file} → ${destPath}`);
      } catch (err) {
        console.error(`Error copying ${file}: ${err.message}`);
      }
    }
    
    console.log('\nCopy process completed:');
    console.log(`- Total files found: ${files.length}`);
    console.log(`- Files copied: ${copied}`);
    console.log(`- Files skipped (already exist): ${skipped}`);
    console.log(`- Total files processed: ${copied + skipped}`);
    
    console.log('\nMedia files are now accessible via both:');
    console.log('1. Original path: /uploads/category/file.jpg');
    console.log('2. Production path: /category/file.jpg');
    
  } catch (error) {
    console.error('Error copying media files:', error);
  }
}

// Run the script
main();