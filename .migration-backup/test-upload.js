/**
 * Test script to directly upload a file to Replit Object Storage
 * and verify our calendar media storage is working correctly
 */
import fs from 'fs';
import path from 'path';
import { Client } from '@replit/object-storage';
import fetch from 'node-fetch';

// Configuration
const TEST_FILE_PATH = 'attached_assets/image_1746243992886.png';
const TEST_OBJECT_KEY = 'calendar/test-calendar-image.png';
const BUCKET = 'DEFAULT';

// Initialize Replit Object Storage client
const objectStorage = new Client({ verbose: true });

async function listCalendarMedia() {
  console.log('Fetching list of calendar media in Object Storage...');
  try {
    // List all objects in the calendar/ prefix in Object Storage
    const objects = await objectStorage.list({ bucket: BUCKET, prefix: 'calendar/' });
    
    console.log(`Found ${objects.length} object(s) in Object Storage with prefix 'calendar/':`);
    objects.forEach(object => {
      console.log(`- ${object.key} (${Math.round(object.size / 1024)}KB)`);
    });
    
    return objects;
  } catch (error) {
    console.error('Error listing objects in Object Storage:', error);
    return [];
  }
}

async function uploadToObjectStorage() {
  console.log(`Uploading test file to Object Storage: ${TEST_FILE_PATH} -> ${BUCKET}/${TEST_OBJECT_KEY}`);
  try {
    // Read the file
    const fileContent = fs.readFileSync(TEST_FILE_PATH);
    
    // Upload to Object Storage
    await objectStorage.put({
      bucket: BUCKET,
      key: TEST_OBJECT_KEY, 
      data: fileContent,
      contentType: 'image/png'
    });
    
    console.log('✅ Successfully uploaded to Object Storage');
    return true;
  } catch (error) {
    console.error('Error uploading to Object Storage:', error);
    return false;
  }
}

async function verifyObjectExists() {
  console.log(`Verifying object exists in Object Storage: ${BUCKET}/${TEST_OBJECT_KEY}`);
  try {
    // Check if the object exists
    const exists = await objectStorage.exists({ bucket: BUCKET, key: TEST_OBJECT_KEY });
    
    if (exists) {
      console.log('✅ Object exists in Object Storage');
      
      // Get the URL for the object
      const url = objectStorage.getPublicUrl(BUCKET, TEST_OBJECT_KEY);
      console.log(`Public URL: ${url}`);
      
      // Try to fetch the object to verify it's accessible
      try {
        const response = await fetch(url, { method: 'HEAD' });
        console.log(`HTTP status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          console.log('✅ Object is publicly accessible');
        } else {
          console.log('❌ Object exists but is not publicly accessible');
        }
      } catch (fetchError) {
        console.error('Error fetching object:', fetchError);
      }
      
      return { exists: true, url };
    } else {
      console.log('❌ Object does not exist in Object Storage');
      return { exists: false };
    }
  } catch (error) {
    console.error('Error checking if object exists:', error);
    return { exists: false, error };
  }
}

async function checkMappingsFile() {
  console.log('Checking calendar media mappings file...');
  try {
    const mappingPaths = [
      'server/calendar-media-mapping.json',
      'calendar-media-mapping.json',
      'dist/server/calendar-media-mapping.json'
    ];
    
    for (const mappingPath of mappingPaths) {
      if (fs.existsSync(mappingPath)) {
        console.log(`Found mapping file at ${mappingPath}`);
        
        const content = fs.readFileSync(mappingPath, 'utf8');
        const mapping = JSON.parse(content);
        
        console.log(`Mapping contains ${Object.keys(mapping).length} entries`);
        
        // Print some example entries
        const entries = Object.entries(mapping);
        if (entries.length > 0) {
          console.log('Example mappings:');
          entries.slice(0, 3).forEach(([fsPath, osUrl]) => {
            console.log(`- ${fsPath} → ${osUrl}`);
          });
        }
        
        return mapping;
      }
    }
    
    console.log('⚠️ No calendar media mapping file found');
    return null;
  } catch (error) {
    console.error('Error checking mapping file:', error);
    return null;
  }
}

async function main() {
  console.log('=== CALENDAR MEDIA STORAGE TEST ===');
  
  // First check existing calendar media in Object Storage
  await listCalendarMedia();
  
  // Check the mappings file
  const mappings = await checkMappingsFile();
  
  // Upload a test file to Object Storage
  const uploaded = await uploadToObjectStorage();
  
  if (uploaded) {
    // Verify the file exists
    const verification = await verifyObjectExists();
    
    if (verification.exists) {
      console.log('✅ Test passed: File uploaded and verified in Object Storage');
    } else {
      console.log('❌ Test failed: File uploaded but could not be verified');
    }
  } else {
    console.log('❌ Test failed: Could not upload file to Object Storage');
  }
  
  console.log('=== TEST COMPLETE ===');
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error('Unhandled error:', error);
  }
})();