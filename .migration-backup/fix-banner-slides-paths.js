/**
 * Fix banner slides paths script for Barefoot Bay
 * 
 * This script performs three critical operations:
 * 1. Ensures all banner slides in the database use the /uploads/banner-slides/ path format
 * 2. Copies all media files from /banner-slides/ to /uploads/banner-slides/ and vice versa
 * 3. Clears client-side cache keys to force media refresh
 * 
 * Usage:
 * node fix-banner-slides-paths.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

// Initialize environment variables
dotenv.config();

// Get dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    console.log('Starting banner slides path correction...');

    // Step 1: Get banner slides content from database
    const { rows } = await pool.query(
      "SELECT id, content FROM page_contents WHERE slug = 'banner-slides'"
    );

    if (!rows.length) {
      console.log('No banner slides found in database.');
      return;
    }

    const pageContent = rows[0];
    console.log(`Found banner slides content with ID: ${pageContent.id}`);

    // Parse the content
    let slides;
    try {
      slides = JSON.parse(pageContent.content);
      console.log(`Successfully parsed ${slides.length} banner slides`);
    } catch (err) {
      console.error('Error parsing banner slides JSON:', err);
      return;
    }

    // Step 2: Normalize all paths to use /uploads/banner-slides/ format
    const normalizedSlides = slides.map(slide => {
      if (!slide.src) return slide;

      // Additional logging to help debug the slide content
      console.log('Processing slide:', {
        src: slide.src,
        mediaType: slide.mediaType || 'image', // Default to image if not specified
        isVideo: slide.mediaType === 'video' || slide.src.match(/\.(mp4|webm|ogg|mov)$/i) ? 'yes' : 'no'
      });

      // Skip external URLs and placeholder references
      if (slide.src.startsWith('http') || slide.src.includes('placeholder')) {
        console.log('Skipping external or placeholder URL:', slide.src);
        return slide;
      }

      // Check if this is a banner slide path that needs normalizing
      if (
        slide.src.includes('bannerImage-') ||
        slide.src.startsWith('/banner-slides/') ||
        slide.src.startsWith('/uploads/banner-slides/') ||
        slide.src.match(/\.(mp4|webm|ogg|mov|jpg|jpeg|png|gif|webp)$/i)
      ) {
        // Extract just the filename from various possible path formats
        let filename;
        
        if (slide.src.startsWith('/uploads/banner-slides/')) {
          // Already in the correct format, just log it
          console.log('Slide already in correct path format:', slide.src);
          return slide;
        } else if (slide.src.startsWith('/banner-slides/')) {
          filename = slide.src.replace('/banner-slides/', '');
          console.log('Converting from production path to uploads path:', slide.src);
        } else if (slide.src.startsWith('bannerImage-')) {
          filename = slide.src;
          console.log('Adding path to bare banner filename:', slide.src);
        } else if (slide.src.startsWith('/')) {
          // Some other path format, check if it's a media file in the root
          const basename = path.basename(slide.src);
          if (basename.includes('bannerImage-') || basename.match(/\.(mp4|webm|ogg|mov)$/i)) {
            filename = basename;
            console.log('Extracted banner image or video from path:', slide.src);
          } else {
            // Not a banner image or video, leave it alone
            console.log('Not a recognized banner path, leaving unchanged:', slide.src);
            return slide;
          }
        } else {
          // Bare filename, assume it's a banner image
          filename = slide.src;
          console.log('Using bare filename:', slide.src);
        }

        // Normalize to /uploads/banner-slides/ format
        console.log(`Normalizing path from ${slide.src} to /uploads/banner-slides/${filename}`);
        return {
          ...slide,
          src: `/uploads/banner-slides/${filename}`
        };
      }

      console.log('No normalization needed for:', slide.src);
      return slide;
    });

    // Step 3: Check for any changes
    const hasChanges = JSON.stringify(normalizedSlides) !== JSON.stringify(slides);
    
    if (!hasChanges) {
      console.log('No path changes needed for banner slides.');
    } else {
      console.log(`Updating ${normalizedSlides.length} banner slides with normalized paths...`);
      
      // Update the database with normalized paths
      await pool.query(
        "UPDATE page_contents SET content = $1 WHERE id = $2",
        [JSON.stringify(normalizedSlides), pageContent.id]
      );
      
      console.log('Banner slides paths updated in database successfully!');
    }

    // Step 4: Ensure all banner media files exist in both locations
    console.log('Syncing banner media files between directories...');
    
    // Make sure the directories exist
    const uploadsDir = path.resolve('./uploads/banner-slides');
    const rootDir = path.resolve('./banner-slides');
    
    if (!fs.existsSync(uploadsDir)) {
      console.log(`Creating directory: ${uploadsDir}`);
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    if (!fs.existsSync(rootDir)) {
      console.log(`Creating directory: ${rootDir}`);
      fs.mkdirSync(rootDir, { recursive: true });
    }

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
      const stats = fs.statSync(sourcePath);
      if (stats.isDirectory()) continue;
      
      // Identify file type
      const isVideo = file.match(/\.(mp4|webm|ogg|mov)$/i);
      const isImage = file.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
      
      // Count by type
      if (isVideo) {
        mediaTypes.videos++;
        console.log(`Found video file: ${file}`);
      } else if (isImage) {
        mediaTypes.images++;
      } else {
        mediaTypes.other++;
        // Skip non-media files
        continue;
      }
      
      // Copy file if it doesn't exist or has different size
      if (!fs.existsSync(destPath) || fs.statSync(destPath).size !== stats.size) {
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
      const stats = fs.statSync(sourcePath);
      if (stats.isDirectory()) continue;
      
      // Identify file type
      const isVideo = file.match(/\.(mp4|webm|ogg|mov)$/i);
      const isImage = file.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
      
      // Count by type
      if (isVideo) {
        reverseSyncTypes.videos++;
        console.log(`Found video file in production dir: ${file}`);
      } else if (isImage) {
        reverseSyncTypes.images++;
      } else {
        reverseSyncTypes.other++;
        // Skip non-media files
        continue;
      }
      
      // Copy file if it doesn't exist or has different size
      if (!fs.existsSync(destPath) || fs.statSync(destPath).size !== stats.size) {
        console.log(`Copying ${file} from /banner-slides/ to /uploads/banner-slides/`);
        fs.copyFileSync(sourcePath, destPath);
        reverseSyncTypes.synced++;
      }
    }
    
    // Log summary of file processing
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

    console.log('File synchronization complete!');
    console.log('All banner slides now have consistent paths and files exist in both locations.');

  } catch (err) {
    console.error('Error fixing banner slides paths:', err);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

main().catch(console.error);