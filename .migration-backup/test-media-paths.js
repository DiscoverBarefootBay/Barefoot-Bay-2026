/**
 * Test script to verify that media files exist in both
 * development (/uploads/{type}/) and production (/{type}/) paths.
 * 
 * Media types checked:
 * - vendor-media
 * - calendar
 * - icons
 * - banner-slides
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define media types to check
const mediaTypes = [
  'vendor-media',
  'calendar',
  'icons',
  'banner-slides'
];

// Main function to check media paths
async function checkMediaPaths() {
  console.log('Checking media paths for development and production environments...\n');
  
  let totalFiles = 0;
  let correctlyMirrored = 0;
  let missingInDevelopment = 0;
  let missingInProduction = 0;
  
  for (const mediaType of mediaTypes) {
    console.log(`\n===== Checking ${mediaType} media =====`);
    
    // Define paths
    const devPath = path.join(process.cwd(), 'uploads', mediaType);
    const prodPath = path.join(process.cwd(), mediaType);
    
    // Create the directories if they don't exist
    if (!fs.existsSync(devPath)) {
      console.log(`Creating development directory: ${devPath}`);
      fs.mkdirSync(devPath, { recursive: true });
    }
    
    if (!fs.existsSync(prodPath)) {
      console.log(`Creating production directory: ${prodPath}`);
      fs.mkdirSync(prodPath, { recursive: true });
    }
    
    // Read files from both directories
    let devFiles = [];
    let prodFiles = [];
    
    try {
      devFiles = fs.readdirSync(devPath);
      console.log(`Found ${devFiles.length} files in development path`);
    } catch (err) {
      console.error(`Error reading development directory: ${err.message}`);
    }
    
    try {
      prodFiles = fs.readdirSync(prodPath);
      console.log(`Found ${prodFiles.length} files in production path`);
    } catch (err) {
      console.error(`Error reading production directory: ${err.message}`);
    }
    
    // Combine files, removing duplicates
    const allFiles = [...new Set([...devFiles, ...prodFiles])];
    totalFiles += allFiles.length;
    
    // Check each file
    for (const file of allFiles) {
      const devFilePath = path.join(devPath, file);
      const prodFilePath = path.join(prodPath, file);
      
      const devExists = fs.existsSync(devFilePath);
      const prodExists = fs.existsSync(prodFilePath);
      
      if (devExists && prodExists) {
        correctlyMirrored++;
        // Check if files are identical
        const devStat = fs.statSync(devFilePath);
        const prodStat = fs.statSync(prodFilePath);
        
        if (devStat.size !== prodStat.size) {
          console.log(`⚠️ File ${file} exists in both locations but differs in size`);
        }
      } else if (devExists && !prodExists) {
        missingInProduction++;
        console.log(`❌ File ${file} exists in development but missing in production`);
        
        // Offer to copy the file to production
        console.log(`   Copying to production path...`);
        try {
          fs.copyFileSync(devFilePath, prodFilePath);
          console.log(`   ✓ Successfully copied to production`);
          correctlyMirrored++;
          missingInProduction--;
        } catch (err) {
          console.error(`   ✗ Error copying to production: ${err.message}`);
        }
      } else if (!devExists && prodExists) {
        missingInDevelopment++;
        console.log(`❌ File ${file} exists in production but missing in development`);
        
        // Offer to copy the file to development
        console.log(`   Copying to development path...`);
        try {
          fs.copyFileSync(prodFilePath, devFilePath);
          console.log(`   ✓ Successfully copied to development`);
          correctlyMirrored++;
          missingInDevelopment--;
        } catch (err) {
          console.error(`   ✗ Error copying to development: ${err.message}`);
        }
      }
    }
  }
  
  // Print summary
  console.log('\n===== Summary =====');
  console.log(`Total files checked: ${totalFiles}`);
  console.log(`Correctly mirrored files: ${correctlyMirrored}`);
  console.log(`Fixed files: ${missingInDevelopment + missingInProduction}`);
  
  if (correctlyMirrored === totalFiles) {
    console.log('\n✅ All files are correctly mirrored!');
  } else {
    console.log('\n⚠️ Some files are still not properly mirrored.');
  }
}

// Run the check
checkMediaPaths().catch(err => {
  console.error('Error running media path check:', err);
});