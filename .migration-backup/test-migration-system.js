/**
 * Test script for the media persistence migration system
 * 
 * This script provides utility functions to test different aspects
 * of the migration system, including verification, status checks,
 * and simulated test migrations.
 * 
 * Usage:
 * node test-migration-system.js [--mode=status|verify|test]
 * 
 * Options:
 *   --mode=status    Show current migration statistics (default)
 *   --mode=verify    Run verification of migrated files
 *   --mode=test      Run a test migration with sample files
 *   --bucket=NAME    Specify bucket to test (DEFAULT, CALENDAR, FORUM, etc.)
 */

// This is a CommonJS file that imports the compiled TypeScript services
const { objectStorageService } = require('./dist/server/object-storage-service');
const { migrationService, SOURCE_TYPE, MIGRATION_STATUS } = require('./dist/server/migration-service');
const { pool } = require('./dist/server/db');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Test modes
const MODES = {
  STATUS: 'status',
  VERIFY: 'verify',
  TEST: 'test'
};

// Default test files directory
const TEST_FILES_DIR = 'test-migration';

/**
 * Check overall migration status
 */
async function checkMigrationStatus() {
  console.log('Checking migration status...');
  
  try {
    // Get migration statistics
    const stats = await migrationService.getMigrationStats();
    
    console.log(`
MIGRATION STATUS:
============================================
- Pending:   ${stats.pending}
- Migrated:  ${stats.migrated}
- Failed:    ${stats.failed}
- Verified:  ${stats.verified}
- Total:     ${stats.total}
============================================
    `);
    
    // If we have failed migrations, show some details
    if (stats.failed > 0) {
      // Get some failed records
      const failedRecords = await migrationService.getMigrationsByStatus(MIGRATION_STATUS.FAILED, 10);
      
      console.log(`FAILED MIGRATIONS (showing ${failedRecords.length} of ${stats.failed}):`);
      failedRecords.forEach(record => {
        console.log(`- ${record.sourceLocation} -> ${record.mediaBucket}/${record.storageKey}`);
        console.log(`  Error: ${record.errorMessage || 'Unknown error'}`);
      });
    }
    
    return stats;
  } catch (error) {
    console.error('Error checking migration status:', error);
    throw error;
  }
}

/**
 * Verify migrated files exist in object storage
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
 * Create test files for migration testing
 * @param {string} bucket Target bucket
 * @returns {Array<string>} Generated file paths
 */
async function createTestFiles(bucket = 'DEFAULT') {
  console.log(`Creating test files for bucket: ${bucket}`);
  
  // Map bucket to media type
  const mediaTypeMap = {
    'DEFAULT': 'test',
    'CALENDAR': 'calendar',
    'FORUM': 'forum',
    'VENDORS': 'vendor',
    'SALE': 'real_estate_media',
    'COMMUNITY': 'community'
  };
  
  const mediaType = mediaTypeMap[bucket] || 'test';
  
  // Create test directory if it doesn't exist
  if (!fs.existsSync(TEST_FILES_DIR)) {
    fs.mkdirSync(TEST_FILES_DIR, { recursive: true });
  }
  
  // Create a few test files with different sizes and types
  const testFiles = [
    {
      name: `test-small-${Date.now()}.txt`,
      size: 1024, // 1KB
      type: 'text'
    },
    {
      name: `test-medium-${Date.now()}.bin`,
      size: 1024 * 50, // 50KB
      type: 'binary'
    },
    {
      name: `test-large-${Date.now()}.bin`,
      size: 1024 * 100, // 100KB
      type: 'binary'
    }
  ];
  
  const filePaths = [];
  
  // Generate the files
  for (const file of testFiles) {
    const filePath = path.join(TEST_FILES_DIR, file.name);
    
    // Generate random content based on type
    if (file.type === 'text') {
      // Generate readable text
      let content = '';
      for (let i = 0; i < file.size; i += 32) {
        content += `This is a test file for the migration system. `;
      }
      // Trim to exact size
      content = content.substring(0, file.size);
      fs.writeFileSync(filePath, content);
    } else {
      // Generate random binary data
      const buffer = crypto.randomBytes(file.size);
      fs.writeFileSync(filePath, buffer);
    }
    
    filePaths.push(filePath);
    console.log(`Created test file: ${filePath} (${file.size} bytes)`);
  }
  
  return { filePaths, mediaType, bucket };
}

