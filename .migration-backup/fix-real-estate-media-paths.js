/**
 * Fix real estate media path issues by ensuring files are accessible 
 * from both /uploads/real-estate-media and /real-estate-media paths
 * 
 * This script:
 * 1. Scans all files in the /real-estate-media directory
 * 2. Creates corresponding files in the /uploads/real-estate-media directory
 * 3. Ensures that images are accessible from both locations
 * 
 * Usage:
 * node fix-real-estate-media-paths.js
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
  const realEstateMediaDir = path.join(process.cwd(), 'real-estate-media');
  const uploadsRealEstateMediaDir = path.join(process.cwd(), 'uploads', 'real-estate-media');
  
  if (!fs.existsSync(realEstateMediaDir)) {
    console.log(`Creating directory: ${realEstateMediaDir}`);
    fs.mkdirSync(realEstateMediaDir, { recursive: true });
  }
  
  if (!fs.existsSync(uploadsRealEstateMediaDir)) {
    console.log(`Creating directory: ${uploadsRealEstateMediaDir}`);
    fs.mkdirSync(uploadsRealEstateMediaDir, { recursive: true });
  }
  
  return { realEstateMediaDir, uploadsRealEstateMediaDir };
}

async function mirrorFiles(realEstateMediaDir, uploadsRealEstateMediaDir) {
  console.log('Mirroring files between real-estate-media directories...');
  
  try {
    // First, copy from real-estate-media to uploads/real-estate-media
    const realEstateMediaFiles = fs.readdirSync(realEstateMediaDir);
    console.log(`Found ${realEstateMediaFiles.length} files in real-estate-media`);
    
    for (const file of realEstateMediaFiles) {
      const sourcePath = path.join(realEstateMediaDir, file);
      const destPath = path.join(uploadsRealEstateMediaDir, file);
      
      // Skip directories and only copy files
      if (fs.statSync(sourcePath).isFile()) {
        console.log(`Copying: ${sourcePath} -> ${destPath}`);
        fs.copyFileSync(sourcePath, destPath);
      }
    }
    
    // Then, copy from uploads/real-estate-media to real-estate-media (if any files are different)
    const uploadsRealEstateMediaFiles = fs.readdirSync(uploadsRealEstateMediaDir);
    console.log(`Found ${uploadsRealEstateMediaFiles.length} files in uploads/real-estate-media`);
    
    for (const file of uploadsRealEstateMediaFiles) {
      const sourcePath = path.join(uploadsRealEstateMediaDir, file);
      const destPath = path.join(realEstateMediaDir, file);
      
      // Skip directories and only copy files that don't exist in real-estate-media
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

// Create a default property image if none exists
async function createDefaultPropertyImage(realEstateMediaDir, uploadsRealEstateMediaDir) {
  console.log('Checking for default property image...');
  
  const defaultImageName = 'default-property.jpg';
  const realEstateMediaPath = path.join(realEstateMediaDir, defaultImageName);
  const uploadsRealEstateMediaPath = path.join(uploadsRealEstateMediaDir, defaultImageName);
  
  // Check if the default image exists in either location
  const existsInRealEstateMedia = fs.existsSync(realEstateMediaPath);
  const existsInUploadsRealEstateMedia = fs.existsSync(uploadsRealEstateMediaPath);
  
  if (existsInRealEstateMedia || existsInUploadsRealEstateMedia) {
    console.log('Default property image exists, ensuring it exists in both locations');
    
    if (existsInRealEstateMedia && !existsInUploadsRealEstateMedia) {
      console.log('Copying default image from real-estate-media to uploads/real-estate-media');
      fs.copyFileSync(realEstateMediaPath, uploadsRealEstateMediaPath);
    } else if (!existsInRealEstateMedia && existsInUploadsRealEstateMedia) {
      console.log('Copying default image from uploads/real-estate-media to real-estate-media');
      fs.copyFileSync(uploadsRealEstateMediaPath, realEstateMediaPath);
    }
  } else {
    console.warn('Default property image does not exist in either location!');
    console.log('You might want to create a default image for property listings.');
  }
}

async function main() {
  console.log('Starting real-estate-media path fix...');
  
  // Ensure required directories exist
  const { realEstateMediaDir, uploadsRealEstateMediaDir } = ensureDirectoriesExist();
  
  // Mirror files between real-estate-media and uploads/real-estate-media
  await mirrorFiles(realEstateMediaDir, uploadsRealEstateMediaDir);
  
  // Ensure default property image exists in both locations
  await createDefaultPropertyImage(realEstateMediaDir, uploadsRealEstateMediaDir);
  
  console.log('Real estate media path fix completed successfully.');
}

// Run the main function
main().catch(err => {
  console.error('Error executing script:', err);
  process.exit(1);
});