/**
 * Direct migration script for calendar media to Replit Object Storage
 * This script uses CommonJS format and directly queries the database
 */

// Load environment variables
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('@replit/object-storage');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Replit Object Storage
const objectStorage = new Client({
  token: process.env.REPLIT_OBJECT_STORAGE_TOKEN,
});

// Constants
const CALENDAR_BUCKET = 'CALENDAR';
const CALENDAR_PATHS = ['/uploads/calendar/', '/calendar/'];
const MAPPING_FILE_PATH = path.join(__dirname, '..', 'server', 'calendar-media-mapping.json');
const ROOT_DIR = path.join(__dirname, '..');
const FILESYSTEM_DIRS = [
  path.join(ROOT_DIR, 'uploads', 'calendar'),
  path.join(ROOT_DIR, 'calendar')
];

// Parse command line arguments
const isDryRun = process.argv.includes('--dry-run');

// Create calendar directories if they don't exist
FILESYSTEM_DIRS.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Get all calendar events with media from the database
 */
async function getCalendarEventsWithMedia() {
  const queryText = `
    SELECT id, title, media_urls AS "mediaUrls"
    FROM events
    WHERE media_urls IS NOT NULL AND array_length(media_urls, 1) > 0
  `;
  
  try {
    const result = await pool.query(queryText);
    return result.rows;
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return [];
  }
}

/**
 * Check if a URL is a filesystem URL for calendar media
 */
function isCalendarMediaUrl(url) {
  if (!url) return false;
  return CALENDAR_PATHS.some(prefix => url.startsWith(prefix));
}

/**
 * Get the local path for a calendar media URL
 */
function getLocalPath(url) {
  // Handle both formats: /uploads/calendar/file.jpg and /calendar/file.jpg
  let relativePath = url;
  
  // Strip leading /uploads if present
  if (url.startsWith('/uploads/')) {
    relativePath = url.substring('/uploads'.length);
  }
  
  // Resolve to full path
  return path.join(ROOT_DIR, relativePath);
}

/**
 * Load or create URL mapping file
 */
