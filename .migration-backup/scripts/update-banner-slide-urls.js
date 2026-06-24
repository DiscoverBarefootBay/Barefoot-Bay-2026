/**
 * Script to update banner slide URLs to use Object Storage URLs
 * 
 * This script finds banner slides using local paths and updates them
 * to use the corresponding Object Storage URLs.
 */
import dotenv from 'dotenv';
import { db } from './db-client.js';

// Load environment variables from .env file
dotenv.config();
console.log('Loading environment from .env file');

/**
 * Get banner slides content from database
 * @returns {Promise<Object>} Banner slides content
 */
async function getBannerSlidesFromDB() {
  try {
    const result = await db.query(
      `SELECT * FROM page_contents WHERE slug = 'banner-slides'`
    );
    console.log(`Executed query in ${result.duration}ms: ${result.query}`);

    if (!result.rows || result.rows.length === 0) {
      console.error('No banner slides found in database');
      return null;
    }
    
    const pageContent = result.rows[0];
    
    // The content is stored as JSON string, not an object
    if (!pageContent.content) {
      console.error('Banner slides content is missing');
      return null;
    }

    // Parse the content if it's a string
    if (typeof pageContent.content === 'string') {
      try {
        pageContent.content = { slides: JSON.parse(pageContent.content) };
        console.log('Successfully parsed banner slides content');
      } catch (parseError) {
        console.error('Failed to parse banner slides content:', parseError);
        return null;
      }
    } else if (!pageContent.content.slides && Array.isArray(pageContent.content)) {
      // If content is already an array but not in the expected structure
      pageContent.content = { slides: pageContent.content };
    }
    
    return pageContent;
  } catch (error) {
    console.error('Error getting banner slides from database:', error);
    return null;
  }
}

/**
 * Update banner slides in the database
 * @param {Object} pageContent - Page content object
 * @param {Array} updates - Array of slide updates with old and new URLs
 * @returns {Promise<boolean>} Success status
 */
async function updateBannerSlidesInDB(pageContent, updates) {
  try {
    // Get the content object
    const content = pageContent.content;
    
    // Make sure slides array exists
    if (!content.slides || !Array.isArray(content.slides)) {
      console.error('No slides array in content');
      return false;
    }
    
    // Apply updates
    let updatesApplied = 0;
    for (const update of updates) {
      const slideIndex = content.slides.findIndex(slide => 
        slide.src === update.oldSrc);
      
      if (slideIndex !== -1) {
        console.log(`Updating slide ${slideIndex + 1}: ${update.oldSrc} → ${update.newSrc}`);
        
        // Store the original URL as a fallback path
        const originalSrc = content.slides[slideIndex].src;
        content.slides[slideIndex].fallbackSrc = originalSrc;
        
        // Update the src to the Object Storage URL
        content.slides[slideIndex].src = update.newSrc;
        
        // Add timestamp to track last updated
        content.slides[slideIndex].lastUpdated = new Date().toISOString();
        
        updatesApplied++;
      }
    }
    
    // Update database
    if (updatesApplied > 0) {
      // Convert the slides array back to a JSON string for storage
      const contentToStore = JSON.stringify(content.slides);
      
      await db.query(
        `UPDATE page_contents SET content = $1 WHERE id = $2`,
        [contentToStore, pageContent.id]
      );
      console.log(`Updated ${updatesApplied} slides in database`);
      return true;
    } else {
      console.log('No slides updated in database');
      return false;
    }
  } catch (error) {
    console.error('Error updating banner slides in database:', error);
    return false;
  }
}

/**
 * Main function to update banner slide URLs
 */
async function updateBannerSlideUrls() {
  try {
    console.log('Starting banner slide URL updates...');
    
    // Get banner slides from database
    const pageContent = await getBannerSlidesFromDB();
    if (!pageContent) {
      console.error('Could not retrieve banner slides from database');
      return;
    }
    
    // Process slides
    const slides = pageContent.content.slides || [];
    console.log(`Found ${slides.length} slides in database`);
    
    // Create mapping of local paths to Object Storage URLs
    const updates = [];
    
    // Process each slide with local paths
    for (const slide of slides) {
      // Skip if already using Object Storage
      if (slide.src && slide.src.includes('object-storage.replit.app')) {
        console.log(`Slide already using Object Storage: ${slide.src}`);
        continue;
      }

      // Get filename from path
      const filename = slide.src.split('/').pop();
      
      // Create mapping to Object Storage URL
      const objectStorageUrl = `https://object-storage.replit.app/DEFAULT/banner-slides/${filename}`;
      
      updates.push({
        oldSrc: slide.src,
        newSrc: objectStorageUrl
      });
    }
    
    console.log(`Generated ${updates.length} updates`);
    
    // Update database
    if (updates.length > 0) {
      const success = await updateBannerSlidesInDB(pageContent, updates);
      if (success) {
        console.log('Successfully updated banner slides in database');
      } else {
        console.error('Failed to update banner slides in database');
      }
    } else {
      console.log('No updates to apply');
    }
    
    console.log('Banner slide URL updates completed');
    
  } catch (error) {
    console.error('Error updating banner slide URLs:', error);
  } finally {
    // Ensure db connection is closed
    try {
      await db.end();
    } catch (err) {
      console.error('Error closing database connection:', err);
    }
  }
}

// Run the URL update
updateBannerSlideUrls().catch(console.error);