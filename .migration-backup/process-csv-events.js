// ES Module imports
import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create readline interface for interactive mode
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Process the CSV file and convert events to the format the API expects
 */
async function processCSVFile(filePath) {
  try {
    console.log(`Processing CSV file from ${filePath}...`);
    
    // Read CSV file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    console.log(`Loaded ${records.length} events from CSV file`);
    
    // Map CSV columns to event properties
    const events = records.map((row, index) => {
      // Required fields
      const event = {
        title: row['Event Title'] || `Untitled Event ${index}`,
        category: (row['Category'] || 'entertainment').toLowerCase(),
        location: row['Location'] || 'Barefoot Bay',
      };
      
      // Process start and end dates
      const startDateTime = row['Start Date & Time'];
      const endDateTime = row['End Date & Time'];
      
      if (startDateTime) {
        event.startDate = parseDateTime(startDateTime);
      }
      
      if (endDateTime) {
        event.endDate = parseDateTime(endDateTime);
      }
      
      // Optional fields
      if (row['Description']) {
        event.description = row['Description'];
      }
      
      if (row['Business/Amenity Name']) {
        event.businessName = row['Business/Amenity Name'];
      }
      
      // Contact information
      const contactInfo = {};
      
      if (row['Contact Name']) {
        contactInfo.name = row['Contact Name'];
      }
      
      if (row['Phone Number']) {
        contactInfo.phone = row['Phone Number'];
      }
      
      if (row['Email Address']) {
        contactInfo.email = row['Email Address'];
      }
      
      if (row['Website']) {
        contactInfo.website = row['Website'];
      }
      
      if (Object.keys(contactInfo).length > 0) {
        event.contactInfo = contactInfo;
      }
      
      // Process recurring event information
      const isRecurring = row['Recurring Event (Yes/No)'];
      if (isRecurring && isRecurring.toLowerCase() === 'yes') {
        event.isRecurring = true;
        
        // Try to determine frequency
        if (row['Frequency']) {
          event.recurrenceFrequency = parseRecurrenceFrequency(row['Frequency']);
        } else {
          // If no frequency is specified, try to determine from the start date
          event.recurrenceFrequency = determineFrequencyFromDate(startDateTime);
        }
        
        // Set recurrence end date
        if (row['Recurring Event End Date']) {
          event.recurrenceEndDate = parseDateTime(row['Recurring Event End Date']);
        } else if (event.startDate) {
          // Default to 1 year if not specified
          const oneYearLater = new Date(new Date(event.startDate).getTime() + 365 * 24 * 60 * 60 * 1000);
          event.recurrenceEndDate = oneYearLater.toISOString();
        }
      } else {
        // Auto-detect recurring events if no explicit "yes" is provided
        const dayOfWeek = extractDayOfWeek(startDateTime);
        if (dayOfWeek) {
          event.isRecurring = true;
          event.recurrenceFrequency = determineFrequencyFromDate(startDateTime);
          
          // Default to 1 year if not specified
          const oneYearLater = new Date(new Date(event.startDate).getTime() + 365 * 24 * 60 * 60 * 1000);
          event.recurrenceEndDate = oneYearLater.toISOString();
        }
      }
      
      // Add hours of operation if available
      const hoursOfOperation = {};
      const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      
      weekdays.forEach(day => {
        const hours = row[`Hours - ${day}`];
        if (hours) {
          const [openTime, closeTime] = parseHours(hours);
          if (openTime && closeTime) {
            hoursOfOperation[day.toLowerCase()] = {
              isOpen: true,
              openTime,
              closeTime
            };
          }
        }
      });
      
      if (Object.keys(hoursOfOperation).length > 0) {
        event.hoursOfOperation = JSON.stringify(hoursOfOperation);
      }
      
      // Filter out null and undefined values
      return Object.fromEntries(
        Object.entries(event).filter(([_, v]) => v != null)
      );
    });
    
    // Create outputs directory if it doesn't exist
    const outputDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write JSON file for reference
    fs.writeFileSync(
      path.join(outputDir, 'events.json'), 
      JSON.stringify(events, null, 2)
    );
    
    console.log('Events processed successfully!');
    
    return events;
  } catch (error) {
    console.error('Error processing CSV file:', error);
    throw error;
  }
}

/**
 * Parse date and time strings into ISO format
 */
