/**
 * Media Synchronization Tool
 * 
 * This tool syncs media files from the production server to your development environment.
 * It scans database content for media URLs and downloads missing files from production.
 * 
 * Usage: node sync-media-from-production.js [options]
 * Options:
 *   --post-id=123      Sync media only for a specific post
 *   --all-forum        Sync media for all forum posts
 *   --all-media        Attempt to sync all media files (may take longer)
 *   --dry-run          Only show what would be downloaded, don't actually download
 *   --force            Redownload files even if they already exist locally
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { db, storage } from './server/storage.js';
import { eq } from 'drizzle-orm';
import { forumPosts, forumComments } from './shared/schema.js';

// Define constants
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(import.meta.url);
const PRODUCTION_URL = 'https://barefootbay.com';
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

// Helper function to ensure all required directories exist
function ensureDirectoriesExist() {
  console.log('Ensuring all media directories exist...');
  MEDIA_DIRS.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Helper function to extract URLs from content
function extractUrls(content) {
  if (!content) return [];
  
  const urls = new Set();
  
  // Extract image URLs from HTML content
  const imgRegex = /<img[^>]+src="([^">]+)"/g;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    const url = match[1];
    if (isMediaUrl(url)) {
      urls.add(url);
    }
  }
  
  // Extract URLs from markdown-style links
  const markdownRegex = /!\[.*?\]\((.*?)\)/g;
  while ((match = markdownRegex.exec(content)) !== null) {
    const url = match[1];
    if (isMediaUrl(url)) {
      urls.add(url);
    }
  }
  
  return Array.from(urls);
}

// Check if a URL is a media URL (starting with a path we care about)
function isMediaUrl(url) {
  if (!url) return false;
  
  // Remove protocol and domain if present (for absolute URLs)
  const normalizedUrl = url.replace(/^https?:\/\/[^\/]+/i, '');
  
  // Check if the URL path starts with one of our media directories
  return MEDIA_DIRS.some(dir => 
    normalizedUrl.startsWith(`/${dir}`) || 
    normalizedUrl === `/${dir}`
  );
}

// Download a file from production to local
async function downloadFile(url, dryRun = false, force = false) {
  // Remove the leading slash to get the file path
  const filePath = url.startsWith('/') ? url.substring(1) : url;
  
  // Create the directory if it doesn't exist
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Skip if file already exists and force isn't enabled
  if (fs.existsSync(filePath) && !force) {
    console.log(`File already exists: ${filePath} (skipping)`);
    return false;
  }
  
  if (dryRun) {
    console.log(`Would download: ${PRODUCTION_URL}${url} -> ${filePath}`);
    return true;
  }
  
  try {
    console.log(`Downloading: ${PRODUCTION_URL}${url} -> ${filePath}`);
    const response = await fetch(`${PRODUCTION_URL}${url}`);
    
    if (!response.ok) {
      console.error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
      return false;
    }
    
    const buffer = await response.buffer();
    fs.writeFileSync(filePath, buffer);
    console.log(`Downloaded successfully: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error downloading ${url}:`, error.message);
    return false;
  }
}

// Process a single forum post
async function processForumPost(postId, options = {}) {
  const { dryRun = false, force = false } = options;
  
  console.log(`Processing forum post ID: ${postId}`);
  
  try {
    // Fetch the post
    const post = await storage.getForumPost(postId);
    if (!post) {
      console.error(`Post not found: ${postId}`);
      return { success: false, downloaded: 0 };
    }
    
    // Extract URLs from post content
    const contentUrls = extractUrls(post.content);
    
    // Process post media URLs
    const mediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
    const allUrls = [...new Set([...contentUrls, ...mediaUrls])];
    
    console.log(`Found ${allUrls.length} media URLs in post ${postId}`);
    
    // Download all media files
    let downloadCount = 0;
    for (const url of allUrls) {
      const downloaded = await downloadFile(url, dryRun, force);
      if (downloaded) downloadCount++;
    }
    
    // Fetch and process comments for this post
    const comments = await storage.getForumComments(postId);
    if (Array.isArray(comments)) {
      for (const comment of comments) {
        // Extract URLs from comment content
        const commentUrls = extractUrls(comment.content);
        
        // Process comment media URLs
        const commentMediaUrls = Array.isArray(comment.mediaUrls) ? comment.mediaUrls : [];
        const allCommentUrls = [...new Set([...commentUrls, ...commentMediaUrls])];
        
        console.log(`Found ${allCommentUrls.length} media URLs in comment ${comment.id}`);
        
        // Download all media files
        for (const url of allCommentUrls) {
          const downloaded = await downloadFile(url, dryRun, force);
          if (downloaded) downloadCount++;
        }
      }
    }
    
    return { success: true, downloaded: downloadCount };
  } catch (error) {
    console.error(`Error processing post ${postId}:`, error);
    return { success: false, downloaded: 0 };
  }
}

// Process all forum posts
async function processAllForumPosts(options = {}) {
  const { dryRun = false, force = false } = options;
  
  console.log('Processing all forum posts...');
  
  try {
    const posts = await db.select().from(forumPosts);
    console.log(`Found ${posts.length} posts to process`);
    
    let totalDownloaded = 0;
    for (const post of posts) {
      const result = await processForumPost(post.id, { dryRun, force });
      totalDownloaded += result.downloaded;
    }
    
    console.log(`Processed ${posts.length} posts, downloaded ${totalDownloaded} files`);
    return { success: true, processed: posts.length, downloaded: totalDownloaded };
  } catch (error) {
    console.error('Error processing all forum posts:', error);
    return { success: false, processed: 0, downloaded: 0 };
  }
}

// Process command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    postId: null,
    allForum: false,
    allMedia: false,
    dryRun: false,
    force: false
  };
  
  args.forEach(arg => {
    if (arg.startsWith('--post-id=')) {
      options.postId = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--all-forum') {
      options.allForum = true;
    } else if (arg === '--all-media') {
      options.allMedia = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    }
  });
  
  return options;
}

// Main function
async function main() {
  const options = parseArgs();
  console.log('Media Sync Tool - Starting with options:', options);
  
  // Ensure all required directories exist
  ensureDirectoriesExist();
  
  if (options.postId) {
    // Process a single post
    const result = await processForumPost(options.postId, {
      dryRun: options.dryRun,
      force: options.force
    });
    
    console.log(`Processed post ${options.postId}:`, result);
  } else if (options.allForum) {
    // Process all forum posts
    const result = await processAllForumPosts({
      dryRun: options.dryRun,
      force: options.force
    });
    
    console.log('Processed all forum posts:', result);
  } else if (options.allMedia) {
    // TODO: Implement more comprehensive media scanning
    console.log('All media sync not yet implemented');
  } else {
    console.log(`
Usage: node sync-media-from-production.js [options]
Options:
  --post-id=123      Sync media only for a specific post
  --all-forum        Sync media for all forum posts
  --all-media        Attempt to sync all media files (may take longer)
  --dry-run          Only show what would be downloaded, don't actually download
  --force            Redownload files even if they already exist locally
    `);
  }
}

// Helper function for __dirname equivalent in ES modules
function dirname(moduleUrl) {
  const __filename = fileURLToPath(moduleUrl);
  return path.dirname(__filename);
}

// Run the script
main().catch(error => {
  console.error('Error in main function:', error);
  process.exit(1);
}).finally(() => {
  // Close the database connection
  db.destroy();
});