function loadUrlMapping() {
  try {
    if (fs.existsSync(MAPPING_FILE_PATH)) {
      const content = fs.readFileSync(MAPPING_FILE_PATH, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Error loading mapping file:', error);
  }
  
  return {};
}

/**
 * Save URL mapping to file
 */
function saveUrlMapping(mapping) {
  if (isDryRun) {
    console.log('[DRY RUN] Would save mapping file with', Object.keys(mapping).length, 'entries');
    return;
  }
  
  try {
    // Create directory if it doesn't exist
    const mappingDir = path.dirname(MAPPING_FILE_PATH);
    if (!fs.existsSync(mappingDir)) {
      fs.mkdirSync(mappingDir, { recursive: true });
    }
    
    fs.writeFileSync(MAPPING_FILE_PATH, JSON.stringify(mapping, null, 2), 'utf8');
    console.log(`✅ Saved URL mapping to ${MAPPING_FILE_PATH}`);
  } catch (error) {
    console.error('Error saving mapping file:', error);
  }
}

/**
 * Update event in database with Object Storage URL
 */
async function updateEventMedia(eventId, field, newValue) {
  if (isDryRun) {
    console.log(`[DRY RUN] Would update event ${eventId} ${field} to`, newValue);
    return true;
  }
  
  try {
    // Convert camelCase field name to snake_case for database
    const dbField = field === 'mediaUrl' ? 'media_url' : field === 'mediaUrls' ? 'media_urls' : field;
    
    // We need to handle arrays specially for PostgreSQL
    if (Array.isArray(newValue)) {
      // Format as PostgreSQL array literal
      const pgArrayString = `{${newValue.map(url => `"${url}"`).join(',')}}`;
      
      const queryText = `
        UPDATE events
        SET ${dbField} = $1::text[]
        WHERE id = $2
      `;
      
      await pool.query(queryText, [pgArrayString, eventId]);
    } else {
      // Handle single value
      const queryText = `
        UPDATE events
        SET ${dbField} = $1
        WHERE id = $2
      `;
      
      await pool.query(queryText, [newValue, eventId]);
    }
    
    return true;
  } catch (error) {
    console.error(`Error updating event ${eventId}:`, error);
    return false;
  }
}

/**
 * Upload a file to Replit Object Storage
 */
async function uploadFileToObjectStorage(filePath, key) {
  if (isDryRun) {
    console.log(`[DRY RUN] Would upload ${filePath} to ${CALENDAR_BUCKET}/${key}`);
    return `https://object-storage.replit.app/${CALENDAR_BUCKET}/${key}`;
  }
  
  try {
    // Check multiple possible locations for the file
    let actualFilePath = filePath;
    
    // If file doesn't exist at the primary location, try different paths
    if (!fs.existsSync(actualFilePath)) {
      // Try with /uploads prefix
      const withUploadsPath = path.join(process.cwd(), 'uploads', path.basename(filePath));
      if (fs.existsSync(withUploadsPath)) {
        console.log(`Found file at alternate location: ${withUploadsPath}`);
        actualFilePath = withUploadsPath;
      } 
      // Try in uploads/calendar
      else {
        const calendarPath = path.join(process.cwd(), 'uploads/calendar', path.basename(filePath));
        if (fs.existsSync(calendarPath)) {
          console.log(`Found file at calendar location: ${calendarPath}`);
          actualFilePath = calendarPath;
        }
        // Try directly in calendar folder
        else {
          const directCalendarPath = path.join(process.cwd(), 'calendar', path.basename(filePath));
          if (fs.existsSync(directCalendarPath)) {
            console.log(`Found file at direct calendar location: ${directCalendarPath}`);
            actualFilePath = directCalendarPath;
          }
        }
      }
    }
    
    // Final check if the file exists at any location
    if (!fs.existsSync(actualFilePath)) {
      console.error(`File not found in any location: ${path.basename(filePath)}`);
      return null;
    }
    
    const fileBuffer = fs.readFileSync(actualFilePath);
    const fileExt = path.extname(actualFilePath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    // Set content type based on file extension
    switch (fileExt) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      case '.mp4':
        contentType = 'video/mp4';
        break;
      case '.pdf':
        contentType = 'application/pdf';
        break;
    }
    
    console.log(`Uploading ${path.basename(filePath)} to ${CALENDAR_BUCKET}...`);
    
    await objectStorage.uploadFromBytes(`${CALENDAR_BUCKET}/${key}`, fileBuffer, {
      contentType: contentType
    });
    
    const url = `https://object-storage.replit.app/${CALENDAR_BUCKET}/${key}`;
    console.log(`✅ Uploaded to ${url}`);
    return url;
  } catch (error) {
    console.error(`Error uploading ${filePath}:`, error);
    return null;
  }
}

/**
 * Process calendar event media URLs
 */
async function processEventMedia(event, mapping) {
  let updated = false;
  
  // Process mediaUrls array
  if (event.mediaUrls && Array.isArray(event.mediaUrls)) {
    const mediaUrls = event.mediaUrls;
    const newMediaUrls = [...mediaUrls]; // Clone array for modifications
    
    // Process each URL in the array
    for (let i = 0; i < mediaUrls.length; i++) {
      const url = mediaUrls[i];
      
      if (isCalendarMediaUrl(url)) {
        const filePath = getLocalPath(url);
        const fileName = path.basename(url);
        const key = `events/${fileName}`;
        
        // Check if already in mapping
        if (mapping[url]) {
          console.log(`URL already mapped: ${url} -> ${mapping[url]}`);
          newMediaUrls[i] = mapping[url];
        } else {
          // Upload file to Object Storage
          const objectStorageUrl = await uploadFileToObjectStorage(filePath, key);
          
          if (objectStorageUrl) {
            mapping[url] = objectStorageUrl;
            newMediaUrls[i] = objectStorageUrl;
          }
        }
      }
    }
    
    // Check if any URLs changed
    const hasChanges = mediaUrls.some((url, index) => url !== newMediaUrls[index]);
    
    if (hasChanges) {
      // Update database reference with new URLs array
      await updateEventMedia(event.id, 'mediaUrls', newMediaUrls);
      updated = true;
    }
  }
  
  return updated;
}

/**
 * Run verification test
 */
async function verifyObjectStorage() {
  try {
    console.log('🔍 Verifying Replit Object Storage access...');
    
    // Ensure we have a token
    if (!process.env.REPLIT_OBJECT_STORAGE_TOKEN) {
      console.error('\n❌ ERROR: REPLIT_OBJECT_STORAGE_TOKEN is not set in environment');
      console.error('Please add it to your .env file or set it as an environment variable.');
      process.exit(1);
    }
    
    // Upload a test file
    const testKey = `test-${Date.now()}`;
    const testContent = Buffer.from('Test file for Object Storage verification');
    
    console.log('Uploading test file to Object Storage...');
    await objectStorage.uploadFromBytes(`test/${testKey}`, testContent, {
      contentType: 'text/plain'
    });
    
    const url = `https://object-storage.replit.app/test/${testKey}`;
    console.log(`✅ Successfully uploaded test file: ${url}`);
    
    // Try to delete it
    try {
      await objectStorage.delete(`test/${testKey}`);
      console.log('✅ Successfully deleted test file.');
    } catch (deleteErr) {
      console.warn('⚠️ Could not delete test file, but upload was successful.');
    }
    
    console.log('\n✅ Verification completed successfully. Your Replit Object Storage is properly configured.');
    return true;
  } catch (error) {
    console.error('\n❌ ERROR: Could not access Replit Object Storage');
    console.error(error);
    return false;
  }
}

/**
 * Main migration function
 */
async function migrateCalendarMedia() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║          CALENDAR MEDIA MIGRATION TO REPLIT OBJECT STORAGE     ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);
  
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no changes will be made)' : '✅ LIVE RUN'}`);
  
  // Check if REPLIT_OBJECT_STORAGE_TOKEN is set in environment
  if (!process.env.REPLIT_OBJECT_STORAGE_TOKEN) {
    console.error('\n❌ ERROR: REPLIT_OBJECT_STORAGE_TOKEN is not set in environment');
    console.error('Please add it to your .env file or set it as an environment variable.');
    process.exit(1);
  }
  
  // Important: This migration maintains filesystem copies!
  console.log('\n✋ IMPORTANT: This migration PRESERVES all filesystem media');
  console.log('Files will be copied to Object Storage while keeping the originals intact');
  console.log('No files will be deleted from the filesystem during this migration');
  
  // 1. Load existing URL mapping
  const urlMapping = loadUrlMapping();
  console.log(`Loaded URL mapping with ${Object.keys(urlMapping).length} existing entries`);
  
  // 2. Get all calendar events with media
  const events = await getCalendarEventsWithMedia();
  console.log(`Found ${events.length} calendar events with media`);
  
  if (events.length === 0) {
    console.log('No calendar events with media found. Nothing to migrate.');
    return;
  }
  
  // 3. Process each event
  let updatedCount = 0;
  let errorCount = 0;
  
  for (const event of events) {
    console.log(`Processing event ${event.id}: "${event.title}"`);
    
    try {
      const updated = await processEventMedia(event, urlMapping);
      
      if (updated) {
        updatedCount++;
      }
    } catch (error) {
      console.error(`Error processing event ${event.id}:`, error);
      errorCount++;
    }
  }
  
  // 4. Save URL mapping for fallback middleware
  saveUrlMapping(urlMapping);
  
  // 5. Print summary
  console.log('\n✅ Migration complete');
  console.log(`Total events with media: ${events.length}`);
  console.log(`Events updated: ${updatedCount}`);
  console.log(`Errors encountered: ${errorCount}`);
  console.log(`Total URL mappings: ${Object.keys(urlMapping).length}`);
  
  if (isDryRun) {
    console.log('\n🔍 This was a DRY RUN. No changes were made.');
    console.log('To perform the actual migration, run the script without the --dry-run flag.');
  }
}

/**
 * Main execution
 */
async function main() {
  // Check if we're in verify mode
  if (process.argv.includes('--verify')) {
    const success = await verifyObjectStorage();
    process.exit(success ? 0 : 1);
  } else {
    // Run the migration
    await migrateCalendarMedia();
  }
}

// Start the migration
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});