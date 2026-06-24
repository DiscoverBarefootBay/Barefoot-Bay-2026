/**
 * Direct video upload to Object Storage
 * This script directly uses the object-storage-service to upload the test video
 * with multiple common filenames to support the background video component fallbacks
 */

const fs = require('fs');
const path = require('path');
const { objectStorageService } = require('../dist/server/object-storage-service');

// Source video configuration
const SOURCE_VIDEO_PATH = path.join(__dirname, '..', 'public', 'static', 'videos', 'test-background-video.mp4');

// Upload destinations with format: [mediaType, destinationFilename]
const UPLOAD_DESTINATIONS = [
  // Videos folder
  ['videos', 'test-background-video.mp4'],
  ['videos', 'background-video.mp4'],
  ['videos', 'BackgroundVideo.mp4'],
  
  // Banner slides folder
  ['banner-slides', 'test-background-video.mp4'],
  ['banner-slides', 'background-video.mp4'],
  ['banner-slides', 'BackgroundVideo.mp4'],
  
  // Banner folder
  ['banner', 'test-background-video.mp4'],
  ['banner', 'background-video.mp4'], 
  ['banner', 'BackgroundVideo.mp4']
];

async function uploadVideoToStorage() {
  try {
    console.log('Starting direct video upload to Object Storage with multiple filenames...');
    
    // Check if source video exists
    if (!fs.existsSync(SOURCE_VIDEO_PATH)) {
      console.error(`Source video not found at: ${SOURCE_VIDEO_PATH}`);
      return;
    }
    
    console.log(`Using source video: ${SOURCE_VIDEO_PATH}`);
    console.log('Starting uploads with different filenames to support fallbacks...');
    
    const results = [];
    
    // Process each upload destination
    for (const [mediaType, filename] of UPLOAD_DESTINATIONS) {
      try {
        console.log(`Uploading to ${mediaType}/${filename}...`);
        const url = await objectStorageService.uploadFile(SOURCE_VIDEO_PATH, mediaType, filename);
        console.log(`✅ Success: ${url}`);
        results.push({ mediaType, filename, url, success: true });
      } catch (error) {
        console.error(`❌ Failed uploading to ${mediaType}/${filename}:`, error.message);
        results.push({ mediaType, filename, error: error.message, success: false });
      }
    }
    
    // Print summary
    console.log('\n=== Upload Summary ===');
    console.log(`Total uploads attempted: ${UPLOAD_DESTINATIONS.length}`);
    console.log(`Successful uploads: ${results.filter(r => r.success).length}`);
    console.log(`Failed uploads: ${results.filter(r => !r.success).length}`);
    
    console.log('\n== Successful Upload URLs ==');
    results.filter(r => r.success).forEach(r => {
      console.log(`${r.mediaType}/${r.filename}: ${r.url}`);
    });
    
    if (results.some(r => !r.success)) {
      console.log('\n== Failed Uploads ==');
      results.filter(r => !r.success).forEach(r => {
        console.log(`${r.mediaType}/${r.filename}: ${r.error}`);
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