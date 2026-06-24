/**
 * Banner Slide Migration Script
 * 
 * This script migrates all banner slides from the filesystem to Object Storage.
 * After running this script, all banner slides will be available in Object Storage
 * with the BANNER bucket, ensuring no filesystem fallbacks are needed.
 * 
 * Usage:
 * node migrate-banner-slides.js
 */

const fs = require('fs');
const path = require('path');

// Banner slides directory in filesystem
const BANNER_SLIDE_DIR = path.join(__dirname, 'uploads', 'banner-slides');

/**
 * Migrates all banner slides from filesystem to Object Storage using our enhanced banner-storage-override functions
 */
async function migrateBannerSlides() {
  console.log('Starting banner slide migration to Object Storage...');
  console.log(`Source directory: ${BANNER_SLIDE_DIR}`);
  
  if (!fs.existsSync(BANNER_SLIDE_DIR)) {
    console.log('Banner slides directory does not exist, nothing to migrate');
    return;
  }

  // Get list of all banner slides in filesystem
  const files = fs.readdirSync(BANNER_SLIDE_DIR).filter(file => 
    // Skip temporary and hidden files
    !file.startsWith('.') && 
    !file.startsWith('tmp') && 
    !file.includes('placeholder')
  );
  
  console.log(`Found ${files.length} banner slides in filesystem to migrate`);
  
  // Import the migration function from our banner-storage-override module
  const { migrateBannerSlideToObjectStorage, BANNER_BUCKET } = await import('./dist/server/banner-storage-override.js');
  
  // Migrate each file
  const results = {
    success: 0,
    failed: 0,
    alreadyExists: 0
  };

  for (const file of files) {
    console.log(`\nMigrating: ${file}...`);
    
    try {
      // Use our specialized migration function
      const migrated = await migrateBannerSlideToObjectStorage(file);
      
      if (migrated) {
        console.log(`✅ Successfully migrated ${file} to Object Storage (BANNER bucket)`);
        results.success++;
      } else {
        console.log(`❌ Failed to migrate ${file} - check logs for details`);
        results.failed++;
      }
    } catch (error) {
      console.error(`❌ Error migrating ${file}:`, error);
      results.failed++;
    }
  }
  
  console.log('\n===== Migration Summary =====');
  console.log(`✓ Successfully migrated: ${results.success}`);
  console.log(`✓ Already in Object Storage: ${results.alreadyExists}`);
  console.log(`✗ Failed: ${results.failed}`);
  console.log(`Total files processed: ${files.length}`);
  
  if (results.failed === 0) {
    console.log('\n🎉 All banner slides successfully migrated to Object Storage!');
    console.log('You can now use Object Storage exclusively for banner slides.');
    
    // Create a migration log file
    const logData = {
      timestamp: new Date().toISOString(),
      totalFiles: files.length,
      success: results.success,
      alreadyExists: results.alreadyExists,
      failed: results.failed,
      bucket: BANNER_BUCKET
    };
    
    fs.writeFileSync(
      'banner-slides-migration-log.json', 
      JSON.stringify(logData, null, 2)
    );
    console.log('Migration log saved to banner-slides-migration-log.json');
  } else {
    console.log(`\n⚠️ WARNING: ${results.failed} files failed to migrate. Please check logs.`);
  }
}

// Run the migration
console.log('===== BANNER SLIDES MIGRATION TO OBJECT STORAGE =====');
console.log('This script will migrate all banner slides from filesystem to Object Storage');
console.log('All slides will be stored in the BANNER bucket exclusively\n');

migrateBannerSlides().catch(error => {
  console.error('Migration failed with error:', error);
  process.exit(1);
});