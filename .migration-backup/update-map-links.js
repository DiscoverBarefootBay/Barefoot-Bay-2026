/**
 * Script focused on updating map_link for events
 */

import pg from 'pg';
const { Pool } = pg;

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Update map links for events
 */
async function updateMapLinks() {
  console.log('Updating map links for events...');
  
  try {
    // First check the database schema
    const { rows: columns } = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'events'
      AND column_name = 'map_link';
    `);
    
    console.log('Column info for map_link:', columns[0]);
    
    // Update all map links in a single batch query for efficiency
    const result = await pool.query(`
      UPDATE events
      SET map_link = 'https://www.google.com/maps/search/?api=1&query=' || REPLACE(location, ' ', '+')
      WHERE map_link IS NULL AND location IS NOT NULL AND location != ''
    `);
    
    console.log(`Updated map links for ${result.rowCount} events`);
  } catch (err) {
    console.error('Error updating map links:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the update
updateMapLinks().catch(console.error);