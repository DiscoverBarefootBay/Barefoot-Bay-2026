/**
 * Download community-oriented stock images from Unsplash
 * 
 * This script:
 * 1. Downloads images for various community activities from Unsplash API
 * 2. Saves them to the uploads/Stock Images directory
 * 3. Ensures proper naming and organization
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// Ensure Stock Images directory exists
const STOCK_IMAGES_DIR = './uploads/Stock Images';
if (!existsSync(STOCK_IMAGES_DIR)) {
  try {
    fs.mkdir(STOCK_IMAGES_DIR, { recursive: true });
    console.log(`Created directory: ${STOCK_IMAGES_DIR}`);
  } catch (err) {
    console.error(`Error creating directory: ${err.message}`);
  }
}

// Unsplash API configuration
const UNSPLASH_API = {
  search: (keyword) => `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=2&orientation=landscape`,
  headers: { 'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
  parseResponse: (data) => data.results.map(photo => ({
    url: photo.urls.regular,
    description: photo.description || photo.alt_description || '',
    photographer: photo.user.name,
    photographerUrl: photo.user.links.html
  }))
};

// List of activity categories we want images for
const ACTIVITY_CATEGORIES = [
  { name: 'Golf', query: 'golf course community' },
  { name: 'Tennis', query: 'tennis court community' },
  { name: 'Pools', query: 'community swimming pool' },
  { name: 'Clubhouse', query: 'community clubhouse' },
  { name: 'Quilting', query: 'quilting group seniors' },
  { name: 'Softball', query: 'senior softball game' },
  { name: 'Swimming', query: 'seniors swimming' },
  { name: 'Marco Polo', query: 'pool game water fun' },
  { name: 'Women Darts', query: 'women playing darts' },
  { name: 'Darts', query: 'darts game community' },
  { name: 'Line Dancing', query: 'senior line dancing' },
  { name: 'Horseshoe', query: 'horseshoe game seniors' },
  { name: 'Ladies Bible', query: 'women bible study group' }
];

/**
 * Find images on Unsplash for a given keyword
 * @param {string} keyword - Search keyword
 * @returns {Promise<Array>} - Array of image data or empty array if none found
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
    const imageData = UNSPLASH_API.parseResponse(data);
    
    if (imageData && imageData.length > 0) {
      console.log(`  Found ${imageData.length} images on Unsplash`);
      return imageData;
    }
    
    console.log(`  No images found on Unsplash for keyword: ${keyword}`);
    return [];
  } catch (err) {
    console.error(`  Error with Unsplash API: ${err.message}`);
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
    const filepath = path.join(STOCK_IMAGES_DIR, filename);
    const metadataPath = path.join(STOCK_IMAGES_DIR, `${path.parse(filename).name}.json`);
    
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
    
    // Save metadata
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`  Saved image to ${filepath}`);
    return filepath;
  } catch (err) {
    console.error(`  Error downloading image: ${err.message}`);
    return null;
  }
}

/**
 * Main function to download all required images
 */
async function downloadAllStockImages() {
  console.log('Starting community stock image download...');
  
  const results = {
    successful: 0,
    failed: 0,
    categories: []
  };
  
  for (const category of ACTIVITY_CATEGORIES) {
    console.log(`\nProcessing category: ${category.name}`);
    
    try {
      const images = await findUnsplashImages(category.query);
      
      if (images.length === 0) {
        console.log(`  No images found for ${category.name}`);
        results.failed++;
        results.categories.push({
          name: category.name,
          status: 'failed',
          error: 'No images found'
        });
        continue;
      }
      
      const categoryImages = [];
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const sanitizedName = category.name.toLowerCase().replace(/\s+/g, '-');
        const filename = `${sanitizedName}-${i+1}.jpg`;
        
        const metadata = {
          category: category.name,
          query: category.query,
          description: image.description,
          photographer: image.photographer,
          photographerUrl: image.photographerUrl,
          source: 'Unsplash',
          downloadedAt: new Date().toISOString()
        };
        
        const localPath = await downloadImage(image.url, filename, metadata);
        
        if (localPath) {
          const webPath = `/uploads/Stock Images/${path.basename(localPath)}`;
          categoryImages.push(webPath);
        }
      }
      
      if (categoryImages.length > 0) {
        results.successful++;
        results.categories.push({
          name: category.name,
          status: 'success',
          imageCount: categoryImages.length,
          paths: categoryImages
        });
      } else {
        results.failed++;
        results.categories.push({
          name: category.name,
          status: 'failed',
          error: 'Failed to download images'
        });
      }
    } catch (err) {
      console.error(`  Error processing category ${category.name}:`, err);
      results.failed++;
      results.categories.push({
        name: category.name,
        status: 'failed',
        error: err.message
      });
    }
  }
  
  console.log('\nDownload summary:');
  console.log(`Successfully downloaded images for ${results.successful} categories`);
  console.log(`Failed to download images for ${results.failed} categories`);
  
  // Save results to a summary file
  try {
    const summaryPath = path.join(STOCK_IMAGES_DIR, 'download-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(results, null, 2));
    console.log(`Summary saved to ${summaryPath}`);
  } catch (err) {
    console.error(`Error saving summary: ${err.message}`);
  }
  
  return results;
}

// Execute the main function
downloadAllStockImages()
  .then(() => console.log('Stock image download complete!'))
  .catch(err => console.error('Error in main execution:', err));