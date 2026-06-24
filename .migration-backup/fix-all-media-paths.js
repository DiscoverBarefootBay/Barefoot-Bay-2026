/**
 * Comprehensive media path fixing script for Barefoot Bay
 * 
 * This script addresses the issue of media files being accessible via multiple paths
 * (/uploads/dir vs /dir) by:
 * 1. Syncing files between directories
 * 2. Updating database records to use consistent paths
 * 3. Creating maintenance tasks to keep directories in sync
 * 4. Adding production-specific absolute paths when needed
 * 
 * Usage:
 * node fix-all-media-paths.js [--update-db] [--dry-run] [--production]
 * 
 * Options:
 *   --update-db    Update database records with consistent paths
 *   --dry-run      Don't actually make changes, just report what would be done
 *   --production   Apply additional production-specific fixes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Pool } = require('pg');

// Parse command line arguments
const args = process.argv.slice(2);
const updateDb = args.includes('--update-db');
const dryRun = args.includes('--dry-run');
const isProduction = args.includes('--production') || process.env.NODE_ENV === 'production';

// Define media directories to sync
const MEDIA_DIRECTORIES = [
  { path: 'real-estate-media', dbTable: 'real_estate_listings', dbColumn: 'photos' },
  { path: 'forum-media', dbTable: 'forum_posts', dbColumn: 'media_urls' },
  { path: 'content-media', dbTable: 'content_pages', dbColumn: 'media_urls' },
  { path: 'vendor-media', dbTable: 'vendors', dbColumn: 'media_urls' },
  { path: 'calendar', dbTable: 'calendar_events', dbColumn: 'media_url' },
  { path: 'banner-slides', dbTable: 'banner_slides', dbColumn: 'image_url' },
  { path: 'avatars', dbTable: 'users', dbColumn: 'avatar_url' }
];

// Database connection setup
let pool;
if (updateDb && !dryRun) {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('DATABASE_URL environment variable not set. Please set it to update database records.');
      process.exit(1);
    }
    pool = new Pool({ connectionString });
    console.log('Connected to database');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
}

/**
 * Ensures both path formats exist for each file
 * If file exists in /uploads/dir, create a copy in /dir and vice versa
 */
async function syncMediaDirectories() {
  console.log('Syncing media directories...');
  
  for (const dir of MEDIA_DIRECTORIES) {
    const rootPath = `./${dir.path}`;
    const uploadsPath = `./uploads/${dir.path}`;
    
    // Create directories if they don't exist
    ensureDirectoryExists(rootPath);
    ensureDirectoryExists(uploadsPath);
    
    // Sync files from root to uploads
    console.log(`\nSyncing ${rootPath} -> ${uploadsPath}`);
    syncFiles(rootPath, uploadsPath);
    
    // Sync files from uploads to root
    console.log(`\nSyncing ${uploadsPath} -> ${rootPath}`);
    syncFiles(uploadsPath, rootPath);
  }
}

/**
 * Updates database records to use consistent paths
 * This ensures all paths in the database use the same format
 */
async function updateDatabaseRecords() {
  if (!pool) {
    console.error('Database connection not available, skipping database update');
    return;
  }
  
  console.log('\nUpdating database records...');
  
  for (const dir of MEDIA_DIRECTORIES) {
    console.log(`\nProcessing ${dir.dbTable}.${dir.dbColumn}...`);
    
    // Handle different column types differently
    if (dir.dbTable === 'real_estate_listings' || dir.dbTable === 'forum_posts' || 
        dir.dbTable === 'content_pages' || dir.dbTable === 'vendors') {
      // These tables have JSON array columns
      await updateJsonArrayColumn(dir.dbTable, dir.dbColumn, dir.path);
    } else {
      // These tables have string columns
      await updateStringColumn(dir.dbTable, dir.dbColumn, dir.path);
    }
  }
}

/**
 * Updates a column that contains a JSON array of media URLs
 */
