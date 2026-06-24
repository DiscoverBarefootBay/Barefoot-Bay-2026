/**
 * Section-Specific Bucket Migration Script
 * 
 * This script handles the migration of section-specific media to Replit Object Storage:
 * - CALENDAR: Calendar events and event images
 * - FORUM: Forum post and comment images
 * - VENDORS: Vendor media
 * - SALE: Real estate listings and for-sale item images
 * - COMMUNITY: Community-related media
 * 
 * Usage:
 * node migrate-section-media.js [--section=<section>] [--verify] [--batch-size=50] [--dry-run]
 * 
 * Options:
 * --section     Specific section to migrate (calendar, forum, vendors, sale, community)
 * --verify      Verify existing migrations without migrating new files
 * --batch-size  Number of files to process in each batch (default: 50)
 * --dry-run     Run without actually migrating files
 */

// Load environment variables
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const { db } = require('./server/db');
const { objectStorageService, BUCKETS } = require('./server/object-storage-service');
const { migrationService, SOURCE_TYPE, MIGRATION_STATUS } = require('./server/migration-service');
const { ensureDirectoryExists } = require('./server/media-path-utils');
const mime = require('mime-types');

// Configure command-line options
program
  .option('--section <name>', 'Specific section to migrate (calendar, forum, vendors, sale, community)')
  .option('--verify', 'Verify existing migrations without migrating new files')
  .option('--batch-size <number>', 'Number of files to process in each batch', parseInt, 50)
  .option('--dry-run', 'Run without actually migrating files')
  .parse(process.argv);

const options = program.opts();

// Section-specific media configuration
const SECTION_CONFIG = {
  calendar: {
    directories: ['calendar', 'events'],
    mediaTypes: ['calendar', 'event'],
    bucket: BUCKETS.CALENDAR,
    title: 'CALENDAR'
  },
  forum: {
    directories: ['forum', 'forum-media'],
    mediaTypes: ['forum', 'forum_post', 'forum_comment'],
    bucket: BUCKETS.FORUM,
    title: 'FORUM'
  },
  vendors: {
    directories: ['vendors', 'vendor-media', 'predefined-vendors', 'generated-vendors'],
    mediaTypes: ['vendor'],
    bucket: BUCKETS.VENDORS,
    title: 'VENDORS'
  },
  sale: {
    directories: ['real-estate', 'real-estate-media', 'for-sale'],
    mediaTypes: ['real_estate', 'real_estate_media', 'for_sale'],
    bucket: BUCKETS.SALE,
    title: 'SALE'
  },
  community: {
    directories: ['community', 'content-media'],
    mediaTypes: ['community'],
    bucket: BUCKETS.COMMUNITY,
    title: 'COMMUNITY'
  }
};

// Determine which sections to process
let sectionsToProcess = [];
if (options.section) {
  if (!SECTION_CONFIG[options.section]) {
    console.error(`Error: Unknown section "${options.section}". Valid sections are: calendar, forum, vendors, sale, community`);
    process.exit(1);
  }
  sectionsToProcess = [options.section];
} else {
  sectionsToProcess = Object.keys(SECTION_CONFIG);
}

// Counters for reporting
const stats = {
  total: 0,
  migrated: 0,
  failed: 0,
  verified: 0,
  skipped: 0
};

/**
 * Migrate a single file to object storage
 * @param {string} filePath Path to the file to migrate
 * @param {string} mediaType Media type category
 * @param {string} bucket Storage bucket
 * @returns {Promise<object>} Migration result
 */
