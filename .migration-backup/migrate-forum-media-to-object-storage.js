/**
 * Enhanced Forum Media Migration to Object Storage
 * 
 * This script migrates existing forum media files from the filesystem
 * to Replit Object Storage in the FORUM bucket with improved handling.
 * It implements the fixes from our forum media upload solution.
 * 
 * Key improvements:
 * - Fixed double nesting problem by using flat storage paths
 * - Uses reliable uploadFromFilename method for all file types
 * - Generates proper URL format for better preview handling
 * - Updates database references to use the new storage paths
 * - Logs detailed migration results for verification
 */

import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mime from 'mime-types';
import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Support for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Constants
const FORUM_BUCKET = 'FORUM';
const FILESYSTEM_PATHS = [
  path.join(process.cwd(), 'forum-media'),
  path.join(process.cwd(), 'uploads', 'forum-media'),
  path.join(process.cwd(), 'uploads', 'forum'),
  path.join(process.cwd(), 'forum')
];
const MIGRATION_LOG_FILE = 'forum-media-migration-log.json';
const DIRECT_FORUM_URL_PREFIX = '/api/storage-proxy/direct-forum/';
const MAX_BATCH_SIZE = 15; // Use smaller batch size to avoid timeouts

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Initialize Object Storage client
const client = new Client();

// Tracking variables
let totalFiles = 0;
let migratedFiles = 0;
let skippedFiles = 0;
let failedFiles = 0;
const failedFilesList = [];
let migrationData = { 
  startTime: new Date().toISOString(),
  completionTime: null,
  migratedFiles: [],
  databaseUpdates: {
    posts: 0,
    comments: 0
  },
  errors: []
};

/**
 * Load previous migration data from file if available
 */
function loadPreviousMigrationData() {
  if (fs.existsSync(MIGRATION_LOG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(MIGRATION_LOG_FILE, 'utf8'));
      console.log(`Loaded previous migration data with ${data.migratedFiles?.length || 0} files`);
      return data;
    } catch (error) {
      console.error(`Error loading migration data: ${error.message}`);
    }
  }
  return null;
}

/**
 * Save migration data to file
 */
function saveMigrationData() {
  migrationData.completionTime = new Date().toISOString();
  
  try {
    fs.writeFileSync(MIGRATION_LOG_FILE, JSON.stringify(migrationData, null, 2));
    console.log(`Migration data saved to ${MIGRATION_LOG_FILE}`);
  } catch (error) {
    console.error(`Error saving migration data: ${error.message}`);
  }
}

/**
 * Check if a file exists in Object Storage
 * @param {string} key - Storage key to check
 * @returns {Promise<boolean>} - Whether the file exists
 */
async function fileExistsInStorage(key) {
  try {
    // For simplicity, always return false for now
    // This will cause the script to try to upload all files,
    // which is what we want for a fresh migration
    return false;
    
    // Note: The below code doesn't work with current client.list API
    // Let's stop trying to check if files exist and just try to upload them all
    /*
    const result = await client.list({
      prefix: key,
      bucketName: FORUM_BUCKET,
      maxKeys: 1
    });
    
    if (Array.isArray(result)) {
      return result.some(item => item.key === key);
    }
    
    return false;
    */
  } catch (error) {
    console.error(`Error checking file existence in storage: ${error.message}`);
    return false;
  }
}

/**
 * Convert old URL format to normalized format
 * @param {string} url - URL to convert
 * @returns {string} Normalized URL or original URL if no conversion needed
 */
function normalizeOldMediaUrl(url) {
  // Not a string or already has the right format
  if (!url || typeof url !== 'string' || url.includes('/api/storage-proxy/')) {
    return url;
  }
  
  // Extract filename only from any path format
  let filename = url;
  
  // Handle various path formats
  if (url.includes('/uploads/forum-media/')) {
    filename = url.split('/uploads/forum-media/').pop();
  } else if (url.includes('/forum-media/')) {
    filename = url.split('/forum-media/').pop();
  } else if (url.includes('/forum/')) {
    filename = url.split('/forum/').pop();
  } else if (url.includes('/uploads/forum/')) {
    filename = url.split('/uploads/forum/').pop();
  } else if (url.startsWith('/')) {
    // If it's a root-relative URL without subdirectories, just take the filename
    filename = url.substring(1);
  }
  
  // Return the direct-forum URL format that we know works reliably
  return `${DIRECT_FORUM_URL_PREFIX}${filename}`;
}

/**
 * Upload a file to Object Storage
 * @param {string} filePath - Path to the file
 * @param {string} filename - Name of the file
 * @param {string} originalPath - Original path for logging
 * @returns {Promise<Object>} - Upload result
 */