function parseDateTime(dateTimeString) {
  if (!dateTimeString) return null;
  
  try {
    // Try to extract day of week and time
    const match = dateTimeString.match(/([A-Za-z]+)\s+(\d+(?::\d+)?(?:\s*[APap][Mm])?)/);
    
    if (match) {
      const dayOfWeek = match[1];
      const timeString = match[2];
      
      // Get the next occurrence of this day of week
      const today = new Date();
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      const dayIndex = daysOfWeek.findIndex(day => 
        dayOfWeek.toLowerCase() === day.toLowerCase() ||
        dayOfWeek.toLowerCase().startsWith(day.toLowerCase().substring(0, 3))
      );
      
      if (dayIndex !== -1) {
        // Calculate days until next occurrence of this day
        const todayIndex = today.getDay();
        const daysUntil = (dayIndex + 7 - todayIndex) % 7;
        
        // Set the date to the next occurrence
        const eventDate = new Date(today);
        eventDate.setDate(today.getDate() + daysUntil);
        
        // Parse and set the time
        const timeParts = timeString.match(/(\d+)(?::(\d+))?(?:\s*([APap][Mm]))?/);
        
        if (timeParts) {
          let hours = parseInt(timeParts[1]);
          const minutes = timeParts[2] ? parseInt(timeParts[2]) : 0;
          const ampm = timeParts[3] ? timeParts[3].toLowerCase() : null;
          
          // Adjust hours for AM/PM if present
          if (ampm === 'pm' && hours < 12) {
            hours += 12;
          } else if (ampm === 'am' && hours === 12) {
            hours = 0;
          }
          
          // Set the time components
          eventDate.setHours(hours, minutes, 0, 0);
          
          // Return ISO string
          return eventDate.toISOString();
        }
      }
    }
    
    // If above methods fail, try direct date parsing
    const date = new Date(dateTimeString);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    // Finally, default to today's date
    console.warn(`Could not parse date: ${dateTimeString}, using today's date`);
    return new Date().toISOString();
  } catch (error) {
    console.warn(`Error parsing date: ${dateTimeString}, using today's date`);
    return new Date().toISOString();
  }
}

/**
 * Extract the day of week from a date string
 */
function extractDayOfWeek(dateString) {
  if (!dateString) return null;
  
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  for (const day of daysOfWeek) {
    if (dateString.toLowerCase().includes(day.toLowerCase())) {
      return day;
    }
  }
  
  // Check for shortened day names (Mon, Tue, etc.)
  for (const day of daysOfWeek) {
    const shortDay = day.substring(0, 3).toLowerCase();
    if (dateString.toLowerCase().includes(shortDay)) {
      return day;
    }
  }
  
  return null;
}

/**
 * Determine recurrence frequency from date string
 */
function determineFrequencyFromDate(dateString) {
  if (!dateString) return 'WEEKLY'; // Default to weekly
  
  // Check for patterns that indicate monthly recurrence
  const monthlyPatterns = ['first', 'second', 'third', 'fourth', 'last', '1st', '2nd', '3rd', '4th'];
  
  for (const pattern of monthlyPatterns) {
    if (dateString.toLowerCase().includes(pattern)) {
      return 'MONTHLY';
    }
  }
  
  // Default to weekly
  return 'WEEKLY';
}

/**
 * Parse recurrence frequency
 */
function parseRecurrenceFrequency(value) {
  if (!value) return 'WEEKLY'; // Default to weekly
  
  const normalizedValue = value.toString().toLowerCase().trim();
  
  const frequencyMap = {
    'daily': 'DAILY',
    'weekly': 'WEEKLY',
    'every week': 'WEEKLY',
    'biweekly': 'BIWEEKLY',
    'every two weeks': 'BIWEEKLY',
    'every other week': 'BIWEEKLY',
    'monthly': 'MONTHLY',
    'every month': 'MONTHLY',
    'quarterly': 'QUARTERLY',
    'every quarter': 'QUARTERLY',
    'every three months': 'QUARTERLY',
    'yearly': 'YEARLY',
    'annual': 'YEARLY',
    'annually': 'YEARLY',
    'every year': 'YEARLY'
  };
  
  for (const [key, freq] of Object.entries(frequencyMap)) {
    if (normalizedValue.includes(key)) {
      return freq;
    }
  }
  
  // Check for numeric patterns like "every 2 weeks"
  const match = normalizedValue.match(/every\s+(\d+)\s+(day|week|month|year)s?/i);
  if (match) {
    const count = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    if (unit === 'day') {
      return count === 1 ? 'DAILY' : null;
    } else if (unit === 'week') {
      return count === 1 ? 'WEEKLY' : count === 2 ? 'BIWEEKLY' : null;
    } else if (unit === 'month') {
      return count === 1 ? 'MONTHLY' : count === 3 ? 'QUARTERLY' : null;
    } else if (unit === 'year') {
      return count === 1 ? 'YEARLY' : null;
    }
  }
  
  // Default to WEEKLY if we couldn't determine the frequency
  return 'WEEKLY';
}

/**
 * Parse hours of operation string into open and close times
 */