async function updateJsonArrayColumn(tableName, columnName, dirPath) {
  try {
    // First, retrieve all records with media URLs
    const selectQuery = `SELECT id, ${columnName} FROM ${tableName} WHERE ${columnName} IS NOT NULL AND jsonb_array_length(${columnName}) > 0`;
    const { rows } = await pool.query(selectQuery);
    
    console.log(`Found ${rows.length} records in ${tableName} with media URLs`);
    
    let updatedCount = 0;
    
    for (const row of rows) {
      const mediaUrls = row[columnName];
      let updated = false;
      
      // Process each URL in the array
      const updatedUrls = mediaUrls.map(url => {
        if (!url) return url;
        
        const normalizedUrl = normalizeMediaPath(url, dirPath);
        if (normalizedUrl !== url) {
          updated = true;
          return normalizedUrl;
        }
        return url;
      });
      
      // Update the record if changes were made
      if (updated) {
        if (!dryRun) {
          const updateQuery = `UPDATE ${tableName} SET ${columnName} = $1 WHERE id = $2`;
          await pool.query(updateQuery, [JSON.stringify(updatedUrls), row.id]);
        }
        updatedCount++;
        
        console.log(`${dryRun ? '[DRY RUN] Would update' : 'Updated'} record ${row.id} in ${tableName}`);
        console.log(`  Before: ${JSON.stringify(mediaUrls)}`);
        console.log(`  After: ${JSON.stringify(updatedUrls)}`);
      }
    }
    
    console.log(`${dryRun ? 'Would update' : 'Updated'} ${updatedCount} records in ${tableName}`);
  } catch (error) {
    console.error(`Error updating ${tableName}.${columnName}:`, error);
  }
}

/**
 * Updates a column that contains a single media URL string
 */
async function updateStringColumn(tableName, columnName, dirPath) {
  try {
    // First, retrieve all records with media URLs
    const selectQuery = `SELECT id, ${columnName} FROM ${tableName} WHERE ${columnName} IS NOT NULL`;
    const { rows } = await pool.query(selectQuery);
    
    console.log(`Found ${rows.length} records in ${tableName} with media URLs`);
    
    let updatedCount = 0;
    
    for (const row of rows) {
      const url = row[columnName];
      
      if (!url) continue;
      
      const normalizedUrl = normalizeMediaPath(url, dirPath);
      
      // Update the record if changes were made
      if (normalizedUrl !== url) {
        if (!dryRun) {
          const updateQuery = `UPDATE ${tableName} SET ${columnName} = $1 WHERE id = $2`;
          await pool.query(updateQuery, [normalizedUrl, row.id]);
        }
        updatedCount++;
        
        console.log(`${dryRun ? '[DRY RUN] Would update' : 'Updated'} record ${row.id} in ${tableName}`);
        console.log(`  Before: ${url}`);
        console.log(`  After: ${normalizedUrl}`);
      }
    }
    
    console.log(`${dryRun ? 'Would update' : 'Updated'} ${updatedCount} records in ${tableName}`);
  } catch (error) {
    console.error(`Error updating ${tableName}.${columnName}:`, error);
  }
}

/**
 * Normalizes a media path to a consistent format
 * This function ensures all paths start with /{dirPath}/ without /uploads/
 * In production mode, can also add domain-specific prefixes if needed
 */
