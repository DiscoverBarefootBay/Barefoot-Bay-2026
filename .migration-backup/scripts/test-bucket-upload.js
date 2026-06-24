/**
 * Test script to verify Object Storage multi-bucket uploads
 * 
 * This script tests uploading files to different buckets based on media type
 * and verifies that the files are accessible through the correct URLs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@replit/object-storage';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_FILES = {
  DEFAULT: {
    mediaType: 'banner',
    testText: 'Test banner content for DEFAULT bucket',
    filename: `banner-test-${Date.now()}.txt`
  },
  CALENDAR: {
    mediaType: 'calendar',
    testText: 'Test calendar content for CALENDAR bucket',
    filename: `calendar-test-${Date.now()}.txt`
  },
  FORUM: {
    mediaType: 'forum',
    testText: 'Test forum content for FORUM bucket',
    filename: `forum-test-${Date.now()}.txt`
  },
  VENDORS: {
    mediaType: 'vendor',
    testText: 'Test vendor content for VENDORS bucket',
    filename: `vendor-test-${Date.now()}.txt`
  },
  SALE: {
    mediaType: 'real_estate',
    testText: 'Test real estate content for SALE bucket',
    filename: `real-estate-test-${Date.now()}.txt`
  },
  COMMUNITY: {
    mediaType: 'community',
    testText: 'Test community content for COMMUNITY bucket', 
    filename: `community-test-${Date.now()}.txt`
  }
};

// Helper function to create a temporary test file
function createTestFile(content, filename) {
  const filePath = path.join('/tmp', filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

// Helper function to test a single bucket upload
async function testBucketUpload(client, bucketName, config) {
  console.log(`\n--- Testing ${bucketName} bucket with ${config.mediaType} media type ---`);
  
  try {
    // Create test file
    const testFilePath = createTestFile(config.testText, config.filename);
    console.log(`Created test file: ${testFilePath}`);
    
    // Storage key and upload options
    const storageKey = `${config.mediaType}/${config.filename}`;
    const uploadOptions = {
      contentType: 'text/plain',
      bucketName: bucketName
    };
    
    // Upload to Object Storage
    console.log(`Uploading to ${bucketName}/${storageKey}...`);
    const uploadResult = await client.uploadFromFilename(storageKey, testFilePath, uploadOptions);
    
    if (!uploadResult.ok) {
      throw new Error(`Upload failed: ${uploadResult.error.message}`);
    }
    
    console.log('✅ Upload successful');
    
    // List files to verify upload
    const listResult = await client.list({ prefix: config.mediaType, bucketName });
    
    if (!listResult.ok) {
      throw new Error(`List operation failed: ${listResult.error.message}`);
    }
    
    const foundFile = listResult.value.find(obj => obj.name === storageKey);
    
    if (foundFile) {
      console.log(`✅ File found in ${bucketName} bucket: ${foundFile.name}`);
    } else {
      console.error(`❌ File not found in ${bucketName} bucket!`);
    }
    
    // Download the file to verify contents
    const downloadResult = await client.downloadAsBytes(storageKey, { bucketName });
    
    if (!downloadResult.ok) {
      throw new Error(`Download failed: ${downloadResult.error.message}`);
    }
    
    const downloadedContent = downloadResult.value[0].toString('utf8');
    
    if (downloadedContent === config.testText) {
      console.log('✅ Downloaded content matches original');
    } else {
      console.error('❌ Content mismatch!', { 
        original: config.testText, 
        downloaded: downloadedContent 
      });
    }
    
    // Clean up test file
    fs.unlinkSync(testFilePath);
    
    // Public URL for the file
    const publicUrl = `https://object-storage.replit.app/${bucketName}/${storageKey}`;
    console.log(`Public URL: ${publicUrl}`);
    
    return {
      success: true,
      bucketName,
      storageKey,
      publicUrl
    };
  } catch (error) {
    console.error(`❌ Error testing ${bucketName} bucket:`, error);
    return {
      success: false,
      bucketName,
      error: error.message
    };
  }
}

// Main test function
async function runBucketTests() {
  console.log('Starting Object Storage multi-bucket test...');
  
  try {
    // Initialize Object Storage client
    const client = new Client();
    console.log('Initialized Object Storage client');
    
    // Test results
    const results = [];
    
    // Test each bucket
    for (const [bucketName, config] of Object.entries(TEST_FILES)) {
      const result = await testBucketUpload(client, bucketName, config);
      results.push(result);
    }
    
    // Summary
    console.log('\n--- Test Summary ---');
    const successful = results.filter(r => r.success).length;
    console.log(`${successful}/${results.length} bucket tests passed`);
    
    // Print all URLs for successful uploads
    if (successful > 0) {
      console.log('\nSuccessful uploads:');
      results.filter(r => r.success).forEach(r => {
        console.log(`${r.bucketName}: ${r.publicUrl}`);
      });
    }
    
    // Print errors for failed uploads
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      console.log('\nFailed uploads:');
      failed.forEach(r => {
        console.log(`${r.bucketName}: ${r.error}`);
      });
    }
  } catch (error) {
    console.error('Unexpected error running tests:', error);
  }
}

// Run the tests
runBucketTests().catch(console.error);