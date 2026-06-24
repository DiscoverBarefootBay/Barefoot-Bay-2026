/**
 * Emergency fix for forum media files that have incorrect paths
 * 
 * This script:
 * 1. Scans the file system to find all forum media files
 * 2. Makes sure they exist in both /uploads/forum-media/ and /forum-media/ directories
 * 3. Additionally checks content-media files since they may be referenced in forum posts
 * 
 * Usage:
 * node fix-forum-media.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Directories to check and sync
const directories = [
  { src: 'content-media', dest: 'uploads/content-media' },
  { src: 'uploads/content-media', dest: 'content-media' },
  { src: 'forum-media', dest: 'uploads/forum-media' },
  { src: 'uploads/forum-media', dest: 'forum-media' }
];

// Create directories if they don't exist
function ensureDirectoryExists(directory) {
  if (!fs.existsSync(directory)) {
    console.log(`Creating directory: ${directory}`);
    fs.mkdirSync(directory, { recursive: true });
    return true;
  }
  return false;
}

// Copy file and create parent directories if needed
function copyFileWithDirs(source, dest) {
  ensureDirectoryExists(path.dirname(dest));
  fs.copyFileSync(source, dest);
  console.log(`Copied: ${source} → ${dest}`);
}

// Process a directory, synchronizing files in both directions
function syncDirectory(srcDir, destDir) {
  console.log(`\nSynchronizing ${srcDir} ↔ ${destDir}`);
  
  if (!fs.existsSync(srcDir)) {
    console.error(`Source directory ${srcDir} does not exist`);
    ensureDirectoryExists(srcDir);
    return;
  }
  
  ensureDirectoryExists(destDir);
  
  // Get list of files in source directory
  const files = fs.readdirSync(srcDir);
  console.log(`Found ${files.length} files in ${srcDir}`);
  
  // Copy files that don't exist in destination
  let copied = 0;
  for (const file of files) {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);
    
    // Skip directories
    if (fs.statSync(srcFile).isDirectory()) continue;
    
    // If file doesn't exist in destination, copy it
    if (!fs.existsSync(destFile)) {
      copyFileWithDirs(srcFile, destFile);
      copied++;
    }
  }
  
  console.log(`Copied ${copied} files from ${srcDir} to ${destDir}`);
  
  // Check permissions and fix if needed
  try {
    console.log(`Setting permissions to allow server to access files...`);
    execSync(`chmod -R 755 ${srcDir}`);
    execSync(`chmod -R 755 ${destDir}`);
  } catch (error) {
    console.error(`Error setting permissions: ${error.message}`);
  }
}

// Main function to handle synchronization
function main() {
  console.log('Forum Media Emergency Fix');
  console.log('========================');
  
  // Create directories if they don't exist
  for (const dir of directories) {
    ensureDirectoryExists(dir.src);
    ensureDirectoryExists(dir.dest);
  }
  
  // Synchronize all directories
  for (const dir of directories) {
    syncDirectory(dir.src, dir.dest);
  }
  
  console.log('\nFix complete! Media files are now synchronized between uploads/ and root directories.');
  console.log('Please refresh your browser to see if images now appear correctly.');
}

// Execute the main function
main();