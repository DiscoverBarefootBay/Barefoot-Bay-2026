/**
 * Convert Barefoot Bay events from CSV to proper JSON format for bulk upload
 * Required format fields: 
 * - title, startDate, endDate, location, category (must be one of: "entertainment", "government", "social")
 */

const fs = require('fs');
const { parse } = require('csv-parse/sync');
const path = require('path');

// Set file paths
const INPUT_FILE = './attached_assets/Barefoot Bay Reoccuring Events for Website CSV.csv';
const OUTPUT_FILE = './uploads/events.json';

// Ensure uploads directory exists
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// Parse the CSV file
function processCSV() {
  console.log(`Reading CSV file from ${INPUT_FILE}...`);
  const csvData = fs.readFileSync(INPUT_FILE, 'utf8');
  
  // Parse CSV
  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true
  });
  
  console.log(`Found ${records.length} events in CSV file.`);
  
  // Debug the first record to see the structure
  if (records.length > 0) {
    console.log('First record keys:', Object.keys(records[0]));
    console.log('First record:', records[0]);
  }
  
  // Convert to proper format
  const events = [];
  
  for (const record of records) {
    try {
      // Skip records without title or location
      if (!record['Event Title'] || !record['Location']) {
        console.log(`Skipping event missing required fields: ${record['Event Title'] || 'Unnamed event'}`);
        continue;
      }
      
      // Parse dates
      let startDate, endDate;
      try {
        startDate = parseDateTime(record['Start Date & Time']);
        endDate = parseDateTime(record['End Date & Time']);
        
        if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          console.log(`Skipping event with invalid dates: ${record['Event Title']}`);
          continue;
        }
      } catch (error) {
        console.log(`Date parsing error for event "${record['Event Title']}": ${error.message}`);
        continue;
      }
      
      // Default category to "social" if not specified
      let category = "social";
      if (record.Category) {
        const cat = record.Category.toLowerCase().trim();
        if (cat === "government" || cat.includes("government")) {
          category = "government";
        } else if (cat === "entertainment" || cat.includes("entertainment")) {
          category = "entertainment";
        }
        // Otherwise keep as social
      }
      
      // Handle recurring events
      const isRecurring = record['Recurring Event (Yes/No)']?.toLowerCase() === 'yes';
      let recurrenceFrequency = null;
      let recurrenceEndDate = null;
      
      if (isRecurring) {
        // Map frequency
        const freq = record.Frequency?.toLowerCase().trim() || '';
        recurrenceFrequency = mapFrequency(freq);
        
        // Parse end date (format: 31-Dec-25)
        if (record['Recurring Event End Date']) {
          try {
            recurrenceEndDate = parseRecurrenceEndDate(record['Recurring Event End Date']);
            // Validate the date
            if (isNaN(recurrenceEndDate.getTime())) {
              recurrenceEndDate = new Date('2025-12-31'); // Default to end of 2025 if invalid
            }
          } catch (error) {
            recurrenceEndDate = new Date('2025-12-31'); // Default to end of 2025 if error
          }
        }
      }
      
      // Build contact info
      const contactInfo = {
        name: record['Contact Name'] || null,
        phone: formatPhoneNumber(record['Phone Number']),
        email: record['Email Address'] || null,
        website: record['Website'] || null
      };
      
      // Build hours of operation
      const hoursOfOperation = parseHoursOfOperation(record);
      
      // Create the event object with all required fields
      const event = {
        title: record['Event Title'],
        description: record.Description || null,
        location: record.Location,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        category, // This is required
        businessName: record['Business/Amenity Name'] || null,
        contactInfo,
        hoursOfOperation,
        isRecurring,
        recurrenceFrequency,
        recurrenceEndDate: recurrenceEndDate ? recurrenceEndDate.toISOString() : null
      };
      
      events.push(event);
      console.log(`Processed event: ${event.title}`);
    } catch (error) {
      console.log(`Error processing event "${record['Event Title'] || 'Unnamed'}": ${error.message}`);
    }
  }
  
  return events;
}

/**
 * Parse date time from various formats
 */
function parseDateTime(dateStr) {
  // Handle format like "Sunday 9:00 AM"
  const dayTimeRegex = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d+):?(\d*)\s*(AM|PM)$/i;
  const match = dateStr.match(dayTimeRegex);
  
  if (match) {
    const day = match[1];
    const hour = parseInt(match[2]);
    const minute = match[3] ? parseInt(match[3]) : 0;
    const ampm = match[4].toUpperCase();
    
    // Get next occurrence of this day of week
    const date = getNextDayOfWeek(day);
    
    // Set the time
    let hour24 = hour;
    if (ampm === 'PM' && hour < 12) hour24 += 12;
    if (ampm === 'AM' && hour === 12) hour24 = 0;
    
    date.setHours(hour24, minute, 0, 0);
    return date;
  }
  
  // Try standard date parse as fallback
  return new Date(dateStr);
}

/**
 * Get the next occurrence of a day of the week
 */
function getNextDayOfWeek(dayName) {
  const days = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  
  const today = new Date();
  const targetDay = days[dayName.toLowerCase()];
  const todayDay = today.getDay();
  
  // Calculate days until next occurrence
  let daysUntil = (targetDay - todayDay + 7) % 7;
  if (daysUntil === 0) daysUntil = 7; // If today, move to next week
  
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntil);
  return nextDate;
}

/**
 * Format phone number to match (XXX) XXX-XXXX format
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;
  
  // Extract digits
  const digits = phone.replace(/\D/g, '');
  
  // Ensure we have 10 digits
  if (digits.length !== 10) return phone;
  
  // Format as (XXX) XXX-XXXX
  return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
}

/**
 * Map frequency text to proper enum value 
 */
