/**
 * Direct video upload to Replit Object Storage using the @replit/object-storage package
 * This script bypasses the server and uploads directly to Object Storage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@replit/object-storage';

// Get current file and directory paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize the storage client
const storage = new Client();

// Source video configuration
const SOURCE_VIDEO_PATH = path.join(__dirname, '..', 'public', 'static', 'videos', 'test-background-video.mp4');

// Upload destinations with format: [bucketName, objectKey]
const UPLOAD_DESTINATIONS = [
  // DEFAULT bucket
  ['DEFAULT', 'banner-slides/test-background-video.mp4'],
  ['DEFAULT', 'banner-slides/background-video.mp4'],
  ['DEFAULT', 'banner-slides/BackgroundVideo.mp4'],
  ['DEFAULT', 'videos/test-background-video.mp4'],
  ['DEFAULT', 'videos/background-video.mp4'],
  ['DEFAULT', 'videos/BackgroundVideo.mp4']
];

async function uploadVideoToStorage() {
  try {
    console.log('Starting direct video upload to Replit Object Storage...');
    
    // Check if source video exists
    if (!fs.existsSync(SOURCE_VIDEO_PATH)) {
      console.error(`Source video not found at: ${SOURCE_VIDEO_PATH}`);
      return;
    }
    
    console.log(`Using source video: ${SOURCE_VIDEO_PATH}`);
    
    // Read the video file
    const videoData = fs.readFileSync(SOURCE_VIDEO_PATH);
    console.log(`Read ${videoData.length} bytes from video file`);
    
    console.log('Starting uploads with different paths to support fallbacks...');
    
    const results = [];
    
    // Process each upload destination
    for (const [bucketName, objectKey] of UPLOAD_DESTINATIONS) {
      try {
        console.log(`Uploading to ${bucketName}/${objectKey}...`);
        
        // Write video data to a temporary file
        const tempFilePath = `/tmp/${Date.now()}-${path.basename(objectKey)}`;
        fs.writeFileSync(tempFilePath, videoData);
        
        // Upload directly to Replit Object Storage using uploadFromFilename
        const result = await storage.uploadFromFilename(objectKey, tempFilePath, {
          contentType: 'video/mp4',
          bucketName: bucketName
        });
        
        // Clean up temp file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        
        if (!result.ok) {
          throw new Error(`Upload failed: ${result.error.message}`);
        }
        
        // Generate the URL to the object
        const url = `https://object-storage.replit.app/${bucketName}/${objectKey}`;
        console.log(`✅ Success: ${url}`);
        results.push({ bucketName, objectKey, url, success: true });
      } catch (error) {
        console.error(`❌ Failed uploading to ${bucketName}/${objectKey}:`, error.message);
        results.push({ bucketName, objectKey, error: error.message, success: false });
      }
    }
    
    // Print summary
    console.log('\n=== Upload Summary ===');
    console.log(`Total uploads attempted: ${UPLOAD_DESTINATIONS.length}`);
    console.log(`Successful uploads: ${results.filter(r => r.success).length}`);
    console.log(`Failed uploads: ${results.filter(r => !r.success).length}`);
    
    console.log('\n== Successful Upload URLs ==');
    results.filter(r => r.success).forEach(r => {
      console.log(`${r.bucketName}/${r.objectKey}: ${r.url}`);
    });
    
    if (results.some(r => !r.success)) {
      console.log('\n== Failed Uploads ==');
      results.filter(r => !r.success).forEach(r => {
        console.log(`${r.bucketName}/${r.objectKey}: ${r.error}`);
      });
    }
    
  } catch (error) {
    console.error('Error in upload process:', error);
  }
}

// Run the upload
uploadVideoToStorage().then(() => {
  console.log('Upload process completed');
});