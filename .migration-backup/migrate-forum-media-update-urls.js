/**
 * Migrate Forum Media URLs in Database
 * 
 * This script:
 * 1. Connects to the PostgreSQL database
 * 2. Updates media URLs in forum posts and comments
 * 3. Converts legacy URLs (/forum-media/filename.jpg) to Object Storage URLs
 */

require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');
const path = require('path');

// Constants
const FORUM_BUCKET = 'FORUM';
const FORUM_MEDIA_DIR = 'forum-media';
const LOG_FILE = 'forum-media-url-migration-log.json';
const MIGRATION_LOG_FILE = 'forum-media-migration-log.json'; 

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Load migration log if available
let migrationData = { successFiles: [] };
if (fs.existsSync(MIGRATION_LOG_FILE)) {
  try {
    migrationData = JSON.parse(fs.readFileSync(MIGRATION_LOG_FILE, 'utf8'));
    console.log(`Loaded migration data with ${migrationData.successFiles.length} successfully migrated files`);
  } catch (error) {
    console.error(`Error loading migration log: ${error.message}`);
  }
}

/**
 * Main function to update URLs in database
 */
async function updateDatabaseUrls() {
  console.log('Starting forum media URL migration in database');
  
  // Create migration log
  const urlMigrationLog = {
    startTime: new Date().toISOString(),
    postsUpdated: 0,
    commentsUpdated: 0,
    updatedUrls: [],
    errors: []
  };
  
  try {
    // Connect to database
    const client = await pool.connect();
    console.log('Connected to database');
    
    try {
      // 1. Update forum posts media_urls array
      console.log('Updating forum posts media_urls...');
      const postResults = await updatePostsMediaUrls(client, urlMigrationLog);
      urlMigrationLog.postsUpdated = postResults.updatedCount;
      
      // 2. Update forum comments media_urls array
      console.log('Updating forum comments media_urls...');
      const commentResults = await updateCommentsMediaUrls(client, urlMigrationLog);
      urlMigrationLog.commentsUpdated = commentResults.updatedCount;
      
      // 3. Update media URLs in post content (rich text content may contain image tags)
      console.log('Updating forum posts content with embedded media...');
      const postContentResults = await updatePostsContent(client, urlMigrationLog);
      urlMigrationLog.postsContentUpdated = postContentResults.updatedCount;
      
      // 4. Update media URLs in comment content
      console.log('Updating forum comments content with embedded media...');
      const commentContentResults = await updateCommentsContent(client, urlMigrationLog);
      urlMigrationLog.commentsContentUpdated = commentContentResults.updatedCount;
      
      console.log('Database update complete!');
    } finally {
      client.release();
    }
    
    // Complete the migration log
    urlMigrationLog.endTime = new Date().toISOString();
    urlMigrationLog.duration = (new Date(urlMigrationLog.endTime) - new Date(urlMigrationLog.startTime)) / 1000; // in seconds
    
    // Write the migration log
    fs.writeFileSync(LOG_FILE, JSON.stringify(urlMigrationLog, null, 2));
    
    console.log(`
URL Migration complete!
- Posts updated: ${urlMigrationLog.postsUpdated}
- Comments updated: ${urlMigrationLog.commentsUpdated}
- Posts content updated: ${urlMigrationLog.postsContentUpdated || 0}
- Comments content updated: ${urlMigrationLog.commentsContentUpdated || 0}
- Total URLs updated: ${urlMigrationLog.updatedUrls.length}
- Duration: ${urlMigrationLog.duration} seconds
    `);
  } catch (error) {
    console.error('Error updating database:', error);
    
    // Add to migration log
    urlMigrationLog.error = error.message;
    urlMigrationLog.endTime = new Date().toISOString();
    
    // Write the migration log even on error
    fs.writeFileSync(LOG_FILE, JSON.stringify(urlMigrationLog, null, 2));
  } finally {
    // Close the pool
    await pool.end();
  }
}

/**
 * Update forum posts media_urls
 * @param {Object} client - Database client
 * @param {Object} log - Migration log object
 * @returns {Object} - Results with updated count
 */
