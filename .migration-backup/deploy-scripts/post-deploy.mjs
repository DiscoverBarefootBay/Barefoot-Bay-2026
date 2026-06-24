/**
 * Post-Deployment Script
 * 
 * Restores media files from PostgreSQL database and verifies all references
 * 
 * This script:
 * 1. Restores all backed up media files to their original locations
 * 2. Verifies banner slide path references and fixes any mismatches
 * 3. Verifies forum media path references and fixes any mismatches
 * 4. Verifies avatar path references and fixes any mismatches
 * 
 * Usage:
 *   npx tsx deploy-scripts/post-deploy.mjs
 */

// Import directly from the TypeScript source
import { DatabaseStorage } from '../server/storage';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Print banner
console.log(`
========================================================
  BAREFOOT BAY POST-DEPLOYMENT MEDIA RESTORE
  ${new Date().toISOString()}
========================================================
`);

async function main() {
  try {
    console.log('Starting post-deployment media restoration...');
    
    // Initialize storage
    const storage = new DatabaseStorage();
    
    // Restore media files from database
    console.log('Restoring media files from database...');
    const restoreResult = await storage.restoreMediaFilesFromDatabase();
    
    console.log(`
RESTORE SUMMARY:
- Files restored: ${restoreResult.restored}
- Total data size: ${(restoreResult.totalSize / 1024 / 1024).toFixed(2)} MB
- Errors encountered: ${restoreResult.errors.length}
    `);
    
    if (restoreResult.errors.length > 0) {
      console.log('ERRORS:');
      restoreResult.errors.forEach(err => {
        console.log(`- ${err.file}: ${err.error}`);
      });
    }
    
    // Verify banner slide paths
    console.log('\nVerifying banner slide paths...');
    const bannerResult = await storage.verifyBannerSlidePaths();
    
    if (bannerResult.updated) {
      console.log(`Successfully fixed ${bannerResult.fixed} banner slide references`);
    } else {
      console.log('No banner slide path issues found or fixed');
    }
    
    // Verify forum media paths
    console.log('\nVerifying forum media paths...');
    const forumResult = await storage.verifyForumMediaPaths();
    
    if (forumResult.updated) {
      console.log(`Successfully fixed ${forumResult.fixed} forum media references`);
    } else {
      console.log('No forum media path issues found or fixed');
    }
    
    // Verify avatar paths
    console.log('\nVerifying avatar paths...');
    const avatarResult = await storage.verifyAvatarPaths();
    
    if (avatarResult.updated) {
      console.log(`Successfully fixed ${avatarResult.fixed} avatar references`);
    } else {
      console.log('No avatar path issues found or fixed');
    }
    
    console.log(`
========================================================
  POST-DEPLOYMENT MEDIA RESTORE COMPLETE
  Media files have been restored and verified
========================================================
`);
  } catch (error) {
    console.error('Error in post-deployment script:', error);
    process.exit(1);
  } finally {
    // Ensure process exits
    process.exit(0);
  }
}

// Run the main function
main();