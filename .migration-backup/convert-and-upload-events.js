/**
 * Comprehensive tool to convert Excel/CSV event data to API-compatible format and upload
 * 
 * This script handles:
 * - Processing CSV with BOM character removal
 * - Fixing column name detection (especially for "Event Title")
 * - Converting date/time formats
 * - Structuring contact information and hours of operation
 * - Creating proper recurring events data
 * - Validating required fields
 * - Uploading to the API (optional)
 * 
 * Usage:
 * node convert-and-upload-events.js [--upload] [--username=admin] [--password=password]
 * 
 * Options:
 *   --upload      Upload events to the API after conversion
 *   --username    Admin username for API authentication (required with --upload)
 *   --password    Admin password for API authentication (required with --upload)
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import fetch from 'node-fetch';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get script directory for relative paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const shouldUpload = args.includes('--upload');
const usernameArg = args.find(arg => arg.startsWith('--username='));
const passwordArg = args.find(arg => arg.startsWith('--password='));
const username = usernameArg ? usernameArg.split('=')[1] : null;
const password = passwordArg ? passwordArg.split('=')[1] : null;

// Determine if running on Replit
const isOnReplit = process.env.REPL_ID !== undefined;
const API_BASE_URL = isOnReplit ? 
  `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 
  'http://localhost:3000';

console.log(`🔧 Running on ${isOnReplit ? 'Replit' : 'local machine'}`);
console.log(`🔗 Using API base URL: ${API_BASE_URL}`);

// Input and output file paths
const inputFile = join(__dirname, 'attached_assets', 'Barefoot Bay Reoccuring Events for Website CSV.csv');
const outputFile = join(__dirname, 'uploads', 'events.csv');
const jsonOutputFile = join(__dirname, 'uploads', 'events.json');

// Ensure the uploads directory exists
if (!fs.existsSync(join(__dirname, 'uploads'))) {
  fs.mkdirSync(join(__dirname, 'uploads'), { recursive: true });
}

// Create readline interface for user prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Main function to process and optionally upload events
async function main() {
  try {
    console.log('🔄 Converting events from CSV file to API format...');
    const events = await processCSVFile(inputFile);
    
    // Write output to CSV file
    fs.writeFileSync(outputFile, stringify(events, { header: true }));
    console.log(`✅ Processed ${events.length} events and saved to ${outputFile}`);
    
    // Also save as JSON for easier API uploads
    fs.writeFileSync(jsonOutputFile, JSON.stringify(events, null, 2));
    console.log(`✅ JSON version saved to ${jsonOutputFile}`);
    
    // Upload if requested
    if (shouldUpload) {
      if (!username || !password) {
        console.error('❌ Error: Username and password are required for upload');
        console.log('Usage: node convert-and-upload-events.js --upload --username=admin --password=password');
        process.exit(1);
      }
      
      await uploadEvents(events, username, password);
    }
    
    console.log('✨ Process completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

// Process the CSV file and convert to API format
async function processCSVFile(filePath) {
  console.log(`📂 Reading CSV file from ${filePath}...`);
  
  // Read the file as a buffer to handle BOM
  const fileBuffer = fs.readFileSync(filePath);
  
  // Remove BOM if present
  let fileContent;
  if (fileBuffer.length >= 3 && 
      fileBuffer[0] === 0xEF && 
      fileBuffer[1] === 0xBB && 
      fileBuffer[2] === 0xBF) {
    console.log("🔧 Removing UTF-8 BOM from CSV file");
    fileContent = fileBuffer.slice(3).toString('utf8');
  } else {
    fileContent = fileBuffer.toString('utf8');
  }
  
  // Parse CSV with robust settings
  const records = parse(fileContent, {
    columns: true,
    skipEmptyLines: true,
    relaxColumnCount: true,
    relaxQuotes: true,
    trim: true
  });
  
  console.log(`📊 Found ${records.length} events in CSV file`);
  
  // Find the title column
  const firstRecord = records[0];
  const titleKey = Object.keys(firstRecord).find(key => 
    key.toLowerCase().includes('title') || key === 'Event Title' || key === '﻿Event Title'
  );
  
  if (!titleKey) {
    throw new Error("Could not find 'Event Title' column in CSV file");
  }
  
  console.log(`🔑 Found event title column: "${titleKey}"`);
  
  // Process each record and filter out invalid events
  const processedEvents = records.map((record, index) => {
    // Get event title (required field)
    const eventTitle = record[titleKey] || '';
    
    // Check required fields
    const location = record['Location'] || '625 Barefoot Blvd, Barefoot Bay, FL 32976, USA';
    const startDate = record['Start Date & Time'];
    const endDate = record['End Date & Time'];
    const category = (record['Category'] || 'social').toLowerCase();
    
    // Detect invalid records
    const isMissingRequiredFields = !eventTitle || !startDate || !endDate;
    
    if (isMissingRequiredFields) {
      if (!eventTitle) {
        console.warn(`⚠️ Warning: Event #${index + 1} has no title`);
      }
      if (!startDate || !endDate) {
        console.warn(`⚠️ Warning: Event #${index + 1} "${eventTitle}" missing start or end date`);
      }
    }
    
    // Extract contact info from individual fields
    const contactInfo = {
      name: record['Contact Name'] || '',
      phone: record['Phone Number'] || '',
      email: record['Email Address'] || '',
      website: record['Website'] || ''
    };
    
    // Parse hours of operation for each day
    const hoursData = {
      Monday: parseHoursString(record['Hours - Monday']),
      Tuesday: parseHoursString(record['Hours - Tuesday']),
      Wednesday: parseHoursString(record['Hours - Wednesday']),
      Thursday: parseHoursString(record['Hours - Thursday']),
      Friday: parseHoursString(record['Hours - Friday']),
      Saturday: parseHoursString(record['Hours - Saturday']),
      Sunday: parseHoursString(record['Hours - Sunday'])
    };
    
    // Process recurring event data
    const isRecurring = record['Recurring Event (Yes/No)'] === 'Yes';
    let frequency = record['Frequency'] || '';
    let recurrenceEndDate = record['Recurring Event End Date'] || '';
    
    // Map frequency values to the API's expected format
    if (isRecurring) {
      frequency = mapFrequency(frequency);
      recurrenceEndDate = formatDate(recurrenceEndDate);
    }
    
    // Progress indicator
    if (index < 5 || index === records.length - 1) {
      console.log(`🔄 Processing event #${index + 1}: "${eventTitle}"`);
    } else if (index === 5) {
      console.log("... processing remaining events ...");
    }
    
    return {
      isValid: !isMissingRequiredFields,
      data: {
        title: eventTitle,
        description: record['Description'] || '',
        location: location,
        startDate: startDate,
        endDate: endDate,
        category: category,
        businessName: record['Business/Amenity Name'] || '',
        
        // Structured JSON data
        contactInfo: JSON.stringify(contactInfo),
        hoursOfOperation: JSON.stringify(hoursData),
        
        // Recurring event fields
        isRecurring: isRecurring ? 'true' : 'false',
        recurrenceFrequency: frequency,
        recurrenceEndDate: recurrenceEndDate,
        
        // Default empty array for media
        mediaUrls: '[]'
      }
    };
  });
  
  // Filter out invalid events
  const validEvents = processedEvents
    .filter(event => event.isValid)
    .map(event => event.data);
  
  const invalidCount = processedEvents.length - validEvents.length;
  if (invalidCount > 0) {
    console.log(`⚠️ Removed ${invalidCount} invalid events (missing required fields)`);
  }
  
  return validEvents;
}

// Upload events to the API
async function uploadEvents(events, username, password) {
  console.log('🔐 Logging in to the API...');
  const authToken = await login(username, password);
  
  if (!authToken) {
    throw new Error('Authentication failed');
  }
  
  console.log('📤 Starting event upload...');
  
  let successCount = 0;
  let failureCount = 0;
  
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    try {
      // Progress update
      console.log(`📤 Uploading event ${i+1}/${events.length}: "${event.title}"`);
      
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `connect.sid=${authToken}`
        },
        body: JSON.stringify(event)
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`API error (${response.status}): ${text}`);
      }
      
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to upload event "${event.title}": ${error.message}`);
      failureCount++;
    }
  }
  
  console.log(`✅ Upload complete: ${successCount} successful, ${failureCount} failed`);
}

// Login to the API
async function login(username, password) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });
  
  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }
  
  // Extract session cookie
  const cookies = response.headers.get('set-cookie');
  if (!cookies) {
    throw new Error('No session cookie returned from API');
  }
  
  const sessionMatch = cookies.match(/connect\.sid=([^;]+)/);
  if (!sessionMatch) {
    throw new Error('Could not extract session ID from cookies');
  }
  
  return sessionMatch[1];
}

// Helper function to map frequency strings to API enum values
function mapFrequency(frequency) {
  if (!frequency) return '';
  
  const freqMap = {
    'Daily': 'DAILY',
    'Weekly': 'WEEKLY',
    'Bi-Weekly': 'BIWEEKLY',
    'Monthly': 'MONTHLY',
    'Yearly': 'YEARLY',
    'DAILY': 'DAILY',
    'WEEKLY': 'WEEKLY',
    'BIWEEKLY': 'BIWEEKLY',
    'MONTHLY': 'MONTHLY',
    'YEARLY': 'YEARLY'
  };
  
  return freqMap[frequency] || frequency;
}

// Helper function to format date strings
function formatDate(dateStr) {
  if (!dateStr) return '';
  
  // If date is already in ISO format, return it
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateStr;
  }
  
  // Handle format like "31-Dec-25"
  const dateParts = dateStr.split('-');
  if (dateParts.length === 3) {
    const day = dateParts[0];
    const monthMap = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
      'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    const month = monthMap[dateParts[1]];
    let year = dateParts[2];
    
    // Expand 2-digit year to 4-digit
    if (year.length === 2) {
      year = '20' + year; // Assuming all years are in the 21st century
    }
    
    if (month) {
      return `${year}-${month}-${day.padStart(2, '0')}`;
    }
  }
  
  // Default to end of 2025 if can't parse
  return '2025-12-31';
}

// Helper function to parse hours string
function parseHoursString(hoursString) {
  if (!hoursString || hoursString === 'CLOSED') {
    return {
      isOpen: false,
      openTime: "",
      closeTime: ""
    };
  }
  
  try {
    const parts = hoursString.split('-').map(t => t.trim());
    
    if (parts.length !== 2) {
      // Invalid format, return closed
      return {
        isOpen: false,
        openTime: "",
        closeTime: ""
      };
    }
    
    const openTime = formatTimeString(parts[0]);
    const closeTime = formatTimeString(parts[1]);
    
    return {
      isOpen: true,
      openTime: openTime,
      closeTime: closeTime
    };
  } catch (error) {
    console.error(`❌ Error parsing hours: ${hoursString}`, error);
    return {
      isOpen: false,
      openTime: "",
      closeTime: ""
    };
  }
}

// Helper function to format time string to HH:MM
function formatTimeString(timeStr) {
  if (!timeStr) return "";
  
  try {
    // Extract hours, minutes, and AM/PM
    const timeRegex = /(\d+):(\d+)(am|pm)/i;
    const match = timeStr.match(timeRegex);
    
    if (!match) return timeStr;
    
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = match[3].toLowerCase();
    
    // Convert to 24-hour format
    if (period === 'pm' && hours < 12) {
      hours += 12;
    } else if (period === 'am' && hours === 12) {
      hours = 0;
    }
    
    // Format to ensure two digits
    const formattedHours = hours.toString().padStart(2, '0');
    
    return `${formattedHours}:${minutes}`;
  } catch (error) {
    console.error(`❌ Error formatting time: ${timeStr}`, error);
    return timeStr;
  }
}

// Run the main function
main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});