async function updatePostsMediaUrls(client, log) {
  let updatedCount = 0;
  
  // Get all posts with media_urls
  const result = await client.query('SELECT id, media_urls FROM forum_posts WHERE media_urls IS NOT NULL');
  console.log(`Found ${result.rows.length} forum posts with media_urls`);
  
  for (const post of result.rows) {
    try {
      // Skip if no media URLs
      if (!post.media_urls || post.media_urls.length === 0) continue;
      
      // Create new array with updated URLs
      const updatedUrls = post.media_urls.map(url => convertToObjectStorageUrl(url, log));
      
      // Check if any URLs were changed
      const anyUrlChanged = updatedUrls.some((url, index) => url !== post.media_urls[index]);
      
      // Update the post in database if URLs changed
      if (anyUrlChanged) {
        await client.query(
          'UPDATE forum_posts SET media_urls = $1 WHERE id = $2',
          [updatedUrls, post.id]
        );
        updatedCount++;
      }
    } catch (error) {
      console.error(`Error updating post ${post.id}:`, error);
      log.errors.push({
        type: 'post',
        id: post.id,
        error: error.message
      });
    }
  }
  
  return { updatedCount };
}

/**
 * Update forum comments media_urls
 * @param {Object} client - Database client
 * @param {Object} log - Migration log object
 * @returns {Object} - Results with updated count
 */
async function updateCommentsMediaUrls(client, log) {
  let updatedCount = 0;
  
  // Get all comments with media_urls
  const result = await client.query('SELECT id, media_urls FROM forum_comments WHERE media_urls IS NOT NULL');
  console.log(`Found ${result.rows.length} forum comments with media_urls`);
  
  for (const comment of result.rows) {
    try {
      // Skip if no media URLs
      if (!comment.media_urls || comment.media_urls.length === 0) continue;
      
      // Create new array with updated URLs
      const updatedUrls = comment.media_urls.map(url => convertToObjectStorageUrl(url, log));
      
      // Check if any URLs were changed
      const anyUrlChanged = updatedUrls.some((url, index) => url !== comment.media_urls[index]);
      
      // Update the comment in database if URLs changed
      if (anyUrlChanged) {
        await client.query(
          'UPDATE forum_comments SET media_urls = $1 WHERE id = $2',
          [updatedUrls, comment.id]
        );
        updatedCount++;
      }
    } catch (error) {
      console.error(`Error updating comment ${comment.id}:`, error);
      log.errors.push({
        type: 'comment',
        id: comment.id,
        error: error.message
      });
    }
  }
  
  return { updatedCount };
}

/**
 * Update media URLs embedded in forum posts content
 * @param {Object} client - Database client
 * @param {Object} log - Migration log object
 * @returns {Object} - Results with updated count
 */
async function updatePostsContent(client, log) {
  let updatedCount = 0;
  
  // Get all posts with content that might contain media URLs
  const result = await client.query(`
    SELECT id, content 
    FROM forum_posts 
    WHERE content LIKE '%/forum-media/%' OR content LIKE '%/uploads/forum-media/%'
  `);
  
  console.log(`Found ${result.rows.length} forum posts with potential embedded media URLs`);
  
  for (const post of result.rows) {
    try {
      // Update content with converted URLs
      const originalContent = post.content;
      const updatedContent = updateContentUrls(originalContent, log);
      
      // Update the post if content changed
      if (updatedContent !== originalContent) {
        await client.query(
          'UPDATE forum_posts SET content = $1 WHERE id = $2',
          [updatedContent, post.id]
        );
        updatedCount++;
      }
    } catch (error) {
      console.error(`Error updating post content ${post.id}:`, error);
      log.errors.push({
        type: 'post_content',
        id: post.id,
        error: error.message
      });
    }
  }
  
  return { updatedCount };
}

/**
 * Update media URLs embedded in forum comments content
 * @param {Object} client - Database client
 * @param {Object} log - Migration log object
 * @returns {Object} - Results with updated count
 */
