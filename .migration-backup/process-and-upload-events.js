// ES Module style imports
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { createInterface } from 'readline';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create readline interface for interactive mode
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Parses Excel file and converts events to a format suitable for API upload
 */
async function processExcelFile(filePath) {
  try {
    console.log(`Processing Excel file from ${filePath}...`);
    
    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    console.log(`Loaded ${data.length} events from Excel file`);
    
    // Map Excel columns to event properties
    const events = data.map((row, index) => {
      // Required fields
      const event = {
        title: row.Activity || row.Title || row.title || row.EVENT || row['Event Title'] || `Untitled Event ${index}`,
        category: (row.Category || row.category || 'entertainment').toLowerCase(),
        location: row.Location || row.location || 'Barefoot Bay',
      };
      
      // Special handling for date/time from Day of Week and Time columns
      let startDate, endDate, startTime, endTime;
      
      // Check if we have Day of Week and Time columns
      if (row['Day of Week'] && row.Time) {
        const dayOfWeek = row['Day of Week'];
        const time = row.Time;
        
        // Create a date for the next occurrence of this day of week
        const today = new Date();
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let dayIndex = daysOfWeek.findIndex(day => 
          dayOfWeek.toLowerCase().includes(day.toLowerCase())
        );
        
        if (dayIndex === -1) {
          // Try to parse if it's just the first three letters (Mon, Tue, etc.)
          dayIndex = daysOfWeek.findIndex(day => 
            dayOfWeek.toLowerCase().substring(0, 3) === day.toLowerCase().substring(0, 3)
          );
        }
        
        if (dayIndex !== -1) {
          // Calculate days until next occurrence of this day
          const todayIndex = today.getDay();
          const daysUntil = (dayIndex + 7 - todayIndex) % 7;
          
          // Set the date to the next occurrence
          const eventDate = new Date(today);
          eventDate.setDate(today.getDate() + daysUntil);
          
          // Format as ISO string for the date part
          startDate = eventDate.toISOString().split('T')[0];
          endDate = startDate;
          startTime = time;
          
          // Calculate end time (default to 1 hour after start)
          if (startTime) {
            // Try to parse the time and add 1 hour
            try {
              const timeMatch = startTime.match(/(\d+):?(\d*)?\s*(am|pm)?/i);
              if (timeMatch) {
                let hours = parseInt(timeMatch[1]);
                const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
                const ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
                
                // Handle AM/PM if present
                if (ampm === 'pm' && hours < 12) {
                  hours += 12;
                } else if (ampm === 'am' && hours === 12) {
                  hours = 0;
                }
                
                const startDateTime = new Date(`2000-01-01 ${hours}:${minutes}`);
                const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
                endTime = endDateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
              } else {
                // Default end time if we can't parse
                endTime = startTime;
              }
            } catch (e) {
              console.error(`Error parsing time: ${startTime}`, e);
              endTime = startTime; // Default to same as start if parsing fails
            }
          }
        }
      } else {
        // Use standard date columns if Day of Week is not present
        startDate = row.StartDate || row['Start Date'] || row.Date || row.date;
        startTime = row.StartTime || row['Start Time'] || row.Time || row.time;
        endDate = row.EndDate || row['End Date'] || startDate;
        endTime = row.EndTime || row['End Time'] || (startTime ? 
          // If only start time is provided, add 1 hour for end time
          new Date(new Date(`2000-01-01 ${startTime}`).getTime() + 60 * 60 * 1000).toLocaleTimeString() : null);
      }
      
      // Format dates with times
      event.startDate = formatDate(startDate, startTime);
      event.endDate = formatDate(endDate, endTime);
      
      // Optional fields
      if (row.Description || row.description) {
        event.description = (row.Description || row.description).toString();
      }
      
      // Handle the Sponsor field - map it to businessName
      if (row.Sponsor || row['Business Name'] || row.BusinessName) {
        event.businessName = (row.Sponsor || row['Business Name'] || row.BusinessName).toString();
      }
      
      // If we have a Description field and a Sponsor, add the sponsor to the description
      if (event.description && row.Sponsor && !event.description.includes(row.Sponsor)) {
        event.description += `\n\nSponsor: ${row.Sponsor}`;
      }
      
      // Contact information
      const contactInfo = parseContactInfo(
        row['Contact Name'] || row.ContactName || row.Contact,
        row['Contact Phone'] || row.Phone || row.phone,
        row['Contact Email'] || row.Email || row.email,
        row['Contact Website'] || row.Website || row.website
      );
      
      if (contactInfo) {
        event.contactInfo = contactInfo;
      }
      
      // Auto-detect recurring events from Day of Week field
      let autoDetectedRecurring = false;
      let autoDetectedFrequency = null;
      
      if (row['Day of Week']) {
        const dayOfWeek = row['Day of Week'].toString().toLowerCase();
        
        // If it contains a day of the week, it's likely a recurring event
        if (dayOfWeek.match(/mon|tues|wed|thur|fri|sat|sun/i)) {
          autoDetectedRecurring = true;
          
          // Determine frequency based on text
          if (dayOfWeek.includes('first') || dayOfWeek.includes('second') || 
              dayOfWeek.includes('third') || dayOfWeek.includes('fourth') || 
              dayOfWeek.includes('last')) {
            autoDetectedFrequency = 'MONTHLY';
          } else {
            autoDetectedFrequency = 'WEEKLY';
          }
        }
      }
      
      // Recurring event information 
      const isRecurring = row.IsRecurring || row['Is Recurring'] || row.Recurring;
      
      // Use explicitly defined recurring status or auto-detected status
      if ((isRecurring && isRecurring.toString().toLowerCase() === 'true') || autoDetectedRecurring) {
        event.isRecurring = true;
        
        const frequency = parseRecurrenceFrequency(
          row.RecurrenceFrequency || row['Recurrence Frequency'] || row.Frequency
        ) || autoDetectedFrequency;
        
        if (frequency) {
          event.recurrenceFrequency = frequency;
          
          // Set recurrence end date (default to 1 year from start if not provided)
          const recurrenceEndDate = row.RecurrenceEndDate || row['Recurrence End Date'] || row['End Recurrence'];
          if (recurrenceEndDate) {
            event.recurrenceEndDate = formatDate(recurrenceEndDate);
          } else if (event.startDate) {
            const oneYearLater = new Date(new Date(event.startDate).getTime() + 365 * 24 * 60 * 60 * 1000);
            event.recurrenceEndDate = oneYearLater.toISOString();
          }
        }
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
    console.error('Error processing Excel file:', error);
    throw error;
  }
}

/**
 * Helper function to format date with time
 */
function formatDate(dateValue, timeValue) {
  if (!dateValue) return null;
  
  let date;
  
  // Try to parse the date
  try {
    if (typeof dateValue === 'string') {
      // If it's already an ISO date string
      if (dateValue.match(/^\d{4}-\d{2}-\d{2}(T|$)/)) {
        date = new Date(dateValue);
      } else {
        // Try to parse various date formats
        const parts = dateValue.split(/[-/]/);
        if (parts.length === 3) {
          // Determine if it's MM/DD/YYYY or DD/MM/YYYY or YYYY/MM/DD
          const isYearFirst = parts[0].length === 4;
          const isYearLast = parts[2].length === 4;
          
          if (isYearFirst) {
            date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          } else if (isYearLast) {
            // Check if month or day is first based on value (if > 12, it's likely a day)
            const isMonthFirst = parseInt(parts[0]) <= 12;
            if (isMonthFirst) {
              date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
            } else {
              date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
          } else {
            // Default to MM/DD/YYYY
            date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
          }
        } else {
          // Try direct parsing
          date = new Date(dateValue);
        }
      }
    } else if (typeof dateValue === 'number') {
      // Excel serial date number
      date = new Date(Math.round((dateValue - 25569) * 86400 * 1000));
    } else {
      date = new Date(dateValue);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date format: ${dateValue}, defaulting to today`);
      date = new Date();
    }
  } catch (e) {
    console.warn(`Error parsing date: ${dateValue}, defaulting to today`, e);
    date = new Date();
  }
  
  // Format the date part as ISO string
  const isoDate = date.toISOString().split('T')[0];
  
  // If time is provided, combine date and time
  if (timeValue) {
    try {
      let timeString = timeValue;
      
      // Check if time contains AM/PM
      const isPM = /pm$/i.test(timeString);
      const isAM = /am$/i.test(timeString);
      
      // Remove AM/PM if present
      timeString = timeString.replace(/\s*[ap]m\s*$/i, '');
      
      // Split hours and minutes
      let [hours, minutes] = timeString.split(':').map(part => parseInt(part, 10));
      
      // Handle 12-hour format
      if (isPM && hours < 12) {
        hours += 12;
      } else if (isAM && hours === 12) {
        hours = 0;
      }
      
      // Format time with leading zeros
      const formattedTime = `${hours.toString().padStart(2, '0')}:${(minutes || 0).toString().padStart(2, '0')}:00`;
      
      // Combine date and time
      return `${isoDate}T${formattedTime}.000Z`;
    } catch (e) {
      console.warn(`Error parsing time: ${timeValue}, using date only`, e);
      return `${isoDate}T00:00:00.000Z`;
    }
  }
  
  // Return date only
  return `${isoDate}T00:00:00.000Z`;
}

/**
 * Parse recurrence frequency
 */
function parseRecurrenceFrequency(value) {
  if (!value) return null;
  
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
  
  for (const [key, value] of Object.entries(frequencyMap)) {
    if (normalizedValue.includes(key)) {
      return value;
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
  console.warn(`Unknown recurrence frequency: ${value}, defaulting to WEEKLY`);
  return 'WEEKLY';
}

/**
 * Parse contact information into a structured object
 */
function parseContactInfo(nameValue, phoneValue, emailValue, websiteValue) {
  const contactInfo = {};
  
  if (nameValue) {
    contactInfo.name = nameValue.toString();
  }
  
  if (phoneValue) {
    contactInfo.phone = phoneValue.toString();
  }
  
  if (emailValue) {
    contactInfo.email = emailValue.toString();
  }
  
  if (websiteValue) {
    contactInfo.website = websiteValue.toString();
  }
  
  return Object.keys(contactInfo).length > 0 ? contactInfo : null;
}

/**
 * Upload events to the API directly
 */
async function uploadEvents(excelFilePath, username, password) {
  try {
    // Process the Excel file first
    const events = await processExcelFile(excelFilePath);
    
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
  console.log('This script will help you process and upload your Excel file with events.\n');
  
  try {
    // Ask for file path
    const filePath = await askQuestion('Enter the path to your Excel file (e.g., ./attached_assets/Barefoot Bay Reoccuring Events for Website.xlsx): ');
    
    // Ask what action to take
    const action = await askQuestion(
      '\nChoose an option:\n' +
      '1. Just process the file (for manual upload through website)\n' +
      '2. Process and upload directly\n' +
      'Enter your choice (1 or 2): '
    );
    
    if (action === '1') {
      // Just process the file
      const events = await processExcelFile(filePath);
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
    console.error('Please check your Excel file and try again.');
  } finally {
    rl.close();
  }
}

// Run the main function
main();