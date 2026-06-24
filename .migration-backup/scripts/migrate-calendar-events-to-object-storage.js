#!/usr/bin/env node

/**
 * Migrate calendar event media files to Replit Object Storage
 * 
 * This script:
 * 1. Finds all calendar events with media URLs in the filesystem
 * 2. Uploads these files to the CALENDAR bucket in Replit Object Storage
 * 3. Creates a mapping file for URL redirection
 * 4. Optionally updates the database with new URLs
 * 
 * Usage:
 * $ node scripts/migrate-calendar-events-to-object-storage.js [--dry-run]
 * 
 * Options:
 *   --dry-run    Run in dry-run mode without making changes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Try to import from different locations to ensure compatibility
let pool;
try {
  // First try our local module
  const db = await import('./modules/db.js');
  pool = db.pool;
  console.log('Successfully imported db from modules directory');
} catch (err) {
  console.log('Could not import db from modules directory, trying source...');
  try {
    // Then try source
    const db = await import('../server/db.js');
    pool = db.pool;
    console.log('Successfully imported db from source');
  } catch (sourceErr) {
    console.log('Could not import db from source, trying dist...');
    try {
      // Finally try dist
      const db = await import('../dist/server/db.js');
      pool = db.pool;
      console.log('Successfully imported db from dist');
    } catch (distErr) {
      console.error('Failed to import db module:', distErr);
      process.exit(1);
    }
  }
}

// Load environment variables
dotenv.config();

// Get the directory path for this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// Constants
const CALENDAR_PATHS = ['/uploads/calendar/', '/calendar/'];
const CALENDAR_BUCKET = 'CALENDAR';
const MAPPING_FILE_PATH = path.join(rootDir, 'server', 'calendar-media-mapping.json');
const FILESYSTEM_DIRS = [
  path.join(rootDir, 'uploads', 'calendar'),
  path.join(rootDir, 'calendar')
];

// Create the calendar directories if they don't exist (for testing)
FILESYSTEM_DIRS.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Get all calendar events with media from the database
 * @returns {Promise<Array>} Array of events with media
 */
