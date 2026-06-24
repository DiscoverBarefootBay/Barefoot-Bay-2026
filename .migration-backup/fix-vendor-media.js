/**
 * Fix vendor media path issues by ensuring files are accessible 
 * from both /uploads/vendor-media and /vendor-media paths
 */

import fs from 'fs';
import path from 'path';

// Create directories if they don't exist
function ensureDirectoriesExist() {
  console.log('Ensuring vendor media directories exist...');
  
  // Make sure the directories exist
  const dirs = [
    'vendor-media', 
    'uploads/vendor-media'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Copy files from uploads/vendor-media to vendor-media and vice versa
function syncVendorMediaFiles() {
  console.log('Syncing vendor media files between directories...');
  
  // Copy from uploads/vendor-media to vendor-media
  if (fs.existsSync('uploads/vendor-media')) {
    const files = fs.readdirSync('uploads/vendor-media');
    files.forEach(file => {
      const sourcePath = path.join('uploads/vendor-media', file);
      const destPath = path.join('vendor-media', file);
      
      if (fs.statSync(sourcePath).isFile() && !fs.existsSync(destPath)) {
        console.log(`Copying ${sourcePath} to ${destPath}`);
        fs.copyFileSync(sourcePath, destPath);
      }
    });
  }
  
  // Copy from vendor-media to uploads/vendor-media
  if (fs.existsSync('vendor-media')) {
    const files = fs.readdirSync('vendor-media');
    files.forEach(file => {
      const sourcePath = path.join('vendor-media', file);
      const destPath = path.join('uploads/vendor-media', file);
      
      if (fs.statSync(sourcePath).isFile() && !fs.existsSync(destPath)) {
        console.log(`Copying ${sourcePath} to ${destPath}`);
        fs.copyFileSync(sourcePath, destPath);
      }
    });
  }
}

// Copy Dan Hess image to vendor-media directories
function copySpecificVendorImage() {
  console.log('Copying Dan Hess Antiques image to vendor media directories...');
  
  const sourceImage = 'attached_assets/image_1745545632305.png';
  const destPaths = [
    'vendor-media/dan-hess-antiques.png',
    'uploads/vendor-media/dan-hess-antiques.png',
    'vendor-media/Screenshot-2025-04-22-at-4.51.55-PM.png',
    'uploads/vendor-media/Screenshot-2025-04-22-at-4.51.55-PM.png'
  ];
  
  if (fs.existsSync(sourceImage)) {
    destPaths.forEach(destPath => {
      console.log(`Copying ${sourceImage} to ${destPath}`);
      fs.copyFileSync(sourceImage, destPath);
    });
  } else {
    console.error(`Source image not found: ${sourceImage}`);
  }
}

// Main function
async function main() {
  try {
    console.log('Starting vendor media path fix...');
    
    // Ensure directories exist
    ensureDirectoriesExist();
    
    // Sync files between directories
    syncVendorMediaFiles();
    
    // Copy specific vendor image
    copySpecificVendorImage();
    
    console.log('Vendor media path fix completed successfully.');
  } catch (error) {
    console.error('Error fixing vendor media paths:', error);
  }
}

// Run the main function
main();