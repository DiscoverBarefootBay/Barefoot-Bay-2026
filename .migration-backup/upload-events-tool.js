/**
 * Barefoot Bay Event Upload Tool
 * 
 * This utility allows administrators to upload event data in bulk
 * from either CSV or JSON files. It handles authentication, file
 * selection, and direct API communication.
 * 
 * Usage:
 * 1. Run the script with: node upload-events-tool.js
 * 2. Enter admin username and password when prompted
 * 3. Choose file type (1 for JSON, 2 for CSV)
 * 4. Provide the file path or accept the default location
 * 
 * Supported file formats:
 * - JSON: An array of event objects with fields matching the event schema
 * - CSV: A comma-separated file with headers matching the event fields
 * 
 * Default file locations:
 * - JSON: uploads/events.json
 * - CSV: uploads/events.csv
 * 
 * Note: The tool automatically detects whether it's running on Replit
 * or locally and adjusts the server URL accordingly.
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

// Get the current file's directory (equivalent to __dirname in CommonJS)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect and use the Replit URL if running in Replit
const BASE_URL = process.env.REPL_SLUG 
  ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.replit.dev` 
  : 'http://localhost:3000';

// Create readline interface for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Login to the API
 */
async function login(username, password) {
  console.log(`Logging in as ${username} to ${BASE_URL}...`);
  
  const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });
  
  if (!loginResponse.ok) {
    throw new Error(`Login failed with status ${loginResponse.status}`);
  }
  
  const cookies = loginResponse.headers.raw()['set-cookie'];
  const cookieHeader = cookies ? cookies.join('; ') : '';
  
  console.log('Login successful!');
  return cookieHeader;
}

/**
 * Upload file to the API
 */
async function uploadEvents(filePath, cookieHeader) {
  console.log(`Uploading file: ${filePath}`);
  
  // Determine file type
  const isJson = filePath.toLowerCase().endsWith('.json');
  const isCsv = filePath.toLowerCase().endsWith('.csv');
  
  if (!isJson && !isCsv) {
    throw new Error('Only CSV and JSON files are supported');
  }
  
  const fileType = isJson ? 'JSON' : 'CSV';
  console.log(`Detected file type: ${fileType}`);
  
  // Create form data with the file
  const formData = new FormData();
  formData.append('events', fs.createReadStream(filePath));
  
  // Upload the file
  const uploadResponse = await fetch(`${BASE_URL}/api/events/bulk`, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeader,
    },
    body: formData,
  });
  
  let uploadResult;
  try {
    uploadResult = await uploadResponse.json();
  } catch (error) {
    throw new Error(`Failed to parse response: ${error.message}`);
  }
  
  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${JSON.stringify(uploadResult)}`);
  }
  
  console.log('\nUpload successful!');
  console.log(uploadResult.message);
  
  return uploadResult;
}

/**
 * Ask user for input
 */
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

/**
 * Main function
 */
async function main() {
  console.log('===== Barefoot Bay Event Upload Tool =====');
  console.log(`Server URL: ${BASE_URL}`);
  console.log('----------------------------------------');
  
  try {
    // Get user credentials
    const username = await askQuestion('Enter admin username: ');
    const password = await askQuestion('Enter admin password: ');
    
    // Login to get cookie
    const cookieHeader = await login(username, password);
    
    // Ask for file type
    console.log('\nSupported file formats:');
    console.log('1. JSON - An array of event objects');
    console.log('2. CSV  - Comma-separated values with headers');
    const fileTypeChoice = await askQuestion('\nChoose file type to upload (1 for JSON, 2 for CSV): ');
    
    let filePath;
    let fileType;
    
    if (fileTypeChoice === '1') {
      // JSON file
      fileType = 'JSON';
      console.log('\nJSON file should contain an array of event objects with properties:');
      console.log('- title, startDate, endDate, location, category (required)');
      console.log('- description, businessName, contactInfo, etc. (optional)');
      
      const defaultJsonPath = path.join(__dirname, 'uploads', 'events.json');
      filePath = await askQuestion(`\nEnter JSON file path (default: ${defaultJsonPath}): `) || defaultJsonPath;
    } else if (fileTypeChoice === '2') {
      // CSV file
      fileType = 'CSV';
      console.log('\nCSV file should have headers matching these fields:');
      console.log('- title, startDate, endDate, location, category (required)');
      console.log('- description, businessName, contactInfo, etc. (optional)');
      
      const defaultCsvPath = path.join(__dirname, 'uploads', 'events.csv');
      filePath = await askQuestion(`\nEnter CSV file path (default: ${defaultCsvPath}): `) || defaultCsvPath;
    } else {
      throw new Error('Invalid choice. Please select 1 for JSON or 2 for CSV.');
    }
    
    console.log(`\nPreparing to upload ${fileType} file: ${filePath}`);
    
    
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Upload the file
    const result = await uploadEvents(filePath, cookieHeader);
    
    console.log('\n----------------------------------------');
    console.log('Upload completed successfully!');
    console.log(`Successfully created ${result.events?.length || 0} events`);
    console.log('----------------------------------------');
  } catch (error) {
    console.error('\n----------------------------------------');
    console.error('Error occurred during event upload:');
    console.error(error.message);
    
    if (process.env.DEBUG) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    console.error('----------------------------------------');
    console.error('Please check your credentials and file format, then try again.');
  } finally {
    rl.close();
  }
}

// Run the main function
main();