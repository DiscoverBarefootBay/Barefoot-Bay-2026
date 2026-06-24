/**
 * Script to migrate local files to their appropriate Replit Object Storage buckets
 * with robust tracking and verification
 * 
 * This script scans multiple directories and migrates files to the correct storage buckets
 * according to their usage in the application, while tracking migration status in the database:
 * - Calendar bucket: files from /calendar and /events pages
 * - Forum bucket: files from /forum pages
 * - Sale bucket: files from /for-sale pages
 * - Vendors bucket: files from /vendors pages
 * - Community bucket: files from /community pages
 * 
 * Usage:
 * node migrate-to-buckets.js [--dry-run] [--batch-size=50] [--verify] [--force]
 * 
 * Options:
 *   --dry-run         Run without actually uploading files
 *   --batch-size=N    Process N files per batch (default: 50)
 *   --verify          Verify already migrated files in object storage
 *   --force           Re-upload files even if they exist in migration records
 */

// This is a CommonJS file that imports the compiled TypeScript service
const { objectStorageService } = require('./dist/server/object-storage-service');
const { migrationService, SOURCE_TYPE, MIGRATION_STATUS } = require('./dist/server/migration-service');
const fs = require('fs');
const path = require('path');

// Media directories mapping by usage context and target bucket
const MEDIA_DIRECTORIES = [
  // Calendar bucket (for calendar and events pages)
  { path: 'calendar', mediaType: 'calendar', bucket: 'CALENDAR' },
  { path: 'uploads/calendar', mediaType: 'calendar', bucket: 'CALENDAR' },
  
  // Forum bucket (for forum pages)
  { path: 'forum-media', mediaType: 'forum', bucket: 'FORUM' },
  { path: 'uploads/forum-media', mediaType: 'forum', bucket: 'FORUM' },
  
  // Vendors bucket (for vendors pages)
  { path: 'vendor-media', mediaType: 'vendor', bucket: 'VENDORS' },
  { path: 'uploads/vendor-media', mediaType: 'vendor', bucket: 'VENDORS' },
  
  // Sale bucket (for for-sale pages)
  { path: 'real-estate-media', mediaType: 'real_estate_media', bucket: 'SALE' },
  { path: 'uploads/real-estate-media', mediaType: 'real_estate_media', bucket: 'SALE' },
  
  // Community bucket (for community pages)
  { path: 'avatars', mediaType: 'avatars', bucket: 'COMMUNITY' },
  { path: 'uploads/avatars', mediaType: 'avatars', bucket: 'COMMUNITY' },
  { path: 'content-media', mediaType: 'content', bucket: 'COMMUNITY' },
  { path: 'uploads/content-media', mediaType: 'content', bucket: 'COMMUNITY' },
  
  // Default bucket for general assets
  { path: 'banner-slides', mediaType: 'banner_slides', bucket: 'DEFAULT' },
  { path: 'uploads/banner-slides', mediaType: 'banner_slides', bucket: 'DEFAULT' },
  { path: 'icons', mediaType: 'icons', bucket: 'DEFAULT' },
  { path: 'uploads/icons', mediaType: 'icons', bucket: 'DEFAULT' },
];

/**
 * Process a single file for migration
 * @param {string} filePath Full path to the file
 * @param {string} mediaType Media type category
 * @param {string} bucket Target bucket
 * @param {boolean} forceUpload Force upload even if already exists
 * @param {boolean} dryRun If true, don't actually upload
 * @returns {Object} Migration result
 */
