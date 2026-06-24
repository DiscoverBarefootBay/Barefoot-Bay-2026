/**
 * This script fixes the categories in the CSV file to be lowercase
 * Run with: node fix-categories.js
 */
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

// Path to the CSV file
const inputFile = './attached_assets/Barefoot Bay Reoccuring Events for Website CSV.csv';
const outputFile = './uploads/fixed-events.csv';

// Ensure the uploads directory exists
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

function fixCategories() {
  console.log(`Reading CSV file from ${inputFile}...`);
  
  // Read the CSV file
  const csvData = fs.readFileSync(inputFile, 'utf8');
  
  // Parse the CSV data
  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true
  });
  
  console.log(`Found ${records.length} events.`);
  
  // Process each record
  const fixedRecords = records.map(record => {
    // Make a copy of the record
    const fixedRecord = { ...record };
    
    // Convert the category to lowercase
    if (fixedRecord.Category) {
      console.log(`Fixing category: "${fixedRecord.Category}" → "${fixedRecord.Category.toLowerCase()}"`);
      fixedRecord.Category = fixedRecord.Category.toLowerCase();
    }
    
    return fixedRecord;
  });
  
  // Convert back to CSV
  const output = stringify(fixedRecords, { header: true });
  
  // Write the fixed CSV data to a new file
  fs.writeFileSync(outputFile, output);
  
  console.log(`Fixed CSV file written to ${outputFile}`);
  console.log(`Total events processed: ${fixedRecords.length}`);
}

// Run the function
fixCategories();