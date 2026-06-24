/**
 * Advanced bulk event upload script that works with the existing API
 * Much simpler approach using fetch and readline for interactive use
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PROCESSED_EVENTS_PATH = './processed-events.json';
const SERVER_URL = 'http://localhost:5000'; // Updated to match server port

// Interactive prompt
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Store cookies and auth data
let cookies = '';

/**
 * Ask user for input
 * @param {string} question - The question to ask
 * @returns {Promise<string>} - User input
 */
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Login to the API
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<boolean>} - True if login successful
 */
async function login(username, password) {
  console.log(`Logging in as ${username}...`);
  
  try {
    const response = await fetch(`${SERVER_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
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
 * Upload events to the API
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
      console.log(`Successfully uploaded ${result.events.length} events`);
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
        
        // Ask user if they want to continue
        const answer = await askQuestion('Do you want to continue with the next batch? (y/n): ');
        if (answer.toLowerCase() !== 'y') {
          console.log('Aborting upload process');
          return successCount;
        }
      }
    } catch (error) {
      console.error(`Error uploading batch ${batchNumber}:`, error);
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
    
    // Get credentials from user
    const username = await askQuestion('Enter admin username: ');
    const password = await askQuestion('Enter admin password: ');
    
    // Login to API
    const loginSuccess = await login(username, password);
    if (!loginSuccess) {
      console.error('Login failed, cannot upload events');
      rl.close();
      return;
    }
    
    // Ask for batch size
    const batchSizeStr = await askQuestion('Enter batch size (default 5): ');
    const batchSize = parseInt(batchSizeStr) || 5;
    
    // Upload events in batches
    const uploaded = await uploadEventsInBatches(events, batchSize);
    
    console.log(`Upload completed. Successfully uploaded ${uploaded}/${events.length} events.`);
    
    rl.close();
  } catch (error) {
    console.error('Error:', error);
    rl.close();
  }
}

// Run the script
(async () => {
  try {
    await main();
  } catch (error) {
    console.error('Script execution error:', error);
    rl.close();
  }
})();