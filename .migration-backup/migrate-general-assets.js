/**
 * Migration script for general assets (avatars, banner slides, and site-wide icons)
 * 
 * This script specifically targets the DEFAULT bucket assets, including:
 * - User avatar icons from /avatars
 * - Homepage banner slides from /banner-slides
 * - Site-wide icons like rocket and weather icons
 * 
 * Usage:
 * node migrate-general-assets.js [--batch=50] [--verify] [--force]
 * 
 * Options:
 *   --batch=50     Number of files to process in each batch (default: 50)
 *   --verify       Only verify already migrated files without migrating new ones
 *   --force        Force re-migration of already migrated files
 */

// This is a CommonJS file that imports the compiled TypeScript services
const { objectStorageService } = require('./dist/server/object-storage-service');
const { migrationService, SOURCE_TYPE, MIGRATION_STATUS } = require('./dist/server/migration-service');
const { db, pool } = require('./dist/server/db');
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { program } = require('commander');

// Define source paths for general assets
const AVATAR_PATHS = ['./avatars', './uploads/avatars'];
const BANNER_PATHS = ['./banner-slides', './uploads/banner-slides'];
const ICON_PATHS = ['./icons'];
const OTHER_GENERAL_PATHS = ['./*.png', './*.jpg', './*.gif', './*.svg']; // Root icons like favicon

// Define the asset types
const ASSET_TYPES = {
  AVATAR: 'avatar',
  BANNER: 'banner',
  ICON: 'icon',
  GENERAL: 'general'
};

// Parse command line options
program
  .option('--batch <number>', 'Number of files to process in each batch', 50)
  .option('--verify', 'Only verify already migrated files without migrating new ones')
  .option('--force', 'Force re-migration of already migrated files')
  .parse(process.argv);

const options = program.opts();
const BATCH_SIZE = parseInt(options.batch, 10);
const VERIFY_ONLY = options.verify || false;
const FORCE_REMIGRATION = options.force || false;

/**
 * Determine asset type based on file path
 * @param {string} filePath - Path to the file
 * @returns {string} Asset type
 */
function determineAssetType(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  if (normalizedPath.includes('/avatars/')) {
    return ASSET_TYPES.AVATAR;
  } else if (normalizedPath.includes('/banner-slides/')) {
    return ASSET_TYPES.BANNER;
  } else if (normalizedPath.includes('/icons/')) {
    return ASSET_TYPES.ICON;
  } else {
    // Check if it's a root icon like favicon
    const filename = path.basename(normalizedPath).toLowerCase();
    if (filename.includes('favicon') || filename.includes('logo') || 
        filename.includes('icon') || filename.includes('weather') || 
        filename.includes('rocket')) {
      return ASSET_TYPES.ICON;
    }
    return ASSET_TYPES.GENERAL;
  }
}

/**
 * Generate storage key for a file
 * @param {string} filePath - Path to the file
 * @param {string} assetType - Type of asset
 * @returns {string} Storage key
 */
function generateStorageKey(filePath, assetType) {
  const filename = path.basename(filePath);
  
  switch (assetType) {
    case ASSET_TYPES.AVATAR:
      return `avatars/${filename}`;
    case ASSET_TYPES.BANNER:
      return `banner-slides/${filename}`;
    case ASSET_TYPES.ICON:
      return `icons/${filename}`;
    default:
      return `general/${filename}`;
  }
}

/**
 * Find all files to migrate
 * @returns {Promise<Array<string>>} Array of file paths
 */
async function findFilesToMigrate() {
  console.log('Finding files to migrate...');
  
  const allPaths = [
    ...AVATAR_PATHS,
    ...BANNER_PATHS,
    ...ICON_PATHS,
    ...OTHER_GENERAL_PATHS
  ];
  
  const filePromises = allPaths.map(globPath => {
    return new Promise((resolve, reject) => {
      glob(globPath, { nodir: true }, (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(files);
        }
      });
    });
  });
  
  try {
    const fileArrays = await Promise.all(filePromises);
    const allFiles = fileArrays.flat();
    
    // Deduplicate files
    const uniqueFiles = [...new Set(allFiles)];
    
    console.log(`Found ${uniqueFiles.length} files to process`);
    return uniqueFiles;
  } catch (error) {
    console.error('Error finding files:', error);
    throw error;
  }
}

