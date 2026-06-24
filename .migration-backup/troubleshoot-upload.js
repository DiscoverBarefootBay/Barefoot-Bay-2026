/**
 * Troubleshooting script for Barefoot Bay Event Upload
 * This script will trace through the CSV upload process
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const BASE_URL = 'http://localhost:3000';
const TEST_FILE_PATH = path.join(__dirname, 'uploads', 'test-event.csv');
const DEBUG = true;

// Mock admin credentials - replace these with your actual admin credentials
const ADMIN_USERNAME = 'Bob the Builder';
const ADMIN_PASSWORD = 'test';

/**
 * Login to get a session cookie
 */
async function login() {
  console.log('Logging in as admin user...');
  
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD
    })
  });
  
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${response.statusText}`);
  }
  
  const cookies = response.headers.raw()['set-cookie'];
  const cookieHeader = cookies ? cookies.join('; ') : '';
  
  console.log('Login successful!');
  return cookieHeader;
}

/**
 * Upload events CSV file
 */
async function uploadEvents(cookieHeader) {
  console.log(`\nUploading test CSV file: ${TEST_FILE_PATH}`);
  
  if (!fs.existsSync(TEST_FILE_PATH)) {
    throw new Error(`Test file not found: ${TEST_FILE_PATH}`);
  }
  
  // Read file contents for debug purposes
  if (DEBUG) {
    const fileContents = fs.readFileSync(TEST_FILE_PATH, 'utf8');
    console.log('\nCSV file contents:');
    console.log(fileContents);
  }
  
  // Create form data with the CSV file
  const formData = new FormData();
  formData.append('events', fs.createReadStream(TEST_FILE_PATH));
  
  // Set explicitly to emphasize it's a CSV file
  formData.append('fileType', 'csv');
  
  console.log('\nSending request to upload endpoint...');
  
  const uploadResponse = await fetch(`${BASE_URL}/api/events/bulk`, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeader
    },
    body: formData
  });
  
  const responseText = await uploadResponse.text();
  
  try {
    // Try to parse as JSON
    const uploadResult = JSON.parse(responseText);
    console.log('\nUpload response status:', uploadResponse.status);
    console.log('Upload response body:', uploadResult);
    
    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${JSON.stringify(uploadResult)}`);
    }
    
    return uploadResult;
  } catch (parseError) {
    // If JSON parsing fails, return the raw text
    console.log('\nNon-JSON response received:');
    console.log(responseText);
    throw new Error('Failed to parse server response');
  }
}

/**
 * Get all events to verify upload
 */
async function getEvents(cookieHeader) {
  console.log('\nVerifying events were created by querying the API...');
  
  const response = await fetch(`${BASE_URL}/api/events`, {
    headers: {
      'Cookie': cookieHeader
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
  }
  
  const events = await response.json();
  console.log(`Retrieved ${events.length} events`);
  
  if (events.length > 0) {
    console.log('First event sample:', JSON.stringify(events[0], null, 2));
  } else {
    console.log('No events found in the database');
  }
  
  return events;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Starting troubleshooting process for event upload...');
    
    // Step 1: Login
    const cookieHeader = await login();
    
    // Step 2: Upload test CSV file
    const uploadResult = await uploadEvents(cookieHeader);
    
    // Step 3: Verify events were created
    const events = await getEvents(cookieHeader);
    
    if (events.length > 0) {
      console.log('\n✅ Success! Events were created correctly.');
    } else {
      console.log('\n❌ Error: Events were not created despite successful upload response.');
    }
    
  } catch (error) {
    console.error('\n❌ Error during troubleshooting:', error.message);
  }
}

// Run the script
main();