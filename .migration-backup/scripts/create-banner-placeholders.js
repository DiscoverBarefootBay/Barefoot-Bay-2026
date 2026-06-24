/**
 * Script to create placeholder images for missing banner slides
 * 
 * This script looks for references to banner slide images that don't exist
 * in the filesystem and creates placeholders for them.
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

// Create the directory if it doesn't exist
for (const dir of DIRECTORIES) {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

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
 * @returns {Object} Object with exists flag and path if found
 */
function checkFileInDirectories(filename) {
  for (const dir of DIRECTORIES) {
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) {
      return { exists: true, path: filePath };
    }
  }
  return { exists: false, path: null };
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
 * Update banner slides in the database
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
        slide.src === update.oldSrc);
      
      if (slideIndex !== -1) {
        // Update the src to the Object Storage URL
        content.slides[slideIndex].src = update.newSrc;
        
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
 * Copy a placeholder image to create a missing banner slide
 * @param {string} sourceFile - Path to the source file to copy
 * @param {string} destFilename - Name for the destination file
 * @returns {Promise<string|null>} Path to the created file or null if failed
 */
async function createPlaceholderImage(sourceFile, destFilename) {
  try {
    // Use an existing banner image as the source for the placeholder
    const sourcePath = path.join(process.cwd(), sourceFile);
    
    if (!fs.existsSync(sourcePath)) {
      console.error(`Source file not found: ${sourcePath}`);
      return null;
    }
    
    // Copy to both directories for consistency
    const createdFiles = [];
    
    for (const dir of DIRECTORIES) {
      const destPath = path.join(dir, destFilename);
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Created placeholder image: ${destPath}`);
      createdFiles.push(destPath);
    }
    
    return createdFiles[0]; // Return the first one
  } catch (error) {
    console.error(`Error creating placeholder image ${destFilename}:`, error);
    return null;
  }
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
 * Upload a placeholder file to Object Storage
 * @param {string} filePath - Path to the placeholder file
 * @param {string} filename - Name to store in Object Storage
 * @returns {Promise<string|null>} Object Storage URL or null if failed
 */
async function uploadPlaceholderToObjectStorage(filePath, filename) {
  try {
    // Create the object storage path
    const objStoragePath = `banner-slides/${filename}`;
    
    // Check if REPLIT_OBJECT_STORAGE_TOKEN is set
    if (!process.env.REPLIT_OBJECT_STORAGE_TOKEN) {
      console.error('REPLIT_OBJECT_STORAGE_TOKEN not set, skipping upload');
      return null;
    }
    
    // Determine content type based on extension
    const contentType = getContentType(filename);
    
    // Upload to Object Storage
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
 * Main function to create placeholders for missing banner slides
 */
async function createBannerPlaceholders() {
  try {
    console.log('Starting creation of banner slide placeholders...');
    
    // Get banner slides from database
    const pageContent = await getBannerSlidesFromDB();
    if (!pageContent) {
      console.error('Could not retrieve banner slides from database');
      return;
    }
    
    // Process slides
    const slides = pageContent.content.slides || [];
    console.log(`Found ${slides.length} slides in database`);
    
    // Find source file to use as a template
    const sourcePlaceholder = 'public/placeholder-banner.jpg';
    if (!fs.existsSync(sourcePlaceholder)) {
      // Use an alternative source
      console.log(`Source placeholder ${sourcePlaceholder} not found, trying alternatives...`);
    }
    
    const updates = [];
    
    // Process each slide
    for (const slide of slides) {
      const filename = getFilenameFromPath(slide.src);
      if (!filename) {
        console.warn(`Could not extract filename from ${slide.src}`);
        continue;
      }
      
      // Check if file exists
      const fileCheck = checkFileInDirectories(filename);
      if (fileCheck.exists) {
        console.log(`Slide file exists: ${fileCheck.path}`);
        continue;
      }
      
      console.log(`Creating placeholder for missing slide: ${filename}`);
      
      // Create the placeholder
      const placeholderPath = await createPlaceholderImage(sourcePlaceholder, filename);
      if (!placeholderPath) {
        console.warn(`Failed to create placeholder for ${filename}`);
        continue;
      }
      
      // Upload to Object Storage
      const objectStorageUrl = await uploadPlaceholderToObjectStorage(placeholderPath, filename);
      if (!objectStorageUrl) {
        console.warn(`Failed to upload placeholder ${filename} to Object Storage`);
        continue;
      }
      
      // Only update database if slide is NOT already using Object Storage
      if (!slide.src.includes('object-storage.replit.app')) {
        updates.push({
          oldSrc: slide.src,
          newSrc: objectStorageUrl
        });
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
    
    console.log('Banner slide placeholder creation completed');
    
  } catch (error) {
    console.error('Error creating banner slide placeholders:', error);
  } finally {
    // Ensure db connection is closed
    try {
      await db.end();
    } catch (err) {
      console.error('Error closing database connection:', err);
    }
  }
}

// Run the placeholder creation
createBannerPlaceholders().catch(console.error);