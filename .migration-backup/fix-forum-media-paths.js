/**
 * Forum Media Path Fixer (Standalone Version)
 * 
 * This script fixes inconsistent media paths in forum posts by:
 * 1. Copying files from attached_assets to forum-media
 * 2. In a future step, we'll implement content database updates
 * 
 * Usage:
 * node fix-forum-media-paths.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory from ESM module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to create directories recursively if they don't exist
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Function to copy a file and ensure its destination directory exists
function copyFileWithDirs(src, dest) {
  try {
    // Ensure the destination directory exists
    const destDir = path.dirname(dest);
    ensureDirectoryExists(destDir);
    
    // Copy the file
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${src} -> ${dest}`);
    return true;
  } catch (err) {
    console.error(`Error copying ${src} to ${dest}:`, err);
    return false;
  }
}

// Function to fix media paths in a string
function fixMediaPaths(content) {
  if (!content || typeof content !== 'string') return content;
  
  // Original content for comparison
  const originalContent = content;
  
  // Replace all /attached_assets/ references with /forum-media/
  content = content.replace(/\/attached_assets\//g, '/forum-media/');
  
  // Also handle case without leading slash
  content = content.replace(/attached_assets\//g, '/forum-media/');
  
  // Check if we made any changes
  return {
    content,
    changed: content !== originalContent
  };
}

// Function to copy images from attached_assets to forum-media
async function copyAttachedAssetsToForumMedia() {
  const attachedAssetsDir = path.join(process.cwd(), 'attached_assets');
  const forumMediaDir = path.join(process.cwd(), 'forum-media');
  const uploadsForumMediaDir = path.join(process.cwd(), 'uploads', 'forum-media');
  
  // Ensure destination directories exist
  ensureDirectoryExists(forumMediaDir);
  ensureDirectoryExists(uploadsForumMediaDir);
  
  // Get all files in attached_assets
  let files;
  try {
    files = fs.readdirSync(attachedAssetsDir);
  } catch (err) {
    console.error('Error reading attached_assets directory:', err);
    return;
  }
  
  // Count of copied files
  let copied = 0;
  
  // Copy each file to both forum-media locations
  for (const file of files) {
    const sourceFile = path.join(attachedAssetsDir, file);
    
    // Skip directories
    if (fs.statSync(sourceFile).isDirectory()) continue;
    
    // Only copy image files (check extensions)
    const ext = path.extname(file).toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
    
    if (!imageExts.includes(ext)) {
      console.log(`Skipping non-image file: ${file}`);
      continue;
    }
    
    // Copy to both destinations
    const destFile1 = path.join(forumMediaDir, file);
    const destFile2 = path.join(uploadsForumMediaDir, file);
    
    // Skip if both already exist
    if (fs.existsSync(destFile1) && fs.existsSync(destFile2)) {
      console.log(`File already exists in both locations: ${file}`);
      continue;
    }
    
    // Copy the files
    const copy1Success = copyFileWithDirs(sourceFile, destFile1);
    const copy2Success = copyFileWithDirs(sourceFile, destFile2);
    
    if (copy1Success && copy2Success) {
      copied++;
    }
  }
  
  console.log(`Copied ${copied} files from attached_assets to forum-media locations`);
}

// Main function to fix forum post media paths
async function fixForumMediaPaths() {
  console.log('Starting forum media path fix utility...');
  
  try {
    // Copy images from attached_assets to forum-media
    await copyAttachedAssetsToForumMedia();
    
    console.log('\nMedia file copy completed!');
    console.log('\nNOTE: We did not update the database content in this run.');
    console.log('Forum posts with attached_assets references in content will now display properly');
    console.log('because the images have been copied to the forum-media directory and our');
    console.log('normalizeMediaUrl function will handle the path conversion automatically.');
    
  } catch (error) {
    console.error('Error fixing forum media paths:', error);
  }
}

// Run the main function
fixForumMediaPaths().catch(console.error);