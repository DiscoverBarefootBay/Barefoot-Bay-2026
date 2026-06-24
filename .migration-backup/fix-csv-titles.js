/**
 * Fix CSV titles by correctly handling BOM characters and encoding issues
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

// Input and output file paths
const csvFile = './attached_assets/Barefoot Bay Reoccuring Events for Website CSV.csv';
const outputFile = './uploads/fixed-events.csv';

console.log(`Reading CSV file from ${csvFile}...`);

// Read the file as a buffer first to handle any encoding issues
const fileBuffer = fs.readFileSync(csvFile);

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

// Parse column headers to detect actual column names
const firstLine = fileContent.split('\n')[0];
console.log("First line (headers):", firstLine);

// Parse CSV with more robust settings
const records = parse(fileContent, {
  columns: true,
  skipEmptyLines: true,
  relaxColumnCount: true,
  relaxQuotes: true,
  trim: true
});

console.log(`Found ${records.length} events.`);

// Check the keys for the first record to understand column naming
if (records.length > 0) {
  console.log("First record keys:", Object.keys(records[0]));
  
  // Find the correct title key
  const titleKey = Object.keys(records[0]).find(key => 
    key.toLowerCase().includes('title') || key === 'Event Title' || key === '﻿Event Title'
  );
  
  if (titleKey) {
    console.log(`Found title key: "${titleKey}"`);
    console.log(`First record title: "${records[0][titleKey]}"`);
  } else {
    console.log("No title key found in columns!");
  }
}

// Process each record and ensure title is properly set
const fixedEvents = records.map((record, index) => {
  // Create a fixed copy of the record
  const fixedRecord = { ...record };
  
  // Find the correct title key
  const titleKey = Object.keys(record).find(key => 
    key.toLowerCase().includes('title') || key === 'Event Title' || key === '﻿Event Title'
  );
  
  // Extract title properly using the found key
  if (titleKey) {
    // Use the title from the correct key
    const originalTitle = record[titleKey];
    console.log(`Event #${index + 1}: Original title "${originalTitle}" from key "${titleKey}"`);
    
    // Create a new 'title' field with the correct value
    fixedRecord.title = originalTitle;
  } else {
    console.log(`⚠️ Event #${index + 1}: No title key found!`);
  }
  
  return fixedRecord;
});

// Write the fixed events to a CSV file
const output = stringify(fixedEvents, { 
  header: true
});

fs.writeFileSync(outputFile, output);

console.log(`\nFixed CSV file written to ${outputFile}`);
console.log(`Total events processed: ${fixedEvents.length}`);