async function migrateFile(filePath, mediaType, bucket) {
  try {
    const relativePath = filePath.replace(process.cwd(), '');
    console.log(`Migrating file: ${relativePath} (${mediaType})`);

    // Check if file has already been migrated
    const existingRecords = await migrationService.getMigrationsBySourceLocation(filePath);
    
    if (existingRecords.length > 0) {
      const record = existingRecords[0];
      
      // If already successfully migrated, skip
      if (record.migrationStatus === MIGRATION_STATUS.MIGRATED) {
        console.log(`- File already migrated: ${relativePath}`);
        stats.skipped++;
        return { success: true, skipped: true, record };
      }
      
      // If previously failed, retry unless it's verify-only mode
      if (record.migrationStatus === MIGRATION_STATUS.FAILED && options.verify) {
        console.log(`- Skipping previously failed migration in verify-only mode: ${relativePath}`);
        stats.skipped++;
        return { success: false, skipped: true, record };
      }
    }

    // Skip actual migration in dry-run mode
    if (options.dryRun) {
      console.log(`- [DRY RUN] Would migrate: ${relativePath}`);
      stats.skipped++;
      return { success: true, dryRun: true };
    }

    // Create migration record
    const filename = path.basename(filePath);
    const storageKey = `${mediaType}/${filename}`;
    
    const migrationRecord = await migrationService.createMigrationRecord({
      sourceType: SOURCE_TYPE.FILESYSTEM,
      sourceLocation: filePath,
      mediaBucket: bucket,
      mediaType,
      storageKey,
      migrationStatus: MIGRATION_STATUS.PENDING
    });

    // Upload to object storage
    const url = await objectStorageService.uploadFile(filePath, mediaType, filename);
    
    // Update migration record to migrated
    const updatedRecord = await migrationService.updateMigrationStatus(
      migrationRecord.id,
      MIGRATION_STATUS.MIGRATED
    );
    
    console.log(`- Migrated: ${relativePath} -> ${url}`);
    stats.migrated++;
    
    return { success: true, url, record: updatedRecord };
  } catch (error) {
    console.error(`- Error migrating file ${filePath}:`, error);
    stats.failed++;
    return { success: false, error: error.message };
  }
}

/**
 * Verify a previously migrated file exists in object storage
 * @param {object} record Migration record to verify
 * @returns {Promise<object>} Verification result
 */
async function verifyMigration(record) {
  try {
    console.log(`Verifying migration: ${record.sourceLocation} (${record.mediaType})`);
    
    // Skip already verified records
    if (record.verificationStatus) {
      console.log(`- Already verified: ${record.sourceLocation}`);
      stats.skipped++;
      return { success: true, skipped: true, record };
    }
    
    // Skip verification in dry-run mode
    if (options.dryRun) {
      console.log(`- [DRY RUN] Would verify: ${record.sourceLocation}`);
      stats.skipped++;
      return { success: true, dryRun: true };
    }

    // Check if file exists in object storage
    const exists = await objectStorageService.fileExists(record.storageKey);
    
    if (exists) {
      // Mark as verified
      const updatedRecord = await migrationService.markAsVerified(record.id);
      console.log(`- Verified: ${record.sourceLocation}`);
      stats.verified++;
      return { success: true, record: updatedRecord };
    } else {
      console.error(`- Verification failed: ${record.sourceLocation} - File not found in storage`);
      stats.failed++;
      return { success: false, error: 'File not found in object storage' };
    }
  } catch (error) {
    console.error(`- Error verifying migration ${record.id}:`, error);
    stats.failed++;
    return { success: false, error: error.message };
  }
}

/**
 * Scan a directory for files to migrate
 * @param {string} directory Directory to scan
 * @param {string} mediaType Media type category
 * @param {string} bucket Storage bucket
 * @returns {Promise<Array>} Array of file paths
 */
async function scanDirectory(directory, mediaType, bucket) {
  // Make sure directory exists
  const dirPath = path.join(process.cwd(), directory);
  ensureDirectoryExists(dirPath);
  
  try {
    console.log(`\nScanning directory: ${directory}`);
    
    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      console.log(`- Directory does not exist: ${directory}`);
      return [];
    }
    
    const files = fs.readdirSync(dirPath);
    
    // Filter out directories and unsupported file types
    const filePaths = files
      .filter(file => {
        // Skip directories and hidden files
        const filePath = path.join(dirPath, file);
        try {
          return fs.existsSync(filePath) && 
                 !fs.statSync(filePath).isDirectory() && 
                 !file.startsWith('.');
        } catch (error) {
          console.error(`- Error checking file ${filePath}:`, error);
          return false;
        }
      })
      .map(file => path.join(dirPath, file));
    
    console.log(`- Found ${filePaths.length} files in ${directory}`);
    return filePaths;
  } catch (error) {
    console.error(`Error scanning directory ${directory}:`, error);
    return [];
  }
}

