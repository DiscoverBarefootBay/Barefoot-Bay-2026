/**
 * Simple focused script to fix the video banner slide URL
 * 
 * This script updates a specific video banner slide to use the Object Storage URL
 * instead of the local filesystem path.
 * 
 * Usage:
 * node fix-banner-video.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';

// Initialize .env
dotenv.config();

// Database connection
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// The video filename we're looking for
const VIDEO_FILENAME = 'bannerImage-1746635519549-838343560.mp4';
const LOCAL_PATH = `/uploads/banner-slides/${VIDEO_FILENAME}`;
const OBJECT_STORAGE_URL = `https://object-storage.replit.app/BANNER/banner-slides/${VIDEO_FILENAME}`;

// Convert video URL to Object Storage format
async function fixVideoUrl() {
  console.log('Starting fix for banner slide video URL...');
  
  try {
    // Get banner slides from database
    const result = await pool.query(
      `SELECT id, content FROM page_contents WHERE slug = 'banner-slides'`
    );
    
    if (result.rows.length === 0) {
      console.log('No banner slides found in database.');
      return;
    }
    
    const pageContent = result.rows[0];
    console.log(`Found banner slides with ID: ${pageContent.id}`);
    
    // Parse slides content
    let slides;
    try {
      slides = JSON.parse(pageContent.content);
      console.log(`Found ${slides.length} banner slides`);
    } catch (error) {
      console.error('Error parsing banner slides JSON:', error);
      return;
    }
    
    // Find and update the specific video slide
    let updated = false;
    const updatedSlides = slides.map(slide => {
      // Skip if no source
      if (!slide.src) {
        return slide;
      }
      
      // Check if this is our target video
      if (slide.src === LOCAL_PATH || slide.src.includes(VIDEO_FILENAME)) {
        console.log(`Found video slide with path: ${slide.src}`);
        updated = true;
        return {
          ...slide,
          src: OBJECT_STORAGE_URL,
          // Ensure mediaType is set correctly
          mediaType: 'video'
        };
      }
      
      return slide;
    });
    
    // Update the database if we found the video
    if (updated) {
      console.log(`Updating video URL to: ${OBJECT_STORAGE_URL}`);
      
      await pool.query(
        `UPDATE page_contents SET content = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(updatedSlides), pageContent.id]
      );
      
      console.log('Database updated successfully!');
    } else {
      console.log(`Video ${VIDEO_FILENAME} not found in banner slides.`);
    }
  } catch (error) {
    console.error('Error fixing video URL:', error);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the script
fixVideoUrl();