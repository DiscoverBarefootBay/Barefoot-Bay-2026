/**
 * Match Stock Images to March 2025 Events
 * 
 * This script:
 * 1. Fetches all March 2025 events from the database
 * 2. Analyzes event titles and descriptions to match them with appropriate stock images
 * 3. Updates each event's media_urls with relevant images
 */

import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// Initialize PostgreSQL connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

// Load the stock images summary
async function loadStockImagesSummary() {
  try {
    const summaryPath = './uploads/Stock Images/download-summary.json';
    const summaryData = await fs.readFile(summaryPath, 'utf8');
    return JSON.parse(summaryData);
  } catch (err) {
    console.error(`Error loading stock images summary: ${err.message}`);
    return null;
  }
}

// Get all March 2025 events
async function getMarchEvents() {
  try {
    const query = `
      SELECT id, title, description, category, media_urls 
      FROM events 
      WHERE TO_CHAR(start_date, 'YYYY-MM') = '2025-03'
      ORDER BY start_date
    `;
    
    const result = await pool.query(query);
    console.log(`Found ${result.rows.length} events for March 2025`);
    return result.rows;
  } catch (err) {
    console.error(`Error fetching March events: ${err.message}`);
    return [];
  }
}

// Match event to appropriate image category
function matchEventToImageCategory(event) {
  const title = event.title?.toLowerCase() || '';
  const description = event.description?.toLowerCase() || '';
  const content = title + ' ' + description;
  
  // Define keyword matchers (more comprehensive with exact matches first)
  const matchers = {
    'Golf': ['golf', 'putt', 'driving range', 'tee time', 'course', 'golf club', 'golf tournament', 'golf league'],
    'Tennis': ['tennis', 'racquet', 'court', 'racket', 'tennis league', 'tennis club', 'tennis match'],
    'Pools': ['pool', 'water', 'aquatic', 'splash', 'indoor pool', 'heated pool', 'pool party'],
    'Clubhouse': ['clubhouse', 'club house', 'club', 'community center', 'social hall', 'lodge', 'meeting', 'gathering'],
    'Quilting': ['quilt', 'sew', 'stitch', 'fabric', 'pattern', 'quilters', 'sewing class', 'quilt club'],
    'Softball': ['softball', 'baseball', 'ball game', 'pitch', 'batting', 'softball league', 'softball game', 'softball practice'],
    'Swimming': ['swim', 'lap swimming', 'aqua', 'water exercise', 'swimming class', 'hydro exercise'],
    'Marco Polo': ['marco polo', 'water game', 'pool game', 'water fun', 'water aerobics', 'aqua zumba'],
    'Women Darts': ['women darts', 'ladies darts', 'women\'s darts', 'ladies dart league', 'ladies dart night'],
    'Darts': ['dart', 'darts', 'dart game', 'bullseye', 'dart league', 'dart tournament', 'mixed darts'],
    'Line Dancing': ['line dance', 'dancing', 'dance class', 'dance lesson', 'line dancing', 'beginner line dance'],
    'Horseshoe': ['horseshoe', 'horseshoes', 'ring toss', 'ringers club', 'horseshoe tournament'],
    'Ladies Bible': ['bible', 'devotion', 'scripture', 'ladies bible', 'women\'s bible', 'faith', 'christian', 'church', 'religious']
  };
  
  // Special case mapping for common event titles in our application
  const specialCaseMapping = {
    'lap swimming': 'Swimming',
    'aquatic aerobics': 'Swimming',
    'hydro exercise': 'Swimming',
    'aqua zumba': 'Swimming',
    'ringers club': 'Horseshoe',
    'bocci': 'Horseshoe',
    'bocce': 'Horseshoe',
    'ladies card clubs': 'Clubhouse',
    'bridge club': 'Clubhouse',
    'euchre': 'Clubhouse',
    'canasta': 'Clubhouse',
    'cribbage': 'Clubhouse',
    'billiards': 'Clubhouse',
    'shuffleboard': 'Clubhouse',
    'pickleball': 'Tennis',
    'bible study': 'Ladies Bible',
    'choir': 'Ladies Bible',
    'church': 'Ladies Bible',
    'quilters': 'Quilting',
    'crafters': 'Quilting',
    'ceramics': 'Quilting',
    'art': 'Quilting',
    'line dance': 'Line Dancing',
    'line dancing': 'Line Dancing',
    'yoga': 'Line Dancing',
    'softball': 'Softball',
    'cornhole': 'Horseshoe',
    'lawn bowling': 'Horseshoe',
    'dart': 'Darts',
    'mixed dart': 'Darts',
    'mix dart': 'Darts',
    'ladies pool': 'Women Darts'
  };
  
  // First check for special case direct matches
  for (const [keyword, category] of Object.entries(specialCaseMapping)) {
    if (title.includes(keyword)) {
      console.log(`Event "${event.title}" matched to "${category}" based on special case mapping "${keyword}"`);
      return category;
    }
  }
  
  // Next, check for keyword matches
  for (const [category, keywords] of Object.entries(matchers)) {
    for (const keyword of keywords) {
      if (content.includes(keyword)) {
        console.log(`Event "${event.title}" matched to "${category}" based on keyword "${keyword}"`);
        return category;
      }
    }
  }
  
  // Extract existing category from database
  let existingCategory = event.category?.toLowerCase() || '';
  
  // If no direct match, use category-based mapping
  const categoryMapping = {
    'sports': ['Golf', 'Tennis', 'Softball'],
    'social': ['Clubhouse', 'Line Dancing'],
    'educational': ['Ladies Bible', 'Quilting'],
    'recreation': ['Horseshoe', 'Darts', 'Swimming', 'Pools'],
    'health': ['Swimming', 'Pools'],
    'arts': ['Quilting'],
    'game': ['Darts', 'Horseshoe', 'Marco Polo']
  };
  
  if (existingCategory && categoryMapping[existingCategory]) {
    const possibleMatches = categoryMapping[existingCategory];
    const randomMatch = possibleMatches[Math.floor(Math.random() * possibleMatches.length)];
    console.log(`Event "${event.title}" matched to "${randomMatch}" based on category "${existingCategory}"`);
    return randomMatch;
  }
  
  // Default to Clubhouse if no matches found
  console.log(`No specific match found for event "${event.title}", defaulting to Clubhouse`);
  return 'Clubhouse';
}

