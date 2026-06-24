/**
 * Continue Forum Media Migration
 * 
 * This script continues the forum media migration process if it was interrupted.
 * It loads the existing migration data and continues from where it left off.
 */

import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mime from 'mime-types';

// Support for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const FORUM_BUCKET = 'FORUM';
const FILESYSTEM_PATHS = [
  path.join(process.cwd(), 'forum-media'),
  path.join(process.cwd(), 'uploads', 'forum-media'),
  path.join(process.cwd(), 'uploads', 'forum'),
  path.join(process.cwd(), 'forum')
];
const MIGRATION_LOG_FILE = 'forum-media-migration-log.json';
const DIRECT_FORUM_URL_PREFIX = '/api/storage-proxy/direct-forum/';
const MAX_BATCH_SIZE = 50; // Further increased batch size for faster processing
const MAX_FILES_TO_PROCESS = 200; // Further increased file limit for faster migration

// Initialize Object Storage client
const client = new Client();

// Tracking variables
let totalFiles = 0;
let migratedFiles = 0;
let skippedFiles = 0;
let failedFiles = 0;
const failedFilesList = [];
let migrationData = { 
  startTime: new Date().toISOString(),
  completionTime: null,
  migratedFiles: [],
  databaseUpdates: {
    posts: 0,
    comments: 0
  },
  errors: []
};

/**
 * Load previous migration data from file if available
 */
function loadPreviousMigrationData() {
  if (fs.existsSync(MIGRATION_LOG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(MIGRATION_LOG_FILE, 'utf8'));
      console.log(`Loaded previous migration data with ${data.migratedFiles?.length || 0} files`);
      return data;
    } catch (error) {
      console.error(`Error loading migration data: ${error.message}`);
    }
  }
  return null;
}

/**
 * Save migration data to file
 */
function saveMigrationData() {
  migrationData.completionTime = new Date().toISOString();
  
  try {
    fs.writeFileSync(MIGRATION_LOG_FILE, JSON.stringify(migrationData, null, 2));
    console.log(`Migration data saved to ${MIGRATION_LOG_FILE}`);
  } catch (error) {
    console.error(`Error saving migration data: ${error.message}`);
  }
}

/**
 * Upload a file to Object Storage
 * @param {string} filePath - Path to the file
 * @param {string} filename - Name of the file
 * @param {string} originalPath - Original path for logging
 * @returns {Promise<Object>} - Upload result
 */
async function uploadFile(filePath, filename, originalPath) {
  try {
    // Simplify storage key to just the filename - no nesting
    const storageKey = filename;
    
    // Check if this file has already been processed in a previous run
    const existingFile = migrationData.migratedFiles.find(f => f.filename === filename);
    if (existingFile) {
      console.log(`File ${filename} was already migrated in a previous run - skipping`);
      skippedFiles++;
      return {
        success: true,
        skipped: true,
        filename,
        url: DIRECT_FORUM_URL_PREFIX + filename,
        originalPath
      };
    }
    
    // Get content type
    const contentType = mime.lookup(filename) || 'application/octet-stream';
    
    // Upload the file
    console.log(`Uploading ${filename} to ${FORUM_BUCKET}/${storageKey}...`);
    try {
      // Use uploadFromFilename method
      await client.uploadFromFilename(storageKey, filePath, {
        contentType,
        bucketName: FORUM_BUCKET
      });
      
      console.log(`Successfully uploaded ${filename}`);
      migratedFiles++;
      
      const uploadResult = {
        success: true,
        filename,
        url: DIRECT_FORUM_URL_PREFIX + filename,
        originalPath,
        contentType,
        size: fs.statSync(filePath).size,
        timestamp: new Date().toISOString()
      };
      
      // Add to migration data
      migrationData.migratedFiles.push(uploadResult);
      
      // Save migration data periodically (every 20 files)
      if (migratedFiles % 20 === 0) {
        saveMigrationData();
      }
      
      return uploadResult;
    } catch (uploadError) {
      console.error(`Failed to upload ${filename}:`, uploadError.message);
      failedFiles++;
      
      const errorResult = { 
        filename, 
        originalPath,
        error: uploadError.message
      };
      
      failedFilesList.push(errorResult);
      migrationData.errors.push({
        type: 'upload',
        ...errorResult
      });
      
      return {
        success: false,
        ...errorResult
      };
    }
  } catch (error) {
    console.error(`Error uploading ${filename}:`, error);
    failedFiles++;
    
    const errorResult = { 
      filename, 
      originalPath,
      error: error.message
    };
    
    failedFilesList.push(errorResult);
    migrationData.errors.push({
      type: 'upload',
      ...errorResult
    });
    
    return {
      success: false,
      ...errorResult
    };
  }
}

