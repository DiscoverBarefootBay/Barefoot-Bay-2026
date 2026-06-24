/**
 * Targeted script to update specific March 20, 2025 events
 * This script improves on the previous approach with:
 * - Focus on small set of specific events (5 events)
 * - More descriptive keywords for better image matching
 * - Faster execution due to smaller scope
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
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=3&orientation=landscape`;
    
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
          const photoIndex = Math.floor(Math.random() * Math.min(3, data.photos.length)); // Random photo from results
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
        const photoIndex = Math.floor(Math.random() * Math.min(3, data.photos.length)); // Random photo from results
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

// Event ID to keyword mapping for our 5 target events
const TARGET_EVENTS = {
  // HYDRO EXERCISE
  341: ['hydro exercise', 'water therapy', 'pool exercise', 'aquatic workout'],
  
  // AQUATIC AEROBICS
  342: ['water aerobics', 'aquatic fitness', 'pool workout', 'water exercise class'],
  
  // AQUA ZUMBA
  343: ['aqua zumba', 'water dance', 'pool dance class', 'aquatic dance fitness'],
  
  // BEGINNER LINE DANCE
  344: ['line dancing', 'beginner dance', 'dance class', 'dance lessons'],
  
  // LINE DANCING
  345: ['country line dance', 'group dancing', 'dance choreography', 'line dance class']
};

/**
 * Process and personalize specific March 20 events
 */
async function personalizeSpecificEvents() {
  try {
    console.log('Starting personalization for specific March 20th events');
    
    // Process each target event
    let processedCount = 0;
    const eventIds = Object.keys(TARGET_EVENTS).map(id => parseInt(id));
    
    for (const eventId of eventIds) {
      try {
        console.log(`\nProcessing event ID ${eventId}`);
        
        // Get event details
        const { rows } = await pool.query(`
          SELECT title, description FROM events WHERE id = $1
        `, [eventId]);
        
        if (rows.length === 0) {
          console.log(`  Event ID ${eventId} not found`);
          continue;
        }
        
        const event = rows[0];
        console.log(`  Event title: ${event.title}`);
        
        // Get pre-defined keywords for this event
        const keywords = TARGET_EVENTS[eventId];
        console.log(`  Using keywords: ${keywords.join(', ')}`);
        
        // Get 2-3 images for the event
        const eventImages = [];
        
        // Shuffle keywords for variety
        const shuffledKeywords = keywords.sort(() => 0.5 - Math.random());
        
        for (const keyword of shuffledKeywords) {
          // Create a unique filename based on the keyword and event ID
          const safeKeyword = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
          const filename = `${safeKeyword}-${eventId}-${Date.now()}.jpg`;
          
          // Find and download an image
          const imageUrl = await findPexelsImage(keyword);
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
          
          // Add a short delay between keyword searches
          await delay(1000);
        }
        
        // If we found at least one image, update the event
        if (eventImages.length > 0) {
          await updateEventMediaUrls(eventId, eventImages);
          processedCount++;
        } else {
          console.log(`  Could not find any suitable images for event`);
        }
      } catch (err) {
        console.error(`  Error processing event ${eventId}:`, err);
      }
      
      // Add a delay between events to avoid rate limits
      await delay(2000);
    }
    
    console.log('\nSpecific event personalization completed');
    console.log(`Successfully updated ${processedCount} events out of ${eventIds.length}`);
    
  } catch (err) {
    console.error('Error in personalizeSpecificEvents:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the personalization process
personalizeSpecificEvents().catch(console.error);