async function processFile(filePath, mediaType, bucket, forceUpload = false, dryRun = false) {
  try {
    const filename = path.basename(filePath);
    const storageKey = `${mediaType}/${filename}`;
    const sourceLocation = filePath;
    
    // Check if file was already migrated
    const existingRecord = await migrationService.getMigrationBySource(sourceLocation, SOURCE_TYPE.FILESYSTEM);
    
    if (existingRecord && existingRecord.migrationStatus === MIGRATION_STATUS.MIGRATED && !forceUpload) {
      console.log(`File already migrated, skipping: ${filePath}`);
      return { 
        status: 'skipped', 
        size: 0,
        record: existingRecord
      };
    }
    
    if (dryRun) {
      console.log(`[DRY RUN] Would migrate file: ${filePath} to ${bucket}/${storageKey}`);
      return { 
        status: 'dry_run',
        size: fs.statSync(filePath).size
      };
    }
    
    // Create a pending migration record if one doesn't exist
    let migrationRecord = existingRecord;
    if (!migrationRecord) {
      migrationRecord = await migrationService.createMigrationRecord({
        sourceType: SOURCE_TYPE.FILESYSTEM,
        sourceLocation: sourceLocation,
        mediaBucket: bucket,
        mediaType: mediaType,
        storageKey: storageKey,
        migrationStatus: MIGRATION_STATUS.PENDING
      });
    } else if (existingRecord.migrationStatus === MIGRATION_STATUS.FAILED || forceUpload) {
      // Update status to pending for retry
      migrationRecord = await migrationService.updateMigrationStatus(
        existingRecord.id, 
        MIGRATION_STATUS.PENDING
      );
    }
    
    // Skip if we couldn't create a record for some reason
    if (!migrationRecord) {
      throw new Error('Failed to create migration record');
    }
    
    // Upload to object storage
    const url = await objectStorageService.uploadFile(filePath, mediaType);
    
    // Update migration record to migrated
    await migrationService.updateMigrationStatus(
      migrationRecord.id, 
      MIGRATION_STATUS.MIGRATED
    );
    
    // Get file size
    const stats = fs.statSync(filePath);
    
    return {
      status: 'migrated',
      size: stats.size,
      record: migrationRecord,
      url
    };
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    
    // If we have a migration record, update it with the error
    if (arguments[3] && arguments[3].id) {
      await migrationService.updateMigrationStatus(
        arguments[3].id, 
        MIGRATION_STATUS.FAILED,
        error instanceof Error ? error.message : String(error)
      );
    }
    
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      size: 0
    };
  }
}

/**
 * Verify files that have been migrated
 * @returns {Promise<void>}
 */
