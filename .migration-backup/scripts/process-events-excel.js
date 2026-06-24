const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createInterface } = require('readline');
const fetch = require('node-fetch');

// Parse recurring event frequency
function parseRecurrenceFrequency(value) {
  if (!value) return null;
  
  const normalizedValue = value.toLowerCase().trim();
  
  const frequencyMap = {
    'daily': 'DAILY',
    'weekly': 'WEEKLY',
    'every week': 'WEEKLY',
    'biweekly': 'BIWEEKLY',
    'every two weeks': 'BIWEEKLY',
    'every other week': 'BIWEEKLY',
    'monthly': 'MONTHLY',
    'every month': 'MONTHLY',
    'once a month': 'MONTHLY',
    'yearly': 'YEARLY',
    'annual': 'YEARLY',
    'annually': 'YEARLY',
    'once a year': 'YEARLY'
  };
  
  return frequencyMap[normalizedValue] || null;
}

// Format date to ISO string
function formatDate(dateValue, timeValue) {
  if (!dateValue) return null;
  
  try {
    // Convert Excel date number to JS Date if needed
    let date;
    if (typeof dateValue === 'number') {
      // Excel dates are stored as days since 1/1/1900
      date = new Date(Math.round((dateValue - 25569) * 86400 * 1000));
    } else {
      date = new Date(dateValue);
    }
    
    // If we have a time value, parse and add it
    if (timeValue) {
      const timeParts = timeValue.toString().trim().match(/(\d+):(\d+)\s*(am|pm)?/i);
      if (timeParts) {
        let hours = parseInt(timeParts[1]);
        const minutes = parseInt(timeParts[2]);
        const ampm = timeParts[3] ? timeParts[3].toLowerCase() : null;
        
        // Handle AM/PM if present
        if (ampm === 'pm' && hours < 12) {
          hours += 12;
        } else if (ampm === 'am' && hours === 12) {
          hours = 0;
        }
        
        date.setHours(hours, minutes, 0, 0);
      }
    }
    
    return date.toISOString();
  } catch (e) {
    console.error(`Error formatting date: ${dateValue} ${timeValue}`, e);
    return null;
  }
}

// Parse contactInfo object
function parseContactInfo(nameValue, phoneValue, emailValue, websiteValue) {
  const contactInfo = {};
  
  if (nameValue) contactInfo.name = nameValue.toString().trim();
  if (phoneValue) contactInfo.phone = phoneValue.toString().trim();
  if (emailValue) contactInfo.email = emailValue.toString().trim();
  if (websiteValue) contactInfo.website = websiteValue.toString().trim();
  
  return Object.keys(contactInfo).length > 0 ? contactInfo : null;
}

// Main function to process the Excel file
async function processExcelFile(filePath) {
  try {
    // Read the Excel file
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
      
      // Recurring event information
      const isRecurring = row.IsRecurring || row['Is Recurring'] || row.Recurring;
      
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
    
    // Create a CSV file from the processed events
    const headers = [
      'title', 'startDate', 'endDate', 'location', 'category', 'description',
      'businessName', 'contactInfo.name', 'contactInfo.phone', 'contactInfo.email', 
      'contactInfo.website', 'isRecurring', 'recurrenceFrequency', 'recurrenceEndDate'
    ];
    
    const csvRows = [headers.join(',')];
    
    events.forEach(event => {
      const row = headers.map(header => {
        if (header.includes('.')) {
          const [obj, prop] = header.split('.');
          return event[obj] && event[obj][prop] ? 
            `"${event[obj][prop].toString().replace(/"/g, '""')}"` : '';
        } else {
          if (typeof event[header] === 'undefined' || event[header] === null) {
            return '';
          }
          
          // Format the value for CSV
          let value = event[header];
          if (typeof value === 'object') {
            value = JSON.stringify(value);
          }
          return `"${value.toString().replace(/"/g, '""')}"`;
        }
      });
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const outputPath = path.join(__dirname, '../uploads/events.csv');
    
    // Ensure uploads directory exists
    if (!fs.existsSync(path.join(__dirname, '../uploads'))) {
      fs.mkdirSync(path.join(__dirname, '../uploads'), { recursive: true });
    }
    
    fs.writeFileSync(outputPath, csvContent);
    console.log(`CSV file created at ${outputPath}`);
    
    // JSON representation for individual API calls
    const jsonEvents = events.map(event => {
      // Re-combine the contactInfo object from separate fields
      if (!event.contactInfo) {
        event.contactInfo = {};
      }
      
      if (event['contactInfo.name']) {
        event.contactInfo.name = event['contactInfo.name'];
        delete event['contactInfo.name'];
      }
      
      if (event['contactInfo.phone']) {
        event.contactInfo.phone = event['contactInfo.phone'];
        delete event['contactInfo.phone'];
      }
      
      if (event['contactInfo.email']) {
        event.contactInfo.email = event['contactInfo.email'];
        delete event['contactInfo.email'];
      }
      
      if (event['contactInfo.website']) {
        event.contactInfo.website = event['contactInfo.website'];
        delete event['contactInfo.website'];
      }
      
      // If contactInfo is empty, remove it
      if (Object.keys(event.contactInfo).length === 0) {
        delete event.contactInfo;
      }
      
      return event;
    });
    
    // Write JSON file for reference
    fs.writeFileSync(
      path.join(__dirname, '../uploads/events.json'), 
      JSON.stringify(jsonEvents, null, 2)
    );
    
    console.log('Events processed successfully!');
    console.log('Use the Bulk Upload feature in the Calendar page to upload the CSV file');
    
    return events.length;
  } catch (error) {
    console.error('Error processing Excel file:', error);
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
      const count = await processExcelFile(filePath);
      console.log(`Successfully processed ${count} events`);
    } catch (error) {
      console.error('Failed to process events:', error);
    } finally {
      rl.close();
    }
  });
}

module.exports = { processExcelFile };