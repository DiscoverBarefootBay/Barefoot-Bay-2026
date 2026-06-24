import xlsx from 'xlsx';
import fs from 'fs';

/**
 * Process the Excel file from Barefoot Bay and convert it to a proper JSON format
 * for the event upload system
 */
async function processExcelFile(filePath) {
  console.log(`Reading Excel file from ${filePath}...`);
  
  // Read the Excel file
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const rawData = xlsx.utils.sheet_to_json(worksheet);
  console.log(`Found ${rawData.length} events in Excel file.`);
  
  // Process the data to match our API format
  const processedEvents = [];
  
  for (const record of rawData) {
    // Skip empty rows or rows without a title
    if (!record['Event Title']) {
      console.log('Skipping row without Event Title');
      continue;
    }
    
    try {
      // Process dates
      const startDateStr = record['Start Date & Time'];
      const endDateStr = record['End Date & Time'];
      
      if (!startDateStr || !endDateStr) {
        console.log(`Skipping event "${record['Event Title']}" - missing start or end date`);
        continue;
      }
      
      // Process dates for recurring events
      let startDate, endDate, isRecurring = false;
      let recurrenceFrequency = null;
      let recurrenceEndDate = null;
      
      // Check if this is a recurring event
      if (record['Recurring Event (Yes/No)']?.toLowerCase() === 'yes') {
        isRecurring = true;
        
        // Parse recurrence frequency
        recurrenceFrequency = parseRecurrenceFrequency(record['Frequency']);
        
        // Parse recurrence end date
        if (record['Recurring Event End Date']) {
          try {
            let endDate;
            const endDateStr = record['Recurring Event End Date'].toString();
            
            // Check if it's in format like "31-Dec-25"
            if (endDateStr.includes('-')) {
              const endDateParts = endDateStr.split('-');
              const monthMap = { 
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 
              };
              
              const month = monthMap[endDateParts[1]];
              const day = parseInt(endDateParts[0]);
              const year = parseInt('20' + endDateParts[2]); // Convert '25' to 2025
              
              endDate = new Date(year, month, day, 23, 59, 59);
            } else if (endDateStr.includes('/')) {
              // Handle mm/dd/yyyy format
              const parts = endDateStr.split('/');
              const month = parseInt(parts[0]) - 1;
              const day = parseInt(parts[1]);
              const year = parseInt(parts[2]);
              
              endDate = new Date(year, month, day, 23, 59, 59);
            } else {
              // Try Excel date number
              // Excel dates are days since 1/1/1900, with 1 being 1/1/1900
              const excelDate = parseInt(endDateStr);
              if (!isNaN(excelDate)) {
                // Convert Excel date number to JS date
                // Adjust for Excel's leap year bug
                const date = new Date(Date.UTC(1900, 0, excelDate - 1));
                endDate = date;
              } else {
                // Default to 1 year from now if we can't parse
                endDate = new Date();
                endDate.setFullYear(endDate.getFullYear() + 1);
              }
            }
            
            if (endDate && !isNaN(endDate.getTime())) {
              recurrenceEndDate = endDate.toISOString();
            }
          } catch (error) {
            console.log(`Error parsing recurrence end date: ${error.message}`);
            // Default to 1 year from now
            const defaultEnd = new Date();
            defaultEnd.setFullYear(defaultEnd.getFullYear() + 1);
            recurrenceEndDate = defaultEnd.toISOString();
          }
        } else {
          // Default to 1 year from now
          const defaultEnd = new Date();
          defaultEnd.setFullYear(defaultEnd.getFullYear() + 1);
          recurrenceEndDate = defaultEnd.toISOString();
        }
        
        // Parse day-of-week pattern like "Sunday 9:00 AM"
        if (startDateStr.includes('day')) {
          // Extract day and time
          const startMatch = startDateStr.match(/(.*day)\s+(\d+):(\d+)\s+(AM|PM)/i);
          const endMatch = endDateStr.match(/(.*day)\s+(\d+):(\d+)\s+(AM|PM)/i);
          
          if (startMatch && endMatch) {
            // Create a date for next occurrence of this day
            const dayOfWeek = getDayOfWeekNumber(startMatch[1]);
            const today = new Date();
            const daysUntilNext = (dayOfWeek + 7 - today.getDay()) % 7;
            
            const nextDate = new Date();
            nextDate.setDate(today.getDate() + daysUntilNext);
            
            // Set start time
            const startHour = parseInt(startMatch[2]) + (startMatch[4].toUpperCase() === 'PM' && parseInt(startMatch[2]) !== 12 ? 12 : 0);
            const startMinute = parseInt(startMatch[3]);
            
            startDate = new Date(nextDate);
            startDate.setHours(startHour, startMinute, 0, 0);
            
            // Set end time
            const endHour = parseInt(endMatch[2]) + (endMatch[4].toUpperCase() === 'PM' && parseInt(endMatch[2]) !== 12 ? 12 : 0);
            const endMinute = parseInt(endMatch[3]);
            
            endDate = new Date(nextDate);
            endDate.setHours(endHour, endMinute, 0, 0);
          }
        }
      } 
      
      // If not recurring or couldn't parse recurring pattern, try direct date parsing
      if (!startDate || !endDate) {
        try {
          startDate = new Date(startDateStr);
          endDate = new Date(endDateStr);
          
          // If dates are invalid, skip this record
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.log(`Skipping event "${record['Event Title']}" - invalid date format: ${startDateStr} - ${endDateStr}`);
            continue;
          }
        } catch (error) {
          console.log(`Error parsing dates for "${record['Event Title']}": ${error.message}`);
          continue;
        }
      }
      
      // Parse contact information
      const contactInfo = {
        name: record['Contact Name'] || '',
        phone: record['Phone Number'] ? formatPhoneNumber(record['Phone Number']) : '',
        email: record['Email Address'] || '',
        website: record['Website'] || ''
      };
      
      // Parse hours of operation
      const hoursOfOperation = parseHoursOfOperation(record);
      
      // Create the event object
      const event = {
        title: record['Event Title'],
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        location: record['Location'] || "625 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
        category: "social", // Default to social - required field
        description: record['Description'] || '',
        businessName: record['Business/Amenity Name'] || '',
        contactInfo: contactInfo,
        hoursOfOperation: JSON.stringify(hoursOfOperation),
        mediaUrls: record['Event Photos & Videos'] ? [record['Event Photos & Videos']] : [],
        isRecurring: isRecurring,
        recurrenceFrequency: recurrenceFrequency,
        recurrenceEndDate: recurrenceEndDate
      };
      
      processedEvents.push(event);
    } catch (error) {
      console.log(`Error processing event "${record['Event Title']}": ${error.message}`);
    }
  }
  
  console.log(`Successfully processed ${processedEvents.length} events.`);
  return processedEvents;
}

