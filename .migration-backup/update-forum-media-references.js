/**
 * Update forum media references in database
 * 
 * This script specifically focuses on updating database references to use the new
 * Object Storage URLs for forum media. It can be run independently from the
 * migration script once files have been uploaded.
 */

import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

// Constants
const DIRECT_FORUM_URL_PREFIX = '/api/storage-proxy/direct-forum/';

// Tracking variables
let updatedPosts = 0;
let updatedComments = 0;
let errorCount = 0;
const errors = [];

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
 * Update database references to forum media
 */
async function updateDatabaseReferences() {
  console.log('Updating database references to forum media...');
  
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
            updatedPosts++;
            console.log(`Updated media URLs for post ${post.id}`);
          }
        } catch (error) {
          console.error(`Error updating post ${post.id}:`, error);
          errorCount++;
          errors.push({
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
            updatedComments++;
            console.log(`Updated media URLs for comment ${comment.id}`);
          }
        } catch (error) {
          console.error(`Error updating comment ${comment.id}:`, error);
          errorCount++;
          errors.push({
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
            updatedPosts++;
          }
        } catch (error) {
          console.error(`Error updating post content ${post.id}:`, error);
          errorCount++;
          errors.push({
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
            updatedComments++;
          }
        } catch (error) {
          console.error(`Error updating comment content ${comment.id}:`, error);
          errorCount++;
          errors.push({
            type: 'comment_content_update',
            commentId: comment.id,
            error: error.message
          });
        }
      }
      
      console.log('\nSummary:');
      console.log(`Updated ${updatedPosts} forum posts`);
      console.log(`Updated ${updatedComments} forum comments`);
      console.log(`Encountered ${errorCount} errors`);
      
      if (errorCount > 0) {
        console.error('\nErrors:');
        console.error(JSON.stringify(errors, null, 2));
      }
    } finally {
      // Release the client
      client.release();
    }
  } catch (error) {
    console.error('Database connection error:', error);
  }
}

// Run the database update
updateDatabaseReferences().catch(error => {
  console.error('Fatal error during database update:', error);
  process.exit(1);
});