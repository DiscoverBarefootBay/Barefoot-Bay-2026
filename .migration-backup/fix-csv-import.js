import fs from 'fs';
import { parse } from 'csv-parse/sync';

/**
 * Convert CSV data to the format expected by the API
 * @param {string} csvFilePath - Path to the CSV file
 */
function convertCsvToEventFormat(csvFilePath) {
  // Read the CSV file
  const csvData = fs.readFileSync(csvFilePath, 'utf-8');
  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  // Array to store the converted events
  const events = [];

  // Process each row in the CSV
  for (const record of records) {
    try {
      // Skip rows without title or dates
      if (!record['Event Title'] || !record['Start Date & Time'] || !record['End Date & Time']) {
        console.log(`Skipping record due to missing required fields: ${JSON.stringify(record)}`);
        continue;
      }

      // Determine category (mandatory field)
      let category = "social"; // Default to social if not specified
      if (record['Category'] && record['Category'].trim()) {
        const normalizedCategory = record['Category'].toLowerCase().trim();
        // Map to valid categories
        if (normalizedCategory.includes("government") || 
            normalizedCategory.includes("community") || 
            normalizedCategory.includes("town hall")) {
          category = "government";
        } else if (normalizedCategory.includes("entertainment") || 
                  normalizedCategory.includes("concert") || 
                  normalizedCategory.includes("show")) {
          category = "entertainment";
        }
      }

      // Parse dates
      const startDate = parseDateTime(record['Start Date & Time']);
      const endDate = parseDateTime(record['End Date & Time']);
      
      if (!startDate || !endDate) {
        console.log(`Skipping record due to invalid date format: ${JSON.stringify(record)}`);
        continue;
      }

      // Parse recurrence fields
      const isRecurring = record['Recurring Event (Yes/No)']?.toLowerCase() === 'yes';
      let recurrenceFrequency = null;
      let recurrenceEndDate = null;
      
      if (isRecurring) {
        recurrenceFrequency = mapFrequency(record['Frequency']);
        if (record['Recurring Event End Date']) {
          // Parse end date: assumes format like "31-Dec-25"
          const parts = record['Recurring Event End Date'].split('-');
          if (parts.length === 3) {
            // Recreate as YYYY-MM-DD
            const month = getMonthNumber(parts[1]);
            const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
            recurrenceEndDate = new Date(`${year}-${month}-${parts[0]}`);
          }
        }
      }

      // Parse contact info
      const contactInfo = {
        name: record['Contact Name'] || null,
        phone: formatPhoneNumber(record['Phone Number']) || null,
        email: record['Email Address'] || null,
        website: record['Website'] || null
      };

      // Parse hours of operation
      const hoursOfOperation = parseHoursOfOperation(record);

      // Create the event object
      const event = {
        title: record['Event Title'],
        description: record['Description'] || null,
        location: record['Location'],
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        category: category,
        businessName: record['Business/Amenity Name'] || null,
        contactInfo: contactInfo,
        hoursOfOperation: hoursOfOperation,
        isRecurring: isRecurring,
        recurrenceFrequency: recurrenceFrequency,
        recurrenceEndDate: recurrenceEndDate ? recurrenceEndDate.toISOString() : null
      };

      events.push(event);
      console.log(`Processed event: ${event.title}`);
    } catch (error) {
      console.error(`Error processing record: ${JSON.stringify(record)}`, error);
    }
  }

  return events;
}

/**
 * Parse date time string to Date object
 * @param {string} dateTimeString - Date time string like "Sunday 9:00 AM"
 * @returns {Date} - Date object
 */
function parseDateTime(dateTimeString) {
  // Handle patterns like "Sunday 9:00 AM"
  if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+\d+:\d+\s*(AM|PM)$/i.test(dateTimeString)) {
    const parts = dateTimeString.split(/\s+/);
    const dayOfWeek = parts[0].toLowerCase();
    const timeStr = parts[1];
    const ampm = parts[2].toUpperCase();
    
    // Get current date
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Map day names to day numbers
    const dayMap = {
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6
    };
    
    const targetDay = dayMap[dayOfWeek];
    
    // Calculate days to add
    let daysToAdd = (targetDay - currentDayOfWeek + 7) % 7;
    if (daysToAdd === 0) {
      daysToAdd = 7; // If today is the target day, go to next week
    }
    
    // Create the date for the target day
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysToAdd);
    
    // Set the time
    const [hours, minutes] = timeStr.split(':');
    let hoursNum = parseInt(hours, 10);
    if (ampm === 'PM' && hoursNum < 12) {
      hoursNum += 12;
    } else if (ampm === 'AM' && hoursNum === 12) {
      hoursNum = 0;
    }
    
    targetDate.setHours(hoursNum, parseInt(minutes, 10), 0, 0);
    return targetDate;
  }
  
  // Try standard date formats
  return new Date(dateTimeString);
}

