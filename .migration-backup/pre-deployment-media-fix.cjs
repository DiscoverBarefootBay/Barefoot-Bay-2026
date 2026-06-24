/**
 * Pre-deployment media fix script for Barefoot Bay community platform
 * 
 * This script:
 * 1. Fixes database records to use normalized media paths for production
 * 2. Ensures media files exist in both locations for compatibility
 * 3. Runs automatically before deployment via deploy.sh script
 * 
 * Usage:
 * node pre-deployment-media-fix.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Initialize PostgreSQL client
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

console.log('===============================================');
console.log('   BAREFOOT BAY MEDIA PATH NORMALIZATION');
console.log('===============================================');
console.log('This script fixes image paths in the database and');
console.log('ensures files exist in both development and production locations');
console.log('-----------------------------------------------');

// Tables and their media columns that need to be normalized
const MEDIA_COLUMNS = [
  { table: 'events', columns: ['mediaUrls'] },
  { table: 'forum_posts', columns: ['mediaUrls'] },
  { table: 'forum_comments', columns: ['mediaUrls'] },
  { table: 'page_content', columns: ['content'] },
  { table: 'content', columns: ['content'] },
  { table: 'real_estate_listings', columns: ['mediaUrls'] },
  { table: 'users', columns: ['avatar_url'] }, // Note: column name is avatar_url in the database
];

// Media path categories 
const MEDIA_CATEGORIES = [
  { pattern: /\/uploads\/calendar\//, normalizedPrefix: '/calendar/' },
  { pattern: /\/uploads\/banner-slides\//, normalizedPrefix: '/banner-slides/' },
  { pattern: /\/uploads\/content-media\//, normalizedPrefix: '/content-media/' },
  { pattern: /\/uploads\/forum-media\//, normalizedPrefix: '/forum-media/' },
  { pattern: /\/uploads\/vendor-media\//, normalizedPrefix: '/vendor-media/' },
  { pattern: /\/uploads\/community-media\//, normalizedPrefix: '/community-media/' },
  { pattern: /\/uploads\/Real Estate\//, normalizedPrefix: '/Real Estate/' },
  { pattern: /\/uploads\/avatars\//, normalizedPrefix: '/avatars/' },
  { pattern: /\/uploads\//, normalizedPrefix: '/' }, // Generic catch-all
];

// Directory mappings for file copying
const DIRECTORY_MAPPINGS = [
  { src: 'uploads/calendar', dest: 'calendar' },
  { src: 'uploads/banner-slides', dest: 'banner-slides' },
  { src: 'uploads/content-media', dest: 'content-media' },
  { src: 'uploads/forum-media', dest: 'forum-media' },
  { src: 'uploads/vendor-media', dest: 'vendor-media' },
  { src: 'uploads/community-media', dest: 'community-media' },
  { src: 'uploads/Real Estate', dest: 'Real Estate' },
  { src: 'uploads/avatars', dest: 'avatars' },
  { src: 'uploads/icons', dest: 'icons' },
];

/**
 * Normalize a media path from /uploads/path to /path format
 * @param {string} mediaPath - The original media path
 * @returns {string} - The normalized path
 */
function normalizeMediaPath(mediaPath) {
  if (!mediaPath) return mediaPath;
  
  // Skip paths that are already normalized
  if (!mediaPath.startsWith('/uploads/')) return mediaPath;
  
  // Try each category pattern
  for (const category of MEDIA_CATEGORIES) {
    if (category.pattern.test(mediaPath)) {
      return mediaPath.replace(category.pattern, category.normalizedPrefix);
    }
  }
  
  // Fallback - just remove /uploads/
  return mediaPath.replace('/uploads/', '/');
}

/**
 * Normalize media paths in a JSON string or array
 * @param {string|array} value - The value to normalize
 * @returns {string|array} - The normalized value
 */
function normalizeMediaPathsInValue(value) {
  if (!value) return value;
  
  // If it's an array, normalize each item
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'string') {
        return normalizeMediaPath(item);
      }
      return item;
    });
  }
  
  // If it's a string that might be JSON, try to parse it
  if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
    try {
      const parsedValue = JSON.parse(value);
      
      // Process object
      if (typeof parsedValue === 'object') {
        // Process arrays
        if (Array.isArray(parsedValue)) {
          for (let i = 0; i < parsedValue.length; i++) {
            if (typeof parsedValue[i] === 'string' && parsedValue[i].includes('/uploads/')) {
              parsedValue[i] = normalizeMediaPath(parsedValue[i]);
            }
          }
        } else {
          // Process object recursively
          processObjectProperties(parsedValue);
        }
      }
      
      // Return stringified JSON
      return JSON.stringify(parsedValue);
    } catch (e) {
      // Not valid JSON, treat as a normal string
    }
  }
  
  // Handle simple string
  if (typeof value === 'string' && value.includes('/uploads/')) {
    return normalizeMediaPath(value);
  }
  
  return value;
}

