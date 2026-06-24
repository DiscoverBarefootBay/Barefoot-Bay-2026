/**
 * Script to migrate the remaining banner slides to Object Storage
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client } from '@replit/object-storage';
import { db } from './db-client.js';

// Load environment variables from .env file
dotenv.config();
console.log('Loading environment from .env file');

// Constants
const BUCKET_NAME = 'DEFAULT';
const DIRECTORIES = [
  path.join(process.cwd(), 'banner-slides'),
  path.join(process.cwd(), 'uploads', 'banner-slides')
];

// Create Object Storage client
const storage = new Client();

/**
 * Get banner slides content from database
 * @returns {Promise<Object>} Banner slides content
 */
async function getBannerSlidesFromDB() {
  try {
    const result = await db.query(
      `SELECT * FROM page_contents WHERE slug = 'banner-slides'`
    );
    console.log(`Executed query in ${result.duration}ms: ${result.query}`);

    if (!result.rows || result.rows.length === 0) {
      console.error('No banner slides found in database');
      return null;
    }
    
    const pageContent = result.rows[0];
    
    // The content is stored as JSON string, not an object
    if (!pageContent.content) {
      console.error('Banner slides content is missing');
      return null;
    }

    // Parse the content if it's a string
    if (typeof pageContent.content === 'string') {
      try {
        pageContent.content = { slides: JSON.parse(pageContent.content) };
        console.log('Successfully parsed banner slides content');
      } catch (parseError) {
        console.error('Failed to parse banner slides content:', parseError);
        return null;
      }
    } else if (!pageContent.content.slides && Array.isArray(pageContent.content)) {
      // If content is already an array but not in the expected structure
      pageContent.content = { slides: pageContent.content };
    }
    
    return pageContent;
  } catch (error) {
    console.error('Error getting banner slides from database:', error);
    return null;
  }
}

/**
 * Check if a file exists in any of the specified directories
 * @param {string} filename - Filename to check
 * @returns {string|null} The full path to the file if found, null otherwise
 */
function findFileInDirectories(filename) {
  for (const dir of DIRECTORIES) {
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

/**
 * Extract filename from a path or URL
 * @param {string} src - Source path or URL
 * @returns {string} Extracted filename
 */
function getFilenameFromPath(src) {
  if (!src) return '';
  // Handle both URL and file paths
  return src.split('/').pop();
}

/**
 * Determine content type based on file extension
 * @param {string} filename - Name of the file
 * @returns {string} MIME type
 */
function getContentType(filename) {
  const extension = filename.split('.').pop().toLowerCase();
  
  // Basic mapping of common extensions to MIME types
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'pdf': 'application/pdf',
    'zip': 'application/zip'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Upload a file to Replit Object Storage
 * @param {string} filePath - Path to the file to upload
 * @param {string} filename - Name to store in Object Storage
 * @returns {Promise<string|null>} Object Storage URL or null if failed
 */
async function uploadToObjectStorage(filePath, filename) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return null;
    }

    // Create the object storage path
    const objStoragePath = `banner-slides/${filename}`;
    
    // Check if REPLIT_OBJECT_STORAGE_TOKEN is set
    if (!process.env.REPLIT_OBJECT_STORAGE_TOKEN) {
      console.error('REPLIT_OBJECT_STORAGE_TOKEN not set, skipping upload');
      return null;
    }
    
    // Determine content type based on extension
    const contentType = getContentType(filename);
    
    // Upload to Object Storage using uploadFromFilename method which is simpler
    const result = await storage.uploadFromFilename(objStoragePath, filePath, {
      contentType,
      bucketName: BUCKET_NAME
    });
    
    if (!result.ok) {
      throw new Error(`Upload failed: ${result.error.message}`);
    }

    // Construct the Object Storage URL
    const objectStorageUrl = `https://object-storage.replit.app/${BUCKET_NAME}/${objStoragePath}`;
    console.log(`Uploaded ${filename} to Object Storage: ${objectStorageUrl}`);
    
    return objectStorageUrl;
  } catch (error) {
    console.error(`Error uploading ${filename} to Object Storage:`, error);
    return null;
  }
}

/**
 * Update banner slides in the database with Object Storage URLs
 * @param {Object} pageContent - Page content object
 * @param {Array} updates - Array of slide updates with old and new URLs
 * @returns {Promise<boolean>} Success status
 */