/**
 * Format phone number to (XXX) XXX-XXXX format
 * @param {string} phoneNumber - Phone number string
 * @returns {string} - Formatted phone number
 */
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;
  
  // Remove all non-digits
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Make sure we have exactly 10 digits
  if (digits.length !== 10) return phoneNumber;
  
  // Format as (XXX) XXX-XXXX
  return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
}

/**
 * Map frequency string to enum value
 * @param {string} frequency - Frequency string
 * @returns {string} - Frequency enum value
 */
function mapFrequency(frequency) {
  if (!frequency) return null;
  
  const normalized = frequency.toLowerCase().trim();
  
  switch (normalized) {
    case 'daily':
      return 'DAILY';
    case 'weekly':
      return 'WEEKLY';
    case 'biweekly':
      return 'BIWEEKLY';
    case 'monthly':
      return 'MONTHLY';
    case 'yearly':
      return 'YEARLY';
    default:
      return 'WEEKLY'; // Default to weekly
  }
}

/**
 * Parse hours of operation from record
 * @param {object} record - CSV record
 * @returns {object} - Hours of operation object
 */
function parseHoursOfOperation(record) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours = {};
  
  for (const day of days) {
    const key = `Hours - ${day}`;
    if (record[key]) {
      const parsed = parseHoursString(record[key]);
      if (parsed) {
        hours[day.toLowerCase()] = parsed;
      }
    }
  }
  
  // Return null if no hours were parsed
  return Object.keys(hours).length > 0 ? hours : null;
}

/**
 * Parse hours string like "8:00am - 4:30pm"
 * @param {string} hoursString - Hours string
 * @returns {object} - Parsed hours object
 */
function parseHoursString(hoursString) {
  if (!hoursString) return null;
  
  // Check for CLOSED
  if (hoursString.toUpperCase() === 'CLOSED') {
    return {
      isOpen: false,
      openTime: '',
      closeTime: ''
    };
  }
  
  // Try to match pattern like "8:00am - 4:30pm"
  const match = hoursString.match(/(\d+):(\d+)([ap]m)\s*-\s*(\d+):(\d+)([ap]m)/i);
  if (match) {
    const [_, openHour, openMin, openAmPm, closeHour, closeMin, closeAmPm] = match;
    
    // Convert to 24-hour format for storage
    let openH = parseInt(openHour, 10);
    let closeH = parseInt(closeHour, 10);
    
    if (openAmPm.toLowerCase() === 'pm' && openH < 12) openH += 12;
    if (openAmPm.toLowerCase() === 'am' && openH === 12) openH = 0;
    
    if (closeAmPm.toLowerCase() === 'pm' && closeH < 12) closeH += 12;
    if (closeAmPm.toLowerCase() === 'am' && closeH === 12) closeH = 0;
    
    const openTime = `${openH.toString().padStart(2, '0')}:${openMin}`;
    const closeTime = `${closeH.toString().padStart(2, '0')}:${closeMin}`;
    
    return {
      isOpen: true,
      openTime,
      closeTime
    };
  }
  
  // Couldn't parse
  return null;
}

/**
 * Get month number from month name
 * @param {string} monthName - Month name (Jan, Feb, etc.)
 * @returns {string} - Month number (01-12)
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
 * Main function to convert and save events
 */
function main() {
  const inputPath = './attached_assets/Barefoot Bay Reoccuring Events for Website CSV.csv';
  const outputPath = './uploads/events.json';
  
  console.log(`Processing ${inputPath}...`);
  const events = convertCsvToEventFormat(inputPath);
  console.log(`Converted ${events.length} events.`);
  
  // Save the converted events to a JSON file
  fs.writeFileSync(outputPath, JSON.stringify(events, null, 2));
  console.log(`Saved events to ${outputPath}`);
  console.log('\nYou can now upload the events using the bulk upload feature in the calendar page.');
}

// Run the main function
main();