async function updateCommentsContent(client, log) {
  let updatedCount = 0;
  
  // Get all comments with content that might contain media URLs
  const result = await client.query(`
    SELECT id, content 
    FROM forum_comments 
    WHERE content LIKE '%/forum-media/%' OR content LIKE '%/uploads/forum-media/%'
  `);
  
  console.log(`Found ${result.rows.length} forum comments with potential embedded media URLs`);
  
  for (const comment of result.rows) {
    try {
      // Update content with converted URLs
      const originalContent = comment.content;
      const updatedContent = updateContentUrls(originalContent, log);
      
      // Update the comment if content changed
      if (updatedContent !== originalContent) {
        await client.query(
          'UPDATE forum_comments SET content = $1 WHERE id = $2',
          [updatedContent, comment.id]
        );
        updatedCount++;
      }
    } catch (error) {
      console.error(`Error updating comment content ${comment.id}:`, error);
      log.errors.push({
        type: 'comment_content',
        id: comment.id,
        error: error.message
      });
    }
  }
  
  return { updatedCount };
}

/**
 * Update media URLs in content string (handles HTML content)
 * @param {string} content - Original content
 * @param {Object} log - Migration log object
 * @returns {string} - Updated content
 */
function updateContentUrls(content, log) {
  if (!content) return content;
  
  // Define regex patterns for media URLs in various formats
  const patterns = [
    // Match URLs in src/href attributes
    /src=["']([^"']*\/forum-media\/[^"']*)["']/g,
    /href=["']([^"']*\/forum-media\/[^"']*)["']/g,
    /src=["']([^"']*\/uploads\/forum-media\/[^"']*)["']/g,
    /href=["']([^"']*\/uploads\/forum-media\/[^"']*)["']/g
  ];
  
  let updatedContent = content;
  
  // Process each pattern
  for (const pattern of patterns) {
    updatedContent = updatedContent.replace(pattern, (match, url) => {
      const convertedUrl = convertToObjectStorageUrl(url, log);
      return match.replace(url, convertedUrl);
    });
  }
  
  return updatedContent;
}

/**
 * Convert a legacy URL to an Object Storage URL
 * @param {string} url - Original URL
 * @param {Object} log - Migration log object
 * @returns {string} - Converted URL
 */
function convertToObjectStorageUrl(url, log) {
  if (!url) return url;
  
  try {
    // Skip if already an Object Storage URL
    if (url.includes('object-storage.replit.app')) {
      return url;
    }
    
    // Extract filename from URL
    let filename;
    if (url.includes('/forum-media/')) {
      filename = url.split('/forum-media/').pop();
    } else if (url.includes('/uploads/forum-media/')) {
      filename = url.split('/uploads/forum-media/').pop();
    } else {
      // Not a forum media URL
      return url;
    }
    
    // Check if this file was successfully migrated to Object Storage
    const migratedFile = migrationData.successFiles.find(file => file.filename === filename);
    
    // Use the Object Storage URL if available, otherwise use storage proxy URL
    if (migratedFile) {
      // Use object storage URL
      const objectStorageUrl = migratedFile.objectStorageUrl;
      
      // Add to migration log if not already there
      if (!log.updatedUrls.some(item => item.originalUrl === url)) {
        log.updatedUrls.push({
          originalUrl: url,
          objectStorageUrl: objectStorageUrl
        });
      }
      
      return objectStorageUrl;
    } else {
      // Use storage proxy URL (which will work even if file is uploaded later)
      const proxyUrl = `/api/storage-proxy/${FORUM_BUCKET}/forum/${filename}`;
      
      // Add to migration log if not already there
      if (!log.updatedUrls.some(item => item.originalUrl === url)) {
        log.updatedUrls.push({
          originalUrl: url,
          proxyUrl: proxyUrl,
          note: "File not found in migration data, using proxy URL"
        });
      }
      
      return proxyUrl;
    }
  } catch (error) {
    console.error(`Error converting URL ${url}:`, error);
    return url; // Return original URL on error
  }
}

// Run the migration
updateDatabaseUrls().catch(error => {
  console.error('URL migration failed:', error);
  process.exit(1);
});