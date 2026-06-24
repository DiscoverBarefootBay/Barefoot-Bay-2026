/**
 * Direct Banner Slides Check
 * 
 * This script directly checks the banner slides directory and reports on the files
 * No authentication required as it works directly with the filesystem
 * 
 * Usage:
 * node scripts/direct-banner-check.js
 */

import fs from 'fs/promises';
import path from 'path';

// Configuration
const BANNER_SLIDES_DIR = 'banner-slides';
const UPLOADS_BANNER_SLIDES_DIR = path.join('uploads', 'banner-slides');
const OBJECT_STORAGE_PATTERN = /object-storage\.replit\.app/;

async function main() {
  try {
    console.log('Direct Banner Slides Check');
    console.log('-------------------------');
    
    // Check local banner-slides directory
    console.log(`\nChecking local banner-slides directory...`);
    let localFiles = [];
    try {
      localFiles = await fs.readdir(BANNER_SLIDES_DIR);
      console.log(`Found ${localFiles.length} files in ${BANNER_SLIDES_DIR}`);
      
      // Get file info
      const fileStats = await Promise.all(
        localFiles.map(async (file) => {
          try {
            const stats = await fs.stat(path.join(BANNER_SLIDES_DIR, file));
            return {
              filename: file,
              size: stats.size,
              created: stats.ctime,
              isDirectory: stats.isDirectory()
            };
          } catch (err) {
            return {
              filename: file,
              error: err.message
            };
          }
        })
      );
      
      // Display file info
      console.log('\nFile details:');
      fileStats.forEach((file, i) => {
        if (file.error) {
          console.log(`${i+1}. ${file.filename} - Error: ${file.error}`);
        } else {
          console.log(`${i+1}. ${file.filename} - ${(file.size / 1024).toFixed(2)} KB - Created: ${file.created.toISOString()}`);
        }
      });
      
      // Display media types
      const imageFiles = fileStats.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f.filename));
      const videoFiles = fileStats.filter(f => /\.(mp4|webm|mov|m4v)$/i.test(f.filename));
      const otherFiles = fileStats.filter(f => !(/\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|m4v)$/i.test(f.filename)));
      
      console.log(`\nMedia types in ${BANNER_SLIDES_DIR}:`);
      console.log(`- Images: ${imageFiles.length}`);
      console.log(`- Videos: ${videoFiles.length}`);
      console.log(`- Other: ${otherFiles.length}`);
    } catch (err) {
      console.log(`Failed to read ${BANNER_SLIDES_DIR}: ${err.message}`);
    }
    
    // Check uploads/banner-slides directory
    console.log(`\nChecking uploads/banner-slides directory...`);
    let uploadsFiles = [];
    try {
      uploadsFiles = await fs.readdir(UPLOADS_BANNER_SLIDES_DIR);
      console.log(`Found ${uploadsFiles.length} files in ${UPLOADS_BANNER_SLIDES_DIR}`);
      
      // Get file info
      const fileStats = await Promise.all(
        uploadsFiles.map(async (file) => {
          try {
            const stats = await fs.stat(path.join(UPLOADS_BANNER_SLIDES_DIR, file));
            return {
              filename: file,
              size: stats.size,
              created: stats.ctime,
              isDirectory: stats.isDirectory()
            };
          } catch (err) {
            return {
              filename: file,
              error: err.message
            };
          }
        })
      );
      
      // Check for duplicates between the two directories
      const duplicateFiles = localFiles.filter(file => uploadsFiles.includes(file));
      console.log(`\nDuplicate files in both directories: ${duplicateFiles.length}`);
      if (duplicateFiles.length > 0) {
        duplicateFiles.forEach((file, i) => {
          console.log(`${i+1}. ${file}`);
        });
      }
      
      // Display media types
      const imageFiles = fileStats.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f.filename));
      const videoFiles = fileStats.filter(f => /\.(mp4|webm|mov|m4v)$/i.test(f.filename));
      const otherFiles = fileStats.filter(f => !(/\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|m4v)$/i.test(f.filename)));
      
      console.log(`\nMedia types in ${UPLOADS_BANNER_SLIDES_DIR}:`);
      console.log(`- Images: ${imageFiles.length}`);
      console.log(`- Videos: ${videoFiles.length}`);
      console.log(`- Other: ${otherFiles.length}`);
    } catch (err) {
      console.log(`Failed to read ${UPLOADS_BANNER_SLIDES_DIR}: ${err.message}`);
    }
    
    // Check database content
    console.log('\nAttempting to read banner-slides database content (if available)...');
    try {
      const contentPath = 'banner-slides-content.json';
      try {
        // Check if we have a saved content file
        await fs.access(contentPath);
        const contentRaw = await fs.readFile(contentPath, 'utf8');
        const content = JSON.parse(contentRaw);
        
        if (content && Array.isArray(content)) {
          console.log(`Found ${content.length} banner slides in saved content file`);
          
          // Count object storage URLs
          const objectStorageUrls = content.filter(slide => {
            return (slide.imageUrl && OBJECT_STORAGE_PATTERN.test(slide.imageUrl)) ||
                   (slide.videoUrl && OBJECT_STORAGE_PATTERN.test(slide.videoUrl));
          });
          
          console.log(`Banner slides using Object Storage: ${objectStorageUrls.length}`);
        } else {
          console.log('Invalid content format in saved file');
        }
      } catch (err) {
        console.log(`No saved banner slides content file found: ${err.message}`);
      }
    } catch (err) {
      console.log(`Error checking banner slides content: ${err.message}`);
    }
    
    console.log('\nCheck completed');
  } catch (error) {
    console.error(`Error in direct banner check: ${error.message}`);
  }
}

// Run the main function
main().catch(console.error);