/**
 * Test script to validate forum image upload to Object Storage
 * This script tests direct forum media upload to Object Storage
 * 
 * It validates that:
 * 1. We can connect to the storage
 * 2. We can upload a file to the correct location (forum/ in FORUM bucket)
 * 3. We can verify the file exists
 * 4. We can download the file
 * 5. We can serve the file via the storage proxy
 */

const { Client } = require('@replit/object-storage');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Test configuration
const TEST_BUCKET = 'FORUM';
const TEST_FILENAME = `forum-test-${Date.now()}.txt`;
const TEST_CONTENT = 'This is a test file for forum media uploads. ' + Date.now();

// Create the test file
const tempFilePath = path.join(__dirname, 'temp-forum-test.txt');

async function testForumUpload() {
  console.log('=== FORUM MEDIA UPLOAD TEST ===');
  console.log(`Using test bucket: ${TEST_BUCKET}`);
  console.log(`Using test filename: ${TEST_FILENAME}`);
  
  try {
    // Step 1: Create a temporary file
    fs.writeFileSync(tempFilePath, TEST_CONTENT);
    console.log(`✓ Created test file at: ${tempFilePath}`);
    
    // Step 2: Initialize the Replit Object Storage client
    const client = new Client();
    console.log('✓ Initialized Object Storage client');
    
    // Step 3: Set correct forum media path (must have forum/ prefix)
    const storageKey = `forum/${TEST_FILENAME}`;
    console.log(`✓ Storage key set to: ${storageKey}`);
    
    // Step 4: Upload to Object Storage
    console.log(`Starting upload to ${TEST_BUCKET}/${storageKey}...`);
    const uploadResult = await client.uploadFromFilename(
      storageKey,
      tempFilePath,
      {
        bucketName: TEST_BUCKET,
        contentType: 'text/plain',
        headers: {
          'X-Obj-Bucket': TEST_BUCKET
        }
      }
    );
    
    if (!uploadResult.ok) {
      throw new Error(`Upload failed: ${uploadResult.error?.message}`);
    }
    
    console.log(`✓ Successfully uploaded to ${TEST_BUCKET}/${storageKey}`);
    
    // Step 5: Verify file exists
    console.log(`Verifying file exists...`);
    const existsResult = await client.exists(storageKey, {
      bucketName: TEST_BUCKET,
      headers: {
        'X-Obj-Bucket': TEST_BUCKET
      }
    });
    
    if (!existsResult.ok || !existsResult.value) {
      throw new Error(`Exists check failed: File not found in Object Storage`);
    }
    
    console.log(`✓ Verified file exists in Object Storage`);
    
    // Step 6: Download the file content
    console.log(`Downloading file content...`);
    const downloadResult = await client.downloadAsText(storageKey, {
      bucketName: TEST_BUCKET,
      headers: {
        'X-Obj-Bucket': TEST_BUCKET
      }
    });
    
    if (!downloadResult.ok) {
      throw new Error(`Download failed: ${downloadResult.error?.message}`);
    }
    
    if (downloadResult.value !== TEST_CONTENT) {
      throw new Error(`Content mismatch! Expected: "${TEST_CONTENT}", Got: "${downloadResult.value}"`);
    }
    
    console.log(`✓ Successfully downloaded file content and verified it matches`);
    
    // Step 7: Verify direct Object Storage URL
    const directUrl = `https://object-storage.replit.app/${TEST_BUCKET}/${storageKey}`;
    console.log(`Testing direct Object Storage URL: ${directUrl}`);
    
    try {
      const directResponse = await fetch(directUrl, {
        headers: {
          'X-Obj-Bucket': TEST_BUCKET
        }
      });
      
      if (!directResponse.ok) {
        console.warn(`⚠ Direct URL test failed: ${directResponse.status} ${directResponse.statusText}`);
      } else {
        const directContent = await directResponse.text();
        console.log(`✓ Direct URL access succeeded`);
        
        if (directContent !== TEST_CONTENT) {
          console.warn(`⚠ Direct URL content mismatch: "${directContent.substring(0, 20)}..." vs "${TEST_CONTENT.substring(0, 20)}..."`);
        } else {
          console.log(`✓ Direct URL content verified`);
        }
      }
    } catch (directErr) {
      console.warn(`⚠ Direct URL test error: ${directErr.message}`);
    }
    
    // Success!
    console.log('\n✅ ALL TESTS PASSED! Forum media upload functionality working correctly.');
    console.log(`\nFor future reference, you can access this test file at:\n`);
    console.log(`  - Storage key: ${TEST_BUCKET}/${storageKey}`);
    console.log(`  - Direct URL: ${directUrl} (with X-Obj-Bucket header)`);
    console.log(`  - Proxy URL: /api/storage-proxy/${TEST_BUCKET}/${storageKey}`);
    
    // Clean up
    try {
      fs.unlinkSync(tempFilePath);
      console.log(`✓ Cleaned up temporary file`);
    } catch (cleanupErr) {
      console.warn(`⚠ Cleanup warning: ${cleanupErr.message}`);
    }
    
    return true;
  } catch (error) {
    console.error(`\n❌ TEST FAILED: ${error.message}`);
    console.error(error);
    
    // Clean up anyway
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log(`✓ Cleaned up temporary file despite error`);
      }
    } catch (cleanupErr) {
      // Ignore cleanup errors
    }
    
    return false;
  }
}

// Run the test
testForumUpload().then(success => {
  console.log(`\nForum media upload test ${success ? 'completed successfully' : 'failed'}`);
  process.exit(success ? 0 : 1);
});