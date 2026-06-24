/**
 * Fix Event Media URLs
 * 
 * This script updates event media URLs in the database to use the Object Storage format.
 * It ensures all existing events use the canonical Object Storage URL format for media,
 * rather than filesystem paths.
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

async function updateEventMediaUrls(startId = 0, batchSize = 100) {
  console.log(`Updating event media URLs to use Object Storage format (batch starting from ID ${startId}, size ${batchSize})...`);
  
  try {
    // Get a batch of events from the database
    const result = await db.query(
      'SELECT * FROM events WHERE id >= $1 ORDER BY id LIMIT $2',
      [startId, batchSize]
    );
    const events = result.rows;
    
    if (events.length === 0) {
      console.log('No more events to process');
      return { 
        done: true, 
        nextStartId: startId,
        updatedCount: 0,
        unchangedCount: 0,
        eventsWithMedia: 0
      };
    }
    
    console.log(`Processing batch of ${events.length} events starting from ID ${startId}`);
    
    let updatedCount = 0;
    let unchangedCount = 0;
    let eventsWithMedia = 0;
    let nextStartId = startId;
    
    // Process each event
    for (const event of events) {
      // Keep track of the highest event ID for the next batch
      if (event.id > nextStartId) {
        nextStartId = event.id;
      }
      
      if (event.media_urls && event.media_urls.length > 0) {
        eventsWithMedia++;
        const originalUrls = [...event.media_urls];
        
        // Normalize each URL to use Object Storage format
        const updatedUrls = event.media_urls.map(url => normalizeEventMediaUrl(url));
        
        // Check if any URLs were updated
        const hasChanges = updatedUrls.some((url, i) => url !== originalUrls[i]);
        
        // If URLs were updated, save the event
        if (hasChanges) {
          try {
            console.log(`Updating event ID ${event.id}:`);
            for (let i = 0; i < originalUrls.length; i++) {
              if (originalUrls[i] !== updatedUrls[i]) {
                console.log(`  - Changed: ${originalUrls[i]} → ${updatedUrls[i]}`);
              }
            }
            
            // Update the event in the database
            await db.query(
              'UPDATE events SET media_urls = $1, updated_at = NOW() WHERE id = $2',
              [updatedUrls, event.id]
            );
            
            updatedCount++;
          } catch (error) {
            console.error(`Error updating event ID ${event.id}:`, error);
          }
        } else {
          unchangedCount++;
        }
      }
    }
    
    console.log('\nBatch Update Summary:');
    console.log(`- Total events checked: ${events.length}`);
    console.log(`- Events with media: ${eventsWithMedia}`);
    console.log(`- Events updated: ${updatedCount}`);
    console.log(`- Events unchanged: ${unchangedCount}`);
    
    // Return results for this batch
    return {
      done: false,
      nextStartId: nextStartId + 1, // Start from the next ID
      updatedCount,
      unchangedCount,
      eventsWithMedia
    };
  } catch (error) {
    console.error('Error retrieving events from database:', error);
    throw error;
  }
}

// Process all events in batches
async function processAllEvents(batchSize = 100, startingId = 0) {
  console.log('Starting to process all events in batches...');
  
  let startId = startingId;
  let totalChecked = 0;
  let totalWithMedia = 0;
  let totalUpdated = 0;
  let totalUnchanged = 0;
  let done = false;
  
  try {
    // Process batches until done
    while (!done) {
      const result = await updateEventMediaUrls(startId, batchSize);
      
      // Update totals
      totalChecked += batchSize;
      totalWithMedia += result.eventsWithMedia;
      totalUpdated += result.updatedCount;
      totalUnchanged += result.unchangedCount;
      
      // Check if we're done
      if (result.done) {
        done = true;
      } else {
        // Move to next batch
        startId = result.nextStartId;
        console.log(`Moving to next batch starting at ID ${startId}`);
      }
    }
    
    console.log('\nFinal Summary:');
    console.log(`- Total events processed: ${totalChecked}`);
    console.log(`- Total events with media: ${totalWithMedia}`);
    console.log(`- Total events updated: ${totalUpdated}`);
    console.log(`- Total events unchanged: ${totalUnchanged}`);
    console.log('\nCompleted! All event media URLs have been normalized to Object Storage format.');
  } catch (error) {
    console.error('Error processing events:', error);
  } finally {
    // Close the database connection
    await db.end();
  }
}

// Run the script - starting from ID 5000 to continue processing remaining events
processAllEvents(50, 5000).catch(error => {
  console.error('Error in script execution:', error);
  process.exit(1);
});