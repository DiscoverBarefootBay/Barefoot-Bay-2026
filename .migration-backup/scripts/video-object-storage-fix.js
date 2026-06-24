/**
 * Video Object Storage Fix Script
 * 
 * This script identifies video files in banner slides and ensures they are properly
 * stored in Object Storage with correct local fallbacks. It helps address 
 * video playback issues by verifying files exist in both Object Storage and locally.
 * 
 * Usage:
 * node scripts/video-object-storage-fix.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { db } from './db-client.js';
import { objectStorageService } from '../server/object-storage-service.js';

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

// Media directories
const MEDIA_DIR = path.join(__dirname, '..', 'media');
const PUBLIC_MEDIA_DIR = path.join(__dirname, '..', 'public', 'media');

// Video extensions to check
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogg'];

async function main() {
  console.log('Video Object Storage Fix Script');
  console.log('==============================');
  
  // 1. Create directories if they don't exist
  console.log('\n1. Checking and creating directories...');
  ensureDirectoriesExist();
  
  // 2. Get banner slides from database
  console.log('\n2. Fetching banner slides from database...');
  const bannerConfig = await getBannerConfigFromDB();
  
  if (!bannerConfig || !bannerConfig.slides || bannerConfig.slides.length === 0) {
    console.log('  - No banner slides found in database');
    return;
  }
  
  console.log(`  - Found ${bannerConfig.slides.length} banner slides in database`);
  
  // 3. Process video files
  console.log('\n3. Processing video files in banner slides...');
  let needsUpdate = false;
  
  for (let i = 0; i < bannerConfig.slides.length; i++) {
    const slide = bannerConfig.slides[i];
    
    // Skip non-video slides
    if (slide.mediaType !== 'video' && !slide.videoUrl) {
      continue;
    }
    
    const videoUrl = slide.videoUrl || (slide.mediaType === 'video' ? slide.src : null);
    if (!videoUrl) {
      console.log(`  Slide ${i+1}: No video URL found, skipping`);
      continue;
    }
    
    console.log(`\n  Slide ${i+1} (Video): ${videoUrl}`);
    
    // Process the video
    const result = await processVideo(videoUrl);
    
    // Update slide data if needed
    if (result.updated) {
      needsUpdate = true;
      
      if (slide.mediaType === 'video') {
        slide.src = result.objectStorageUrl;
        slide.fallbackSrc = result.localPath;
        console.log(`  - Updated slide src to: ${slide.src}`);
        console.log(`  - Updated slide fallbackSrc to: ${slide.fallbackSrc}`);
      } else if (slide.videoUrl) {
        slide.videoUrl = result.objectStorageUrl;
        slide.videoFallbackSrc = result.localPath;
        console.log(`  - Updated slide videoUrl to: ${slide.videoUrl}`);
        console.log(`  - Updated slide videoFallbackSrc to: ${slide.videoFallbackSrc}`);
      }
    }
  }
  
  // 4. Update banner slides in database if needed
  if (needsUpdate) {
    console.log('\n4. Updating banner slides in database...');
    try {
      bannerConfig.needsUpdate = true;
      await updateBannerConfigInDB(bannerConfig);
      console.log('  - Database successfully updated with new video URLs');
    } catch (updateError) {
      console.error(`  - Error updating database: ${updateError.message}`);
    }
  } else {
    console.log('\n4. No database updates needed');
  }
  
  // 5. Check and fix additional video files on disk
  console.log('\n5. Checking for additional video files on disk...');
  await processAdditionalVideos();
  
  console.log('\nVideo Object Storage Fix Complete!');
}

/**
 * Ensure all required directories exist
 */
