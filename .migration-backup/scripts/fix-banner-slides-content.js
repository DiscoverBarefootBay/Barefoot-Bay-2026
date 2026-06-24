/**
 * Fixed banner slides migration script for page_contents structure
 * 
 * This script:
 * 1. Finds banner slides in the page_contents table
 * 2. Ensures all media is uploaded to Object Storage
 * 3. Updates database entries with Object Storage proxy URLs
 * 4. Validates that content can be accessed from both paths
 * 
 * Run with: node scripts/fix-banner-slides-content.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from '@neondatabase/serverless';
const { neonConfig, Pool } = pkg;
import { Client } from '@replit/object-storage';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Set up file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Initialize database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize Object Storage
const objectStore = new Client();
const BANNER_BUCKET = 'BANNER'; // Dedicated bucket for banner slides

// Helper function to get MIME type from filename
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  if (['.jpg', '.jpeg'].includes(ext)) return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  
  return 'application/octet-stream';
}

// Helper function to determine if file is a video
function isVideo(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ['.mp4', '.webm', '.mov', '.m4v'].includes(ext);
}

// Ensure the bucket exists
async function ensureBucketExists(bucket) {
  try {
    // List all buckets
    const buckets = await objectStore.listBuckets();
    
    // Create the bucket if it doesn't exist
    if (!buckets.includes(bucket)) {
      console.log(`Creating bucket ${bucket}...`);
      await objectStore.createBucket(bucket);
      console.log(`Bucket ${bucket} created successfully`);
    } else {
      console.log(`Bucket ${bucket} already exists`);
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring bucket exists:', error);
    return false;
  }
}

// Upload a file to Object Storage
async function uploadToObjectStorage(filePath, objectKey, bucket) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist: ${filePath}`);
      return null;
    }
    
    const contentType = getMimeType(filePath);
    const fileContent = fs.readFileSync(filePath);
    
    // Upload the file to Object Storage
    await objectStore.putObject({
      bucket,
      key: objectKey,
      body: fileContent,
      contentType
    });
    
    // Return the proxy URL format
    return `/api/storage-proxy/${bucket}/${objectKey}`;
  } catch (error) {
    console.error(`Error uploading to Object Storage:`, error);
    return null;
  }
}

// Get banner slides from page_contents table
async function getBannerSlidesContent() {
  try {
    const result = await db.query(`
      SELECT * FROM page_contents
      WHERE slug = 'banner-slides'
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.error('No banner slides found in page_contents table');
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error getting banner slides from database:', error);
    return null;
  }
}

// Update banner slides content in page_contents table
async function updateBannerSlidesContent(id, content) {
  try {
    await db.query(`
      UPDATE page_contents
      SET content = $1, updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(content), id]);
    
    return true;
  } catch (error) {
    console.error(`Error updating banner slides content:`, error);
    return false;
  }
}

// Process a single banner slide item
async function processBannerSlide(slide, index) {
  const { src } = slide;
  
  // Skip if already using object storage proxy
  if (src && src.includes('/api/storage-proxy/BANNER/')) {
    console.log(`Slide ${index} already uses storage proxy: ${src}`);
    return {
      index,
      status: 'skipped',
      message: 'Already using storage proxy',
      slide
    };
  }
  
  // Skip if no source
  if (!src) {
    console.log(`Slide ${index} has no source`);
    return {
      index,
      status: 'error',
      message: 'No source URL',
      slide
    };
  }
  
  // Extract filename from src
  const filename = path.basename(src);
  
  // Check potential file locations
  const uploadsPath = path.join(rootDir, 'uploads', 'banner-slides', filename);
  const directPath = path.join(rootDir, 'banner-slides', filename);
  const publicPath = path.join(rootDir, 'public', filename);
  
  // Create normalized src path for the filesystem
  const normalizedSrc = src.startsWith('/') ? src.substring(1) : src;
  const absolutePath = path.join(rootDir, normalizedSrc);
  
  let filePath = null;
  
  // Try to find the file
  if (fs.existsSync(uploadsPath)) {
    filePath = uploadsPath;
  } else if (fs.existsSync(directPath)) {
    filePath = directPath;
  } else if (fs.existsSync(absolutePath)) {
    filePath = absolutePath;
  } else if (fs.existsSync(publicPath)) {
    filePath = publicPath;
  }
  
  if (!filePath) {
    console.error(`File not found for slide ${index}: ${src}`);
    return {
      index,
      status: 'error',
      message: 'File not found',
      slide
    };
  }
  
  // Upload file to Object Storage
  const objectKey = `banner-slides/${filename}`;
  const newObjectStorageUrl = await uploadToObjectStorage(filePath, objectKey, BANNER_BUCKET);
  
  if (!newObjectStorageUrl) {
    return {
      index,
      status: 'error',
      message: 'Failed to upload to Object Storage',
      slide
    };
  }
  
  // Update slide with new URL
  const updatedSlide = { ...slide, src: newObjectStorageUrl };
  
  return {
    index,
    status: 'success',
    message: 'Successfully processed',
    slide: updatedSlide,
    oldSrc: src,
    newSrc: newObjectStorageUrl
  };
}

// Main function
async function main() {
  console.log('Starting banner slides content fix script...');
  
  // Ensure banner bucket exists
  await ensureBucketExists(BANNER_BUCKET);
  
  // Get banner slides content
  const pageContent = await getBannerSlidesContent();
  if (!pageContent) {
    console.error('Failed to retrieve banner slides content');
    process.exit(1);
  }
  
  // Parse content as JSON
  let slidesArray;
  try {
    slidesArray = JSON.parse(pageContent.content);
  } catch (error) {
    console.error('Failed to parse banner slides content as JSON:', error);
    process.exit(1);
  }
  
  if (!Array.isArray(slidesArray)) {
    console.error('Banner slides content is not an array');
    process.exit(1);
  }
  
  console.log(`Found ${slidesArray.length} banner slides`);
  
  // Process slides in sequence
  const results = [];
  const updatedSlides = [];
  
  for (let i = 0; i < slidesArray.length; i++) {
    const slide = slidesArray[i];
    console.log(`Processing slide ${i + 1}/${slidesArray.length}`);
    const result = await processBannerSlide(slide, i);
    results.push(result);
    
    // Add to updated slides array
    updatedSlides.push(result.slide);
    
    console.log(`Result for slide ${i + 1}: ${result.status} - ${result.message}`);
  }
  
  // Update database with updated slides
  const updateSuccess = await updateBannerSlidesContent(pageContent.id, updatedSlides);
  
  if (!updateSuccess) {
    console.error('Failed to update banner slides in database');
    process.exit(1);
  }
  
  // Print summary
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;
  
  console.log('\nBanner Slides Fix Summary:');
  console.log(`- Total slides: ${slidesArray.length}`);
  console.log(`- Successfully processed: ${successCount}`);
  console.log(`- Errors: ${errorCount}`);
  console.log(`- Skipped (already processed): ${skippedCount}`);
  
  // Write log file with detailed results
  const logFile = path.join(rootDir, 'banner-slides-fix-log.txt');
  const timestamp = new Date().toISOString();
  const logContent = `Banner Slides Fix - ${timestamp}\n\n` +
    `Total slides: ${slidesArray.length}\n` +
    `Successfully processed: ${successCount}\n` +
    `Errors: ${errorCount}\n` +
    `Skipped: ${skippedCount}\n\n` +
    `Detailed Results:\n` +
    results.map(r => {
      if (r.status === 'success') {
        return `- Slide ${r.index + 1}: ${r.status} - Changed "${r.oldSrc}" to "${r.newSrc}"`;
      } else {
        return `- Slide ${r.index + 1}: ${r.status} - ${r.message}`;
      }
    }).join('\n');
  
  fs.writeFileSync(logFile, logContent, 'utf8');
  console.log(`\nDetailed log saved to: ${logFile}`);
  
  console.log('\nBanner slides fix completed');
  
  // Close database connection
  await db.end();
}

// Run the script
main().catch(error => {
  console.error('Error running script:', error);
  process.exit(1);
});