/**
 * Script to create placeholder images for missing calendar media files
 * 
 * This script:
 * 1. Identifies remaining missing calendar media files
 * 2. Creates placeholder images with appropriate filenames
 * 3. Copies these files to both /uploads/calendar/ and /calendar/ paths
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
    
    if (!fs.existsSync(uploadsPath) || !fs.existsSync(prodPath)) {
      missingMedia.push({
        url,
        filename,
        fileType: path.extname(filename).toLowerCase()
      });
    }
  }
  
  return missingMedia;
}

/**
 * Find a suitable source image to use as a placeholder
 */
function findSourceImage(fileType) {
  // We'll prioritize files with matching extension
  try {
    const files = fs.readdirSync(attachedAssetsDir);
    
    // Filter by the correct file extension
    const matchingFiles = files.filter(file => 
      path.extname(file).toLowerCase() === fileType
    );
    
    if (matchingFiles.length > 0) {
      // Return a random file from the matches
      const randomIndex = Math.floor(Math.random() * matchingFiles.length);
      return path.join(attachedAssetsDir, matchingFiles[randomIndex]);
    }
    
    // If no matching extension, return any image file
    const imageFiles = files.filter(file => 
      ['.jpg', '.jpeg', '.png', '.gif'].includes(path.extname(file).toLowerCase())
    );
    
    if (imageFiles.length > 0) {
      // Return a random image file
      const randomIndex = Math.floor(Math.random() * imageFiles.length);
      return path.join(attachedAssetsDir, imageFiles[randomIndex]);
    }
    
    // No suitable image found
    return null;
  } catch (error) {
    console.error(`Error finding source image:`, error);
    return null;
  }
}

/**
 * Create a placeholder image for a missing file
 */
function createPlaceholder(missingFile) {
  try {
    console.log(`Creating placeholder for ${missingFile.filename}`);
    
    // Create target file paths
    const uploadsPath = path.join(uploadsCalendarDir, missingFile.filename);
    const prodPath = path.join(calendarDir, missingFile.filename);
    
    // Skip if file already exists in both locations
    if (fs.existsSync(uploadsPath) && fs.existsSync(prodPath)) {
      console.log(`File ${missingFile.filename} already exists in both locations`);
      return true;
    }
    
    // Find a suitable source image
    const sourcePath = findSourceImage(missingFile.fileType);
    
    if (!sourcePath) {
      console.error(`Could not find a suitable source image for ${missingFile.filename}`);
      return false;
    }
    
    // Create the placeholder in both locations
    if (!fs.existsSync(uploadsPath)) {
      fs.copyFileSync(sourcePath, uploadsPath);
    }
    
    if (!fs.existsSync(prodPath)) {
      fs.copyFileSync(sourcePath, prodPath);
    }
    
    console.log(`Created placeholder for ${missingFile.filename} using ${path.basename(sourcePath)}`);
    return true;
  } catch (error) {
    console.error(`Error creating placeholder for ${missingFile.filename}:`, error);
    return false;
  }
}

/**
 * Create placeholder images for all specified event types
 */
