/**
 * Script to copy banner slide images from local filesystem to Replit Object Storage
 * This script finds all banner slide images in the /banner-slides directory
 * and uploads them to Replit Object Storage in the DEFAULT bucket.
 * 
 * Usage:
 * node scripts/copy-banner-slides-to-object-storage.js [--recent-only] [--skip-videos] [--max-file-size=SIZE_IN_MB]
 * 
 * Options:
 *   --recent-only       Only process files from the last 7 days
 *   --skip-videos       Skip video files (.mp4, etc.)
 *   --max-file-size=10  Only process files smaller than this size in MB (default: all files)
 */

// Import required modules
import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

// Parse command line arguments
const args = process.argv.slice(2);
const RECENT_ONLY = args.includes('--recent-only');
const SKIP_VIDEOS = args.includes('--skip-videos');
const MAX_FILE_SIZE_MB = (() => {
  const arg = args.find(arg => arg.startsWith('--max-file-size='));
  if (!arg) return Infinity;
  const size = parseInt(arg.split('=')[1], 10);
  return isNaN(size) ? Infinity : size;
})();

// Constants
const BUCKETS = {
  DEFAULT: 'DEFAULT'
};

const SOURCE_DIRECTORIES = [
  './banner-slides',
  './uploads/banner-slides'
];

const TARGET_DIRECTORY = 'banner-slides';
const BASE_URL = 'https://object-storage.replit.app';

// Initialize Replit Object Storage client
const client = new Client();

/**
 * Upload a file to Replit Object Storage
 * @param {string} filePath - Path to the file to upload
 * @param {string} filename - Name of the file in object storage
 * @returns {Promise<string>} - URL of the uploaded file
 */
