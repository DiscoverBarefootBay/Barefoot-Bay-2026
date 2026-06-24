import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

// Parse time from various formats to 24-hour time
function parseTime(timeStr) {
  if (!timeStr) return null;
  
  // Handle formats like "7:00 pm", "1–3 pm", "10–11 am", "2–3 pm"
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
  if (!match) return null;
  
  let hour = parseInt(match[1]);
  const minute = match[2] ? parseInt(match[2]) : 0;
  const period = match[3].toLowerCase();
  
  // Convert to 24-hour format
  if (period === 'pm' && hour !== 12) {
    hour += 12;
  } else if (period === 'am' && hour === 12) {
    hour = 0;
  }
  
  return { hour, minute };
}

// Extract meeting time from HTML content
function extractMeetingTime(content) {
  if (!content) return null;
  
  // Look for "Date and Time:" field
  const dateTimeMatch = content.match(/<strong>Date and Time:<\/strong>\s*([^<]+)/);
  if (!dateTimeMatch) return null;
  
  const dateTimeText = dateTimeMatch[1].trim();
  console.log(`  Found time text: "${dateTimeText}"`);
  
  // Parse start and end times
  // Match patterns like "2–3 pm", "10–11 am", "7:00 pm", "1:30–3:00 pm"
  const timePattern = /(\d{1,2}):?(\d{2})?\s*(am|pm)\s*(?:[–-]\s*(\d{1,2}):?(\d{2})?\s*(am|pm))?/i;
  const match = dateTimeText.match(timePattern);
  
  if (!match) {
    console.log(`  Could not parse times from: "${dateTimeText}"`);
    return null;
  }
  
  // Parse start time from first capture group
  const startTimeStr = `${match[1]}${match[2] ? ':' + match[2] : ''} ${match[3]}`;
  const startTime = parseTime(startTimeStr);
  
  if (!startTime) {
    console.log(`  Could not parse start time from: "${startTimeStr}"`);
    return null;
  }
  
  // Parse end time if present
  let endTime = null;
  if (match[4]) {
    const endTimeStr = `${match[4]}${match[5] ? ':' + match[5] : ''} ${match[6]}`;
    endTime = parseTime(endTimeStr);
  }
  
  if (!endTime) {
    // Default to 1 hour after start
    endTime = { hour: (startTime.hour + 1) % 24, minute: startTime.minute };
  }
  
  return { start: startTime, end: endTime };
}

async function syncSocialClubEvents() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Get all social club pages
    const pagesResult = await client.query(`
      SELECT id, slug, title, content
      FROM page_contents
      WHERE slug LIKE 'social-%'
      ORDER BY title
    `);

    console.log(`Found ${pagesResult.rows.length} social club pages\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const page of pagesResult.rows) {
      console.log(`\nProcessing: ${page.title} (${page.slug})`);
      
      // Extract meeting time from content
      const times = extractMeetingTime(page.content);
      if (!times) {
        console.log(`  ⚠️  No meeting time found, skipping`);
        skippedCount++;
        continue;
      }

      console.log(`  Parsed times: ${times.start.hour}:${String(times.start.minute).padStart(2, '0')} - ${times.end.hour}:${String(times.end.minute).padStart(2, '0')}`);

      // Find matching event(s) by title
      // Remove emoji and "Club" suffix for matching
      const cleanTitle = page.title
        .replace(/[🎾🧘🥒🏓🟡🌺]/g, '')
        .replace(/\s*Club\s*$/i, '')
        .trim();

      const eventsResult = await client.query(`
        SELECT id, title, start_date, end_date, contact_info
        FROM events
        WHERE title ILIKE $1 OR title ILIKE $2 OR title ILIKE $3
        ORDER BY start_date DESC
        LIMIT 100
      `, [
        `%${cleanTitle}%`,
        `%${page.title}%`,
        `${cleanTitle}%`
      ]);

      if (eventsResult.rows.length === 0) {
        console.log(`  ⚠️  No matching events found for "${cleanTitle}"`);
        skippedCount++;
        continue;
      }

      console.log(`  Found ${eventsResult.rows.length} matching events`);

      // Update each event
      const websiteUrl = `https://barefootbay.com/more/social/${page.slug.replace('social-', '')}`;
      
      for (const event of eventsResult.rows) {
        // Get the current event date (preserve the day)
        const currentStart = new Date(event.start_date);
        const currentEnd = new Date(event.end_date);
        
        // Create timestamps in Eastern Time that will display correctly
        // We need to store times such that when displayed in America/New_York timezone,
        // they show the correct local time
        
        // Calculate the offset for Eastern Time
        // EST is UTC-5, EDT is UTC-4
        // We'll determine the offset based on the event date
        const year = currentStart.getFullYear();
        const month = currentStart.getMonth();
        const day = currentStart.getDate();
        
        // Create a date in EST/EDT to get the proper offset
        const testDate = new Date(year, month, day, times.start.hour, times.start.minute);
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZoneName: 'short'
        });
        
        // Get timezone offset for this specific date (handles DST automatically)
        const offsetMatch = formatter.format(testDate).match(/GMT([+-])(\d+)/);
        let utcOffset = 5; // Default to EST
        if (offsetMatch) {
          utcOffset = parseInt(offsetMatch[2]);
        } else {
          // Fallback: check if date is in DST period
          const isDST = month > 2 && month < 10; // Rough approximation
          utcOffset = isDST ? 4 : 5;
        }
        
        // Create new timestamps: local time + UTC offset
        const newStart = new Date(Date.UTC(year, month, day, times.start.hour + utcOffset, times.start.minute, 0, 0));
        const newEnd = new Date(Date.UTC(year, month, day, times.end.hour + utcOffset, times.end.minute, 0, 0));

        // Update contact_info to add website
        const contactInfo = event.contact_info || {};
        contactInfo.website = websiteUrl;

        await client.query(`
          UPDATE events
          SET 
            start_date = $1,
            end_date = $2,
            contact_info = $3,
            updated_at = NOW()
          WHERE id = $4
        `, [newStart, newEnd, JSON.stringify(contactInfo), event.id]);
      }

      console.log(`  ✓ Updated ${eventsResult.rows.length} events with time ${times.start.hour}:${String(times.start.minute).padStart(2, '0')} and website ${websiteUrl}`);
      updatedCount += eventsResult.rows.length;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Summary:`);
    console.log(`  ✓ Updated: ${updatedCount} events`);
    console.log(`  ⚠️  Skipped: ${skippedCount} clubs (no time found or no matching events)`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the sync
syncSocialClubEvents()
  .then(() => {
    console.log('Sync complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Sync failed:', error);
    process.exit(1);
  });
