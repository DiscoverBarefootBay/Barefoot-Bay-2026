/**
 * Complete Event Media Migration
 * 
 * This script specifically targets remaining events that still use the older
 * /uploads/ path format and updates them to use Object Storage URLs.
 */

import dotenv from 'dotenv';
import pg from 'pg';

// Load environment variables
dotenv.config();

// Create a PostgreSQL client
const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

// Normalize event media URL - equivalent to the function in media-path-utils.ts
function normalizeEventMediaUrl(url) {
  // If it's already an Object Storage URL, return it
  if (url && url.startsWith('https://object-storage.replit.app/')) {
    return url;
  }
  
  if (!url) return 'https://object-storage.replit.app/CALENDAR/events/default-event-image.svg';
  
  // Extract the filename from various possible URL formats
  let filename = '';
  if (url.includes('/media/')) {
    filename = url.split('/media/')[1];
  } else if (url.includes('/calendar/')) {
    filename = url.split('/calendar/')[1];
  } else if (url.includes('/uploads/calendar/')) {
    filename = url.split('/uploads/calendar/')[1];
  } else if (url.includes('/events/')) {
    filename = url.split('/events/')[1];
  } else {
    // For other URL formats, try to extract the last part as filename
    const parts = url.split('/').filter(Boolean);
    if (parts.length > 0) {
      filename = parts[parts.length - 1];
    } else {
      // If we can't identify the pattern, return default image
      console.warn(`[MediaPath] Cannot parse event media URL: ${url}, using default image`);
      return 'https://object-storage.replit.app/CALENDAR/events/default-event-image.svg';
    }
  }
  
  console.log(`[MediaPath] Normalized event media URL: ${url} -> https://object-storage.replit.app/CALENDAR/events/${filename}`);
  
  // Return the canonical Object Storage URL format
  return `https://object-storage.replit.app/CALENDAR/events/${filename}`;
}

/**
 * Update only events that still use the /uploads/ format
 */
async function updateRemainingEvents() {
  console.log('Targeting events that still use the /uploads/ format...');
  
  try {
    // Find all events with media_urls containing /uploads/
    const findQuery = `
      SELECT id, media_urls 
      FROM events 
      WHERE media_urls IS NOT NULL 
        AND (
          media_urls::text LIKE '%/uploads/%' 
          OR media_urls::text LIKE '%"/calendar/%'
          OR media_urls::text LIKE '%"/media/%'
        )
      ORDER BY id
    `;

    const result = await db.query(findQuery);
    const events = result.rows;
    
    console.log(`Found ${events.length} events that still need migration`);
    
    let totalUpdated = 0;
    
    // Process each event
    for (const event of events) {
      // Skip events without media URLs
      if (!event.media_urls || event.media_urls.length === 0) {
        continue;
      }
      
      // Create a new array of normalized URLs
      const normalizedUrls = event.media_urls.map(url => normalizeEventMediaUrl(url));
      
      // Check if any URLs actually changed
      const hasChanges = normalizedUrls.some((url, index) => url !== event.media_urls[index]);
      
      if (hasChanges) {
        // Update the event in the database
        await db.query(
          'UPDATE events SET media_urls = $1 WHERE id = $2',
          [normalizedUrls, event.id]
        );
        
        // Log the changes
        console.log(`Updated event ID ${event.id}:`);
        event.media_urls.forEach((oldUrl, index) => {
          if (oldUrl !== normalizedUrls[index]) {
            console.log(`  - Changed: ${oldUrl} → ${normalizedUrls[index]}`);
          }
        });
        
        totalUpdated++;
      }
    }
    
    console.log(`\nCompleted migration of remaining events:`);
    console.log(`- Total events processed: ${events.length}`);
    console.log(`- Total events updated: ${totalUpdated}`);
    
    return { total: events.length, updated: totalUpdated };
    
  } catch (error) {
    console.error('Error updating remaining events:', error);
    throw error;
  } finally {
    // Close the database connection
    await db.end();
  }
}

// Run the script
updateRemainingEvents().then(result => {
  console.log('Migration complete!');
  process.exit(0);
}).catch(error => {
  console.error('Script execution failed:', error);
  process.exit(1);
});