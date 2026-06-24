/**
 * Migrate Event Media to Object Storage
 * 
 * This script migrates existing calendar event media files from the filesystem
 * to Replit Object Storage, updating the database records with the new URLs.
 * 
 * Usage: node scripts/migrate-event-media-to-object-storage.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { pool } = require('../dist/server/db');
const { Client } = require('@replit/object-storage');
const readFileAsync = promisify(fs.readFile);
const readDirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

// Configuration
const CALENDAR_BUCKET = 'CALENDAR';
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'calendar');
const MEDIA_DIR = path.join(__dirname, '..', 'media');
const CALENDAR_DIR = path.join(__dirname, '..', 'calendar');
const DRY_RUN = false; // Set to true to test without actually modifying anything

// Replit Object Storage client
const objectStorage = new Client();

// Track migration progress
const migrationStats = {
  scanned: 0,
  uploaded: 0,
  failed: 0,
  skipped: 0,
  eventUpdates: 0
};

// Helper function to check if a file has already been migrated to Object Storage
async function checkFileExistsInObjectStorage(filename) {
  try {
    const storageKey = `events/${path.basename(filename)}`;
    const bucketName = CALENDAR_BUCKET;
    const exists = await objectStorage.exists(storageKey, bucketName);
    return exists;
  } catch (error) {
    console.error(`Error checking file in Object Storage: ${filename}`, error);
    return false;
  }
}

// Upload a file to Object Storage
async function uploadFileToObjectStorage(filepath, filename) {
  try {
    const fileContent = await readFileAsync(filepath);
    const storageKey = `events/${path.basename(filename)}`;
    const bucketName = CALENDAR_BUCKET;
    
    // For uploads, we want to ensure a unique name to avoid conflicts
    // (In the actual implementation, we'd normally generate a unique name)
    
    if (DRY_RUN) {
      console.log(`[DRY RUN] Would upload ${filepath} to ${bucketName}/${storageKey}`);
      return {
        success: true,
        url: `/api/storage-proxy/${bucketName}/${storageKey}`,
        key: storageKey,
        bucket: bucketName
      };
    }
    
    // Upload the file to Object Storage
    await objectStorage.put(storageKey, fileContent, {
      bucket: bucketName
    });
    
    // Return a success result with the proxy URL format
    return {
      success: true,
      url: `/api/storage-proxy/${bucketName}/${storageKey}`,
      key: storageKey,
      bucket: bucketName
    };
  } catch (error) {
    console.error(`Error uploading file to Object Storage: ${filepath}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Get all calendar event media files from filesystem
async function scanForEventMediaFiles() {
  const allFiles = [];
  
  // Helper function to scan a directory
  async function scanDirectory(directory) {
    try {
      if (!fs.existsSync(directory)) {
        console.log(`Directory does not exist: ${directory}`);
        return;
      }
      
      const files = await readDirAsync(directory);
      
      for (const file of files) {
        const fullPath = path.join(directory, file);
        const stats = await statAsync(fullPath);
        
        if (stats.isDirectory()) {
          // Recursively scan subdirectories
          await scanDirectory(fullPath);
        } else {
          // Add the file to our list with its complete path
          // Only include media files (images, etc.)
          const ext = path.extname(file).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
            allFiles.push({
              path: fullPath,
              filename: file,
              directory: directory
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${directory}:`, error);
    }
  }
  
  // Scan all possible calendar media directories
  await scanDirectory(UPLOADS_DIR);
  await scanDirectory(MEDIA_DIR);
  await scanDirectory(CALENDAR_DIR);
  
  return allFiles;
}

// Get all events with media from the database
async function getEventsWithMedia() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, title, "mediaUrl" FROM events WHERE "mediaUrl" IS NOT NULL AND "mediaUrl" != ''`
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching events with media:', error);
    return [];
  } finally {
    client.release();
  }
}

// Update an event's media URL in the database
async function updateEventMediaUrl(eventId, newMediaUrl) {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would update event ${eventId} with new media URL: ${newMediaUrl}`);
    return true;
  }
  
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE events SET "mediaUrl" = $1 WHERE id = $2`,
      [newMediaUrl, eventId]
    );
    return true;
  } catch (error) {
    console.error(`Error updating event ${eventId} with new media URL:`, error);
    return false;
  } finally {
    client.release();
  }
}

// The main migration function
async function migrateEventMedia() {
  console.log('Starting migration of event media to Object Storage...');
  
  // Get all events with media from the database
  const eventsWithMedia = await getEventsWithMedia();
  console.log(`Found ${eventsWithMedia.length} events with media URLs`);
  
  // Scan for all media files in various directories
  const mediaFiles = await scanForEventMediaFiles();
  console.log(`Found ${mediaFiles.length} media files in filesystem`);
  
  migrationStats.scanned = mediaFiles.length;
  
  // Process each event with media
  for (const event of eventsWithMedia) {
    console.log(`\nProcessing event ${event.id}: ${event.title}`);
    console.log(`Current media URL: ${event.mediaUrl}`);
    
    // Skip if the URL is already in the Object Storage proxy format
    if (event.mediaUrl && event.mediaUrl.startsWith('/api/storage-proxy/')) {
      console.log('Event already uses Object Storage URL, skipping');
      migrationStats.skipped++;
      continue;
    }
    
    // Try to find the file in our scanned files based on the URL pattern
    const mediaUrl = event.mediaUrl;
    if (!mediaUrl) {
      console.log('Empty media URL, skipping');
      migrationStats.skipped++;
      continue;
    }
    
    // Extract the filename from the URL
    let filename = path.basename(mediaUrl);
    
    // Look for matching files in our scanned list
    const matchingFiles = mediaFiles.filter(file => 
      file.filename === filename || file.path.includes(filename)
    );
    
    if (matchingFiles.length === 0) {
      console.log(`No matching file found for URL: ${mediaUrl}`);
      migrationStats.skipped++;
      continue;
    }
    
    // Use the first matching file
    const fileToMigrate = matchingFiles[0];
    console.log(`Found matching file: ${fileToMigrate.path}`);
    
    // Check if already in Object Storage
    const fileAlreadyMigrated = await checkFileExistsInObjectStorage(fileToMigrate.filename);
    if (fileAlreadyMigrated) {
      console.log('File already exists in Object Storage');
      
      // Update the event with the new URL format
      const newUrl = `/api/storage-proxy/${CALENDAR_BUCKET}/events/${path.basename(fileToMigrate.filename)}`;
      const updated = await updateEventMediaUrl(event.id, newUrl);
      
      if (updated) {
        console.log(`Updated event ${event.id} with new media URL: ${newUrl}`);
        migrationStats.eventUpdates++;
      }
      
      migrationStats.skipped++;
      continue;
    }
    
    // Upload to Object Storage
    console.log(`Uploading ${fileToMigrate.path} to Object Storage...`);
    const uploadResult = await uploadFileToObjectStorage(fileToMigrate.path, fileToMigrate.filename);
    
    if (uploadResult.success) {
      console.log(`Successfully uploaded to Object Storage: ${uploadResult.url}`);
      migrationStats.uploaded++;
      
      // Update the event with the new URL
      const updated = await updateEventMediaUrl(event.id, uploadResult.url);
      
      if (updated) {
        console.log(`Updated event ${event.id} with new media URL: ${uploadResult.url}`);
        migrationStats.eventUpdates++;
      }
    } else {
      console.error(`Failed to upload to Object Storage: ${uploadResult.error}`);
      migrationStats.failed++;
    }
  }
  
  return migrationStats;
}

// Execute the migration
async function main() {
  console.log(`${DRY_RUN ? '[DRY RUN]' : ''} Event Media Migration to Object Storage`);
  
  try {
    const stats = await migrateEventMedia();
    
    console.log('\n============== MIGRATION SUMMARY ==============');
    console.log(`Total files scanned: ${stats.scanned}`);
    console.log(`Files uploaded: ${stats.uploaded}`);
    console.log(`Files skipped (already migrated): ${stats.skipped}`);
    console.log(`Upload failures: ${stats.failed}`);
    console.log(`Events updated: ${stats.eventUpdates}`);
    console.log('===============================================');
    
    if (DRY_RUN) {
      console.log('\nThis was a DRY RUN. No changes were made.');
      console.log('Set DRY_RUN = false to perform the actual migration.');
    }
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    // Close the database pool
    await pool.end();
    process.exit(0);
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  main();
}