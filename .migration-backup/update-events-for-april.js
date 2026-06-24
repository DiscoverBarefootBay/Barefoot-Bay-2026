/**
 * Script to update existing events to include April 2025 dates
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { addMonths } from 'date-fns';

// Load environment variables
dotenv.config();

// Connect to the database
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Update events to include April 2025 dates
 */
async function updateEventsForApril() {
  console.log('Starting to update events for April 2025...');
  
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    // First, get all March events that we want to clone to April
    const { rows: marchEvents } = await client.query(`
      SELECT * FROM events 
      WHERE EXTRACT(MONTH FROM start_date) = 3 
      AND EXTRACT(YEAR FROM start_date) = 2025
      ORDER BY start_date
    `);
    
    console.log(`Found ${marchEvents.length} March events to clone to April`);
    
    // For each March event, create a new April event
    let createdCount = 0;
    
    for (const event of marchEvents) {
      try {
        // Add one month to start and end dates
        const startDate = new Date(event.start_date);
        const endDate = new Date(event.end_date);
        
        const aprilStartDate = addMonths(startDate, 1);
        const aprilEndDate = addMonths(endDate, 1);
        
        // Insert the April event directly with the correct dates
        const insertResult = await client.query(`
          INSERT INTO events (
            title, description, location, map_link, start_date, end_date, hours_of_operation,
            category, contact_info, media_urls, badge_required, 
            is_recurring, recurrence_frequency, recurrence_end_date, 
            parent_event_id, created_by, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()
          )
        `, [
          event.title,
          event.description,
          event.location,
          event.map_link,
          aprilStartDate.toISOString(), // Include start date here
          aprilEndDate.toISOString(),   // Include end date here
          event.hours_of_operation,
          event.category,
          event.contact_info,
          event.media_urls,
          event.badge_required,
          event.is_recurring,
          event.recurrence_frequency,
          event.recurrence_end_date,
          event.parent_event_id,
          event.created_by
        ]);
        
        createdCount++;
        console.log(`Created April event: ${event.title}`);
      } catch (err) {
        console.error(`Error creating April event for ${event.title}:`, err.message);
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    console.log(`Successfully created ${createdCount} April events`);
  } catch (error) {
    // Rollback transaction in case of error
    await client.query('ROLLBACK');
    console.error('Error updating events for April:', error);
  } finally {
    // Release the client
    client.release();
  }
  
  // Close the pool
  await pool.end();
  console.log('Database connection closed');
}

// Run the update function
updateEventsForApril();