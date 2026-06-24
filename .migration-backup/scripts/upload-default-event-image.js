/**
 * Upload the default event image to Object Storage
 * 
 * This script uploads the default event image from the filesystem
 * to Replit Object Storage in the CALENDAR bucket.
 */

import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Path to the default event image
const DEFAULT_EVENT_IMAGE_PATH = path.join(rootDir, 'uploads', 'calendar', 'default-event-image.svg');

// Confirm the file exists
if (!fs.existsSync(DEFAULT_EVENT_IMAGE_PATH)) {
  console.error('Default event image not found at:', DEFAULT_EVENT_IMAGE_PATH);
  process.exit(1);
}

// Create Object Storage client
const client = new Client();

async function uploadDefaultImage() {
  try {
    console.log('Reading the default event image from:', DEFAULT_EVENT_IMAGE_PATH);
    
    // Define the destination path in Object Storage
    const destinationPath = 'events/default-event-image.svg';
    
    console.log(`Uploading to Object Storage as: ${destinationPath} in CALENDAR bucket`);
    
    // Upload to Object Storage with explicit content type
    const result = await client.uploadFromFilename(
      destinationPath,
      DEFAULT_EVENT_IMAGE_PATH, 
      {
        contentType: 'image/svg+xml',
        bucketName: 'CALENDAR' // Specify the bucket
      }
    );
    
    if (result.ok) {
      console.log('✅ Successfully uploaded default event image to Object Storage');
      console.log(`URL: https://object-storage.replit.app/CALENDAR/${destinationPath}`);
    } else {
      console.error('❌ Error uploading default event image:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Execute the upload function
uploadDefaultImage();