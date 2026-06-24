/**
 * Script to remove the incorrect placeholder calendar media files
 * 
 * This script:
 * 1. Identifies and removes the placeholder images we just created
 * 2. Removes them from both /uploads/calendar/ and /calendar/ paths
 * 3. But preserves the original structure for path resolution
 * 
 * Note: This does not modify any database entries, only removes the physical files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the directories
const calendarDir = path.join(process.cwd(), 'calendar');
const uploadsCalendarDir = path.join(process.cwd(), 'uploads', 'calendar');

// List of placeholder files to remove
const placeholderFilesToRemove = [
  // Standard event type placeholders
  'sports-event.jpg',
  'social-event.jpg',
  'community-event.jpg',
  'arts-event.jpg',
  'special-event.jpg',
  
  // Specific media files created as placeholders
  'media-1744231497341-984072692.png',
  'media-1744231541500-503580356.mp4',
  'media-1745768780019-873952511.png',
  'media-1744226069469-599872670.png',
  'media-1745525220612-255043736.jpg',
  'media-1744146889633-876532331.jpg',
  'media-1744226340871-41764005.png',
  'media-1744228200350-464898651.png',
  'media-1744300526736-857422144.png',
  'media-1745524067096-898914929.jpg',
  'media-1745524532826-384220995.jpg',
  'media-1745524890657-509758259.jpg',
  'media-1745525020263-185752608.jpg',
  'media-1745528032650-913404724.jpg',
  'media-1745527276018-133857164.jpg',
  'media-1745527698191-754009227.jpg',
  'media-1745528971902-84048066.jpg',
  'media-1745529365503-415384466.jpg',
  'media-1744224846785-580766980.png'
];

// Also remove any specifically problematic file that was replaced incorrectly
const specificFiles = [
  'media-1745767469558-347108879.png'
];

/**
 * Remove a file if it exists, with error handling
 */
function safeRemoveFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (error) {
      console.error(`Error removing file ${filePath}:`, error);
      return false;
    }
  }
  return false;
}

/**
 * Main function to remove placeholder images
 */
function removePlaceholderImages() {
  console.log("Starting removal of placeholder calendar media...");
  
  const filesRemoved = {
    calendar: 0,
    uploadsCalendar: 0,
    skipped: 0,
    errors: []
  };
  
  // Combine the lists
  const allFilesToRemove = [...placeholderFilesToRemove, ...specificFiles];
  
  // Process each file
  for (const filename of allFilesToRemove) {
    const calendarPath = path.join(calendarDir, filename);
    const uploadsPath = path.join(uploadsCalendarDir, filename);
    
    // Remove from calendar directory
    if (safeRemoveFile(calendarPath)) {
      filesRemoved.calendar++;
      console.log(`Removed from calendar dir: ${filename}`);
    } else {
      filesRemoved.skipped++;
    }
    
    // Remove from uploads/calendar directory
    if (safeRemoveFile(uploadsPath)) {
      filesRemoved.uploadsCalendar++;
      console.log(`Removed from uploads/calendar dir: ${filename}`);
    } else {
      filesRemoved.skipped++;
    }
  }
  
  // Print summary
  console.log("\n=== Placeholder Removal Summary ===");
  console.log(`Total files in removal list: ${allFilesToRemove.length}`);
  console.log(`Removed from calendar dir: ${filesRemoved.calendar}`);
  console.log(`Removed from uploads/calendar dir: ${filesRemoved.uploadsCalendar}`);
  console.log(`Skipped (not found): ${filesRemoved.skipped}`);
  
  return filesRemoved;
}

// Run the main function
removePlaceholderImages();
console.log("\nPlaceholder removal completed");