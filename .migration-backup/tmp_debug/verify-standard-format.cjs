/**
 * Simple CommonJS script to verify the standard FORUM/forum URL format works
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { Client } = require('@replit/object-storage');

// Initialize Object Storage client
const client = new Client({
  token: process.env.REPLIT_OBJECT_STORAGE_TOKEN
});

// Create a simple test file with timestamp to avoid caching
const timestamp = Date.now();
const filename = `test-forum-standard-${timestamp}.txt`;
const content = `This is a test file for verifying FORUM/forum format at ${new Date().toISOString()}`;

console.log(`Step 1: Creating test file: ${filename}`);

// Upload directly to Object Storage in the correct path
console.log(`Step 2: Uploading to Object Storage in FORUM/forum/${filename}`);

// Using put instead of putObject (which doesn't exist in this client version)
client.put("FORUM", `forum/${filename}`, content)
  .then(() => {
    console.log(`✅ Successfully uploaded to FORUM/forum/${filename}`);
    
    // Test accessing the file with the standard format
    console.log(`\nStep 3: Testing standard format URL`);
    const standardUrl = `http://localhost:5000/api/storage-proxy/FORUM/forum/${filename}`;
    
    return fetch(standardUrl);
  })
  .then(response => {
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers: ${JSON.stringify({
      'content-type': response.headers.get('content-type'),
      'content-length': response.headers.get('content-length'),
      'x-forum-standard-handler': response.headers.get('x-forum-standard-handler')
    }, null, 2)}`);
    
    if (response.ok) {
      return response.text().then(text => {
        console.log(`✅ Content retrieved (${text.length} bytes): ${text.substring(0, 100)}`);
        
        if (text.includes("test file for verifying FORUM/forum format")) {
          console.log(`✅ GREAT SUCCESS! The standard format URL is working correctly.`);
        } else {
          console.log(`❌ Content doesn't match the test file content.`);
        }
        
        // Clean up - delete the test file from Object Storage
        console.log(`\nStep 4: Cleaning up - deleting test file from Object Storage`);
        return client.delete("FORUM", `forum/${filename}`);
      });
    } else {
      console.log(`❌ Failed to retrieve file: ${response.status} ${response.statusText}`);
      // Clean up anyway
      return client.delete("FORUM", `forum/${filename}`);
    }
  })
  .then(() => {
    console.log(`✅ Test file removed from Object Storage`);
  })
  .catch(error => {
    console.error(`Error during test: ${error.message}`);
  });