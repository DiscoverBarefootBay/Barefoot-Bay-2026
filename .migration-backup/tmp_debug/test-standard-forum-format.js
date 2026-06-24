/**
 * Test specifically for the standard forum format that's still failing
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { Client } from '@replit/object-storage';
import { fileURLToPath } from 'url';

// Convert __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize the Object Storage client
const objectStorageToken = process.env.REPLIT_OBJECT_STORAGE_TOKEN;
const client = new Client({
  token: objectStorageToken
});

async function createTestFile() {
  // Create a simple text file to use for testing
  const timestamp = Date.now();
  const filename = `test-standard-format-${timestamp}.txt`;
  const content = `Test file for FORUM/forum standard format at ${new Date().toISOString()}`;

  // Save locally first
  fs.writeFileSync(path.join(__dirname, filename), content);
  console.log(`Created local test file: ${filename}`);

  // Upload to Object Storage
  try {
    await client.putObject("FORUM", `forum/${filename}`, content);
    console.log(`Uploaded to Object Storage: FORUM/forum/${filename}`);
    return {
      filename,
      localPath: path.join(__dirname, filename),
      objectStoragePath: `forum/${filename}`
    };
  } catch (error) {
    console.error(`Error uploading to Object Storage: ${error.message}`);
    throw error;
  }
}

async function testUrlFormats(testInfo) {
  const { filename } = testInfo;
  const baseUrl = 'http://localhost:5000';

  // Test different URL formats
  const urlFormats = [
    // Format 1: Standard storage proxy format - TEST THIS FORMAT SPECIFICALLY
    `/api/storage-proxy/FORUM/forum/${filename}`,
    
    // Format 2: Direct forum endpoint format (known to work)
    `/api/storage-proxy/direct-forum/${filename}`,
  ];

  console.log(`Testing ${urlFormats.length} URL formats for ${filename}...`);

  for (const urlFormat of urlFormats) {
    const fullUrl = `${baseUrl}${urlFormat}`;
    console.log(`\nTesting URL: ${fullUrl}`);

    try {
      const response = await fetch(fullUrl);
      const status = response.status;
      const headers = Object.fromEntries(response.headers.entries());
      const contentType = headers['content-type'] || 'unknown';
      
      if (response.ok) {
        const text = await response.text();
        console.log(`✅ Success (${status}): ${urlFormat}`);
        console.log(`Content-Type: ${contentType}`);
        console.log(`Content (${text.length} bytes): ${text.substring(0, 100)}`);
        
        // Check if we got the actual file content
        if (text.includes("Test file for FORUM/forum standard format")) {
          console.log(`✓ Content matches expected test file content`);
        } else {
          console.log(`❌ Content doesn't match expected test file content`);
        }
      } else {
        console.log(`❌ Failed (${status}): ${urlFormat}`);
        const text = await response.text();
        console.log(`Response: ${text.substring(0, 100)}`);
      }
      
      // Print key response headers
      console.log(`Headers: ${JSON.stringify({
        'content-type': headers['content-type'],
        'content-length': headers['content-length'],
        'x-forum-standard-handler': headers['x-forum-standard-handler'],
        'x-standard-forum-format': headers['x-standard-forum-format'],
      }, null, 2)}`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

async function cleanup(testInfo) {
  const { filename, localPath, objectStoragePath } = testInfo;
  
  // Remove from Object Storage
  try {
    await client.deleteObject("FORUM", objectStoragePath);
    console.log(`Removed from Object Storage: FORUM/${objectStoragePath}`);
  } catch (error) {
    console.error(`Error removing from Object Storage: ${error.message}`);
  }
  
  // Remove local file
  if (fs.existsSync(localPath)) {
    fs.unlinkSync(localPath);
    console.log(`Removed local file: ${localPath}`);
  }
}

async function main() {
  let testInfo = null;
  
  try {
    // Create a test file
    testInfo = await createTestFile();
    
    // Wait a moment for the file to be available
    console.log('Waiting 2 seconds for Object Storage to propagate...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test all URL formats
    await testUrlFormats(testInfo);
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
  } finally {
    // Clean up
    if (testInfo) {
      await cleanup(testInfo);
    }
  }
}

main().catch(console.error);