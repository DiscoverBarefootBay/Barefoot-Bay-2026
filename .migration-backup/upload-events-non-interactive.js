/**
 * Non-interactive bulk event upload script
 * Uses hardcoded admin credentials (modify before running)
 */
import fs from 'fs';
import fetch from 'node-fetch';

// Configuration
const PROCESSED_EVENTS_PATH = './processed-events.json';
const SERVER_URL = 'http://localhost:5000'; 
const USERNAME = 'Bob the Builder';  // Change this to match your admin username
const PASSWORD = 'builder123';       // Change this to match your admin password
const BATCH_SIZE = 5;                // Number of events to upload per batch

// Store cookies and auth data
let cookies = '';

/**
 * Login to the API
 * @returns {Promise<boolean>} - True if login successful
 */
async function login() {
  console.log(`Logging in as ${USERNAME}...`);
  
  try {
    const response = await fetch(`${SERVER_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD })
    });
    
    if (response.ok) {
      cookies = response.headers.get('set-cookie');
      console.log('Login successful');
      return true;
    } else {
      const error = await response.json();
      console.error(`Login failed: ${error.message}`);
      return false;
    }
  } catch (error) {
    console.error('Login error:', error.message);
    return false;
  }
}

/**
 * Upload a batch of events to the API
 * @param {Array} events - Array of event objects to upload
 * @returns {Promise<boolean>} - True if upload successful
 */
async function uploadEvents(events) {
  console.log(`Uploading ${events.length} events...`);
  
  try {
    const response = await fetch(`${SERVER_URL}/api/events/bulk-json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify(events)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`Successfully uploaded ${result.events?.length || 0} events`);
      return true;
    } else {
      let errorText;
      try {
        const error = await response.json();
        errorText = error.message;
      } catch (e) {
        errorText = await response.text();
      }
      console.error(`Upload failed (${response.status}): ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error('Upload error:', error.message);
    return false;
  }
}

/**
 * Upload events in batches to avoid overwhelming the server
 * @param {Array} events - All events to upload
 * @param {number} batchSize - Number of events per batch
 * @returns {Promise<number>} - Number of successfully uploaded events
 */
async function uploadEventsInBatches(events, batchSize = BATCH_SIZE) {
  const totalEvents = events.length;
  const batches = Math.ceil(totalEvents / batchSize);
  
  console.log(`Uploading ${totalEvents} events in ${batches} batches of ${batchSize}...`);
  
  let successCount = 0;
  
  for (let i = 0; i < totalEvents; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    console.log(`Processing batch ${batchNumber}/${batches} (${batch.length} events)...`);
    
    try {
      const success = await uploadEvents(batch);
      if (success) {
        successCount += batch.length;
        console.log(`Batch ${batchNumber} uploaded successfully. Progress: ${successCount}/${totalEvents}`);
      } else {
        console.error(`Failed to upload batch ${batchNumber}`);
        console.log('Continuing with next batch...');
      }
    } catch (error) {
      console.error(`Error uploading batch ${batchNumber}:`, error.message || error);
    }
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return successCount;
}

/**
 * Main function
 */
async function main() {
  try {
    // Read processed events JSON file
    console.log(`Reading processed events from ${PROCESSED_EVENTS_PATH}...`);
    const jsonData = fs.readFileSync(PROCESSED_EVENTS_PATH, 'utf-8');
    const events = JSON.parse(jsonData);
    
    console.log(`Found ${events.length} events to upload`);
    
    // Login to API
    const loginSuccess = await login();
    if (!loginSuccess) {
      console.error('Login failed, cannot upload events');
      return;
    }
    
    // Upload events in batches
    const uploaded = await uploadEventsInBatches(events, BATCH_SIZE);
    
    console.log(`Upload completed. Successfully uploaded ${uploaded}/${events.length} events.`);
  } catch (error) {
    console.error('Error:', error.message || error);
  }
}

// Run the script
(async () => {
  try {
    await main();
  } catch (error) {
    console.error('Script execution error:', error.message || error);
  }
})();