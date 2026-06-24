/**
 * Script to update all events to set badgeRequired to true
 * Using CommonJS format for simpler execution
 */

require('dotenv').config();
const { Pool } = require('pg');

async function updateEventsBadgeStatus() {
  // Create a connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Starting update of events badge status...');

    // Get all events
    const { rows: events } = await pool.query('SELECT id, title FROM events');
    console.log(`Found ${events.length} events to update`);

    // Update all events at once to set badge_required to true
    const updateResult = await pool.query(
      'UPDATE events SET "badge_required" = true'
    );
    
    console.log(`Successfully updated ${updateResult.rowCount} events to require badges`);
    
    // Log event IDs and titles that were updated
    for (const event of events) {
      console.log(`Updated event ID: ${event.id} - ${event.title}`);
    }
  } catch (error) {
    console.error('Error updating events:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the update function
updateEventsBadgeStatus();