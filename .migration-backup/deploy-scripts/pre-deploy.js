/**
 * Pre-deploy script to backup media files
 * 
 * Run this before deploying to save media files in the database
 * Usage: node deploy-scripts/pre-deploy.js
 */

const { storeMediaFiles } = require('../deploy-hooks');

// Run the backup process
console.log('Starting pre-deployment media backup...');

storeMediaFiles()
  .then(({ totalFiles, savedFiles }) => {
    console.log(`Pre-deployment backup complete: ${savedFiles}/${totalFiles} files backed up`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Pre-deployment backup failed:', error);
    process.exit(1);
  });