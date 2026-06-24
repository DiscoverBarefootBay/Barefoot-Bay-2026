/**
 * Script to check files in Replit Object Storage
 */

import { Client } from '@replit/object-storage';

// Initialize the storage client
const storage = new Client();

// Bucket to check
const BUCKET = 'DEFAULT';

// Paths to check
const PATHS_TO_CHECK = [
  'videos/BackgroundVideo.mp4',
  'banner-slides/BackgroundVideo.mp4'
];

async function checkStoredFiles() {
  console.log(`Checking files in ${BUCKET} bucket...`);
  
  // List all files with bucket prefix
  try {
    console.log('\nListing all files in bucket:');
    const listResult = await storage.list({ 
      bucketName: BUCKET,
      maxResults: 50 
    });
    
    if (!listResult.ok) {
      console.error(`Error listing files: ${listResult.error.message}`);
      return;
    }
    
    console.log(`Found ${listResult.value.length} files in ${BUCKET} bucket:`);
    listResult.value.forEach(file => {
      const lastModified = file.lastModified ? 
        (typeof file.lastModified.toISOString === 'function' ? 
          file.lastModified.toISOString() : 
          'Unknown date') : 
        'No date available';
      console.log(` - ${file.name} (${Math.round(file.size / 1024) || 0} KB, Last modified: ${lastModified})`);
    });
  } catch (error) {
    console.error('Error listing files:', error);
  }
  
  // Check specific paths
  console.log('\nChecking specific paths:');
  for (const path of PATHS_TO_CHECK) {
    try {
      console.log(`\nChecking ${BUCKET}/${path}...`);
      
      // Try to list with this path as prefix to see if it exists
      const result = await storage.list({ 
        bucketName: BUCKET, 
        prefix: path,
        maxResults: 1 
      });
      
      if (!result.ok) {
        console.error(`Error checking path: ${result.error.message}`);
        continue;
      }
      
      const exists = result.value.some(item => item.name === path);
      
      if (exists) {
        console.log(`✅ File exists at ${BUCKET}/${path}`);
        console.log(`   URL: https://object-storage.replit.app/${BUCKET}/${path}`);
        
        // Get file metadata
        const fileInfo = result.value.find(item => item.name === path);
        if (fileInfo) {
          console.log(`   Size: ${Math.round(fileInfo.size / 1024) || 0} KB`);
          const lastModified = fileInfo.lastModified ? 
            (typeof fileInfo.lastModified.toISOString === 'function' ? 
              fileInfo.lastModified.toISOString() : 
              'Unknown date') : 
            'No date available';
          console.log(`   Last Modified: ${lastModified}`);
        }
      } else {
        console.log(`❌ File not found at ${BUCKET}/${path}`);
      }
    } catch (error) {
      console.error(`Error checking ${path}:`, error);
    }
  }
}

// Run the check
checkStoredFiles().then(() => {
  console.log('\nCheck completed');
});