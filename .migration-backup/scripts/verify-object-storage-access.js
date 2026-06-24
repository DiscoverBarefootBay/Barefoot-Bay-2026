/**
 * Simple script to verify access to banner slide images in Replit Object Storage
 * 
 * This script:
 * 1. Retrieves and lists all banner slide images in the DEFAULT bucket
 * 2. Verifies the content type and size of selected images
 * 3. Prints out URLs that can be used to access the images
 * 
 * Usage:
 * node scripts/verify-object-storage-access.js
 */

import { Client } from '@replit/object-storage';
import fetch from 'node-fetch';

// Constants
const BUCKET = 'DEFAULT';
const PREFIX = 'banner-slides/';
const BASE_URL = 'https://object-storage.replit.app';

// Initialize Replit Object Storage client
const client = new Client();

/**
 * Get a list of all banner slide images in object storage
 */
async function listBannerSlideImages() {
  console.log(`Retrieving banner slide images from ${BUCKET}/${PREFIX}...`);
  try {
    const result = await client.list({
      bucketName: BUCKET,
      prefix: PREFIX,
      maxResults: 100
    });

    if (!result.ok) {
      throw new Error(`Failed to list files: ${result.error.message}`);
    }

    console.log(`Found ${result.value.length} files in ${BUCKET}/${PREFIX}`);
    
    // Sort files by name
    const files = result.value.sort((a, b) => a.name.localeCompare(b.name));
    
    // Group files by extension
    const filesByExtension = {};
    for (const file of files) {
      const extension = file.name.split('.').pop().toLowerCase();
      if (!filesByExtension[extension]) {
        filesByExtension[extension] = [];
      }
      filesByExtension[extension].push(file);
    }
    
    // Print summary by extension
    console.log('\n=== Files by Extension ===');
    for (const [extension, fileList] of Object.entries(filesByExtension)) {
      console.log(`${extension.toUpperCase()}: ${fileList.length} files`);
    }
    
    // Print a few sample files with details
    console.log('\n=== Sample Files ===');
    const sampleFiles = files.slice(0, 5);
    for (const file of sampleFiles) {
      const url = `${BASE_URL}/${BUCKET}/${file.name}`;
      console.log(`Name: ${file.name}`);
      console.log(`Size: ${formatSize(file.size)}`);
      console.log(`URL: ${url}`);
      console.log('---');
    }
    
    return files;
  } catch (error) {
    console.error('Error listing banner slide images:', error);
    return [];
  }
}

/**
 * Verify access to an image in object storage
 */
async function verifyImageAccess(imageName) {
  const storageKey = `${PREFIX}${imageName}`;
  console.log(`Verifying access to ${storageKey}...`);
  
  try {
    // Check if the file exists using the list API
    const listResult = await client.list({
      bucketName: BUCKET,
      prefix: storageKey,
      maxResults: 1
    });
    
    if (!listResult.ok) {
      throw new Error(`Failed to list files: ${listResult.error.message}`);
    }
    
    const fileExists = listResult.value.some(file => file.name === storageKey);
    
    if (!fileExists) {
      console.log(`❌ File not found in object storage: ${storageKey}`);
      return false;
    }
    
    // Try to download the file to verify true access
    const downloadResult = await client.downloadAsBytes(storageKey, {
      bucketName: BUCKET
    });
    
    if (!downloadResult.ok) {
      throw new Error(`Failed to download file: ${downloadResult.error.message}`);
    }
    
    // Get file metadata - Replit Object Storage API doesn't have a direct getMetadata method
    // We'll use the information we have from the list operation
    const fileMetadata = listResult.value.find(file => file.name === storageKey);
    
    if (!fileMetadata) {
      throw new Error('Failed to get metadata: File information not found');
    }
    
    const metadata = {
      contentType: fileMetadata.contentType || 'application/octet-stream',
      size: fileMetadata.size || 0,
      lastModified: fileMetadata.lastModified || new Date().toISOString()
    };
    
    console.log(`✅ Successfully accessed ${imageName}`);
    console.log(`Content-Type: ${metadata.contentType || 'unknown'}`);
    console.log(`Content-Length: ${formatSize(metadata.size || 0)}`);
    console.log(`Last-Modified: ${metadata.lastModified || 'unknown'}`);
    
    // This is the URL that would be used in production
    const url = `${BASE_URL}/${BUCKET}/${storageKey}`;
    console.log(`URL: ${url}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error accessing ${imageName}:`, error);
    return false;
  }
}

/**
 * Format file size in human-readable format
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Main function
 */
async function main() {
  console.log('=== Replit Object Storage Banner Slides Verification ===');
  
  // List all banner slide images
  const files = await listBannerSlideImages();
  
  if (files.length === 0) {
    console.log('No banner slide images found in object storage.');
    return;
  }
  
  // Select a few images to verify access
  const imageNames = [
    'placeholder-banner.png',  // Placeholder image
    'bannerImage-1745531793603-403842876.jpg',  // Small JPEG image
    'bannerImage-1745738650575-738472062.png',  // Medium PNG image
    'bannerImage-1746160221838-423724539.png'   // Recent PNG image
  ];
  
  console.log('\n=== Verifying Access to Selected Images ===');
  for (const imageName of imageNames) {
    await verifyImageAccess(imageName);
    console.log('');
  }
  
  console.log('\n=== Image URLs for Web Access ===');
  for (const imageName of imageNames) {
    console.log(`${imageName}: ${BASE_URL}/${BUCKET}/${PREFIX}${imageName}`);
  }
}

// Run the main function
main().catch(console.error);