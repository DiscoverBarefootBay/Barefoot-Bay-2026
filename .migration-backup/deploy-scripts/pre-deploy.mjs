/**
 * Pre-Deployment Script
 * 
 * Backs up all media files to PostgreSQL database before deployment
 * 
 * This script:
 * 1. Creates a media_files table if it doesn't exist
 * 2. Scans all media directories
 * 3. Stores file contents as binary data in the database
 * 
 * Usage:
 *   npx tsx deploy-scripts/pre-deploy.mjs
 */

// Import directly from the TypeScript source
import { DatabaseStorage } from '../server/storage';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Print banner
console.log(`
========================================================
  BAREFOOT BAY PRE-DEPLOYMENT MEDIA BACKUP
  ${new Date().toISOString()}
========================================================
`);

async function main() {
  try {
    console.log('Starting pre-deployment media backup...');
    
    // Initialize storage
    const storage = new DatabaseStorage();
    
    // Create media_files table if it doesn't exist
    console.log('Creating media_files table if needed...');
    const tableCreated = await storage.createMediaFilesTable();
    
    if (!tableCreated) {
      console.error('Failed to create media_files table. Backup may not work correctly.');
    }
    
    // Backup media files
    console.log('Backing up media files to database...');
    const mediaDirectories = [
      'banner-slides',
      'uploads/banner-slides',
      'forum-media', 
      'uploads/forum-media',
      'avatars',
      'uploads/avatars',
      'calendar',
      'uploads/calendar',
      'content-media',
      'uploads/content-media',
      'real-estate-media',
      'uploads/real-estate-media',
      'vendor-media',
      'uploads/vendor-media'
    ];
    
    const backupResult = await storage.backupMediaFilesToDatabase(mediaDirectories);
    
    console.log(`
BACKUP SUMMARY:
- Files backed up: ${backupResult.backedUp}
- Total data size: ${(backupResult.totalSize / 1024 / 1024).toFixed(2)} MB
- Files skipped (unchanged): ${backupResult.skipped}
- Errors encountered: ${backupResult.errors.length}
    `);
    
    if (backupResult.errors.length > 0) {
      console.log('ERRORS:');
      backupResult.errors.forEach(err => {
        console.log(`- ${err.file}: ${err.error}`);
      });
    }
    
    console.log(`
========================================================
  PRE-DEPLOYMENT MEDIA BACKUP COMPLETE
  Files will be restored after deployment
========================================================
`);
  } catch (error) {
    console.error('Error in pre-deployment script:', error);
    process.exit(1);
  } finally {
    // Ensure process exits
    process.exit(0);
  }
}

// Run the main function
main();