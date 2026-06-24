/**
 * Pre-deployment Media Fix Script
 * 
 * This script should be run before deployment to ensure all media files are correctly
 * copied to their production paths and all database records are updated to use
 * the correct production-friendly URL format.
 * 
 * To run: 
 * node pre-deployment-media-fix.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Define all media directories that need to be checked
const MEDIA_DIRECTORIES = [
  'banner-slides',
  'calendar',
  'forum-media',
  'content-media',
  'vendor-media',
  'community-media',
  'avatars',
  'icons',
  'Real Estate'
];

// Setup PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Ensure all production media directories exist
 */
function ensureProductionDirectories() {
  console.log('Ensuring production media directories exist...');
  
  for (const dir of MEDIA_DIRECTORIES) {
    const prodDir = path.join(process.cwd(), dir);
    const uploadsDir = path.join(process.cwd(), 'uploads', dir);
    
    // Create production directory if it doesn't exist
    if (!fs.existsSync(prodDir)) {
      fs.mkdirSync(prodDir, { recursive: true });
      console.log(`Created production directory: ${prodDir}`);
    }
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log(`Created uploads directory: ${uploadsDir}`);
    }
  }
  
  console.log('All media directories verified.');
}

/**
 * Copy all files from uploads subdirectories to root production directories
 */
async function copyFilesToProductionPaths() {
  console.log('Copying files to production paths...');
  let totalCopied = 0;
  
  for (const dir of MEDIA_DIRECTORIES) {
    const uploadsDir = path.join(process.cwd(), 'uploads', dir);
    const prodDir = path.join(process.cwd(), dir);
    
    if (!fs.existsSync(uploadsDir)) {
      console.log(`Uploads directory does not exist: ${uploadsDir}`);
      continue;
    }
    
    // Get list of files in uploads directory
    try {
      const files = fs.readdirSync(uploadsDir);
      console.log(`Found ${files.length} files in ${uploadsDir}`);
      
      // Copy each file to production directory
      for (const file of files) {
        const sourcePath = path.join(uploadsDir, file);
        const destPath = path.join(prodDir, file);
        
        // Skip directories
        if (fs.statSync(sourcePath).isDirectory()) {
          continue;
        }
        
        // Only copy if destination doesn't exist or source is newer
        if (!fs.existsSync(destPath) || 
            fs.statSync(sourcePath).mtime > fs.statSync(destPath).mtime) {
          fs.copyFileSync(sourcePath, destPath);
          totalCopied++;
          console.log(`Copied: ${sourcePath} -> ${destPath}`);
        }
      }
    } catch (err) {
      console.error(`Error processing directory ${uploadsDir}:`, err);
    }
  }
  
  console.log(`Total files copied to production paths: ${totalCopied}`);
  return totalCopied;
}

/**
 * Fix database records to use production-friendly URL format
 */
