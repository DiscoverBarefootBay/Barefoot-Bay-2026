/**
 * Script to fix avatar URLs in the user table and ensure avatar files 
 * exist in both development and production locations
 * 
 * This script:
 * 1. Normalizes avatar_url values in the users table (removing /uploads/ prefix)
 * 2. Ensures avatar files exist in both /uploads/avatars/ and /avatars/ directories
 * 
 * Usage: node fix-avatar-urls.cjs
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

console.log('===============================================');
console.log('   BAREFOOT BAY AVATAR URL NORMALIZATION');
console.log('===============================================');

/**
 * Normalize an avatar URL from /uploads/avatars/ to /avatars/ format
 * @param {string} avatarUrl - The original avatar URL
 * @returns {string} - The normalized URL
 */
function normalizeAvatarUrl(avatarUrl) {
  if (!avatarUrl) return avatarUrl;
  
  // Skip already normalized URLs
  if (!avatarUrl.startsWith('/uploads/')) return avatarUrl;
  
  // Get the filename
  const filename = path.basename(avatarUrl);
  
  // Handle different possible URL patterns
  if (avatarUrl.startsWith('/uploads/avatars/')) {
    return `/avatars/${filename}`;
  } else if (avatarUrl.startsWith('/uploads/avatar-')) {
    return `/avatars/${filename}`;
  } else if (avatarUrl.startsWith('/uploads/')) {
    return `/avatars/${filename}`;
  }
  
  return avatarUrl;
}

/**
 * Copy avatar file between development and production locations
 * @param {string} avatarUrl - The avatar URL (original or normalized)
 * @returns {Promise<boolean>} - Whether the operation succeeded
 */
async function ensureAvatarFileExists(avatarUrl) {
  if (!avatarUrl) return false;
  
  try {
    // Get the filename (e.g., avatar-1234567890.jpg)
    const filename = path.basename(avatarUrl);
    
    // Define source and destination paths
    const uploadsPath = path.join(process.cwd(), 'uploads', 'avatars', filename);
    const rootPath = path.join(process.cwd(), 'avatars', filename);
    
    // Make sure directories exist
    if (!fs.existsSync(path.dirname(uploadsPath))) {
      fs.mkdirSync(path.dirname(uploadsPath), { recursive: true });
    }
    
    if (!fs.existsSync(path.dirname(rootPath))) {
      fs.mkdirSync(path.dirname(rootPath), { recursive: true });
    }
    
    // Check if files exist and copy as needed
    const existsInUploads = fs.existsSync(uploadsPath);
    const existsInRoot = fs.existsSync(rootPath);
    
    if (existsInUploads && !existsInRoot) {
      // Copy from uploads/avatars to /avatars
      fs.copyFileSync(uploadsPath, rootPath);
      console.log(`  * Copied avatar from ${uploadsPath} to ${rootPath}`);
      return true;
    } else if (!existsInUploads && existsInRoot) {
      // Copy from /avatars to uploads/avatars
      fs.copyFileSync(rootPath, uploadsPath);
      console.log(`  * Copied avatar from ${rootPath} to ${uploadsPath}`);
      return true;
    } else if (!existsInUploads && !existsInRoot) {
      // Try to find the file in a broader search
      const altUploadsPath = path.join(process.cwd(), 'uploads', filename);
      
      if (fs.existsSync(altUploadsPath)) {
        // Copy from /uploads to both locations
        fs.copyFileSync(altUploadsPath, uploadsPath);
        fs.copyFileSync(altUploadsPath, rootPath);
        console.log(`  * Found avatar in alternate location and copied to both paths`);
        return true;
      }
      
      console.warn(`  ! Warning: Avatar file not found in any location: ${filename}`);
      return false;
    } else {
      // File exists in both locations
      console.log(`  * Avatar exists in both locations: ${filename}`);
      return true;
    }
  } catch (err) {
    console.error(`  ! Error ensuring avatar file exists: ${err.message}`);
    return false;
  }
}

/**
 * Update avatar URL in the database
 * @param {number} userId - User ID
 * @param {string} normalizedUrl - Normalized avatar URL
 * @returns {Promise<boolean>} - Whether the update succeeded
 */
async function updateAvatarUrl(userId, normalizedUrl) {
  try {
    const query = 'UPDATE users SET avatar_url = $1 WHERE id = $2';
    await pool.query(query, [normalizedUrl, userId]);
    console.log(`  * Updated avatar URL in database for user ${userId}`);
    return true;
  } catch (err) {
    console.error(`  ! Error updating avatar URL for user ${userId}: ${err.message}`);
    return false;
  }
}

/**
 * Main function to fix avatar URLs
 */
async function fixAvatarUrls() {
  try {
    console.log('Checking for avatars that need normalization...');
    const result = await pool.query('SELECT id, username, avatar_url FROM users WHERE avatar_url IS NOT NULL');
    
    console.log(`Found ${result.rows.length} users with avatar URLs.`);
    
    let updateCount = 0;
    let fileFixCount = 0;
    
    for (const user of result.rows) {
      console.log(`\nProcessing user ${user.id} (${user.username}):`);
      console.log(`  Current avatar URL: ${user.avatar_url}`);
      
      // Normalize the URL
      const normalizedUrl = normalizeAvatarUrl(user.avatar_url);
      
      // Check if normalization is needed
      if (normalizedUrl !== user.avatar_url) {
        console.log(`  * Normalizing URL: ${user.avatar_url} -> ${normalizedUrl}`);
        
        // Update the URL in the database
        const updated = await updateAvatarUrl(user.id, normalizedUrl);
        if (updated) updateCount++;
      } else {
        console.log(`  * URL already normalized: ${user.avatar_url}`);
      }
      
      // Ensure the avatar file exists in both locations
      const fileFixed = await ensureAvatarFileExists(normalizedUrl || user.avatar_url);
      if (fileFixed) fileFixCount++;
    }
    
    console.log('\n===============================================');
    console.log(`Processed ${result.rows.length} avatar URLs:`);
    console.log(`  * Updated ${updateCount} URLs in the database`);
    console.log(`  * Fixed ${fileFixCount} avatar file locations`);
    console.log('===============================================');
  } catch (err) {
    console.error('Error fixing avatar URLs:', err);
  } finally {
    await pool.end();
  }
}

// Run the script
fixAvatarUrls();