function createEventTypePlaceholders() {
  const eventTypes = [
    { filename: 'sports-event.jpg', keywords: ['sport', 'tennis', 'golf'] },
    { filename: 'social-event.jpg', keywords: ['social', 'party', 'gathering'] },
    { filename: 'community-event.jpg', keywords: ['community', 'meeting'] },
    { filename: 'arts-event.jpg', keywords: ['art', 'music', 'theater'] },
    { filename: 'special-event.jpg', keywords: ['special', 'event'] }
  ];
  
  let createdCount = 0;
  
  // Try to create each event type placeholder
  for (const eventType of eventTypes) {
    const uploadsPath = path.join(uploadsCalendarDir, eventType.filename);
    const prodPath = path.join(calendarDir, eventType.filename);
    
    // Skip if already exists in both locations
    if (fs.existsSync(uploadsPath) && fs.existsSync(prodPath)) {
      console.log(`Event type placeholder ${eventType.filename} already exists`);
      continue;
    }
    
    // Try to find an image that matches keywords
    let sourcePath = null;
    try {
      const files = fs.readdirSync(attachedAssetsDir);
      
      // Try to find a matching file based on keywords
      for (const keyword of eventType.keywords) {
        const matchingFile = files.find(file => 
          file.toLowerCase().includes(keyword) && 
          ['.jpg', '.jpeg', '.png', '.gif'].includes(path.extname(file).toLowerCase())
        );
        
        if (matchingFile) {
          sourcePath = path.join(attachedAssetsDir, matchingFile);
          break;
        }
      }
      
      // If no keyword match, use any image
      if (!sourcePath) {
        const imageFiles = files.filter(file => 
          ['.jpg', '.jpeg', '.png', '.gif'].includes(path.extname(file).toLowerCase())
        );
        
        if (imageFiles.length > 0) {
          // Use a random image
          const randomIndex = Math.floor(Math.random() * imageFiles.length);
          sourcePath = path.join(attachedAssetsDir, imageFiles[randomIndex]);
        }
      }
      
      // Create the placeholders
      if (sourcePath) {
        if (!fs.existsSync(uploadsPath)) {
          fs.copyFileSync(sourcePath, uploadsPath);
        }
        
        if (!fs.existsSync(prodPath)) {
          fs.copyFileSync(sourcePath, prodPath);
        }
        
        console.log(`Created event type placeholder ${eventType.filename} using ${path.basename(sourcePath)}`);
        createdCount++;
      } else {
        console.error(`Could not find a suitable source image for ${eventType.filename}`);
      }
    } catch (error) {
      console.error(`Error creating event type placeholder ${eventType.filename}:`, error);
    }
  }
  
  return createdCount;
}

/**
 * Create placeholders for specific video files
 */
function createVideoPlaceholders() {
  const videoExtensions = ['.mp4', '.webm', '.mov'];
  const createdFiles = [];
  
  // Find missing video files
  fs.readdirSync(calendarDir).forEach(filename => {
    if (videoExtensions.includes(path.extname(filename).toLowerCase())) {
      const uploadsPath = path.join(uploadsCalendarDir, filename);
      if (!fs.existsSync(uploadsPath)) {
        const prodPath = path.join(calendarDir, filename);
        try {
          fs.copyFileSync(prodPath, uploadsPath);
          console.log(`Copied video file from production to uploads: ${filename}`);
          createdFiles.push(filename);
        } catch (error) {
          console.error(`Error copying video file ${filename}:`, error);
        }
      }
    }
  });
  
  fs.readdirSync(uploadsCalendarDir).forEach(filename => {
    if (videoExtensions.includes(path.extname(filename).toLowerCase())) {
      const prodPath = path.join(calendarDir, filename);
      if (!fs.existsSync(prodPath)) {
        const uploadsPath = path.join(uploadsCalendarDir, filename);
        try {
          fs.copyFileSync(uploadsPath, prodPath);
          console.log(`Copied video file from uploads to production: ${filename}`);
          createdFiles.push(filename);
        } catch (error) {
          console.error(`Error copying video file ${filename}:`, error);
        }
      }
    }
  });
  
  return createdFiles.length;
}

/**
 * Attempt to recover the specific problematic file from the previous run
 */
