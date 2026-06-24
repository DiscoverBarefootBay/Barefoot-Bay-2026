/**
 * Personalized event image script (CommonJS version)
 * 
 * This script:
 * 1. Filters only March 2025 events
 * 2. Analyzes event description to identify keywords
 * 3. Downloads appropriate open source images for each event
 * 4. Updates the media URLs in the database
 */

const pg = require('pg');
const fs = require('fs');
const path = require('path');
// Use a different HTTP client since node-fetch is ESM-only
const http = require('http');
const https = require('https');
const { URL } = require('url');

// Simple fetch replacement using native http/https modules
async function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, {
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

const { Pool } = pg;

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
 * Simple delay function
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
      
      // Add a delay before each API request to avoid rate limiting
      if (source.name === 'Pexels') {
        console.log(`  Adding delay before Pexels API request to avoid rate limits...`);
        await delay(1500); // 1.5 second delay for Pexels API
      }
      
      const response = await fetch(url, { headers: source.headers });
      
      if (!response.ok) {
        if (response.status === 429) {
          console.log(`  Rate limit hit with ${source.name}. Will try again later.`);
          // Longer delay on rate limit
          await delay(5000);
          // Try one more time
          console.log(`  Retrying ${source.name} after delay...`);
          const retryResponse = await fetch(url, { headers: source.headers });
          if (!retryResponse.ok) {
            throw new Error(`Failed to fetch from ${source.name} after retry: ${retryResponse.status} ${retryResponse.statusText}`);
          }
          
          // Handle the retry response
          let imageUrl;
          if (source.name === 'Placeholder') {
            imageUrl = url;
          } else {
            const data = await retryResponse.json();
            imageUrl = source.parseResponse(data);
          }
          
          if (imageUrl) {
            console.log(`  Found image at: ${imageUrl}`);
            return imageUrl;
          }
        } else {
          throw new Error(`Failed to fetch from ${source.name}: ${response.status} ${response.statusText}`);
        }
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
    if (fs.existsSync(filepath)) {
      console.log(`  File already exists: ${filepath}`);
      return filepath;
    }
    
    console.log(`  Downloading image from ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
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

/**
 * Get events specific to March 20, 2025
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
 * Enhanced keyword extraction with deeper analysis
 * @param {string} title - Event title
 * @param {string} description - Event description
 * @returns {string[]} - Array of specific relevant keywords
 */
function extractEnhancedKeywords(title, description) {
  const combinedText = (title + ' ' + description).toLowerCase();
  const matches = [];
  
  // Enhanced keyword mapping with more specific terms for better image matching
  const enhancedKeywords = {
    'swimming': ['lap swimming', 'pool swimmer', 'swimming pool', 'swim lanes'],
    'aqua': ['aqua fitness', 'water fitness', 'pool exercise', 'aquatic therapy'],
    'aerobics': ['aquatic aerobics', 'water aerobics', 'pool fitness class'],
    'zumba': ['aqua zumba', 'water dance', 'pool dance workout'],
    'dance': ['line dancing', 'dance class', 'group dancing', 'dance studio'],
    'bible': ['bible study', 'scripture study', 'women bible group'],
    'quilt': ['quilting class', 'quilt making', 'fabric quilting'],
    'sewing': ['sewing workshop', 'needle craft', 'fabric crafting'],
    'ringers': ['horseshoe game', 'horseshoe pitching', 'outdoor game'],
    'billiards': ['pool table', 'billiards game', 'pool hall'] 
  };
  
  // Check for keywords in both normal and enhanced maps
  for (const [key, synonyms] of Object.entries({...KEYWORD_MAP, ...enhancedKeywords})) {
    if ([key, ...synonyms].some(term => combinedText.includes(term.toLowerCase()))) {
      matches.push(key);
      // Also add the specific matching synonyms for more precise searches
      synonyms.forEach(synonym => {
        if (combinedText.includes(synonym.toLowerCase())) {
          matches.push(synonym);
        }
      });
    }
  }
  
  // Look for activity descriptors (adjective + noun)
  const activityRegex = /(peaceful|invigorating|gentle|energetic|vibrant|serene|tranquil|relaxing) (exercise|workout|session|class|practice|activity)/g;
  let match;
  while ((match = activityRegex.exec(combinedText)) !== null) {
    matches.push(match[0]);
  }
  
  // Extract location if mentioned (e.g., "Area: Pool 1")
  const areaMatch = /area: ([^:]+):/i.exec(combinedText);
  if (areaMatch) {
    const area = areaMatch[1].trim().toLowerCase();
    if (area.includes('pool')) {
      matches.push('swimming pool');
    } else if (area.includes('build')) {
      matches.push('community center');
    }
  }
  
  // If still no matches, use title words
  if (matches.length === 0) {
    const titleWords = title.toLowerCase().split(/\s+/)
      .filter(word => word.length > 3 && !['and', 'the', 'with', 'from', 'that', 'this', 'for'].includes(word));
    matches.push(...titleWords);
  }
  
  // Return unique keywords
  return Array.from(new Set(matches));
}

/**
 * Process and personalize March 20 events specifically
 */
async function personalizeMarch20Events() {
  try {
    console.log('Starting March 20th specific image personalization');
    
    // Get the events
    const events = await getMarch20Events();
    
    // Process each event
    let processedCount = 0;
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      try {
        console.log(`\nProcessing event [${i + 1}/${events.length}]: ${event.title} (ID: ${event.id})`);
        
        // Extract keywords using enhanced analysis
        const keywords = extractEnhancedKeywords(event.title, event.description);
        console.log(`  Extracted enhanced keywords: ${keywords.join(', ')}`);
        
        // Get multiple images for the event
        const eventImages = [];
        
        // Use up to 3 distinct keywords to find varied images
        // Shuffle to get different keywords each time
        const shuffledKeywords = keywords.sort(() => 0.5 - Math.random()).slice(0, 3);
        
        for (const keyword of shuffledKeywords) {
          // Create a unique filename based on the keyword and event ID
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
              
              // Break after getting 2-3 images
              if (eventImages.length >= 2) break;
            }
          }
          
          // Add a delay between searches
          await delay(500);
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
      
      // Add a delay between events to avoid rate limits
      await delay(2000);
    }
    
    console.log('\nMarch 20th personalization completed');
    console.log(`Successfully updated ${processedCount} events out of ${events.length}`);
    
  } catch (err) {
    console.error('Error in personalizeMarch20Events:', err);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'batch'; // Default to batch processing
const startIndex = parseInt(args[1]) || 33; // Default to where we left off
const batchSize = parseInt(args[2]) || 20;  // Default batch size

// Execute the appropriate command
if (command === 'march20') {
  personalizeMarch20Events().catch(console.error);
} else {
  // Default: run the general batch processing
  personalizeEventImages(batchSize, startIndex).catch(console.error);
}