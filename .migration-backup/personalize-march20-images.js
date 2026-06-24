/**
 * Personalized event image script for March 20, 2025 events using Unsplash API
 * 
 * This script:
 * 1. Filters only March 20, 2025 events
 * 2. Analyzes event description to identify keywords
 * 3. Downloads appropriate images from Unsplash API for each event
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

// Unsplash API configuration
const UNSPLASH_API = {
  name: 'Unsplash',
  search: (keyword) => `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=2`,
  headers: { 'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
  parseResponse: (data) => data.results.map(photo => photo.urls.regular)
};

// Fallback placeholder (only if Unsplash fails)
const PLACEHOLDER_API = {
  name: 'Placeholder',
  search: (keyword) => `https://placehold.co/800x600/random?text=${encodeURIComponent(keyword)}`,
  headers: {},
  parseResponse: (url) => [url]
};

// Keywords mapping to help find relevant images
const KEYWORD_MAP = {
  'swimming': ['swimming pool', 'lap pool', 'water exercise'],
  'dancing': ['dancing', 'ballroom dance', 'dance class'],
  'yoga': ['yoga class', 'yoga pose', 'meditation'],
  'exercise': ['fitness class', 'exercise', 'workout'],
  'cards': ['card game', 'playing cards', 'bridge game'],
  'bingo': ['bingo game', 'senior bingo', 'game night'],
  'bocce': ['bocce ball', 'lawn bowling', 'outdoor game'],
  'craft': ['craft workshop', 'crafting', 'handmade'],
  'sewing': ['sewing class', 'quilting', 'fabric crafts'],
  'pottery': ['pottery class', 'ceramics', 'clay art'],
  'cooking': ['cooking class', 'culinary', 'kitchen'],
  'golf': ['golf course', 'golfing', 'golf club'],
  'book': ['book club', 'reading group', 'library'],
  'music': ['live music', 'concert', 'musical performance'],
  'art': ['art exhibition', 'painting', 'gallery'],
  'tennis': ['tennis court', 'tennis game', 'racket sport'],
  'pickleball': ['pickleball court', 'paddle sport', 'racket game'],
  'karaoke': ['karaoke night', 'singing', 'microphone'],
  'dinner': ['community dinner', 'restaurant', 'dining'],
  'meeting': ['community meeting', 'town hall', 'discussion'],
  'coffee': ['coffee morning', 'cafe', 'coffee social'],
  'community': ['community event', 'neighborhood gathering', 'social event'],
  'party': ['community party', 'celebration', 'festive gathering'],
  'movie': ['movie night', 'cinema', 'outdoor movie'],
  'potluck': ['potluck dinner', 'food sharing', 'community meal'],
  'breakfast': ['breakfast event', 'morning meal', 'brunch'],
  'lunch': ['community lunch', 'midday meal', 'luncheon'],
  'workshop': ['community workshop', 'learning class', 'hands-on'],
  'meditation': ['meditation class', 'mindfulness', 'relaxation'],
  'billiards': ['pool table', 'billiards game', 'pool hall'],
  'chess': ['chess game', 'chess club', 'board game'],
  'poker': ['poker game', 'card tournament', 'casino night'],
  'cycling': ['bike ride', 'cycling group', 'bicycle club'],
  'walking': ['walking group', 'nature walk', 'hiking trail'],
  'darts': ['dart game', 'dart board', 'dart tournament'],
  'fitness': ['fitness class', 'gym workout', 'exercise group'],
  'gardening': ['community garden', 'gardening club', 'plants'],
  'photography': ['photography club', 'camera group', 'photo walk'],
  'singing': ['singing group', 'choir', 'vocal performance'],
  'bible': ['bible study', 'prayer group', 'religious gathering'],
  'drama': ['drama club', 'theater group', 'acting class'],
  'painting': ['painting class', 'art studio', 'watercolor'],
  'drawing': ['drawing class', 'sketch group', 'illustration'],
  'zumba': ['zumba class', 'dance fitness', 'exercise dance'],
  'computer': ['computer class', 'technology workshop', 'digital learning']
};

/**
 * Extract relevant keywords from text
 * @param {string} title - Event title
 * @param {string} description - Event description
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
      // Also add the most relevant synonym for better search results
      for (const synonym of synonyms) {
        if (combinedText.includes(synonym.toLowerCase())) {
          matches.push(synonym);
          break;
        }
      }
    }
  }
  
  // If no matches, extract words from the title as keywords
  if (matches.length === 0) {
    // Get significant words from title (ignore common words)
    const titleWords = title.toLowerCase().split(/\\s+/)
      .filter(word => word.length > 3 && !['and', 'the', 'with', 'from', 'that', 'this', 'for'].includes(word));
    
    if (titleWords.length > 0) {
      matches.push(...titleWords.slice(0, 2)); // Use up to 2 words from title
    } else {
      matches.push('community event'); // Fallback to "community event" if no good keywords
    }
  }
  
  return matches;
}

/**
 * Find images on Unsplash for a given keyword
 * @param {string} keyword - Search keyword
 * @returns {Promise<string[]>} - Array of image URLs or empty array if none found
 */
