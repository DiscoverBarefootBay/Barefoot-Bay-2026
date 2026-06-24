/**
 * Fix Banner Slides 404 Errors by Completing Object Storage Migration
 * 
 * This script addresses the storage synchronization issue identified in bannerconsole.md
 * by uploading all banner slide files to Object Storage in the BANNER bucket.
 */

import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Object Storage client
const objectStorage = new Client();
const BANNER_BUCKET = 'BANNER';
const STORAGE_PREFIX = 'banner-slides';

// Results tracking
const results = {
  found: [],
  uploaded: [],
  skipped: [],
  errors: [],
  total: 0
};

/**
 * Get content type based on file extension
 */
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime'
  };
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Check if file exists in Object Storage
 */
async function fileExistsInStorage(filename) {
  try {
    const storageKey = `${STORAGE_PREFIX}/${filename}`;
    const result = await objectStorage.downloadAsBytes(storageKey, BANNER_BUCKET);
    return result && result.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Upload file to Object Storage
 */
async function uploadToStorage(filePath, filename) {
  try {
    const buffer = fs.readFileSync(filePath);
    const contentType = getContentType(filename);
    const storageKey = `${STORAGE_PREFIX}/${filename}`;
    
    console.log(`Uploading ${filename} (${buffer.length} bytes) as ${contentType}...`);
    
    const result = await objectStorage.uploadFromBytes(
      storageKey,
      buffer,
      { 'content-type': contentType },
      BANNER_BUCKET
    );
    
    if (result.ok) {
      console.log(`✅ Successfully uploaded: ${filename}`);
      return true;
    } else {
      console.log(`❌ Failed to upload: ${filename}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error uploading ${filename}:`, error.message);
    return false;
  }
}

/**
 * Find all banner image files in various locations
 */
function findBannerFiles() {
  const searchPaths = [
    './banner-slides',
    './uploads/banner-slides',
    './uploads/backups/banner-slides',
    './test-media-backup/banner-slides',
    './test-media-restore/banner-slides'
  ];
  
  const foundFiles = new Map(); // Use Map to avoid duplicates
  
  for (const searchPath of searchPaths) {
    try {
      if (fs.existsSync(searchPath)) {
        console.log(`📂 Scanning: ${searchPath}`);
        
        if (fs.statSync(searchPath).isDirectory()) {
          const files = fs.readdirSync(searchPath);
          
          for (const file of files) {
            if (file.startsWith('bannerImage-')) {
              const fullPath = path.join(searchPath, file);
              const stats = fs.statSync(fullPath);
              
              if (stats.isFile() && stats.size > 0) {
                // Use filename as key to avoid duplicates, keep first found
                if (!foundFiles.has(file)) {
                  foundFiles.set(file, {
                    filename: file,
                    path: fullPath,
                    size: stats.size,
                    location: searchPath
                  });
                  console.log(`  Found: ${file} (${stats.size} bytes)`);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ Error scanning ${searchPath}:`, error.message);
    }
  }
  
  // Also check for files in backup directories recursively
  const backupPaths = [
    './uploads/backups/banner-slides'
  ];
  
  for (const backupPath of backupPaths) {
    try {
      if (fs.existsSync(backupPath)) {
        const backupDirs = fs.readdirSync(backupPath);
        
        for (const backupDir of backupDirs) {
          const fullBackupPath = path.join(backupPath, backupDir);
          if (fs.statSync(fullBackupPath).isDirectory()) {
            console.log(`📂 Scanning backup: ${fullBackupPath}`);
            
            const files = fs.readdirSync(fullBackupPath);
            for (const file of files) {
              if (file.startsWith('bannerImage-')) {
                const fullPath = path.join(fullBackupPath, file);
                const stats = fs.statSync(fullPath);
                
                if (stats.isFile() && stats.size > 0) {
                  if (!foundFiles.has(file)) {
                    foundFiles.set(file, {
                      filename: file,
                      path: fullPath,
                      size: stats.size,
                      location: fullBackupPath
                    });
                    console.log(`  Found in backup: ${file} (${stats.size} bytes)`);
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ Error scanning backup ${backupPath}:`, error.message);
    }
  }
  
  return Array.from(foundFiles.values());
}

/**
 * Get list of required files from database
 */
async function getRequiredFilesFromDatabase() {
  try {
    // Import database connection
    const { db } = await import('./server/db.js');
    
    const result = await db.query(
      `SELECT content FROM page_contents WHERE slug = 'banner-slides'`
    );
    
    if (result.rows.length === 0) {
      console.log('⚠️ No banner slides found in database');
      return [];
    }
    
    const slides = JSON.parse(result.rows[0].content);
    const requiredFiles = [];
    
    for (const slide of slides) {
      if (slide.src) {
        // Extract filename from URL
        const filename = path.basename(slide.src);
        if (filename.startsWith('bannerImage-')) {
          requiredFiles.push(filename);
        }
      }
    }
    
    console.log(`📋 Database requires ${requiredFiles.length} banner files:`, requiredFiles);
    return requiredFiles;
    
  } catch (error) {
    console.error('❌ Error reading database:', error.message);
    return [];
  }
}

/**
 * Main migration function
 */
async function migrateBannerSlides() {
  console.log('🚀 Starting Banner Slides 404 Fix Migration...\n');
  
  // Step 1: Find all available banner files
  console.log('📋 Step 1: Finding all banner slide files...');
  const foundFiles = findBannerFiles();
  results.found = foundFiles;
  results.total = foundFiles.length;
  
  if (foundFiles.length === 0) {
    console.log('❌ No banner slide files found!');
    return results;
  }
  
  console.log(`\n✅ Found ${foundFiles.length} banner slide files\n`);
  
  // Step 2: Get required files from database
  console.log('📋 Step 2: Checking database requirements...');
  const requiredFiles = await getRequiredFilesFromDatabase();
  
  // Step 3: Upload files to Object Storage
  console.log('\n📋 Step 3: Uploading files to Object Storage...');
  
  for (const fileInfo of foundFiles) {
    const { filename, path: filePath, size } = fileInfo;
    
    // Check if file already exists in storage
    const existsInStorage = await fileExistsInStorage(filename);
    
    if (existsInStorage) {
      console.log(`⏭️ Skipping ${filename} (already exists in Object Storage)`);
      results.skipped.push(filename);
      continue;
    }
    
    // Upload the file
    const success = await uploadToStorage(filePath, filename);
    
    if (success) {
      results.uploaded.push(filename);
    } else {
      results.errors.push(filename);
    }
  }
  
  return results;
}

/**
 * Test Object Storage access
 */
async function testObjectStorageAccess() {
  try {
    console.log('🔧 Testing Object Storage access...');
    
    // Try to list the banner-slides directory
    const listResult = await objectStorage.list(`${STORAGE_PREFIX}/`, BANNER_BUCKET);
    
    if (listResult.ok) {
      const files = listResult.value || [];
      console.log(`✅ Object Storage accessible. Found ${files.length} files in BANNER/${STORAGE_PREFIX}/`);
      
      if (files.length > 0) {
        console.log('📁 Existing files:', files.slice(0, 5).map(f => f.name));
      }
      
      return true;
    } else {
      console.log('⚠️ Object Storage list failed:', listResult.error);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Object Storage test failed:', error.message);
    return false;
  }
}

/**
 * Print migration results
 */
function printResults(results) {
  console.log('\n🎯 Migration Results:');
  console.log('═══════════════════════════════════════');
  console.log(`📁 Files found: ${results.found.length}`);
  console.log(`✅ Successfully uploaded: ${results.uploaded.length}`);
  console.log(`⏭️ Already existed (skipped): ${results.skipped.length}`);
  console.log(`❌ Failed uploads: ${results.errors.length}`);
  
  if (results.uploaded.length > 0) {
    console.log('\n✅ Newly uploaded files:');
    results.uploaded.forEach(file => console.log(`  - ${file}`));
  }
  
  if (results.skipped.length > 0) {
    console.log('\n⏭️ Skipped files (already in storage):');
    results.skipped.forEach(file => console.log(`  - ${file}`));
  }
  
  if (results.errors.length > 0) {
    console.log('\n❌ Failed uploads:');
    results.errors.forEach(file => console.log(`  - ${file}`));
  }
  
  const totalProcessed = results.uploaded.length + results.skipped.length;
  if (totalProcessed === results.found.length && results.errors.length === 0) {
    console.log('\n🎉 Migration completed successfully!');
    console.log('The 404 errors should now be resolved.');
  } else if (totalProcessed > 0) {
    console.log('\n✅ Migration partially completed.');
    console.log('Some files were processed successfully.');
  } else {
    console.log('\n⚠️ Migration had issues.');
    console.log('Please check the errors above.');
  }
}

// Run the migration
async function main() {
  try {
    // Test Object Storage access first
    const storageOk = await testObjectStorageAccess();
    
    if (!storageOk) {
      console.log('❌ Cannot access Object Storage. Please check your configuration.');
      return;
    }
    
    // Run the migration
    const results = await migrateBannerSlides();
    
    // Print results
    printResults(results);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

main();