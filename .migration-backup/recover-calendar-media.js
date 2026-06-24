/**
 * Script to recover missing calendar media files by:
 * 1. Analyzing the database for missing calendar media URLs
 * 2. Finding the closest matching files in the attached_assets directory
 * 3. Copying these files to both /uploads/calendar/ and /calendar/ paths
 * 4. Optionally updating database references if needed
 * 
 * This specifically looks for images in attached_assets that might match the missing files
 * based on timestamp similarity.
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

// Define the directories
const calendarDir = path.join(process.cwd(), 'calendar');
const uploadsCalendarDir = path.join(process.cwd(), 'uploads', 'calendar');
const attachedAssetsDir = path.join(process.cwd(), 'attached_assets');

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
 * Extract all missing calendar media files
 */
function findMissingMedia(events) {
  const mediaUrls = new Set();
  
  // Collect all media URLs
  events.forEach(event => {
    if (event.media_urls && Array.isArray(event.media_urls)) {
      event.media_urls.forEach(url => {
        if (url) {
          mediaUrls.add(url);
        }
      });
    }
  });
  
  // Filter to only keep the missing ones
  const missingMedia = [];
  
  for (const url of mediaUrls) {
    // Extract the filename
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    
    // Check if file exists in both locations
    const uploadsPath = path.join(uploadsCalendarDir, filename);
    const prodPath = path.join(calendarDir, filename);
    
    if (!fs.existsSync(uploadsPath) && !fs.existsSync(prodPath)) {
      missingMedia.push({
        url,
        filename,
        timestamp: extractTimestamp(filename)
      });
    }
  }
  
  return missingMedia;
}

/**
 * Extract timestamp from a media file name (if present)
 */
function extractTimestamp(filename) {
  // Pattern: media-1745767469558-347108879.png
  const matches = filename.match(/media-(\d+)-/);
  if (matches && matches[1]) {
    return parseInt(matches[1], 10);
  }
  return null;
}

/**
 * Find all image files in attached_assets with timestamps
 */
function getAttachedAssets() {
  try {
    const files = fs.readdirSync(attachedAssetsDir);
    
    return files
      .filter(file => file.match(/\.(png|jpg|jpeg|gif)$/i)) // Only images
      .map(file => {
        // Extract timestamp from format: image_1745767396969.png
        const matches = file.match(/image_(\d+)\./);
        const timestamp = matches && matches[1] ? parseInt(matches[1], 10) : null;
        
        return {
          filename: file,
          path: path.join(attachedAssetsDir, file),
          timestamp
        };
      })
      .filter(file => file.timestamp !== null); // Only files with valid timestamps
  } catch (error) {
    console.error(`Error reading attached_assets directory:`, error);
    return [];
  }
}

/**
 * Match missing media files with attached assets based on timestamp similarity
 */
function matchMediaFiles(missingMedia, attachedAssets) {
  // Array to hold matches
  const matches = [];
  
  for (const missing of missingMedia) {
    if (!missing.timestamp) continue;
    
    // Find the closest attachment by timestamp
    let bestMatch = null;
    let smallestDiff = Infinity;
    
    for (const asset of attachedAssets) {
      if (!asset.timestamp) continue;
      
      const diff = Math.abs(missing.timestamp - asset.timestamp);
      
      // If this is the closest match so far
      if (diff < smallestDiff) {
        smallestDiff = diff;
        bestMatch = asset;
      }
    }
    
    // If we found a match that's close enough (within 5 seconds)
    if (bestMatch && smallestDiff < 5000) {
      matches.push({
        missing,
        asset: bestMatch,
        difference: smallestDiff
      });
    }
  }
  
  return matches;
}

/**
 * Copy a matched asset to both calendar media locations
 */
function recoverFile(match) {
  try {
    const { missing, asset } = match;
    
    // Create target file paths
    const uploadsPath = path.join(uploadsCalendarDir, missing.filename);
    const prodPath = path.join(calendarDir, missing.filename);
    
    // Copy the asset to both locations
    fs.copyFileSync(asset.path, uploadsPath);
    fs.copyFileSync(asset.path, prodPath);
    
    console.log(`Recovered ${missing.filename} from ${asset.filename} (time diff: ${match.difference}ms)`);
    return true;
  } catch (error) {
    console.error(`Error recovering file:`, error);
    return false;
  }
}

/**
 * Create default media files for standard event types
 */
