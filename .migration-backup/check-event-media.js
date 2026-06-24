/**
 * Check Event Media URLs
 * 
 * This script checks events in the database for media URLs and reports on their format.
 */

import dotenv from 'dotenv';
import pg from 'pg';

// Load environment variables
dotenv.config();

// Create a PostgreSQL client
const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkEventMediaUrls() {
  console.log('Checking event media URLs in database...');
  
  try {
    // Get a random sample of events with media URLs to check migration progress
    const result = await db.query(`
      SELECT id, media_urls 
      FROM events 
      WHERE media_urls IS NOT NULL 
      ORDER BY RANDOM() 
      LIMIT 50
    `);
    const events = result.rows;
    
    console.log(`Found ${events.length} events with media_urls`);
    
    // Count events with different types of URLs
    let eventsWithEmptyMedia = 0;
    let eventsWithObjectStorage = 0;
    let eventsWithUploadsPath = 0;
    let eventsWithDirectPath = 0;
    let eventsWithOtherPaths = 0;
    
    // Process each event
    for (const event of events) {
      if (!event.media_urls || event.media_urls.length === 0) {
        eventsWithEmptyMedia++;
        continue;
      }
      
      console.log(`Event ID ${event.id} has ${event.media_urls.length} media URLs:`);
      
      let hasObjectStorage = false;
      let hasUploadsPath = false;
      let hasDirectPath = false;
      let hasOtherPath = false;
      
      for (const url of event.media_urls) {
        console.log(`  - ${url}`);
        
        if (url.startsWith('https://object-storage.replit.app/')) {
          hasObjectStorage = true;
        } else if (url.startsWith('/uploads/')) {
          hasUploadsPath = true;
        } else if (url.startsWith('/')) {
          hasDirectPath = true;
        } else {
          hasOtherPath = true;
        }
      }
      
      if (hasObjectStorage) eventsWithObjectStorage++;
      if (hasUploadsPath) eventsWithUploadsPath++;
      if (hasDirectPath) eventsWithDirectPath++;
      if (hasOtherPath) eventsWithOtherPaths++;
    }
    
    console.log('\nSummary:');
    console.log(`- Total events checked: ${events.length}`);
    console.log(`- Events with empty media arrays: ${eventsWithEmptyMedia}`);
    console.log(`- Events with Object Storage URLs: ${eventsWithObjectStorage}`);
    console.log(`- Events with /uploads/ paths: ${eventsWithUploadsPath}`);
    console.log(`- Events with direct / paths: ${eventsWithDirectPath}`);
    console.log(`- Events with other path formats: ${eventsWithOtherPaths}`);
    
  } catch (error) {
    console.error('Error checking event media URLs:', error);
  } finally {
    // Close the database connection
    await db.end();
  }
}

// Run the script
checkEventMediaUrls().catch(error => {
  console.error('Error in script execution:', error);
  process.exit(1);
});