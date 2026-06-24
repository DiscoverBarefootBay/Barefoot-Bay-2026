/**
 * Synchronize calendar event media from production to development environment
 * 
 * This script:
 * 1. Fetches all calendar events from the database
 * 2. Extracts media URLs from those events
 * 3. Downloads the media files from production
 * 4. Saves them to both /calendar and /uploads/calendar folders
 * 
 * Usage:
 * node sync-calendar-media.js
 */

import pkg from 'pg';
const { Pool } = pkg;
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Production domain
const PRODUCTION_DOMAIN = 'https://barefootbay.com';

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Ensure target directories exist
const calendarDir = path.join(__dirname, 'calendar');
const uploadsCalendarDir = path.join(__dirname, 'uploads', 'calendar');

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
  let allUrls = [];
  
  for (const event of events) {
    let mediaUrls = event.media_urls;
    
    // Handle different data formats
    if (typeof mediaUrls === 'string') {
      try {
        mediaUrls = JSON.parse(mediaUrls);
      } catch (e) {
        mediaUrls = [mediaUrls];
      }
    }
    
    // Filter for calendar-specific URLs
    const calendarUrls = mediaUrls.filter(url => 
      url && (
        url.includes('/calendar/') || 
        url.includes('/uploads/calendar/')
      )
    );
    
    if (calendarUrls.length > 0) {
      console.log(`Event ID ${event.id} "${event.title}" has ${calendarUrls.length} calendar media URLs`);
      allUrls = [...allUrls, ...calendarUrls];
    }
  }
  
  // Remove duplicates
  const uniqueUrls = [...new Set(allUrls)];
  console.log(`Found ${uniqueUrls.length} unique calendar media URLs`);
  return uniqueUrls;
}

/**
 * Extract filename from a URL path
 */
function getFilenameFromUrl(url) {
  // Handle different URL formats
  const parts = url.split('/');
  return parts[parts.length - 1];
}

/**
 * Download a file from a URL to a local path
 */
async function downloadFile(url, localPath) {
  try {
    // Handle relative URLs by adding production domain
    const fullUrl = url.startsWith('http') ? url : `${PRODUCTION_DOMAIN}${url}`;
    
    console.log(`Downloading: ${fullUrl}`);
    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download ${fullUrl}: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    fs.writeFileSync(localPath, buffer);
    console.log(`Saved to: ${localPath}`);
    return true;
  } catch (error) {
    console.error(`Error downloading ${url}:`, error.message);
    return false;
  }
}

/**
 * Sync all calendar media files
 */
async function syncCalendarMedia() {
  try {
    // Get events with media
    const events = await getCalendarEventsWithMedia();
    
    // Extract media URLs
    const mediaUrls = extractMediaUrls(events);
    
    // Download each media file
    let successCount = 0;
    let errorCount = 0;
    
    for (const url of mediaUrls) {
      const filename = getFilenameFromUrl(url);
      
      // Skip if filename is empty or contains invalid characters
      if (!filename || filename.includes('?') || filename.includes('#')) {
        console.warn(`Skipping invalid filename: ${url}`);
        errorCount++;
        continue;
      }
      
      // Save to both locations
      const calendarPath = path.join(calendarDir, filename);
      const uploadsCalendarPath = path.join(uploadsCalendarDir, filename);
      
      // Only download once and then copy
      const success = await downloadFile(url, calendarPath);
      
      if (success) {
        // Copy to uploads/calendar
        try {
          fs.copyFileSync(calendarPath, uploadsCalendarPath);
          console.log(`Copied to: ${uploadsCalendarPath}`);
          successCount++;
        } catch (copyError) {
          console.error(`Error copying to uploads/calendar: ${copyError.message}`);
          errorCount++;
        }
      } else {
        errorCount++;
      }
    }
    
    console.log("\nSync completed:");
    console.log(`- ${successCount} files successfully downloaded and copied`);
    console.log(`- ${errorCount} files failed`);
    console.log(`- ${mediaUrls.length} total files processed`);
    
  } catch (error) {
    console.error("Error during calendar media sync:", error);
  } finally {
    // Close the database connection
    await pool.end();
    console.log("Database connection closed");
  }
}

// Run the sync process
syncCalendarMedia();