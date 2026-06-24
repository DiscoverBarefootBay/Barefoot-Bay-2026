/**
 * Sync Vendor Content Media
 * 
 * This script directly accesses the vendor content API to find and download 
 * all media files used in vendor pages.
 * 
 * Usage: node sync-vendor-content.js [vendor-id or "all"]
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

// Configuration
const PRODUCTION_URL = 'https://barefootbay.com';
const VENDOR_API_URL = `${PRODUCTION_URL}/api/pages`;
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
  
  // Also check for direct content-media paths
  const contentMediaPattern = /\/content-media\/[^"'\s)]+/g;
  while ((match = contentMediaPattern.exec(html)) !== null) {
    urls.add(match[0]);
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

// Fetch all vendor pages from the API
async function fetchVendorPages() {
  try {
    console.log('Fetching all page contents...');
    const response = await fetch(VENDOR_API_URL);
    
    if (!response.ok) {
      throw new Error(`Error fetching pages: ${response.status} ${response.statusText}`);
    }
    
    const pages = await response.json();
    
    // Filter to just vendor pages
    const vendorPages = pages.filter(page => 
      page.slug && page.slug.startsWith('vendors-')
    );
    
    console.log(`Found ${vendorPages.length} vendor pages`);
    
    return vendorPages;
  } catch (error) {
    console.error('Error fetching vendor pages:', error.message);
    return [];
  }
}

// Fetch a specific vendor page by ID
async function fetchVendorPage(id) {
  try {
    console.log(`Fetching vendor page with ID: ${id}`);
    const response = await fetch(`${VENDOR_API_URL}/${id}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching page: ${response.status} ${response.statusText}`);
    }
    
    const page = await response.json();
    
    if (!page.slug || !page.slug.startsWith('vendors-')) {
      throw new Error(`Page with ID ${id} is not a vendor page`);
    }
    
    return page;
  } catch (error) {
    console.error(`Error fetching vendor page ${id}:`, error.message);
    return null;
  }
}

// Process a single vendor page
async function processVendorPage(page) {
  try {
    console.log(`Processing vendor page: ${page.slug} (ID: ${page.id})`);
    
    if (!page.content) {
      console.log(`No content found for vendor page: ${page.slug}`);
      return { success: true, mediaCount: 0 };
    }
    
    // Extract image URLs from HTML content
    const mediaUrls = extractImageUrls(page.content);
    
    console.log(`Found ${mediaUrls.length} media URLs in vendor page: ${page.slug}`);
    if (mediaUrls.length > 0) {
      console.log("Media URLs:", mediaUrls);
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
    
    return { success: true, mediaCount: downloadCount };
  } catch (error) {
    console.error(`Error processing vendor page ${page.slug}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Process all vendor pages
async function processAllVendorPages() {
  try {
    const vendorPages = await fetchVendorPages();
    
    let totalDownloaded = 0;
    let processedPages = 0;
    let successfulPages = 0;
    
    for (const page of vendorPages) {
      try {
        const result = await processVendorPage(page);
        processedPages++;
        
        if (result.success) {
          successfulPages++;
          totalDownloaded += result.mediaCount;
        }
      } catch (error) {
        console.error(`Error processing page ${page.slug}:`, error);
      }
    }
    
    return { processedPages, successfulPages, totalDownloaded };
  } catch (error) {
    console.error('Error processing vendor pages:', error);
    return { processedPages: 0, successfulPages: 0, totalDownloaded: 0 };
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    vendorId: null,
    all: false
  };
  
  if (args.length > 0) {
    if (args[0] === 'all') {
      options.all = true;
    } else {
      options.vendorId = args[0];
    }
  }
  
  return options;
}

// Main function
async function main() {
  const options = parseArgs();
  
  console.log('Vendor Content Media Sync Tool');
  console.log('------------------------------');
  
  if (options.vendorId) {
    console.log(`Vendor ID: ${options.vendorId}`);
  } else if (options.all) {
    console.log('Processing all vendor pages');
  } else {
    console.log('No vendor specified, will process all vendor pages');
    options.all = true;
  }
  
  console.log('------------------------------');
  
  // Ensure all directories exist
  ensureDirectoriesExist();
  
  // Process specific vendor or all vendors
  if (options.vendorId) {
    const page = await fetchVendorPage(options.vendorId);
    
    if (page) {
      const result = await processVendorPage(page);
      console.log(`\nVendor Summary:`);
      console.log(`Processed vendor: ${page.slug} (ID: ${page.id})`);
      console.log(`Downloaded ${result.mediaCount} media files`);
    } else {
      console.error(`Vendor with ID ${options.vendorId} not found or not a vendor page`);
    }
  } else {
    const result = await processAllVendorPages();
    console.log(`\nAll Vendors Summary:`);
    console.log(`Processed ${result.processedPages} vendor pages`);
    console.log(`Successfully processed ${result.successfulPages} pages`);
    console.log(`Downloaded ${result.totalDownloaded} media files`);
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});