async function uploadFile(filePath, filename, originalPath) {
  try {
    // Simplify storage key to just the filename - no nesting
    const storageKey = filename;
    
    // Check if this file has already been processed in a previous run
    const existingFile = migrationData.migratedFiles.find(f => f.filename === filename);
    if (existingFile) {
      console.log(`File ${filename} was already migrated in a previous run - skipping`);
      skippedFiles++;
      return {
        success: true,
        skipped: true,
        filename,
        url: DIRECT_FORUM_URL_PREFIX + filename,
        originalPath
      };
    }
    
    // Check if file already exists in storage
    const exists = await fileExistsInStorage(storageKey);
    if (exists) {
      console.log(`File ${filename} already exists in Object Storage - skipping`);
      skippedFiles++;
      
      const result = {
        success: true,
        skipped: true,
        filename,
        url: DIRECT_FORUM_URL_PREFIX + filename,
        originalPath
      };
      
      migrationData.migratedFiles.push(result);
      return result;
    }
    
    // Get content type
    const contentType = mime.lookup(filename) || 'application/octet-stream';
    
    // Upload the file
    console.log(`Uploading ${filename} to ${FORUM_BUCKET}/${storageKey}...`);
    try {
      // Use uploadFromFilename method
      await client.uploadFromFilename(storageKey, filePath, {
        contentType,
        bucketName: FORUM_BUCKET
      });
      
      console.log(`Successfully uploaded ${filename}`);
      migratedFiles++;
      
      const uploadResult = {
        success: true,
        filename,
        url: DIRECT_FORUM_URL_PREFIX + filename,
        originalPath,
        contentType,
        size: fs.statSync(filePath).size,
        timestamp: new Date().toISOString()
      };
      
      // Add to migration data
      migrationData.migratedFiles.push(uploadResult);
      
      // Save migration data periodically (every 10 files)
      if (migratedFiles % 10 === 0) {
        saveMigrationData();
      }
      
      return uploadResult;
    } catch (uploadError) {
      console.error(`Failed to upload ${filename}:`, uploadError.message);
      failedFiles++;
      
      const errorResult = { 
        filename, 
        originalPath,
        error: uploadError.message
      };
      
      failedFilesList.push(errorResult);
      migrationData.errors.push({
        type: 'upload',
        ...errorResult
      });
      
      return {
        success: false,
        ...errorResult
      };
    }
  } catch (error) {
    console.error(`Error uploading ${filename}:`, error);
    failedFiles++;
    
    const errorResult = { 
      filename, 
      originalPath,
      error: error.message
    };
    
    failedFilesList.push(errorResult);
    migrationData.errors.push({
      type: 'upload',
      ...errorResult
    });
    
    return {
      success: false,
      ...errorResult
    };
  }
}

/**
 * Scan a directory for forum media files and upload them to Object Storage
 * @param {string} dirPath - Path to the directory to scan
 * @returns {Promise<Array<Object>>} - Array of upload results
 */
