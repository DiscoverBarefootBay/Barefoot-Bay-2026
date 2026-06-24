/**
 * Production-specific media path fixes for Barefoot Bay
 * 
 * This script addresses the recurring issue of media files disappearing in production
 * by implementing the following strategies:
 * 
 * 1. Verifies file existence in both /uploads/dir and /dir paths
 * 2. Enforces correct file permissions for all media directories
 * 3. Creates symbolic links between directories to ensure multiple paths work
 * 4. Sets up a maintenance cron job to run regularly in production
 * 5. Updates database records to use consistent paths that work in production
 * 
 * Usage:
 * node deploy-media-fixes.js
 * 
 * This script should be automatically run during deployment to production.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Pool } = require('pg');

// Set production mode
const isProduction = true;
const updateDb = true;
const dryRun = false;

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
 * Ensures both path formats exist for each file using symlinks in production
 * This is more efficient than making file copies
 */
async function syncMediaDirectories() {
  console.log('Syncing media directories...');
  
  for (const dir of MEDIA_DIRECTORIES) {
    const rootPath = `./${dir.path}`;
    const uploadsPath = `./uploads/${dir.path}`;
    
    // Create directories if they don't exist
    ensureDirectoryExists(rootPath);
    ensureDirectoryExists(uploadsPath);
    
    // Use symlinks for production to ensure both paths work
    if (isProduction) {
      // Create a .htaccess file to allow symlinks
      try {
        const htaccessContent = `
# Allow following symlinks
Options +FollowSymLinks

# Prevent directory listing
Options -Indexes

# Allow all files
<Files *>
  Order allow,deny
  Allow from all
</Files>
`;
        fs.writeFileSync(`${rootPath}/.htaccess`, htaccessContent);
        fs.writeFileSync(`${uploadsPath}/.htaccess`, htaccessContent);
        console.log(`Created .htaccess files in ${rootPath} and ${uploadsPath}`);
      } catch (error) {
        console.error(`Error creating .htaccess files: ${error.message}`);
      }
      
      // Ensure correct permissions (very important for production)
      try {
        execSync(`chmod -R 755 ${rootPath}`);
        execSync(`chmod -R 755 ${uploadsPath}`);
        console.log(`Set permissions on ${rootPath} and ${uploadsPath}`);
      } catch (error) {
        console.error(`Error setting permissions: ${error.message}`);
      }
    }
    
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
  
  // For production deployment, we'll use a format that works in all environments
  let finalUrl = `/${normalizedUrl}`;
  
  return finalUrl;
}

/**
 * Copies files from source to destination directory
 * In production, creates symlinks instead for efficiency and consistency
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
      
      // Check if destination file exists
      if (!fs.existsSync(destFile)) {
        if (!dryRun) {
          if (isProduction) {
            // In production, create symlinks instead of copies
            try {
              // Remove the destination file if it exists but is not accessible
              if (fs.existsSync(destFile)) {
                fs.unlinkSync(destFile);
              }
              
              // Create a relative symlink
              const relativeSourcePath = path.relative(path.dirname(destFile), file);
              fs.symlinkSync(relativeSourcePath, destFile);
              console.log(`Created symlink: ${destFile} -> ${relativeSourcePath}`);
            } catch (err) {
              // Fall back to copying if symlink fails
              fs.copyFileSync(file, destFile);
              console.log(`Failed to create symlink, copied instead: ${file} -> ${destFile}`);
            }
          } else {
            // In development, just copy the file
            fs.copyFileSync(file, destFile);
            console.log(`Copied ${file} -> ${destFile}`);
          }
        } else {
          console.log(`[DRY RUN] Would ${isProduction ? 'create symlink' : 'copy'}: ${file} -> ${destFile}`);
        }
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
    if (file === '.htaccess') continue; // Skip .htaccess files
    
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
      
      // Set directory permissions to ensure they're accessible
      if (isProduction) {
        try {
          execSync(`chmod 755 ${dirPath}`);
        } catch (error) {
          console.error(`Error setting permissions on ${dirPath}: ${error.message}`);
        }
      }
    }
    console.log(`${dryRun ? '[DRY RUN] Would create' : 'Created'} directory ${dirPath}`);
  }
}

/**
 * Set up a cron job to run this script periodically - DISABLED PER USER REQUEST
 * No automatic media cleanup will be performed
 */
function setupCronJob() {
  console.log('Automatic media cleanup via cron has been DISABLED per user request');
  return;
  
  // This code is intentionally disabled to prevent any automated media cleanup
  /*
  if (!isProduction) {
    console.log('Not setting up cron job in development environment');
    return;
  }
  
  try {
    // Add cron job to run maintenance script every 12 hours
    const cronCommand = '0 */12 * * * cd /app && node fix-all-media-paths.js --update-db --production';
    
    // Add cron job using crontab (if available) or write to a file
    if (!dryRun) {
      try {
        const currentCrontab = execSync('crontab -l').toString();
        
        // Check if the job already exists
        if (!currentCrontab.includes('fix-all-media-paths.js')) {
          // Add the job to crontab
          const newCrontab = currentCrontab + cronCommand + '\n';
          execSync('echo "' + newCrontab + '" | crontab -');
          console.log('Added cron job to crontab');
        } else {
          console.log('Cron job already exists');
        }
      } catch (error) {
        // If crontab fails, write to a file that can be included in cron.d
        const cronFilePath = '/app/media-maintenance.cron';
        fs.writeFileSync(cronFilePath, cronCommand + '\n');
        console.log(`Created cron file at ${cronFilePath}`);
      }
    }
    
    console.log(`${dryRun ? '[DRY RUN] Would set up' : 'Set up'} cron job to run every 12 hours`);
  } catch (error) {
    console.error('Error setting up cron job:', error);
  }
  */
}

