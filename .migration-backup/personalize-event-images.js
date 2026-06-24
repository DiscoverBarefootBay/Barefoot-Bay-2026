/**
 * Personalized event image script
 * 
 * This script:
 * 1. Filters only March 2025 events
 * 2. Analyzes event description to identify keywords
 * 3. Downloads appropriate open source images for each event
 * 4. Updates the media URLs in the database
 */

import pg from 'pg';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

const { Pool } = pg;

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Ensure uploads/events directory exists
const EVENT_IMAGES_DIR = './uploads/events';
if (!existsSync(EVENT_IMAGES_DIR)) {
  mkdirSync(EVENT_IMAGES_DIR, { recursive: true });
  console.log(`Created directory: ${EVENT_IMAGES_DIR}`);
}

// Free stock image sources
const IMAGE_SOURCES = [
  { 
    name: 'Pexels',
    search: (keyword) => `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=1`,
    headers: { 'Authorization': process.env.PEXELS_API_KEY },
    parseResponse: (data) => data.photos[0]?.src?.large
  },
  // Fallback to placeholder if API fails
  {
    name: 'Placeholder',
    search: (keyword) => `https://placehold.co/600x400/random?text=${encodeURIComponent(keyword)}`,
    headers: {},
    parseResponse: (url) => url
  }
];

// Keywords mapping to help find relevant images
const KEYWORD_MAP = {
  'swimming': ['swimming', 'pool', 'water'],
  'dancing': ['dancing', 'dance', 'ballroom'],
  'yoga': ['yoga', 'meditation', 'stretching'],
  'exercise': ['fitness', 'exercise', 'workout'],
  'cards': ['cards', 'playing cards', 'card game'],
  'bingo': ['bingo', 'game night', 'board game'],
  'bocce': ['bocce', 'lawn bowling', 'outdoor game'],
  'craft': ['craft', 'crafting', 'handmade'],
  'sewing': ['sewing', 'quilting', 'fabric'],
  'pottery': ['pottery', 'ceramics', 'clay art'],
  'cooking': ['cooking', 'culinary', 'food preparation'],
  'golf': ['golf', 'golfing', 'golf course'],
  'book': ['book', 'reading', 'library'],
  'music': ['music', 'concert', 'performance'],
  'art': ['art', 'painting', 'gallery'],
  'tennis': ['tennis', 'racket sport', 'court'],
  'pickleball': ['pickleball', 'paddle sport', 'court game'],
  'karaoke': ['karaoke', 'singing', 'microphone'],
  'dinner': ['dinner', 'restaurant', 'dining'],
  'meeting': ['meeting', 'conference', 'discussion'],
  'coffee': ['coffee', 'cafe', 'morning drink'],
  'community': ['community', 'neighborhood', 'gathering'],
  'party': ['party', 'celebration', 'festive'],
  'movie': ['movie', 'cinema', 'film'],
  'potluck': ['potluck', 'food sharing', 'community meal'],
  'breakfast': ['breakfast', 'morning meal', 'brunch'],
  'lunch': ['lunch', 'midday meal', 'noon'],
  'workshop': ['workshop', 'learning', 'hands-on'],
  'meditation': ['meditation', 'mindfulness', 'relaxation'],
  'billiards': ['billiards', 'pool table', 'pool game'],
  'chess': ['chess', 'board game', 'strategy game'],
  'poker': ['poker', 'card game', 'casino game'],
  'cycling': ['cycling', 'biking', 'bicycle'],
  'walking': ['walking', 'hiking', 'nature trail'],
  'darts': ['darts', 'dart board', 'throwing game'],
  'fitness': ['fitness', 'gym', 'workout'],
  'gardening': ['gardening', 'plants', 'garden'],
  'photography': ['photography', 'camera', 'photos'],
  'singing': ['singing', 'choir', 'vocals'],
  'bible': ['bible', 'church', 'worship'],
  'drama': ['drama', 'theater', 'acting'],
  'painting': ['painting', 'canvas', 'art studio'],
  'drawing': ['drawing', 'sketch', 'illustration'],
  'zumba': ['zumba', 'dance fitness', 'exercise dance'],
  'computer': ['computer', 'technology', 'digital']
};