async function verifyMigratedFiles() {
  console.log('Starting verification of migrated files...');
  
  // Get migrated files that haven't been verified
  const migratedRecords = await migrationService.getMigrationsByStatus(MIGRATION_STATUS.MIGRATED, 1000);
  console.log(`Found ${migratedRecords.length} migrated files to verify`);
  
  let verified = 0;
  let failed = 0;
  
  for (const record of migratedRecords) {
    if (record.verificationStatus) {
      continue; // Skip already verified files
    }
    
    try {
      console.log(`Verifying file: ${record.storageKey}`);
      
      // Check if file exists in object storage
      const exists = await objectStorageService.fileExists(record.storageKey);
      
      if (exists) {
        // Mark as verified
        await migrationService.markAsVerified(record.id);
        verified++;
      } else {
        console.error(`File not found in object storage: ${record.storageKey}`);
        // Update record to failed
        await migrationService.updateMigrationStatus(
          record.id,
          MIGRATION_STATUS.FAILED,
          'File not found in object storage during verification'
        );
        failed++;
      }
    } catch (error) {
      console.error(`Error verifying file ${record.storageKey}:`, error);
      failed++;
    }
  }
  
  console.log(`Verification complete: ${verified} verified, ${failed} failed`);
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const DRY_RUN = args.includes('--dry-run');
  const VERIFY_MODE = args.includes('--verify');
  const FORCE_UPLOAD = args.includes('--force');
  const BATCH_SIZE = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '50');
  
  console.log(`
========================================================
  MEDIA MIGRATION TO REPLIT OBJECT STORAGE BUCKETS
  ${new Date().toISOString()}
  ${DRY_RUN ? '[DRY RUN]' : '[LIVE RUN]'}
  ${VERIFY_MODE ? '[VERIFICATION MODE]' : ''}
  ${FORCE_UPLOAD ? '[FORCE UPLOAD]' : ''}
========================================================
`);

  // If in verify mode, just verify existing migrations and exit
  if (VERIFY_MODE) {
    await verifyMigratedFiles();
    return;
  }

  // Migration statistics
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let totalSize = 0;
  const allErrors = [];

  // Process each directory
  for (const { path: dirPath, mediaType, bucket } of MEDIA_DIRECTORIES) {
    if (!fs.existsSync(dirPath)) {
      console.log(`Directory does not exist, skipping: ${dirPath}`);
      continue;
    }
    
    console.log(`\nProcessing directory: ${dirPath} (media type: ${mediaType}, bucket: ${bucket})`);
    
    // Get files in directory
    const files = fs.readdirSync(dirPath)
      .filter(file => !fs.statSync(path.join(dirPath, file)).isDirectory())
      .map(file => path.join(dirPath, file));
    
    console.log(`Found ${files.length} files in ${dirPath}`);
    
    if (DRY_RUN) {
      console.log(`[DRY RUN] Would process ${files.length} files from ${dirPath}`);
      totalSize += files.reduce((acc, file) => acc + fs.statSync(file).size, 0);
      continue;
    }
    
    // Process files in batches
    let processedCount = 0;
    while (processedCount < files.length) {
      const currentBatch = files.slice(processedCount, processedCount + BATCH_SIZE);
      console.log(`Processing batch: ${processedCount + 1} to ${processedCount + currentBatch.length} of ${files.length}`);
      
      // Process batch concurrently
      const results = await Promise.all(
        currentBatch.map(file => processFile(file, mediaType, bucket, FORCE_UPLOAD, DRY_RUN))
      );
      
      // Update statistics
      const batchStats = results.reduce((stats, result) => {
        if (result.status === 'migrated') {
          stats.migrated++;
          stats.size += result.size;
        } else if (result.status === 'skipped') {
          stats.skipped++;
        } else if (result.status === 'failed') {
          stats.failed++;
          stats.errors.push({
            file: result.file || currentBatch[stats.total],
            error: result.error
          });
        } else if (result.status === 'dry_run') {
          stats.size += result.size;
        }
        
        stats.total++;
        return stats;
      }, { migrated: 0, skipped: 0, failed: 0, total: 0, size: 0, errors: [] });
      
      totalMigrated += batchStats.migrated;
      totalSkipped += batchStats.skipped;
      totalFailed += batchStats.failed;
      totalSize += batchStats.size;
      allErrors.push(...batchStats.errors);
      
      // Update progress
      processedCount += currentBatch.length;
      
      console.log(`Batch progress: ${batchStats.migrated} migrated, ${batchStats.skipped} skipped, ${batchStats.failed} failed`);
      
      // Short delay between batches to avoid overwhelming the API
      if (processedCount < files.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // Get overall migration stats from database
  let dbStats;
  try {
    dbStats = await migrationService.getMigrationStats();
  } catch (error) {
    console.error('Error getting migration stats from database:', error);
    dbStats = { pending: 0, migrated: 0, failed: 0, verified: 0, total: 0 };
  }
  
  // Final summary
  console.log(`
========================================================
  MIGRATION TO BUCKETS COMPLETE
========================================================
SESSION SUMMARY:
- Files migrated: ${totalMigrated}
- Files skipped: ${totalSkipped}
- Files failed: ${totalFailed}
- Total data size: ${(totalSize / 1024 / 1024).toFixed(2)} MB

DATABASE STATS:
- Pending: ${dbStats.pending}
- Migrated: ${dbStats.migrated}
- Failed: ${dbStats.failed}
- Verified: ${dbStats.verified}
- Total tracked: ${dbStats.total}
- ${DRY_RUN ? '[THIS WAS A DRY RUN - NO ACTUAL UPLOADS PERFORMED]' : ''}
  `);
  
  if (allErrors.length > 0) {
    console.log('\nERRORS:');
    allErrors.forEach(err => {
      console.log(`- ${err.file}: ${err.error}`);
    });
  }
}

main().catch(console.error);