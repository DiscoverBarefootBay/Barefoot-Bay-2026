/**
 * Download sample images for calendar events from Picsum Photos
 * This script downloads random images for the calendar events
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the image filenames
const EVENT_IMAGES = [
  'golf-tournament.jpg',
  'water-aerobics.jpg',
  'potluck-dinner.jpg',
  'pickleball.jpg',
  'board-games.jpg',
  'health-screening.jpg',
  'town-hall.jpg',
  'book-club.jpg'
];

/**
 * Download images for calendar events from Lorem Picsum
 */
async function downloadEventImages() {
  console.log('Downloading event images from Picsum Photos...');
  
  // Ensure the sample directory exists
  const sampleDir = path.join(__dirname, 'uploads', 'sample');
  if (!fs.existsSync(sampleDir)) {
    fs.mkdirSync(sampleDir, { recursive: true });
  }
  
  // Download each image
  let successCount = 0;
  
  for (const [index, filename] of EVENT_IMAGES.entries()) {
    try {
      console.log(`Downloading image for ${filename}...`);
      
      // Use Picsum Photos with a different seed for each image
      // The seed ensures we get consistent images for the same filename
      const imageId = 100 + index;
      const imageUrl = `https://picsum.photos/seed/${filename.replace('.jpg', '')}/${800}/${600}`;
      
      // Path to save the image
      const imagePath = path.join(sampleDir, filename);
      
      // Download the image
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      
      // Save the image to disk
      const buffer = await response.buffer();
      fs.writeFileSync(imagePath, buffer);
      
      console.log(`Successfully downloaded ${filename}`);
      successCount++;
    } catch (error) {
      console.error(`Error downloading ${filename}:`, error.message);
    }
  }
  
  console.log(`Downloaded ${successCount} out of ${EVENT_IMAGES.length} images`);
}

// Run the script
downloadEventImages().catch(console.error);