/**
 * Simple script to fix event categories in CSV file
 */

import fs from 'fs';

// File paths
const inputFile = './attached_assets/Barefoot Bay Reoccuring Events for Website CSV.csv';
const outputFile = './uploads/fixed-events.csv';

// Ensure uploads directory exists
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// Read the input file
const csvData = fs.readFileSync(inputFile, 'utf8');

// Replace all instances of "Social" with "social"
const fixedData = csvData.replace(/,Social,/g, ',social,');

// Write the fixed data to the output file
fs.writeFileSync(outputFile, fixedData);

console.log(`Fixed CSV file has been written to ${outputFile}`);
console.log('All "Social" categories have been converted to lowercase "social"');