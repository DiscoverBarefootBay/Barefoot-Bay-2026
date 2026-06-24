/**
 * Upload processed events script
 * This script takes preprocessed events from json file and uploads them to the API
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

// Get current file directory (equivalent to __dirname in CommonJS)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PROCESSED_EVENTS_PATH = './processed-events.json';
const SERVER_URL = 'http://localhost:5000'; // Local server URL (updated to match actual port)
const USERNAME = 'Bob the Builder'; // Admin username from server logs
const PASSWORD = 'builder'; // Default password (modify if needed)

// Store cookies and auth data
let cookies = '';

/**
 * Login to the API
 * @returns {Promise<boolean>} - True if login successful
 */
async function login() {
  console.log(`Logging in as ${USERNAME}...`);
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      username: USERNAME,
      password: PASSWORD
    });
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = http.request(`${SERVER_URL}/api/login`, options, (res) => {
      let responseBody = '';
      
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          cookies = res.headers['set-cookie'];
          console.log('Login successful');
          resolve(true);
        } else {
          console.error(`Login failed with status ${res.statusCode}`);
          console.error(responseBody);
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Login error:', error);
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

/**
 * Upload events to the API
 * @param {Array} events - Array of event objects to upload
 * @returns {Promise<boolean>} - True if upload successful
 */
async function uploadEvents(events) {
  console.log(`Uploading ${events.length} events...`);
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(events);
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Cookie': cookies
      }
    };
    
    const req = http.request(`${SERVER_URL}/api/events/bulk-json`, options, (res) => {
      let responseBody = '';
      
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 201) {
          console.log('Events uploaded successfully');
          try {
            const response = JSON.parse(responseBody);
            console.log(`Created ${response.events.length} events`);
          } catch (e) {
            console.log(responseBody);
          }
          resolve(true);
        } else {
          console.error(`Upload failed with status ${res.statusCode}`);
          console.error(responseBody);
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Upload error:', error);
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

/**
 * Upload events in batches to avoid overwhelming the server
 * @param {Array} events - All events to upload
 * @param {number} batchSize - Number of events per batch
 * @returns {Promise<void>}
 */
async function uploadEventsInBatches(events, batchSize = 10) {
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
      }
    } catch (error) {
      console.error(`Error uploading batch ${batchNumber}:`, error);
    }
    
    // Small delay between batches to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`Event upload completed. Successfully uploaded ${successCount}/${totalEvents} events.`);
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
    await uploadEventsInBatches(events, 5); // 5 events per batch
    
    console.log('Script completed successfully');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
(async () => {
  try {
    await main();
  } catch (error) {
    console.error('Script execution error:', error);
  }
})();