/**
 * Script to migrate files stored in PostgreSQL to Replit Object Storage
 * 
 * This script extracts media files stored in the database (media_files table)
 * and uploads them to the appropriate Replit Object Storage buckets while
 * tracking migration status in the database.
 * 
 * Usage:
 * node migrate-from-postgresql.js [--batch-size=N] [--verify]
 * 
 * Options:
 *   --batch-size=N    Process N files per batch (default: 50)
 *   --verify          Only verify files that have already been migrated
 */

// This is a CommonJS file that imports the compiled TypeScript service
const { objectStorageService } = require('./dist/server/object-storage-service');
const { migrationService, SOURCE_TYPE, MIGRATION_STATUS } = require('./dist/server/migration-service');
const { pool } = require('./dist/server/db');

async function verifyMigratedFiles() {
  console.log('Starting verification of PostgreSQL-migrated files...');
  
  // Get migrated files
  const migratedRecords = await migrationService.getMigrationsByStatus(MIGRATION_STATUS.MIGRATED, 1000);
  const postgresRecords = migratedRecords.filter(r => r.sourceType === SOURCE_TYPE.POSTGRESQL);
  
  console.log(`Found ${postgresRecords.length} PostgreSQL migrated files to verify`);
  
  let verified = 0;
  let failed = 0;
  
  for (const record of postgresRecords) {
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
  const VERIFY_MODE = args.includes('--verify');
  const BATCH_SIZE = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '50');
  
  console.log(`
========================================================
  POSTGRESQL MEDIA MIGRATION TO REPLIT OBJECT STORAGE
  ${new Date().toISOString()}
  ${VERIFY_MODE ? '[VERIFICATION MODE]' : `[BATCH SIZE: ${BATCH_SIZE}]`}
========================================================
`);

  try {
    // If in verify mode, just verify existing migrations
    if (VERIFY_MODE) {
      await verifyMigratedFiles();
      return;
    }
    
    // Get statistics on what's already been migrated
    const dbStats = await migrationService.getMigrationStats();
    
    console.log(`
CURRENT MIGRATION STATUS:
- Pending: ${dbStats.pending}
- Migrated: ${dbStats.migrated}
- Failed: ${dbStats.failed}
- Verified: ${dbStats.verified}
- Total tracked: ${dbStats.total}
`);
    
    // Check if the PostgreSQL connection is available
    const connTest = await pool.query('SELECT NOW()');
    console.log(`PostgreSQL connection established: ${connTest.rows[0].now}`);
    
    // Begin the migration
    console.log(`Starting PostgreSQL to Object Storage migration with batch size ${BATCH_SIZE}...`);
    
    const result = await objectStorageService.migrateFromPostgres(BATCH_SIZE);
    
    console.log(`
========================================================
  POSTGRESQL MIGRATION COMPLETE
========================================================
- Files migrated: ${result.migrated}
- Files failed: ${result.failed}
- Total data size: ${(result.totalSize / 1024 / 1024).toFixed(2)} MB
`);
    
    if (result.errors.length > 0) {
      console.log('\nERRORS:');
      result.errors.forEach(err => {
        console.log(`- ${err.file}: ${err.error}`);
      });
    }
    
    // Get final statistics
    const finalStats = await migrationService.getMigrationStats();
    
    console.log(`
FINAL MIGRATION STATUS:
- Pending: ${finalStats.pending}
- Migrated: ${finalStats.migrated}
- Failed: ${finalStats.failed}
- Verified: ${finalStats.verified}
- Total tracked: ${finalStats.total}
`);
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    console.log('Migration process complete');
    
    // Close the pool to allow the script to exit
    await pool.end();
  }
}

main().catch(console.error);