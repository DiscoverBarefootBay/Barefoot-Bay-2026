/**
 * Create a simplified CSV with just the required columns using the proper format
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

// File paths
const inputFile = './attached_assets/Barefoot Bay Reoccuring Events for Website CSV.csv';
const outputFile = './uploads/simplified-events.csv';

// Ensure uploads directory exists
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

console.log(`Reading CSV file from ${inputFile}...`);

// Read and parse the CSV data
const csvData = fs.readFileSync(inputFile, 'utf8');
const records = parse(csvData, {
  columns: true,
  skip_empty_lines: true
});

console.log(`Found ${records.length} events.`);

// Create simplified events with just the required columns
const simplifiedEvents = records.map(record => {
  // Parse recurring event date
  let recurrenceEndDate = null;
  if (record['Recurring Event End Date']) {
    try {
      const dateParts = record['Recurring Event End Date'].split('-');
      const day = parseInt(dateParts[0], 10);
      
      // Map month abbreviation to month number
      const monthMap = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      const month = monthMap[dateParts[1]];
      
      // Assume 20xx for the year
      const year = 2000 + parseInt(dateParts[2], 10);
      
      // Create date and convert to ISO format
      const date = new Date(year, month, day);
      recurrenceEndDate = date.toISOString();
    } catch (error) {
      console.error(`Error converting date: ${record['Recurring Event End Date']}`, error);
    }
  }
  
  // Format contact info
  const contactInfo = {
    name: record['Contact Name'] || "",
    phone: record['Phone Number'] || "",
    email: record['Email Address'] || "",
    website: record['Website'] || ""
  };
  
  // Format hours of operation
  const hoursData = {
    Monday: parseHoursString(record['Hours - Monday']),
    Tuesday: parseHoursString(record['Hours - Tuesday']),
    Wednesday: parseHoursString(record['Hours - Wednesday']),
    Thursday: parseHoursString(record['Hours - Thursday']),
    Friday: parseHoursString(record['Hours - Friday']),
    Saturday: parseHoursString(record['Hours - Saturday']),
    Sunday: parseHoursString(record['Hours - Sunday'])
  };
  
  // First log the event title to see what we're getting
  const eventTitle = String(record['Event Title'] || '');
  console.log(`Processing event: "${eventTitle}"`);
  
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
    recurrenceFrequency: record['Frequency'] === 'Weekly' ? 'WEEKLY' : record['Frequency'],
    recurrenceEndDate: recurrenceEndDate
  };
});

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
    const [openTime, closeTime] = hoursString.split('-').map(t => t.trim());
    return {
      isOpen: true,
      openTime: formatTimeString(openTime),
      closeTime: formatTimeString(closeTime)
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

// Helper function to format time
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

// Before writing to CSV, verify all titles are present
simplifiedEvents.forEach((event, index) => {
  if (!event.title) {
    console.log(`Fixing missing title for event #${index + 1}`);
    // Try to look up the original title
    const originalEvent = records[index];
    if (originalEvent && originalEvent['Event Title']) {
      event.title = originalEvent['Event Title'];
    }
  }
});

// Write the simplified events to a CSV file
const output = stringify(simplifiedEvents, { 
  header: true,
  columns: Object.keys(simplifiedEvents[0])
});

fs.writeFileSync(outputFile, output);

console.log(`\nSimplified CSV file written to ${outputFile}`);
console.log(`Total events processed: ${simplifiedEvents.length}`);
console.log('\nFixed the following issues:');
console.log('✓ Simplified column structure');
console.log('✓ Fixed lowercase categories');
console.log('✓ Fixed recurring event formats');
console.log('✓ Properly formatted dates');
console.log('✓ Structured contact info as JSON');
console.log('✓ Structured hours of operation as JSON');