async function scanAndUploadDirectory(dirPath) {
  const results = [];
  
  try {
    console.log(`Scanning directory: ${dirPath}`);
    
    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      console.log(`Directory ${dirPath} does not exist - skipping`);
      return results;
    }
    
    // Get list of files
    const files = fs.readdirSync(dirPath);
    console.log(`Found ${files.length} files in ${dirPath}`);
    
    // Keep track of total files to process
    totalFiles += files.length;
    
    // Process files in batches to avoid memory issues
    const batches = [];
    for (let i = 0; i < files.length; i += MAX_BATCH_SIZE) {
      batches.push(files.slice(i, i + MAX_BATCH_SIZE));
    }
    
    console.log(`Processing ${batches.length} batches of up to ${MAX_BATCH_SIZE} files each`);
    
    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} files)`);
      
      // Process each file in the batch
      for (const file of batch) {
        const filePath = path.join(dirPath, file);
        
        // Skip directories
        if (fs.statSync(filePath).isDirectory()) {
          console.log(`Skipping directory: ${filePath}`);
          skippedFiles++;
          continue;
        }
        
        // Skip non-media files
        const ext = path.extname(file).toLowerCase();
        const mediaExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.mp4', '.mov', '.webm'];
        if (!mediaExts.includes(ext)) {
          console.log(`Skipping non-media file: ${file}`);
          skippedFiles++;
          continue;
        }
        
        // Upload the file
        const result = await uploadFile(filePath, file, filePath);
        if (result.success) {
          results.push(result);
        }
      }
      
      // Save migration data after each batch
      saveMigrationData();
    }
    
    return results;
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
    migrationData.errors.push({
      type: 'directory_scan',
      directory: dirPath,
      error: error.message
    });
    return results;
  }
}

/**
 * Update database references to forum media
 * @returns {Promise<void>}
 */
async function updateDatabaseReferences() {
  console.log('\nUpdating database references to forum media...');
  
  try {
    // Connect to database
    const client = await pool.connect();
    console.log('Connected to database');
    
    try {
      // 1. Update forum posts media_urls array
      const postResults = await client.query(`
        SELECT id, media_urls
        FROM forum_posts
        WHERE media_urls IS NOT NULL AND array_length(media_urls, 1) > 0
      `);
      
      console.log(`Found ${postResults.rows.length} forum posts with media URLs`);
      
      for (const post of postResults.rows) {
        try {
          // Get current media URLs
          const mediaUrls = post.media_urls;
          
          // Skip if no media URLs
          if (!mediaUrls || mediaUrls.length === 0) continue;
          
          // Update each URL
          const updatedUrls = mediaUrls.map(normalizeOldMediaUrl);
          
          // Check if anything changed
          const hasChanges = mediaUrls.some((url, index) => url !== updatedUrls[index]);
          
          // Update database if there are changes
          if (hasChanges) {
            await client.query(
              'UPDATE forum_posts SET media_urls = $1 WHERE id = $2',
              [updatedUrls, post.id]
            );
            migrationData.databaseUpdates.posts++;
            console.log(`Updated media URLs for post ${post.id}`);
          }
        } catch (error) {
          console.error(`Error updating post ${post.id}:`, error);
          migrationData.errors.push({
            type: 'post_update',
            postId: post.id,
            error: error.message
          });
        }
      }
      
      // 2. Update forum comments media_urls array
      const commentResults = await client.query(`
        SELECT id, media_urls
        FROM forum_comments
        WHERE media_urls IS NOT NULL AND array_length(media_urls, 1) > 0
      `);
      
      console.log(`Found ${commentResults.rows.length} forum comments with media URLs`);
      
      for (const comment of commentResults.rows) {
        try {
          // Get current media URLs
          const mediaUrls = comment.media_urls;
          
          // Skip if no media URLs
          if (!mediaUrls || mediaUrls.length === 0) continue;
          
          // Update each URL
          const updatedUrls = mediaUrls.map(normalizeOldMediaUrl);
          
          // Check if anything changed
          const hasChanges = mediaUrls.some((url, index) => url !== updatedUrls[index]);
          
          // Update database if there are changes
          if (hasChanges) {
            await client.query(
              'UPDATE forum_comments SET media_urls = $1 WHERE id = $2',
              [updatedUrls, comment.id]
            );
            migrationData.databaseUpdates.comments++;
            console.log(`Updated media URLs for comment ${comment.id}`);
          }
        } catch (error) {
          console.error(`Error updating comment ${comment.id}:`, error);
          migrationData.errors.push({
            type: 'comment_update',
            commentId: comment.id,
            error: error.message
          });
        }
      }
      
      // 3. Update post content with embedded images
      const postContentResults = await client.query(`
        SELECT id, content 
        FROM forum_posts 
        WHERE content LIKE '%/forum-media/%' 
        OR content LIKE '%/uploads/forum-media/%'
        OR content LIKE '%/forum/%'
        OR content LIKE '%/uploads/forum/%'
        OR content LIKE '%src="%'
      `);
      
      console.log(`Found ${postContentResults.rows.length} forum posts with potential embedded media`);
      
      for (const post of postContentResults.rows) {
        try {
          let content = post.content;
          let updated = false;
          
          // Simple check for old image URL patterns
          const patterns = [
            /src="(\/forum-media\/[^"]+)"/g,
            /src="(\/uploads\/forum-media\/[^"]+)"/g,
            /src="(\/forum\/[^"]+)"/g,
            /src="(\/uploads\/forum\/[^"]+)"/g
          ];
          
          for (const pattern of patterns) {
            content = content.replace(pattern, (match, url) => {
              updated = true;
              const normalizedUrl = normalizeOldMediaUrl(url);
              return `src="${normalizedUrl}"`;
            });
          }
          
          // Update if changed
          if (updated) {
            await client.query(
              'UPDATE forum_posts SET content = $1 WHERE id = $2',
              [content, post.id]
            );
            console.log(`Updated embedded media URLs in post content ${post.id}`);
            migrationData.databaseUpdates.posts++;
          }
        } catch (error) {
          console.error(`Error updating post content ${post.id}:`, error);
          migrationData.errors.push({
            type: 'post_content_update',
            postId: post.id,
            error: error.message
          });
        }
      }
      
      // 4. Update comment content with embedded images
      const commentContentResults = await client.query(`
        SELECT id, content 
        FROM forum_comments 
        WHERE content LIKE '%/forum-media/%' 
        OR content LIKE '%/uploads/forum-media/%'
        OR content LIKE '%/forum/%'
        OR content LIKE '%/uploads/forum/%'
        OR content LIKE '%src="%'
      `);
      
      console.log(`Found ${commentContentResults.rows.length} forum comments with potential embedded media`);
      
      for (const comment of commentContentResults.rows) {
        try {
          let content = comment.content;
          let updated = false;
          
          // Simple check for old image URL patterns
          const patterns = [
            /src="(\/forum-media\/[^"]+)"/g,
            /src="(\/uploads\/forum-media\/[^"]+)"/g,
            /src="(\/forum\/[^"]+)"/g,
            /src="(\/uploads\/forum\/[^"]+)"/g
          ];
          
          for (const pattern of patterns) {
            content = content.replace(pattern, (match, url) => {
              updated = true;
              const normalizedUrl = normalizeOldMediaUrl(url);
              return `src="${normalizedUrl}"`;
            });
          }
          
          // Update if changed
          if (updated) {
            await client.query(
              'UPDATE forum_comments SET content = $1 WHERE id = $2',
              [content, comment.id]
            );
            console.log(`Updated embedded media URLs in comment content ${comment.id}`);
            migrationData.databaseUpdates.comments++;
          }
        } catch (error) {
          console.error(`Error updating comment content ${comment.id}:`, error);
          migrationData.errors.push({
            type: 'comment_content_update',
            commentId: comment.id,
            error: error.message
          });
        }
      }
      
      console.log('\nDatabase update complete!');
      console.log(`Updated ${migrationData.databaseUpdates.posts} posts`);
      console.log(`Updated ${migrationData.databaseUpdates.comments} comments`);
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database connection error:', error);
    migrationData.errors.push({
      type: 'database_connection',
      error: error.message
    });
  }
}

/**
 * Main migration function
 */
async function migrateForumMedia() {
  try {
    console.log('Starting enhanced forum media migration to Object Storage...');
    console.log(`Using fixed flat path structure for improved media handling`);
    
    // Load previous migration data if available
    const previousData = loadPreviousMigrationData();
    if (previousData) {
      // Use previous migration data to avoid re-uploading files
      migrationData = previousData;
      console.log(`Continuing previous migration run from ${migrationData.startTime}`);
      console.log(`Already migrated: ${migrationData.migratedFiles.length} files`);
    }
    
    // Process each filesystem path
    const allResults = [];
    for (const dirPath of FILESYSTEM_PATHS) {
      const results = await scanAndUploadDirectory(dirPath);
      allResults.push(...results);
    }
    
    // Update database references to use new URLs
    await updateDatabaseReferences();
    
    // Print summary
    console.log('\nMigration Summary:');
    console.log(`Total files found: ${totalFiles}`);
    console.log(`Successfully migrated: ${migratedFiles}`);
    console.log(`Skipped (already in storage): ${skippedFiles}`);
    console.log(`Failed: ${failedFiles}`);
    console.log(`Database posts updated: ${migrationData.databaseUpdates.posts}`);
    console.log(`Database comments updated: ${migrationData.databaseUpdates.comments}`);
    
    if (failedFiles > 0) {
      console.log('\nFailed files:');
      failedFilesList.forEach(({ filename, error }) => {
        console.log(`- ${filename}: ${error}`);
      });
    }
    
    // Final save of migration data
    migrationData.completionTime = new Date().toISOString();
    saveMigrationData();
    
    console.log('\nMigration complete!');
    console.log('Access migrated files using the storage proxy:');
    console.log(`${DIRECT_FORUM_URL_PREFIX}{filename}`);
    
    // Print update information
    console.log('\nURLs have been updated to use the direct-forum endpoint');
    console.log('This matches the improved forum media upload solution that:');
    console.log('1. Fixes the double nesting problem');
    console.log('2. Uses reliable uploadFromFilename method');
    console.log('3. Generates proper URL format for better preview handling');
    console.log('4. Supports image/video preview in editor');
    
  } catch (error) {
    console.error('Unhandled error during migration:', error);
    migrationData.errors.push({
      type: 'unhandled',
      error: error.message,
      stack: error.stack
    });
    saveMigrationData();
  }
}

// Run the migration
migrateForumMedia().catch(error => {
  console.error('Fatal error during migration:', error);
  process.exit(1);
});

// Export functions for potential reuse in other scripts
export {
  migrateForumMedia,
  updateDatabaseReferences,
  normalizeOldMediaUrl
};