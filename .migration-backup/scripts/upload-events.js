const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createInterface } = require('readline');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Import the process function from the other script
const { processExcelFile } = require('./process-events-excel');

/**
 * Uploads events to the API directly
 */
async function uploadEvents(excelFilePath) {
  try {
    // First process the Excel file to get the CSV content
    const eventCount = await processExcelFile(excelFilePath);
    console.log(`Processed ${eventCount} events from Excel file`);
    
    // Get the path to the generated CSV file
    const csvFilePath = path.join(__dirname, '../uploads/events.csv');
    console.log(`CSV file path: ${csvFilePath}`);
    
    if (!fs.existsSync(csvFilePath)) {
      throw new Error('CSV file not found. Excel processing may have failed.');
    }
    
    // Ask user for login credentials
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const askQuestion = (question) => new Promise((resolve) => {
      rl.question(question, resolve);
    });
    
    console.log('\n--- Login Required ---');
    const username = await askQuestion('Username: ');
    const password = await askQuestion('Password: ');
    
    // Login first to get a session cookie
    console.log('\nLogging in...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    if (!loginResponse.ok) {
      rl.close();
      throw new Error(`Login failed: ${loginResponse.statusText}`);
    }
    
    // Get cookies from the response
    const cookies = loginResponse.headers.raw()['set-cookie'];
    const cookieHeader = cookies ? cookies.join('; ') : '';
    
    console.log('Login successful!');
    
    // Upload the CSV file
    console.log('\nUploading events CSV...');
    const formData = new FormData();
    formData.append('events', fs.createReadStream(csvFilePath));
    
    const uploadResponse = await fetch('http://localhost:3000/api/events/bulk', {
      method: 'POST',
      headers: {
        'Cookie': cookieHeader,
      },
      body: formData,
    });
    
    const uploadResult = await uploadResponse.json();
    
    if (!uploadResponse.ok) {
      rl.close();
      throw new Error(`Upload failed: ${JSON.stringify(uploadResult)}`);
    }
    
    console.log('\nUpload successful!');
    console.log(uploadResult.message);
    
    rl.close();
    return uploadResult;
  } catch (error) {
    console.error('Error uploading events:', error);
    throw error;
  }
}

// Interactive mode if run directly
if (require.main === module) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('Enter the path to your Excel file: ', async (filePath) => {
    try {
      console.log(`\nProcessing file: ${filePath}`);
      
      rl.question('Do you want to (1) Generate CSV only or (2) Upload directly? (1/2): ', async (answer) => {
        try {
          if (answer === '1') {
            // Generate CSV only
            const count = await processExcelFile(filePath);
            console.log(`\nGenerated CSV for ${count} events in the uploads directory`);
            console.log('You can now use the bulk upload feature in the calendar page to upload the events.');
          } else if (answer === '2') {
            // Upload directly
            await uploadEvents(filePath);
            console.log('\nEvents have been uploaded successfully');
          } else {
            console.log('Invalid option. Please try again.');
          }
        } catch (error) {
          console.error('Operation failed:', error);
        } finally {
          rl.close();
        }
      });
    } catch (error) {
      console.error('Failed to process file:', error);
      rl.close();
    }
  });
}

module.exports = { uploadEvents };