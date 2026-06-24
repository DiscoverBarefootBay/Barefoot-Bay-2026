/**
 * Sync All Forum Media
 * 
 * This script fetches all forum posts from the production API and
 * downloads any media files found in the content to ensure they're 
 * available in the development environment.
 * 
 * Usage: node sync-all-forum-media.js [--start=1] [--end=300] [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { URL } from 'url';

// Configuration
const PRODUCTION_URL = 'https://barefootbay.com';
const MEDIA_DIRS = [
  'content-media',
  'forum-media',
  'community-media',
  'vendor-media',
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
function extractImageUrls(content) {
  if (!content) return [];
  
  const urls = new Set();
  
  // Extract image URLs from HTML img tags
  const imgRegex = /<img[^>]+src=['\"]([^'\"]+)['\"][^>]*>/g;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    urls.add(match[1]);
  }
  
  // Extract background-image URLs from inline styles
  const bgRegex = /background-image:\s*url\(['"]?([^'")]+)['"]?\)/g;
  while ((match = bgRegex.exec(content)) !== null) {
    urls.add(match[1]);
  }
  
  return Array.from(urls);
}

// Check if a URL is a media URL
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

// Process a single post
async function processPost(postId, options = {}) {
  const { dryRun = false } = options;
  
  try {
    console.log(`Processing post ${postId}...`);
    
    // Fetch post data from API
    const response = await fetch(`${PRODUCTION_URL}/api/forum/posts/${postId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Post ${postId} not found, skipping.`);
        return { success: true, mediaCount: 0 };
      }
      throw new Error(`Error fetching post ${postId}: ${response.status} ${response.statusText}`);
    }
    
    const post = await response.json();
    console.log(`Found post: "${post.title}" (ID: ${post.id})`);
    
    // Extract image URLs from content
    const contentUrls = extractImageUrls(post.content);
    const mediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
    const allUrls = [...new Set([...contentUrls, ...mediaUrls])];
    
    // Filter out non-media URLs
    const mediaFileUrls = allUrls.filter(isMediaUrl);
    
    console.log(`Found ${mediaFileUrls.length} media URLs in post ${postId}`);
    
    if (dryRun) {
      for (const url of mediaFileUrls) {
        const localPath = url.startsWith('/') ? url.substring(1) : url;
        console.log(`Would download: ${PRODUCTION_URL}${url} -> ${localPath}`);
      }
      return { success: true, mediaCount: mediaFileUrls.length };
    }
    
    // Download all media files
    let downloadCount = 0;
    for (const url of mediaFileUrls) {
      const localPath = url.startsWith('/') ? url.substring(1) : url;
      
      try {
        const result = await downloadFile(`${PRODUCTION_URL}${url}`, localPath);
        if (!result.skipped) downloadCount++;
      } catch (error) {
        console.error(`Error downloading ${url}:`, error.message);
      }
    }
    
    // Process author avatar if present
    if (post.author && post.author.avatarUrl) {
      const avatarUrl = post.author.avatarUrl;
      if (isMediaUrl(avatarUrl)) {
        const localPath = avatarUrl.startsWith('/') ? avatarUrl.substring(1) : avatarUrl;
        try {
          const result = await downloadFile(`${PRODUCTION_URL}${avatarUrl}`, localPath);
          if (!result.skipped) downloadCount++;
        } catch (error) {
          console.error(`Error downloading avatar ${avatarUrl}:`, error.message);
        }
      }
    }
    
    // Also fetch and process comments for this post to catch any media in comments
    try {
      const commentsResponse = await fetch(`${PRODUCTION_URL}/api/forum/posts/${postId}/comments`);
      if (commentsResponse.ok) {
        const comments = await commentsResponse.json();
        
        for (const comment of comments) {
          // Extract image URLs from comment content
          const commentUrls = extractImageUrls(comment.content);
          const commentMediaUrls = Array.isArray(comment.mediaUrls) ? comment.mediaUrls : [];
          const allCommentUrls = [...new Set([...commentUrls, ...commentMediaUrls])];
          
          // Filter out non-media URLs
          const commentMediaFileUrls = allCommentUrls.filter(isMediaUrl);
          
          if (commentMediaFileUrls.length > 0) {
            console.log(`Found ${commentMediaFileUrls.length} media URLs in comment ${comment.id}`);
            
            for (const url of commentMediaFileUrls) {
              const localPath = url.startsWith('/') ? url.substring(1) : url;
              
              try {
                const result = await downloadFile(`${PRODUCTION_URL}${url}`, localPath);
                if (!result.skipped) downloadCount++;
              } catch (error) {
                console.error(`Error downloading ${url}:`, error.message);
              }
            }
          }
          
          // Process comment author avatar if present
          if (comment.author && comment.author.avatarUrl) {
            const avatarUrl = comment.author.avatarUrl;
            if (isMediaUrl(avatarUrl)) {
              const localPath = avatarUrl.startsWith('/') ? avatarUrl.substring(1) : avatarUrl;
              try {
                const result = await downloadFile(`${PRODUCTION_URL}${avatarUrl}`, localPath);
                if (!result.skipped) downloadCount++;
              } catch (error) {
                console.error(`Error downloading avatar ${avatarUrl}:`, error.message);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error processing comments for post ${postId}:`, error.message);
    }
    
    return { success: true, mediaCount: downloadCount };
  } catch (error) {
    console.error(`Error processing post ${postId}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Process a range of posts
async function processPostRange(startId, endId, options = {}) {
  const { dryRun = false } = options;
  
  console.log(`Processing posts from ID ${startId} to ${endId}...`);
  
  let totalDownloaded = 0;
  let processedPosts = 0;
  let successfulPosts = 0;
  
  for (let postId = startId; postId <= endId; postId++) {
    try {
      const result = await processPost(postId, { dryRun });
      processedPosts++;
      
      if (result.success) {
        successfulPosts++;
        totalDownloaded += result.mediaCount;
      }
    } catch (error) {
      console.error(`Error processing post ${postId}:`, error);
    }
  }
  
  return { processedPosts, successfulPosts, totalDownloaded };
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    startId: 1,
    endId: 300, // Default to a reasonable range
    dryRun: false
  };
  
  for (const arg of args) {
    if (arg.startsWith('--start=')) {
      options.startId = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--end=')) {
      options.endId = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }
  
  return options;
}

// Main function
async function main() {
  const options = parseArgs();
  
  console.log('Forum Media Sync Tool');
  console.log('--------------------');
  console.log(`Start ID: ${options.startId}`);
  console.log(`End ID: ${options.endId}`);
  console.log(`Dry Run: ${options.dryRun ? 'Yes' : 'No'}`);
  console.log('--------------------');
  
  // Ensure all directories exist
  ensureDirectoriesExist();
  
  // Process posts
  const result = await processPostRange(options.startId, options.endId, {
    dryRun: options.dryRun
  });
  
  // Print summary
  console.log('\nSummary:');
  console.log(`Processed ${result.processedPosts} posts`);
  console.log(`Successfully processed ${result.successfulPosts} posts`);
  console.log(`Downloaded ${result.totalDownloaded} media files`);
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});