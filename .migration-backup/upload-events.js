/**
 * Easy Event Upload Script for Barefoot Bay
 * 
 * This script provides a simple way to process and upload the Excel file
 * containing the 94 recurring events for the Barefoot Bay website.
 */

// Import the required modules
const { processExcelFile } = require('./scripts/process-events-excel');
const { uploadEvents } = require('./scripts/upload-events');
const { createInterface } = require('readline');

// Create readline interface for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Main function
async function main() {
  console.log('===== Barefoot Bay Event Uploader =====');
  console.log('This script will help you process and upload your Excel file with events.\n');
  
  try {
    // Ask for file path
    const filePath = await askQuestion('Enter the path to your Excel file: ');
    
    // Ask what action to take
    const action = await askQuestion(
      '\nChoose an option:\n' +
      '1. Just convert to CSV (for manual upload through website)\n' +
      '2. Convert and upload directly\n' +
      'Enter your choice (1 or 2): '
    );
    
    if (action === '1') {
      // Just process the file
      const count = await processExcelFile(filePath);
      console.log(`\n✓ Successfully processed ${count} events`);
      console.log('✓ CSV file created at ./uploads/events.csv');
      console.log('\nTo upload these events:');
      console.log('1. Log in to the website as an admin');
      console.log('2. Go to the Calendar page');
      console.log('3. Click the "Bulk Upload Events" button');
      console.log('4. Select the CSV file from the uploads directory');
    } else if (action === '2') {
      // Process and upload
      console.log('\nProcessing file and uploading events...');
      await uploadEvents(filePath);
      console.log('\n✓ Events have been successfully uploaded to the website!');
      console.log('✓ You can view them in the Calendar section');
    } else {
      console.log('\nInvalid option selected. Please run the script again.');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Please check your Excel file and try again.');
  } finally {
    rl.close();
  }
}

// Helper function to prompt user for input
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

// Run the main function
main();