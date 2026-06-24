/**
 * CSV processor tool specifically designed to fix the media_urls field format issue
 * This script handles the conversion from JSON to proper text array format
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';

// Configuration
const CSV_FILE = 'test-events.csv';
const API_URL = 'http://localhost:3000';
const USERNAME = 'Bob the Builder';
const PASSWORD = 'admin123';

async function main() {
  try {
    console.log(`Processing CSV file: ${CSV_FILE}`);
    
    // Read the CSV file
    const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
    
    // Parse CSV
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    console.log(`Found ${records.length} events in CSV`);
    
    // Process each record to ensure media URLs are in the correct format
    const processedEvents = records.map(record => processEvent(record));
    
    // Login to get a session cookie
    console.log('Logging in...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: USERNAME,
        password: PASSWORD
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Login successful, got cookies');
    
    // Upload events
    console.log('Uploading events...');
    for (const [index, event] of processedEvents.entries()) {
      console.log(`\nUploading event ${index + 1}/${processedEvents.length}: ${event.title}`);
      console.log('Event data:', JSON.stringify(event, null, 2));
      
      try {
        const response = await fetch(`${API_URL}/api/events`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': cookies
          },
          body: JSON.stringify(event)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to upload event ${index + 1}: ${response.status} ${response.statusText}`);
          console.error(`Error details: ${errorText}`);
          continue;
        }
        
        const result = await response.json();
        console.log(`Successfully uploaded event ${index + 1}, ID: ${result.id}`);
      } catch (error) {
        console.error(`Error uploading event ${index + 1}:`, error);
      }
    }
    
    console.log('\nImport completed');
    console.log(`Total events processed: ${processedEvents.length}`);
    
  } catch (error) {
    console.error('Error processing CSV:', error);
  }
}

/**
 * Process a CSV record into a properly formatted event object
 * @param {Object} record - CSV record
 * @returns {Object} - Formatted event object
 */
function processEvent(record) {
  // Process dates
  const startDate = new Date(record['Start Date']);
  const endDate = new Date(record['End Date']);
  
  // Process recurrence
  const isRecurring = record['Is Recurring']?.toLowerCase() === 'true';
  const recurrenceFrequency = isRecurring ? record['Frequency'] || null : null;
  const recurrenceEndDate = isRecurring && record['End Recurrence Date'] 
    ? new Date(record['End Recurrence Date']) 
    : null;
  
  // Process media URLs - this is the key part that needs fixing
  let mediaUrls = [];
  if (record['Media URLs']) {
    // Split by pipe character if multiple URLs
    mediaUrls = record['Media URLs'].split('|').map(url => url.trim()).filter(url => url);
    console.log(`Processed media URLs for "${record['Event Title']}":`, mediaUrls);
  }
  
  // Process contact info
  const contactInfo = {
    name: record['Contact Name'] || '',
    phone: record['Contact Phone'] || '',
    email: record['Contact Email'] || '',
    website: record['Contact Website'] || ''
  };
  
  // Construct the event object
  return {
    title: record['Event Title'],
    description: record['Description'] || '',
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    location: record['Location'] || '',
    category: record['Category'] || 'social',
    businessName: record['Business Name'] || '',
    contactInfo,
    mediaUrls,
    isRecurring,
    recurrenceFrequency,
    recurrenceEndDate: recurrenceEndDate ? recurrenceEndDate.toISOString() : null
  };
}

main();