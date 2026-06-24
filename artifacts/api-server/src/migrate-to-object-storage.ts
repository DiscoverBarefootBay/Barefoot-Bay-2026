/**
 * Migration Utility: PostgreSQL Media Storage to Replit Object Storage
 * 
 * This script migrates all media files stored in the PostgreSQL database
 * to Replit Object Storage, ensuring both systems work during the transition.
 * 
 * Usage:
 * npx tsx server/migrate-to-object-storage.ts [--dry-run] [--batch-size=100]
 */

import { pool } from './db';
import { objectStorageService } from './object-storage-service';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { MEDIA_TYPES } from './media-path-utils';

// Convert fs methods to Promise-based
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const exists = (path: string) => fs.promises.access(path).then(() => true).catch(() => false);

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BATCH_SIZE = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '50');

// Media directories to migrate
const MEDIA_DIRECTORIES = [
  { path: 'banner-slides', type: MEDIA_TYPES.BANNER_SLIDES },
  { path: 'uploads/banner-slides', type: MEDIA_TYPES.BANNER_SLIDES },
  { path: 'forum-media', type: MEDIA_TYPES.FORUM },
  { path: 'uploads/forum-media', type: MEDIA_TYPES.FORUM },
  { path: 'avatars', type: MEDIA_TYPES.AVATARS },
  { path: 'uploads/avatars', type: MEDIA_TYPES.AVATARS },
  { path: 'calendar', type: MEDIA_TYPES.CALENDAR },
  { path: 'uploads/calendar', type: MEDIA_TYPES.CALENDAR },
  { path: 'content-media', type: MEDIA_TYPES.CONTENT },
  { path: 'uploads/content-media', type: MEDIA_TYPES.CONTENT },
  { path: 'real-estate-media', type: MEDIA_TYPES.REAL_ESTATE_MEDIA },
  { path: 'uploads/real-estate-media', type: MEDIA_TYPES.REAL_ESTATE_MEDIA },
  { path: 'vendor-media', type: MEDIA_TYPES.VENDOR },
  { path: 'uploads/vendor-media', type: MEDIA_TYPES.VENDOR }
];

// Database tables that contain media references
const MEDIA_REFERENCE_TABLES = [
  { table: 'site_settings', columns: ['value'] },
  { table: 'events', columns: ['mediaUrls', 'mediaUrl'] },
  { table: 'forum_posts', columns: ['mediaUrls'] },
  { table: 'forum_comments', columns: ['mediaUrls'] },
  { table: 'users', columns: ['avatarUrl'] },
  { table: 'page_contents', columns: ['content'] },
  { table: 'real_estate_listings', columns: ['mediaUrls'] },
  { table: 'banner_slides', columns: ['imageUrl'] },
  { table: 'vendor_categories', columns: ['imageUrl'] },
  { table: 'products', columns: ['imageUrl', 'imageUrls'] }
];

/**
 * Migrate media files from PostgreSQL to Replit Object Storage
 */
