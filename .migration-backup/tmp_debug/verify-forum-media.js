/**
 * Forum Media URL Verification Script
 * 
 * This script tests various forum media URL formats and checks if they resolve correctly
 * through the Object Storage proxy.
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
const TEST_FILENAME = `forum-test-${Date.now()}.txt`;
const TEST_CONTENT = 'This is a test file for forum media verification. ' + Date.now();

// Create a test file in multiple formats to verify URL resolution
async function createTestFile() {
  console.log('=== FORUM MEDIA PATH VERIFICATION ===');
  
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

// Test various URL formats to see if they resolve
async function testUrlFormats({ bucket, filename, storageKey }) {
  // Base URL for our app
  const baseUrl = 'http://localhost:5000';
  
  // Format 1: Standard storage proxy format
  const format1 = `/api/storage-proxy/${bucket}/${storageKey}`;
  
  // Format 2: Direct forum endpoint 
  const format2 = `/api/storage-proxy/direct-forum/${filename}`;
  
  // Format 3: Simple forum format
  const format3 = `/api/storage-proxy/forum/${filename}`;
  
  // Format 4: Legacy forum-media format
  const format4 = `/forum-media/${filename}`;
  
  // Format 5: Legacy uploads/forum format
  const format5 = `/uploads/forum/${filename}`;
  
  // Format 6: Direct FORUM bucket reference
  const format6 = `/FORUM/forum/${filename}`;
  
  // Format 7: Direct object storage URL
  const format7 = `https://object-storage.replit.app/${bucket}/forum/${filename}`;
  
  const urls = [
    { name: 'Standard storage proxy', url: format1 },
    { name: 'Direct forum endpoint', url: format2 },
    { name: 'Simple forum format', url: format3 },
    { name: 'Legacy forum-media', url: format4 },
    { name: 'Legacy uploads/forum', url: format5 },
    { name: 'Direct FORUM bucket', url: format6 }
    // We don't test format7 as we can't make a cross-domain request directly from Node.js
  ];
  
  console.log('\nTesting URL formats...');
  
  const results = [];
  
  for (const format of urls) {
    try {
      const fullUrl = `${baseUrl}${format.url}`;
      console.log(`\nTesting ${format.name}: ${format.url}`);
      
      const response = await fetch(fullUrl);
      
      if (response.ok) {
        const content = await response.text();
        const success = content === TEST_CONTENT;
        
        if (success) {
          console.log(`✅ SUCCESS: ${format.name} format works`);
        } else {
          console.log(`❌ FAILURE: ${format.name} format has incorrect content`);
          console.log(`   Expected: "${TEST_CONTENT}"`);
          console.log(`   Actual: "${content.substring(0, 100)}..."`);
        }
        
        results.push({
          format: format.name,
          url: format.url,
          status: response.status,
          success,
          content: content.substring(0, 50) + (content.length > 50 ? '...' : '')
        });
      } else {
        console.log(`❌ FAILURE: ${format.name} format returned ${response.status} ${response.statusText}`);
        
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (err) {
          responseText = 'Could not retrieve response text';
        }
        
        results.push({
          format: format.name,
          url: format.url,
          status: response.status,
          success: false,
          error: responseText.substring(0, 100)
        });
      }
    } catch (error) {
      console.error(`❌ ERROR testing ${format.name}:`, error.message);
      
      results.push({
        format: format.name,
        url: format.url,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

// Main function to run the test
async function main() {
  try {
    const testFile = await createTestFile();
    const results = await testUrlFormats(testFile);
    
    console.log('\n=== SUMMARY ===');
    const successCount = results.filter(r => r.success).length;
    console.log(`${successCount} of ${results.length} URL formats working correctly`);
    
    // List working formats
    console.log('\nWorking formats:');
    results.filter(r => r.success).forEach(r => {
      console.log(`✅ ${r.format}: ${r.url}`);
    });
    
    // List failing formats
    console.log('\nFailing formats:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`❌ ${r.format}: ${r.url} - ${r.error || `Status: ${r.status}`}`);
    });
    
    console.log('\nDetailed results:');
    console.log(JSON.stringify(results, null, 2));
    
    // Save results to a file
    const resultsFile = path.join(__dirname, 'forum-media-verification-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      testFile,
      results
    }, null, 2));
    
    console.log(`\nResults saved to ${resultsFile}`);
    
    // Clean up test file
    const client = new Client();
    await client.delete(`forum/${testFile.filename}`, {
      bucketName: testFile.bucket,
      headers: { 'X-Obj-Bucket': testFile.bucket }
    });
    console.log(`\nTest file cleaned up from ${testFile.bucket}/forum/${testFile.filename}`);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the script
main().then(() => {
  console.log('Verification completed!');
});