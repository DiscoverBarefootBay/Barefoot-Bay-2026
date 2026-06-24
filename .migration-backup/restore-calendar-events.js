/**
 * Script to restore calendar events from the processed-events.json file
 * 
 * This script:
 * 1. Reads event data from processed-events.json
 * 2. Inserts all events back into the database
 * 3. Reports success/failure for each event
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Connect to the database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Insert events into the database
 * @param {Array} events - Events to insert
 * @returns {Promise<number>} Number of events inserted
 */
async function insertEventsToDatabase(events) {
  console.log(`Attempting to insert ${events.length} events into the database...`);
  let insertedCount = 0;
  
  try {
    for (const event of events) {
      // Basic validation to ensure we have required fields
      if (!event.title || !event.startDate || !event.endDate) {
        console.warn(`Skipping event with missing required fields: ${event.title || 'Unknown'}`);
        continue;
      }
      
      // Create well-formed strings for date handling
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);
      let recurrenceEndDate = null;
      
      if (event.recurrenceEndDate) {
        recurrenceEndDate = new Date(event.recurrenceEndDate);
      }
      
      // Format the contact info as a JSON object
      const contactInfo = {
        name: event.contactInfo?.name || '',
        phone: event.contactInfo?.phone || '',
        email: event.contactInfo?.email || '',
        website: event.contactInfo?.website || ''
      };
      
      // Format hours of operation if available
      const hoursOfOperation = event.hoursOfOperation || null;
      
      // Insert the event into the database
      const result = await pool.query(
        `INSERT INTO events (
          title, description, location, start_date, end_date, 
          category, contact_info, hours_of_operation,
          is_recurring, recurrence_frequency, recurrence_end_date, media_urls
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id`,
        [
          event.title,
          event.description || '',
          event.location || '',
          startDate.toISOString(),
          endDate.toISOString(),
          event.category || 'social',
          JSON.stringify(contactInfo),
          hoursOfOperation ? JSON.stringify(hoursOfOperation) : null,
          event.isRecurring || false,
          event.recurrenceFrequency || null,
          recurrenceEndDate ? recurrenceEndDate.toISOString() : null,
          event.mediaUrls || []
        ]
      );
      
      if (result.rows && result.rows.length > 0) {
        insertedCount++;
        console.log(`Successfully inserted event: ${event.title}`);
      }
    }
    
    console.log(`Successfully inserted ${insertedCount} events into the database`);
    return insertedCount;
  } catch (error) {
    console.error('Error inserting events into the database:', error);
    throw error;
  }
}

/**
 * Main function to restore events
 */
async function restoreEvents() {
  console.log('Starting to restore calendar events from processed-events.json...');
  
  try {
    // Read the events from the JSON file
    const eventsFilePath = path.join(__dirname, 'processed-events.json');
    const eventsData = fs.readFileSync(eventsFilePath, 'utf8');
    const events = JSON.parse(eventsData);
    
    console.log(`Found ${events.length} events in the file`);
    
    // Insert the events into the database
    const insertedCount = await insertEventsToDatabase(events);
    
    console.log(`Restoration complete. Inserted ${insertedCount} out of ${events.length} events.`);
  } catch (error) {
    console.error('Error restoring events:', error);
  } finally {
    // Close the database connection
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the script
restoreEvents();