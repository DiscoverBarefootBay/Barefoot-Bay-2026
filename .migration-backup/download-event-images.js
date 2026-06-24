/**
 * Download sample images for calendar events
 * This script downloads relevant images for the calendar events
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the image categories and their search terms
const EVENT_IMAGES = [
  { filename: 'golf-tournament.jpg', searchTerm: 'senior+golf+tournament' },
  { filename: 'water-aerobics.jpg', searchTerm: 'water+aerobics+seniors' },
  { filename: 'potluck-dinner.jpg', searchTerm: 'community+potluck+dinner' },
  { filename: 'pickleball.jpg', searchTerm: 'senior+pickleball+court' },
  { filename: 'board-games.jpg', searchTerm: 'senior+board+game+night' },
  { filename: 'health-screening.jpg', searchTerm: 'senior+health+screening' },
  { filename: 'town-hall.jpg', searchTerm: 'community+town+hall+meeting' },
  { filename: 'book-club.jpg', searchTerm: 'senior+book+club+discussion' }
];

/**
 * Download images for calendar events
 */
async function downloadEventImages() {
  console.log('Downloading event images...');
  
  // Ensure the sample directory exists
  const sampleDir = path.join(__dirname, 'uploads', 'sample');
  if (!fs.existsSync(sampleDir)) {
    fs.mkdirSync(sampleDir, { recursive: true });
  }
  
  // Download each image
  let successCount = 0;
  
  for (const image of EVENT_IMAGES) {
    try {
      console.log(`Downloading image for ${image.filename}...`);
      
      // Create the image URL using Unsplash source
      const imageUrl = `https://source.unsplash.com/featured/?${image.searchTerm}`;
      
      // Path to save the image
      const imagePath = path.join(sampleDir, image.filename);
      
      // Download the image
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      
      // Save the image to disk
      const buffer = await response.buffer();
      fs.writeFileSync(imagePath, buffer);
      
      console.log(`Successfully downloaded ${image.filename}`);
      successCount++;
    } catch (error) {
      console.error(`Error downloading ${image.filename}:`, error.message);
    }
  }
  
  console.log(`Downloaded ${successCount} out of ${EVENT_IMAGES.length} images`);
}

// Run the script
downloadEventImages().catch(console.error);