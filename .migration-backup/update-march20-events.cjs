/**
 * Script to update March 20, 2025 events with personalized images based on description
 * 
 * This script:
 * 1. Identifies all events on March 20, 2025
 * 2. Analyzes each event description for meaningful keywords
 * 3. Downloads relevant images from Pexels API
 * 4. Updates each event with multiple unique images
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Ensure uploads/events directory exists
const EVENT_IMAGES_DIR = './uploads/events';
if (!fs.existsSync(EVENT_IMAGES_DIR)) {
  fs.mkdirSync(EVENT_IMAGES_DIR, { recursive: true });
  console.log(`Created directory: ${EVENT_IMAGES_DIR}`);
}

// Simple fetch replacement using native https module
async function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      const chunks = [];
      
      res.on('data', (chunk) => chunks.push(chunk));
      
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          buffer: () => Promise.resolve(body),
          json: () => Promise.resolve(JSON.parse(body.toString()))
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Specific keywords mapping for March 20 events
// Extended with more detailed keywords for better image matching
const KEYWORD_MAP = {
  'swimming': ['swimming', 'lap swimming', 'pool swimmer', 'swimming workout', 'pool lane swimming'],
  'aqua': ['aqua fitness', 'water fitness', 'pool exercise', 'aquatic workout', 'water aerobics'],
  'hydro': ['hydro exercise', 'water therapy', 'aquatic exercise', 'pool therapy', 'therapeutic swimming'],
  'aerobics': ['water aerobics', 'pool fitness', 'aqua aerobics', 'water workout', 'aquatic fitness class'],
  'zumba': ['aqua zumba', 'water dancing', 'pool dance workout', 'zumba fitness', 'dance exercise in water'],
  'dance': ['line dancing', 'country line dance', 'group dancing', 'dance class', 'choreographed dance'],
  'bible': ['bible study', 'women bible study', 'scripture reading', 'faith group', 'spiritual meeting'],
  'quilt': ['quilting', 'sewing class', 'fabric art', 'quilt making', 'textile crafts'],
  'sewing': ['sewing workshop', 'stitch craft', 'sewing machine', 'fabric crafting', 'needle arts'],
  'ringers': ['horseshoe game', 'horseshoe throwing', 'ringers club', 'horseshoe competition', 'outdoor game'],
  'bocce': ['bocce ball', 'lawn bowling', 'bocce court', 'italian bowling', 'outdoor bocce'],
  'crafts': ['arts and crafts', 'craft workshop', 'creative arts', 'handmade crafts', 'craft supplies'],
  'cards': ['card games', 'playing cards', 'bridge game', 'card tournament', 'card players'],
  'billiards': ['pool table', 'billiards game', 'pool cue', 'billiards competition', 'playing pool'],
  'pickleball': ['pickleball court', 'pickleball players', 'paddle sport', 'pickleball game', 'racket sport'],
  'yoga': ['yoga class', 'yoga poses', 'yoga meditation', 'yoga outdoors', 'yoga practice']
};

/**
 * Extract highly specific keywords from an event's title and description
 * @param {string} title - Event title
 * @param {string} description - Event description
 * @returns {string[]} - Array of specific relevant keywords
 */
function extractDetailedKeywords(title, description) {
  const combinedText = (title + ' ' + description).toLowerCase();
  const matches = [];
  
  // Check for each keyword in our map
  for (const [key, synonyms] of Object.entries(KEYWORD_MAP)) {
    // Check the main keyword and all synonyms
    if ([key, ...synonyms].some(term => combinedText.includes(term.toLowerCase()))) {
      // Use the synonyms directly rather than just the key for better specificity
      synonyms.forEach(synonym => {
        if (combinedText.includes(synonym.toLowerCase())) {
          matches.push(synonym);
        }
      });
      // Also add the main key
      matches.push(key);
    }
  }
  
  // If no matches, extract meaningful phrases from description
  if (matches.length === 0) {
    // Look for descriptive phrases in quotes
    const descriptiveRegex = /"([^"]+)"/g;
    let descriptiveMatch;
    while ((descriptiveMatch = descriptiveRegex.exec(combinedText)) !== null) {
      matches.push(descriptiveMatch[1]);
    }
    
    // Look for phrases with adjectives
    const adjectiveRegex = /(beautiful|stunning|tranquil|peaceful|energetic|vibrant|exciting|relaxing|refreshing|calming|invigorating|serene) ([a-z]+)/g;
    let adjectiveMatch;
    while ((adjectiveMatch = adjectiveRegex.exec(combinedText)) !== null) {
      matches.push(adjectiveMatch[0]);
    }
    
    // Extract location if available ("Area: X")
    const areaMatch = /area: ([^:]+):/i.exec(combinedText);
    if (areaMatch) {
      matches.push(areaMatch[1].trim());
    }
  }
  
  // If still no matches, use words from title
  if (matches.length === 0) {
    const titleWords = title.toLowerCase().split(/\s+/)
      .filter(word => word.length > 3 && !['and', 'the', 'with', 'from', 'that', 'this', 'for'].includes(word));
    matches.push(...titleWords);
  }
  
  // Return unique keywords
  return Array.from(new Set(matches));
}