/**
 * Recursively process object properties to normalize media paths
 * @param {object} obj - The object to process
 */
function processObjectProperties(obj) {
  if (!obj || typeof obj !== 'object') return;
  
  for (const key in obj) {
    const value = obj[key];
    
    if (typeof value === 'string' && value.includes('/uploads/')) {
      obj[key] = normalizeMediaPath(value);
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === 'string' && value[i].includes('/uploads/')) {
          value[i] = normalizeMediaPath(value[i]);
        } else if (typeof value[i] === 'object') {
          processObjectProperties(value[i]);
        }
      }
    } else if (typeof value === 'object') {
      processObjectProperties(value);
    }
  }
}

/**
 * Extract all media paths from a value
 * @param {string|array} value - The value to extract from
 * @returns {array} - Array of media paths
 */
function extractMediaPathsFromValue(value) {
  const paths = [];
  
  if (!value) return paths;
  
  // Function to extract paths from a string
  const extractFromString = (str) => {
    if (typeof str !== 'string') return;
    
    // Match all paths that start with /uploads/ or without /uploads/ (normalized)
    const regex = /(\/uploads\/[^\s"',)]+)|(\/[^/\s"',)][^\s"',)]*\.(jpg|jpeg|png|gif|webp|mp4|webm|svg))/g;
    const matches = str.match(regex) || [];
    paths.push(...matches);
  };
  
  // If it's an array, process each item
  if (Array.isArray(value)) {
    value.forEach(item => {
      if (typeof item === 'string') {
        extractFromString(item);
      }
    });
    return paths;
  }
  
  // If it's a JSON string, parse and process it
  if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
    try {
      const parsedValue = JSON.parse(value);
      
      if (Array.isArray(parsedValue)) {
        parsedValue.forEach(item => {
          if (typeof item === 'string') {
            extractFromString(item);
          }
        });
      } else if (typeof parsedValue === 'object') {
        // Process all string values in the object recursively
        const extractFromObject = (obj) => {
          if (!obj || typeof obj !== 'object') return;
          
          for (const key in obj) {
            const val = obj[key];
            if (typeof val === 'string') {
              extractFromString(val);
            } else if (Array.isArray(val)) {
              val.forEach(item => {
                if (typeof item === 'string') {
                  extractFromString(item);
                } else if (typeof item === 'object') {
                  extractFromObject(item);
                }
              });
            } else if (typeof val === 'object') {
              extractFromObject(val);
            }
          }
        };
        
        extractFromObject(parsedValue);
      }
    } catch (e) {
      // Not valid JSON, treat as a normal string
      extractFromString(value);
    }
  } else if (typeof value === 'string') {
    // Process as normal string
    extractFromString(value);
  }
  
  return paths;
}

/**
 * Get the destination path for a file (where it should exist in production)
 * @param {string} filePath - Original path with /uploads/ prefix
 * @returns {string|null} - The destination path without /uploads/ prefix, or null if invalid
 */
function getDestinationPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return null;
  
  // Handle both formats
  const normalizedPath = filePath.startsWith('/uploads/')
    ? filePath.replace('/uploads/', '/')
    : filePath;
  
  // Resolve to absolute path from current directory
  return path.join(process.cwd(), normalizedPath.substring(1));
}

/**
 * Ensure a file exists in both locations (with and without /uploads/ prefix)
 * @param {string} filePath - Path to the media file
 */
async function ensureFileInBothLocations(filePath) {
  if (!filePath || typeof filePath !== 'string') return;
  
  try {
    // Skip external URLs
    if (filePath.startsWith('http')) return;
    
    // Normalize paths for consistent handling
    const normalizedPath = filePath.startsWith('/uploads/')
      ? filePath.replace('/uploads/', '/')
      : filePath;
    
    const uploadsPath = filePath.startsWith('/uploads/')
      ? path.join(process.cwd(), filePath.substring(1))
      : path.join(process.cwd(), 'uploads', filePath.substring(1));
    
    const rootPath = filePath.startsWith('/uploads/')
      ? path.join(process.cwd(), filePath.replace('/uploads/', '').substring(1))
      : path.join(process.cwd(), filePath.substring(1));
    
    // Ensure directories exist
    const uploadsDir = path.dirname(uploadsPath);
    const rootDir = path.dirname(rootPath);
    
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.mkdirSync(rootDir, { recursive: true });
    
    // Check if source file exists
    if (fs.existsSync(uploadsPath) && !fs.existsSync(rootPath)) {
      // Copy from uploads to root
      fs.copyFileSync(uploadsPath, rootPath);
      console.log(`Copied: ${uploadsPath} -> ${rootPath}`);
    } else if (!fs.existsSync(uploadsPath) && fs.existsSync(rootPath)) {
      // Copy from root to uploads
      fs.copyFileSync(rootPath, uploadsPath);
      console.log(`Copied: ${rootPath} -> ${uploadsPath}`);
    } else if (!fs.existsSync(uploadsPath) && !fs.existsSync(rootPath)) {
      console.warn(`Warning: File not found in either location: ${filePath}`);
    }
  } catch (err) {
    console.error(`Error ensuring file in both locations: ${filePath}`, err.message);
  }
}

