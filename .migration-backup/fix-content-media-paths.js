/**
 * Fix content media path issues by ensuring files are accessible 
 * from both /uploads/content-media and /content-media paths
 * 
 * This script:
 * 1. Scans all files in the /content-media directory
 * 2. Creates corresponding files in the /uploads/content-media directory
 * 3. Ensures the specific Dan Hess Antiques image is available in both locations
 * 
 * Usage:
 * node fix-content-media-paths.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureDirectoriesExist() {
  console.log('Ensuring required directories exist...');
  
  // Create directories if they don't exist
  const contentMediaDir = path.join(process.cwd(), 'content-media');
  const uploadsContentMediaDir = path.join(process.cwd(), 'uploads', 'content-media');
  
  if (!fs.existsSync(contentMediaDir)) {
    console.log(`Creating directory: ${contentMediaDir}`);
    fs.mkdirSync(contentMediaDir, { recursive: true });
  }
  
  if (!fs.existsSync(uploadsContentMediaDir)) {
    console.log(`Creating directory: ${uploadsContentMediaDir}`);
    fs.mkdirSync(uploadsContentMediaDir, { recursive: true });
  }
  
  return { contentMediaDir, uploadsContentMediaDir };
}

async function mirrorFiles(contentMediaDir, uploadsContentMediaDir) {
  console.log('Mirroring files between content-media directories...');
  
  try {
    // First, copy from content-media to uploads/content-media
    const contentMediaFiles = fs.readdirSync(contentMediaDir);
    console.log(`Found ${contentMediaFiles.length} files in content-media`);
    
    for (const file of contentMediaFiles) {
      const sourcePath = path.join(contentMediaDir, file);
      const destPath = path.join(uploadsContentMediaDir, file);
      
      // Skip directories and only copy files
      if (fs.statSync(sourcePath).isFile()) {
        console.log(`Copying: ${sourcePath} -> ${destPath}`);
        fs.copyFileSync(sourcePath, destPath);
      }
    }
    
    // Then, copy from uploads/content-media to content-media (if any files are different)
    const uploadsContentMediaFiles = fs.readdirSync(uploadsContentMediaDir);
    console.log(`Found ${uploadsContentMediaFiles.length} files in uploads/content-media`);
    
    for (const file of uploadsContentMediaFiles) {
      const sourcePath = path.join(uploadsContentMediaDir, file);
      const destPath = path.join(contentMediaDir, file);
      
      // Skip directories and only copy files that don't exist in content-media
      if (fs.statSync(sourcePath).isFile() && !fs.existsSync(destPath)) {
        console.log(`Copying: ${sourcePath} -> ${destPath}`);
        fs.copyFileSync(sourcePath, destPath);
      }
    }
    
    console.log('File mirroring complete');
  } catch (err) {
    console.error('Error mirroring files:', err);
  }
}

async function ensureDanHessImage(contentMediaDir, uploadsContentMediaDir) {
  console.log('Ensuring Dan Hess Antiques image is available...');
  
  const danHessImageFilename = 'mediaFile-1745355164980-265491046.png';
  const contentMediaPath = path.join(contentMediaDir, danHessImageFilename);
  const uploadsContentMediaPath = path.join(uploadsContentMediaDir, danHessImageFilename);
  
  // Check if the image exists in either location
  const existsInContentMedia = fs.existsSync(contentMediaPath);
  const existsInUploadsContentMedia = fs.existsSync(uploadsContentMediaPath);
  
  console.log(`Dan Hess image exists in content-media: ${existsInContentMedia}`);
  console.log(`Dan Hess image exists in uploads/content-media: ${existsInUploadsContentMedia}`);
  
  if (existsInContentMedia && !existsInUploadsContentMedia) {
    console.log('Copying Dan Hess image from content-media to uploads/content-media');
    fs.copyFileSync(contentMediaPath, uploadsContentMediaPath);
  } else if (!existsInContentMedia && existsInUploadsContentMedia) {
    console.log('Copying Dan Hess image from uploads/content-media to content-media');
    fs.copyFileSync(uploadsContentMediaPath, contentMediaPath);
  } else if (!existsInContentMedia && !existsInUploadsContentMedia) {
    console.error('Dan Hess image not found in either location!');
    console.log('This script expects the image to exist in at least one location.');
  } else {
    console.log('Dan Hess image already exists in both locations. No action needed.');
  }
}

async function main() {
  console.log('Starting content-media path fix...');
  
  // Ensure required directories exist
  const { contentMediaDir, uploadsContentMediaDir } = ensureDirectoriesExist();
  
  // Mirror files between content-media and uploads/content-media
  await mirrorFiles(contentMediaDir, uploadsContentMediaDir);
  
  // Specifically ensure Dan Hess image exists in both locations
  await ensureDanHessImage(contentMediaDir, uploadsContentMediaDir);
  
  console.log('Content media path fix completed successfully.');
}

// Run the main function
main().catch(err => {
  console.error('Error executing script:', err);
  process.exit(1);
});