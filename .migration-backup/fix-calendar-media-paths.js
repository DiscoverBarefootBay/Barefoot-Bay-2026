/**
 * Script to fix calendar media paths by ensuring all calendar media files
 * exist in both /uploads/calendar/ and /calendar/ locations
 * 
 * This script:
 * 1. Scans the database for all calendar event media URLs
 * 2. Ensures each media file exists in both locations
 * 3. Copies missing files to their alternate location
 * 4. Outputs a report of the fixed files
 * 
 * Usage:
 * node fix-calendar-media-paths.js
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Initialize environment variables
dotenv.config();

// Get the dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extract Pool from pg
const { Pool } = pg;

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Define the directories to check and fix
const calendarDir = path.join(process.cwd(), 'calendar');
const uploadsCalendarDir = path.join(process.cwd(), 'uploads', 'calendar');

// Create directories if they don't exist
[calendarDir, uploadsCalendarDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

/**
 * Get all calendar events with media URLs from the database
 */
async function getCalendarEventsWithMedia() {
  console.log("Fetching all calendar events with media...");
  const query = `
    SELECT id, title, media_urls 
    FROM events 
    WHERE media_urls IS NOT NULL AND array_length(media_urls, 1) > 0;
  `;
  
  try {
    const result = await pool.query(query);
    console.log(`Found ${result.rows.length} events with media URLs`);
    return result.rows;
  } catch (error) {
    console.error("Error fetching events:", error);
    return [];
  }
}

/**
 * Extract all calendar media URLs from events
 */
function extractMediaUrls(events) {
  const mediaUrls = new Set();
  
  events.forEach(event => {
    if (event.media_urls && Array.isArray(event.media_urls)) {
      event.media_urls.forEach(url => {
        if (url) {
          mediaUrls.add(url);
        }
      });
    }
  });
  
  return Array.from(mediaUrls);
}

/**
 * Extract filename from a media URL
 */
function extractFilename(url) {
  if (!url) return null;
  
  // Handle both /uploads/calendar/file.jpg and /calendar/file.jpg formats
  const parts = url.split('/');
  return parts[parts.length - 1];
}

/**
 * Check if file exists in both locations and synchronize if needed
 * @returns {Object} Status of the synchronization
 */