function parseHours(hoursString) {
  if (!hoursString) return [null, null];
  
  // Check for common hours format like "8:00am - 4:30pm"
  const match = hoursString.match(/(\d+(?::\d+)?(?:\s*[APap][Mm])?)\s*-\s*(\d+(?::\d+)?(?:\s*[APap][Mm])?)/);
  
  if (match) {
    const openTimeStr = match[1];
    const closeTimeStr = match[2];
    
    // Parse time strings to get hours and minutes
    const parseTimeStr = (timeStr) => {
      const timeParts = timeStr.match(/(\d+)(?::(\d+))?(?:\s*([APap][Mm]))?/);
      if (timeParts) {
        let hours = parseInt(timeParts[1]);
        const minutes = timeParts[2] ? parseInt(timeParts[2]) : 0;
        const ampm = timeParts[3] ? timeParts[3].toLowerCase() : null;
        
        // Adjust hours for AM/PM if present
        if (ampm === 'pm' && hours < 12) {
          hours += 12;
        } else if (ampm === 'am' && hours === 12) {
          hours = 0;
        }
        
        // Format as HH:MM
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
      return null;
    };
    
    return [parseTimeStr(openTimeStr), parseTimeStr(closeTimeStr)];
  }
  
  return [null, null];
}

/**
 * Upload events to the API
 */
async function uploadEvents(csvFilePath, username, password) {
  try {
    // Process the CSV file first
    const events = await processCSVFile(csvFilePath);
    
    // Check if we have credentials
    if (!username || !password) {
      const credentials = await promptForCredentials();
      username = credentials.username;
      password = credentials.password;
    }
    
    // Login to get a session
    await login(username, password);
    
    // Upload each event
    console.log(`Starting to upload ${events.length} events...`);
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      try {
        console.log(`Uploading event ${i + 1}/${events.length}: ${event.title}`);
        await createEvent(event);
        results.successful++;
        console.log(`✓ Event uploaded successfully: ${event.title}`);
      } catch (error) {
        results.failed++;
        const errorMessage = `Failed to upload event "${event.title}": ${error.message}`;
        results.errors.push(errorMessage);
        console.error(`✗ ${errorMessage}`);
      }
      
      // Add a slight delay between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Print summary
    console.log('\n===== Upload Summary =====');
    console.log(`Total events: ${events.length}`);
    console.log(`Successfully uploaded: ${results.successful}`);
    console.log(`Failed to upload: ${results.failed}`);
    
    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    return results;
  } catch (error) {
    console.error('Error uploading events:', error);
    throw error;
  }
}

/**
 * Login to the API
 */
async function login(username, password) {
  console.log(`Logging in as ${username}...`);
  
  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password }),
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Login failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Login successful!');
    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

/**
 * Create an event via the API
 */
async function createEvent(eventData) {
  try {
    const response = await fetch('http://localhost:3000/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventData),
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Create event error:', error);
    throw error;
  }
}

/**
 * Prompt for credentials
 */
async function promptForCredentials() {
  return {
    username: await askQuestion('Enter your username: '),
    password: await askQuestion('Enter your password: ')
  };
}

/**
 * Helper function to prompt user for input
 */
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

/**
 * Main function to run the script
 */
async function main() {
  console.log('===== Barefoot Bay Event Uploader =====');
  console.log('This script will help you process and upload your CSV file with events.\n');
  
  try {
    // Ask for file path
    const filePath = await askQuestion('Enter the path to your CSV file (e.g., ./attached_assets/Barefoot Bay Reoccuring Events for Website CSV.csv): ');
    
    // Ask what action to take
    const action = await askQuestion(
      '\nChoose an option:\n' +
      '1. Just process the file (for manual upload through website)\n' +
      '2. Process and upload directly\n' +
      'Enter your choice (1 or 2): '
    );
    
    if (action === '1') {
      // Just process the file
      const events = await processCSVFile(filePath);
      console.log(`\n✓ Successfully processed ${events.length} events`);
      console.log('✓ JSON file created at ./uploads/events.json');
      console.log('\nTo upload these events:');
      console.log('1. Log in to the website as an admin');
      console.log('2. Go to the Calendar page');
      console.log('3. Click the "Bulk Upload Events" button');
      console.log('4. Select the JSON file from the uploads directory');
    } else if (action === '2') {
      // Process and upload
      console.log('\nYou\'ll need admin credentials to upload events.');
      const username = await askQuestion('Enter your admin username: ');
      const password = await askQuestion('Enter your admin password: ');
      
      console.log('\nProcessing file and uploading events...');
      const results = await uploadEvents(filePath, username, password);
      
      if (results.successful > 0) {
        console.log(`\n✓ ${results.successful} events have been successfully uploaded to the website!`);
      }
      
      if (results.failed > 0) {
        console.log(`\n⚠ ${results.failed} events failed to upload. See errors above.`);
      }
      
      console.log('✓ You can view the uploaded events in the Calendar section');
    } else {
      console.log('\nInvalid option selected. Please run the script again.');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Please check your CSV file and try again.');
  } finally {
    rl.close();
  }
}

// Run the main function
main();