async function getCalendarEventsWithMedia() {
  const queryText = `
    SELECT id, title, mediaUrls, mediaUrl
    FROM events
    WHERE mediaUrls IS NOT NULL OR mediaUrl IS NOT NULL
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
 * @param {string} url - URL to check
 * @returns {boolean} True if it's a filesystem calendar URL
 */
function isCalendarMediaUrl(url) {
  if (!url) return false;
  return CALENDAR_PATHS.some(prefix => url.startsWith(prefix));
}

/**
 * Get the local path for a calendar media URL
 * @param {string} url - Calendar media URL (e.g., /uploads/calendar/event-123.jpg)
 * @returns {string} Local filesystem path
 */
function getLocalPath(url) {
  // Handle both formats: /uploads/calendar/file.jpg and /calendar/file.jpg
  let relativePath = url;
  
  // Strip leading /uploads if present
  if (url.startsWith('/uploads/')) {
    relativePath = url.substring('/uploads'.length);
  }
  
  // Resolve to full path from root directory
  return path.join(rootDir, relativePath);
}

/**
 * Load or create a URL mapping file
 * @returns {Object} Mapping of filesystem URLs to Object Storage URLs
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
 * @param {Object} mapping - URL mapping object
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
 * @param {number} eventId - Event ID
 * @param {string} field - Field to update (mediaUrl or mediaUrls)
 * @param {string|string[]} newValue - New URL or array of URLs
 * @returns {Promise<boolean>} Success status
 */
async function updateEventMedia(eventId, field, newValue) {
  if (isDryRun) {
    console.log(`[DRY RUN] Would update event ${eventId} ${field} to`, newValue);
    return true;
  }
  
  try {
    // Convert arrays to PostgreSQL array format
    const value = Array.isArray(newValue) ? JSON.stringify(newValue) : newValue;
    
    const queryText = `
      UPDATE events
      SET ${field} = $1
      WHERE id = $2
    `;
    
    await pool.query(queryText, [value, eventId]);
    return true;
  } catch (error) {
    console.error(`Error updating event ${eventId}:`, error);
    return false;
  }
}

/**
 * Upload a file to Replit Object Storage
 * @param {string} filePath - Path to local file
 * @param {string} key - Object key in storage
 * @returns {Promise<string|null>} Object Storage URL or null on failure
 */
async function uploadFileToObjectStorage(filePath, key) {
  if (isDryRun) {
    console.log(`[DRY RUN] Would upload ${filePath} to ${CALENDAR_BUCKET}/${key}`);
    return `https://object-storage.replit.app/${CALENDAR_BUCKET}/${key}`;
  }
  
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return null;
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    const fileExt = path.extname(filePath).toLowerCase();
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
    
    // Try to import the ObjectStorageService
    try {
      // Try importing from our modules directory first
      try {
        // First try the local modules directory using require for CommonJS modules
        const { objectStorageService } = require('./modules/object-storage-service.js');
        console.log(`Uploading ${path.basename(filePath)} to ${CALENDAR_BUCKET}...`);
        
        const url = await objectStorageService.uploadData(
          fileBuffer,
          CALENDAR_BUCKET,
          key,
          contentType
        );
        
        console.log(`✅ Uploaded to ${url}`);
        return url;
      } catch (modulesErr) {
        console.log('Could not import from modules directory, trying source...');
        
        try {
          // Try importing from source
          const { objectStorageService } = await import('../server/object-storage-service.js');
          console.log(`Uploading ${path.basename(filePath)} to ${CALENDAR_BUCKET}...`);
          
          const url = await objectStorageService.uploadData(
            fileBuffer,
            CALENDAR_BUCKET,
            key,
            contentType
          );
          
          console.log(`✅ Uploaded to ${url}`);
          return url;
        } catch (importErr) {
          console.log('Could not import from source, trying dist directory...');
          
          try {
            // Try importing from dist
            const { objectStorageService } = await import('../dist/server/object-storage-service.js');
            console.log(`Uploading ${path.basename(filePath)} to ${CALENDAR_BUCKET}...`);
            
            const url = await objectStorageService.uploadData(
              fileBuffer,
              CALENDAR_BUCKET,
              key,
              contentType
            );
            
            console.log(`✅ Uploaded to ${url}`);
            return url;
          } catch (distErr) {
            console.error('Failed to import object-storage-service:', distErr);
            return null;
          }
        }
      }
    } catch (error) {
      console.error(`Error uploading ${filePath}:`, error);
      return null;
    }
}

/**
 * Process calendar event media URLs
 * @param {Object} event - Event object with mediaUrl and/or mediaUrls
 * @param {Object} mapping - URL mapping object to update
 * @returns {Promise<boolean>} Success status
 */
async function processEventMedia(event, mapping) {
  let updated = false;
  let mediaUrls = [];
  let newMediaUrls = [];
  
  // Process single mediaUrl
  if (event.mediaurl && isCalendarMediaUrl(event.mediaurl)) {
    const url = event.mediaurl;
    const filePath = getLocalPath(url);
    const fileName = path.basename(url);
    const key = `events/${fileName}`;
    
    // Check if already in mapping
    if (mapping[url]) {
      console.log(`URL already mapped: ${url} -> ${mapping[url]}`);
      
      // Update database reference if needed
      if (!event.mediaurl.startsWith('https://object-storage.replit.app/')) {
        await updateEventMedia(event.id, 'mediaUrl', mapping[url]);
        updated = true;
      }
    } else {
      // Upload file to Object Storage
      const objectStorageUrl = await uploadFileToObjectStorage(filePath, key);
      
      if (objectStorageUrl) {
        mapping[url] = objectStorageUrl;
        
        // Update database reference
        await updateEventMedia(event.id, 'mediaUrl', objectStorageUrl);
        updated = true;
      }
    }
  }
  
  // Process mediaUrls array
  if (event.mediaurls && Array.isArray(event.mediaurls)) {
    mediaUrls = event.mediaurls;
    newMediaUrls = [...mediaUrls]; // Clone array for modifications
    
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
    console.error('You can find your token in the Replit Secrets/Environment variables tab.');
    process.exit(1);
  }
  
  // Important: This migration maintains filesystem copies!
  console.log('\n⚠️ IMPORTANT: This migration will preserve all filesystem media');
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

// Run the migration
migrateCalendarMedia().then(() => {
  console.log('Migration script completed.');
  process.exit(0);
}).catch(error => {
  console.error('Unhandled error in migration script:', error);
  process.exit(1);
});