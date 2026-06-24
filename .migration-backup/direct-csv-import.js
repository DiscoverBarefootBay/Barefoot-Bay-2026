// ES Module style imports
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Input file path (the CSV file)
const inputFilePath = './uploads/Barefoot Bay Reoccuring Events for Website CSV.csv';

// Process the CSV file
function processCSVFile() {
  console.log(`Processing CSV file ${inputFilePath}...`);
  
  try {
    // Read the CSV file
    const fileContent = fs.readFileSync(inputFilePath, 'utf8');
    
    // Strip any BOM at the beginning of the file
    const strippedContent = fileContent.replace(/^\uFEFF/, '');
    
    // Parse the CSV content
    const records = parse(strippedContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    // Debug: log column headers
    if (records.length > 0) {
      console.log('CSV column headers:', Object.keys(records[0]));
      
      // Log first row data
      console.log('First row data:', records[0]);
    }
    
    console.log(`Loaded ${records.length} events from the CSV file`);
    
    // Filter out any empty records and map valid CSV records to event objects
    const events = records
      .filter(row => {
        // Check if row has the minimal required data
        const hasTitle = !!row['Event Title'];
        const hasStartDate = !!row['Start Date & Time'];
        
        // Skip rows without basic data
        if (!hasTitle || !hasStartDate) {
          console.warn(`Skipping row ${records.indexOf(row)} - Missing required data`);
          return false;
        }
        
        return true;
      })
      .map((row, index) => {
        // Create event object with required fields
        const event = {
          title: row['Event Title'],
          category: (row['Category'] || 'entertainment').toLowerCase(),
          location: row['Location'] || 'Barefoot Bay',
        };
        
        // Debug log
        console.log(`Processing event: ${row['Event Title']}`);
      
      // Process dates
      const startDateTime = parseDateTime(row['Start Date & Time']);
      const endDateTime = parseDateTime(row['End Date & Time']);
      
      if (startDateTime) {
        event.startDate = startDateTime;
      }
      
      if (endDateTime) {
        event.endDate = endDateTime;
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
      
      // Set recurrence based on date format
      const isRecurring = row['Recurring Event (Yes/No)'];
      if (isRecurring && isRecurring.toLowerCase() === 'yes') {
        event.isRecurring = true;
        
        // Map frequency from CSV to the expected format
        const frequency = row['Frequency'] || 'Weekly';
        event.recurrenceFrequency = mapFrequency(frequency);
        
        // Parse and set recurrence end date
        const endDateStr = row['Recurring Event End Date'];
        if (endDateStr) {
          try {
            // Try to parse the end date
            const endDate = new Date(endDateStr);
            if (!isNaN(endDate.getTime())) {
              event.recurrenceEndDate = endDate.toISOString();
            } else {
              // If direct parsing fails, try to handle special date formats like "31-Dec-25"
              const parts = endDateStr.split('-');
              if (parts.length === 3) {
                // Handle format like "31-Dec-25"
                const day = parseInt(parts[0]);
                const monthStr = parts[1];
                let year = parts[2];
                
                // Convert month name to number
                const months = {
                  'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                  'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
                };
                
                // Handle 2-digit year
                if (year.length === 2) {
                  year = '20' + year;
                }
                
                const month = months[monthStr];
                
                if (month !== undefined && !isNaN(day) && !isNaN(parseInt(year))) {
                  const date = new Date(parseInt(year), month, day);
                  event.recurrenceEndDate = date.toISOString();
                }
              }
            }
          } catch (err) {
            console.warn(`Could not parse recurrence end date: ${endDateStr}`);
          }
        }
        
        // If no valid end date was set, default to 1 year from now
        if (!event.recurrenceEndDate) {
          const oneYearLater = new Date();
          oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
          event.recurrenceEndDate = oneYearLater.toISOString();
        }
      } else {
        // Auto-detect if the date format indicates a weekly event (e.g., "Monday 9:00 AM")
        const dayOfWeek = extractDayOfWeek(row['Start Date & Time']);
        if (dayOfWeek) {
          event.isRecurring = true;
          event.recurrenceFrequency = 'WEEKLY';
          
          // Set a recurrence end date (1 year from now)
          const oneYearLater = new Date();
          oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
          event.recurrenceEndDate = oneYearLater.toISOString();
        }
      }
      
      // Process hours of operation
      const hoursOfOperation = {
        Monday: parseHoursString(row['Hours - Monday']),
        Tuesday: parseHoursString(row['Hours - Tuesday']),
        Wednesday: parseHoursString(row['Hours - Wednesday']),
        Thursday: parseHoursString(row['Hours - Thursday']),
        Friday: parseHoursString(row['Hours - Friday']),
        Saturday: parseHoursString(row['Hours - Saturday']),
        Sunday: parseHoursString(row['Hours - Sunday'])
      };
      
      event.hoursOfOperation = JSON.stringify(hoursOfOperation);
      
      return event;
    });
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write events to a JSON file
    const outputFilePath = path.join(outputDir, 'events.json');
    fs.writeFileSync(outputFilePath, JSON.stringify(events, null, 2));
    
    console.log(`Successfully processed ${events.length} events`);
    console.log(`Events saved to ${outputFilePath}`);
    console.log('\nTo upload these events:');
    console.log('1. Log in to the website as an admin');
    console.log('2. Go to the Calendar page');
    console.log('3. Click the "Bulk Upload Events" button');
    console.log('4. Select the JSON file from the uploads directory');
    
    return events;
  } catch (error) {
    console.error('Error processing CSV file:', error);
    return [];
  }
}

// Helper function to extract day of week from a date string
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

// Parse date and time strings into ISO format
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
    
    // If the above methods fail, try direct parsing as a fallback
    const date = new Date(dateTimeString);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    // Default to today's date
    console.warn(`Could not parse date: ${dateTimeString}, using today's date`);
    return new Date().toISOString();
  } catch (error) {
    console.warn(`Error parsing date: ${dateTimeString}, using today's date`);
    return new Date().toISOString();
  }
}

