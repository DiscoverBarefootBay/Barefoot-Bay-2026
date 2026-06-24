/**
 * Test script for uploading videos to the Replit Object Storage
 * This script tests the video upload flow specifically for banner slides
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Get current file and directory paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SERVER_URL = 'http://localhost:5000';
const MEDIA_TYPE = 'banner-slides';
const VIDEO_PATH = path.join(__dirname, '..', 'public', 'static', 'videos', 'test-background-video.mp4');
const OUTPUT_DIR = path.join(__dirname, '..', 'uploads', 'banner-slides');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function testVideoUpload() {
  try {
    console.log('Starting video upload test...');
    
    // Check if test video exists
    if (!fs.existsSync(VIDEO_PATH)) {
      console.error(`Test video not found at: ${VIDEO_PATH}`);
      return;
    }
    
    console.log(`Using test video: ${VIDEO_PATH}`);
    
    // Create a form data object
    const formData = new FormData();
    formData.append('mediaType', MEDIA_TYPE);
    formData.append('file', fs.createReadStream(VIDEO_PATH));
    
    // Upload to server
    console.log('Uploading video to server...');
    const response = await fetch(`${SERVER_URL}/api/upload`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
    });
    
    // Parse response
    const result = await response.json();
    
    // Log result
    console.log('Upload Response:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ Video upload successful');
      console.log('URL:', result.url);
      console.log('Object Storage URL:', result.objectStorageUrl);
      
      // Verify the Object Storage URL is accessible
      try {
        console.log('Verifying Object Storage URL...');
        const verifyResponse = await fetch(result.objectStorageUrl);
        
        if (verifyResponse.ok) {
          console.log('✅ Object Storage URL is accessible');
        } else {
          console.error('❌ Object Storage URL returned status:', verifyResponse.status);
        }
      } catch (verifyError) {
        console.error('❌ Failed to verify Object Storage URL:', verifyError.message);
      }
    } else {
      console.error('❌ Video upload failed:', result.message);
    }
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testVideoUpload().then(() => {
  console.log('Test completed');
});