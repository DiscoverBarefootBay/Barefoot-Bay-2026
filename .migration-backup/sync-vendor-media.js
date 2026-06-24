/**
 * Sync Vendor Media
 * 
 * This script fetches vendor pages from the production site and
 * downloads any media files found in the content to ensure they're 
 * available in the development environment.
 * 
 * Usage: node sync-vendor-media.js [vendor-slug] [--dry-run]
 * Example: node sync-vendor-media.js services-dan-hess-antiques-estate-sales
 * Example: node sync-vendor-media.js all
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

// Configuration
const PRODUCTION_URL = 'https://barefootbay.com';
const VENDOR_CATEGORIES = [
  'food-dining',
  'landscaping',
  'home-services',
  'professional-services',
  'retail',
  'automotive',
  'technology',
  'other'
];
const MEDIA_DIRS = [
  'content-media',
  'vendor-media',
  'forum-media',
  'community-media',
  'attached_assets',
  'avatars',
  'icons',
  'banner-slides',
  'calendar'
];

// Ensure all directories exist
function ensureDirectoriesExist() {
  console.log('Ensuring directories exist...');
  for (const dir of MEDIA_DIRS) {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// Extract image URLs from HTML content
function extractImageUrls(html) {
  if (!html) return [];
  
  const urls = new Set();
  
  // Extract from img tags
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (isMediaUrl(src)) {
      urls.add(src);
    }
  }
  
  // Extract from background-image styles
  const bgRegex = /background-image:\s*url\(['"]?([^'")]+)['"]?\)/g;
  while ((match = bgRegex.exec(html)) !== null) {
    const url = match[1];
    if (isMediaUrl(url)) {
      urls.add(url);
    }
  }
  
  return Array.from(urls);
}

// Check if URL is a media URL
function isMediaUrl(url) {
  if (!url) return false;
  if (!url.startsWith('/')) return false;
  
  return MEDIA_DIRS.some(dir => {
    return url.startsWith(`/${dir}/`) || url === `/${dir}`;
  });
}

// Download a file
function downloadFile(url, localPath) {
  return new Promise((resolve, reject) => {
    // Create directory if it doesn't exist
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Skip if file exists
    if (fs.existsSync(localPath)) {
      console.log(`File already exists: ${localPath}`);
      return resolve({ success: true, skipped: true });
    }
    
    console.log(`Downloading ${url} -> ${localPath}`);
    
    const file = fs.createWriteStream(localPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(localPath);
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close(() => {
          console.log(`Downloaded successfully: ${localPath}`);
          resolve({ success: true });
        });
      });
      
      file.on('error', (err) => {
        file.close();
        fs.unlinkSync(localPath);
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(localPath);
      reject(err);
    });
  });
}

// Process a single vendor
async function processVendor(category, slug, options = {}) {
  const { dryRun = false, verbose = true } = options;
  
  try {
    console.log(`Processing vendor: ${category}/${slug}...`);
    
    // Fetch vendor page HTML
    const url = `${PRODUCTION_URL}/vendors/${category}/${slug}`;
    console.log(`Fetching URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error fetching vendor ${slug}: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    
    if (verbose) {
      console.log(`Received HTML content length: ${html.length} characters`);
      
      // Find content-media mentions
      const mediaPattern = /content-media\/[^"'\s]+/g;
      const mediaMatches = html.match(mediaPattern);
      if (mediaMatches) {
        console.log("Found raw content-media references:", mediaMatches);
      } else {
        console.log("No raw content-media references found in HTML");
      }
    }
    
    // Extract image URLs from HTML
    const mediaUrls = extractImageUrls(html);
    
    console.log(`Found ${mediaUrls.length} media URLs in vendor ${slug}`);
    if (mediaUrls.length > 0) {
      console.log("Media URLs:", mediaUrls);
    }
    
    if (dryRun) {
      for (const url of mediaUrls) {
        const localPath = url.startsWith('/') ? url.substring(1) : url;
        console.log(`Would download: ${PRODUCTION_URL}${url} -> ${localPath}`);
      }
      return { success: true, mediaCount: mediaUrls.length };
    }
    
    // Download all media files
    let downloadCount = 0;
    for (const url of mediaUrls) {
      const localPath = url.startsWith('/') ? url.substring(1) : url;
      
      try {
        const result = await downloadFile(`${PRODUCTION_URL}${url}`, localPath);
        if (!result.skipped) downloadCount++;
      } catch (error) {
        console.error(`Error downloading ${url}:`, error.message);
      }
    }
    
    // If no media URLs detected through normal extraction, try direct pattern matching
    if (mediaUrls.length === 0 && verbose) {
      console.log("No media URLs found through standard extraction, trying direct pattern matching...");
      
      // Look for content-media paths
      const contentMediaPattern = /\/content-media\/[^"'\s]+/g;
      let match;
      const directUrls = new Set();
      
      while ((match = contentMediaPattern.exec(html)) !== null) {
        const url = match[0];
        console.log(`Found direct content-media URL: ${url}`);
        directUrls.add(url);
      }
      
      if (directUrls.size > 0) {
        console.log(`Found ${directUrls.size} direct content-media URLs`);
        
        for (const url of directUrls) {
          const localPath = url.startsWith('/') ? url.substring(1) : url;
          
          try {
            console.log(`Downloading direct URL: ${PRODUCTION_URL}${url} -> ${localPath}`);
            const result = await downloadFile(`${PRODUCTION_URL}${url}`, localPath);
            if (!result.skipped) downloadCount++;
          } catch (error) {
            console.error(`Error downloading direct URL ${url}:`, error.message);
          }
        }
      }
    }
    
    return { success: true, mediaCount: downloadCount };
  } catch (error) {
    console.error(`Error processing vendor ${slug}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Process a single vendor by full path
async function processVendorByPath(vendorPath, options = {}) {
  // Extract category and slug from path
  const parts = vendorPath.split('/');
  if (parts.length < 2) {
    throw new Error(`Invalid vendor path: ${vendorPath}`);
  }
  
  const category = parts[0];
  const slug = parts[1];
  
  return processVendor(category, slug, options);
}

// Discover vendors in a category
async function discoverVendorsInCategory(category, options = {}) {
  try {
    console.log(`Discovering vendors in category: ${category}...`);
    
    // Fetch category page HTML
    const response = await fetch(`${PRODUCTION_URL}/vendors/${category}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching category ${category}: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Find vendor links with regex
    const linkRegex = /<a[^>]+href="\/vendors\/[^/]+\/([^"/]+)"[^>]*>/g;
    const vendorSlugs = new Set();
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      if (match[1]) {
        vendorSlugs.add(match[1]);
      }
    }
    
    console.log(`Found ${vendorSlugs.size} vendors in category ${category}`);
    
    return Array.from(vendorSlugs);
  } catch (error) {
    console.error(`Error discovering vendors in category ${category}:`, error.message);
    return [];
  }
}

// Process all vendors in a category
async function processCategory(category, options = {}) {
  try {
    const vendorSlugs = await discoverVendorsInCategory(category, options);
    
    let totalDownloaded = 0;
    let processedVendors = 0;
    let successfulVendors = 0;
    
    for (const slug of vendorSlugs) {
      try {
        const result = await processVendor(category, slug, options);
        processedVendors++;
        
        if (result.success) {
          successfulVendors++;
          totalDownloaded += result.mediaCount;
        }
      } catch (error) {
        console.error(`Error processing vendor ${slug}:`, error);
      }
    }
    
    return { processedVendors, successfulVendors, totalDownloaded };
  } catch (error) {
    console.error(`Error processing category ${category}:`, error);
    return { processedVendors: 0, successfulVendors: 0, totalDownloaded: 0 };
  }
}

// Process all vendors in all categories
async function processAllCategories(options = {}) {
  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalDownloaded = 0;
  
  for (const category of VENDOR_CATEGORIES) {
    try {
      const result = await processCategory(category, options);
      
      totalProcessed += result.processedVendors;
      totalSuccessful += result.successfulVendors;
      totalDownloaded += result.totalDownloaded;
    } catch (error) {
      console.error(`Error processing category ${category}:`, error);
    }
  }
  
  return { totalProcessed, totalSuccessful, totalDownloaded };
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    vendorSlug: null,
    vendorPath: null,
    category: null,
    all: false,
    dryRun: false
  };
  
  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === 'all') {
      options.all = true;
    } else if (VENDOR_CATEGORIES.includes(arg)) {
      options.category = arg;
    } else if (arg.includes('/')) {
      options.vendorPath = arg;
    } else {
      options.vendorSlug = arg;
    }
  }
  
  return options;
}

// Handle specific vendor image download
async function handleSpecificVendorImage(mediaPath, options = {}) {
  const localPath = mediaPath.startsWith('/') ? mediaPath.substring(1) : mediaPath;
  
  if (options.dryRun) {
    console.log(`Would download: ${PRODUCTION_URL}${mediaPath} -> ${localPath}`);
    return { success: true, skipped: true };
  }
  
  try {
    const result = await downloadFile(`${PRODUCTION_URL}${mediaPath}`, localPath);
    return result;
  } catch (error) {
    console.error(`Error downloading ${mediaPath}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Main function
async function main() {
  const options = parseArgs();
  
  console.log('Vendor Media Sync Tool');
  console.log('--------------------');
  
  if (options.vendorSlug) {
    console.log(`Vendor Slug: ${options.vendorSlug}`);
  } else if (options.vendorPath) {
    console.log(`Vendor Path: ${options.vendorPath}`);
  } else if (options.category) {
    console.log(`Category: ${options.category}`);
  } else if (options.all) {
    console.log('Processing all vendors');
  }
  
  console.log(`Dry Run: ${options.dryRun ? 'Yes' : 'No'}`);
  console.log('--------------------');
  
  // Ensure all directories exist
  ensureDirectoriesExist();
  
  // Handle specific media file (highest priority)
  if (options.vendorSlug && (options.vendorSlug.startsWith('/content-media/') || 
      options.vendorSlug.startsWith('content-media/'))) {
    // Ensure path starts with /
    const path = options.vendorSlug.startsWith('/') ? 
      options.vendorSlug : '/' + options.vendorSlug;
    await handleSpecificVendorImage(path, options);
    return;
  }
  
  // Handle specific vendor path
  if (options.vendorPath) {
    const result = await processVendorByPath(options.vendorPath, options);
    console.log(`\nVendor Path Summary:`);
    console.log(`Processed vendor: ${options.vendorPath}`);
    console.log(`Downloaded ${result.mediaCount} media files`);
    return;
  }
  
  // Handle specific vendor in all categories
  if (options.vendorSlug) {
    let found = false;
    for (const category of VENDOR_CATEGORIES) {
      try {
        const result = await processVendor(category, options.vendorSlug, options);
        if (result.success) {
          found = true;
          console.log(`\nVendor Summary:`);
          console.log(`Processed vendor: ${category}/${options.vendorSlug}`);
          console.log(`Downloaded ${result.mediaCount} media files`);
          break;
        }
      } catch (error) {
        // Continue trying other categories
      }
    }
    
    if (!found) {
      console.error(`Vendor ${options.vendorSlug} not found in any category`);
    }
    
    return;
  }
  
  // Handle specific category
  if (options.category) {
    const result = await processCategory(options.category, options);
    console.log(`\nCategory Summary:`);
    console.log(`Processed ${result.processedVendors} vendors in category ${options.category}`);
    console.log(`Successfully processed ${result.successfulVendors} vendors`);
    console.log(`Downloaded ${result.totalDownloaded} media files`);
    return;
  }
  
  // Handle all categories
  if (options.all) {
    const result = await processAllCategories(options);
    console.log(`\nAll Categories Summary:`);
    console.log(`Processed ${result.totalProcessed} vendors across all categories`);
    console.log(`Successfully processed ${result.totalSuccessful} vendors`);
    console.log(`Downloaded ${result.totalDownloaded} media files`);
    return;
  }
  
  // No specific options provided, show usage
  console.log(`
Usage: node sync-vendor-media.js [options]

Arguments:
  vendor-slug              Process a specific vendor by slug
  category                 Process all vendors in a category
  all                      Process all vendors in all categories
  vendor-path              Process a vendor with explicit category/slug path
  /content-media/file.jpg  Download a specific media file

Options:
  --dry-run                Only show what would be downloaded, don't actually download

Examples:
  node sync-vendor-media.js services-dan-hess-antiques-estate-sales
  node sync-vendor-media.js home-services
  node sync-vendor-media.js home-services/services-dan-hess-antiques-estate-sales
  node sync-vendor-media.js all
  node sync-vendor-media.js /content-media/mediaFile-1745355164980-265491046.png
  `);
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});