/**
 * Upload Default Forum Images to Object Storage
 * 
 * This script creates and uploads default forum images to the FORUM bucket
 * to be used as fallbacks when forum media is not found.
 */

import { Client } from '@replit/object-storage';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const FORUM_BUCKET = 'FORUM';
const DEFAULT_FORUM_IMAGE_NAME = 'default-forum-image.svg';
const FORUM_PLACEHOLDER_NAME = 'forum-placeholder.svg';

// Create the SVG content for default images
const defaultForumImageSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#f0f2f5"/>
  <rect x="200" y="150" width="400" height="300" rx="10" fill="#dfe3e8"/>
  <path d="M430,250 L370,350 L400,350 L370,450" stroke="#a0aec0" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="450" cy="250" r="30" fill="#a0aec0"/>
  <text x="400" y="480" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#5c6b7a">Forum Image</text>
</svg>`;

const forumPlaceholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#e6f2ff"/>
  <rect x="150" y="100" width="500" height="400" rx="15" fill="#cce0ff"/>
  <line x1="250" y1="200" x2="550" y2="200" stroke="#6699cc" stroke-width="10" stroke-linecap="round"/>
  <line x1="250" y1="250" x2="450" y2="250" stroke="#6699cc" stroke-width="10" stroke-linecap="round"/>
  <line x1="250" y1="300" x2="500" y2="300" stroke="#6699cc" stroke-width="10" stroke-linecap="round"/>
  <line x1="250" y1="350" x2="350" y2="350" stroke="#6699cc" stroke-width="10" stroke-linecap="round"/>
  <circle cx="350" cy="430" r="30" fill="#6699cc"/>
  <text x="400" y="500" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#336699">Forum Post</text>
</svg>`;

/**
 * Upload an SVG as a default forum image
 * @param {string} filename - Name of the file to create
 * @param {string} svgContent - SVG content to upload
 * @returns {Promise<Object>} Upload result
 */
async function uploadDefaultImage(filename, svgContent) {
  try {
    console.log(`Preparing to upload ${filename} to Object Storage...`);
    
    // Create a temporary file
    const tempPath = path.join(__dirname, filename);
    fs.writeFileSync(tempPath, svgContent);
    
    // Initialize Object Storage client
    const client = new Client();
    
    // Upload to Object Storage
    const key = `forum/${filename}`;
    console.log(`Uploading to Object Storage with key: ${key}`);
    
    const uploadOptions = {
      contentType: 'image/svg+xml',
      bucketName: FORUM_BUCKET
    };
    
    const result = await client.uploadFromFilename(key, tempPath, uploadOptions);
    
    if (!result.ok) {
      throw new Error(`Upload failed: ${result.error.message}`);
    }
    
    console.log(`Successfully uploaded ${filename} to ${FORUM_BUCKET}/${key}`);
    
    // Clean up temporary file
    fs.unlinkSync(tempPath);
    
    return {
      success: true,
      key: key,
      url: `https://object-storage.replit.app/${FORUM_BUCKET}/${key}`,
      proxyUrl: `/api/storage-proxy/${FORUM_BUCKET}/${key}`
    };
  } catch (error) {
    console.error(`Error uploading ${filename}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload all default forum images
 */
async function uploadDefaultForumImages() {
  console.log('Starting to upload default forum images...');
  
  // Upload default forum image
  const defaultResult = await uploadDefaultImage(DEFAULT_FORUM_IMAGE_NAME, defaultForumImageSvg);
  console.log('Default forum image result:', defaultResult);
  
  // Upload forum placeholder
  const placeholderResult = await uploadDefaultImage(FORUM_PLACEHOLDER_NAME, forumPlaceholderSvg);
  console.log('Forum placeholder result:', placeholderResult);
  
  console.log('All default forum images have been processed.');
}

// Execute the function
uploadDefaultForumImages().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});