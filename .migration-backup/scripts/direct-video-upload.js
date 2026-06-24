/**
 * Direct Video Upload to Object Storage
 * 
 * This script directly uploads a video file to Replit Object Storage
 * bypassing the need for compiled code from the dist directory.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@replit/object-storage';

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const BUCKET = 'DEFAULT'; // General bucket for homepage media
const MEDIA_TYPE = 'banner';
const FILENAME = 'BackgroundVideo.mp4';
const VIDEO_PATH = path.join(__dirname, '../client/public/static/videos/BackgroundVideo.mp4');
const BASE_URL = 'https://object-storage.replit.app';

async function uploadVideo() {
  try {
    console.log(`Checking if video exists at: ${VIDEO_PATH}`);
    if (!fs.existsSync(VIDEO_PATH)) {
      throw new Error(`Video file not found at ${VIDEO_PATH}`);
    }
    
    console.log('Reading video file...');
    const fileBuffer = fs.readFileSync(VIDEO_PATH);
    console.log(`File size: ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB`);
    
    // Initialize Replit Object Storage client
    console.log('Initializing Replit Object Storage client...');
    const client = new Client();
    
    // Generate storage key
    const storageKey = `${MEDIA_TYPE}/${FILENAME}`;
    
    console.log(`Uploading video to ${BUCKET}/${storageKey}...`);
    await client.put(storageKey, fileBuffer, {
      contentType: 'video/mp4', 
      metadata: {
        originalPath: VIDEO_PATH,
        uploadDate: new Date().toISOString(),
        fileSize: String(fileBuffer.length),
        bucket: BUCKET
      }
    });
    
    // Generate and save URL for reference
    const videoUrl = `${BASE_URL}/${BUCKET}/${storageKey}`;
    console.log(`Video uploaded successfully.`);
    console.log(`Video URL: ${videoUrl}`);
    
    // Save the URL to a reference file
    const referenceFilePath = path.join(__dirname, '../video-storage-url.txt');
    fs.writeFileSync(referenceFilePath, videoUrl);
    console.log(`URL saved to: ${referenceFilePath}`);
    
    return videoUrl;
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
}

// Execute the function
uploadVideo()
  .then(url => {
    console.log('Completed successfully.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed to upload video:', error);
    process.exit(1);
  });