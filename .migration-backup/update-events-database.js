/**
 * Script focused on just the database updates without downloading images
 * This will update all events with complete test data
 */

import pg from 'pg';
const { Pool } = pg;

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Update all events with missing hours of operation
 */
async function updateHoursOfOperation() {
  console.log('Updating hours of operation for events...');
  
  const defaultHoursOfOperation = {
    Monday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    Tuesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    Wednesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    Thursday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    Friday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    Saturday: { isOpen: false, openTime: "09:00", closeTime: "17:00" },
    Sunday: { isOpen: false, openTime: "09:00", closeTime: "17:00" }
  };
  
  try {
    const result = await pool.query(`
      UPDATE events 
      SET hours_of_operation = $1::jsonb 
      WHERE hours_of_operation IS NULL OR hours_of_operation = '{}'::jsonb
    `, [JSON.stringify(defaultHoursOfOperation)]);
    
    console.log(`Updated hours of operation for ${result.rowCount} events`);
  } catch (err) {
    console.error('Error updating hours of operation:', err);
  }
}

/**
 * Update events with missing contact info
 */
async function updateContactInfo() {
  console.log('Updating contact info for events...');
  
  try {
    // Update entertainment events
    const entertainmentResult = await pool.query(`
      UPDATE events 
      SET contact_info = '{"name": "Entertainment Coordinator", "phone": "(321) 555-1234", "email": "entertainment@barefootbay.org", "website": "https://barefootbay.org/entertainment"}'::jsonb
      WHERE category = 'entertainment' AND (contact_info IS NULL OR contact_info = '{}'::jsonb)
    `);
    
    // Update social events
    const socialResult = await pool.query(`
      UPDATE events 
      SET contact_info = '{"name": "Social Activities Director", "phone": "(321) 555-5678", "email": "social@barefootbay.org", "website": "https://barefootbay.org/social"}'::jsonb
      WHERE category = 'social' AND (contact_info IS NULL OR contact_info = '{}'::jsonb)
    `);
    
    // Update government events
    const governmentResult = await pool.query(`
      UPDATE events 
      SET contact_info = '{"name": "Community Management", "phone": "(321) 555-9012", "email": "government@barefootbay.org", "website": "https://barefootbay.org/government"}'::jsonb
      WHERE category = 'government' AND (contact_info IS NULL OR contact_info = '{}'::jsonb)
    `);
    
    console.log(`Updated contact info for: 
      Entertainment: ${entertainmentResult.rowCount} events
      Social: ${socialResult.rowCount} events
      Government: ${governmentResult.rowCount} events`);
  } catch (err) {
    console.error('Error updating contact info:', err);
  }
}

/**
 * Update map links for events
 */
async function updateMapLinks() {
  console.log('Updating map links for events...');
  
  try {
    const { rows } = await pool.query(`
      SELECT id, location
      FROM events
      WHERE map_link IS NULL AND location IS NOT NULL AND location != ''
    `);
    
    console.log(`Found ${rows.length} events needing map links`);
    
    let updatedCount = 0;
    
    for (const event of rows) {
      try {
        const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;
        
        await pool.query(`
          UPDATE events
          SET map_link = $1
          WHERE id = $2
        `, [mapLink, event.id]);
        
        updatedCount++;
        
        // Log progress every 100 events
        if (updatedCount % 100 === 0) {
          console.log(`Updated map links for ${updatedCount} of ${rows.length} events`);
        }
      } catch (err) {
        console.error(`Error updating map link for event ${event.id}:`, err);
      }
    }
    
    console.log(`Map link updates completed. Updated ${updatedCount} events.`);
  } catch (err) {
    console.error('Error updating map links:', err);
  }
}

/**
 * Update media URLs for events
 */
async function updateMediaUrls() {
  console.log('Updating media URLs for events...');
  
  // Define media URLs based on event categories
  const categoryImages = {
    'entertainment': [
      '/uploads/events/entertainment-1.jpg',
      '/uploads/events/entertainment-2.jpg'
    ],
    'social': [
      '/uploads/events/social-1.jpg',
      '/uploads/events/social-2.jpg'
    ],
    'government': [
      '/uploads/events/government-1.jpg',
      '/uploads/events/government-2.jpg'
    ]
  };
  
  try {
    // Default category images for events with no media
    let totalUpdated = 0;
    
    for (const [category, images] of Object.entries(categoryImages)) {
      const result = await pool.query(`
        UPDATE events
        SET media_urls = $1::text[]
        WHERE category = $2 AND (media_urls IS NULL OR media_urls = '{}' OR array_length(media_urls, 1) IS NULL)
      `, [images, category]);
      
      totalUpdated += result.rowCount;
      console.log(`Updated ${result.rowCount} ${category} events with default images`);
    }
    
    console.log(`Media URL updates completed. Total: ${totalUpdated} events updated.`);
  } catch (err) {
    console.error('Error updating media URLs:', err);
  }
}

/**
 * Main function to run all the update processes
 */
async function updateAllEvents() {
  try {
    console.log('Starting event data update process...');
    
    // Update all the database fields
    await updateHoursOfOperation();
    await updateContactInfo();
    await updateMapLinks();
    await updateMediaUrls();
    
    console.log('All database updates completed successfully!');
  } catch (err) {
    console.error('Error in updateAllEvents:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the update process
updateAllEvents().catch(console.error);