// Helper function to map frequency string to the expected format
function mapFrequency(frequency) {
  if (!frequency) return 'WEEKLY';
  
  const frequencyMap = {
    'daily': 'DAILY',
    'weekly': 'WEEKLY',
    'biweekly': 'BIWEEKLY',
    'monthly': 'MONTHLY',
    'annually': 'YEARLY',
    'yearly': 'YEARLY'
  };
  
  const normalizedFreq = frequency.toLowerCase();
  return frequencyMap[normalizedFreq] || 'WEEKLY';
}

// Helper function to parse hours string into the DaySchedule format
function parseHoursString(hoursString) {
  // Default closed schedule
  const closedSchedule = {
    isOpen: false,
    openTime: '09:00',
    closeTime: '17:00'
  };
  
  if (!hoursString) return closedSchedule;
  
  // Check if explicitly closed
  if (hoursString.toUpperCase() === 'CLOSED') {
    return closedSchedule;
  }
  
  // Try to parse time range (e.g., "8:00am - 4:30pm")
  const timeRangeMatch = hoursString.match(/(\d+):?(\d*)?\s*([aApP][mM])?\s*-\s*(\d+):?(\d*)?\s*([aApP][mM])?/);
  
  if (timeRangeMatch) {
    let openHours = parseInt(timeRangeMatch[1]);
    const openMinutes = timeRangeMatch[2] ? parseInt(timeRangeMatch[2]) : 0;
    const openAmPm = timeRangeMatch[3] ? timeRangeMatch[3].toLowerCase() : 'am';
    
    let closeHours = parseInt(timeRangeMatch[4]);
    const closeMinutes = timeRangeMatch[5] ? parseInt(timeRangeMatch[5]) : 0;
    const closeAmPm = timeRangeMatch[6] ? timeRangeMatch[6].toLowerCase() : 'pm';
    
    // Adjust hours for AM/PM
    if (openAmPm === 'pm' && openHours < 12) openHours += 12;
    if (openAmPm === 'am' && openHours === 12) openHours = 0;
    
    if (closeAmPm === 'pm' && closeHours < 12) closeHours += 12;
    if (closeAmPm === 'am' && closeHours === 12) closeHours = 0;
    
    // Format to HH:MM
    const openTime = `${openHours.toString().padStart(2, '0')}:${openMinutes.toString().padStart(2, '0')}`;
    const closeTime = `${closeHours.toString().padStart(2, '0')}:${closeMinutes.toString().padStart(2, '0')}`;
    
    return {
      isOpen: true,
      openTime: openTime,
      closeTime: closeTime
    };
  }
  
  return closedSchedule;
}

// Run the processing function
processCSVFile();