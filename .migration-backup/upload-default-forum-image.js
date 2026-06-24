/**
 * Upload Default Forum Images to Object Storage
 * 
 * This script creates and uploads default forum images to the FORUM bucket
 * to be used as fallbacks when forum media is not found.
 */

const { Client } = require('@replit/object-storage');
const fs = require('fs');
const path = require('path');

// Constants
const FORUM_BUCKET = 'FORUM';
const FORUM_DIR = 'forum';

// Create object storage client
const client = new Client();

// Default forum image SVG content (simple placeholder with "BB Forum" text)
const defaultForumImageSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="100%" height="100%" fill="#f3f4f6"/>
  <rect x="50" y="50" width="700" height="500" rx="15" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
  <text x="400" y="250" font-family="Arial, sans-serif" font-size="48" text-anchor="middle" fill="#4b5563">
    BB Forum Image
  </text>
  <text x="400" y="310" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#6b7280">
    Default forum media placeholder
  </text>
  <path d="M400 350 L450 400 L350 400 Z" fill="#9ca3af"/>
</svg>`;

// Forum placeholder SVG for missing media (similar with a different message)
const forumPlaceholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="100%" height="100%" fill="#f3f4f6"/>
  <rect x="50" y="50" width="700" height="500" rx="15" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
  <text x="400" y="250" font-family="Arial, sans-serif" font-size="48" text-anchor="middle" fill="#4b5563">
    Forum Media
  </text>
  <text x="400" y="310" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#6b7280">
    Image placeholder for missing forum media
  </text>
  <path d="M350 360 L450 360 L400 410 Z" fill="#9ca3af"/>
  <line x1="300" y1="450" x2="500" y2="450" stroke="#9ca3af" stroke-width="2"/>
  <line x1="350" y1="470" x2="450" y2="470" stroke="#9ca3af" stroke-width="2"/>
</svg>`;

/**
 * Upload an SVG as a default forum image
 * @param {string} filename - Name of the file to create
 * @param {string} svgContent - SVG content to upload
 * @returns {Promise<Object>} Upload result
 */
async function uploadDefaultImage(filename, svgContent) {
  try {
    console.log(`Uploading ${filename} to ${FORUM_BUCKET}/${FORUM_DIR}/${filename}...`);
    
    // Create the full storage key for the file
    const storageKey = `${FORUM_DIR}/${filename}`;
    
    // First create a temporary file
    const tempFilePath = path.join('/tmp', filename);
    fs.writeFileSync(tempFilePath, svgContent);
    
    // Upload the file to Object Storage
    const result = await client.uploadFromFilename(storageKey, tempFilePath, {
      contentType: 'image/svg+xml',
      bucketName: FORUM_BUCKET
    });
    
    // Clean up temporary file
    fs.unlinkSync(tempFilePath);
    
    if (result.ok) {
      console.log(`Successfully uploaded ${filename} to ${FORUM_BUCKET}/${storageKey}`);
      return {
        success: true,
        url: `https://object-storage.replit.app/${FORUM_BUCKET}/${storageKey}`
      };
    } else {
      console.error(`Failed to upload ${filename}:`, result.error);
      return { 
        success: false, 
        error: result.error.message
      };
    }
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
  try {
    console.log('Starting upload of default forum images...');
    
    // Upload the main default forum image
    const defaultImageResult = await uploadDefaultImage('default-forum-image.svg', defaultForumImageSvg);
    console.log('Default forum image result:', defaultImageResult);
    
    // Upload the placeholder for missing images
    const placeholderResult = await uploadDefaultImage('forum-placeholder.svg', forumPlaceholderSvg);
    console.log('Forum placeholder result:', placeholderResult);
    
    // Final summary
    if (defaultImageResult.success && placeholderResult.success) {
      console.log('All default forum images successfully uploaded!');
      console.log('URLs:');
      console.log(`- Default forum image: ${defaultImageResult.url}`);
      console.log(`- Forum placeholder: ${placeholderResult.url}`);
      console.log('You can access these through the storage proxy at:');
      console.log(`- /api/storage-proxy/${FORUM_BUCKET}/${FORUM_DIR}/default-forum-image.svg`);
      console.log(`- /api/storage-proxy/${FORUM_BUCKET}/${FORUM_DIR}/forum-placeholder.svg`);
    } else {
      console.error('Some uploads failed. Please check the error messages above.');
    }
  } catch (error) {
    console.error('Error in upload process:', error);
  }
}

// Execute the upload
uploadDefaultForumImages().catch(console.error);