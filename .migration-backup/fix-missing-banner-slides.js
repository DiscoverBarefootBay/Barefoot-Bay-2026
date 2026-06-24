/**
 * Script to fix missing banner slides that disappear after deployment
 * 
 * This script:
 * 1. Verifies that all banner slides referenced in the database exist in both filesystem locations
 * 2. When missing files are found, tries to find similar files in attached_assets
 * 3. Creates missing files from appropriate sources
 * 4. Ensures banner media files are synced across /uploads/banner-slides/ and /banner-slides/
 * 5. Updates the database record if needed to use correct paths
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
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'banner-slides');
const BANNER_SLIDES_DIR = path.join(process.cwd(), 'banner-slides');
const ATTACHED_ASSETS_DIR = path.join(process.cwd(), 'attached_assets');

// Tracking stats
const stats = {
  slidesInDatabase: 0,
  missingFiles: 0,
  recoveredFiles: 0,
  failedRecoveries: 0,
  updatedDatabaseRecords: 0
};

/**
 * Ensure a directory exists
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }
  return false;
}

/**
 * Extract timestamp from a filename
 */
function extractTimestamp(filename) {
  // Match format: bannerImage-1745768442084-877787453.png
  const matches = filename.match(/bannerImage-(\d+)-/);
  if (matches && matches[1]) {
    return parseInt(matches[1], 10);
  }
  return null;
}

/**
 * Find the most similar file in attached_assets based on timestamp
 */
function findSimilarFile(timestamp, extension) {
  if (!timestamp) return null;
  
  try {
    const files = fs.readdirSync(ATTACHED_ASSETS_DIR);
    
    // Find files with timestamps closest to our target
    const candidates = files
      .filter(file => {
        // Match format: image_1745768832059.png
        const matches = file.match(/image_(\d+)\./);
        return matches && matches[1] && path.extname(file).toLowerCase() === extension;
      })
      .map(file => {
        const matches = file.match(/image_(\d+)\./);
        const fileTimestamp = parseInt(matches[1], 10);
        return {
          filename: file,
          timestamp: fileTimestamp,
          difference: Math.abs(fileTimestamp - timestamp)
        };
      })
      .sort((a, b) => a.difference - b.difference);
    
    if (candidates.length > 0) {
      // Use the closest match by timestamp
      return path.join(ATTACHED_ASSETS_DIR, candidates[0].filename);
    }
    
    // If no timestamp match, try to find any file with the same extension
    const anyFileWithExt = files.find(file => path.extname(file).toLowerCase() === extension);
    if (anyFileWithExt) {
      return path.join(ATTACHED_ASSETS_DIR, anyFileWithExt);
    }
  } catch (error) {
    console.error('Error finding similar file:', error);
  }
  
  return null;
}

/**
 * Try to recover a missing banner slide file
 */
async function recoverBannerSlide(filename) {
  try {
    // Define target paths
    const uploadsPath = path.join(UPLOADS_DIR, filename);
    const bannerSlidesPath = path.join(BANNER_SLIDES_DIR, filename);
    
    // Extract timestamp and extension
    const timestamp = extractTimestamp(filename);
    const extension = path.extname(filename).toLowerCase();
    
    console.log(`Looking for source to recover ${filename} (timestamp: ${timestamp})`);
    
    // Find a similar file
    const sourceFile = findSimilarFile(timestamp, extension);
    
    if (!sourceFile) {
      console.error(`No suitable source file found for ${filename}`);
      stats.failedRecoveries++;
      return false;
    }
    
    console.log(`Found source file: ${path.basename(sourceFile)}`);
    
    // Copy to both locations
    fs.copyFileSync(sourceFile, uploadsPath);
    fs.copyFileSync(sourceFile, bannerSlidesPath);
    
    console.log(`Successfully recovered ${filename}`);
    stats.recoveredFiles++;
    return true;
  } catch (error) {
    console.error(`Error recovering ${filename}:`, error);
    stats.failedRecoveries++;
    return false;
  }
}

/**
 * Process all banner slides to ensure files exist in both locations
 */
