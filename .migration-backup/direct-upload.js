/**
 * Direct event upload script with command-line arguments
 * 
 * This script uploads events using a session cookie from a browser
 * Takes the session cookie value as a command-line argument
 * 
 * Usage:
 * node direct-upload.js YOUR_SESSION_COOKIE_VALUE
 */
import fs from 'fs';
import fetch from 'node-fetch';

// Configuration
const PROCESSED_EVENTS_PATH = './processed-events.json';
const SERVER_URL = 'http://localhost:5000';
const BATCH_SIZE = 5;

/**
 * Upload a batch of events to the API
 * @param {Array} events - Array of event objects to upload
 * @param {string} sessionCookie - Session cookie for authentication
 * @returns {Promise<boolean>} - True if upload successful
 */
async function uploadEvents(events, sessionCookie) {
  console.log(`Uploading ${events.length} events...`);
  
  try {
    const response = await fetch(`${SERVER_URL}/api/events/bulk-json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
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
    console.error('Upload error:', error.message || error);
    return false;
  }
}

/**
 * Upload events in batches to avoid overwhelming the server
 * @param {Array} events - All events to upload
 * @param {string} sessionCookie - Session cookie for authentication
 * @param {number} batchSize - Number of events per batch
 * @returns {Promise<number>} - Number of successfully uploaded events
 */
async function uploadEventsInBatches(events, sessionCookie, batchSize = BATCH_SIZE) {
  const totalEvents = events.length;
  const batches = Math.ceil(totalEvents / batchSize);
  
  console.log(`Uploading ${totalEvents} events in ${batches} batches of ${batchSize}...`);
  
  let successCount = 0;
  
  for (let i = 0; i < totalEvents; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    console.log(`Processing batch ${batchNumber}/${batches} (${batch.length} events)...`);
    
    try {
      const success = await uploadEvents(batch, sessionCookie);
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
    // Get session cookie from command-line argument
    const cookieValue = process.argv[2];
    
    if (!cookieValue) {
      console.error('Error: Session cookie value required');
      console.error('Usage: node direct-upload.js YOUR_SESSION_COOKIE_VALUE');
      return;
    }
    
    const sessionCookie = `connect.sid=${cookieValue}`;
    
    // Read processed events JSON file
    console.log(`Reading processed events from ${PROCESSED_EVENTS_PATH}...`);
    const jsonData = fs.readFileSync(PROCESSED_EVENTS_PATH, 'utf-8');
    const events = JSON.parse(jsonData);
    
    console.log(`Found ${events.length} events to upload`);
    console.log('Using provided session cookie for authentication');
    
    // Upload events in batches
    const uploaded = await uploadEventsInBatches(events, sessionCookie, BATCH_SIZE);
    
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