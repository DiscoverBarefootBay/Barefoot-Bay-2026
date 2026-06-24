/**
 * Fix Banner Media Synchronization
 * 
 * This script ensures all banner images and videos are properly synchronized
 * between the uploads/banner-slides and banner-slides directories.
 * It also verifies that all database references use the correct format.
 * 
 * Usage:
 * node fix-banner-media-sync.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

// Get directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Connect to the database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Log function with timestamps
const log = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

// Directories
const uploadsDir = path.join(__dirname, 'uploads', 'banner-slides');
const rootDir = path.join(__dirname, 'banner-slides');

// Ensure both directories exist
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Synchronize files from uploads to root directory
async function syncBannerFiles() {
  log('Starting banner media synchronization');
  
  ensureDirectoryExists(uploadsDir);
  ensureDirectoryExists(rootDir);
  
  // 1. Copy all files from uploads/banner-slides to banner-slides
  log('Copying files from uploads/banner-slides to banner-slides');
  
  const uploadedFiles = fs.readdirSync(uploadsDir);
  let copiedCount = 0;
  
  for (const file of uploadedFiles) {
    const sourcePath = path.join(uploadsDir, file);
    const destPath = path.join(rootDir, file);
    
    // Skip if file already exists in destination
    if (fs.existsSync(destPath)) {
      log(`File already exists in destination: ${file}`);
      continue;
    }
    
    // Copy the file
    try {
      fs.copyFileSync(sourcePath, destPath);
      log(`Copied: ${file}`);
      copiedCount++;
    } catch (error) {
      log(`Error copying ${file}: ${error.message}`);
    }
  }
  
  log(`Copied ${copiedCount} new files to banner-slides directory`);
  
  // 2. Fix database references
  log('Checking database references');
  
  try {
    // Get the banner slides content
    const query = `
      SELECT id, content 
      FROM page_contents 
      WHERE slug = 'banner-slides'
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      log('No banner-slides content found in database');
      return;
    }
    
    const pageContent = result.rows[0];
    const contentId = pageContent.id;
    let content = pageContent.content;
    
    // Check if content needs fixing
    if (typeof content === 'string' && content.includes('/uploads/banner-slides/')) {
      log('Found /uploads/ paths in content, fixing...');
      
      // Replace /uploads/banner-slides/ with /banner-slides/
      const updatedContent = content.replace(/\/uploads\/banner-slides\//g, '/banner-slides/');
      
      // Update the database
      const updateQuery = `
        UPDATE page_contents
        SET content = $1, updated_at = NOW()
        WHERE id = $2
      `;
      
      await pool.query(updateQuery, [updatedContent, contentId]);
      log(`Updated banner slides content with fixed paths`);
    } else {
      log('No path issues found in banner slides content');
    }
    
    // Validate all referenced files exist
    try {
      const slides = JSON.parse(content);
      const missingFiles = [];
      
      for (const slide of slides) {
        if (slide.src) {
          // Extract the filename
          const filename = slide.src.split('/').pop();
          const rootPath = path.join(rootDir, filename);
          
          if (!fs.existsSync(rootPath)) {
            missingFiles.push(slide.src);
            log(`Warning: Referenced file not found: ${slide.src}`);
          }
        }
      }
      
      if (missingFiles.length > 0) {
        log(`Warning: ${missingFiles.length} referenced files are missing`);
      } else {
        log('All referenced files exist in the filesystem');
      }
    } catch (parseError) {
      log(`Error parsing content: ${parseError.message}`);
    }
  } catch (error) {
    log(`Database error: ${error.message}`);
  }
}

// Main function
async function main() {
  try {
    log('Banner media sync script starting');
    await syncBannerFiles();
    log('Banner media sync completed successfully');
  } catch (error) {
    log(`Error: ${error.message}`);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the script
main();