async function findUnsplashImages(keyword) {
  console.log(`  Searching Unsplash for images with keyword: ${keyword}`);
  
  try {
    const url = UNSPLASH_API.search(keyword);
    const response = await fetch(url, { headers: UNSPLASH_API.headers });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from Unsplash: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const imageUrls = UNSPLASH_API.parseResponse(data);
    
    if (imageUrls && imageUrls.length > 0) {
      console.log(`  Found ${imageUrls.length} images on Unsplash`);
      return imageUrls;
    }
    
    console.log(`  No images found on Unsplash for keyword: ${keyword}`);
    return [];
  } catch (err) {
    console.error(`  Error with Unsplash API: ${err.message}`);
    
    // Try fallback to placeholder if Unsplash fails
    try {
      console.log(`  Using placeholder as fallback`);
      const url = PLACEHOLDER_API.search(keyword);
      return PLACEHOLDER_API.parseResponse(url);
    } catch (placeholderErr) {
      console.error(`  Placeholder fallback also failed: ${placeholderErr.message}`);
      return [];
    }
  }
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
 * Get events for March 20, 2025
 * @returns {Promise<Array>} - Array of events
 */
async function getMarch20Events() {
  try {
    const { rows } = await pool.query(`
      SELECT id, title, description, category, media_urls
      FROM events
      WHERE 
        extract(month from start_date) = 3 AND 
        extract(day from start_date) = 20 AND
        extract(year from start_date) = 2025
      ORDER BY start_date ASC
    `);
    
    console.log(`Found ${rows.length} events on March 20, 2025`);
    return rows;
  } catch (err) {
    console.error('Error getting March 20 events:', err);
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
 * Process March 20 events and update their images
 */
async function personalizeMarch20EventImages() {
  try {
    console.log('Starting personalized image update for March 20, 2025 events');
    
    // Get March 20 events
    const events = await getMarch20Events();
    
    if (events.length === 0) {
      console.log('No events found for March 20, 2025');
      return { totalEvents: 0, processed: 0 };
    }
    
    console.log(`Found ${events.length} events for March 20, 2025`);
    
    // Process each event
    let processedCount = 0;
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      try {
        console.log(`\nProcessing event [${i + 1}/${events.length}]: ${event.title}`);
        
        // Extract keywords from event description and title
        const keywords = extractKeywords(event.title, event.description || '');
        console.log(`  Extracted keywords: ${keywords.join(', ')}`);
        
        // Get images for the event (try each keyword)
        const eventImages = [];
        
        for (const keyword of keywords.slice(0, 2)) { // Limit to 2 keywords for efficiency
          if (eventImages.length >= 2) break; // Stop if we already have 2 images
          
          // Create a safe filename based on the keyword and event ID
          const safeKeyword = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
          
          // Find images on Unsplash
          const unsplashImages = await findUnsplashImages(keyword);
          
          for (let i = 0; i < unsplashImages.length && eventImages.length < 2; i++) {
            const imageUrl = unsplashImages[i];
            const filename = `${safeKeyword}-${event.id}-${Date.now()}-${i}.jpg`;
            
            const localPath = await downloadImage(imageUrl, filename);
            if (localPath) {
              // Convert to web path
              const webPath = `/uploads/events/${path.basename(localPath)}`;
              eventImages.push(webPath);
            }
          }
        }
        
        // If we found at least one image, update the event
        if (eventImages.length > 0) {
          await updateEventMediaUrls(event.id, eventImages);
          processedCount++;
        } else {
          console.log(`  Could not find any suitable images for event`);
        }
      } catch (err) {
        console.error(`  Error processing event ${event.id}:`, err);
      }
    }
    
    console.log('\nProcessing completed');
    console.log(`Successfully updated ${processedCount} out of ${events.length} events`);
    
    return {
      totalEvents: events.length,
      processed: processedCount
    };
  } catch (err) {
    console.error('Error in personalizeMarch20EventImages:', err);
    return { error: err.message };
  } finally {
    // Close DB connection
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the personalization process
personalizeMarch20EventImages().catch(console.error);