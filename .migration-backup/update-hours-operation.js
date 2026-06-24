/**
 * Script focused on updating hours_of_operation for events
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
    // First check the database schema
    const { rows: columns } = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'events'
      AND column_name = 'hours_of_operation';
    `);
    
    console.log('Column info for hours_of_operation:', columns[0]);
    
    // Update with proper type cast
    const result = await pool.query(`
      UPDATE events 
      SET hours_of_operation = $1::jsonb 
      WHERE hours_of_operation IS NULL OR hours_of_operation::text = '{}'
    `, [JSON.stringify(defaultHoursOfOperation)]);
    
    console.log(`Updated hours of operation for ${result.rowCount} events`);
  } catch (err) {
    console.error('Error updating hours of operation:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the update
updateHoursOfOperation().catch(console.error);