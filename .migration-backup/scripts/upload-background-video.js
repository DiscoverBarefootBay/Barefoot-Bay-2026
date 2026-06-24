/**
 * Upload Background Video to Replit Object Storage
 * 
 * This script uploads the background video file to Replit Object Storage
 * in the DEFAULT bucket for use on the homepage.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { objectStorageService } from '../dist/server/object-storage-service.js';

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the source video file
const videoPath = path.join(__dirname, '../client/public/static/videos/BackgroundVideo.mp4');
// Target media type (maps to DEFAULT bucket)
const mediaType = 'banner'; 
// Target filename in object storage
const filename = 'BackgroundVideo.mp4';

async function uploadBackgroundVideo() {
  try {
    console.log('Checking if video file exists...');
    if (!fs.existsSync(videoPath)) {
      console.error(`Error: Video file not found at ${videoPath}`);
      return;
    }
    
    // Get file data
    console.log(`Reading video file from ${videoPath}...`);
    const videoBuffer = fs.readFileSync(videoPath);
    
    // Upload to Replit Object Storage in DEFAULT bucket
    console.log(`Uploading video to Replit Object Storage (${mediaType}/${filename})...`);
    const url = await objectStorageService.uploadData(
      videoBuffer,
      mediaType,
      filename,
      'video/mp4'
    );
    
    console.log('Video upload successful!');
    console.log(`Video is now available at: ${url}`);
    
    // Create a reference file with the URL
    const referenceFilePath = path.join(__dirname, '../video-storage-url.txt');
    fs.writeFileSync(referenceFilePath, url);
    console.log(`Saved video URL reference to ${referenceFilePath}`);
    
    return url;
  } catch (error) {
    console.error('Error uploading background video:', error);
    throw error;
  }
}

// Run the upload function
uploadBackgroundVideo()
  .then(url => {
    console.log('Background video upload completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Background video upload failed:', error);
    process.exit(1);
  });