async function updateBannerSlidesInDB(pageContent, updates) {
  try {
    // Get the content object
    const content = pageContent.content;
    
    // Make sure slides array exists
    if (!content.slides || !Array.isArray(content.slides)) {
      console.error('No slides array in content');
      return false;
    }
    
    // Apply updates
    let updatesApplied = 0;
    for (const update of updates) {
      const slideIndex = content.slides.findIndex(slide => 
        slide.src === update.oldUrl || 
        slide.src === update.localUrl);
      
      if (slideIndex !== -1) {
        // Store the original URL as a fallback path
        const originalSrc = content.slides[slideIndex].src;
        content.slides[slideIndex].fallbackSrc = originalSrc;
        
        // Update the src to the Object Storage URL
        content.slides[slideIndex].src = update.newUrl;
        
        // Add timestamp to track last updated
        content.slides[slideIndex].lastUpdated = new Date().toISOString();
        
        updatesApplied++;
      }
    }
    
    // Update database
    if (updatesApplied > 0) {
      // Convert the slides array back to a JSON string for storage
      const contentToStore = JSON.stringify(content.slides);
      
      await db.query(
        `UPDATE page_contents SET content = $1 WHERE id = $2`,
        [contentToStore, pageContent.id]
      );
      console.log(`Updated ${updatesApplied} slides in database`);
      return true;
    } else {
      console.log('No slides updated in database');
      return false;
    }
  } catch (error) {
    console.error('Error updating banner slides in database:', error);
    return false;
  }
}

/**
 * Process a single slide
 * @param {Object} slide - The slide to process
 * @returns {Promise<Object|null>} Update object with oldUrl, localUrl and newUrl or null if failed
 */
async function processSlide(slide) {
  // Skip if already using Object Storage
  if (slide.src && slide.src.includes('object-storage.replit.app')) {
    console.log(`Slide already using Object Storage: ${slide.src}`);
    return null;
  }
  
  const filename = getFilenameFromPath(slide.src);
  if (!filename) {
    console.warn(`Could not extract filename from ${slide.src}`);
    return null;
  }
  
  // Find the file in any of the directories
  const filePath = findFileInDirectories(filename);
  if (!filePath) {
    console.warn(`File not found for slide ${filename}`);
    return null;
  }
  
  console.log(`Processing slide: ${filename}`);
  console.log(`Found file at: ${filePath}`);
  
  // Upload to Object Storage
  const objectStorageUrl = await uploadToObjectStorage(filePath, filename);
  if (!objectStorageUrl) {
    console.warn(`Failed to upload ${filename} to Object Storage`);
    return null;
  }
  
  // Return the update object
  return {
    oldUrl: slide.src,
    localUrl: `/uploads/banner-slides/${filename}`, // Alternate local path
    newUrl: objectStorageUrl
  };
}

/**
 * Main function to migrate remaining banner slides to Object Storage
 */
async function migrateRemainingSlides() {
  try {
    console.log('Starting migration of remaining banner slides to Object Storage...');
    
    // Get banner slides from database
    const pageContent = await getBannerSlidesFromDB();
    if (!pageContent) {
      console.error('Could not retrieve banner slides from database');
      return;
    }
    
    // Process slides not yet in Object Storage
    const slides = pageContent.content.slides || [];
    console.log(`Found ${slides.length} slides in database`);
    
    // Filter to slides that don't use Object Storage URLs
    const slidesToProcess = slides.filter(slide => 
      !slide.src.includes('object-storage.replit.app')
    );
    
    console.log(`Found ${slidesToProcess.length} slides not using Object Storage URLs`);
    
    const updates = [];
    
    // Process each slide in the range
    for (const slide of slidesToProcess) {
      const update = await processSlide(slide);
      if (update) {
        updates.push(update);
      }
    }
    
    console.log(`Generated ${updates.length} updates`);
    
    // Update database
    if (updates.length > 0) {
      const success = await updateBannerSlidesInDB(pageContent, updates);
      if (success) {
        console.log('Successfully updated banner slides in database');
      } else {
        console.error('Failed to update banner slides in database');
      }
    } else {
      console.log('No updates to apply');
    }
    
    console.log('Banner slides migration completed');
    
    return updates.length;
  } catch (error) {
    console.error('Error migrating banner slides to Object Storage:', error);
    return 0;
  } finally {
    // Ensure db connection is closed
    try {
      await db.end();
    } catch (err) {
      console.error('Error closing database connection:', err);
    }
  }
}

// Run the migration
migrateRemainingSlides().catch(console.error);