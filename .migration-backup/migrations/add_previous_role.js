/**
 * Migration to add previousRole field to users table
 * This will store the original role before a user is upgraded to paid subscription
 */

async function run() {
  const { storage } = await import('../server/storage.js');
  
  try {
    console.log('Starting migration: Adding previousRole column to users table');
    
    // Add the new column to the users table
    await storage.executeQuery(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS previous_role TEXT;
    `);
    
    console.log('Successfully added previousRole column to users table');
    
    // Update the admin user to have the correct role
    await storage.executeQuery(`
      UPDATE users 
      SET role = 'admin' 
      WHERE username = 'michael';
    `);
    
    console.log('Successfully restored admin role for user "michael"');
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

run();