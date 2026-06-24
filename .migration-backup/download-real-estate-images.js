/**
 * Download real estate images from Unsplash
 * 
 * This script:
 * 1. Downloads property images for different real estate categories
 * 2. Saves them to the uploads/Real Estate directory
 * 3. Generates a summary file with metadata to use when creating listings
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure we have the UNSPLASH_ACCESS_KEY
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!UNSPLASH_ACCESS_KEY) {
  console.error('Error: UNSPLASH_ACCESS_KEY environment variable is required');
  process.exit(1);
}

// Define categories to download
const REAL_ESTATE_CATEGORIES = [
  { type: 'FSBO', keywords: ['luxury home', 'residential house', 'single family home'], count: 5 },
  { type: 'Agent', keywords: ['modern house', 'contemporary home', 'residential property'], count: 5 },
  { type: 'Rent', keywords: ['apartment rental', 'condo', 'townhouse'], count: 5 },
  { type: 'OpenHouse', keywords: ['open house real estate', 'home tour', 'property viewing'], count: 5 },
  { type: 'Wanted', keywords: ['dream home', 'house hunting', 'property search'], count: 5 },
  { type: 'Classified', keywords: ['home office', 'garage sale', 'home furniture'], count: 5 },
];

// Ensure the directory exists
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'Real Estate');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Find images on Unsplash for a given keyword
 * @param {string} keyword - Search keyword
 * @param {number} count - Number of images to retrieve
 * @returns {Promise<Array>} - Array of image data or empty array if none found
 */
async function findUnsplashImages(keyword, count = 1) {
  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error(`Error finding images for "${keyword}":`, error.message);
    return [];
  }
}

/**
 * Download an image and save to the uploads directory
 * @param {string} url - Image URL
 * @param {string} filename - Target filename
 * @param {Object} metadata - Image metadata to save
 * @returns {Promise<string>} - Local path to the saved image
 */
async function downloadImage(url, filename, metadata) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const filePath = path.join(UPLOAD_DIR, filename);
    await pipeline(response.body, createWriteStream(filePath));

    // Save metadata alongside the image
    const metadataPath = path.join(UPLOAD_DIR, `${path.parse(filename).name}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`Downloaded: ${filename}`);
    return `/uploads/Real Estate/${filename}`;
  } catch (error) {
    console.error(`Error downloading image ${filename}:`, error.message);
    return null;
  }
}

/**
 * Main function to download all required images
 */
async function downloadAllRealEstateImages() {
  console.log('Starting to download real estate images...');
  
  const results = {
    FSBO: [],
    Agent: [],
    Rent: [],
    OpenHouse: [],
    Wanted: [],
    Classified: []
  };

  // Process each category
  for (const category of REAL_ESTATE_CATEGORIES) {
    console.log(`\nProcessing category: ${category.type}`);
    
    // Process each keyword for this category
    for (const keyword of category.keywords) {
      const images = await findUnsplashImages(keyword, Math.ceil(category.count / category.keywords.length));
      
      // Download each image
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const filename = `${category.type.toLowerCase()}-${keyword.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}-${i}.jpg`;
        
        const metadata = {
          id: image.id,
          type: category.type,
          keyword: keyword,
          description: image.description || image.alt_description || keyword,
          width: image.width,
          height: image.height,
          color: image.color,
          user: {
            name: image.user.name,
            username: image.user.username,
            portfolio_url: image.user.portfolio_url
          },
          urls: image.urls,
          links: image.links
        };
        
        const localPath = await downloadImage(image.urls.regular, filename, metadata);
        if (localPath) {
          results[category.type].push({
            path: localPath,
            metadata
          });
        }
      }
    }

    console.log(`Downloaded ${results[category.type].length} images for ${category.type}`);
  }

  // Save the overall summary
  const summaryPath = path.join(UPLOAD_DIR, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\nSummary saved to ${summaryPath}`);

  return results;
}

// Run the main function if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  downloadAllRealEstateImages()
    .then(() => console.log('All images downloaded successfully!'))
    .catch(err => console.error('Error downloading images:', err));
}

export { downloadAllRealEstateImages };