function checkProblematicFile() {
  const problematicFile = 'media-1745767469558-347108879.png';
  
  // Check if the file now exists in both locations
  const uploadsPath = path.join(uploadsCalendarDir, problematicFile);
  const prodPath = path.join(calendarDir, problematicFile);
  
  const uploadsExists = fs.existsSync(uploadsPath);
  const prodExists = fs.existsSync(prodPath);
  
  // If file exists in one location but not the other, sync them
  if (uploadsExists && !prodExists) {
    try {
      fs.copyFileSync(uploadsPath, prodPath);
      console.log(`Synced problematic file from uploads to production`);
      return true;
    } catch (error) {
      console.error(`Error syncing problematic file to production:`, error);
      return false;
    }
  } else if (!uploadsExists && prodExists) {
    try {
      fs.copyFileSync(prodPath, uploadsPath);
      console.log(`Synced problematic file from production to uploads`);
      return true;
    } catch (error) {
      console.error(`Error syncing problematic file to uploads:`, error);
      return false;
    }
  } else if (!uploadsExists && !prodExists) {
    // If file doesn't exist in either location, try to create it
    console.log(`Problematic file is still missing, attempting to create it`);
    
    // Find a suitable source image from attached_assets
    try {
      const files = fs.readdirSync(attachedAssetsDir);
      
      // Try to find images with similar timestamps
      const sourceOptions = [
        'image_1745767396969.png',
        'image_1745767403893.png',
        'image_1745768832059.png'
      ];
      
      for (const sourceFile of sourceOptions) {
        const sourcePath = path.join(attachedAssetsDir, sourceFile);
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, uploadsPath);
          fs.copyFileSync(sourcePath, prodPath);
          console.log(`Created problematic file using ${sourceFile}`);
          return true;
        }
      }
      
      // If specific files not found, use any PNG file
      const pngFiles = files.filter(file => file.toLowerCase().endsWith('.png'));
      if (pngFiles.length > 0) {
        const randomFile = pngFiles[Math.floor(Math.random() * pngFiles.length)];
        const sourcePath = path.join(attachedAssetsDir, randomFile);
        fs.copyFileSync(sourcePath, uploadsPath);
        fs.copyFileSync(sourcePath, prodPath);
        console.log(`Created problematic file using ${randomFile}`);
        return true;
      }
      
      console.error(`Could not find any suitable image for problematic file`);
      return false;
    } catch (error) {
      console.error(`Error creating problematic file:`, error);
      return false;
    }
  }
  
  // If file exists in both locations, it's all good
  return true;
}

/**
 * Main function to create placeholder images for missing calendar media
 */
async function createCalendarPlaceholders() {
  console.log("Starting calendar media placeholder creation...");
  
  // 1. Check the problematic file from previous run
  const problematicFileFixed = checkProblematicFile();
  
  // 2. Create placeholders for event types
  const eventTypesCreated = createEventTypePlaceholders();
  
  // 3. Create placeholders for video files
  const videoFilesFixed = createVideoPlaceholders();
  
  // 4. Get all events with media
  const events = await getCalendarEventsWithMedia();
  
  // 5. Find missing media files
  const missingMedia = findMissingMedia(events);
  console.log(`Found ${missingMedia.length} missing media files`);
  
  // 6. Create placeholders for all missing files
  let createdCount = 0;
  for (const missingFile of missingMedia) {
    if (createPlaceholder(missingFile)) {
      createdCount++;
    }
  }
  
  // 7. Print summary
  console.log("\n=== Calendar Media Placeholder Summary ===");
  console.log(`Total missing media files: ${missingMedia.length}`);
  console.log(`Successfully created placeholders: ${createdCount}`);
  console.log(`Event type placeholders created: ${eventTypesCreated}`);
  console.log(`Video files synchronized: ${videoFilesFixed}`);
  console.log(`Problematic file fixed: ${problematicFileFixed}`);
  
  // 8. Check if any files are still missing
  const remainingMissing = findMissingMedia(events);
  
  if (remainingMissing.length > 0) {
    console.log(`\n${remainingMissing.length} files still missing:`);
    remainingMissing.forEach(file => {
      console.log(`- ${file.filename}`);
    });
  } else {
    console.log("\nAll calendar media files have been synchronized!");
  }
  
  return {
    totalMissing: missingMedia.length,
    created: createdCount,
    eventTypesCreated,
    videoFilesFixed,
    problematicFileFixed,
    remainingMissing: remainingMissing.length
  };
}

// Run the main function
createCalendarPlaceholders()
  .then(() => {
    console.log("\nCalendar media placeholder creation completed");
    // Close the database connection
    pool.end();
  })
  .catch(error => {
    console.error("Error in createCalendarPlaceholders:", error);
    pool.end();
    process.exit(1);
  });