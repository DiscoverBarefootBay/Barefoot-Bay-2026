/**
 * Fix Background Video by copying to Replit Object Storage
 * 
 * This script copies the background video to the correct paths in Replit Object Storage
 * and ensures it's properly loaded on the site.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@replit/object-storage';

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize storage client
const storage = new Client();

// Configuration - upload destinations with format: [bucketName, objectKey]
const UPLOAD_DESTINATIONS = [
  // DEFAULT bucket - Main paths
  ['DEFAULT', 'banner-slides/BackgroundVideo.mp4'],
  ['DEFAULT', 'videos/BackgroundVideo.mp4'],
  // DEFAULT bucket - Alternative filenames
  ['DEFAULT', 'banner-slides/background-video.mp4'],
  ['DEFAULT', 'videos/background-video.mp4']
];

// Potential local source files to use
const SOURCE_FILES = [
  path.join(__dirname, '..', 'public', 'static', 'videos', 'BackgroundVideo.mp4'),
  path.join(__dirname, '..', 'client', 'public', 'static', 'videos', 'BackgroundVideo.mp4'),
  path.join(__dirname, '..', 'static', 'videos', 'BackgroundVideo.mp4'),
  path.join(__dirname, '..', 'uploads', 'banner-slides', 'background-video.mp4')
];

async function fixBackgroundVideo() {
  console.log('Starting background video fix...');
  
  // Find the first available source file
  let sourceFile = null;
  
  for (const file of SOURCE_FILES) {
    try {
      if (fs.existsSync(file)) {
        console.log(`Found source video at: ${file}`);
        sourceFile = file;
        break;
      }
    } catch (err) {
      console.log(`Error checking ${file}: ${err.message}`);
    }
  }
  
  if (!sourceFile) {
    console.error('No source video file found. Please upload a video file to one of these locations:');
    SOURCE_FILES.forEach(file => console.log(`  - ${file}`));
    return false;
  }
  
  console.log(`Using source video: ${sourceFile}`);
  
  // Read the video file size
  const stats = fs.statSync(sourceFile);
  console.log(`Source file size: ${stats.size} bytes`);
  
  // Upload the video to all specified paths in Object Storage
  const results = [];
  
  // Process each upload destination
  for (const [bucketName, objectKey] of UPLOAD_DESTINATIONS) {
    try {
      console.log(`Uploading to ${bucketName}/${objectKey}...`);
      
      // Write video data to a temporary file
      const tempFilePath = `/tmp/${Date.now()}-${path.basename(objectKey)}`;
      fs.copyFileSync(sourceFile, tempFilePath);
      
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
  
  return results.some(r => r.success);
}

// Run the fix
fixBackgroundVideo()
  .then(success => {
    if (success) {
      console.log('\nBackground video has been successfully fixed. The video should now load properly from Object Storage.');
      console.log('Please restart the application to see the changes.');
    } else {
      console.error('\nFailed to fix background video. Please check the errors above and try again.');
    }
  })
  .catch(err => {
    console.error('Unhandled error:', err);
  });