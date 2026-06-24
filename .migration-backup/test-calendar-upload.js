/**
 * Test script to diagnose calendar media upload path issues
 */
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create a test image file for upload
 * @returns {string} Path to the test file
 */
function createTestImage() {
  const testDir = path.join('/tmp', 'test-upload');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const filePath = path.join(testDir, `test-event-image-${Date.now()}.png`);
  // Create a very basic PNG file (1x1 pixel)
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
    0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB0, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  
  fs.writeFileSync(filePath, pngHeader);
  console.log(`Created test PNG file at ${filePath}`);
  return filePath;
}

/**
 * Test the media upload endpoint with a real file
 */
async function testCalendarMediaUpload() {
  try {
    const testFile = createTestImage();
    const form = new FormData();
    form.append('file', fs.createReadStream(testFile));
    
    console.log('Sending test file to upload endpoint...');
    const uploadResponse = await fetch('http://localhost:5000/api/uploads/calendar', {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders(),
      }
    });
    
    if (!uploadResponse.ok) {
      console.error(`Upload failed with status: ${uploadResponse.status}`);
      const text = await uploadResponse.text();
      console.error(`Error response: ${text}`);
      return;
    }
    
    const uploadData = await uploadResponse.json();
    console.log('Upload response:', JSON.stringify(uploadData, null, 2));
    
    // Verify the uploaded file is accessible through the returned URL
    if (uploadData.url) {
      console.log(`Testing access to uploaded file at: ${uploadData.url}`);
      
      // Try to access file directly
      try {
        const fileCheckResponse = await fetch(`http://localhost:5000${uploadData.url}`);
        console.log(`File access response: ${fileCheckResponse.status} ${fileCheckResponse.statusText}`);
        console.log('Content type:', fileCheckResponse.headers.get('content-type'));
      } catch (accessError) {
        console.error('Error accessing uploaded file:', accessError);
      }
    }
    
    // Cleanup
    try {
      fs.unlinkSync(testFile);
      console.log('Test file removed');
    } catch (cleanupError) {
      console.error('Error removing test file:', cleanupError);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

/**
 * Try to list files in Object Storage directly
 */
async function testObjectStorageListing() {
  try {
    console.log('Requesting Object Storage listing...');
    const response = await fetch('http://localhost:5000/api/admin/debug/storage-list', {
      method: 'GET',
    });
    
    if (!response.ok) {
      console.error(`Storage listing failed with status: ${response.status}`);
      const text = await response.text();
      console.error(`Error response: ${text}`);
      return;
    }
    
    const data = await response.json();
    console.log('Storage listing response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Storage listing test failed:', error);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('=== CALENDAR MEDIA UPLOAD TEST ===');
  await testCalendarMediaUpload();
  
  console.log('\n=== OBJECT STORAGE LISTING TEST ===');
  await testObjectStorageListing();
  
  console.log('\n=== TESTS COMPLETE ===');
}

runTests();