/**
 * Check if a file has already been migrated
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object|null>} Migration record or null
 */
async function checkIfAlreadyMigrated(filePath) {
  try {
    const existingRecords = await migrationService.getMigrationsBySourceLocation(filePath);
    return existingRecords.length > 0 ? existingRecords[0] : null;
  } catch (error) {
    console.error(`Error checking if ${filePath} is already migrated:`, error);
    return null;
  }
}

/**
 * Migrate a single file
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object>} Migration result
 */
async function migrateFile(filePath) {
  try {
    // Skip files that don't exist
    if (!fs.existsSync(filePath)) {
      return { success: false, file: filePath, error: 'File does not exist' };
    }
    
    // Skip files that are too large (over 10MB)
    const stats = fs.statSync(filePath);
    if (stats.size > 10 * 1024 * 1024) {
      return { success: false, file: filePath, error: 'File is too large (>10MB)' };
    }
    
    // Check if already migrated
    const existingRecord = await checkIfAlreadyMigrated(filePath);
    
    // Skip if already migrated and not forced
    if (existingRecord && !FORCE_REMIGRATION) {
      if (existingRecord.migrationStatus === MIGRATION_STATUS.MIGRATED && 
          existingRecord.verificationStatus) {
        return { success: true, file: filePath, status: 'already-migrated' };
      } else if (existingRecord.migrationStatus === MIGRATION_STATUS.FAILED) {
        console.log(`Retrying failed migration for ${filePath}`);
        // Will proceed to re-migrate
      } else if (existingRecord.migrationStatus === MIGRATION_STATUS.MIGRATED && 
                !existingRecord.verificationStatus) {
        console.log(`Re-verifying unverified file ${filePath}`);
        // Try to verify the file
        const exists = await objectStorageService.fileExists(existingRecord.storageKey);
        if (exists) {
          await migrationService.markAsVerified(existingRecord.id);
          return { success: true, file: filePath, status: 'verified' };
        } else {
          // Will proceed to re-migrate
          console.log(`File ${filePath} was marked as migrated but not found in storage, re-uploading`);
        }
      }
    }
    
    // Determine asset type and generate storage key
    const assetType = determineAssetType(filePath);
    const storageKey = generateStorageKey(filePath, assetType);
    const bucket = 'DEFAULT';
    
    // Create migration record
    let migrationRecord;
    
    if (existingRecord && FORCE_REMIGRATION) {
      // Update existing record
      migrationRecord = await migrationService.updateMigrationStatus(
        existingRecord.id,
        MIGRATION_STATUS.PENDING,
        null // Clear any error message
      );
    } else if (!existingRecord) {
      // Create new record
      migrationRecord = await migrationService.createMigrationRecord({
        sourceType: SOURCE_TYPE.FILESYSTEM,
        sourceLocation: filePath,
        mediaBucket: bucket,
        mediaType: assetType,
        storageKey: storageKey,
        migrationStatus: MIGRATION_STATUS.PENDING
      });
    } else {
      migrationRecord = existingRecord;
    }
    
    // Upload the file
    console.log(`Uploading ${filePath} to ${bucket}/${storageKey}`);
    
    // Extract directory and filename for the upload function
    const directory = assetType;
    const filename = path.basename(filePath);
    
    const url = await objectStorageService.uploadFile(filePath, directory, filename);
    
    // Mark as migrated
    await migrationService.updateMigrationStatus(
      migrationRecord.id,
      MIGRATION_STATUS.MIGRATED
    );
    
    // Verify the upload
    const exists = await objectStorageService.fileExists(storageKey);
    
    if (exists) {
      await migrationService.markAsVerified(migrationRecord.id);
      return { success: true, file: filePath, url, status: 'migrated-and-verified' };
    } else {
      console.error(`ERROR: File ${filePath} was uploaded but could not be verified`);
      await migrationService.updateMigrationStatus(
        migrationRecord.id,
        MIGRATION_STATUS.FAILED,
        'File not found in storage after upload'
      );
      return { success: false, file: filePath, error: 'Verification failed' };
    }
  } catch (error) {
    console.error(`Error migrating ${filePath}:`, error);
    
    // Try to update migration record if we failed
    try {
      const existingRecord = await checkIfAlreadyMigrated(filePath);
      if (existingRecord) {
        await migrationService.updateMigrationStatus(
          existingRecord.id,
          MIGRATION_STATUS.FAILED,
          error instanceof Error ? error.message : String(error)
        );
      }
    } catch (recordError) {
      console.error('Failed to update migration record:', recordError);
    }
    
    return { success: false, file: filePath, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Verify all migrated files
 */
async function verifyMigratedFiles() {
  console.log('Verifying migrated files...');
  
  try {
    // Get migrated files that haven't been verified
    const migratedRecords = await migrationService.getMigrationsByStatus(MIGRATION_STATUS.MIGRATED, 1000);
    const unverifiedRecords = migratedRecords.filter(r => !r.verificationStatus);
    
    console.log(`Found ${unverifiedRecords.length} unverified migrated files of ${migratedRecords.length} total migrated`);
    
    if (unverifiedRecords.length === 0) {
      console.log('All migrated files have been verified');
      return;
    }
    
    let verified = 0;
    let failed = 0;
    
    for (const record of unverifiedRecords) {
      console.log(`Verifying: ${record.mediaBucket}/${record.storageKey}`);
      
      try {
        // Check if file exists in object storage
        const exists = await objectStorageService.fileExists(record.storageKey);
        
        if (exists) {
          // Mark as verified
          await migrationService.markAsVerified(record.id);
          verified++;
          console.log('  ✓ Verified');
        } else {
          console.error(`  ✗ File not found in object storage`);
          // Update record to failed
          await migrationService.updateMigrationStatus(
            record.id,
            MIGRATION_STATUS.FAILED,
            'File not found in object storage during verification'
          );
          failed++;
        }
      } catch (error) {
        console.error(`  ✗ Error verifying file:`, error);
        failed++;
      }
    }
    
    console.log(`
VERIFICATION RESULTS:
============================================
- Verified: ${verified}
- Failed:   ${failed}
- Total:    ${unverifiedRecords.length}
============================================
    `);
  } catch (error) {
    console.error('Error verifying migrated files:', error);
    throw error;
  }
}

/**
 * Process files in batches
 * @param {Array<string>} files - Array of file paths
 * @returns {Promise<void>}
 */
async function processBatches(files) {
  const total = files.length;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  
  console.log(`Processing ${total} files in batches of ${BATCH_SIZE}...`);
  
  // Process files in batches
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(total / BATCH_SIZE)}...`);
    
    const results = await Promise.all(batch.map(migrateFile));
    
    // Count results
    results.forEach(result => {
      processed++;
      
      if (result.success) {
        if (result.status === 'already-migrated') {
          skipped++;
        } else {
          succeeded++;
        }
      } else {
        failed++;
      }
    });
    
    // Log progress
    console.log(`Progress: ${processed}/${total} (${Math.round(processed / total * 100)}%)`);
    console.log(`- Migrated:   ${succeeded}`);
    console.log(`- Failed:     ${failed}`);
    console.log(`- Skipped:    ${skipped}`);
    
    // Short delay to prevent overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`
MIGRATION RESULTS:
============================================
- Successfully migrated: ${succeeded}
- Failed:                ${failed}
- Skipped:               ${skipped}
- Total processed:       ${processed}
============================================
  `);
}

/**
 * Main function
 */
async function main() {
  console.log(`
========================================================
  GENERAL ASSETS MIGRATION
  ${new Date().toISOString()}
  Mode: ${VERIFY_ONLY ? 'Verify only' : 'Migration'}
  Batch size: ${BATCH_SIZE}
  Force re-migration: ${FORCE_REMIGRATION}
========================================================
`);
  
  try {
    if (VERIFY_ONLY) {
      await verifyMigratedFiles();
    } else {
      const files = await findFilesToMigrate();
      await processBatches(files);
      
      // Verify all files after migration
      await verifyMigratedFiles();
    }
    
    // Show final migration status
    const stats = await migrationService.getMigrationStats();
    
    console.log(`
FINAL MIGRATION STATUS:
============================================
- Pending:   ${stats.pending}
- Migrated:  ${stats.migrated}
- Failed:    ${stats.failed}
- Verified:  ${stats.verified}
- Total:     ${stats.total}
============================================
    `);
  } finally {
    // Close database connection
    await pool.end();
    console.log('Migration completed.');
  }
}

// Run the migration
main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});