function createDefaultEventImages() {
  const defaultImages = [
    'community-event.jpg',
    'sports-event.jpg',
    'social-event.jpg',
    'arts-event.jpg',
    'special-event.jpg'
  ];
  
  let createdCount = 0;
  
  // Specifically mentioned in logs as missing
  for (const filename of defaultImages) {
    // Create paths for both locations
    const uploadsPath = path.join(uploadsCalendarDir, filename);
    const prodPath = path.join(calendarDir, filename);
    
    // Only create if missing
    if (!fs.existsSync(uploadsPath) || !fs.existsSync(prodPath)) {
      // Find a suitable image from attached_assets
      const attachedAssets = fs.readdirSync(attachedAssetsDir);
      
      // Try to match based on type
      let sourceFile = null;
      
      if (filename.includes('sports')) {
        sourceFile = attachedAssets.find(file => 
          file.toLowerCase().includes('sport') || 
          file.toLowerCase().includes('tennis') || 
          file.toLowerCase().includes('golf')
        );
      } else if (filename.includes('arts')) {
        sourceFile = attachedAssets.find(file => 
          file.toLowerCase().includes('art') || 
          file.toLowerCase().includes('music') || 
          file.toLowerCase().includes('theater')
        );
      } else if (filename.includes('social')) {
        sourceFile = attachedAssets.find(file => 
          file.toLowerCase().includes('social') || 
          file.toLowerCase().includes('party') || 
          file.toLowerCase().includes('gathering')
        );
      } else if (filename.includes('community')) {
        sourceFile = attachedAssets.find(file => 
          file.toLowerCase().includes('community') || 
          file.toLowerCase().includes('meeting') || 
          file.toLowerCase().includes('group')
        );
      } else {
        // Use any available image
        sourceFile = attachedAssets.find(file => 
          file.match(/\.(jpg|jpeg|png)$/i)
        );
      }
      
      // If we found a suitable file, use it
      if (sourceFile) {
        try {
          const sourcePath = path.join(attachedAssetsDir, sourceFile);
          
          // Create both copies
          fs.copyFileSync(sourcePath, uploadsPath);
          fs.copyFileSync(sourcePath, prodPath);
          
          console.log(`Created default event image ${filename} using ${sourceFile}`);
          createdCount++;
        } catch (error) {
          console.error(`Error creating default image ${filename}:`, error);
        }
      } else {
        console.log(`No suitable source image found for ${filename}`);
      }
    }
  }
  
  return createdCount;
}

/**
 * Explicitly recover the specifically problematic media file
 */
function recoverProblematicFile() {
  const problematicFile = 'media-1745767469558-347108879.png';
  const sourceOptions = [
    'image_1745767396969.png',
    'image_1745767403893.png'
  ];
  
  // Target paths
  const uploadsPath = path.join(uploadsCalendarDir, problematicFile);
  const prodPath = path.join(calendarDir, problematicFile);
  
  // Check if already exists
  if (fs.existsSync(uploadsPath) && fs.existsSync(prodPath)) {
    console.log(`Problematic file ${problematicFile} already exists`);
    return true;
  }
  
  // Try each source option
  for (const sourceFile of sourceOptions) {
    const sourcePath = path.join(attachedAssetsDir, sourceFile);
    
    if (fs.existsSync(sourcePath)) {
      try {
        // Create both copies
        fs.copyFileSync(sourcePath, uploadsPath);
        fs.copyFileSync(sourcePath, prodPath);
        
        console.log(`Recovered problematic file ${problematicFile} using ${sourceFile}`);
        return true;
      } catch (error) {
        console.error(`Error recovering problematic file:`, error);
      }
    }
  }
  
  console.error(`Could not recover problematic file ${problematicFile}`);
  return false;
}

/**
 * Main function to recover missing calendar media
 */
async function recoverCalendarMedia() {
  console.log("Starting calendar media recovery...");
  
  // 1. Recover the specific problematic file
  recoverProblematicFile();
  
  // 2. Create standard event type images
  const defaultImagesCreated = createDefaultEventImages();
  
  // 3. Get all events with media
  const events = await getCalendarEventsWithMedia();
  
  // 4. Find missing media files
  const missingMedia = findMissingMedia(events);
  console.log(`Found ${missingMedia.length} missing media files`);
  
  // 5. Get all attached assets with timestamps
  const attachedAssets = getAttachedAssets();
  console.log(`Found ${attachedAssets.length} attached assets with timestamps`);
  
  // 6. Match missing files with attached assets
  const matches = matchMediaFiles(missingMedia, attachedAssets);
  console.log(`Found ${matches.length} potential matches`);
  
  // 7. Recover files
  let recoveredCount = 0;
  for (const match of matches) {
    if (recoverFile(match)) {
      recoveredCount++;
    }
  }
  
  // 8. Print summary
  console.log("\n=== Calendar Media Recovery Summary ===");
  console.log(`Total missing media files: ${missingMedia.length}`);
  console.log(`Matched with attached assets: ${matches.length}`);
  console.log(`Successfully recovered: ${recoveredCount}`);
  console.log(`Default event images created: ${defaultImagesCreated}`);
  console.log(`Problematic file recovered: ${fs.existsSync(path.join(calendarDir, 'media-1745767469558-347108879.png'))}`);
  
  // 9. List remaining missing files
  const remainingMissing = missingMedia.filter(missing => {
    return !matches.some(match => match.missing.filename === missing.filename);
  });
  
  if (remainingMissing.length > 0) {
    console.log("\nRemaining missing files:");
    remainingMissing.forEach(file => {
      console.log(`- ${file.filename}`);
    });
  }
  
  return {
    totalMissing: missingMedia.length,
    matched: matches.length,
    recovered: recoveredCount,
    defaultImagesCreated,
    remainingMissing: remainingMissing.length
  };
}

// Run the main function
recoverCalendarMedia()
  .then(() => {
    console.log("\nCalendar media recovery completed");
    // Close the database connection
    pool.end();
  })
  .catch(error => {
    console.error("Error in recoverCalendarMedia:", error);
    pool.end();
    process.exit(1);
  });