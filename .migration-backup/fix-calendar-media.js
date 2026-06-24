/**
 * Script to fix calendar media paths and ensure files are accessible
 * in both /uploads/calendar/ and /calendar/ directories
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main function to fix calendar media
async function fixCalendarMedia() {
  console.log('Starting calendar media path fix...');
  
  // Ensure both calendar directories exist
  const calendarDirs = [
    path.join(__dirname, 'uploads', 'calendar'),
    path.join(__dirname, 'calendar')
  ];
  
  // Create directories if they don't exist
  console.log('Ensuring calendar directories exist...');
  calendarDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Look for all files in attached_assets directory
  console.log('Looking for calendar event images in attached_assets...');
  const attachedAssetsDir = path.join(__dirname, 'attached_assets');
  
  if (!fs.existsSync(attachedAssetsDir)) {
    console.error('Error: attached_assets directory not found!');
    return;
  }
  
  const files = fs.readdirSync(attachedAssetsDir);
  const eventImageFiles = files.filter(file => 
    (file.startsWith('image_') || file.toLowerCase().includes('event')) &&
    file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')
  );
  
  console.log(`Found ${eventImageFiles.length} potential event images in attached_assets`);
  
  // Copy each file to both calendar directories to ensure consistency
  console.log('Syncing calendar event images between directories...');
  let filesCopied = 0;
  
  for (const file of eventImageFiles) {
    const sourcePath = path.join(attachedAssetsDir, file);
    
    // Generate a calendar-specific filename if it's not already in that format
    const timestamp = Date.now();
    const calendarFilename = file.startsWith('media-') 
      ? file 
      : `media-${timestamp}-${Math.floor(Math.random() * 1000000000)}.${file.split('.').pop()}`;
    
    // Define destination paths for both directories
    const destPaths = [
      path.join(calendarDirs[0], calendarFilename), // uploads/calendar
      path.join(calendarDirs[1], calendarFilename)  // calendar
    ];
    
    try {
      // Copy file to both destinations
      console.log(`Copying ${file} to calendar directories as ${calendarFilename}`);
      destPaths.forEach(destPath => {
        fs.copyFileSync(sourcePath, destPath);
      });
      
      filesCopied++;
    } catch (err) {
      console.error(`Error copying file ${file}:`, err);
    }
  }
  
  // Check for the specific event images
  console.log('Checking for specific event images from user screenshots...');
  
  // Array of specific event image files to sync
  const specificEventImages = [
    'image_1745760315114.png',
    'image_1745760320756.png'
  ];
  
  for (const file of specificEventImages) {
    const sourcePath = path.join(attachedAssetsDir, file);
    if (fs.existsSync(sourcePath)) {
      console.log(`Found specific event image: ${file}`);
      
      // Use media timestamp format for calendar
      const timestamp = Date.now();
      const calendarFilename = `media-${timestamp}-${Math.floor(Math.random() * 1000000000)}.png`;
      
      // Define destination paths
      const destPaths = [
        path.join(calendarDirs[0], calendarFilename), // uploads/calendar
        path.join(calendarDirs[1], calendarFilename)  // calendar
      ];
      
      try {
        // Copy file to both destinations
        console.log(`Copying ${file} to calendar directories as ${calendarFilename}`);
        destPaths.forEach(destPath => {
          fs.copyFileSync(sourcePath, destPath);
        });
        
        console.log(`Successfully copied ${file} to both calendar directories as ${calendarFilename}`);
        console.log(`For use in events, reference this file as: /uploads/calendar/${calendarFilename}`);
      } catch (err) {
        console.error(`Error copying specific event image ${file}:`, err);
      }
    } else {
      console.log(`Specific event image not found: ${file}`);
    }
  }
  
  console.log(`Calendar media fix completed. ${filesCopied} files processed.`);
  console.log('Images should now be accessible via both /uploads/calendar/ and /calendar/ paths.');
}

// Execute the function
fixCalendarMedia().catch(err => {
  console.error('Error fixing calendar media:', err);
});