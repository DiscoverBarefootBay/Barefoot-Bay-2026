/**
 * Banner Slides Cache Test Script
 * 
 * This script helps test and verify that banner slides are properly stored in Object Storage
 * and accessible through the storage proxy. It's useful for debugging issues with banner slides
 * not appearing or showing broken images.
 * 
 * Usage:
 * node scripts/banner-slides-cache-test.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { db } from './db-client.js';
import { objectStorage } from '../server/object-storage-init.js';

// Use Node's import.meta.url to get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SERVER_PORT = process.env.PORT || 5000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const STORAGE_URL = 'https://object-storage.replit.app';
const STORAGE_BUCKET = 'DEFAULT';
const STORAGE_PREFIX = 'banner-slides';
const LOCAL_BANNER_DIR = path.join(__dirname, '..', 'banner-slides');
const UPLOADS_BANNER_DIR = path.join(__dirname, '..', 'uploads', 'banner-slides');

async function main() {
  console.log('Banner Slides Cache Test Script');
  console.log('==============================');
  
  // 1. Test local directories
  console.log('\n1. Checking local banner slide directories...');
  const localBannerExists = fs.existsSync(LOCAL_BANNER_DIR);
  const uploadsBannerExists = fs.existsSync(UPLOADS_BANNER_DIR);
  
  console.log(`  - /banner-slides directory: ${localBannerExists ? 'EXISTS' : 'MISSING'}`);
  console.log(`  - /uploads/banner-slides directory: ${uploadsBannerExists ? 'EXISTS' : 'MISSING'}`);
  
  // Create directories if they don't exist
  if (!localBannerExists) {
    console.log('  - Creating /banner-slides directory');
    fs.mkdirSync(LOCAL_BANNER_DIR, { recursive: true });
  }
  if (!uploadsBannerExists) {
    console.log('  - Creating /uploads/banner-slides directory');
    fs.mkdirSync(UPLOADS_BANNER_DIR, { recursive: true });
  }
  
  // 2. Get banner slides from database
  console.log('\n2. Fetching banner slides configuration from database...');
  const bannerConfig = await getBannerConfigFromDB();
  
  if (!bannerConfig || !bannerConfig.slides || bannerConfig.slides.length === 0) {
    console.log('  - No banner slides found in database');
    return;
  }
  
  console.log(`  - Found ${bannerConfig.slides.length} banner slides in database`);
  
  // 3. Check each banner slide
  console.log('\n3. Checking each banner slide...');
  for (let i = 0; i < bannerConfig.slides.length; i++) {
    const slide = bannerConfig.slides[i];
    const slideType = slide.type || 'image';
    const mediaUrl = slideType === 'image' ? slide.imageUrl : slide.videoUrl;
    const mediaType = slideType === 'image' ? 'Image' : 'Video';
    
    console.log(`\n  Slide ${i+1} (${mediaType}): ${mediaUrl}`);
    
    // 3.1 Check if it's an Object Storage URL
    if (mediaUrl.includes('object-storage.replit.app')) {
      // Parse storage URL to get key
      const parts = mediaUrl.split('object-storage.replit.app/')[1].split('/');
      const bucket = parts[0];
      const key = parts.slice(1).join('/');
      
      console.log(`  - Object Storage URL detected`);
      console.log(`    Bucket: ${bucket}`);
      console.log(`    Key: ${key}`);
      
      // 3.1.1 Test if file exists in Object Storage
      console.log('    Testing Object Storage access...');
      try {
        const exists = await objectStorage.exists(`${bucket}/${key}`);
        console.log(`    Exists in Object Storage: ${exists ? 'YES' : 'NO'}`);
        
        if (exists) {
          // 3.1.2 Test proxy access
          const proxyUrl = `${SERVER_URL}/api/storage-proxy/${bucket}/${key}`;
          console.log(`    Testing storage proxy: ${proxyUrl}`);
          try {
            const proxyResponse = await fetch(proxyUrl);
            console.log(`    Proxy response: ${proxyResponse.status} ${proxyResponse.statusText}`);
            
            // If proxy fails but file exists in storage, copy locally for fallback
            if (!proxyResponse.ok) {
              console.log('    Proxy access failed, creating local copy for fallback...');
              const fileName = path.basename(key);
              const buffer = await objectStorage.getFile(`${bucket}/${key}`);
              
              if (buffer) {
                const localPath = path.join(LOCAL_BANNER_DIR, fileName);
                const uploadsPath = path.join(UPLOADS_BANNER_DIR, fileName);
                
                fs.writeFileSync(localPath, buffer);
                fs.writeFileSync(uploadsPath, buffer);
                
                console.log(`    Created local copies at:`);
                console.log(`    - ${localPath}`);
                console.log(`    - ${uploadsPath}`);
              }
            }
          } catch (proxyError) {
            console.error(`    Error testing proxy: ${proxyError.message}`);
          }
        } else {
          console.log('    File not found in Object Storage!');
        }
      } catch (storageError) {
        console.error(`    Error checking Object Storage: ${storageError.message}`);
      }
    } 
    // 3.2 Local file path
    else {
      console.log(`  - Local file path detected`);
      
      // 3.2.1 Check if file exists locally
      const fileName = path.basename(mediaUrl);
      const possiblePaths = [
        mediaUrl.startsWith('/') ? path.join(__dirname, '..', mediaUrl.slice(1)) : path.join(__dirname, '..', mediaUrl),
        path.join(LOCAL_BANNER_DIR, fileName),
        path.join(UPLOADS_BANNER_DIR, fileName)
      ];
      
      let fileExists = false;
      let existingPath = null;
      
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          fileExists = true;
          existingPath = testPath;
          break;
        }
      }
      
      console.log(`    File exists locally: ${fileExists ? 'YES' : 'NO'}`);
      if (fileExists) {
        console.log(`    Path: ${existingPath}`);
        
        // 3.2.2 Check if it exists in Object Storage
        const storageKey = `${STORAGE_BUCKET}/${STORAGE_PREFIX}/${fileName}`;
        console.log(`    Checking if file exists in Object Storage as ${storageKey}...`);
        
        try {
          const exists = await objectStorage.exists(storageKey);
          console.log(`    Exists in Object Storage: ${exists ? 'YES' : 'NO'}`);
          
          // 3.2.3 Upload to Object Storage if missing
          if (!exists) {
            console.log('    File missing from Object Storage, uploading...');
            try {
              const buffer = fs.readFileSync(existingPath);
              await objectStorage.uploadFromBuffer(buffer, storageKey);
              const objectStorageUrl = `${STORAGE_URL}/${storageKey}`;
              
              console.log(`    Successfully uploaded to Object Storage!`);
              console.log(`    New URL: ${objectStorageUrl}`);
              
              // 3.2.4 Update the database with the new URL
              if (slideType === 'image') {
                slide.imageUrl = objectStorageUrl;
              } else {
                slide.videoUrl = objectStorageUrl;
              }
              console.log('    Database will be updated with the new URL');
            } catch (uploadError) {
              console.error(`    Error uploading to Object Storage: ${uploadError.message}`);
            }
          }
        } catch (storageCheckError) {
          console.error(`    Error checking Object Storage: ${storageCheckError.message}`);
        }
      } else {
        console.log('    Warning: File not found locally!');
      }
    }
  }
  
  // 4. Update banner slides in database if needed
  if (bannerConfig.needsUpdate) {
    console.log('\n4. Updating banner slides in database...');
    try {
      await updateBannerConfigInDB(bannerConfig);
      console.log('  - Database successfully updated with new Object Storage URLs');
    } catch (updateError) {
      console.error(`  - Error updating database: ${updateError.message}`);
    }
  } else {
    console.log('\n4. No database updates needed');
  }
  
  console.log('\nBanner Slides Cache Test Complete!');
}

/**
 * Get banner configuration from database
 */
async function getBannerConfigFromDB() {
  try {
    const result = await db.query(
      `SELECT content FROM page_contents WHERE slug = 'banner-slides' LIMIT 1`
    );
    
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    
    const content = result.rows[0].content;
    
    // Parse the content (might be a string or already an object)
    const parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
    
    // Add flag to track if we need to update the database
    parsedContent.needsUpdate = false;
    
    return parsedContent;
  } catch (error) {
    console.error('Error getting banner config from database:', error);
    return null;
  }
}

/**
 * Update banner configuration in database
 */
async function updateBannerConfigInDB(config) {
  try {
    // Remove the needsUpdate flag before storing
    const { needsUpdate, ...contentToStore } = config;
    
    // Convert to JSON string if necessary
    const contentJson = typeof contentToStore === 'string' 
      ? contentToStore 
      : JSON.stringify(contentToStore);
    
    await db.query(
      `UPDATE page_contents SET content = $1 WHERE slug = 'banner-slides'`,
      [contentJson]
    );
    
    return true;
  } catch (error) {
    console.error('Error updating banner config in database:', error);
    throw error;
  }
}

// Run the script
main().catch(error => {
  console.error('Script error:', error);
}).finally(() => {
  // Close database connection
  db.end();
});