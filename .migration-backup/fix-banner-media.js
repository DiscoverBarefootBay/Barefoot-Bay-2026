/**
 * Script to check for and fix corrupted banner image files
 * 
 * This script:
 * 1. Scans all banner image files in both /uploads/banner-slides/ and /banner-slides/
 * 2. Identifies corrupted files (tiny file size or incorrect MIME type)
 * 3. Replaces corrupted files with a placeholder image
 * 4. Creates symlinks to ensure files exist in both locations
 * 
 * Usage:
 * node fix-banner-media.js
 */

// Import required modules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promises as fsPromises } from 'fs';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define paths
const uploadsDir = path.join(__dirname, 'uploads/banner-slides');
const productionDir = path.join(__dirname, 'banner-slides');
const placeholderPath = path.join(__dirname, 'public/banner-placeholder.jpg');

// Ensure the directories exist
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Check if a file is corrupted (too small or wrong header)
async function isFileCorrupted(filePath) {
  try {
    // Get file stats
    const stats = await fsPromises.stat(filePath);
    
    // Check file size - if less than 100 bytes, it's likely corrupted
    if (stats.size < 100) {
      console.log(`Potentially corrupted file detected: ${filePath} (size: ${stats.size} bytes)`);
      return true;
    }
    
    // Read file header to check for proper image format
    const buffer = Buffer.alloc(8);
    const fileHandle = await fsPromises.open(filePath, 'r');
    await fileHandle.read(buffer, 0, 8, 0);
    await fileHandle.close();
    
    // Check for valid image headers
    const hexHeader = buffer.toString('hex', 0, 8).toLowerCase();
    
    // JPEG header (starts with FF D8 FF)
    const isJpeg = hexHeader.startsWith('ffd8ff');
    
    // PNG header (89 50 4E 47 0D 0A 1A 0A)
    const isPng = hexHeader === '89504e470d0a1a0a';
    
    // Check for mismatch between extension and actual format
    const extension = path.extname(filePath).toLowerCase();
    
    if (extension === '.jpg' || extension === '.jpeg') {
      if (!isJpeg) {
        console.log(`Format mismatch for ${filePath}: Has .jpg extension but not a JPEG file`);
        return true;
      }
    } else if (extension === '.png') {
      if (!isPng) {
        console.log(`Format mismatch for ${filePath}: Has .png extension but not a PNG file`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking file ${filePath}:`, error);
    return true; // Assume corrupted if we can't read it
  }
}

// Fix a corrupted file by replacing it with the placeholder
async function fixCorruptedFile(filePath) {
  try {
    console.log(`Fixing corrupted file: ${filePath}`);
    
    // First make a backup of the original file with .bak extension
    const backupPath = `${filePath}.bak`;
    await fsPromises.copyFile(filePath, backupPath);
    console.log(`Created backup at ${backupPath}`);
    
    // Then replace with the placeholder
    await fsPromises.copyFile(placeholderPath, filePath);
    console.log(`Replaced with placeholder image`);
    
    return true;
  } catch (error) {
    console.error(`Error fixing file ${filePath}:`, error);
    return false;
  }
}

// Ensure file exists in both locations
async function ensureFileInBothLocations(filename) {
  const uploadsPath = path.join(uploadsDir, filename);
  const productionPath = path.join(productionDir, filename);
  
  // Check which location has a valid file
  const uploadsExists = fs.existsSync(uploadsPath);
  const productionExists = fs.existsSync(productionPath);
  
  if (uploadsExists && !productionExists) {
    // Copy from uploads to production
    console.log(`Copying file from ${uploadsPath} to ${productionPath}`);
    await fsPromises.copyFile(uploadsPath, productionPath);
  } else if (!uploadsExists && productionExists) {
    // Copy from production to uploads
    console.log(`Copying file from ${productionPath} to ${uploadsPath}`);
    await fsPromises.copyFile(productionPath, uploadsPath);
  } else if (!uploadsExists && !productionExists) {
    // Neither exists, create both using placeholder
    console.log(`Creating file in both locations: ${filename}`);
    await fsPromises.copyFile(placeholderPath, uploadsPath);
    await fsPromises.copyFile(placeholderPath, productionPath);
  }
}

// Main function
async function main() {
  try {
    console.log('Starting banner media file verification and repair...');
    
    // Ensure directories exist
    ensureDirectoryExists(uploadsDir);
    ensureDirectoryExists(productionDir);
    
    // Check if placeholder exists
    if (!fs.existsSync(placeholderPath)) {
      console.error(`Placeholder image not found at ${placeholderPath}`);
      console.log('Please ensure a placeholder image exists before continuing.');
      return;
    }
    
    // Get all banner files from both locations
    console.log('Scanning banner slide directories...');
    
    const uploadsFiles = fs.existsSync(uploadsDir) 
      ? fs.readdirSync(uploadsDir).filter(f => f.match(/\.(jpg|jpeg|png|gif)$/i))
      : [];
      
    const productionFiles = fs.existsSync(productionDir)
      ? fs.readdirSync(productionDir).filter(f => f.match(/\.(jpg|jpeg|png|gif)$/i))
      : [];
    
    // Create a unique set of all filenames
    const allFiles = new Set([...uploadsFiles, ...productionFiles]);
    console.log(`Found ${allFiles.size} unique banner image files`);
    
    // Check both locations for corrupted files
    let corruptedCount = 0;
    let fixedCount = 0;
    
    // Process uploads directory
    console.log('\nChecking uploads directory files...');
    for (const file of uploadsFiles) {
      const filePath = path.join(uploadsDir, file);
      
      if (await isFileCorrupted(filePath)) {
        corruptedCount++;
        if (await fixCorruptedFile(filePath)) {
          fixedCount++;
        }
      }
    }
    
    // Process production directory
    console.log('\nChecking production directory files...');
    for (const file of productionFiles) {
      const filePath = path.join(productionDir, file);
      
      if (await isFileCorrupted(filePath)) {
        corruptedCount++;
        if (await fixCorruptedFile(filePath)) {
          fixedCount++;
        }
      }
    }
    
    // Ensure all files exist in both locations
    console.log('\nEnsuring files exist in both locations...');
    for (const file of allFiles) {
      await ensureFileInBothLocations(file);
    }
    
    console.log('\nBanner media verification and repair completed:');
    console.log(`- ${allFiles.size} unique banner files found`);
    console.log(`- ${corruptedCount} corrupted files detected`);
    console.log(`- ${fixedCount} files fixed with placeholder`);
    console.log(`- All files now exist in both /uploads/banner-slides/ and /banner-slides/ locations`);
    
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// Run the main function
main();