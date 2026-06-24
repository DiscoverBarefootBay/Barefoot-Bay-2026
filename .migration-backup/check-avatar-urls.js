/**
 * Script to check for avatar URLs in the user table 
 * and verify if they need normalization from /uploads/ to / format
 */

const { Pool } = require('pg');
require('dotenv').config();

async function checkAvatarUrls() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Checking for avatars in user records...');
    const result = await pool.query('SELECT id, username, avatar_url FROM users WHERE avatar_url IS NOT NULL');
    
    console.log(`Found ${result.rows.length} users with avatar_url values:`);
    
    for (const user of result.rows) {
      console.log(`User ${user.id} (${user.username}): ${user.avatar_url}`);
      
      // Check if avatarUrl uses the old format with /uploads/ prefix
      if (user.avatar_url && user.avatar_url.startsWith('/uploads/')) {
        console.log(`  * Needs normalization: ${user.avatar_url} -> ${user.avatar_url.replace('/uploads/', '/')}`);
      }
    }
  } catch (err) {
    console.error('Error checking avatar URLs:', err);
  } finally {
    await pool.end();
  }
}

checkAvatarUrls();