/**
 * Format phone number to (XXX) XXX-XXXX format
 */
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Check if we have a valid 10-digit number
  if (digits.length === 10) {
    return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
  }
  
  // Return the original if it doesn't match the pattern
  return phoneNumber;
}

/**
 * Parse recurrence frequency
 */
function parseRecurrenceFrequency(value) {
  if (!value) return 'WEEKLY'; // Default to weekly
  
  const frequency = value.toUpperCase().trim();
  
  switch (frequency) {
    case 'DAILY':
      return 'DAILY';
    case 'WEEKLY':
    case 'WEEK':
      return 'WEEKLY';
    case 'BIWEEKLY':
    case 'BI-WEEKLY':
    case 'BI WEEKLY':
      return 'BIWEEKLY';
    case 'MONTHLY':
    case 'MONTH':
      return 'MONTHLY';
    case 'YEARLY':
    case 'ANNUAL':
    case 'ANNUALLY':
      return 'YEARLY';
    default:
      return 'WEEKLY'; // Default to weekly
  }
}

/**
 * Get numeric day of week (0-6) from day name
 */
function getDayOfWeekNumber(dayName) {
  const daysMap = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6
  };
  
  return daysMap[dayName.toLowerCase()];
}

/**
 * Parse hours of operation from record
 */
function parseHoursOfOperation(record) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours = {};
  
  days.forEach(day => {
    const hoursField = `Hours - ${day}`;
    
    if (record[hoursField]) {
      hours[day.toLowerCase()] = parseHoursString(record[hoursField]);
    } else {
      // Default closed if no hours provided
      hours[day.toLowerCase()] = {
        isOpen: false,
        openTime: '09:00',
        closeTime: '17:00'
      };
    }
  });
  
  return hours;
}

/**
 * Parse hours string like "8:00am - 4:30pm"
 */
function parseHoursString(hoursString) {
  if (!hoursString || hoursString.toUpperCase().includes('CLOSED')) {
    return {
      isOpen: false,
      openTime: '09:00',
      closeTime: '17:00'
    };
  }
  
  // Try to match "8:00am - 4:30pm" pattern
  const hourPattern = /(\d+):(\d+)\s*(am|pm)?\s*-\s*(\d+):(\d+)\s*(am|pm)?/i;
  const match = hoursString.match(hourPattern);
  
  if (match) {
    const [_, startHourStr, startMinStr, startAmPm, endHourStr, endMinStr, endAmPm] = match;
    
    let startHour = parseInt(startHourStr);
    const startMin = parseInt(startMinStr);
    
    // Convert to 24-hour format
    if (startAmPm && startAmPm.toLowerCase() === 'pm' && startHour < 12) {
      startHour += 12;
    } else if (startAmPm && startAmPm.toLowerCase() === 'am' && startHour === 12) {
      startHour = 0;
    }
    
    let endHour = parseInt(endHourStr);
    const endMin = parseInt(endMinStr);
    
    // Convert to 24-hour format
    if (endAmPm && endAmPm.toLowerCase() === 'pm' && endHour < 12) {
      endHour += 12;
    } else if (endAmPm && endAmPm.toLowerCase() === 'am' && endHour === 12) {
      endHour = 0;
    }
    
    // Format as HH:MM
    const openTime = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;
    const closeTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
    
    return {
      isOpen: true,
      openTime,
      closeTime
    };
  }
  
  // Default fallback
  return {
    isOpen: true,
    openTime: '09:00',
    closeTime: '17:00'
  };
}

/**
 * Main function to process the Excel file and save the results
 */
async function main() {
  try {
    const excelFilePath = './attached_assets/Barefoot Bay Reoccuring Events for Website.xlsx';
    const outputJsonPath = './uploads/processed-events.json';
    
    const events = await processExcelFile(excelFilePath);
    
    // Save the processed events as JSON
    fs.writeFileSync(outputJsonPath, JSON.stringify(events, null, 2));
    console.log(`Saved ${events.length} processed events to ${outputJsonPath}`);
    
    // Create a simplified version with just the required fields for testing
    const simplifiedEvents = events.map(event => ({
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      category: event.category
    }));
    
    fs.writeFileSync('./uploads/simplified-events.json', JSON.stringify(simplifiedEvents, null, 2));
    console.log(`Saved simplified events to ./uploads/simplified-events.json`);
    
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

main();