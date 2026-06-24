/**
 * Script to convert banner slide URLs in the database from filesystem paths to Object Storage URLs
 * 
 * This script updates the banner slides stored in the page_contents table to use
 * Replit Object Storage URLs instead of local filesystem paths, making them persist
 * across deployments.
 * 
 * Usage:
 * node scripts/convert-banner-slide-urls.js [--dry-run]
 * 
 * Options:
 * --dry-run    Show changes that would be made without actually updating the database
 */

import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// Constants
const BUCKET = 'DEFAULT';
const TARGET_DIRECTORY = 'banner-slides';
const BASE_URL = 'https://object-storage.replit.app';
const OBJECT_STORAGE_PREFIX = `${BASE_URL}/${BUCKET}/${TARGET_DIRECTORY}/`;

// Initialize Replit Object Storage client
const client = new Client();

// Connect to Postgres
const dbClient = new pg.Client({
  connectionString: process.env.DATABASE_URL
});

/**
 * Convert a local filesystem path to an Object Storage URL
 * @param {string} localPath - Local file path (e.g., /banner-slides/image.png or /uploads/banner-slides/image.png)
 * @returns {string} - Object Storage URL or the original path if no conversion can be done
 */
function convertToObjectStorageUrl(localPath) {
  if (!localPath) return localPath;
  
  // Skip if already using Object Storage URL
  if (localPath.startsWith(OBJECT_STORAGE_PREFIX)) {
    return localPath;
  }
  
  // Extract filename from both potential patterns
  let filename;
  if (localPath.startsWith('/banner-slides/')) {
    filename = path.basename(localPath);
  } else if (localPath.startsWith('/uploads/banner-slides/')) {
    filename = path.basename(localPath);
  } else {
    // Not a banner slide path, return as is
    return localPath;
  }
  
  // Return the Object Storage URL
  return `${OBJECT_STORAGE_PREFIX}${filename}`;
}

/**
 * Check if a file exists in Object Storage
 * @param {string} filename - The filename to check
 * @returns {Promise<boolean>} - Whether the file exists
 */
async function fileExistsInObjectStorage(filename) {
  try {
    const storageKey = path.join(TARGET_DIRECTORY, filename);
    
    // Use list with a prefix to check if file exists
    const result = await client.list({ 
      prefix: storageKey,
      maxResults: 1,
      bucketName: BUCKET
    });
    
    if (result.ok && result.value.length > 0) {
      // Check if any of the returned objects match exactly
      return result.value.some(obj => obj.name === storageKey);
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking if file exists:`, error);
    return false;
  }
}

/**
 * Main function to update banner slide URLs in the database
 */
async function convertBannerSlideUrls() {
  console.log(`
==========================================
  BANNER SLIDE URL CONVERSION
  ${new Date().toISOString()}
  ${DRY_RUN ? '[DRY RUN]' : '[LIVE RUN]'}
==========================================
`);
  
  try {
    // Connect to the database
    await dbClient.connect();
    console.log('Connected to database');
    
    // Get the banner slides from the page_contents table
    const contentResult = await dbClient.query('SELECT id, content FROM page_contents WHERE slug = $1', ['banner-slides']);
    
    if (contentResult.rows.length === 0) {
      console.log('No banner slides content found in the database');
      return;
    }
    
    const pageContent = contentResult.rows[0];
    const contentId = pageContent.id;
    
    // Parse the JSON content
    let bannerSlides;
    try {
      bannerSlides = JSON.parse(pageContent.content);
      console.log(`Found ${bannerSlides.length} banner slides in the page_contents table`);
    } catch (error) {
      console.error('Error parsing banner slides JSON:', error);
      return;
    }
    
    // Track our progress
    let convertedCount = 0;
    let skippedCount = 0;
    let missingCount = 0;
    
    // Process each slide
    const updatedSlides = bannerSlides.map((slide, index) => {
      // Skip if src is not set
      if (!slide.src) {
        console.log(`Skipping slide #${index + 1} - No source URL`);
        skippedCount++;
        return slide;
      }
      
      // If already using Object Storage URL, skip
      if (slide.src.startsWith(OBJECT_STORAGE_PREFIX)) {
        console.log(`Skipping slide #${index + 1} - Already using Object Storage URL`);
        skippedCount++;
        return slide;
      }
      
      // Extract filename
      const filename = path.basename(slide.src);
      
      // Create a copy of the slide to modify
      const updatedSlide = { ...slide };
      
      // Convert the URL
      const newUrl = convertToObjectStorageUrl(slide.src);
      
      console.log(`Converting slide #${index + 1}:
  Old URL: ${slide.src}
  New URL: ${newUrl}
`);
      
      // Update the source URL in the slide
      updatedSlide.src = newUrl;
      convertedCount++;
      
      return updatedSlide;
    });
    
    // Update the database unless in dry run mode
    if (!DRY_RUN) {
      await dbClient.query(
        'UPDATE page_contents SET content = $1 WHERE id = $2', 
        [JSON.stringify(updatedSlides), contentId]
      );
      console.log('Database updated with new Object Storage URLs');
    }
    
    console.log(`
==========================================
  SUMMARY
==========================================
Total banner slides: ${bannerSlides.length}
Converted: ${convertedCount}
Skipped: ${skippedCount}
Missing in Object Storage: ${missingCount}
${DRY_RUN ? 'No changes were made (dry run)' : 'All URLs have been updated in the database'}
`);
    
  } catch (error) {
    console.error('Error updating banner slide URLs:', error);
  } finally {
    // Close the database connection
    await dbClient.end();
    console.log('Database connection closed');
  }
}

// Run the main function
convertBannerSlideUrls().catch(console.error);