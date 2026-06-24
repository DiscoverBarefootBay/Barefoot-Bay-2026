/**
 * Migrate Banner Slides to Object Storage
 * 
 * This script ensures all existing banner slides in the filesystem are properly 
 * uploaded to Object Storage to enable persistence across deployments.
 * 
 * Usage:
 * node scripts/migrate-banner-slides-to-object-storage.js
 */

import fs from 'fs';
import path from 'path';
import { Client } from '@replit/object-storage';
import pkg from 'pg';
const { Pool } = pkg;

// Import URL and path modules for ES modules support
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current file path and directory (ES modules don't have __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants
const BANNER_BUCKET = 'BANNER'; // Use dedicated BANNER bucket for banner slides
const BANNER_SLIDES_DIR = path.join(__dirname, '..', 'banner-slides');
const UPLOADS_BANNER_SLIDES_DIR = path.join(__dirname, '..', 'uploads', 'banner-slides');
const OBJECT_STORAGE_BASE_URL = 'https://object-storage.replit.app';

// Initialize database connection from environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Main migration function
 */
async function migrateBannerSlidesToObjectStorage() {
  console.log('Starting banner slides migration to Object Storage...');
  
  try {
    // Initialize Object Storage client
    const client = new Client();
    
    // Get all banner slides from the filesystem
    const filesystemFiles = await getSlidePaths();
    console.log(`Found ${filesystemFiles.total} banner slide files in filesystem.`);
    
    // Get existing slides in Object Storage
    const existingInStorage = await getExistingObjectStorageFiles(client);
    console.log(`Found ${existingInStorage.length} banner slide files already in Object Storage.`);
    
    // Upload files that aren't in Object Storage yet
    const filesToUpload = findFilesToUpload(filesystemFiles, existingInStorage);
    console.log(`Need to upload ${filesToUpload.length} files to Object Storage.`);
    
    // Upload the files
    const uploadResults = await uploadBannerSlides(client, filesToUpload);
    console.log(`Successfully uploaded ${uploadResults.success} files, failed to upload ${uploadResults.failed} files.`);
    
    // Get all slides from the database
    const slidesInDatabase = await getSlidesFromDatabase();
    if (slidesInDatabase.length > 0) {
      console.log(`Found ${slidesInDatabase.length} slides in the database, updating URLs...`);
      
      // Update the database with Object Storage URLs
      const updateResults = await updateDatabaseUrls(slidesInDatabase, uploadResults.urls);
      console.log(`Updated ${updateResults.updated} slides in database.`);
    } else {
      console.log('No slides found in database to update.');
    }
    
    console.log('Banner slides migration completed!');
    
    return {
      filesFound: filesystemFiles.total,
      existingInStorage: existingInStorage.length,
      uploaded: uploadResults.success,
      failed: uploadResults.failed,
      databaseUpdated: slidesInDatabase.length > 0
    };
  } catch (error) {
    console.error('Error during banner slides migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Get all banner slide files from filesystem
 */
async function getSlidePaths() {
  const result = {
    uploads: [],
    root: [],
    total: 0
  };
  
  // Check uploads/banner-slides directory
  if (fs.existsSync(UPLOADS_BANNER_SLIDES_DIR)) {
    try {
      const files = fs.readdirSync(UPLOADS_BANNER_SLIDES_DIR);
      result.uploads = files.map(filename => ({
        path: path.join(UPLOADS_BANNER_SLIDES_DIR, filename),
        filename
      }));
    } catch (err) {
      console.error('Error reading uploads/banner-slides directory:', err);
    }
  } else {
    console.log('uploads/banner-slides directory not found, creating it...');
    fs.mkdirSync(UPLOADS_BANNER_SLIDES_DIR, { recursive: true });
  }
  
  // Check banner-slides directory
  if (fs.existsSync(BANNER_SLIDES_DIR)) {
    try {
      const files = fs.readdirSync(BANNER_SLIDES_DIR);
      result.root = files.map(filename => ({
        path: path.join(BANNER_SLIDES_DIR, filename),
        filename
      }));
    } catch (err) {
      console.error('Error reading banner-slides directory:', err);
    }
  } else {
    console.log('banner-slides directory not found, creating it...');
    fs.mkdirSync(BANNER_SLIDES_DIR, { recursive: true });
  }
  
  // Calculate total unique files
  const allFilenames = new Set([
    ...result.uploads.map(file => file.filename),
    ...result.root.map(file => file.filename)
  ]);
  result.total = allFilenames.size;
  
  return result;
}

/**
 * Get existing banner slides in Object Storage
 */
async function getExistingObjectStorageFiles(client) {
  try {
    console.log('Checking existing files in Object Storage...');
    
    // Use list method with options to filter by prefix
    const result = await client.list({
      prefix: 'banner-slides/',
      bucketName: BANNER_BUCKET,
      headers: { 'X-Obj-Bucket': BANNER_BUCKET }
    });
    
    if (!result.ok) {
      console.error('Error listing files in Object Storage:', result.error);
      return [];
    }
    
    return result.value.map(item => {
      const filename = path.basename(item.key);
      return {
        key: item.key,
        filename,
        size: item.size,
        url: `${OBJECT_STORAGE_BASE_URL}/${BANNER_BUCKET}/${item.key}`
      };
    });
  } catch (error) {
    console.error('Error checking existing files in Object Storage:', error);
    return [];
  }
}

/**
 * Find files that need to be uploaded
 */
function findFilesToUpload(filesystemFiles, existingInStorage) {
  const existingFilenames = new Set(existingInStorage.map(file => file.filename));
  const filesToUpload = [];
  
  // Check uploads directory first since those files are more likely to be complete
  for (const file of filesystemFiles.uploads) {
    if (!existingFilenames.has(file.filename)) {
      filesToUpload.push(file);
    }
  }
  
  // If a file wasn't found in uploads, check the root directory
  if (filesToUpload.length === 0) {
    for (const file of filesystemFiles.root) {
      if (!existingFilenames.has(file.filename) && !filesToUpload.some(f => f.filename === file.filename)) {
        filesToUpload.push(file);
      }
    }
  }
  
  return filesToUpload;
}

/**
 * Upload banner slides to Object Storage
 */
async function uploadBannerSlides(client, filesToUpload) {
  const result = {
    success: 0,
    failed: 0,
    urls: {} // Map of filename to Object Storage URL
  };
  
  for (const file of filesToUpload) {
    try {
      console.log(`Uploading ${file.filename} to Object Storage...`);
      
      // Check if file exists and is readable
      if (!fs.existsSync(file.path)) {
        console.error(`File not found: ${file.path}`);
        result.failed++;
        continue;
      }
      
      // Get content type based on file extension
      const ext = path.extname(file.filename).toLowerCase();
      let contentType = 'application/octet-stream';
      
      if (['.jpg', '.jpeg'].includes(ext)) {
        contentType = 'image/jpeg';
      } else if (ext === '.png') {
        contentType = 'image/png';
      } else if (ext === '.webp') {
        contentType = 'image/webp';
      } else if (ext === '.gif') {
        contentType = 'image/gif';
      } else if (ext === '.mp4') {
        contentType = 'video/mp4';
      } else if (ext === '.webm') {
        contentType = 'video/webm';
      }
      
      // Upload to Object Storage
      const storageKey = `banner-slides/${file.filename}`;
      const uploadResult = await client.uploadFromFilename(storageKey, file.path, {
        contentType,
        bucketName: BANNER_BUCKET,
        headers: { 'X-Obj-Bucket': BANNER_BUCKET }
      });
      
      if (!uploadResult.ok) {
        console.error(`Failed to upload ${file.filename}:`, uploadResult.error);
        result.failed++;
        continue;
      }
      
      // Store the URL for database updates
      const url = `${OBJECT_STORAGE_BASE_URL}/${BANNER_BUCKET}/${storageKey}`;
      result.urls[file.filename] = url;
      
      console.log(`Successfully uploaded ${file.filename} to ${url}`);
      result.success++;
    } catch (error) {
      console.error(`Error uploading ${file.filename}:`, error);
      result.failed++;
    }
  }
  
  return result;
}

/**
 * Get banner slides from the database
 */
async function getSlidesFromDatabase() {
  try {
    const result = await pool.query(`
      SELECT id, content FROM page_contents 
      WHERE slug = 'banner-slides'
    `);
    
    if (result.rows.length === 0) {
      return [];
    }
    
    const content = result.rows[0].content;
    let slides = [];
    
    if (typeof content === 'string') {
      try {
        slides = JSON.parse(content);
      } catch (e) {
        console.error('Error parsing banner slides content:', e);
        return [];
      }
    } else if (Array.isArray(content)) {
      slides = content;
    } else {
      console.error('Unexpected banner slides content format:', typeof content);
      return [];
    }
    
    return slides.map(slide => ({
      ...slide,
      id: result.rows[0].id
    }));
  } catch (error) {
    console.error('Error getting slides from database:', error);
    return [];
  }
}

/**
 * Update database with Object Storage URLs
 */
async function updateDatabaseUrls(slides, uploadedUrls) {
  let updated = 0;
  
  try {
    // Get slides content by ID, grouped by content ID
    const slidesByContentId = slides.reduce((acc, slide) => {
      if (!acc[slide.id]) {
        acc[slide.id] = [];
      }
      acc[slide.id].push(slide);
      return acc;
    }, {});
    
    for (const contentId in slidesByContentId) {
      const slidesForUpdate = slidesByContentId[contentId];
      
      // Update slides with Object Storage URLs
      let updatedSlides = slidesForUpdate.map(slide => {
        if (slide.src) {
          const filename = path.basename(slide.src);
          
          // If we have an Object Storage URL for this file, use it
          if (uploadedUrls[filename]) {
            slide.objectStorageUrl = uploadedUrls[filename];
            updated++;
          }
        }
        return slide;
      });
      
      // Update the database with the modified slides
      await pool.query(
        'UPDATE page_contents SET content = $1 WHERE id = $2',
        [JSON.stringify(updatedSlides), contentId]
      );
    }
    
    return { updated };
  } catch (error) {
    console.error('Error updating database URLs:', error);
    return { updated: 0 };
  }
}

// Run the migration script
migrateBannerSlidesToObjectStorage()
  .then(result => {
    console.log('Migration completed with the following results:');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

// Export the function for potential use in other modules
export { migrateBannerSlidesToObjectStorage };