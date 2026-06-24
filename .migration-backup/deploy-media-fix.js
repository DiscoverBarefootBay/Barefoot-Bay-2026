/**
 * Deploy Media Fix for Barefoot Bay Website
 * 
 * This is a simpler version of the fix-all-media-paths.js script for deployment
 * on the production server. It focuses only on copying files and fixing database paths,
 * without creating utilities or modifying code.
 * 
 * Usage:
 * node deploy-media-fix.js
 */

const fs = require('fs');
const path = require('path');
const { db } = require('./server/storage');
const { eq, sql } = require('drizzle-orm');
const { listings } = require('./shared/schema');

// Define media types
const MEDIA_TYPES = {
  REAL_ESTATE_MEDIA: 'real-estate-media',
  CALENDAR: 'calendar',
  FORUM: 'forum-media',
  VENDOR: 'vendor-media',
  CONTENT: 'content-media',
  BANNER: 'banner-slides'
};

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dirPath - Directory path to check/create
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Copy a file, ensuring the destination directory exists
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 * @returns {boolean} - Whether the copy was successful
 */
function copyFileWithDirectories(sourcePath, destPath) {
  try {
    if (!fs.existsSync(sourcePath)) {
      console.log(`Source file doesn't exist: ${sourcePath}`);
      return false;
    }

    ensureDirectoryExists(path.dirname(destPath));
    fs.copyFileSync(sourcePath, destPath);
    return true;
  } catch (error) {
    console.error(`Error copying file from ${sourcePath} to ${destPath}:`, error);
    return false;
  }
}

/**
 * Normalize a path to use the specified format
 * @param {string} urlPath - Path to normalize
 * @param {boolean} includeUploads - Whether to include the /uploads/ prefix
 * @returns {string} - Normalized path
 */
function normalizePath(urlPath, includeUploads = true) {
  if (!urlPath) return urlPath;
  
  // Remove leading slash if present
  let normalizedPath = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;
  
  // Remove uploads/ prefix if present
  if (normalizedPath.startsWith('uploads/')) {
    normalizedPath = normalizedPath.substring(8);
  }
  
  // Add prefix based on the requested format
  return includeUploads ? `/uploads/${normalizedPath}` : `/${normalizedPath}`;
}

/**
 * Synchronize files between /uploads/ and root directories
 * This ensures files can be accessed with both path formats
 */
