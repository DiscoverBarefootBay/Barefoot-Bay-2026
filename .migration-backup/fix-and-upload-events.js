/**
 * Direct events upload script
 * This script will process the CSV file and upload events directly
 * fixing validation issues along the way
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import querystring from 'querystring';
import { fileURLToPath } from 'url';

// Get current file directory (equivalent to __dirname in CommonJS)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Helper function to create default hours of operation
 * @returns {Object} Default hours of operation
 */
function createDefaultHoursOfOperation() {
  return {
    Monday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
    Tuesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
    Wednesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
    Thursday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
    Friday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
    Saturday: { isOpen: false, openTime: '', closeTime: '' },
    Sunday: { isOpen: false, openTime: '', closeTime: '' }
  };
}

// Configuration
const CSV_FILE_PATH = './attached_assets/events-1742457592334-102144088.csv';
const SERVER_URL = 'http://localhost:3000'; // Local server URL
const USERNAME = 'Bob the Builder'; // Admin username from server logs
const PASSWORD = 'builder'; // Default password (modify if needed)

// Store cookies and auth data
let cookies = '';

/**
 * Parse CSV data
 * @param {string} csvText - CSV text content
 * @returns {Array} - Array of objects representing CSV rows
 */
function parseCSV(csvText) {
  // Remove BOM character if present
  const dataWithoutBOM = csvText.replace(/^\uFEFF/, '');
  
  // Split into lines and get headers
  const lines = dataWithoutBOM.split('\n').filter(line => line.trim());
  const headers = parseCSVLine(lines[0]);
  
  // Parse each line into records
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const record = {};
        headers.forEach((header, index) => {
          record[header.trim()] = values[index];
        });
        records.push(record);
      }
    }
  }
  
  return records;
}

/**
 * Parse a CSV line respecting quotes
 */
function parseCSVLine(line) {
  const values = [];
  let inQuotes = false;
  let currentValue = '';
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // Toggle quote state
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      // End of field
      values.push(currentValue);
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  
  // Add the last field
  values.push(currentValue);
  return values;
}

/**
 * Process CSV events for API upload
 * @param {Array} records - Raw CSV records
 * @returns {Array} - Processed events ready for API
 */
