/**
 * Test script to verify the Object Storage path standardization fix
 * 
 * This script tests uploading calendar event media to the Object Storage
 * service with our fixed path handling to ensure consistent paths.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create a test image file for upload
 * @returns {string} Path to the test file
 */
function createTestImage() {
  const testDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const testFilePath = path.join(testDir, `test-event-image-${Date.now()}.png`);
  
  // Create a simple 1x1 PNG
  const pngData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync(testFilePath, pngData);
  
  console.log(`Created test image at: ${testFilePath}`);
  return testFilePath;
}

/**
 * Test uploading to calendar events directory with different directory specifications
 */
async function testCalendarUploads() {
  const testFilePath = createTestImage();
  const baseUrl = 'http://localhost:5000';
  
  // Test upload using 'events' directory
  console.log('\n--- Testing upload with "events" directory ---');
  await testUpload(baseUrl, testFilePath, 'events');
  
  // Test upload using 'calendar' directory
  console.log('\n--- Testing upload with "calendar" directory ---');
  await testUpload(baseUrl, testFilePath, 'calendar');
  
  // Test upload using 'calendar-media' directory
  console.log('\n--- Testing upload with "calendar-media" directory ---');
  await testUpload(baseUrl, testFilePath, 'calendar-media');
  
  // Clean up test file
  fs.unlinkSync(testFilePath);
  console.log(`Cleaned up test file: ${testFilePath}`);
}

/**
 * Helper function to test an upload with a specific directory
 */
async function testUpload(baseUrl, filePath, directory) {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('directory', directory);
    
    console.log(`Uploading file to ${directory}...`);
    
    const response = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed with status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Upload successful, response:', result);
    
    // Check if the URL contains the expected standardized path format
    const expectedPathPattern = /CALENDAR\/events\//;
    if (expectedPathPattern.test(result.url)) {
      console.log('✓ Correct: URL contains standardized path format');
    } else {
      console.log('✗ Error: URL does not have the expected standardized path format');
      console.log(`  Expected path to include: CALENDAR/events/`);
      console.log(`  Actual URL: ${result.url}`);
    }
    
    // Test proxy URL
    console.log('\nTesting proxy access to uploaded file...');
    const proxyUrl = result.url.replace('https://object-storage.replit.app/', '/api/storage-proxy/');
    const proxyResponse = await fetch(`${baseUrl}${proxyUrl}`);
    
    if (proxyResponse.ok) {
      console.log(`✓ Proxy access successful: ${proxyUrl}`);
    } else {
      console.log(`✗ Error: Proxy access failed for ${proxyUrl} with status: ${proxyResponse.status}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error during upload test:', error);
  }
}

/**
 * Test the storage proxy endpoint
 */
async function testStorageProxy() {
  try {
    console.log('\n--- Testing storage proxy ---');
    const baseUrl = 'http://localhost:5000';
    
    // Test existing event image
    const testUrl = '/api/storage-proxy/CALENDAR/events/default-event-image.svg';
    console.log(`Testing proxy access to default image: ${testUrl}`);
    
    const response = await fetch(`${baseUrl}${testUrl}`);
    
    if (response.ok) {
      console.log(`✓ Proxy access successful: ${testUrl}`);
    } else {
      console.log(`✗ Error: Proxy access failed for ${testUrl} with status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error testing storage proxy:', error);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('=== TESTING CALENDAR MEDIA UPLOADS WITH PATH STANDARDIZATION ===');
  await testCalendarUploads();
  await testStorageProxy();
  console.log('\n=== TESTS COMPLETED ===');
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
});