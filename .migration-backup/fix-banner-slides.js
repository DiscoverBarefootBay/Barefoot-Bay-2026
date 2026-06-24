/**
 * Script to fix banner slides by ensuring they exist in both locations
 * 
 * This script scans for banner slide files in both /uploads/banner-slides/
 * and /banner-slides/ directories, ensuring each file exists in both places.
 * If a file is missing from one location, it is copied from the other.
 * 
 * Usage:
 * node fix-banner-slides.js
 */

import fs from 'fs';
import path from 'path';

// Configuration
const BANNER_SLIDES_DIR = 'banner-slides';
const UPLOADS_PREFIX = 'uploads';
const UPLOADS_DIR = path.join(UPLOADS_PREFIX, BANNER_SLIDES_DIR);

// Statistics
let stats = {
  scanned: 0,
  alreadySynced: 0,
  fixedByMovingToUploads: 0,
  fixedByMovingToProd: 0,
  failures: 0,
  missing: 0
};

/**
 * Create directory if it doesn't exist
 * @param {string} dirPath - Path to directory
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }
  return false;
}

/**
 * Verify a banner slide exists in both locations
 * @param {string} filename - Filename of the banner slide
 * @returns {Object} Object with exists flags for uploads and production paths
 */
function verifyBannerSlideExists(filename) {
  const uploadsPath = path.resolve(UPLOADS_DIR, filename);
  const prodPath = path.resolve(BANNER_SLIDES_DIR, filename);
  
  const uploadsExists = fs.existsSync(uploadsPath);
  const prodExists = fs.existsSync(prodPath);
  
  return {
    uploadsExists,
    prodExists,
    uploadsPath,
    prodPath
  };
}

/**
 * Synchronize a banner slide between directories
 * @param {string} filename - Filename of the banner slide
 * @returns {boolean} True if sync was successful, false otherwise
 */
function syncBannerSlide(filename) {
  try {
    const { uploadsExists, prodExists, uploadsPath, prodPath } = verifyBannerSlideExists(filename);
    
    stats.scanned++;
    
    if (uploadsExists && prodExists) {
      const uploadsStats = fs.statSync(uploadsPath);
      const prodStats = fs.statSync(prodPath);
      
      // Both exist but may have different sizes
      if (uploadsStats.size !== prodStats.size) {
        // Use the larger file
        if (uploadsStats.size > prodStats.size) {
          console.log(`Updating production copy with larger uploads copy: ${filename}`);
          fs.copyFileSync(uploadsPath, prodPath);
          stats.fixedByMovingToProd++;
          return true;
        } else {
          console.log(`Updating uploads copy with larger production copy: ${filename}`);
          fs.copyFileSync(prodPath, uploadsPath);
          stats.fixedByMovingToUploads++;
          return true;
        }
      }
      
      console.log(`✓ ${filename} already exists in both locations with same size.`);
      stats.alreadySynced++;
      return true;
    }
    
    // Missing from uploads but exists in production
    if (!uploadsExists && prodExists) {
      console.log(`Copying from production to uploads: ${filename}`);
      ensureDirectoryExists(path.dirname(uploadsPath));
      fs.copyFileSync(prodPath, uploadsPath);
      stats.fixedByMovingToUploads++;
      return fs.existsSync(uploadsPath);
    }
    
    // Missing from production but exists in uploads
    if (uploadsExists && !prodExists) {
      console.log(`Copying from uploads to production: ${filename}`);
      ensureDirectoryExists(path.dirname(prodPath));
      fs.copyFileSync(uploadsPath, prodPath);
      stats.fixedByMovingToProd++;
      return fs.existsSync(prodPath);
    }
    
    // Missing from both locations
    if (!uploadsExists && !prodExists) {
      console.error(`❌ Error: ${filename} is missing from both locations.`);
      stats.missing++;
      return false;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error syncing ${filename}:`, error);
    stats.failures++;
    return false;
  }
}

/**
 * Main function to fix all banner slides
 */
function fixBannerSlides() {
  console.log('Starting banner slides fix process...');
  
  // Ensure both directories exist
  ensureDirectoryExists(UPLOADS_DIR);
  ensureDirectoryExists(BANNER_SLIDES_DIR);
  
  // Get all files from both directories
  let uploadsFiles = [];
  let prodFiles = [];
  
  try {
    uploadsFiles = fs.readdirSync(UPLOADS_DIR);
    console.log(`Found ${uploadsFiles.length} files in uploads/${BANNER_SLIDES_DIR}`);
  } catch (error) {
    console.error(`Error reading uploads directory: ${error.message}`);
  }
  
  try {
    prodFiles = fs.readdirSync(BANNER_SLIDES_DIR);
    console.log(`Found ${prodFiles.length} files in ${BANNER_SLIDES_DIR}`);
  } catch (error) {
    console.error(`Error reading production directory: ${error.message}`);
  }
  
  // Combine all unique filenames
  const allFiles = [...new Set([...uploadsFiles, ...prodFiles])];
  console.log(`Total unique files: ${allFiles.length}`);
  
  // Process each file
  console.log('Syncing files between directories...\n');
  
  for (const filename of allFiles) {
    syncBannerSlide(filename);
  }
  
  // Print summary
  console.log('\nFix process completed.');
  console.log('Summary:');
  console.log(`- Total files scanned: ${stats.scanned}`);
  console.log(`- Already in sync: ${stats.alreadySynced}`);
  console.log(`- Fixed by copying to uploads: ${stats.fixedByMovingToUploads}`);
  console.log(`- Fixed by copying to production: ${stats.fixedByMovingToProd}`);
  console.log(`- Failed to fix: ${stats.failures}`);
  console.log(`- Missing from both locations: ${stats.missing}`);
}

// Run the script
fixBannerSlides();