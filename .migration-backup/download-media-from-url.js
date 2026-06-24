/**
 * Download Media Files From URLs Script
 * 
 * This script downloads media files from a list of production URLs
 * to make them available in your development environment.
 * 
 * Usage: 
 * node download-media-from-url.js [url1] [url2] ...
 * 
 * Example:
 * node download-media-from-url.js https://barefootbay.com/content-media/mediaFile-123456.jpg
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { URL } from 'url';

// List of media paths to ensure exist
const MEDIA_DIRS = [
  'content-media',
  'forum-media', 
  'community-media',
  'vendor-media',
  'attached_assets',
  'icons',
  'avatars',
  'banner-slides',
  'calendar',
  'uploads/calendar',
  'uploads/banner-slides'
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

// Download a file from a URL to a local path
function downloadFile(url, localPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url} -> ${localPath}`);
    
    // Create directory if it doesn't exist
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Skip if file exists
    if (fs.existsSync(localPath)) {
      console.log(`File already exists: ${localPath}`);
      return resolve({ success: true, path: localPath, skipped: true });
    }
    
    // Create write stream for the file
    const fileStream = fs.createWriteStream(localPath);
    
    // Make an HTTP request to download the file
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        fileStream.close();
        fs.unlinkSync(localPath); // Remove incomplete file
        reject(new Error(`Failed to download ${url}: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      // Pipe the HTTP response to the file
      response.pipe(fileStream);
      
      // Handle fileStream events
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Downloaded successfully: ${localPath}`);
        resolve({ success: true, path: localPath });
      });
      
      fileStream.on('error', (err) => {
        fileStream.close();
        fs.unlinkSync(localPath); // Remove incomplete file
        reject(err);
      });
    }).on('error', (err) => {
      fileStream.close();
      fs.unlinkSync(localPath); // Remove incomplete file
      reject(err);
    });
  });
}

// Process a URL
async function processUrl(url) {
  // Parse the URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (err) {
    // Handle relative URLs by adding production domain
    parsedUrl = new URL(url.startsWith('/') ? `https://barefootbay.com${url}` : `https://barefootbay.com/${url}`);
  }
  
  // Extract the path from the URL, removing the leading slash if present
  const urlPath = parsedUrl.pathname.startsWith('/') ? parsedUrl.pathname.substring(1) : parsedUrl.pathname;
  
  // Download the file
  try {
    const result = await downloadFile(parsedUrl.toString(), urlPath);
    return { ...result, url };
  } catch (err) {
    console.error(`Error downloading ${url}:`, err.message);
    return { success: false, url, error: err.message };
  }
}

// Main function
async function main() {
  // Get URLs from command-line arguments
  const urls = process.argv.slice(2);
  
  // Handle no arguments
  if (urls.length === 0) {
    console.log(`
Usage: node download-media-from-url.js [url1] [url2] ...

Examples:
  node download-media-from-url.js https://barefootbay.com/content-media/mediaFile-123456.jpg
  node download-media-from-url.js /content-media/mediaFile-123456.jpg

Predefined URLs for post 207:
  node download-media-from-url.js /content-media/mediaFile-1745240212955-881934240.jpg /content-media/mediaFile-1745240223167-320646095.jpg
`);
    return;
  }
  
  // Ensure all directories exist
  ensureDirectoriesExist();
  
  // Process each URL
  const results = [];
  for (const url of urls) {
    const result = await processUrl(url);
    results.push(result);
  }
  
  // Print summary
  console.log('\nDownload Summary:');
  console.log('---------------');
  for (const result of results) {
    if (result.success) {
      if (result.skipped) {
        console.log(`✓ Skipped (already exists): ${result.url} -> ${result.path}`);
      } else {
        console.log(`✓ Downloaded successfully: ${result.url} -> ${result.path}`);
      }
    } else {
      console.log(`✗ Failed: ${result.url} - ${result.error}`);
    }
  }
  
  // Print overall status
  const successCount = results.filter(r => r.success).length;
  console.log(`\nDownloaded ${successCount} of ${results.length} files.`);
}

// Run the script
main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});