async function fixDatabaseRecords() {
  console.log('Fixing database records...');
  let totalFixed = 0;
  
  try {
    // Connect to database
    const client = await pool.connect();
    
    try {
      // Start a transaction
      await client.query('BEGIN');
      
      // 1. Fix user avatars in the users table
      const fixUserAvatarsResult = await client.query(`
        UPDATE users 
        SET "avatarUrl" = REPLACE("avatarUrl", '/uploads/', '/') 
        WHERE "avatarUrl" LIKE '/uploads/%'
      `);
      console.log(`Fixed ${fixUserAvatarsResult.rowCount} user avatar URLs`);
      totalFixed += fixUserAvatarsResult.rowCount;
      
      // 2. Fix event media URLs in the events table (stored as JSON array)
      const eventsResult = await client.query(`
        SELECT id, "mediaUrls" FROM events WHERE "mediaUrls" @> '["/uploads/"]'::jsonb
      `);
      
      let eventMediaFixed = 0;
      for (const row of eventsResult.rows) {
        const mediaUrls = row.mediaUrls;
        const fixedMediaUrls = mediaUrls.map(url => url.replace('/uploads/', '/'));
        
        await client.query(`
          UPDATE events SET "mediaUrls" = $1::jsonb WHERE id = $2
        `, [JSON.stringify(fixedMediaUrls), row.id]);
        
        eventMediaFixed++;
      }
      console.log(`Fixed ${eventMediaFixed} event records with media URLs`);
      totalFixed += eventMediaFixed;
      
      // 3. Fix forum post image URLs (in content field - text search and replace)
      const fixForumPostsResult = await client.query(`
        UPDATE forum_posts 
        SET content = REPLACE(content, '/uploads/', '/') 
        WHERE content LIKE '%/uploads/%'
      `);
      console.log(`Fixed ${fixForumPostsResult.rowCount} forum posts with media URLs`);
      totalFixed += fixForumPostsResult.rowCount;
      
      // 4. Fix forum comments image URLs (in content field - text search and replace)
      const fixForumCommentsResult = await client.query(`
        UPDATE forum_comments 
        SET content = REPLACE(content, '/uploads/', '/') 
        WHERE content LIKE '%/uploads/%'
      `);
      console.log(`Fixed ${fixForumCommentsResult.rowCount} forum comments with media URLs`);
      totalFixed += fixForumCommentsResult.rowCount;
      
      // 5. Fix vendor image URLs in vendor listings
      const fixVendorResult = await client.query(`
        UPDATE vendors 
        SET 
          logo = REPLACE(logo, '/uploads/', '/'),
          "imageUrl" = REPLACE("imageUrl", '/uploads/', '/'),
          "bannerImage" = REPLACE("bannerImage", '/uploads/', '/')
        WHERE 
          logo LIKE '/uploads/%' OR 
          "imageUrl" LIKE '/uploads/%' OR 
          "bannerImage" LIKE '/uploads/%'
      `);
      console.log(`Fixed ${fixVendorResult.rowCount} vendor listings with media URLs`);
      totalFixed += fixVendorResult.rowCount;
      
      // 6. Fix real estate listings image URLs (stored as JSON array)
      const realEstateResult = await client.query(`
        SELECT id, photos FROM real_estate_listings WHERE photos @> '["/uploads/"]'::jsonb
      `);
      
      let realEstateFixed = 0;
      for (const row of realEstateResult.rows) {
        const photos = row.photos;
        const fixedPhotos = photos.map(url => url.replace('/uploads/', '/'));
        
        await client.query(`
          UPDATE real_estate_listings SET photos = $1::jsonb WHERE id = $2
        `, [JSON.stringify(fixedPhotos), row.id]);
        
        realEstateFixed++;
      }
      console.log(`Fixed ${realEstateFixed} real estate listings with media URLs`);
      totalFixed += realEstateFixed;
      
      // 7. Fix content pages with media URLs in the content field
      const fixContentPagesResult = await client.query(`
        UPDATE content_pages 
        SET content = REPLACE(content, '/uploads/', '/') 
        WHERE content LIKE '%/uploads/%'
      `);
      console.log(`Fixed ${fixContentPagesResult.rowCount} content pages with media URLs`);
      totalFixed += fixContentPagesResult.rowCount;
      
      // Commit the transaction
      await client.query('COMMIT');
      
    } catch (err) {
      // Rollback in case of error
      await client.query('ROLLBACK');
      console.error('Error fixing database records:', err);
      throw err;
    } finally {
      // Release the client back to the pool
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err);
    throw err;
  }
  
  console.log(`Total database records fixed: ${totalFixed}`);
  return totalFixed;
}

/**
 * Main function to run all media fix operations
 */
async function main() {
  console.log('Starting pre-deployment media fix...');
  
  try {
    // Step 1: Ensure all production directories exist
    ensureProductionDirectories();
    
    // Step 2: Copy files from uploads subdirectories to production paths
    const filesCopied = await copyFilesToProductionPaths();
    
    // Step 3: Fix database records to use production URL format
    const recordsFixed = await fixDatabaseRecords();
    
    console.log('\nPre-deployment media fix completed successfully:');
    console.log(`- ${filesCopied} files copied to production paths`);
    console.log(`- ${recordsFixed} database records updated to use production URL format`);
    
  } catch (err) {
    console.error('Error during pre-deployment media fix:', err);
    process.exit(1);
  } finally {
    // Close the database pool
    await pool.end();
  }
}

// Run the main function
main().catch(console.error);