/**
 * Create a clear-cache script for client-side use
 */
function createCacheClearingScript() {
  const scriptPath = './public/clear-media-cache.js';
  const scriptContent = `
/**
 * Script to help users clear their browser cache for media files
 * This can be included on any page that needs to clear image caches
 */
(function() {
  console.log("Running cache clearing script...");
  
  // Check if we've cleared cache in this session
  const cacheCleared = sessionStorage.getItem('mediaCacheCleared');
  if (cacheCleared) {
    return;
  }
  
  // Clear image cache by manipulating localStorage
  try {
    // Find all localStorage items related to images
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
          key.includes('image-cache') || 
          key.includes('media-cache') || 
          key.includes('forum-media') || 
          key.includes('real-estate-media')
        )) {
        keysToRemove.push(key);
      }
    }
    
    // Remove the cached items
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log("Cleared " + keysToRemove.length + " cached items from localStorage");
    
    // Mark as cleared for this session
    sessionStorage.setItem('mediaCacheCleared', 'true');
    
    console.log("Cache clearing complete - errors should be resolved on next page refresh.");
  } catch (error) {
    console.error("Error clearing media cache:", error);
  }
})();
`;

  if (!dryRun) {
    fs.writeFileSync(scriptPath, scriptContent);
    console.log(`Created cache clearing script at ${scriptPath}`);
    
    // Also create a simple include script that can be added to HTML
    const includeScriptPath = './public/include-cache-clear.js';
    const includeScript = `document.write('<script src="/clear-media-cache.js?' + Date.now() + '"></script>');`;
    fs.writeFileSync(includeScriptPath, includeScript);
    console.log(`Created cache clearing include script at ${includeScriptPath}`);
  } else {
    console.log(`[DRY RUN] Would create cache clearing script at ${scriptPath}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Production Media Path Deployment');
  console.log('-------------------------------');
  console.log('Mode:', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
  console.log('Update database:', updateDb ? 'YES' : 'NO');
  console.log('-------------------------------\n');
  
  // Step 1: Sync media directories (using symlinks in production)
  await syncMediaDirectories();
  
  // Step 2: Update database records
  if (updateDb) {
    await updateDatabaseRecords();
  }
  
  // Step 3: Set up cron job for maintenance
  setupCronJob();
  
  // Step 4: Create a cache clearing script for client-side
  createCacheClearingScript();
  
  // Clean up
  if (pool) {
    await pool.end();
  }
  
  console.log('\nProduction media path deployment completed');
}

// Run the main function
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});