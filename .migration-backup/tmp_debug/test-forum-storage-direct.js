/**
 * Special test for FORUM/forum direct URL format
 * Tests the specific URL format that's failing in our verification
 */

import fetch from 'node-fetch';
import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const TEST_BUCKET = 'FORUM';
const TEST_FILENAME = `forum-debug-${Date.now()}.txt`;
const TEST_CONTENT = 'This is a test file for forum media debug. ' + Date.now();

// Create a test file
async function createTestFile() {
  console.log('=== FORUM MEDIA DIRECT TEST ===');
  
  try {
    // Create the test file in Object Storage
    const client = new Client();
    
    // Storage key for Object Storage (correct format)
    const storageKey = `forum/${TEST_FILENAME}`;
    
    console.log(`Creating test file: ${TEST_BUCKET}/${storageKey}`);
    
    // Upload the test file 
    const result = await client.uploadFromText(
      storageKey,
      TEST_CONTENT,
      {
        bucketName: TEST_BUCKET,
        contentType: 'text/plain',
        headers: {
          'X-Obj-Bucket': TEST_BUCKET
        }
      }
    );
    
    if (!result.ok) {
      throw new Error(`Upload failed: ${result.error?.message}`);
    }
    
    console.log('✅ Test file created successfully!');
    
    return { bucket: TEST_BUCKET, filename: TEST_FILENAME, storageKey };
  } catch (error) {
    console.error('❌ Failed to create test file:', error);
    throw error;
  }
}

// Test the direct URL format
async function testDirectStorageProxy(testFile) {
  try {
    const baseUrl = 'http://localhost:5000';
    const directUrl = `/api/storage-proxy/${testFile.bucket}/forum/${testFile.filename}`;
    const fullUrl = `${baseUrl}${directUrl}`;
    
    console.log(`Testing direct URL format: ${directUrl}`);
    
    // Make the request with additional debug info
    const response = await fetch(fullUrl, {
      headers: {
        'Accept': '*/*',
        'User-Agent': 'ForumMediaDebug/1.0',
        'X-Debug': 'true'
      }
    });
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers: ${JSON.stringify(response.headers.raw())}`);
    
    if (response.ok) {
      const content = await response.text();
      console.log(`Response content (first 100 chars): ${content.substring(0, 100)}`);
      
      const success = content === TEST_CONTENT;
      if (success) {
        console.log('✅ SUCCESS: Content matches expected value');
      } else {
        console.log('❌ FAILURE: Content does not match');
        console.log(`Expected: ${TEST_CONTENT}`);
        console.log(`Actual: ${content.substring(0, 100)}`);
      }
    } else {
      console.log('❌ FAILURE: Request failed');
    }
  } catch (error) {
    console.error('Error testing direct URL:', error);
  }
}

// Clean up the test file
async function cleanupTestFile(testFile) {
  try {
    const client = new Client();
    await client.delete(`forum/${testFile.filename}`, {
      bucketName: testFile.bucket,
      headers: { 'X-Obj-Bucket': testFile.bucket }
    });
    console.log(`\nTest file cleaned up from ${testFile.bucket}/forum/${testFile.filename}`);
  } catch (error) {
    console.error('Error cleaning up test file:', error);
  }
}

// Main function
async function main() {
  try {
    const testFile = await createTestFile();
    await testDirectStorageProxy(testFile);
    await cleanupTestFile(testFile);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the main function
main().then(() => {
  console.log('Test complete');
});