/**
 * Extract relevant keywords from text
 * @param {string} text - Text to analyze
 * @returns {string[]} - Array of relevant keywords
 */
function extractKeywords(title, description) {
  const combinedText = (title + ' ' + description).toLowerCase();
  const matches = [];
  
  // Check for each keyword in our map
  for (const [key, synonyms] of Object.entries(KEYWORD_MAP)) {
    // Check the main keyword and all synonyms
    if ([key, ...synonyms].some(term => combinedText.includes(term.toLowerCase()))) {
      matches.push(key);
    }
  }
  
  // If no matches, extract words from the title as keywords
  if (matches.length === 0) {
    // Get significant words from title (ignore common words)
    const titleWords = title.toLowerCase().split(/\s+/)
      .filter(word => word.length > 3 && !['and', 'the', 'with', 'from', 'that', 'this', 'for'].includes(word));
    
    if (titleWords.length > 0) {
      matches.push(...titleWords.slice(0, 2)); // Use up to 2 words from title
    } else {
      matches.push('community'); // Fallback to "community" if no good keywords
    }
  }
  
  return matches;
}

/**
 * Try to get an image from the available sources
 * @param {string} keyword - Search keyword
 * @returns {Promise<string|null>} - Image URL or null if not found
 */
async function findImage(keyword) {
  console.log(`  Searching for image with keyword: ${keyword}`);
  
  // Try each source in order
  for (const source of IMAGE_SOURCES) {
    try {
      console.log(`  Trying source: ${source.name}`);
      const url = source.search(keyword);
      
      const response = await fetch(url, { headers: source.headers });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch from ${source.name}: ${response.status} ${response.statusText}`);
      }
      
      // Handle the response based on source type
      let imageUrl;
      if (source.name === 'Placeholder') {
        // Placeholder service directly returns the image URL
        imageUrl = url;
      } else {
        // API response needs parsing
        const data = await response.json();
        imageUrl = source.parseResponse(data);
      }
      
      if (imageUrl) {
        console.log(`  Found image at: ${imageUrl}`);
        return imageUrl;
      }
    } catch (err) {
      console.error(`  Error with ${source.name}: ${err.message}`);
    }
  }
  
  // If all sources fail, return null
  console.log(`  No image found for keyword: ${keyword}`);
  return null;
}

/**
 * Download an image and save to the uploads directory
 * @param {string} url - Image URL
 * @param {string} filename - Target filename
 * @returns {Promise<string>} - Local path to the saved image
 */
async function downloadImage(url, filename) {
  try {
    const filepath = path.join(EVENT_IMAGES_DIR, filename);
    
    // Skip if file already exists
    try {
      await fs.access(filepath);
      console.log(`  File already exists: ${filepath}`);
      return filepath;
    } catch (err) {
      // Continue with download if file doesn't exist
    }
    
    console.log(`  Downloading image from ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    await fs.writeFile(filepath, Buffer.from(buffer));
    
    console.log(`  Saved image to ${filepath}`);
    return filepath;
  } catch (err) {
    console.error(`  Error downloading image: ${err.message}`);
    return null;
  }
}

/**
 * Get events for March 2025
 * @returns {Promise<Array>} - Array of events
 */
async function getMarchEvents() {
  try {
    const { rows } = await pool.query(`
      SELECT id, title, description, category, media_urls
      FROM events
      WHERE 
        extract(month from start_date) = 3 AND 
        extract(year from start_date) = 2025
      ORDER BY start_date ASC
    `);
    
    console.log(`Found ${rows.length} events in March 2025`);
    return rows;
  } catch (err) {
    console.error('Error getting March events:', err);
    return [];
  }
}

/**
 * Update the image URLs for an event
 * @param {number} eventId - Event ID
 * @param {string[]} mediaUrls - Array of media URLs
 */
async function updateEventMediaUrls(eventId, mediaUrls) {
  try {
    await pool.query(`
      UPDATE events
      SET media_urls = $1::text[]
      WHERE id = $2
    `, [mediaUrls, eventId]);
    
    console.log(`  Updated media URLs for event ID ${eventId}`);
  } catch (err) {
    console.error(`  Error updating media URLs for event ID ${eventId}:`, err);
  }
}

/**
 * Process March events and update their images in batches
 * @param {number} batchSize - Number of events to process per batch
 * @param {number} startIndex - Index to start from (for continuation)
 */
async function personalizeEventImages(batchSize = 20, startIndex = 0) {
  try {
    console.log('Starting personalized image update for March 2025 events (batch mode)');
    
    // Get March events
    const events = await getMarchEvents();
    console.log(`Total events: ${events.length}, starting from index ${startIndex}`);
    
    // Calculate batch end index
    const endIndex = Math.min(startIndex + batchSize, events.length);
    console.log(`Processing batch: ${startIndex} to ${endIndex - 1}`);
    
    // Mapping for similar events to avoid duplicate searches
    const imagesByTitle = new Map();
    
    // Process each event in the batch
    let processedCount = 0;
    
    for (let i = startIndex; i < endIndex; i++) {
      const event = events[i];
      try {
        console.log(`\nProcessing event [${i + 1}/${events.length}]: ${event.title}`);
        
        // Skip events that already have personalized images
        // We're assuming generic media_urls will be exactly the ones we've set before
        const hasGenericImages = 
          event.media_urls?.length === 2 && 
          (event.media_urls[0].includes('/social-1.jpg') ||
           event.media_urls[0].includes('/entertainment-1.jpg') ||
           event.media_urls[0].includes('/government-1.jpg'));
        
        if (event.media_urls && event.media_urls.length > 0 && !hasGenericImages) {
          console.log(`  Event already has personalized images`);
          continue;
        }
        
        // Check if we've already processed a similar event
        if (imagesByTitle.has(event.title)) {
          const mediaUrls = imagesByTitle.get(event.title);
          await updateEventMediaUrls(event.id, mediaUrls);
          console.log(`  Used existing images from similar event`);
          continue;
        }
        
        // Extract keywords from event description and title
        const keywords = extractKeywords(event.title, event.description);
        console.log(`  Extracted keywords: ${keywords.join(', ')}`);
        
        // Get images for the event (try each keyword)
        const eventImages = [];
        
        for (const keyword of keywords.slice(0, 2)) { // Limit to 2 keywords for efficiency
          // Create a safe filename based on the keyword and event ID
          const safeKeyword = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
          const filename = `${safeKeyword}-${event.id}-${Date.now()}.jpg`;
          
          // Find and download an image
          const imageUrl = await findImage(keyword);
          if (imageUrl) {
            const localPath = await downloadImage(imageUrl, filename);
            if (localPath) {
              // Convert to web path
              const webPath = `/uploads/events/${path.basename(localPath)}`;
              eventImages.push(webPath);
              
              // Break after getting 2 images
              if (eventImages.length >= 2) break;
            }
          }
        }
        
        // If we found at least one image, update the event
        if (eventImages.length > 0) {
          await updateEventMediaUrls(event.id, eventImages);
          
          // Remember these images for similar events
          imagesByTitle.set(event.title, eventImages);
          processedCount++;
        } else {
          console.log(`  Could not find any suitable images for event`);
        }
      } catch (err) {
        console.error(`  Error processing event ${event.id}:`, err);
      }
    }
    
    console.log('\nBatch processing completed');
    console.log(`Successfully updated ${processedCount} events in this batch`);
    console.log(`Next batch should start from index ${endIndex}`);
    
    return {
      totalEvents: events.length,
      processedInBatch: processedCount,
      nextStartIndex: endIndex,
      isComplete: endIndex >= events.length
    };
  } catch (err) {
    console.error('Error in personalizeEventImages:', err);
    return { error: err.message };
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the personalization process
personalizeEventImages().catch(console.error);