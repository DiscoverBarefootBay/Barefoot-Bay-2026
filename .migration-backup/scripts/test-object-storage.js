/**
 * Test script for Replit Object Storage
 * 
 * This script tests the basic functionality of Replit Object Storage by:
 * 1. Uploading a test file to the DEFAULT bucket
 * 2. Checking if the file exists
 * 3. Retrieving the file
 * 4. Listing all files in the bucket
 */

import { Client } from '@replit/object-storage';
import fs from 'fs';

// Create test file content
const testContent = 'This is a test file created on ' + new Date().toISOString();
const testFilePath = './test-file.txt';
const testKey = 'banner/test-' + Date.now() + '.txt';

// Write to local file first
fs.writeFileSync(testFilePath, testContent);

async function testObjectStorage() {
  console.log('Starting Object Storage test...');
  
  // Create client
  const client = new Client();
  
  try {
    // Test 1: Upload a file using uploadFromText
    console.log(`Attempting to upload test file with key: ${testKey}...`);
    const uploadResult = await client.uploadFromText(testKey, testContent);
    console.log('Upload result:', uploadResult);
    
    if (!uploadResult.ok) {
      console.error('Upload failed:', uploadResult.error);
      return;
    }
    
    console.log('✅ Upload successful');
    
    // Test 2: Check if file exists
    try {
      console.log('Checking if file exists...');
      await client.head(testKey);
      console.log('✅ File exists');
    } catch (error) {
      console.error('❌ File does not exist:', error);
    }
    
    // Test 3: Retrieve the file
    try {
      console.log('Retrieving file...');
      const downloadResult = await client.download(testKey);
      
      if (downloadResult.ok) {
        const content = downloadResult.value.toString('utf-8');
        console.log('✅ Download successful. Content:', content);
        
        // Verify content
        if (content === testContent) {
          console.log('✅ Content verification successful');
        } else {
          console.error('❌ Content verification failed. Expected:', testContent, 'Got:', content);
        }
      } else {
        console.error('❌ Download failed:', downloadResult.error);
      }
    } catch (error) {
      console.error('❌ Error retrieving file:', error);
    }
    
    // Test 4: List files
    try {
      console.log('Listing files with prefix "banner/"...');
      const listResult = await client.list({ prefix: 'banner/' });
      
      if (listResult.ok) {
        console.log('✅ Listing successful. Found', listResult.value.length, 'files:');
        listResult.value.forEach(file => console.log(' -', file.name));
      } else {
        console.error('❌ Listing failed:', listResult.error);
      }
    } catch (error) {
      console.error('❌ Error listing files:', error);
    }
    
    // Test 5: Upload using uploadFromFilename
    const alternateKey = 'banner/alternate-' + Date.now() + '.txt';
    console.log(`Testing uploadFromFilename with key: ${alternateKey}...`);
    
    try {
      const fileUploadResult = await client.uploadFromFilename(alternateKey, testFilePath);
      
      if (fileUploadResult.ok) {
        console.log('✅ File upload successful');
      } else {
        console.error('❌ File upload failed:', fileUploadResult.error);
      }
    } catch (error) {
      console.error('❌ Error uploading file:', error);
    }
    
    console.log('All tests complete!');
  } catch (error) {
    console.error('Unexpected error:', error);
  } finally {
    // Clean up
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
      console.log('Local test file deleted');
    }
  }
}

testObjectStorage().catch(console.error);