/**
 * Simple delay function
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Try to get an image from Pexels using a specific keyword
 * @param {string} keyword - Search keyword
 * @returns {Promise<string|null>} - Image URL or null if not found
 */
async function findPexelsImage(keyword) {
  console.log(`  Searching for image with keyword: ${keyword}`);
  
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=2&orientation=landscape`;
    
    // Add delay to avoid hitting rate limits
    await delay(1800); // 1.8 second delay between API calls
    
    const response = await fetch(url, { 
      headers: { 'Authorization': process.env.PEXELS_API_KEY }
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        console.log(`  Rate limit hit. Waiting 8 seconds before retry...`);
        await delay(8000);
        // Try again after waiting
        const retryResponse = await fetch(url, { 
          headers: { 'Authorization': process.env.PEXELS_API_KEY }
        });
        
        if (!retryResponse.ok) {
          throw new Error(`Failed after retry: ${retryResponse.status}`);
        }
        
        const data = await retryResponse.json();
        if (data.photos && data.photos.length > 0) {
          const photoIndex = Math.floor(Math.random() * Math.min(2, data.photos.length)); // Random photo from results
          const imageUrl = data.photos[photoIndex].src.large;
          console.log(`  Found image at: ${imageUrl}`);
          return imageUrl;
        }
      } else {
        throw new Error(`Failed to fetch from Pexels: ${response.status}`);
      }
    } else {
      const data = await response.json();
      if (data.photos && data.photos.length > 0) {
        const photoIndex = Math.floor(Math.random() * Math.min(2, data.photos.length)); // Random photo from results
        const imageUrl = data.photos[photoIndex].src.large;
        console.log(`  Found image at: ${imageUrl}`);
        return imageUrl;
      }
    }
  } catch (err) {
    console.error(`  Error with Pexels: ${err.message}`);
  }
  
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
    if (fs.existsSync(filepath)) {
      console.log(`  File already exists: ${filepath}`);
      return filepath;
    }
    
    console.log(`  Downloading image from ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    
    const buffer = await response.buffer();
    fs.writeFileSync(filepath, buffer);
    
    console.log(`  Saved image to ${filepath}`);
    return filepath;
  } catch (err) {
    console.error(`  Error downloading image: ${err.message}`);
    return null;
  }
}

/**
 * Get all events for March 20, 2025
 * @returns {Promise<Array>} - Array of events
 */
async function getMarch20Events() {
  try {
    const { rows } = await pool.query(`
      SELECT id, title, description, category, media_urls
      FROM events
      WHERE DATE(start_date) = '2025-03-20'
      ORDER BY id ASC
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
    
    // Process each event
    let processedCount = 0;
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      try {
        console.log(`\nProcessing event [${i + 1}/${events.length}]: ${event.title} (ID: ${event.id})`);
        
        // Extract detailed keywords from event description and title
        const keywords = extractDetailedKeywords(event.title, event.description);
        console.log(`  Extracted detailed keywords: ${keywords.join(', ')}`);
        
        // Get 2-3 images for the event (try different keywords)
        const eventImages = [];
        
        // Try up to 3 keywords if available (shuffle to get variety)
        const shuffledKeywords = keywords.sort(() => 0.5 - Math.random()).slice(0, 3);
        
        for (const keyword of shuffledKeywords) {
          // Create a unique filename based on the keyword and event ID
          const safeKeyword = keyword.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
          const filename = `${safeKeyword}-${event.id}-${Date.now()}.jpg`;
          
          // Find and download an image
          const imageUrl = await findPexelsImage(keyword);
          if (imageUrl) {
            const localPath = await downloadImage(imageUrl, filename);
            if (localPath) {
              // Convert to web path
              const webPath = `/uploads/events/${path.basename(localPath)}`;
              eventImages.push(webPath);
              
              // Break after getting 3 images
              if (eventImages.length >= 3) break;
            }
          }
          
          // Add a short delay between keyword searches
          await delay(1000);
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
    console.log(`Successfully updated ${processedCount} events out of ${events.length}`);
    
  } catch (err) {
    console.error('Error in personalizeMarch20EventImages:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the personalization process
personalizeMarch20EventImages().catch(console.error);