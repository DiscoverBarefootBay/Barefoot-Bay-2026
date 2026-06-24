/**
 * Script to upload rocket icon to Replit Object Storage for persistence
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('@replit/object-storage');

// Setup Object Storage client
const client = new Client();
const BUCKET = 'DEFAULT'; // Use DEFAULT bucket

// Import the object storage service if available (for upload helper methods)
let objectStorageService;
try {
  objectStorageService = require('./server/object-storage-service').objectStorageService;
  console.log('Successfully imported object storage service from server directory');
} catch (err) {
  console.log('Could not import object storage service, will use client directly:', err.message);
}

async function uploadRocketIcon() {
  const iconPath = path.join(process.cwd(), 'temp_upload', 'rocket-icon.svg');
  
  try {
    // Read the file
    const fileContent = fs.readFileSync(iconPath);
    console.log(`File size: ${fileContent.length} bytes`);
    
    // Upload to Object Storage using the correct method (uploadFromFilename)
    console.log('Uploading Asset1.svg...');
    // First save the file content to a temporary file
    const tempFilePath = path.join(process.cwd(), 'temp_upload', 'rocket-icon-temp.svg');
    fs.writeFileSync(tempFilePath, fileContent);
    
    // Use the uploadFromFilename method that exists in the Client
    const uploadOptions = {
      contentType: 'image/svg+xml',
      bucketName: BUCKET,
      headers: {
        'X-Obj-Bucket': BUCKET,
        'Content-Type': 'image/svg+xml'
      }
    };
    
    // Upload each variant of the icon
    console.log(`Uploading with options: ${JSON.stringify(uploadOptions)}`);
    
    await client.uploadFromFilename('icons/Asset1.svg', tempFilePath, uploadOptions);
    console.log('Uploaded Asset1.svg');
    
    await client.uploadFromFilename('icons/Asset 1.svg', tempFilePath, uploadOptions);
    console.log('Uploaded Asset 1.svg');
    
    await client.uploadFromFilename('icons/rocket-icon.svg', tempFilePath, uploadOptions);
    console.log('Uploaded rocket-icon.svg');
    
    console.log('Successfully uploaded rocket icons to Object Storage:');
    console.log('icons/Asset1.svg');
    console.log('icons/Asset 1.svg');
    console.log('icons/rocket-icon.svg');
    
    // Create a helper to get object storage URLs
    const baseUrl = 'https://object-storage.replit.app';
    
    console.log('\nAccess URLs:');
    console.log(`${baseUrl}/${BUCKET}/icons/Asset1.svg`);
    console.log(`${baseUrl}/${BUCKET}/icons/Asset%201.svg`);
    console.log(`${baseUrl}/${BUCKET}/icons/rocket-icon.svg`);
    
  } catch (error) {
    console.error('Error uploading rocket icon:', error);
  }
}

uploadRocketIcon();