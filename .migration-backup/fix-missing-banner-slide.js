/**
 * Emergency fix script for missing banner slide media
 * 
 * This script:
 * 1. Removes references to missing banner slide image files
 * 2. Ensures database entries point to existing files only
 * 3. Updates the modification timestamp to force cache refreshing
 * 
 * Usage:
 * node fix-missing-banner-slide.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Configure database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Define paths
const UPLOADS_DIR = path.join('.', 'uploads', 'banner-slides');
const ROOT_DIR = path.join('.', 'banner-slides');

// Missing image to remove
const MISSING_IMAGE = 'bannerImage-1745683436311-636102545.jpg';

// Main function
async function fixMissingBannerSlide() {
  console.log('Starting fix for missing banner slide media...');
  
  try {
    // 1. Check if the file exists in either directory
    const uploadsPath = path.join(UPLOADS_DIR, MISSING_IMAGE);
    const rootPath = path.join(ROOT_DIR, MISSING_IMAGE);
    
    const fileExistsInUploads = fs.existsSync(uploadsPath);
    const fileExistsInRoot = fs.existsSync(rootPath);
    
    console.log(`File exists in uploads directory: ${fileExistsInUploads}`);
    console.log(`File exists in root directory: ${fileExistsInRoot}`);
    
    // 2. Get the current banner slides content from database
    const { rows } = await pool.query(
      "SELECT id, content FROM page_contents WHERE slug = 'banner-slides'"
    );
    
    if (!rows.length) {
      console.log('No banner slides found in database.');
      return { success: false, error: 'No banner slides in database' };
    }
    
    const pageContent = rows[0];
    console.log(`Found banner slides content with ID: ${pageContent.id}`);
    
    // 3. Parse the content
    let slides;
    try {
      slides = JSON.parse(pageContent.content);
      console.log(`Successfully parsed ${slides.length} banner slides`);
    } catch (err) {
      console.error('Error parsing banner slides JSON:', err);
      return { success: false, error: 'JSON parse error' };
    }
    
    // 4. Filter out the problematic slide
    const originalLength = slides.length;
    const newSlides = slides.filter(slide => {
      // Keep slides that don't reference the missing image
      if (!slide.src) return true;
      
      if (slide.src.includes(MISSING_IMAGE)) {
        console.log(`Found problematic reference: ${slide.src}`);
        return false; // Filter out this slide
      }
      return true;
    });
    
    console.log(`Filtered ${originalLength - newSlides.length} problematic slides`);
    
    if (originalLength === newSlides.length) {
      console.log('No problematic slides found in content. Checking for path format issues...');
      
      // If no slides were filtered out, there might be path format issues
      // Some slides might use /uploads/ prefix, others might not
      // Check if there's a slide using /uploads/ that doesn't exist, but has a copy without /uploads/
      let updatedSlides = slides.map(slide => {
        if (!slide.src) return slide;
        
        // Check for uploads prefix
        if (slide.src.startsWith('/uploads/banner-slides/')) {
          const fileName = slide.src.replace('/uploads/banner-slides/', '');
          const uploadsPath = path.join(UPLOADS_DIR, fileName);
          
          // If file doesn't exist in uploads but exists in root, change the path
          if (!fs.existsSync(uploadsPath) && fs.existsSync(path.join(ROOT_DIR, fileName))) {
            console.log(`Changing path from ${slide.src} to /banner-slides/${fileName}`);
            return { ...slide, src: `/banner-slides/${fileName}` };
          }
        } else if (slide.src.startsWith('/banner-slides/')) {
          const fileName = slide.src.replace('/banner-slides/', '');
          const rootPath = path.join(ROOT_DIR, fileName);
          
          // If file doesn't exist in root but exists in uploads, change the path
          if (!fs.existsSync(rootPath) && fs.existsSync(path.join(UPLOADS_DIR, fileName))) {
            console.log(`Changing path from ${slide.src} to /uploads/banner-slides/${fileName}`);
            return { ...slide, src: `/uploads/banner-slides/${fileName}` };
          }
        }
        
        return slide;
      });
      
      // Update slides with the fixed paths
      newSlides = updatedSlides;
    }
    
    // 5. Update the database with fixed content
    const updatedContent = JSON.stringify(newSlides);
    await pool.query(
      "UPDATE page_contents SET content = $1, updated_at = NOW() WHERE id = $2",
      [updatedContent, pageContent.id]
    );
    
    console.log('Database updated with fixed content');
    
    return { 
      success: true, 
      removedSlides: originalLength - newSlides.length,
      newSlideCount: newSlides.length
    };
  } catch (error) {
    console.error('Error fixing banner slides:', error);
    return { success: false, error: error.message };
  } finally {
    // Close the database pool
    await pool.end();
  }
}

// Run the fix
fixMissingBannerSlide()
  .then(result => {
    if (result.success) {
      console.log('Fix completed successfully!');
      console.log(`Removed ${result.removedSlides} problematic slides`);
      console.log(`New slide count: ${result.newSlideCount}`);
      process.exit(0);
    } else {
      console.error('Fix failed:', result.error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });