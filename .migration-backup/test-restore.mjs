/**
 * Test script to restore a small set of media files
 */

import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Pool } = pkg;

// Connect to database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Test restore directory
const TEST_RESTORE_DIR = 'test-media-restore';

/**
 * Create the directory if it doesn't exist
 * @param {string} dirPath - Directory path to create
 */
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

/**
 * Restore test media files from the database
 */
async function restoreTestMediaFiles() {
  try {
    console.log('Beginning test media file restoration...');
    
    // Get all files from database
    const result = await pool.query('SELECT filename, directory, file_data FROM media_files');
    let restoredFiles = 0;
    
    if (result.rows.length === 0) {
      console.log('No media files found in database to restore');
      return { restoredFiles: 0 };
    }
    
    console.log(`Found ${result.rows.length} files to restore`);
    
    // Create the test restore directory
    ensureDirectory(TEST_RESTORE_DIR);
    
    for (const row of result.rows) {
      try {
        const originalDirectory = row.directory;
        const filename = row.filename;
        
        // Create a similar directory structure but under TEST_RESTORE_DIR
        const relativePath = originalDirectory.split('/').slice(1).join('/');
        const targetDir = path.join(TEST_RESTORE_DIR, relativePath);
        
        // Ensure the target directory exists
        ensureDirectory(targetDir);
        
        // Write file to new location
        const targetPath = path.join(targetDir, filename);
        fs.writeFileSync(targetPath, row.file_data);
        
        console.log(`Restored file: ${targetPath}`);
        restoredFiles++;
      } catch (fileError) {
        console.error(`Error restoring file ${row.directory}/${row.filename}:`, fileError);
      }
    }
    
    console.log(`Test restoration complete: Restored ${restoredFiles}/${result.rows.length} files`);
    return { restoredFiles };
  } catch (error) {
    console.error('Error restoring test media files:', error);
    return { restoredFiles: 0, error };
  } finally {
    // Close DB pool
    await pool.end();
  }
}

// Execute the test
restoreTestMediaFiles()
  .then(({ restoredFiles }) => {
    console.log(`Test restoration summary: ${restoredFiles} files restored`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Test restoration failed:', error);
    process.exit(1);
  });