function ensureDirectoriesExist() {
  const dirs = [
    LOCAL_BANNER_DIR,
    UPLOADS_BANNER_DIR,
    MEDIA_DIR,
    PUBLIC_MEDIA_DIR
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      console.log(`  - Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    } else {
      console.log(`  - Directory exists: ${dir}`);
    }
  }
}

/**
 * Process a video file to ensure it's in Object Storage and has local fallbacks
 * @param {string} videoUrl - The URL of the video
 * @returns {Promise<Object>} Result of the processing
 */
async function processVideo(videoUrl) {
  const result = {
    updated: false,
    objectStorageUrl: videoUrl,
    localPath: '',
    buffer: null
  };
  
  try {
    // Extract filename
    const filename = path.basename(videoUrl.split('?')[0]); // Remove query params if any
    
    // Set local path
    result.localPath = `/banner-slides/${filename}`;
    
    // If it's already an Object Storage URL, verify it exists there
    if (videoUrl.includes('object-storage.replit.app')) {
      console.log(`  - URL is already using Object Storage: ${videoUrl}`);
      
      // Extract the bucket and key from the URL
      const urlParts = videoUrl.split('object-storage.replit.app/');
      if (urlParts.length > 1) {
        const parts = urlParts[1].split('/');
        if (parts.length >= 2) {
          const bucket = parts[0];
          const objectPath = parts.slice(1).join('/');
          const storageKey = `${bucket}/${objectPath}`;
          
          console.log(`  - Checking if file exists in Object Storage as ${storageKey}`);
          
          // Check if file exists in Object Storage
          const exists = await objectStorageService.fileExists(storageKey);
          console.log(`  - Exists in Object Storage: ${exists ? 'YES' : 'NO'}`);
          
          // If not in Object Storage but we have it locally, upload it
          if (!exists) {
            let localBuffer = await findLocalCopy(filename);
            
            if (localBuffer) {
              console.log('  - Found local copy, uploading to Object Storage');
              await objectStorageService.uploadData(localBuffer, 'banner-slides', filename);
              console.log('  - Successfully uploaded to Object Storage');
              result.buffer = localBuffer;
            } else {
              console.log('  - No local copy found for upload to Object Storage');
            }
          } else {
            // If it's in Object Storage, download it to make sure we have a local copy
            console.log('  - Downloading from Object Storage for local fallback');
            const buffer = await objectStorageService.getFile(storageKey);
            
            if (buffer) {
              result.buffer = buffer;
              console.log('  - Successfully downloaded from Object Storage');
            } else {
              console.log('  - Failed to download from Object Storage');
            }
          }
        }
      }
    }
    // If it's a local path, ensure it's in Object Storage
    else {
      console.log(`  - URL is using local storage: ${videoUrl}`);
      
      // Find a local copy of the file
      let localBuffer = await findLocalCopy(filename);
      
      if (localBuffer) {
        console.log('  - Found local copy, uploading to Object Storage if needed');
        
        // Define storage key in default bucket
        const storageKey = `${STORAGE_BUCKET}/${STORAGE_PREFIX}/${filename}`;
        
        // Check if already in Object Storage
        const exists = await objectStorageService.fileExists(storageKey);
        console.log(`  - Exists in Object Storage: ${exists ? 'YES' : 'NO'}`);
        
        if (!exists) {
          // Upload to Object Storage
          await objectStorageService.uploadData(localBuffer, 'banner-slides', filename);
          console.log('  - Successfully uploaded to Object Storage');
        }
        
        // Update result with Object Storage URL
        result.objectStorageUrl = `${STORAGE_URL}/${storageKey}`;
        result.buffer = localBuffer;
        result.updated = true;
        
        console.log(`  - New Object Storage URL: ${result.objectStorageUrl}`);
      } else {
        console.log('  - No local copy found, cannot upload to Object Storage');
      }
    }
    
    // Ensure local copies exist
    if (result.buffer) {
      await ensureLocalCopies(filename, result.buffer);
    }
    
    return result;
  } catch (error) {
    console.error(`  - Error processing video: ${error.message}`);
    return result;
  }
}

/**
 * Find a local copy of a file in various directories
 * @param {string} filename - Filename to search for
 * @returns {Promise<Buffer|null>} File buffer or null if not found
 */
async function findLocalCopy(filename) {
  // Places to look for the file
  const paths = [
    path.join(LOCAL_BANNER_DIR, filename),
    path.join(UPLOADS_BANNER_DIR, filename),
    path.join(MEDIA_DIR, filename),
    path.join(PUBLIC_MEDIA_DIR, filename)
  ];
  
  for (const filePath of paths) {
    if (fs.existsSync(filePath)) {
      console.log(`  - Found local copy at: ${filePath}`);
      return fs.readFileSync(filePath);
    }
  }
  
  console.log('  - No local copy found in standard directories');
  return null;
}

/**
 * Ensure local copies of a file exist in all fallback directories
 * @param {string} filename - Filename to ensure exists
 * @param {Buffer} buffer - File content
 */
async function ensureLocalCopies(filename, buffer) {
  const localPath = path.join(LOCAL_BANNER_DIR, filename);
  const uploadsPath = path.join(UPLOADS_BANNER_DIR, filename);
  const mediaPath = path.join(MEDIA_DIR, filename);
  
  // Write to local paths
  if (!fs.existsSync(localPath)) {
    console.log(`  - Creating local copy at: ${localPath}`);
    fs.writeFileSync(localPath, buffer);
  }
  
  if (!fs.existsSync(uploadsPath)) {
    console.log(`  - Creating local copy at: ${uploadsPath}`);
    fs.writeFileSync(uploadsPath, buffer);
  }
  
  if (!fs.existsSync(mediaPath)) {
    console.log(`  - Creating local copy at: ${mediaPath}`);
    fs.writeFileSync(mediaPath, buffer);
  }
}

/**
 * Process any additional video files found on disk that might not be in the database
 */
async function processAdditionalVideos() {
  // Find all video files in the banner-slides directory
  const bannerFiles = fs.existsSync(LOCAL_BANNER_DIR) ? 
    fs.readdirSync(LOCAL_BANNER_DIR) : [];
  
  const uploadsBannerFiles = fs.existsSync(UPLOADS_BANNER_DIR) ? 
    fs.readdirSync(UPLOADS_BANNER_DIR) : [];
  
  const videoFiles = [...new Set([...bannerFiles, ...uploadsBannerFiles])]
    .filter(file => {
      const ext = path.extname(file).toLowerCase();
      return VIDEO_EXTENSIONS.includes(ext);
    });
  
  if (videoFiles.length === 0) {
    console.log('  - No additional video files found');
    return;
  }
  
  console.log(`  - Found ${videoFiles.length} video files to process`);
  
  for (const filename of videoFiles) {
    console.log(`\n  Processing additional video: ${filename}`);
    
    try {
      // Find the file
      let filePath;
      let fileBuffer;
      
      if (fs.existsSync(path.join(LOCAL_BANNER_DIR, filename))) {
        filePath = path.join(LOCAL_BANNER_DIR, filename);
        fileBuffer = fs.readFileSync(filePath);
      } else if (fs.existsSync(path.join(UPLOADS_BANNER_DIR, filename))) {
        filePath = path.join(UPLOADS_BANNER_DIR, filename);
        fileBuffer = fs.readFileSync(filePath);
      } else {
        console.log(`  - Could not find file, skipping`);
        continue;
      }
      
      console.log(`  - Found file at: ${filePath}`);
      
      // Define storage key
      const storageKey = `${STORAGE_BUCKET}/${STORAGE_PREFIX}/${filename}`;
      
      // Check if already in Object Storage
      const exists = await objectStorageService.fileExists(storageKey);
      console.log(`  - Exists in Object Storage: ${exists ? 'YES' : 'NO'}`);
      
      if (!exists) {
        // Upload to Object Storage
        await objectStorageService.uploadData(fileBuffer, 'banner-slides', filename);
        console.log('  - Successfully uploaded to Object Storage');
        console.log(`  - New Object Storage URL: ${STORAGE_URL}/${storageKey}`);
      }
      
      // Ensure local copies exist
      await ensureLocalCopies(filename, fileBuffer);
    } catch (error) {
      console.error(`  - Error processing additional video: ${error.message}`);
    }
  }
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