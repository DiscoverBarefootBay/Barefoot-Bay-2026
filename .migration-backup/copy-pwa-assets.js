/**
 * Copy PWA Assets to Production Build
 * 
 * This script manually copies the PWA assets (manifest.json and icon files)
 * to the production build directory to fix Android home screen icon issue.
 */

import fs from 'fs';
import path from 'path';

const sourceDir = path.resolve('./public');
const targetDir = path.resolve('./dist/public');

// PWA files that need to be copied for Android support
const pwaAssets = [
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'bb-homescreen-icon-v2.png',
  'apple-touch-icon.png'
];

async function copyPWAAssets() {
  console.log('🔧 Copying PWA assets for Android support...');
  
  // Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    console.log(`❌ Target directory ${targetDir} does not exist`);
    console.log('❌ Please run "npm run build" first');
    process.exit(1);
  }

  let copiedCount = 0;
  let skippedCount = 0;

  // Copy each PWA asset
  for (const asset of pwaAssets) {
    const sourcePath = path.join(sourceDir, asset);
    const targetPath = path.join(targetDir, asset);
    
    if (fs.existsSync(sourcePath)) {
      try {
        // Ensure target subdirectory exists (for icons folder)
        const targetSubDir = path.dirname(targetPath);
        if (!fs.existsSync(targetSubDir)) {
          fs.mkdirSync(targetSubDir, { recursive: true });
          console.log(`📁 Created directory: ${path.relative(targetDir, targetSubDir)}`);
        }
        
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✅ Copied: ${asset}`);
        copiedCount++;
      } catch (error) {
        console.error(`❌ Error copying ${asset}:`, error.message);
        skippedCount++;
      }
    } else {
      console.log(`⚠️  Source file not found: ${asset}`);
      skippedCount++;
    }
  }

  console.log(`\n📊 PWA Asset Copy Summary:`);
  console.log(`   ✅ Copied: ${copiedCount} files`);
  console.log(`   ⚠️  Skipped: ${skippedCount} files`);
  
  if (copiedCount > 0) {
    console.log('🎉 PWA assets copied successfully!');
    console.log('📱 Android home screen icons should now work properly');
  } else {
    console.log('❌ No PWA assets were copied');
  }
}

// Run the script
copyPWAAssets().catch(error => {
  console.error('❌ PWA asset copy failed:', error);
  process.exit(1);
});