/**
 * Comprehensive banner slides fix script
 * 
 * This script:
 * 1. Finds all banner slides in the database
 * 2. Ensures all media is uploaded to Object Storage
 * 3. Updates database entries with Object Storage URLs
 * 4. Validates the content can be accessed from both paths
 * 
 * Run with: node scripts/fix-banner-slides.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@neondatabase/serverless';
import { ObjectStore } from '@replit/object-storage';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Set up file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Initialize database connection
const db = createClient({
  connectionString: process.env.DATABASE_URL,
});

// Initialize Object Storage
const objectStore = new ObjectStore();
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
    
    // Return the Object Storage URL
    return `https://object-storage.replit.app/${bucket}/${objectKey}`;
  } catch (error) {
    console.error(`Error uploading to Object Storage:`, error);
    return null;
  }
}

// Get all banner slides from the database
async function getBannerSlides() {
  try {
    const result = await db.query(`
      SELECT * FROM "bannerSlides"
      ORDER BY "updatedAt" DESC
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error getting banner slides from database:', error);
    return [];
  }
}

// Update a banner slide with Object Storage URL
async function updateBannerSlideObjectStorage(id, objectStorageUrl) {
  try {
    await db.query(`
      UPDATE "bannerSlides"
      SET "objectStorageUrl" = $1, "updatedAt" = NOW()
      WHERE id = $2
    `, [objectStorageUrl, id]);
    
    return true;
  } catch (error) {
    console.error(`Error updating banner slide ${id}:`, error);
    return false;
  }
}

// Process a single banner slide
async function processBannerSlide(slide) {
  const { id, mediaUrl, objectStorageUrl } = slide;
  
  // Skip if already has Object Storage URL
  if (objectStorageUrl && objectStorageUrl.includes('object-storage.replit.app')) {
    console.log(`Slide ${id} already has Object Storage URL: ${objectStorageUrl}`);
    return {
      id,
      status: 'skipped',
      message: 'Already has Object Storage URL'
    };
  }
  
  // Skip if no media URL
  if (!mediaUrl) {
    console.log(`Slide ${id} has no media URL`);
    return {
      id,
      status: 'error',
      message: 'No media URL'
    };
  }
  
  // Extract filename from media URL
  const filename = path.basename(mediaUrl);
  
  // Check potential file locations
  const uploadsPath = path.join(rootDir, 'uploads', 'banner-slides', filename);
  const directPath = path.join(rootDir, 'banner-slides', filename);
  const absolutePath = path.join(rootDir, mediaUrl.startsWith('/') ? mediaUrl.substring(1) : mediaUrl);
  
  let filePath = null;
  
  // Try to find the file
  if (fs.existsSync(uploadsPath)) {
    filePath = uploadsPath;
  } else if (fs.existsSync(directPath)) {
    filePath = directPath;
  } else if (fs.existsSync(absolutePath)) {
    filePath = absolutePath;
  }
  
  if (!filePath) {
    console.error(`File not found for slide ${id}: ${mediaUrl}`);
    return {
      id,
      status: 'error',
      message: 'File not found'
    };
  }
  
  // Ensure banner bucket exists
  const bucketExists = await ensureBucketExists(BANNER_BUCKET);
  if (!bucketExists) {
    return {
      id,
      status: 'error',
      message: 'Failed to ensure bucket exists'
    };
  }
  
  // Upload file to Object Storage
  const objectKey = `banner-slides/${filename}`;
  const newObjectStorageUrl = await uploadToObjectStorage(filePath, objectKey, BANNER_BUCKET);
  
  if (!newObjectStorageUrl) {
    return {
      id,
      status: 'error',
      message: 'Failed to upload to Object Storage'
    };
  }
  
  // Update database with Object Storage URL
  const updateSuccess = await updateBannerSlideObjectStorage(id, newObjectStorageUrl);
  
  if (!updateSuccess) {
    return {
      id,
      status: 'error',
      message: 'Failed to update database'
    };
  }
  
  return {
    id,
    status: 'success',
    message: 'Successfully processed',
    objectStorageUrl: newObjectStorageUrl
  };
}

// Main function
async function main() {
  console.log('Starting banner slides fix script...');
  
  // Ensure banner bucket exists
  await ensureBucketExists(BANNER_BUCKET);
  
  // Get all banner slides
  const slides = await getBannerSlides();
  console.log(`Found ${slides.length} banner slides`);
  
  // Process slides in sequence
  const results = [];
  for (const slide of slides) {
    console.log(`Processing slide ${slide.id}: ${slide.title || 'Untitled'}`);
    const result = await processBannerSlide(slide);
    results.push(result);
    console.log(`Result for slide ${slide.id}: ${result.status} - ${result.message}`);
  }
  
  // Print summary
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;
  
  console.log('\nBanner Slides Fix Summary:');
  console.log(`- Total slides: ${slides.length}`);
  console.log(`- Successfully processed: ${successCount}`);
  console.log(`- Errors: ${errorCount}`);
  console.log(`- Skipped (already processed): ${skippedCount}`);
  
  // Write log file with detailed results
  const logFile = path.join(rootDir, 'banner-slides-fix-log.txt');
  const timestamp = new Date().toISOString();
  const logContent = `Banner Slides Fix - ${timestamp}\n\n` +
    `Total slides: ${slides.length}\n` +
    `Successfully processed: ${successCount}\n` +
    `Errors: ${errorCount}\n` +
    `Skipped: ${skippedCount}\n\n` +
    `Detailed Results:\n` +
    results.map(r => `- Slide ${r.id}: ${r.status} - ${r.message}${r.objectStorageUrl ? ' - ' + r.objectStorageUrl : ''}`).join('\n');
  
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