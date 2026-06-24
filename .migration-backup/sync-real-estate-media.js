/**
 * Synchronize real estate media from calendar folder to real-estate-media folder
 * 
 * This script:
 * 1. Finds real estate media files in the calendar folder
 * 2. Copies them to the real-estate-media folder
 * 3. Updates database records if needed
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to the database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Real estate media filename patterns
const realEstatePatterns = [
  'real-estate-',
  'property-',
  'listing-',
  'house-',
  'home-',
  'forsale-'
];

async function getListingsWithCalendarMedia() {
  console.log("Fetching all real estate listings...");
  const query = `
    SELECT id, photos 
    FROM real_estate_listings 
    WHERE photos IS NOT NULL AND array_length(photos, 1) > 0;
  `;
  
  try {
    const result = await pool.query(query);
    console.log(`Found ${result.rows.length} listings with photos`);
    return result.rows;
  } catch (error) {
    console.error("Error fetching listings:", error);
    return [];
  }
}

function isCalendarImage(url) {
  return url && (
    url.includes('/calendar/') || 
    url.includes('/uploads/calendar/')
  );
}

function isRealEstateImage(filename) {
  if (!filename) return false;
  
  // Check if filename matches any of the real estate patterns
  return realEstatePatterns.some(pattern => filename.includes(pattern));
}

function getRealEstateImagesInCalendar() {
  const calendarDir = path.join(__dirname, 'uploads', 'calendar');
  const realEstateDirDev = path.join(__dirname, 'uploads', 'real-estate-media');
  const realEstateDirProd = path.join(__dirname, 'real-estate-media');
  
  // Ensure directories exist
  if (!fs.existsSync(calendarDir)) {
    console.error(`Calendar directory not found: ${calendarDir}`);
    return [];
  }
  
  [realEstateDirDev, realEstateDirProd].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
  
  // Get all files from calendar folder
  try {
    const calendarFiles = fs.readdirSync(calendarDir);
    console.log(`Found ${calendarFiles.length} files in calendar directory`);
    
    // Filter files that match real estate patterns
    const realEstateFiles = calendarFiles.filter(filename => 
      isRealEstateImage(filename)
    );
    
    console.log(`Found ${realEstateFiles.length} real estate related files in calendar folder`);
    return realEstateFiles;
  } catch (error) {
    console.error("Error reading calendar directory:", error);
    return [];
  }
}

async function moveRealEstateImages() {
  const realEstateFiles = getRealEstateImagesInCalendar();
  const realEstateDirDev = path.join(__dirname, 'uploads', 'real-estate-media');
  const realEstateDirProd = path.join(__dirname, 'real-estate-media');
  
  let movedCount = 0;
  
  for (const filename of realEstateFiles) {
    try {
      const sourcePath = path.join(__dirname, 'uploads', 'calendar', filename);
      const devDestPath = path.join(realEstateDirDev, filename);
      const prodDestPath = path.join(realEstateDirProd, filename);
      
      // Copy to both dev and prod locations
      fs.copyFileSync(sourcePath, devDestPath);
      fs.copyFileSync(sourcePath, prodDestPath);
      
      console.log(`Copied ${filename} to real-estate-media folder`);
      movedCount++;
    } catch (error) {
      console.error(`Error copying file ${filename}:`, error);
    }
  }
  
  console.log(`\nSuccessfully copied ${movedCount} of ${realEstateFiles.length} files`);
  return movedCount;
}

async function getListingsWithMisplacedMedia() {
  const listings = await getListingsWithCalendarMedia();
  const listingsWithCalendarMedia = listings.filter(listing => {
    // Check if any photo uses the calendar folder path
    return listing.photos.some(url => 
      isCalendarImage(url) && realEstatePatterns.some(pattern => 
        url.includes(pattern)
      )
    );
  });
  
  console.log(`Found ${listingsWithCalendarMedia.length} listings with real estate images in calendar folder`);
  return listingsWithCalendarMedia;
}

async function fixDatabaseReferences() {
  const listingsToFix = await getListingsWithMisplacedMedia();
  let updatedCount = 0;
  
  for (const listing of listingsToFix) {
    const fixedPhotos = listing.photos.map(url => {
      // Only fix URLs that are in calendar folder and match real estate patterns
      if (isCalendarImage(url) && realEstatePatterns.some(pattern => url.includes(pattern))) {
        const filename = url.split('/').pop();
        // Return URL with the new path
        return url.includes('/uploads/') 
          ? `/uploads/real-estate-media/${filename}` 
          : `/real-estate-media/${filename}`;
      }
      return url;
    });
    
    // Update the database
    try {
      const query = `
        UPDATE real_estate_listings 
        SET photos = $1
        WHERE id = $2
      `;
      await pool.query(query, [fixedPhotos, listing.id]);
      console.log(`Updated listing #${listing.id} photos`);
      updatedCount++;
    } catch (error) {
      console.error(`Error updating listing #${listing.id}:`, error);
    }
  }
  
  console.log(`\nSuccessfully updated ${updatedCount} of ${listingsToFix.length} listings`);
  return updatedCount;
}

async function main() {
  console.log("=== Real Estate Media Synchronization Tool ===");
  
  try {
    // First move files
    const movedCount = await moveRealEstateImages();
    
    // Then update database references
    const updatedCount = await fixDatabaseReferences();
    
    console.log("\n=== Summary ===");
    console.log(`Files moved: ${movedCount}`);
    console.log(`Database records updated: ${updatedCount}`);
    console.log("\nDone!");
  } catch (error) {
    console.error("Error during synchronization:", error);
  } finally {
    // Close database connection
    await pool.end();
  }
}

main().catch(console.error);