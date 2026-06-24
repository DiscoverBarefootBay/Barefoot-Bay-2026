/**
 * Simple utility to test Object Storage operations
 */

import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Set up __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a new client
const client = new Client();

// Test file path
const testFilePath = path.join(__dirname, 'real-estate-media', '1745647446015-607363766.jpg');

// Test key
const testKey = 'test/test-file.jpg';

async function testObjectStorage() {
  try {
    console.log(`Testing Object Storage with file: ${testFilePath}`);
    console.log(`Key: ${testKey}`);

    // Check if file exists
    if (!fs.existsSync(testFilePath)) {
      console.error('Test file does not exist');
      return;
    }

    // Read file
    const fileBuffer = fs.readFileSync(testFilePath);
    console.log(`File read, size: ${fileBuffer.length} bytes`);

    // List available methods on client
    console.log('Available methods on client:');
    console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(client)));

    // Test uploadFromFilename method
    console.log('\nTesting uploadFromFilename method:');
    try {
      const uploadFileResult = await client.uploadFromFilename(testKey, testFilePath);
      console.log('uploadFromFilename result:', uploadFileResult);
    } catch (error) {
      console.error('Error with uploadFromFilename:', error.message);
    }

    // Test uploadFromText method
    console.log('\nTesting uploadFromText method:');
    try {
      const uploadTextResult = await client.uploadFromText(`${testKey}.text`, 'This is a test text file');
      console.log('uploadFromText result:', uploadTextResult);
    } catch (error) {
      console.error('Error with uploadFromText:', error.message);
    }
    
    // Test uploadFromBytes method
    console.log('\nTesting uploadFromBytes method:');
    try {
      const uploadBytesResult = await client.uploadFromBytes(`${testKey}.bytes`, fileBuffer);
      console.log('uploadFromBytes result:', uploadBytesResult);
    } catch (error) {
      console.error('Error with uploadFromBytes:', error.message);
    }

    // List objects
    console.log('\nListing objects:');
    try {
      const objects = await client.list();
      console.log('Objects in store:', objects);
    } catch (error) {
      console.error('Error listing objects:', error.message);
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testObjectStorage();