/**
 * Fix media paths in a database table
 * @param {string} table - Table name
 * @param {string} column - Column name
 * @returns {Promise<number>} - Count of rows updated
 */
async function fixMediaPathsInTable(table, column) {
  let updateCount = 0;
  const paths = [];
  
  console.log(`Fixing ${table}.${column}...`);
  
  try {
    // Get all rows with media paths that need fixing
    const selectQuery = `SELECT id, ${column} FROM ${table} WHERE ${column} IS NOT NULL`;
    const { rows } = await pool.query(selectQuery);
    
    for (const row of rows) {
      let needsUpdate = false;
      let value = row[column];
      
      // Extract all media paths from the value
      const mediaPaths = extractMediaPathsFromValue(value);
      paths.push(...mediaPaths);
      
      // Normalize the value (updating paths)
      const normalizedValue = normalizeMediaPathsInValue(value);
      if (JSON.stringify(normalizedValue) !== JSON.stringify(value)) {
        needsUpdate = true;
        value = normalizedValue;
      }
      
      // Update the row if needed
      if (needsUpdate) {
        const updateQuery = `UPDATE ${table} SET ${column} = $1 WHERE id = $2`;
        await pool.query(updateQuery, [value, row.id]);
        updateCount++;
      }
    }
    
    return { updateCount, paths };
  } catch (err) {
    console.error(`Error fixing ${table}.${column}:`, err.message);
    return { updateCount: 0, paths: [] };
  }
}

/**
 * Create all necessary directories for media files
 */
async function createDirectories() {
  for (const mapping of DIRECTORY_MAPPINGS) {
    try {
      // Create both source and destination directories
      fs.mkdirSync(mapping.src, { recursive: true });
      fs.mkdirSync(mapping.dest, { recursive: true });
      console.log(`Created directories: ${mapping.src} and ${mapping.dest}`);
    } catch (err) {
      console.error(`Error creating directories for ${mapping.src}:`, err.message);
    }
  }
}

/**
 * Special handling for avatar files to ensure they're properly stored in both locations
 * and database references are normalized
 */