async function uploadFileToObjectStorage(filePath, filename) {
  try {
    // Skip if file doesn't exist or is not a file
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      console.error(`File not found or not a file: ${filePath}`);
      return null;
    }

    // Determine content type based on file extension
    const contentType = mime.lookup(filename) || 'application/octet-stream';
    
    // Create storage key (path within the bucket)
    const storageKey = path.join(TARGET_DIRECTORY, filename);
    
    // Log upload
    console.log(`Uploading ${filePath} to ${BUCKETS.DEFAULT}/${storageKey}`);
    
    // Upload the file with retries
    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;
    
    while (retryCount < maxRetries) {
      try {
        // Upload file to Replit Object Storage
        const result = await client.uploadFromFilename(storageKey, filePath, {
          contentType: contentType,
          bucketName: BUCKETS.DEFAULT,
          metadata: {
            originalPath: filePath,
            uploadDate: new Date().toISOString()
          }
        });
        
        if (!result.ok) {
          throw new Error(`Upload failed: ${result.error.message}`);
        }
        
        // Return the URL to the uploaded file
        const url = `${BASE_URL}/${BUCKETS.DEFAULT}/${storageKey}`;
        console.log(`Successfully uploaded: ${url}`);
        return url;
      } catch (error) {
        lastError = error;
        retryCount++;
        console.error(`Upload attempt ${retryCount}/${maxRetries} failed:`, error.message);
        
        if (retryCount < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = 1000 * Math.pow(2, retryCount);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error(`Failed to upload ${filePath} after ${maxRetries} attempts.`);
    return null;
  } catch (error) {
    console.error(`Error uploading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Check if a file already exists in Replit Object Storage
 * @param {string} filename - Name of the file to check
 * @returns {Promise<boolean>} - Whether the file exists
 */
async function fileExistsInObjectStorage(filename) {
  try {
    const storageKey = path.join(TARGET_DIRECTORY, filename);
    
    // Use list with a prefix to check if file exists
    const result = await client.list({ 
      prefix: storageKey,
      maxResults: 1,
      bucketName: BUCKETS.DEFAULT
    });
    
    if (result.ok && result.value.length > 0) {
      // Check if any of the returned objects match exactly
      return result.value.some(obj => obj.name === storageKey);
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking if file exists:`, error);
    return false;
  }
}

/**
 * Main function to copy banner slides to object storage
 */
async function copyBannerSlidesToObjectStorage() {
  console.log(`
==============================================
  BANNER SLIDES MIGRATION TO OBJECT STORAGE
==============================================
Options:
- Recent files only: ${RECENT_ONLY ? 'YES' : 'NO'}
- Skip videos: ${SKIP_VIDEOS ? 'YES' : 'NO'}
- Max file size: ${MAX_FILE_SIZE_MB === Infinity ? 'No limit' : MAX_FILE_SIZE_MB + ' MB'}
`);
  
  // Track overall stats
  let totalFiles = 0;
  let uploadedFiles = 0;
  let skippedFiles = 0;
  let failedFiles = 0;
  const results = [];
  
  // Calculate the date cutoff for recent files (7 days ago)
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 7);
  
  // Process each source directory
  for (const sourceDir of SOURCE_DIRECTORIES) {
    if (!fs.existsSync(sourceDir)) {
      console.log(`Directory doesn't exist, skipping: ${sourceDir}`);
      continue;
    }
    
    console.log(`\nProcessing files in ${sourceDir}...`);
    
    // Get all files in the directory
    const files = fs.readdirSync(sourceDir)
      .filter(file => {
        const filePath = path.join(sourceDir, file);
        return fs.statSync(filePath).isFile();
      });
    
    // Sort files by size (smallest first to maximize upload count)
    const filesWithStats = files.map(filename => {
      const filePath = path.join(sourceDir, filename);
      const stats = fs.statSync(filePath);
      return { 
        filename, 
        filePath, 
        size: stats.size, 
        mtime: stats.mtime,
        isVideo: filename.match(/\.(mp4|webm|mov|ogg)$/i) !== null
      };
    });
    
    // Filter files based on command line options
    const filteredFiles = filesWithStats.filter(file => {
      // Skip videos if requested
      if (SKIP_VIDEOS && file.isVideo) {
        console.log(`Skipping video file: ${file.filename}`);
        skippedFiles++;
        return false;
      }
      
      // Skip files larger than the max file size (convert bytes to MB)
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        console.log(`Skipping large file (${fileSizeMB.toFixed(2)} MB): ${file.filename}`);
        skippedFiles++;
        return false;
      }
      
      // Skip older files if recent-only flag is set
      if (RECENT_ONLY && file.mtime < recentCutoff) {
        console.log(`Skipping older file (${file.mtime.toISOString()}): ${file.filename}`);
        skippedFiles++;
        return false;
      }
      
      return true;
    });
    
    // Sort by size ascending (prioritize small files that will complete quickly)
    filteredFiles.sort((a, b) => a.size - b.size);
    
    totalFiles += filteredFiles.length;
    
    // Process each file
    for (const file of filteredFiles) {
      // Skip backup or temporary files
      if (file.filename.endsWith('.bak') || file.filename.startsWith('.')) {
        console.log(`Skipping backup/temp file: ${file.filename}`);
        skippedFiles++;
        continue;
      }
      
      try {
        // Check if file already exists in object storage
        const exists = await fileExistsInObjectStorage(file.filename);
        
        if (exists) {
          console.log(`File already exists in object storage, skipping: ${file.filename}`);
          skippedFiles++;
          continue;
        }
        
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        console.log(`Processing file: ${file.filename} (${fileSizeMB} MB)`);
        
        // Upload file to object storage
        const url = await uploadFileToObjectStorage(file.filePath, file.filename);
        
        if (url) {
          uploadedFiles++;
          results.push({
            filename: file.filename,
            originalPath: file.filePath,
            objectStorageUrl: url,
            size: file.size,
            status: "success"
          });
        } else {
          failedFiles++;
          results.push({
            filename: file.filename,
            originalPath: file.filePath,
            size: file.size,
            status: "failed"
          });
        }
      } catch (error) {
        console.error(`Error processing ${file.filename}:`, error);
        failedFiles++;
        results.push({
          filename: file.filename,
          originalPath: file.filePath,
          size: file.size,
          status: "failed",
          error: error.message
        });
      }
      
      // Save intermediate results after each file
      const logFile = './banner-slides-migration-log.json';
      fs.writeFileSync(logFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        inProgress: true,
        stats: {
          totalFiles,
          uploadedFiles,
          skippedFiles,
          failedFiles
        },
        results
      }, null, 2));
    }
  }
  
  // Print summary
  console.log("\n=== Migration Summary ===");
  console.log(`Total files processed: ${totalFiles}`);
  console.log(`Successfully uploaded: ${uploadedFiles}`);
  console.log(`Skipped (already exists or filtered): ${skippedFiles}`);
  console.log(`Failed: ${failedFiles}`);
  
  // Save final results to a log file
  const logFile = './banner-slides-migration-log.json';
  fs.writeFileSync(logFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    inProgress: false,
    stats: {
      totalFiles,
      uploadedFiles,
      skippedFiles,
      failedFiles
    },
    results
  }, null, 2));
  
  console.log(`\nDetailed results saved to ${logFile}`);
}

// Run the main function
copyBannerSlidesToObjectStorage().catch(error => {
  console.error("Migration failed:", error);
  process.exit(1);
});