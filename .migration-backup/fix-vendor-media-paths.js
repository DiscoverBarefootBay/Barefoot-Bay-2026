/**
 * Emergency fix for vendor media paths, especially for Dan Hess Antiques
 * 
 * This script:
 * 1. Ensures both /uploads/vendor-media and /vendor-media directories exist
 * 2. Syncs images between both directories
 * 3. Fixes HTML content in database to use proper image paths
 * 4. Creates a symbolic link for consistent access
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';
import { dirname } from 'path';

const { Pool } = pg;
dotenv.config();

// ES modules don't have __dirname, so we need to create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log('Starting vendor media path fix...');
  
  // Ensure directories exist
  const uploadsVendorMediaDir = path.join(process.cwd(), 'uploads', 'vendor-media');
  const vendorMediaDir = path.join(process.cwd(), 'vendor-media');
  
  ensureDirectoryExists(uploadsVendorMediaDir);
  ensureDirectoryExists(vendorMediaDir);
  
  // Sync files between directories
  console.log('Syncing files between directories...');
  
  // First, copy from /uploads/vendor-media to /vendor-media
  const uploadsFiles = fs.readdirSync(uploadsVendorMediaDir);
  for (const file of uploadsFiles) {
    const sourcePath = path.join(uploadsVendorMediaDir, file);
    const destPath = path.join(vendorMediaDir, file);
    
    if (fs.statSync(sourcePath).isFile() && !fs.existsSync(destPath)) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied ${sourcePath} to ${destPath}`);
    }
  }
  
  // Then, copy from /vendor-media to /uploads/vendor-media
  const vendorFiles = fs.readdirSync(vendorMediaDir);
  for (const file of vendorFiles) {
    const sourcePath = path.join(vendorMediaDir, file);
    const destPath = path.join(uploadsVendorMediaDir, file);
    
    if (fs.statSync(sourcePath).isFile() && !fs.existsSync(destPath)) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied ${sourcePath} to ${destPath}`);
    }
  }

  // Special handling for Dan Hess Antiques
  const danHessVariants = [
    'dan-hess-antiques.png',
    'dan-hess-antiques-estate-sales.png', 
    'Screenshot-2025-04-22-at-4.51.55-PM.png',
    'Screenshot 2025-04-22 at 4.51.55 PM.png'
  ];

  // Make sure all Dan Hess image variants exist in both directories
  for (const variant of danHessVariants) {
    // First find if any of these files exist
    let sourceFile = null;
    let sourceDir = null;

    if (fs.existsSync(path.join(uploadsVendorMediaDir, variant))) {
      sourceFile = variant;
      sourceDir = uploadsVendorMediaDir;
    } else if (fs.existsSync(path.join(vendorMediaDir, variant))) {
      sourceFile = variant;
      sourceDir = vendorMediaDir;
    }

    // If we found a source file, copy it to all variants
    if (sourceFile) {
      for (const targetVariant of danHessVariants) {
        if (targetVariant !== sourceFile) {
          fs.copyFileSync(
            path.join(sourceDir, sourceFile),
            path.join(uploadsVendorMediaDir, targetVariant)
          );
          fs.copyFileSync(
            path.join(sourceDir, sourceFile),
            path.join(vendorMediaDir, targetVariant)
          );
          console.log(`Created variant ${targetVariant} in both directories`);
        }
      }
    }
  }

  // Create symbolic link for server route consistency
  if (!fs.existsSync(path.join(process.cwd(), 'uploads', 'vendor-media'))) {
    try {
      // First make sure the uploads directory exists
      ensureDirectoryExists(path.join(process.cwd(), 'uploads'));
      
      // Create relative symlink
      fs.symlinkSync('../vendor-media', path.join(process.cwd(), 'uploads', 'vendor-media'), 'dir');
      console.log('Created symbolic link from /uploads/vendor-media to /vendor-media');
    } catch (err) {
      console.error('Error creating symbolic link:', err);
    }
  }

  console.log('Vendor media path fix completed successfully');
}

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Run the script
main().catch(err => {
  console.error('Error running fix script:', err);
  process.exit(1);
}).finally(() => {
  pool.end();
});