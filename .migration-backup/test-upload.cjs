/**
 * Script to manually upload a specific file to Object Storage
 */
const { Client } = require('@replit/object-storage');
const fs = require('fs');
const path = require('path');

// Initialize the client
const client = new Client();

// File details
const FILE_PATH = '/home/runner/workspace/uploads/calendar/media-1746247882901-166640615.png';
const BUCKET = 'CALENDAR';
const TARGET_PATH = 'calendar/media-1746247882901-166640615.png';

async function uploadFile() {
  try {
    console.log(`Checking if file exists at ${FILE_PATH}...`);
    
    if (!fs.existsSync(FILE_PATH)) {
      console.error(`File not found: ${FILE_PATH}`);
      return;
    }
    
    // Get file stats
    const fileStats = fs.statSync(FILE_PATH);
    console.log(`File exists: ${fileStats.size} bytes`);
    
    // Determine content type based on extension
    const fileExtension = path.extname(FILE_PATH).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (fileExtension === '.png') contentType = 'image/png';
    else if (fileExtension === '.jpg' || fileExtension === '.jpeg') contentType = 'image/jpeg';
    else if (fileExtension === '.gif') contentType = 'image/gif';
    else if (fileExtension === '.webp') contentType = 'image/webp';
    
    console.log(`Content type: ${contentType}`);
    
    // Upload the file
    console.log(`Uploading to ${BUCKET}/${TARGET_PATH}...`);
    const result = await client.uploadFromFilename(TARGET_PATH, FILE_PATH, {
      contentType,
      bucketName: BUCKET
    });
    
    if (result.ok) {
      console.log('Upload successful!');
      console.log(`URL: https://object-storage.replit.app/${BUCKET}/${TARGET_PATH}`);
    } else {
      console.error(`Upload failed: ${result.error.message}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the upload
uploadFile();