async function fixAvatarUrls() {
  try {
    console.log('\n===============================================');
    console.log('   FIXING AVATAR URLS AND FILE LOCATIONS');
    console.log('===============================================');
    
    // Check for avatars that need normalization
    const result = await pool.query('SELECT id, username, avatar_url FROM users WHERE avatar_url IS NOT NULL');
    console.log(`Found ${result.rows.length} users with avatar URLs.`);
    
    let updateCount = 0;
    let fileFixCount = 0;
    
    for (const user of result.rows) {
      console.log(`\nProcessing user ${user.id} (${user.username}):`);
      console.log(`  Current avatar URL: ${user.avatar_url}`);
      
      // Skip if no avatar URL
      if (!user.avatar_url) continue;
      
      // Check if this avatar uses the old format with /uploads/ prefix
      if (user.avatar_url.startsWith('/uploads/')) {
        // Get the normalized URL
        let normalizedUrl = '';
        
        // Special case for avatar URLs - ensure they go to /avatars/ directory
        const filename = path.basename(user.avatar_url);
        normalizedUrl = `/avatars/${filename}`;
        
        console.log(`  * Normalizing URL: ${user.avatar_url} -> ${normalizedUrl}`);
        
        // Update the database
        await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [normalizedUrl, user.id]);
        updateCount++;
        
        // Handle files
        try {
          // Define source (old) and destination (new) paths
          const originalPath = path.join(process.cwd(), user.avatar_url.substring(1)); // /uploads/path
          const uploadsAvatarPath = path.join(process.cwd(), 'uploads/avatars', filename);
          const rootAvatarPath = path.join(process.cwd(), 'avatars', filename);
          
          // Make sure both avatar directories exist
          fs.mkdirSync(path.dirname(uploadsAvatarPath), { recursive: true });
          fs.mkdirSync(path.dirname(rootAvatarPath), { recursive: true });
          
          // Copy the file if it exists in the original location
          if (fs.existsSync(originalPath)) {
            if (!fs.existsSync(uploadsAvatarPath)) {
              fs.copyFileSync(originalPath, uploadsAvatarPath);
              console.log(`  * Copied avatar to uploads/avatars: ${uploadsAvatarPath}`);
            }
            
            if (!fs.existsSync(rootAvatarPath)) {
              fs.copyFileSync(originalPath, rootAvatarPath);
              console.log(`  * Copied avatar to avatars: ${rootAvatarPath}`);
            }
            
            fileFixCount++;
          } else {
            console.warn(`  ! Warning: Original avatar file not found: ${originalPath}`);
            
            // Try to find in other locations
            if (fs.existsSync(uploadsAvatarPath) && !fs.existsSync(rootAvatarPath)) {
              fs.copyFileSync(uploadsAvatarPath, rootAvatarPath);
              console.log(`  * Copied from uploads/avatars to avatars directory`);
              fileFixCount++;
            } else if (!fs.existsSync(uploadsAvatarPath) && fs.existsSync(rootAvatarPath)) {
              fs.copyFileSync(rootAvatarPath, uploadsAvatarPath);
              console.log(`  * Copied from avatars to uploads/avatars directory`);
              fileFixCount++;
            }
          }
        } catch (fileErr) {
          console.error(`  ! Error handling avatar file: ${fileErr.message}`);
        }
      } else {
        console.log(`  * URL already normalized: ${user.avatar_url}`);
        
        // Still ensure files exist in both locations
        try {
          const filename = path.basename(user.avatar_url);
          const uploadsAvatarPath = path.join(process.cwd(), 'uploads/avatars', filename);
          const rootAvatarPath = path.join(process.cwd(), 'avatars', filename);
          
          // Create directories if needed
          fs.mkdirSync(path.dirname(uploadsAvatarPath), { recursive: true });
          fs.mkdirSync(path.dirname(rootAvatarPath), { recursive: true });
          
          // Copy files if needed
          if (fs.existsSync(uploadsAvatarPath) && !fs.existsSync(rootAvatarPath)) {
            fs.copyFileSync(uploadsAvatarPath, rootAvatarPath);
            console.log(`  * Copied avatar from uploads/avatars to avatars directory`);
            fileFixCount++;
          } else if (!fs.existsSync(uploadsAvatarPath) && fs.existsSync(rootAvatarPath)) {
            fs.copyFileSync(rootAvatarPath, uploadsAvatarPath);
            console.log(`  * Copied avatar from avatars to uploads/avatars directory`);
            fileFixCount++;
          }
        } catch (fileErr) {
          console.error(`  ! Error ensuring avatar in both locations: ${fileErr.message}`);
        }
      }
    }
    
    console.log('\n===============================================');
    console.log(`Avatar URL Normalization Results:`);
    console.log(`  * Updated ${updateCount} avatar URLs in the database`);
    console.log(`  * Fixed ${fileFixCount} avatar file locations`);
    console.log('===============================================\n');
    
    return { updateCount, fileFixCount };
  } catch (err) {
    console.error('Error fixing avatar URLs:', err);
    return { updateCount: 0, fileFixCount: 0 };
  }
}

/**
 * Main function to fix all media paths
 */
async function main() {
  try {
    console.log('Creating necessary directories...');
    await createDirectories();
    
    const startTime = Date.now();
    let totalUpdates = 0;
    const allPaths = new Set();
    
    // Process each table and column
    for (const { table, columns } of MEDIA_COLUMNS) {
      // Skip users table as we'll handle it separately with fixAvatarUrls
      if (table === 'users') continue;
      
      for (const column of columns) {
        const { updateCount, paths } = await fixMediaPathsInTable(table, column);
        totalUpdates += updateCount;
        paths.forEach(path => allPaths.add(path));
      }
    }
    
    console.log(`Updated ${totalUpdates} rows in the database`);
    console.log(`Found ${allPaths.size} unique media paths`);
    
    // Ensure files exist in both locations
    console.log('Ensuring files exist in both locations...');
    let filesCopied = 0;
    for (const path of allPaths) {
      await ensureFileInBothLocations(path);
      filesCopied++;
      
      // Log progress every 100 files
      if (filesCopied % 100 === 0) {
        console.log(`Processed ${filesCopied}/${allPaths.size} files...`);
      }
    }
    
    // Special handling for avatar URLs
    const { updateCount: avatarUpdates, fileFixCount: avatarFilesFixes } = await fixAvatarUrls();
    totalUpdates += avatarUpdates;
    filesCopied += avatarFilesFixes;
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`Done! Processed ${allPaths.size} files in ${duration.toFixed(2)} seconds`);
    console.log(`Total database updates: ${totalUpdates}`);
    console.log(`Total files fixed: ${filesCopied}`);
    console.log('Media path normalization complete!');
  } catch (err) {
    console.error('Error in media path normalization:', err);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the script
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});