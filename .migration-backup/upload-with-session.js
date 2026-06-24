/**
 * Session-based bulk event upload script
 * 
 * This script uploads events using a session cookie from a browser
 * Requires you to be already logged in to the web interface
 * 
 * Usage:
 * 1. Log in to the web interface
 * 2. Copy your session cookie 
 * 3. Run this script and paste the cookie when prompted
 */
import fs from 'fs';
import fetch from 'node-fetch';
import readline from 'readline';

// Configuration
const PROCESSED_EVENTS_PATH = './processed-events.json';
const SERVER_URL = 'http://localhost:5000';
const BATCH_SIZE = 5;

// Interactive prompt
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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
        
        // Ask if the user wants to continue
        const answer = await askQuestion('Continue with next batch? (y/n): ');
        if (answer.toLowerCase() !== 'y') {
          console.log('Aborting upload process');
          break;
        }
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
    
    // Get session cookie from user
    console.log('\nINSTRUCTIONS:');
    console.log('1. Make sure you are logged in to the web interface as an admin');
    console.log('2. Open browser developer tools (F12 or Ctrl+Shift+I)');
    console.log('3. Go to the Application tab > Cookies');
    console.log('4. Find and copy the "connect.sid" cookie value');
    
    const cookieValue = await askQuestion('\nEnter your session cookie: ');
    const sessionCookie = `connect.sid=${cookieValue}`;
    
    // Verify that cookie is in correct format
    if (!cookieValue || cookieValue.trim() === '') {
      console.error('Error: Session cookie is required');
      rl.close();
      return;
    }
    
    console.log('Using session cookie for authentication');
    
    // Ask for batch size
    const batchSizeStr = await askQuestion('Enter batch size (default 5): ');
    const batchSize = parseInt(batchSizeStr) || BATCH_SIZE;
    
    // Upload events in batches
    const uploaded = await uploadEventsInBatches(events, sessionCookie, batchSize);
    
    console.log(`Upload completed. Successfully uploaded ${uploaded}/${events.length} events.`);
    
    rl.close();
  } catch (error) {
    console.error('Error:', error.message || error);
    rl.close();
  }
}

// Run the script
(async () => {
  try {
    await main();
  } catch (error) {
    console.error('Script execution error:', error.message || error);
    rl.close();
  }
})();