function mapFrequency(freq) {
  const freqMap = {
    'daily': 'DAILY',
    'weekly': 'WEEKLY',
    'biweekly': 'BIWEEKLY',
    'monthly': 'MONTHLY',
    'yearly': 'YEARLY'
  };
  
  return freqMap[freq] || 'WEEKLY'; // Default to weekly
}

/**
 * Parse recurrence end date from format like "31-Dec-25"
 */
function parseRecurrenceEndDate(dateStr) {
  // Handle format: 31-Dec-25
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parts[0];
    const month = getMonthNumber(parts[1]);
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return new Date(`${year}-${month}-${day}T23:59:59`);
  }
  
  // Try standard date parsing as fallback
  return new Date(dateStr);
}

/**
 * Get month number from name
 */
function getMonthNumber(monthName) {
  const months = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };
  
  return months[monthName.toLowerCase().substring(0, 3)] || '01';
}

/**
 * Parse hours of operation from record
 */
function parseHoursOfOperation(record) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours = {};
  
  for (const day of days) {
    const hourKey = `Hours - ${day}`;
    if (record[hourKey]) {
      hours[day.toLowerCase()] = parseHours(record[hourKey]);
    }
  }
  
  return Object.keys(hours).length > 0 ? hours : null;
}

/**
 * Parse hours string (e.g., "8:00am - 4:30pm")
 */
function parseHours(hourStr) {
  if (!hourStr) return null;
  
  // Check for CLOSED
  if (hourStr.toUpperCase() === 'CLOSED') {
    return {
      isOpen: false,
      openTime: '',
      closeTime: ''
    };
  }
  
  // Parse time range
  const match = hourStr.match(/(\d+):(\d+)([ap]m)\s*-\s*(\d+):(\d+)([ap]m)/i);
  if (match) {
    const [_, openHour, openMin, openAmPm, closeHour, closeMin, closeAmPm] = match;
    
    // Convert to 24-hour format
    let openH = parseInt(openHour, 10);
    let closeH = parseInt(closeHour, 10);
    
    if (openAmPm.toLowerCase() === 'pm' && openH < 12) openH += 12;
    if (openAmPm.toLowerCase() === 'am' && openH === 12) openH = 0;
    
    if (closeAmPm.toLowerCase() === 'pm' && closeH < 12) closeH += 12;
    if (closeAmPm.toLowerCase() === 'am' && closeH === 12) closeH = 0;
    
    return {
      isOpen: true,
      openTime: `${openH.toString().padStart(2, '0')}:${openMin}`,
      closeTime: `${closeH.toString().padStart(2, '0')}:${closeMin}`
    };
  }
  
  // Default to closed if format not recognized
  return {
    isOpen: false,
    openTime: '',
    closeTime: ''
  };
}

// Main execution
try {
  // Fix issue with non-UTF-8 BOM
  function fixBOM(csvPath) {
    let data = fs.readFileSync(csvPath);
    // Check for UTF-8 BOM (EF BB BF) at the beginning
    if (data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
      // Already has BOM
      return;
    }
    // Add BOM if not already present
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    const fixedData = Buffer.concat([bom, data]);
    fs.writeFileSync(csvPath + '.fixed', fixedData);
    console.log(`Fixed BOM issue, saved to ${csvPath}.fixed`);
    return csvPath + '.fixed';
  }
  
  // Create a clean CSV for testing
  function createCleanCSV() {
    const csvData = fs.readFileSync(INPUT_FILE, 'utf8');
    const lines = csvData.split('\n');
    const header = lines[0];
    const newLines = [header];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && line !== '') {
        newLines.push(line);
      }
    }
    
    const cleanCSV = newLines.join('\n');
    const cleanPath = INPUT_FILE + '.clean';
    fs.writeFileSync(cleanPath, cleanCSV);
    console.log(`Created clean CSV at ${cleanPath}`);
    return cleanPath;
  }
  
  // Take rows from original CSV and create a minimal CSV with only required fields
  function createMinimalCSV() {
    const csvData = fs.readFileSync(INPUT_FILE, 'utf8');
    const lines = csvData.split('\n');
    const header = "title,startDate,endDate,location,category\n";
    const newLines = [header];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i] || lines[i].trim() === '') continue;
      
      // Parse the line
      const columns = lines[i].split(',');
      if (columns.length < 5) continue;
      
      // Get the basic fields
      const title = columns[0];
      const location = columns[2].replace(/"/g, '');
      const startDate = columns[3];
      const endDate = columns[4];
      const category = "social"; // Default to social for all events
      
      // Only add if these fields are present
      if (title && location && startDate && endDate) {
        newLines.push(`"${title}","${startDate}","${endDate}","${location}","${category}"`);
      }
    }
    
    const minimalPath = './uploads/minimal_events.csv';
    fs.writeFileSync(minimalPath, newLines.join('\n'));
    console.log(`Created minimal CSV at ${minimalPath}`);
    return minimalPath;
  }
  
  // Process the CSV and generate events
  const events = processCSV();
  
  // Create a minimal CSV
  const minimalCSVPath = createMinimalCSV();
  
  // Save the events to JSON file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(events, null, 2));
  console.log(`Successfully saved ${events.length} events to ${OUTPUT_FILE}`);
  console.log('You can now upload the events.json file using the bulk upload feature in the calendar page.');
  console.log('Or try uploading the minimal CSV from ' + minimalCSVPath);
} catch (error) {
  console.error('Error processing CSV file:', error);
}