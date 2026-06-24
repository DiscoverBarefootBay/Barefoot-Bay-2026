/**
 * Script to test migration of a specific local directory to Replit Object Storage
 * 
 * Usage:
 * node migrate-test-directory.js <directory> <media_type>
 * 
 * Example:
 * node migrate-test-directory.js ./avatars avatars
 */

// This is a CommonJS file that imports the compiled TypeScript service
const { objectStorageService } = require('./dist/server/object-storage-service');

async function main() {
  // Get directory and media type from command line args
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node migrate-test-directory.js <directory> <media_type>');
    process.exit(1);
  }
  
  const directory = args[0];
  const mediaType = args[1];
  
  console.log(`Starting test migration of directory ${directory} as media type ${mediaType}`);
  
  try {
    // Run the migration
    const result = await objectStorageService.migrateFromLocalDirectory(directory, mediaType);
    
    // Print results
    console.log('\nMigration Results:');
    console.log(`- Files migrated: ${result.migrated}`);
    console.log(`- Files failed: ${result.failed}`);
    console.log(`- Total size: ${(result.totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(err => {
        console.log(`- ${err.file}: ${err.error}`);
      });
    }
    
    console.log('\nMigration test complete!');
  } catch (error) {
    console.error('Error during migration test:', error);
  }
}

main().catch(console.error);