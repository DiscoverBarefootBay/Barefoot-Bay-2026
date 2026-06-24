/**
 * Copy Default Event Image to Object Storage
 * 
 * This script ensures that the default event image is available in the correct location
 * in Object Storage to serve as fallback when event media is not available.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ObjectStorageService } from '@replit/object-storage';

// Get current directory (ES modules don't have __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Object Storage client
const objectStorage = new ObjectStorageService();

// Default event image SVG data
const defaultEventImageSVG = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="400" height="300" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="#E5E7EB"/>
  <path d="M200 150C179.033 150 162 167.033 162 188C162 208.967 179.033 226 200 226C220.967 226 238 208.967 238 188C238 167.033 220.967 150 200 150ZM200 214C185.663 214 174 202.337 174 188C174 173.663 185.663 162 200 162C214.337 162 226 173.663 226 188C226 202.337 214.337 214 200 214Z" fill="#9CA3AF"/>
  <path d="M200 138C206.627 138 212 132.627 212 126C212 119.373 206.627 114 200 114C193.373 114 188 119.373 188 126C188 132.627 193.373 138 200 138Z" fill="#9CA3AF"/>
  <path d="M244 126C250.627 126 256 120.627 256 114C256 107.373 250.627 102 244 102C237.373 102 232 107.373 232 114C232 120.627 237.373 126 244 126Z" fill="#9CA3AF"/>
  <path d="M156 126C162.627 126 168 120.627 168 114C168 107.373 162.627 102 156 102C149.373 102 144 107.373 144 114C144 120.627 149.373 126 156 126Z" fill="#9CA3AF"/>
  <path d="M244 174C250.627 174 256 168.627 256 162C256 155.373 250.627 150 244 150C237.373 150 232 155.373 232 162C232 168.627 237.373 174 244 174Z" fill="#9CA3AF"/>
  <path d="M156 174C162.627 174 168 168.627 168 162C168 155.373 162.627 150 156 150C149.373 150 144 155.373 144 162C144 168.627 149.373 174 156 174Z" fill="#9CA3AF"/>
  <text x="200" y="260" font-family="Arial" font-size="16" fill="#4B5563" text-anchor="middle">Event Image Not Available</text>
</svg>`;

// Locations where default event image should be available
const targetLocations = [
  {
    bucket: 'CALENDAR',
    path: 'events/default-event-image.svg'
  },
  {
    bucket: 'DEFAULT',
    path: 'events/default-event-image.svg'
  }
];

// Save SVG to a temporary file
async function saveToTempFile() {
  const tempPath = path.join(__dirname, 'temp-default-event.svg');
  fs.writeFileSync(tempPath, defaultEventImageSVG);
  return tempPath;
}

// Upload the default image to all target locations
async function uploadToAllLocations() {
  try {
    console.log('Starting upload of default event image to Object Storage...');
    
    // Save to temp file first
    const tempFilePath = await saveToTempFile();
    console.log(`Saved default image to temporary file: ${tempFilePath}`);
    
    // Upload to each target location
    for (const target of targetLocations) {
      try {
        console.log(`Uploading to bucket: ${target.bucket}, path: ${target.path}...`);
        
        const result = await objectStorage.uploadFromFilename(
          target.path,
          tempFilePath,
          {
            contentType: 'image/svg+xml',
            bucketName: target.bucket
          }
        );
        
        if (result.ok) {
          console.log(`Successfully uploaded to ${target.bucket}/${target.path}`);
        } else {
          console.error(`Failed to upload to ${target.bucket}/${target.path}: ${result.error.message}`);
        }
      } catch (uploadError) {
        console.error(`Error uploading to ${target.bucket}/${target.path}:`, uploadError);
      }
    }
    
    // Clean up the temp file
    fs.unlinkSync(tempFilePath);
    console.log('Cleaned up temporary file');
    
    console.log('Default event image upload process complete');
  } catch (error) {
    console.error('Error in upload process:', error);
  }
}

// Run the upload process
uploadToAllLocations();