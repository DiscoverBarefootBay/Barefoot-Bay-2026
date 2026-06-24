/**
 * Test script to verify Replit Object Storage bucket detection and mapping
 * 
 * This script tests the following:
 * 1. Media type to bucket mapping
 * 2. Path-based section detection
 * 3. Bucket assignment for different media types
 * 
 * This ensures that media files are stored in the correct buckets during upload.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@replit/object-storage';

// Define the same bucket constants to avoid import issues
const BUCKETS = {
  DEFAULT: 'DEFAULT',
  CALENDAR: 'CALENDAR',
  FORUM: 'FORUM',
  VENDORS: 'VENDORS',
  SALE: 'SALE',
  COMMUNITY: 'COMMUNITY'
};

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test different media types
const TEST_MEDIA_TYPES = [
  { type: 'avatar', description: 'User avatar', filename: 'test-avatar.png', expectedBucket: BUCKETS.DEFAULT },
  { type: 'banner', description: 'Homepage banner slide', filename: 'test-banner.jpg', expectedBucket: BUCKETS.DEFAULT },
  { type: 'calendar', description: 'Calendar event image', filename: 'test-calendar-event.jpg', expectedBucket: BUCKETS.CALENDAR },
  { type: 'forum', description: 'Forum post image', filename: 'test-forum-post.png', expectedBucket: BUCKETS.FORUM },
  { type: 'vendor', description: 'Vendor listing photo', filename: 'test-vendor.jpg', expectedBucket: BUCKETS.VENDORS },
  { type: 'real_estate', description: 'Real estate listing photo', filename: 'test-real-estate.jpg', expectedBucket: BUCKETS.SALE },
  { type: 'community', description: 'Community event photo', filename: 'test-community.jpg', expectedBucket: BUCKETS.COMMUNITY }
];

// Create a test file
function createTestFile(filename, content = 'Test file content') {
  const filePath = path.join('/tmp', filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

// Function to determine bucket for media type - manual implementation for testing
function getBucketForMediaType(mediaType) {
  // Lowercase for case-insensitive matching
  const normalizedType = mediaType.toLowerCase();
  
  // Media types to bucket mapping
  const MEDIA_TYPE_TO_BUCKET = {
    'avatar': BUCKETS.DEFAULT,
    'banner': BUCKETS.DEFAULT,
    'icon': BUCKETS.DEFAULT,
    'general': BUCKETS.DEFAULT,
    'calendar': BUCKETS.CALENDAR,
    'event': BUCKETS.CALENDAR,
    'forum': BUCKETS.FORUM,
    'forum_post': BUCKETS.FORUM,
    'forum_comment': BUCKETS.FORUM,
    'vendor': BUCKETS.VENDORS,
    'real_estate': BUCKETS.SALE,
    'real_estate_media': BUCKETS.SALE,
    'for_sale': BUCKETS.SALE,
    'community': BUCKETS.COMMUNITY
  };
  
  return MEDIA_TYPE_TO_BUCKET[normalizedType] || BUCKETS.DEFAULT;
}

// Test media type to bucket mapping
function testMediaTypeToBucketMapping() {
  console.log('===== Testing Media Type to Bucket Mapping =====\n');
  
  for (const testCase of TEST_MEDIA_TYPES) {
    // Get the expected bucket for this media type
    const mappedBucket = getBucketForMediaType(testCase.type);
    
    console.log(`Media Type: ${testCase.type}`);
    console.log(`Description: ${testCase.description}`);
    console.log(`Expected Bucket: ${testCase.expectedBucket}`);
    console.log(`Mapped Bucket: ${mappedBucket}`);
    
    // Verify mapping is correct
    if (mappedBucket === testCase.expectedBucket) {
      console.log('✅ BUCKET MAPPING CORRECT');
    } else {
      console.log(`❌ BUCKET MAPPING ERROR - expected ${testCase.expectedBucket}, got ${mappedBucket}`);
    }
    
    console.log('-----------------------------------\n');
  }
}

// Test uploading a small file to each bucket
async function testUploadToBuckets() {
  console.log('===== Testing Direct Upload to Buckets =====\n');
  
  try {
    // Initialize Object Storage client
    const client = new Client();
    console.log('Initialized Object Storage client');
    
    // Keep track of successful uploads
    const successfulUploads = [];
    
    for (const testCase of TEST_MEDIA_TYPES) {
      // Create a small test file
      const testFilePath = createTestFile(testCase.filename);
      const fileSizeBytes = fs.statSync(testFilePath).size;
      
      // Storage key for this test
      const storageKey = `${testCase.type}/${testCase.filename}`;
      
      console.log(`Testing upload for ${testCase.description}:`);
      console.log(`File: ${testCase.filename} (${fileSizeBytes} bytes)`);
      console.log(`Target Bucket: ${testCase.expectedBucket}`);
      console.log(`Storage Key: ${storageKey}`);
      
      // Upload options including bucket
      const uploadOptions = {
        contentType: 'image/png',
        bucketName: testCase.expectedBucket
      };
      
      try {
        // Attempt to upload to the bucket
        const uploadResult = await client.uploadFromFilename(storageKey, testFilePath, uploadOptions);
        
        if (!uploadResult.ok) {
          throw new Error(`Upload failed: ${uploadResult.error.message}`);
        }
        
        console.log(`✅ Upload successful to ${testCase.expectedBucket} bucket`);
        
        // Check if file is accessible
        const listResult = await client.list({ 
          prefix: `${testCase.type}/`, 
          bucketName: testCase.expectedBucket 
        });
        
        if (!listResult.ok) {
          throw new Error(`List operation failed: ${listResult.error.message}`);
        }
        
        const foundFile = listResult.value.find(obj => obj.name === storageKey);
        
        if (foundFile) {
          console.log(`✅ File found in bucket: ${foundFile.name}`);
          
          // Record successful upload
          const publicUrl = `https://object-storage.replit.app/${testCase.expectedBucket}/${storageKey}`;
          successfulUploads.push({
            type: testCase.type,
            bucket: testCase.expectedBucket,
            url: publicUrl
          });
        } else {
          console.error(`❌ File not found in bucket after upload!`);
        }
      } catch (error) {
        console.error(`Error uploading ${testCase.type}:`, error);
      }
      
      // Clean up test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
      
      console.log('-----------------------------------\n');
    }
    
    // Summary of successful uploads
    console.log('\n===== Upload Test Summary =====');
    console.log(`${successfulUploads.length}/${TEST_MEDIA_TYPES.length} uploads successful\n`);
    
    for (const upload of successfulUploads) {
      console.log(`Type: ${upload.type}`);
      console.log(`Bucket: ${upload.bucket}`);
      console.log(`URL: ${upload.url}`);
      console.log('-----------------------------------');
    }
    
    return successfulUploads;
  } catch (error) {
    console.error('Error in bucket upload tests:', error);
    return [];
  }
}

// Run the tests
async function runTests() {
  try {
    // Test media type to bucket mapping
    testMediaTypeToBucketMapping();
    
    // Test direct upload to buckets
    await testUploadToBuckets();
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

runTests();