// Update event with new media URLs
async function updateEventMediaUrls(eventId, mediaUrls) {
  try {
    // Check the column type in the database
    const checkQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'events' AND column_name = 'media_urls'
    `;
    
    const columnInfo = await pool.query(checkQuery);
    
    let query;
    let params;
    
    // Based on column type, format the data accordingly
    if (columnInfo.rows.length > 0 && columnInfo.rows[0].data_type === 'jsonb') {
      // For JSONB type, we can pass the array directly
      query = `
        UPDATE events 
        SET media_urls = $1::jsonb
        WHERE id = $2
        RETURNING id, title
      `;
      params = [mediaUrls, eventId];
    } else if (columnInfo.rows.length > 0 && columnInfo.rows[0].data_type === 'text') {
      // For TEXT type, we need to stringify the array
      query = `
        UPDATE events 
        SET media_urls = $1 
        WHERE id = $2
        RETURNING id, title
      `;
      params = [JSON.stringify(mediaUrls), eventId];
    } else {
      // Try with array type
      query = `
        UPDATE events 
        SET media_urls = $1::text[]
        WHERE id = $2
        RETURNING id, title
      `;
      params = [mediaUrls, eventId];
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length > 0) {
      console.log(`Updated media URLs for event "${result.rows[0].title}" (ID: ${eventId})`);
      return true;
    } else {
      console.log(`No event found with ID ${eventId}`);
      return false;
    }
  } catch (err) {
    console.error(`Error updating media URLs for event ${eventId}: ${err.message}`);
    
    // Try a different approach if the first method failed
    try {
      console.log(`Trying alternative update method for event ID ${eventId}...`);
      
      // Try to cast the array to text[]
      const query = `
        UPDATE events 
        SET media_urls = $1::text[]
        WHERE id = $2
        RETURNING id, title
      `;
      
      const result = await pool.query(query, [mediaUrls, eventId]);
      
      if (result.rows.length > 0) {
        console.log(`Successfully updated media URLs for event "${result.rows[0].title}" (ID: ${eventId}) using alternative method`);
        return true;
      } else {
        console.log(`No event found with ID ${eventId} (alternative method)`);
        return false;
      }
    } catch (altErr) {
      console.error(`Alternative update method also failed for event ${eventId}: ${altErr.message}`);
      return false;
    }
  }
}

// Main function to match images to events
async function matchImagesToEvents() {
  try {
    console.log('Starting to match stock images to March 2025 events...');
    
    // Load stock images summary
    const stockImagesSummary = await loadStockImagesSummary();
    if (!stockImagesSummary) {
      console.error('Could not load stock images summary. Aborting.');
      return { error: 'Failed to load stock images summary' };
    }
    
    // Create a map of categories to image paths
    const categoryImageMap = {};
    for (const category of stockImagesSummary.categories) {
      if (category.status === 'success' && category.paths && category.paths.length > 0) {
        categoryImageMap[category.name] = category.paths;
      }
    }
    
    // Get March events
    const events = await getMarchEvents();
    if (events.length === 0) {
      console.log('No events found for March 2025.');
      return { message: 'No events found for March 2025' };
    }
    
    // Process each event
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const event of events) {
      try {
        // Parse existing media URLs if any
        const existingMediaUrls = Array.isArray(event.media_urls) ? event.media_urls : 
          (typeof event.media_urls === 'string' ? JSON.parse(event.media_urls) : []);
        
        // Log if event already has images, but continue to update anyway
        if (existingMediaUrls.length > 0) {
          console.log(`Event "${event.title}" already has ${existingMediaUrls.length} images. Replacing with more relevant images.`);
        }
        
        // Match event to image category
        const matchedCategory = matchEventToImageCategory(event);
        
        // Get images for the matched category
        const categoryImages = categoryImageMap[matchedCategory] || [];
        
        if (categoryImages.length === 0) {
          console.log(`No images found for category "${matchedCategory}". Skipping event "${event.title}".`);
          skippedCount++;
          continue;
        }
        
        // Update event with matched images
        const success = await updateEventMediaUrls(event.id, categoryImages);
        
        if (success) {
          updatedCount++;
        } else {
          skippedCount++;
        }
      } catch (err) {
        console.error(`Error processing event ${event.id} "${event.title}": ${err.message}`);
        skippedCount++;
      }
    }
    
    console.log('\nImage matching completed:');
    console.log(`Successfully updated ${updatedCount} events`);
    console.log(`Skipped ${skippedCount} events`);
    
    return {
      totalEvents: events.length,
      updatedEvents: updatedCount,
      skippedEvents: skippedCount
    };
  } catch (err) {
    console.error('Error in matchImagesToEvents:', err);
    return { error: err.message };
  } finally {
    // Close DB connection
    await pool.end();
    console.log('Database connection closed');
  }
}

// Execute the main function
matchImagesToEvents()
  .then(result => console.log('Process completed:', result))
  .catch(err => console.error('Error in main execution:', err));