/**
 * Run a test migration
 * @param {string} bucket Target bucket
 */
async function runTestMigration(bucket = 'DEFAULT') {
  console.log(`Running test migration for bucket: ${bucket}`);
  
  try {
    // Create test files
    const { filePaths, mediaType, bucket: targetBucket } = await createTestFiles(bucket);
    
    // Migrate each test file
    console.log('Migrating test files...');
    const migrationResults = [];
    
    for (const filePath of filePaths) {
      const filename = path.basename(filePath);
      const storageKey = `${mediaType}/${filename}`;
      
      try {
        // Create migration record
        const migrationRecord = await migrationService.createMigrationRecord({
          sourceType: SOURCE_TYPE.FILESYSTEM,
          sourceLocation: filePath,
          mediaBucket: targetBucket,
          mediaType: mediaType,
          storageKey: storageKey,
          migrationStatus: MIGRATION_STATUS.PENDING
        });
        
        // Upload to object storage
        console.log(`Uploading: ${filePath} -> ${targetBucket}/${storageKey}`);
        const url = await objectStorageService.uploadFile(filePath, mediaType, filename);
        
        // Update migration record
        await migrationService.updateMigrationStatus(
          migrationRecord.id,
          MIGRATION_STATUS.MIGRATED
        );
        
        migrationResults.push({
          file: filePath,
          status: 'success',
          url,
          record: migrationRecord
        });
        
        console.log(`  ✓ Migrated successfully: ${url}`);
      } catch (error) {
        console.error(`  ✗ Migration failed:`, error);
        migrationResults.push({
          file: filePath,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Verify the migrated files
    console.log('\nVerifying migrated files...');
    
    for (const result of migrationResults) {
      if (result.status === 'success') {
        try {
          const exists = await objectStorageService.fileExists(result.record.storageKey);
          
          if (exists) {
            await migrationService.markAsVerified(result.record.id);
            console.log(`  ✓ Verified: ${result.file}`);
          } else {
            console.error(`  ✗ Verification failed: ${result.file} - File not found in storage`);
          }
        } catch (error) {
          console.error(`  ✗ Verification error: ${result.file}`, error);
        }
      }
    }
    
    // Display summary
    const successCount = migrationResults.filter(r => r.status === 'success').length;
    const failedCount = migrationResults.filter(r => r.status === 'failed').length;
    
    console.log(`
TEST MIGRATION RESULTS:
============================================
- Successful: ${successCount}
- Failed:     ${failedCount}
- Total:      ${migrationResults.length}
============================================
    `);
    
  } catch (error) {
    console.error('Error running test migration:', error);
    throw error;
  }
}

/**
 * Main function to run tests
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const modeArg = args.find(arg => arg.startsWith('--mode='));
  const bucketArg = args.find(arg => arg.startsWith('--bucket='));
  
  const mode = modeArg ? modeArg.split('=')[1] : MODES.STATUS;
  const bucket = bucketArg ? bucketArg.split('=')[1] : 'DEFAULT';
  
  console.log(`
========================================================
  MEDIA MIGRATION SYSTEM TEST
  ${new Date().toISOString()}
  Mode: ${mode}
  ${bucket ? `Bucket: ${bucket}` : ''}
========================================================
`);
  
  try {
    // Run the appropriate test mode
    switch (mode) {
      case MODES.STATUS:
        await checkMigrationStatus();
        break;
      case MODES.VERIFY:
        await verifyMigratedFiles();
        break;
      case MODES.TEST:
        await runTestMigration(bucket);
        break;
      default:
        console.error(`Unknown test mode: ${mode}`);
        console.log(`Valid modes: ${Object.values(MODES).join(', ')}`);
    }
  } catch (error) {
    console.error('Error running tests:', error);
  } finally {
    // Close database connection
    await pool.end();
    console.log('Tests completed.');
  }
}

// Run the tests
main().catch(console.error);