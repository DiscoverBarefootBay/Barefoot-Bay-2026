#!/usr/bin/env node

/**
 * Copy Touch Icons Script
 * 
 * This script copies touch icon files from /public/ to /dist/public/ 
 * after the Vite build process to ensure they're available in production.
 * 
 * This is a workaround for the Vite config being protected.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.join(__dirname, 'public');
const targetDir = path.join(__dirname, 'dist', 'public');

// Touch icon files to copy
const touchIconFiles = [
  'apple-touch-icon.png',
  'apple-touch-icon-57x57.png',
  'apple-touch-icon-60x60.png',
  'apple-touch-icon-72x72.png',
  'apple-touch-icon-76x76.png',
  'apple-touch-icon-114x114.png',
  'apple-touch-icon-120x120.png',
  'apple-touch-icon-144x144.png',
  'apple-touch-icon-152x152.png',
  'apple-touch-icon-180x180.png',
  'apple-touch-icon-precomposed.png',
];

// Favicon files to copy
const faviconFiles = [
  'favicon/favicon.ico',
  'favicon/favicon-16x16.png',
  'favicon/favicon-32x32.png',
  'favicon/favicon-48x48.png',
  'favicon/favicon-180x180.png',
];

// PWA icon files to copy
const pwaIconFiles = [
  'icons/icon-192.png',
  'icons/icon-512.png',
];

async function copyTouchIcons() {
  console.log('🔄 Copying touch icons to production build...');
  
  // Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    console.log(`❌ Target directory ${targetDir} does not exist`);
    console.log('❌ Please run "npm run build" first');
    process.exit(1);
  }

  let copiedCount = 0;
  let skippedCount = 0;

  // Copy touch icons
  for (const file of touchIconFiles) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    
    if (fs.existsSync(sourcePath)) {
      try {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✅ Copied: ${file}`);
        copiedCount++;
      } catch (error) {
        console.error(`❌ Error copying ${file}:`, error.message);
      }
    } else {
      console.log(`⚠️  Source file not found: ${file}`);
      skippedCount++;
    }
  }

  // Copy favicon files
  for (const file of faviconFiles) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    
    if (fs.existsSync(sourcePath)) {
      try {
        // Ensure favicon directory exists in target
        const targetFaviconDir = path.join(targetDir, 'favicon');
        if (!fs.existsSync(targetFaviconDir)) {
          fs.mkdirSync(targetFaviconDir, { recursive: true });
        }
        
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✅ Copied: ${file}`);
        copiedCount++;
      } catch (error) {
        console.error(`❌ Error copying ${file}:`, error.message);
      }
    } else {
      console.log(`⚠️  Source file not found: ${file}`);
      skippedCount++;
    }
  }

  // Copy PWA icon files
  for (const file of pwaIconFiles) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    
    if (fs.existsSync(sourcePath)) {
      try {
        // Ensure icons directory exists in target
        const targetIconsDir = path.join(targetDir, 'icons');
        if (!fs.existsSync(targetIconsDir)) {
          fs.mkdirSync(targetIconsDir, { recursive: true });
        }
        
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✅ Copied: ${file}`);
        copiedCount++;
      } catch (error) {
        console.error(`❌ Error copying ${file}:`, error.message);
      }
    } else {
      console.log(`⚠️  Source file not found: ${file}`);
      skippedCount++;
    }
  }

  console.log(`\n📊 Touch Icon Copy Summary:`);
  console.log(`   ✅ Copied: ${copiedCount} files`);
  console.log(`   ⚠️  Skipped: ${skippedCount} files`);
  console.log('🎉 Touch icon copy completed!');
}

// Run the script
copyTouchIcons().catch(error => {
  console.error('❌ Touch icon copy failed:', error);
  process.exit(1);
});