/**
 * Process files in batches
 * @param {Array} files Array of file paths to process
 * @param {string} mediaType Media type category
 * @param {string} bucket Storage bucket
 * @returns {Promise<void>}
 */
async function processBatch(files, mediaType, bucket) {
  console.log(`\nProcessing batch of ${files.length} files`);
  
  // Process files in smaller chunks to prevent memory issues
  const batchSize = options.batchSize;
  
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    console.log(`- Processing batch ${i/batchSize + 1} (${batch.length} files)`);
    
    // Process batch in parallel
    await Promise.all(batch.map(file => migrateFile(file, mediaType, bucket)));
  }
}

/**
 * Verify migrations in batches
 * @param {Array} records Migration records to verify
 * @returns {Promise<void>}
 */
async function verifyBatch(records) {
  console.log(`\nVerifying batch of ${records.length} migrations`);
  
  // Process records in smaller chunks to prevent memory issues
  const batchSize = options.batchSize;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    console.log(`- Verifying batch ${i/batchSize + 1} (${batch.length} records)`);
    
    // Process batch in parallel
    await Promise.all(batch.map(record => verifyMigration(record)));
  }
}

/**
 * Process a single section
 * @param {string} sectionKey Section identifier (calendar, forum, etc.)
 * @returns {Promise<void>}
 */
async function processSection(sectionKey) {
  const config = SECTION_CONFIG[sectionKey];
  
  console.log(`\n${config.title} BUCKET MIGRATION`);
  console.log('======================');
  
  if (options.verify) {
    console.log('Verifying existing migrations...');
    
    // Get all migrated records for this bucket
    const migratedRecords = await db.query(
      "SELECT * FROM migration_records WHERE media_bucket = $1 AND migration_status = $2 AND verification_status = false",
      [config.bucket, MIGRATION_STATUS.MIGRATED]
    );
    
    console.log(`Found ${migratedRecords.rows.length} unverified migrations for ${config.title} bucket`);
    stats.total += migratedRecords.rows.length;
    
    // Verify in batches
    await verifyBatch(migratedRecords.rows);
    
    console.log(`\n${config.title} verification complete!`);
  } else {
    // Process each directory for this section
    let allFiles = [];
    
    for (const directory of config.directories) {
      // Use first media type by default - for most cases this is fine
      const mediaType = config.mediaTypes[0];
      const files = await scanDirectory(directory, mediaType, config.bucket);
      allFiles = [...allFiles, ...files];
    }
    
    console.log(`\nTotal files found for ${config.title}: ${allFiles.length}`);
    stats.total += allFiles.length;
    
    // Process files in batches
    if (allFiles.length > 0) {
      await processBatch(allFiles, config.mediaTypes[0], config.bucket);
    }
    
    console.log(`\n${config.title} migration complete!`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('SECTION-SPECIFIC BUCKET MIGRATION');
  console.log('================================');
  console.log(`Mode: ${options.verify ? 'Verify Only' : 'Full Migration'}${options.dryRun ? ' (DRY RUN)' : ''}`);
  console.log(`Batch size: ${options.batchSize} files`);
  console.log(`Sections: ${sectionsToProcess.join(', ')}`);
  console.log('================================\n');
  
  try {
    // Process each selected section
    for (const section of sectionsToProcess) {
      await processSection(section);
    }
    
    // Print summary
    console.log('\nSUMMARY:');
    console.log(`Total files:     ${stats.total}`);
    console.log(`Migrated:        ${stats.migrated}`);
    console.log(`Verified:        ${stats.verified}`);
    console.log(`Failed:          ${stats.failed}`);
    console.log(`Skipped:         ${stats.skipped}`);
    
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
main().catch(console.error).finally(() => {
  console.log('Done!');
  process.exit(0);
});