async function processBannerSlides() {
  // First, ensure directories exist
  ensureDirectoryExists(UPLOADS_DIR);
  ensureDirectoryExists(BANNER_SLIDES_DIR);
  
  // Fetch banner slides from database
  console.log('Fetching banner slides from database...');
  const result = await pool.query(`
    SELECT id, slug, title, content, updated_at
    FROM page_contents
    WHERE slug = 'banner-slides'
  `);
  
  if (result.rows.length === 0) {
    console.log('No banner slides found in database');
    return;
  }
  
  const bannerSlidesRecord = result.rows[0];
  console.log(`Found banner slides record (ID: ${bannerSlidesRecord.id}, updated: ${bannerSlidesRecord.updated_at})`);
  
  // Parse the content
  let slides;
  try {
    slides = JSON.parse(bannerSlidesRecord.content);
    stats.slidesInDatabase = slides.length;
    console.log(`Successfully parsed ${slides.length} banner slides`);
  } catch (error) {
    console.error('Error parsing banner slides JSON:', error);
    return;
  }
  
  // Process each slide
  const missingFiles = [];
  
  for (const slide of slides) {
    if (!slide.src || slide.src.includes('placeholder')) {
      continue; // Skip placeholders or slides without source
    }
    
    // Extract filename from the path
    const filename = path.basename(slide.src);
    
    // Check if the file exists in both locations
    const uploadsPath = path.join(UPLOADS_DIR, filename);
    const bannerSlidesPath = path.join(BANNER_SLIDES_DIR, filename);
    
    const uploadsExists = fs.existsSync(uploadsPath);
    const bannerSlidesExists = fs.existsSync(bannerSlidesPath);
    
    if (!uploadsExists || !bannerSlidesExists) {
      console.log(`Missing file: ${filename} (uploads: ${uploadsExists}, banner-slides: ${bannerSlidesExists})`);
      missingFiles.push(filename);
      stats.missingFiles++;
    }
  }
  
  // Try to recover missing files
  console.log(`Found ${missingFiles.length} missing banner slide files`);
  
  if (missingFiles.length > 0) {
    console.log('Attempting to recover missing files...');
    
    for (const filename of missingFiles) {
      await recoverBannerSlide(filename);
    }
  }
  
  // Now ensure all files are synced between both directories
  console.log('Ensuring all banner slides are synced between directories...');
  
  // Get all files in uploads directory
  const uploadsFiles = fs.readdirSync(UPLOADS_DIR);
  
  // Sync from uploads to banner-slides
  for (const filename of uploadsFiles) {
    const uploadsPath = path.join(UPLOADS_DIR, filename);
    const bannerSlidesPath = path.join(BANNER_SLIDES_DIR, filename);
    
    // Skip directories
    if (fs.statSync(uploadsPath).isDirectory()) continue;
    
    // If file doesn't exist in banner-slides, copy it
    if (!fs.existsSync(bannerSlidesPath)) {
      console.log(`Copying ${filename} from uploads to banner-slides`);
      fs.copyFileSync(uploadsPath, bannerSlidesPath);
    }
    
    // If file sizes differ, use the larger one
    else if (fs.statSync(uploadsPath).size !== fs.statSync(bannerSlidesPath).size) {
      const uploadsSize = fs.statSync(uploadsPath).size;
      const bannerSlidesSize = fs.statSync(bannerSlidesPath).size;
      
      if (uploadsSize > bannerSlidesSize) {
        console.log(`Updating banner-slides/${filename} with larger version from uploads`);
        fs.copyFileSync(uploadsPath, bannerSlidesPath);
      } else {
        console.log(`Updating uploads/${filename} with larger version from banner-slides`);
        fs.copyFileSync(bannerSlidesPath, uploadsPath);
      }
    }
  }
  
  // Get all files in banner-slides directory
  const bannerSlidesFiles = fs.readdirSync(BANNER_SLIDES_DIR);
  
  // Sync from banner-slides to uploads
  for (const filename of bannerSlidesFiles) {
    const uploadsPath = path.join(UPLOADS_DIR, filename);
    const bannerSlidesPath = path.join(BANNER_SLIDES_DIR, filename);
    
    // Skip directories
    if (fs.statSync(bannerSlidesPath).isDirectory()) continue;
    
    // If file doesn't exist in uploads, copy it
    if (!fs.existsSync(uploadsPath)) {
      console.log(`Copying ${filename} from banner-slides to uploads`);
      fs.copyFileSync(bannerSlidesPath, uploadsPath);
    }
  }
  
  // Finally, check if we need to update the database
  console.log('Checking if database record needs updating...');
  
  let needsDatabaseUpdate = false;
  const updatedSlides = slides.map(slide => {
    if (!slide.src || slide.src.includes('placeholder')) {
      return slide; // Skip placeholders or slides without source
    }
    
    // Extract filename from the path
    const filename = path.basename(slide.src);
    
    // Check if the file exists now
    const uploadsPath = path.join(UPLOADS_DIR, filename);
    const existsNow = fs.existsSync(uploadsPath);
    
    // If the slide previously had a missing file that now exists,
    // or if the path doesn't use /uploads/ format, update it
    if (existsNow && (!slide.src.startsWith('/uploads/banner-slides/') || missingFiles.includes(filename))) {
      needsDatabaseUpdate = true;
      
      // Use the /uploads/ format path
      const updatedSlide = {
        ...slide,
        src: `/uploads/banner-slides/${filename}`
      };
      
      console.log(`Updating slide path: ${slide.src} -> ${updatedSlide.src}`);
      return updatedSlide;
    }
    
    return slide;
  });
  
  // Update the database if needed
  if (needsDatabaseUpdate) {
    console.log('Updating database record with corrected slide paths...');
    
    try {
      const updateResult = await pool.query(`
        UPDATE page_contents
        SET content = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, updated_at
      `, [JSON.stringify(updatedSlides), bannerSlidesRecord.id]);
      
      if (updateResult.rows.length > 0) {
        console.log(`Database record updated successfully (ID: ${updateResult.rows[0].id}, updated: ${updateResult.rows[0].updated_at})`);
        stats.updatedDatabaseRecords++;
      } else {
        console.error('Database update did not affect any rows');
      }
    } catch (error) {
      console.error('Error updating database record:', error);
    }
  } else {
    console.log('Database record does not need updating');
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Starting banner slides fix process...');
  
  try {
    await processBannerSlides();
    
    console.log('\n=== Banner Slides Fix Summary ===');
    console.log(`Total slides in database: ${stats.slidesInDatabase}`);
    console.log(`Missing files detected: ${stats.missingFiles}`);
    console.log(`Files successfully recovered: ${stats.recoveredFiles}`);
    console.log(`Failed recoveries: ${stats.failedRecoveries}`);
    console.log(`Database records updated: ${stats.updatedDatabaseRecords}`);
    
    if (stats.failedRecoveries > 0) {
      console.log('\n⚠️ Some files could not be recovered. You may need to manually upload new banner slides for these.');
    }
  } catch (error) {
    console.error('Error in banner slides fix process:', error);
  } finally {
    // Close database connection
    await pool.end();
    console.log('Process completed');
  }
}

// Run the main function
main();