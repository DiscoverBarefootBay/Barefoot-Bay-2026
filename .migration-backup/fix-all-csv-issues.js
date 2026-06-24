/**
 * Comprehensive script to fix all CSV format issues for event uploads
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

// File paths
const inputFile = './attached_assets/Barefoot Bay Reoccuring Events for Website CSV.csv';
const outputFile = './uploads/fully-fixed-events.csv';

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

// Process each record to fix all issues
const fixedRecords = records.map(record => {
  // Create a copy of the record for modifications
  const fixedRecord = { ...record };
  
  // 1. Fix category (make lowercase)
  if (fixedRecord.Category) {
    fixedRecord.Category = fixedRecord.Category.toLowerCase();
  }
  
  // 2. Fix recurrence fields
  // Convert 'Yes/No' to boolean true/false
  if (fixedRecord['Recurring Event (Yes/No)'] === 'Yes') {
    fixedRecord.isRecurring = 'true'; // String representation of boolean for CSV
    // Delete the original column later
  }
  
  // 3. Fix frequency (capitalize)
  if (fixedRecord.Frequency === 'Weekly') {
    fixedRecord.recurrenceFrequency = 'WEEKLY'; 
    // Delete the original column later
  }
  
  // 4. Fix end date format (convert from '31-Dec-25' to ISO)
  if (fixedRecord['Recurring Event End Date']) {
    try {
      // Parse the date, assumes 31-Dec-25 format
      const dateParts = fixedRecord['Recurring Event End Date'].split('-');
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
      fixedRecord.recurrenceEndDate = date.toISOString();
      // Delete the original column later
    } catch (error) {
      console.error(`Error converting date: ${fixedRecord['Recurring Event End Date']}`, error);
    }
  }
  
  // 5. Map CSV columns to proper event schema field names
  fixedRecord.title = fixedRecord['Event Title'];
  fixedRecord.description = fixedRecord['Description'];
  fixedRecord.location = fixedRecord['Location'];
  fixedRecord.startDate = fixedRecord['Start Date & Time'];
  fixedRecord.endDate = fixedRecord['End Date & Time'];
  fixedRecord.category = fixedRecord['Category']; // Already lowercase from step 1
  
  // 6. Add contact info as structured data
  fixedRecord.contactInfo = JSON.stringify({
    name: fixedRecord['Contact Name'] || "",
    phone: fixedRecord['Phone Number'] || "",
    email: fixedRecord['Email Address'] || "",
    website: fixedRecord['Website'] || ""
  });
  
  // 7. Format hours of operation
  const hoursData = {
    Monday: parseHoursString(fixedRecord['Hours - Monday']),
    Tuesday: parseHoursString(fixedRecord['Hours - Tuesday']),
    Wednesday: parseHoursString(fixedRecord['Hours - Wednesday']),
    Thursday: parseHoursString(fixedRecord['Hours - Thursday']),
    Friday: parseHoursString(fixedRecord['Hours - Friday']),
    Saturday: parseHoursString(fixedRecord['Hours - Saturday']),
    Sunday: parseHoursString(fixedRecord['Hours - Sunday'])
  };
  
  fixedRecord.hoursOfOperation = JSON.stringify(hoursData);
  
  return fixedRecord;
});

// Helper function to parse hours string like "8:00am - 4:30pm" or "CLOSED"
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

// Helper function to format 12-hour time (8:00am) to 24-hour format (08:00)
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

// Write the fixed data to output file
const output = stringify(fixedRecords, { header: true });
fs.writeFileSync(outputFile, output);

console.log(`\nFixed CSV file written to ${outputFile}`);
console.log(`Total events processed: ${fixedRecords.length}`);
console.log('\nFixing categories: "Social" → "social"');
console.log('Fixing recurrence: "Yes" → "true"');
console.log('Fixing frequency: "Weekly" → "WEEKLY"');
console.log('Fixing end dates: "31-Dec-25" → ISO format');
console.log('Fixing hours: Added structured JSON format');
console.log('Fixing contact info: Added structured JSON format');