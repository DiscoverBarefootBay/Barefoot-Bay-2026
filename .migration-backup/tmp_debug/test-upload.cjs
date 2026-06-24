// Simple test script to directly test Replit Object Storage
const { Client } = require("@replit/object-storage");
const fs = require('fs');
const path = require('path');

async function testUpload() {
  try {
    console.log("Starting direct Object Storage test");
    
    // Create the client
    const client = new Client();
    console.log("Client created");
    
    // Create a test file
    const testFilePath = path.join(process.cwd(), 'tmp_debug', 'test-file.txt');
    fs.writeFileSync(testFilePath, 'This is a test file to verify Object Storage uploads');
    console.log(`Test file created at ${testFilePath}`);
    
    // Upload the file
    const bucket = "FORUM";
    const objectKey = "forum/test-upload.txt";
    
    console.log(`Uploading file to ${bucket}/${objectKey}...`);
    
    const result = await client.uploadFromFilename(
      objectKey,
      testFilePath,
      {
        bucketName: bucket,
        contentType: 'text/plain',
        headers: {
          'X-Obj-Bucket': bucket
        }
      }
    );
    
    if (!result.ok) {
      console.error(`Upload failed: ${result.error?.message}`);
      throw new Error(`Upload failed: ${result.error?.message}`);
    }
    
    console.log("Upload succeeded!");
    
    // Verify the upload
    console.log(`Verifying upload exists at ${bucket}/${objectKey}...`);
    const exists = await client.exists(objectKey, {
      bucketName: bucket,
      headers: {
        'X-Obj-Bucket': bucket
      }
    });
    
    if (!exists.ok || !exists.value) {
      console.error("Verification failed: File doesn't exist in bucket");
      throw new Error("Verification failed: File doesn't exist in bucket");
    }
    
    console.log("Verification successful! File exists in bucket");
    
    // Try downloading it
    console.log("Attempting to download the file...");
    const download = await client.downloadAsText(objectKey, {
      bucketName: bucket,
      headers: {
        'X-Obj-Bucket': bucket
      }
    });
    
    if (!download.ok) {
      console.error(`Download failed: ${download.error?.message}`);
      throw new Error(`Download failed: ${download.error?.message}`);
    }
    
    console.log(`Download successful! Content: ${download.value}`);
    
    return true;
  } catch (error) {
    console.error("Test failed with error:", error);
    return false;
  }
}

testUpload().then(success => {
  console.log(`Test ${success ? 'PASSED' : 'FAILED'}`);
  process.exit(success ? 0 : 1);
});