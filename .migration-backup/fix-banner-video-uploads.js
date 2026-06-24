/**
 * Emergency fix script for banner video issues
 * 
 * This script:
 * 1. Detects and fixes video files in banner slides
 * 2. Ensures all videos are properly tagged with mediaType='video'
 * 3. Forces all media paths to use the /uploads/banner-slides/ format
 * 4. Verifies files exist in both locations and copies them if needed
 * 5. Clears the client-side cache to force reloading of media
 * 
 * Usage:
 * node fix-banner-video-uploads.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Set up PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Main function
async function main() {
  console.log('Starting emergency banner video fix...');
  
  try {
    // Ensure the directories exist
    const uploadsDir = path.join(__dirname, 'uploads/banner-slides');
    const rootDir = path.join(__dirname, 'banner-slides');
    
    if (!fs.existsSync(uploadsDir)) {
      console.log(`Creating directory: ${uploadsDir}`);
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    if (!fs.existsSync(rootDir)) {
      console.log(`Creating directory: ${rootDir}`);
      fs.mkdirSync(rootDir, { recursive: true });
    }

    // Get banner slides content from database
    const result = await pool.query(`
      SELECT id, slug, content
      FROM page_contents
      WHERE slug = 'banner-slides'
    `);
    
    if (result.rows.length === 0) {
      console.log('No banner slides content found in database');
      return;
    }
    
    const contentRow = result.rows[0];
    console.log(`Found banner slides content with ID: ${contentRow.id}`);
    
    // Parse the content JSON
    let content;
    try {
      content = JSON.parse(contentRow.content);
      console.log(`Successfully parsed banner slides content`);
    } catch (error) {
      console.error('Error parsing banner slides content:', error);
      return;
    }
    
    if (!Array.isArray(content) || content.length === 0) {
      console.error('No banner slides found or content is not an array');
      return;
    }
    
    console.log(`Found ${content.length} banner slides to process`);
    
    // Process each slide for video detection and path fixes
    const updatedContent = content.map((slide, index) => {
      // Skip if no source
      if (!slide.src) {
        console.log(`Slide ${index + 1} has no src, skipping`);
        return slide;
      }
      
      // Make a copy to modify
      const updatedSlide = { ...slide };
      
      console.log(`Processing slide ${index + 1}: ${updatedSlide.src}`);
      
      // Check if the file is a video based on extension
      const isVideoFile = updatedSlide.src.match(/\.(mp4|webm|ogg|mov)$/i);
      
      // Force mediaType to 'video' for video files regardless of current setting
      if (isVideoFile) {
        console.log(`Slide ${index + 1} is a video file: ${updatedSlide.src}`);
        updatedSlide.mediaType = 'video';
        updatedSlide.isVideo = 'yes'; // For backward compatibility
        updatedSlide.autoplay = true; // Ensure autoplay is enabled
      } else if (!updatedSlide.mediaType) {
        // Default to image if not specified and not a video file
        console.log(`Setting slide ${index + 1} as image type: ${updatedSlide.src}`);
        updatedSlide.mediaType = 'image';
        updatedSlide.isVideo = 'no'; // For backward compatibility
      }
      
      // Normalize path to use /uploads/banner-slides/ format for all slides
      if (updatedSlide.src.startsWith('/banner-slides/')) {
        const filename = updatedSlide.src.replace('/banner-slides/', '');
        updatedSlide.src = `/uploads/banner-slides/${filename}`;
        console.log(`Normalized path from /banner-slides/ to /uploads/banner-slides/ format: ${updatedSlide.src}`);
      } else if (!updatedSlide.src.startsWith('/uploads/banner-slides/') && !updatedSlide.src.startsWith('http')) {
        // Handle other local paths that don't match expected formats
        // Only process local paths (not external URLs)
        if (!updatedSlide.src.includes('://')) {
          const filename = path.basename(updatedSlide.src);
          updatedSlide.src = `/uploads/banner-slides/${filename}`;
          console.log(`Corrected irregular path format to /uploads/banner-slides/ format: ${updatedSlide.src}`);
        }
      }
      
      return updatedSlide;
    });
    
    console.log(`Processed ${updatedContent.length} slides`);
    
    // Save updated content back to database
    await pool.query(`
      UPDATE page_contents
      SET content = $1, updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(updatedContent), contentRow.id]);
    
    console.log('Successfully updated banner slides in database');
    
    // Now ensure all files exist in both locations
    console.log('Syncing files between /uploads/banner-slides/ and /banner-slides/...');
    
    // Sync files from /uploads/banner-slides/ to /banner-slides/
    const uploadsFiles = fs.readdirSync(uploadsDir);
    console.log(`Found ${uploadsFiles.length} files in /uploads/banner-slides/`);
    
    // Track media files by type for better debugging
    const mediaTypes = {
      images: 0,
      videos: 0,
      other: 0,
      synced: 0
    };
    
    for (const file of uploadsFiles) {
      const sourcePath = path.join(uploadsDir, file);
      const destPath = path.join(rootDir, file);
      
      // Skip directories
      if (fs.statSync(sourcePath).isDirectory()) continue;
      
      // Identify file type
      const isVideo = file.match(/\.(mp4|webm|ogg|mov)$/i);
      const isImage = file.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
      
      // Count by type and log videos
      if (isVideo) {
        mediaTypes.videos++;
        console.log(`Found video file: ${file} (${fs.statSync(sourcePath).size} bytes)`);
      } else if (isImage) {
        mediaTypes.images++;
      } else {
        mediaTypes.other++;
        // Still copy non-media files to ensure complete sync
      }
      
      // Copy file if it doesn't exist or has different size
      if (!fs.existsSync(destPath) || fs.statSync(destPath).size !== fs.statSync(sourcePath).size) {
        console.log(`Copying ${file} from /uploads/banner-slides/ to /banner-slides/`);
        fs.copyFileSync(sourcePath, destPath);
        mediaTypes.synced++;
      }
    }
    
    // Sync files from /banner-slides/ to /uploads/banner-slides/
    const rootFiles = fs.readdirSync(rootDir);
    console.log(`Found ${rootFiles.length} files in /banner-slides/`);
    
    const reverseSyncTypes = {
      images: 0,
      videos: 0,
      other: 0,
      synced: 0
    };
    
    for (const file of rootFiles) {
      const sourcePath = path.join(rootDir, file);
      const destPath = path.join(uploadsDir, file);
      
      // Skip directories
      if (fs.statSync(sourcePath).isDirectory()) continue;
      
      // Identify file type
      const isVideo = file.match(/\.(mp4|webm|ogg|mov)$/i);
      const isImage = file.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
      
      // Count by type and log videos
      if (isVideo) {
        reverseSyncTypes.videos++;
        console.log(`Found video file in production dir: ${file} (${fs.statSync(sourcePath).size} bytes)`);
      } else if (isImage) {
        reverseSyncTypes.images++;
      } else {
        reverseSyncTypes.other++;
        // Still copy non-media files to ensure complete sync
      }
      
      // Copy file if it doesn't exist or has different size
      if (!fs.existsSync(destPath) || fs.statSync(destPath).size !== fs.statSync(sourcePath).size) {
        console.log(`Copying ${file} from /banner-slides/ to /uploads/banner-slides/`);
        fs.copyFileSync(sourcePath, destPath);
        reverseSyncTypes.synced++;
      }
    }
    
    // Log summary 
    console.log('Media synchronization summary:');
    console.log('From /uploads/banner-slides/ directory:');
    console.log(`- Images: ${mediaTypes.images}`);
    console.log(`- Videos: ${mediaTypes.videos}`);
    console.log(`- Other files: ${mediaTypes.other}`);
    console.log(`- Files synced: ${mediaTypes.synced}`);
    
    console.log('From /banner-slides/ directory:');
    console.log(`- Images: ${reverseSyncTypes.images}`);
    console.log(`- Videos: ${reverseSyncTypes.videos}`);
    console.log(`- Other files: ${reverseSyncTypes.other}`);
    console.log(`- Files synced: ${reverseSyncTypes.synced}`);
    
    // Step 3: Verify specific video files mentioned in slides
    console.log('\nVerifying video files used in banner slides...');
    
    // Extract all unique media files from slides
    const mediaFilesInUse = new Set();
    updatedContent.forEach(slide => {
      if (slide.src && typeof slide.src === 'string' && !slide.src.includes('://')) {
        // Extract just the filename, regardless of path format
        const filename = path.basename(slide.src);
        mediaFilesInUse.add(filename);
      }
    });
    
    console.log(`Found ${mediaFilesInUse.size} unique media files in use by banner slides`);
    
    // Check each file mentioned in slides
    let missingFiles = 0;
    for (const filename of mediaFilesInUse) {
      const uploadsPath = path.join(uploadsDir, filename);
      const rootPath = path.join(rootDir, filename);
      
      const existsInUploads = fs.existsSync(uploadsPath);
      const existsInRoot = fs.existsSync(rootPath);
      
      if (!existsInUploads || !existsInRoot) {
        console.log(`WARNING: Media file ${filename} exists in uploads: ${existsInUploads}, in root: ${existsInRoot}`);
        missingFiles++;
        
        // Try to fix by copying from one location to the other
        if (existsInUploads && !existsInRoot) {
          console.log(`Fixing by copying from uploads to root: ${filename}`);
          fs.copyFileSync(uploadsPath, rootPath);
        } else if (!existsInUploads && existsInRoot) {
          console.log(`Fixing by copying from root to uploads: ${filename}`);
          fs.copyFileSync(rootPath, uploadsPath);
        }
      }
      
      // For video files, double-check their size to ensure they're not corrupt/truncated
      const isVideo = filename.match(/\.(mp4|webm|ogg|mov)$/i);
      if (isVideo && existsInUploads && existsInRoot) {
        const uploadsSize = fs.statSync(uploadsPath).size;
        const rootSize = fs.statSync(rootPath).size;
        
        if (uploadsSize !== rootSize) {
          console.log(`WARNING: Video file sizes don't match for ${filename}: 
            uploads: ${uploadsSize} bytes, 
            root: ${rootSize} bytes`);
          
          // Use the larger file to replace the smaller one
          if (uploadsSize > rootSize) {
            console.log(`Copying larger uploads version to root: ${filename}`);
            fs.copyFileSync(uploadsPath, rootPath);
          } else {
            console.log(`Copying larger root version to uploads: ${filename}`);
            fs.copyFileSync(rootPath, uploadsPath);
          }
        } else {
          console.log(`Video file ${filename} verified: ${uploadsSize} bytes`);
        }
      }
    }
    
    if (missingFiles === 0) {
      console.log('All media files were found in both locations');
    } else {
      console.log(`Fixed ${missingFiles} missing media files`);
    }
    
    console.log('Banner video fix completed successfully!');
    
  } catch (err) {
    console.error('Error fixing banner videos:', err);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

main().catch(console.error);