function normalizeMediaPath(url, dirPath) {
  if (!url) return url;
  
  // If the URL is already a full URL (starts with http), leave it as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Remove leading slash if present
  let normalizedUrl = url.startsWith('/') ? url.substring(1) : url;
  
  // Remove 'uploads/' prefix if present
  if (normalizedUrl.startsWith('uploads/')) {
    normalizedUrl = normalizedUrl.substring(8);
  }
  
  // Ensure the path starts with the correct directory
  if (!normalizedUrl.startsWith(`${dirPath}/`) && !normalizedUrl.startsWith(dirPath)) {
    // Check if this is a file directly in the directory
    if (normalizedUrl.includes('/')) {
      normalizedUrl = `${dirPath}/${normalizedUrl.split('/').pop()}`;
    } else {
      normalizedUrl = `${dirPath}/${normalizedUrl}`;
    }
  }
  
  // Add leading slash for consistency (unless in production where we might add domain)
  let finalUrl = `/${normalizedUrl}`;
  
  // In production, we might need to add domain-specific paths
  if (isProduction) {
    // For now, we leave the URL as-is with just a leading slash
    // This seems to work best with the client-side SmartImage component
    // which will try multiple paths including the domain
    
    // Uncomment this if you need to store full domain URLs in the database
    // const domain = 'https://barefootbay.com';
    // finalUrl = `${domain}${finalUrl}`;
  }
  
  return finalUrl;
}

/**
 * Copies files from source to destination directory
 */
function syncFiles(sourceDir, destDir) {
  try {
    // Get a list of all files in the source directory
    const files = getAllFiles(sourceDir);
    
    // For each file in the source, ensure it exists in the destination
    for (const file of files) {
      const relativePath = path.relative(sourceDir, file);
      const destFile = path.join(destDir, relativePath);
      
      // Create destination directory if it doesn't exist
      ensureDirectoryExists(path.dirname(destFile));
      
      // Check if destination file exists and compare modification times
      let shouldCopy = true;
      if (fs.existsSync(destFile)) {
        const sourceStats = fs.statSync(file);
        const destStats = fs.statSync(destFile);
        
        // Only copy if source is newer
        if (sourceStats.mtimeMs <= destStats.mtimeMs) {
          shouldCopy = false;
        }
      }
      
      if (shouldCopy) {
        if (!dryRun) {
          fs.copyFileSync(file, destFile);
        }
        console.log(`${dryRun ? '[DRY RUN] Would copy' : 'Copied'} ${file} -> ${destFile}`);
      }
    }
  } catch (error) {
    console.error(`Error syncing files from ${sourceDir} to ${destDir}:`, error);
  }
}

/**
 * Gets all files in a directory recursively
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return arrayOfFiles;
  }
  
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  }
  
  return arrayOfFiles;
}

/**
 * Creates a directory if it doesn't exist
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    if (!dryRun) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    console.log(`${dryRun ? '[DRY RUN] Would create' : 'Created'} directory ${dirPath}`);
  }
}

/**
 * Set up a cron job to run this script periodically
 */
function setupCronJob() {
  // Check if we're in production (don't set up cron in development)
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isProduction) {
    console.log('Not setting up cron job in development environment');
    return;
  }
  
  try {
    // Add cron job to run this script every day at 3:00 AM
    const cronCommand = '0 3 * * * cd /app && node fix-all-media-paths.js';
    
    // Add cron job using crontab
    if (!dryRun) {
      const currentCrontab = execSync('crontab -l').toString();
      
      // Check if the job already exists
      if (!currentCrontab.includes('fix-all-media-paths.js')) {
        // Add the job to crontab
        const newCrontab = currentCrontab + cronCommand + '\n';
        execSync('echo "' + newCrontab + '" | crontab -');
      }
    }
    
    console.log(`${dryRun ? '[DRY RUN] Would set up' : 'Set up'} cron job to run daily at 3:00 AM`);
  } catch (error) {
    console.error('Error setting up cron job:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Media Path Fixer');
  console.log('---------------');
  console.log('Mode:', dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE');
  console.log('Update database:', updateDb ? 'YES' : 'NO');
  console.log('---------------\n');
  
  // Step 1: Sync media directories
  await syncMediaDirectories();
  
  // Step 2: Update database records if requested
  if (updateDb) {
    await updateDatabaseRecords();
  }
  
  // Step 3: Set up cron job for maintenance
  setupCronJob();
  
  // Clean up
  if (pool) {
    await pool.end();
  }
  
  console.log('\nMedia path fixing completed');
}

// Run the main function
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});