function synchronizeFile(filename) {
  if (!filename) {
    return { success: false, error: 'Invalid filename' };
  }
  
  const uploadsPath = path.join(uploadsCalendarDir, filename);
  const prodPath = path.join(calendarDir, filename);
  
  // Check which copies exist
  const uploadsExists = fs.existsSync(uploadsPath);
  const prodExists = fs.existsSync(prodPath);
  
  console.log(`Checking ${filename}: uploads=${uploadsExists}, prod=${prodExists}`);
  
  if (uploadsExists && !prodExists) {
    try {
      // Copy from uploads to prod
      fs.copyFileSync(uploadsPath, prodPath);
      console.log(`Copied ${filename} from uploads to production location`);
      return { 
        success: true, 
        action: 'copied_to_prod',
        source: uploadsPath,
        destination: prodPath 
      };
    } catch (error) {
      console.error(`Error copying ${filename} to production:`, error);
      return { 
        success: false, 
        error: error.message,
        source: uploadsPath, 
        destination: prodPath 
      };
    }
  } else if (!uploadsExists && prodExists) {
    try {
      // Copy from prod to uploads
      fs.copyFileSync(prodPath, uploadsPath);
      console.log(`Copied ${filename} from production to uploads location`);
      return { 
        success: true, 
        action: 'copied_to_uploads',
        source: prodPath,
        destination: uploadsPath 
      };
    } catch (error) {
      console.error(`Error copying ${filename} to uploads:`, error);
      return { 
        success: false, 
        error: error.message,
        source: prodPath, 
        destination: uploadsPath 
      };
    }
  } else if (!uploadsExists && !prodExists) {
    // File missing from both locations
    return { 
      success: false, 
      action: 'missing',
      error: 'File not found in either location'
    };
  } else {
    // File exists in both locations, check if they're identical
    try {
      const uploadsStat = fs.statSync(uploadsPath);
      const prodStat = fs.statSync(prodPath);
      
      if (uploadsStat.size !== prodStat.size) {
        // Files have different sizes, use the newer one as source
        if (uploadsStat.mtime > prodStat.mtime) {
          fs.copyFileSync(uploadsPath, prodPath);
          console.log(`Updated production copy of ${filename} with newer uploads version`);
          return { 
            success: true, 
            action: 'updated_prod',
            source: uploadsPath,
            destination: prodPath 
          };
        } else {
          fs.copyFileSync(prodPath, uploadsPath);
          console.log(`Updated uploads copy of ${filename} with newer production version`);
          return { 
            success: true, 
            action: 'updated_uploads',
            source: prodPath,
            destination: uploadsPath 
          };
        }
      }
      
      // Files are identical
      return { 
        success: true, 
        action: 'already_synced'
      };
    } catch (error) {
      console.error(`Error comparing ${filename} between locations:`, error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}

/**
 * Look for missing files in other media directories
 */
async function findMissingFiles(missingFiles) {
  console.log(`Searching for ${missingFiles.length} missing files in other directories...`);
  
  const recoveredFiles = [];
  const possibleDirectories = [
    'uploads',
    'uploads/media',
    'media',
    'uploads/forum-media',
    'forum-media',
    'uploads/vendor-media',
    'vendor-media',
    'uploads/content-media',
    'content-media',
    'uploads/real-estate-media',
    'real-estate-media',
    'attached_assets'
  ];
  
  for (const filename of missingFiles) {
    let found = false;
    
    for (const dir of possibleDirectories) {
      const potentialPath = path.join(process.cwd(), dir, filename);
      
      if (fs.existsSync(potentialPath)) {
        console.log(`Found missing file ${filename} in ${dir}`);
        
        // Copy to both calendar locations
        const uploadsPath = path.join(uploadsCalendarDir, filename);
        const prodPath = path.join(calendarDir, filename);
        
        try {
          fs.copyFileSync(potentialPath, uploadsPath);
          fs.copyFileSync(potentialPath, prodPath);
          
          console.log(`Recovered file ${filename} to both calendar locations`);
          recoveredFiles.push({
            filename,
            foundIn: dir,
            success: true
          });
          
          found = true;
          break;
        } catch (error) {
          console.error(`Error recovering ${filename}:`, error);
        }
      }
    }
    
    if (!found) {
      console.log(`Could not find ${filename} in any location`);
    }
  }
  
  return recoveredFiles;
}

/**
 * Main function to process and fix all calendar media
 */
async function fixCalendarMedia() {
  console.log("Starting calendar media path fix...");
  
  // Get all events with media
  const events = await getCalendarEventsWithMedia();
  
  // Extract all media URLs
  const mediaUrls = extractMediaUrls(events);
  console.log(`Found ${mediaUrls.length} unique media URLs`);
  
  // Process each URL
  const results = {
    total: mediaUrls.length,
    synced: 0,
    missing: [],
    errors: [],
    actions: {
      copied_to_prod: 0,
      copied_to_uploads: 0,
      updated_prod: 0,
      updated_uploads: 0,
      already_synced: 0,
      recovered: 0
    }
  };
  
  for (const url of mediaUrls) {
    const filename = extractFilename(url);
    
    if (!filename) {
      console.error(`Could not extract filename from URL: ${url}`);
      results.errors.push({ url, error: 'Could not extract filename' });
      continue;
    }
    
    const syncResult = synchronizeFile(filename);
    
    if (syncResult.success) {
      results.synced++;
      results.actions[syncResult.action]++;
    } else {
      console.error(`Failed to synchronize ${filename}:`, syncResult.error);
      
      if (syncResult.action === 'missing') {
        results.missing.push(filename);
      } else {
        results.errors.push({ 
          filename, 
          url, 
          error: syncResult.error 
        });
      }
    }
  }
  
  // Try to recover missing files
  if (results.missing.length > 0) {
    console.log(`Attempting to recover ${results.missing.length} missing files...`);
    const recoveredFiles = await findMissingFiles(results.missing);
    
    results.actions.recovered = recoveredFiles.length;
    results.synced += recoveredFiles.length;
    
    // Update missing files list
    const recoveredFilenames = recoveredFiles.map(f => f.filename);
    results.missing = results.missing.filter(f => !recoveredFilenames.includes(f));
  }
  
  // Print summary
  console.log("\n=== Calendar Media Fix Summary ===");
  console.log(`Total media URLs processed: ${results.total}`);
  console.log(`Successfully synchronized: ${results.synced}`);
  console.log(`Missing files: ${results.missing.length}`);
  console.log(`Errors: ${results.errors.length}`);
  console.log("\nActions performed:");
  console.log(`- Copied from uploads to production: ${results.actions.copied_to_prod}`);
  console.log(`- Copied from production to uploads: ${results.actions.copied_to_uploads}`);
  console.log(`- Updated production with newer uploads version: ${results.actions.updated_prod}`);
  console.log(`- Updated uploads with newer production version: ${results.actions.updated_uploads}`);
  console.log(`- Already synced (no action needed): ${results.actions.already_synced}`);
  console.log(`- Recovered from other directories: ${results.actions.recovered}`);
  
  // List missing files
  if (results.missing.length > 0) {
    console.log("\nMissing files that could not be recovered:");
    results.missing.forEach(filename => {
      console.log(`- ${filename}`);
    });
  }
  
  // List errors
  if (results.errors.length > 0) {
    console.log("\nErrors encountered:");
    results.errors.forEach(err => {
      console.log(`- ${err.filename || err.url}: ${err.error}`);
    });
  }
  
  return results;
}

// Run the main function
fixCalendarMedia()
  .then(() => {
    console.log("\nCalendar media fix completed");
    // Close the database connection
    pool.end();
  })
  .catch(error => {
    console.error("Error in fixCalendarMedia:", error);
    pool.end();
    process.exit(1);
  });