function processEvents(records) {
  return records.map(record => {
    // Create a clean record
    const event = { ...record };
    
    // Fix dates
    if (event.startDate) {
      event.startDate = new Date(event.startDate);
    }
    if (event.endDate) {
      event.endDate = new Date(event.endDate);
    }
    if (event.recurrenceEndDate) {
      event.recurrenceEndDate = new Date(event.recurrenceEndDate);
    }
    
    // Fix boolean fields
    if (event.isRecurring && typeof event.isRecurring === 'string') {
      event.isRecurring = event.isRecurring.toLowerCase() === 'true';
    }
    
    // Fix recurrenceFrequency - convert to lowercase
    if (event.recurrenceFrequency && typeof event.recurrenceFrequency === 'string') {
      // Convert "WEEKLY" to "weekly", "MONTHLY" to "monthly", etc.
      const lowerFrequency = event.recurrenceFrequency.toLowerCase();
      
      // Ensure it's one of the valid values: 'daily', 'weekly', 'biweekly', 'monthly', 'yearly'
      const validFrequencies = ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'];
      if (validFrequencies.includes(lowerFrequency)) {
        event.recurrenceFrequency = lowerFrequency;
      } else {
        // Map non-standard values to standard ones
        const frequencyMap = {
          'week': 'weekly',
          'day': 'daily',
          'month': 'monthly',
          'year': 'yearly',
          'bi-weekly': 'biweekly',
          'bimonthly': 'biweekly'
        };
        
        event.recurrenceFrequency = frequencyMap[lowerFrequency] || 'weekly'; // Default to weekly
      }
      
      console.log(`Converted recurrenceFrequency from "${event.recurrenceFrequency}" to "${event.recurrenceFrequency}"`);
    }
    
    // Fix contactInfo - parse JSON string to object
    if (event.contactInfo && typeof event.contactInfo === 'string') {
      try {
        // Clean up the JSON string - replace escaped quotes and fix common issues
        let cleanedJson = event.contactInfo.replace(/\\"/g, '"');
        
        // If the string starts with a single quote instead of double, fix it
        if (cleanedJson.startsWith("'") && cleanedJson.endsWith("'")) {
          cleanedJson = cleanedJson.replace(/^'|'$/g, '"');
        }
        
        // Add quotes around property names if missing
        cleanedJson = cleanedJson
          .replace(/^\{/, '{"')
          .replace(/\}$/, '"}')
          .replace(/:\s*"/g, '":"')
          .replace(/",\s*/g, '","')
          .replace(/,\s*([a-zA-Z])/g, ',"$1')
          .replace(/([a-zA-Z]):/g, '$1":"');
        
        // Try parsing the cleaned JSON
        event.contactInfo = JSON.parse(cleanedJson);
      } catch (err) {
        console.warn('Failed to parse contactInfo JSON:', err);
        // Provide default object structure
        event.contactInfo = { 
          name: event.businessName || '',
          phone: '', 
          email: '', 
          website: '' 
        };
      }
    }
    
    // Ensure contactInfo has all required properties
    if (!event.contactInfo || typeof event.contactInfo !== 'object') {
      event.contactInfo = { name: '', phone: '', email: '', website: '' };
    } else {
      // Make sure all required fields exist
      event.contactInfo.name = event.contactInfo.name || event.businessName || '';
      event.contactInfo.phone = event.contactInfo.phone || '';
      event.contactInfo.email = event.contactInfo.email || '';
      event.contactInfo.website = event.contactInfo.website || '';
    }
    
    // Fix hoursOfOperation - parse JSON string to object
    if (event.hoursOfOperation && typeof event.hoursOfOperation === 'string') {
      try {
        // Clean up the JSON string - replace escaped quotes and fix common issues
        let cleanedJson = event.hoursOfOperation.replace(/\\"/g, '"');
        
        // If the string starts with a single quote instead of double, fix it
        if (cleanedJson.startsWith("'") && cleanedJson.endsWith("'")) {
          cleanedJson = cleanedJson.replace(/^'|'$/g, '"');
        }
        
        // Try parsing the cleaned JSON
        event.hoursOfOperation = JSON.parse(cleanedJson);
      } catch (err) {
        console.warn('Failed to parse hoursOfOperation JSON:', err);
        // Provide default object structure
        event.hoursOfOperation = createDefaultHoursOfOperation();
      }
    }
    
    // Ensure hoursOfOperation has all required properties
    if (!event.hoursOfOperation || typeof event.hoursOfOperation !== 'object') {
      event.hoursOfOperation = createDefaultHoursOfOperation();
    } else {
      // Ensure each day exists with proper structure
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const defaultHours = createDefaultHoursOfOperation();
      
      for (const day of days) {
        if (!event.hoursOfOperation[day]) {
          // If day is missing, add with defaults
          event.hoursOfOperation[day] = defaultHours[day];
        } else {
          // Ensure day has all required properties
          const daySchedule = event.hoursOfOperation[day];
          
          // If isOpen is not a boolean, convert it
          if (typeof daySchedule.isOpen === 'string') {
            daySchedule.isOpen = daySchedule.isOpen.toLowerCase() === 'true';
          }
          
          // If isOpen is undefined, set a default
          if (daySchedule.isOpen === undefined) {
            daySchedule.isOpen = day !== 'Saturday' && day !== 'Sunday';
          }
          
          // Ensure time fields exist
          daySchedule.openTime = daySchedule.openTime || '';
          daySchedule.closeTime = daySchedule.closeTime || '';
        }
      }
    }
    
    // Fix mediaUrls - parse JSON string to array
    if (event.mediaUrls && typeof event.mediaUrls === 'string') {
      try {
        const cleanedJson = event.mediaUrls.replace(/\\"/g, '"');
        event.mediaUrls = JSON.parse(cleanedJson);
      } catch (err) {
        // If it's not valid JSON, assume it's a comma-separated list
        event.mediaUrls = event.mediaUrls.split(',').map(url => url.trim()).filter(Boolean);
      }
    }
    
    return event;
  });
}

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
 * Main function
 */
async function main() {
  try {
    // Read CSV file
    console.log(`Reading CSV file from ${CSV_FILE_PATH}...`);
    const csvData = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
    
    // Parse CSV
    console.log('Parsing CSV data...');
    const records = parseCSV(csvData);
    console.log(`Found ${records.length} records`);
    
    // Process events
    console.log('Processing events...');
    const events = processEvents(records);
    
    // Save processed events to file for inspection
    const outputPath = './processed-events.json';
    fs.writeFileSync(outputPath, JSON.stringify(events, null, 2));
    console.log(`Processed events saved to ${outputPath}`);
    
    // Login to API
    const loginSuccess = await login();
    if (!loginSuccess) {
      console.error('Login failed, cannot upload events');
      return;
    }
    
    // Upload events
    await uploadEvents(events);
    
    console.log('Script completed successfully');
  } catch (error) {
    console.error('Error:', error);
  }
}

// In ES modules, we need to use an immediately invoked function expression (IIFE)
// This allows us to use async/await at the top level
(async () => {
  try {
    await main();
  } catch (error) {
    console.error('Script execution error:', error);
  }
})();