/**
 * Get the next batch of files to process
 * @returns {Promise<Array<{path: string, file: string}>>} Array of files to process
 */
async function getNextFileBatch() {
  const filesToProcess = [];
  
  // Get all files from all directories
  for (const dirPath of FILESYSTEM_PATHS) {
    if (!fs.existsSync(dirPath)) {
      continue;
    }
    
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      
      // Skip directories
      if (fs.statSync(filePath).isDirectory()) {
        continue;
      }
      
      // Skip non-media files
      const ext = path.extname(file).toLowerCase();
      const mediaExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.mp4', '.mov', '.webm'];
      if (!mediaExts.includes(ext)) {
        continue;
      }
      
      // Skip already migrated files
      const existingFile = migrationData.migratedFiles.find(f => f.filename === file);
      if (existingFile) {
        continue;
      }
      
      filesToProcess.push({
        path: filePath,
        file: file
      });
      
      // Limit the number of files to process in a single run
      if (filesToProcess.length >= MAX_FILES_TO_PROCESS) {
        break;
      }
    }
    
    // Stop if we have enough files
    if (filesToProcess.length >= MAX_FILES_TO_PROCESS) {
      break;
    }
  }
  
  return filesToProcess;
}

/**
 * Continue the migration process
 */
async function continueForumMediaMigration() {
  console.log('Continuing forum media migration to Object Storage...');
  
  // Load previous migration data
  const previousData = loadPreviousMigrationData();
  if (previousData) {
    migrationData = previousData;
    console.log(`Continuing from previous migration with ${migrationData.migratedFiles.length} files already processed`);
  } else {
    console.log('No previous migration data found - starting fresh');
  }
  
  // Get the next batch of files to process
  const filesToProcess = await getNextFileBatch();
  console.log(`Found ${filesToProcess.length} files to process in this run`);
  
  if (filesToProcess.length === 0) {
    console.log('No more files to process - migration complete!');
    saveMigrationData();
    return;
  }
  
  // Process files in batches
  const batches = [];
  for (let i = 0; i < filesToProcess.length; i += MAX_BATCH_SIZE) {
    batches.push(filesToProcess.slice(i, i + MAX_BATCH_SIZE));
  }
  
  console.log(`Processing ${batches.length} batches of up to ${MAX_BATCH_SIZE} files each`);
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} files)`);
    
    for (const fileInfo of batch) {
      await uploadFile(fileInfo.path, fileInfo.file, fileInfo.path);
    }
    
    // Save after each batch
    saveMigrationData();
  }
  
  console.log('\nMigration batch complete!');
  console.log(`Processed ${filesToProcess.length} files`);
  console.log(`Migrated: ${migratedFiles}`);
  console.log(`Skipped: ${skippedFiles}`);
  console.log(`Failed: ${failedFiles}`);
  
  if (failedFiles > 0) {
    console.log('\nFailed files:');
    for (const failedFile of failedFilesList) {
      console.log(`- ${failedFile.filename}: ${failedFile.error}`);
    }
  }
  
  saveMigrationData();
}

// Run the migration
continueForumMediaMigration().catch(error => {
  console.error('Fatal error during migration continuation:', error);
  process.exit(1);
});