/**
 * Quick script to update LINE DANCING event
 * with personalized images
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

// EVENT ID TO UPDATE
const EVENT_ID = 345; // LINE DANCING event

// KEYWORDS FOR THIS EVENT
const KEYWORDS = [
  'country line dance',
  'group dancing', 
  'dance choreography',
  'line dance class'
];

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Ensure uploads/events directory exists
const EVENT_IMAGES_DIR = './uploads/events';
if (!fs.existsSync(EVENT_IMAGES_DIR)) {
  fs.mkdirSync(EVENT_IMAGES_DIR, { recursive: true });
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
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=1&orientation=landscape`;
    
    const response = await fetch(url, { 
      headers: { 'Authorization': process.env.PEXELS_API_KEY }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from Pexels: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.photos && data.photos.length > 0) {
      const imageUrl = data.photos[0].src.large;
      console.log(`  Found image at: ${imageUrl}`);
      return imageUrl;
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

/**
 * Main function to update the LINE DANCING event
 */
async function updateLineDancingEvent() {
  try {
    console.log(`Starting personalization for LINE DANCING (ID: ${EVENT_ID})`);
    
    // Get event details to confirm
    const { rows } = await pool.query(
      'SELECT title FROM events WHERE id = $1',
      [EVENT_ID]
    );
    
    if (rows.length === 0) {
      console.log(`Event ID ${EVENT_ID} not found`);
      return;
    }
    
    console.log(`Event title: ${rows[0].title}`);
    console.log(`Using keywords: ${KEYWORDS.join(', ')}`);
    
    // Get images
    const eventImages = [];
    
    // Try each keyword with delay between attempts
    for (const keyword of KEYWORDS) {
      if (eventImages.length >= 2) break; // Stop after getting 2 images
      
      // Delay to respect API rate limits
      await delay(2000);
      
      // Create a unique filename
      const safeKeyword = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
      const filename = `${safeKeyword}-${EVENT_ID}-${Date.now()}.jpg`;
      
      // Find and download an image
      const imageUrl = await findPexelsImage(keyword);
      if (imageUrl) {
        const localPath = await downloadImage(imageUrl, filename);
        if (localPath) {
          // Convert to web path
          const webPath = `/uploads/events/${path.basename(localPath)}`;
          eventImages.push(webPath);
        }
      }
    }
    
    // Update the database if we found images
    if (eventImages.length > 0) {
      await updateEventMediaUrls(EVENT_ID, eventImages);
      console.log(`Successfully updated LINE DANCING with ${eventImages.length} images`);
    } else {
      console.log(`No images found for LINE DANCING`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the update
updateLineDancingEvent().catch(console.error);