/**
 * Post-deploy script to restore media files
 * 
 * Run this after deploying to restore media files from the database
 * Usage: node deploy-scripts/post-deploy.js
 */

const { restoreMediaFiles } = require('../deploy-hooks');

// Run the restore process
console.log('Starting post-deployment media restoration...');

restoreMediaFiles()
  .then(({ restoredFiles }) => {
    console.log(`Post-deployment restoration complete: ${restoredFiles} files restored`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Post-deployment restoration failed:', error);
    process.exit(1);
  });