async function migrateFromPostgres() {
  console.log(`
========================================================
  MEDIA MIGRATION: POSTGRESQL → REPLIT OBJECT STORAGE
  ${new Date().toISOString()}
  ${DRY_RUN ? '[DRY RUN]' : '[LIVE RUN]'}
========================================================
`);

  try {
    // Step 1: Check if media_files table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'media_files'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.error('Error: media_files table does not exist in the database.');
      return;
    }
    
    // Step 2: Get count of files to migrate
    const countResult = await pool.query('SELECT COUNT(*) FROM media_files');
    const totalFiles = parseInt(countResult.rows[0].count);
    
    console.log(`Found ${totalFiles} files to migrate from PostgreSQL`);
    
    if (totalFiles === 0) {
      console.log('No files to migrate.');
      return;
    }
    
    // Migration statistics
    let migrated = 0;
    let failed = 0;
    let totalSize = 0;
    const errors: { file: string, error: string }[] = [];
    
    // Step 3: Process files in batches
    let offset = 0;
    
    while (offset < totalFiles) {
      console.log(`Processing batch: ${offset} to ${Math.min(offset + BATCH_SIZE, totalFiles)}`);
      
      // Get a batch of files
      const result = await pool.query(
        'SELECT id, filename, directory, file_data, file_size, mime_type FROM media_files ORDER BY id LIMIT $1 OFFSET $2',
        [BATCH_SIZE, offset]
      );
      
      // Process each file in the batch
      for (const file of result.rows) {
        const { id, filename, directory, file_data, file_size, mime_type } = file;
        const storageKey = path.join(directory, filename).replace(/\\/g, '/');
        
        try {
          console.log(`Processing file: ${storageKey} (${Math.round(file_size / 1024)}KB)`);
          
          if (DRY_RUN) {
            console.log(`[DRY RUN] Would upload file: ${storageKey}`);
            migrated++;
            totalSize += file_size;
            continue;
          }
          
          // Determine media type based on directory
          let mediaType = directory.replace('uploads/', '');
          
          // If the directory is just one of our media types, use that directly
          if (Object.values(MEDIA_TYPES).includes(mediaType)) {
            // We already have the correct media type
          } else if (Object.values(MEDIA_TYPES).includes(directory)) {
            mediaType = directory;
          } else {
            // Default to the directory name
            console.log(`Could not determine media type for ${directory}, using as-is`);
          }
          
          // Create temp file to upload
          const tempDir = path.join('temp-migration');
          if (!(await exists(tempDir))) {
            await mkdir(tempDir, { recursive: true });
          }
          
          const tempFilePath = path.join(tempDir, filename);
          await writeFile(tempFilePath, file_data);
          
          // Upload to object storage
          const objectPath = await objectStorageService.uploadFile(tempFilePath, mediaType, filename);
          
          // Clean up temp file
          fs.unlinkSync(tempFilePath);
          
          console.log(`Uploaded to object storage: ${objectPath}`);
          
          // Mark as uploaded in database (optional)
          // await pool.query(
          //   'UPDATE media_files SET migrated_to_object_storage = true WHERE id = $1',
          //   [id]
          // );
          
          migrated++;
          totalSize += file_size;
          
        } catch (error) {
          console.error(`Error processing file ${storageKey}:`, error);
          failed++;
          errors.push({
            file: storageKey,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      // Move to next batch
      offset += BATCH_SIZE;
      
      // Summary after each batch
      console.log(`
Batch progress:
- Migrated: ${migrated}/${totalFiles}
- Failed: ${failed}
- Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB
      `);
    }
    
    // Final summary
    console.log(`
========================================================
  MIGRATION COMPLETE
========================================================
- Files migrated: ${migrated}/${totalFiles} (${((migrated/totalFiles) * 100).toFixed(2)}%)
- Files failed: ${failed}
- Total data size: ${(totalSize / 1024 / 1024).toFixed(2)} MB
- ${DRY_RUN ? '[THIS WAS A DRY RUN - NO ACTUAL UPLOADS PERFORMED]' : ''}
    `);
    
    if (errors.length > 0) {
      console.log('\nERRORS:');
      errors.forEach(err => {
        console.log(`- ${err.file}: ${err.error}`);
      });
    }
    
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await pool.end();
  }
}

/**
 * Migrate local files to Replit Object Storage
 */
async function migrateLocalFiles() {
  console.log(`
========================================================
  LOCAL FILES MIGRATION TO REPLIT OBJECT STORAGE
  ${new Date().toISOString()}
  ${DRY_RUN ? '[DRY RUN]' : '[LIVE RUN]'}
========================================================
`);
  
  let totalMigrated = 0;
  let totalFailed = 0;
  let totalSize = 0;
  const allErrors: { file: string, error: string }[] = [];
  
  // Process each media directory
  for (const { path: dirPath, type } of MEDIA_DIRECTORIES) {
    if (!fs.existsSync(dirPath)) {
      console.log(`Directory does not exist, skipping: ${dirPath}`);
      continue;
    }
    
    console.log(`\nProcessing directory: ${dirPath} (type: ${type})`);
    
    if (DRY_RUN) {
      const fileCount = fs.readdirSync(dirPath).filter(file => 
        !fs.statSync(path.join(dirPath, file)).isDirectory()
      ).length;
      console.log(`[DRY RUN] Would process ${fileCount} files from ${dirPath}`);
      continue;
    }
    
    // Perform actual migration
    const result = await objectStorageService.migrateFromLocalDirectory(dirPath, type);
    
    totalMigrated += result.migrated;
    totalFailed += result.failed;
    totalSize += result.totalSize;
    allErrors.push(...result.errors);
    
    console.log(`Directory migration results:
- Migrated: ${result.migrated}
- Failed: ${result.failed}
- Size: ${(result.totalSize / 1024 / 1024).toFixed(2)} MB
    `);
  }
  
  console.log(`
========================================================
  LOCAL FILES MIGRATION COMPLETE
========================================================
- Total files migrated: ${totalMigrated}
- Total files failed: ${totalFailed}
- Total data size: ${(totalSize / 1024 / 1024).toFixed(2)} MB
- ${DRY_RUN ? '[THIS WAS A DRY RUN - NO ACTUAL UPLOADS PERFORMED]' : ''}
  `);
  
  if (allErrors.length > 0) {
    console.log('\nERRORS:');
    allErrors.forEach(err => {
      console.log(`- ${err.file}: ${err.error}`);
    });
  }
}

/**
 * Main function to run the migration
 */
async function main() {
  // First migrate from PostgreSQL
  await migrateFromPostgres();
  
  // Then migrate any local files not in the database
  await migrateLocalFiles();
  
  console.log(`
========================================================
  MIGRATION PROCESS COMPLETE
========================================================

Next steps:
1. Update your application to use the object storage service
2. Test your application thoroughly
3. Once confirmed working, you can disable the PostgreSQL media storage
  `);
}

// Run the migration
main().catch(console.error);