async function synchronizeMediaFiles() {
  const mediaTypesArr = Object.values(MEDIA_TYPES);
  let totalSynced = 0;
  
  for (const mediaType of mediaTypesArr) {
    console.log(`\nSynchronizing media for ${mediaType}...`);
    
    // Define directories
    const uploadsDir = path.join(__dirname, 'uploads', mediaType);
    const rootDir = path.join(__dirname, mediaType);
    
    // Ensure both directories exist
    ensureDirectoryExists(uploadsDir);
    ensureDirectoryExists(rootDir);
    
    // Sync files from uploads/ to root/
    if (fs.existsSync(uploadsDir)) {
      try {
        const files = fs.readdirSync(uploadsDir);
        console.log(`Found ${files.length} files in uploads/${mediaType}/`);
        
        for (const file of files) {
          const sourcePath = path.join(uploadsDir, file);
          const destPath = path.join(rootDir, file);
          
          // Only copy files, not directories
          if (fs.statSync(sourcePath).isFile() && !fs.existsSync(destPath)) {
            if (copyFileWithDirectories(sourcePath, destPath)) {
              totalSynced++;
              console.log(`Copied: ${sourcePath} -> ${destPath}`);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${uploadsDir}:`, error);
      }
    }
    
    // Sync files from root/ to uploads/
    if (fs.existsSync(rootDir)) {
      try {
        const files = fs.readdirSync(rootDir);
        console.log(`Found ${files.length} files in /${mediaType}/`);
        
        for (const file of files) {
          const sourcePath = path.join(rootDir, file);
          const destPath = path.join(uploadsDir, file);
          
          // Only copy files, not directories
          if (fs.statSync(sourcePath).isFile() && !fs.existsSync(destPath)) {
            if (copyFileWithDirectories(sourcePath, destPath)) {
              totalSynced++;
              console.log(`Copied: ${sourcePath} -> ${destPath}`);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${rootDir}:`, error);
      }
    }
  }
  
  console.log(`\nTotal files synchronized: ${totalSynced}`);
  return totalSynced;
}

/**
 * Fix listing photos in the database to ensure they work with both path formats
 */
async function fixListingPhotos() {
  console.log('\nFixing listing photos in database...');
  
  // Get all listings with photos
  try {
    const allListings = await db.select().from(listings).where(sql`photos is not null`);
    console.log(`Found ${allListings.length} listings with photos`);
    
    let updatedCount = 0;
    
    for (const listing of allListings) {
      if (!listing.photos || !Array.isArray(listing.photos) || listing.photos.length === 0) {
        continue;
      }
      
      let needsUpdate = false;
      const fixedPhotos = listing.photos.map(photoUrl => {
        if (!photoUrl) return photoUrl;
        
        // If the URL doesn't include '/uploads/' and doesn't start with '/',
        // or it starts with '/' but not '/uploads/' and not '/real-estate-media/'
        if ((!photoUrl.includes('/uploads/') && !photoUrl.startsWith('/')) ||
            (photoUrl.startsWith('/') && !photoUrl.startsWith('/uploads/') && !photoUrl.startsWith('/real-estate-media/'))) {
          needsUpdate = true;
          // Normalize to include /uploads/
          return normalizePath(photoUrl, true);
        }
        return photoUrl;
      });
      
      if (needsUpdate) {
        try {
          // Update the listing in the database
          await db.update(listings)
            .set({ photos: fixedPhotos })
            .where(eq(listings.id, listing.id));
          
          updatedCount++;
          console.log(`Updated listing ID ${listing.id} photos:`, fixedPhotos);
        } catch (updateError) {
          console.error(`Error updating listing ID ${listing.id}:`, updateError);
        }
      }
    }
    
    console.log(`Updated ${updatedCount} listings with fixed photo paths`);
    return updatedCount;
  } catch (error) {
    console.error('Error fetching listings:', error);
    return 0;
  }
}

/**
 * Create a cron script to regularly ensure media files are synchronized
 */
function createSyncCronScript() {
  const cronScriptPath = path.join(__dirname, 'sync-media-cron.js');
  
  // Extract the synchronization logic for the cron script
  const cronScript = `/**
 * Media Synchronization Cron Script
 * 
 * This script runs periodically to ensure media files exist in both
 * /uploads/media-type/ and /media-type/ directories to prevent broken images.
 * 
 * Recommended to run via cron job: daily at midnight
 * 0 0 * * * node /path/to/sync-media-cron.js
 */

const fs = require('fs');
const path = require('path');

// Define media types
const MEDIA_TYPES = {
  REAL_ESTATE_MEDIA: 'real-estate-media',
  CALENDAR: 'calendar',
  FORUM: 'forum-media',
  VENDOR: 'vendor-media',
  CONTENT: 'content-media',
  BANNER: 'banner-slides'
};

// Ensure directory exists
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(\`Creating directory: \${dirPath}\`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Copy file with directory creation
function copyFileWithDirectories(sourcePath, destPath) {
  try {
    if (!fs.existsSync(sourcePath)) {
      console.log(\`Source file doesn't exist: \${sourcePath}\`);
      return false;
    }

    ensureDirectoryExists(path.dirname(destPath));
    fs.copyFileSync(sourcePath, destPath);
    return true;
  } catch (error) {
    console.error(\`Error copying file from \${sourcePath} to \${destPath}:\`, error);
    return false;
  }
}

// Synchronize media files
async function synchronizeMediaFiles() {
  const mediaTypesArr = Object.values(MEDIA_TYPES);
  let totalSynced = 0;
  
  for (const mediaType of mediaTypesArr) {
    console.log(\`\\nSynchronizing media for \${mediaType}...\`);
    
    // Define directories
    const uploadsDir = path.join(__dirname, 'uploads', mediaType);
    const rootDir = path.join(__dirname, mediaType);
    
    // Ensure both directories exist
    ensureDirectoryExists(uploadsDir);
    ensureDirectoryExists(rootDir);
    
    // Sync files from uploads/ to root/
    if (fs.existsSync(uploadsDir)) {
      try {
        const files = fs.readdirSync(uploadsDir);
        console.log(\`Found \${files.length} files in uploads/\${mediaType}/\`);
        
        for (const file of files) {
          const sourcePath = path.join(uploadsDir, file);
          const destPath = path.join(rootDir, file);
          
          // Only copy files, not directories
          if (fs.statSync(sourcePath).isFile() && !fs.existsSync(destPath)) {
            if (copyFileWithDirectories(sourcePath, destPath)) {
              totalSynced++;
              console.log(\`Copied: \${sourcePath} -> \${destPath}\`);
            }
          }
        }
      } catch (error) {
        console.error(\`Error reading directory \${uploadsDir}:\`, error);
      }
    }
    
    // Sync files from root/ to uploads/
    if (fs.existsSync(rootDir)) {
      try {
        const files = fs.readdirSync(rootDir);
        console.log(\`Found \${files.length} files in /\${mediaType}/\`);
        
        for (const file of files) {
          const sourcePath = path.join(rootDir, file);
          const destPath = path.join(uploadsDir, file);
          
          // Only copy files, not directories
          if (fs.statSync(sourcePath).isFile() && !fs.existsSync(destPath)) {
            if (copyFileWithDirectories(sourcePath, destPath)) {
              totalSynced++;
              console.log(\`Copied: \${sourcePath} -> \${destPath}\`);
            }
          }
        }
      } catch (error) {
        console.error(\`Error reading directory \${rootDir}:\`, error);
      }
    }
  }
  
  console.log(\`\\nTotal files synchronized: \${totalSynced}\`);
  return totalSynced;
}

// Run the synchronization
synchronizeMediaFiles()
  .then(count => {
    console.log(\`Media synchronization completed. \${count} files synchronized.\`);
  })
  .catch(error => {
    console.error('Error during media synchronization:', error);
  });
`;
  
  // Write the cron script
  try {
    fs.writeFileSync(cronScriptPath, cronScript);
    console.log(`\nCreated sync cron script: ${cronScriptPath}`);
    console.log('To automate this process, add the following to your crontab:');
    console.log('0 0 * * * node /path/to/sync-media-cron.js');
    
    return cronScriptPath;
  } catch (error) {
    console.error('Error creating cron script:', error);
    return null;
  }
}

/**
 * Main function to run the fix
 */
async function main() {
  console.log('=== Barefoot Bay Media Path Fix - DEPLOYMENT VERSION ===');
  console.log('Starting media path fix for production server...');
  
  // Step 1: Synchronize all media files
  const syncCount = await synchronizeMediaFiles();
  
  // Step 2: Fix listing photos in database
  const dbFixCount = await fixListingPhotos();
  
  // Step 3: Create cron script for regular synchronization
  const cronPath = createSyncCronScript();
  
  console.log('\n=== Media Path Fix Complete ===');
  console.log(`- Synchronized ${syncCount} files between directories`);
  console.log(`- Fixed ${dbFixCount} listings in the database`);
  console.log(`- Created cron script: ${cronPath || 'Failed'}`);
  console.log('\nRecommended next steps:');
  console.log('1. Set up the sync-media-cron.js to run daily via crontab');
  console.log('2. Restart the server to apply changes');
}

// Run the script
main()
  .then(() => {
    console.log('Media path fix deployment completed successfully.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error running media path fix script:', err);
    process.exit(1);
  });