/**
 * Script focused on updating contact_info for events
 */

import pg from 'pg';
const { Pool } = pg;

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Update events with missing contact info
 */
async function updateContactInfo() {
  console.log('Updating contact info for events...');
  
  try {
    // First check the database schema
    const { rows: columns } = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'events'
      AND column_name = 'contact_info';
    `);
    
    console.log('Column info for contact_info:', columns[0]);
    
    // Update entertainment events
    const entertainmentResult = await pool.query(`
      UPDATE events 
      SET contact_info = '{"name": "Entertainment Coordinator", "phone": "(321) 555-1234", "email": "entertainment@barefootbay.org", "website": "https://barefootbay.org/entertainment"}'::jsonb
      WHERE category = 'entertainment' AND (contact_info IS NULL OR contact_info::text = '{}' OR contact_info::text = '')
    `);
    
    // Update social events
    const socialResult = await pool.query(`
      UPDATE events 
      SET contact_info = '{"name": "Social Activities Director", "phone": "(321) 555-5678", "email": "social@barefootbay.org", "website": "https://barefootbay.org/social"}'::jsonb
      WHERE category = 'social' AND (contact_info IS NULL OR contact_info::text = '{}' OR contact_info::text = '')
    `);
    
    // Update government events
    const governmentResult = await pool.query(`
      UPDATE events 
      SET contact_info = '{"name": "Community Management", "phone": "(321) 555-9012", "email": "government@barefootbay.org", "website": "https://barefootbay.org/government"}'::jsonb
      WHERE category = 'government' AND (contact_info IS NULL OR contact_info::text = '{}' OR contact_info::text = '')
    `);
    
    console.log(`Updated contact info for: 
      Entertainment: ${entertainmentResult.rowCount} events
      Social: ${socialResult.rowCount} events
      Government: ${governmentResult.rowCount} events`);
      
    // Specialized updates
    // Golf events
    const golfResult = await pool.query(`
      UPDATE events 
      SET contact_info = jsonb_build_object(
        'name', 'Golf Course Manager',
        'phone', '(321) 555-1234',
        'email', 'golf@barefootbay.org',
        'website', 'https://barefootbay.org/golf'
      )
      WHERE lower(title) LIKE '%golf%' AND contact_info IS NULL
    `);
    
    // Swimming events
    const swimResult = await pool.query(`
      UPDATE events 
      SET contact_info = jsonb_build_object(
        'name', 'Aquatics Director',
        'phone', '(321) 555-5678',
        'email', 'aquatics@barefootbay.org',
        'website', 'https://barefootbay.org/aquatics'
      )
      WHERE (lower(title) LIKE '%pool%' OR lower(title) LIKE '%swim%' OR lower(title) LIKE '%lap%' OR lower(title) LIKE '%aqua%') 
      AND contact_info IS NULL
    `);
    
    console.log(`Updated specialized contact info for:
      Golf: ${golfResult.rowCount} events
      Swimming: ${swimResult.rowCount} events`);
      
  } catch (err) {
    console.error('Error updating contact info:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the update process
updateContactInfo().catch(console.error);