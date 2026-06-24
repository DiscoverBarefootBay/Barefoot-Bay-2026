/**
 * Process the CSV file and convert events to the format the API expects
 * This version has improved BOM handling and column name detection
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

// Define input and output files
const inputFile = './attached_assets/Barefoot Bay Reoccuring Events for Website CSV.csv';
const outputFile = './uploads/events.csv';

console.log(`Reading CSV file from ${inputFile}...`);

// Read the file as a buffer first to handle any encoding issues
const fileBuffer = fs.readFileSync(inputFile);

// Remove BOM if present (first 3 bytes if they match the UTF-8 BOM pattern)
let fileContent;
if (fileBuffer.length >= 3 && 
    fileBuffer[0] === 0xEF && 
    fileBuffer[1] === 0xBB && 
    fileBuffer[2] === 0xBF) {
  console.log("Removing BOM from CSV file");
  fileContent = fileBuffer.slice(3).toString('utf8');
} else {
  fileContent = fileBuffer.toString('utf8');
}

// Parse CSV with more robust settings
const records = parse(fileContent, {
  columns: true,
  skipEmptyLines: true,
  relaxColumnCount: true,
  relaxQuotes: true,
  trim: true
});

console.log(`Found ${records.length} events.`);

// Find column name for title
const firstRecord = records[0];
const titleKey = Object.keys(firstRecord).find(key => 
  key.toLowerCase().includes('title') || key === 'Event Title' || key === '﻿Event Title'
);

if (titleKey) {
  console.log(`Found title key: "${titleKey}"`);
} else {
  console.error("Error: No title key found in columns! Cannot proceed.");
  process.exit(1);
}

// Process each record to match the required format
const processedEvents = records.map((record, index) => {
  // Get event title using the discovered key
  const eventTitle = record[titleKey];
  
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
  
  // Log progress
  if (index < 5 || index === records.length - 1) {
    console.log(`Processing event #${index + 1}: "${eventTitle}"`);
  } else if (index === 5) {
    console.log("... processing remaining events ...");
  }
  
  return {
    // Core fields required by schema
    title: eventTitle,
    description: record['Description'],
    location: record['Location'],
    startDate: record['Start Date & Time'],
    endDate: record['End Date & Time'],
    category: record['Category'].toLowerCase(), // Ensure lowercase
    
    // Structured data fields
    contactInfo: JSON.stringify(contactInfo),
    hoursOfOperation: JSON.stringify(hoursData),
    
    // Recurring event fields
    isRecurring: record['Recurring Event (Yes/No)'] === 'Yes' ? 'true' : 'false',
    recurrenceFrequency: record['Frequency'] === 'Weekly' ? 'WEEKLY' : 
                          record['Frequency'] === 'Monthly' ? 'MONTHLY' : 
                          record['Frequency'] === 'Daily' ? 'DAILY' : 
                          record['Frequency'],
    recurrenceEndDate: formatDate(record['Recurring Event End Date'])
  };
});

// Write the processed events to a CSV file
const output = stringify(processedEvents, { 
  header: true
});

fs.writeFileSync(outputFile, output);

console.log(`\nProcessed CSV file written to ${outputFile}`);
console.log(`Total events processed: ${processedEvents.length}`);

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
    console.error(`Error parsing hours: ${hoursString}`, error);
    return {
      isOpen: false,
      openTime: "",
      closeTime: ""
    };
  }
}

// Helper function to format time string
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
    console.error(`Error formatting time: ${timeStr}`, error);
    return timeStr;
  }
}