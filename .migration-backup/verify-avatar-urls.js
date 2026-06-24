/**
 * Script to verify all avatar URLs in the database and ensure they're accessible
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create PostgreSQL connection pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

/**
 * Verify avatar URLs and check file existence
 */
async function verifyAvatarUrls() {
  try {
    console.log('Starting avatar URL verification...');
    
    // Get all users with avatar URLs
    const result = await pool.query('SELECT id, username, avatar_url FROM users WHERE avatar_url IS NOT NULL AND avatar_url != \'\'');
    const users = result.rows;
    
    console.log(`Found ${users.length} users with avatar URLs to verify`);
    
    // Overall stats
    let validCount = 0;
    let missingCount = 0;
    let invalidPathCount = 0;
    
    // Process each user
    for (const user of users) {
      console.log(`Checking avatar for user ${user.id} (${user.username}): ${user.avatar_url}`);
      
      // Validate avatar URL format
      if (!user.avatar_url.startsWith('/avatars/') && !user.avatar_url.startsWith('/uploads/avatars/')) {
        console.error(`❌ INVALID: User ${user.id} has invalid avatar URL format: ${user.avatar_url}`);
        invalidPathCount++;
        continue;
      }
      
      // Extract filename from path
      const filename = path.basename(user.avatar_url);
      
      // Check file existence in production path
      const prodPath = path.join(__dirname, 'avatars', filename);
      const prodExists = fs.existsSync(prodPath);
      
      // Check file existence in development path
      const devPath = path.join(__dirname, 'uploads', 'avatars', filename);
      const devExists = fs.existsSync(devPath);
      
      // Report status
      if (prodExists && devExists) {
        console.log(`✅ VALID: Avatar for user ${user.id} exists in both production and development paths`);
        validCount++;
      } else if (prodExists) {
        console.log(`⚠️ PARTIAL: Avatar for user ${user.id} exists only in production path`);
        // Copy to development path
        try {
          fs.mkdirSync(path.dirname(devPath), { recursive: true });
          fs.copyFileSync(prodPath, devPath);
          console.log(`✅ FIXED: Copied avatar to development path: ${devPath}`);
          validCount++;
        } catch (error) {
          console.error(`❌ ERROR: Failed to copy avatar to development path: ${error.message}`);
          missingCount++;
        }
      } else if (devExists) {
        console.log(`⚠️ PARTIAL: Avatar for user ${user.id} exists only in development path`);
        // Copy to production path
        try {
          fs.mkdirSync(path.dirname(prodPath), { recursive: true });
          fs.copyFileSync(devPath, prodPath);
          console.log(`✅ FIXED: Copied avatar to production path: ${prodPath}`);
          validCount++;
        } catch (error) {
          console.error(`❌ ERROR: Failed to copy avatar to production path: ${error.message}`);
          missingCount++;
        }
      } else {
        console.error(`❌ MISSING: Avatar for user ${user.id} not found in any path`);
        missingCount++;
      }
    }
    
    // Print summary
    console.log('\nVerification Summary:');
    console.log(`Total users with avatars: ${users.length}`);
    console.log(`Valid avatars: ${validCount}`);
    console.log(`Missing avatars: ${missingCount}`);
    console.log(`Invalid path format: ${invalidPathCount}`);
    
  } catch (error) {
    console.error('Error during avatar URL verification:', error);
  } finally {
    // Close the database pool
    await pool.end();
  }
}

// Run the verification function
verifyAvatarUrls().catch(console.error);