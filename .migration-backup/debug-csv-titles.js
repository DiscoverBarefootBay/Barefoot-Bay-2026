/**
 * Debug script to investigate why event titles aren't in the output CSV
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';

// File paths
const inputFile = './attached_assets/Barefoot Bay Reoccuring Events for Website CSV.csv';
const outputFile = './uploads/simplified-events.csv';

// Read and parse both CSV files
console.log('Reading source and output files...');
const sourceData = fs.readFileSync(inputFile, 'utf8');
const outputData = fs.readFileSync(outputFile, 'utf8');

const sourceRecords = parse(sourceData, {
  columns: true,
  skip_empty_lines: true
});

const outputRecords = parse(outputData, {
  columns: true,
  skip_empty_lines: true
});

// Check the actual column names in both files
console.log('\nSource file columns:', Object.keys(sourceRecords[0]));
console.log('\nOutput file columns:', Object.keys(outputRecords[0]));

// Print the first source record to see the data
console.log('\nFirst source record:', sourceRecords[0]);

// Extract data using direct key access
console.log('\nAccessing by column name:');
for (let i = 0; i < 3; i++) {
  console.log(`\nRecord #${i+1}:`);
  console.log('Source record keys:', Object.keys(sourceRecords[i]));
  const titleKey = Object.keys(sourceRecords[i]).find(key => key.includes('Title'));
  console.log('Found title key:', titleKey);
  console.log('Source title:', titleKey ? sourceRecords[i][titleKey] : 'Not found');
  console.log('Output title:', outputRecords[i]['title']);
}