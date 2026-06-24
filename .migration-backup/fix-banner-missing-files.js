/**
 * Fixes missing banner files by replacing them with placeholders
 * 
 * This script:
 * 1. Checks for banner image/video files referenced in the database but missing
 * 2. Replaces missing files with appropriate placeholders
 * 3. Updates the database content to reflect these changes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

// Initialize environment
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { Pool } = pg;

async function main() {
  console.log('=== STARTING MISSING FILES FIX ===');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
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
    
    // Step 2: Ensure directories exist
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
    
    // Make sure we have a placeholder image
    const placeholderPath = path.join(uploadsDir, 'placeholder-banner.png');
    const rootPlaceholderPath = path.join(rootDir, 'placeholder-banner.png');
    
    // Check if we need to create the placeholder image
    let hasPlaceholder = fs.existsSync(placeholderPath);
    if (!hasPlaceholder) {
      // Try to copy from existing banner image
      const filesInUploads = fs.readdirSync(uploadsDir);
      const imageFiles = filesInUploads.filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
      
      if (imageFiles.length > 0) {
        // Use the first image as placeholder
        fs.copyFileSync(
          path.join(uploadsDir, imageFiles[0]), 
          placeholderPath
        );
        console.log(`Created placeholder from existing image: ${imageFiles[0]}`);
        hasPlaceholder = true;
      }
    }
    
    // Ensure the placeholder is in both directories
    if (hasPlaceholder && !fs.existsSync(rootPlaceholderPath)) {
      fs.copyFileSync(placeholderPath, rootPlaceholderPath);
      console.log('Copied placeholder to root directory');
    }
    
    // Step 3: Get existing files in both directories
    const uploadsFiles = fs.readdirSync(uploadsDir);
    const rootFiles = fs.readdirSync(rootDir);
    console.log(`Found ${uploadsFiles.length} files in uploads dir and ${rootFiles.length} files in root dir`);
    
    // Create sets for faster lookups
    const uploadsFileSet = new Set(uploadsFiles);
    const rootFileSet = new Set(rootFiles);
    
    // Track files we want to check for (including from console errors)
    const filesToCheck = [
      'bannerImage-1745531793603-403842876.jpg',
      'bannerImage-1745531865301-646077718.mp4',
      'bannerImage-1745531939736-842695380.jpg'
    ];
    
    // Step 4: Process each slide and check if its file exists
    const normalizedSlides = slides.map(slide => {
      if (!slide.src || slide.src.includes('placeholder')) {
        return slide; // Skip placeholders
      }
      
      // Check file existence first - get just the filename regardless of path
      let filename;
      
      if (slide.src.startsWith('/uploads/banner-slides/')) {
        filename = slide.src.replace('/uploads/banner-slides/', '');
      } else if (slide.src.startsWith('/banner-slides/')) {
        filename = slide.src.replace('/banner-slides/', '');
      } else if (slide.src.startsWith('/')) {
        filename = path.basename(slide.src);
      } else {
        filename = slide.src;
      }
      
      // Add this filename to our check list
      if (!filesToCheck.includes(filename)) {
        filesToCheck.push(filename);
      }
      
      // Check if this file exists in either directory
      const existsInUploads = uploadsFileSet.has(filename);
      const existsInRoot = rootFileSet.has(filename);
      
      if (!existsInUploads && !existsInRoot) {
        // File doesn't exist, replace with placeholder
        console.log(`⚠️ WARNING: File ${filename} not found in either directory. Using placeholder.`);
        console.log(`  Path in slide: ${slide.src}`);
        return {
          ...slide,
          src: '/uploads/banner-slides/placeholder-banner.png',
          mediaType: 'image'
        };
      }
      
      // Ensure file exists in both locations
      if (existsInUploads && !existsInRoot) {
        console.log(`Copying ${filename} from uploads to root`);
        fs.copyFileSync(path.join(uploadsDir, filename), path.join(rootDir, filename));
      } else if (!existsInUploads && existsInRoot) {
        console.log(`Copying ${filename} from root to uploads`);
        fs.copyFileSync(path.join(rootDir, filename), path.join(uploadsDir, filename));
      }
      
      // Normalize the path in the database to use /uploads/banner-slides/
      console.log(`Normalizing path for ${filename}`);
      
      // Check if this is a video based on extension
      const isVideo = filename.match(/\.(mp4|webm|ogg|mov)$/i);
      
      // If it's a video but not marked as such, mark it
      if (isVideo && slide.mediaType !== 'video') {
        console.log(`Setting mediaType=video for ${filename}`);
        return {
          ...slide,
          src: `/uploads/banner-slides/${filename}`,
          mediaType: 'video',
          autoplay: true
        };
      }
      
      // Otherwise just normalize the path
      return {
        ...slide,
        src: `/uploads/banner-slides/${filename}`
      };
    });
    
    // Step 5: Check listed files explicitly
    for (const filename of filesToCheck) {
      // Skip placeholders
      if (filename.includes('placeholder-banner')) continue;
      
      const uploadPath = path.join(uploadsDir, filename);
      const rootPath = path.join(rootDir, filename);
      
      const existsInUploads = fs.existsSync(uploadPath);
      const existsInRoot = fs.existsSync(rootPath);
      
      if (!existsInUploads && !existsInRoot) {
        console.log(`⚠️ Listed file ${filename} not found in either directory. Will be replaced with placeholder.`);
        continue;
      }
      
      // Sync files between directories
      if (existsInUploads && !existsInRoot) {
        console.log(`Copying ${filename} from uploads to root`);
        fs.copyFileSync(uploadPath, rootPath);
      } else if (!existsInUploads && existsInRoot) {
        console.log(`Copying ${filename} from root to uploads`);
        fs.copyFileSync(rootPath, uploadPath);
      }
    }
    
    // Step 6: Update the database
    console.log(`Updating ${normalizedSlides.length} banner slides in database...`);
    await pool.query(
      "UPDATE page_contents SET content = $1 WHERE id = $2",
      [JSON.stringify(normalizedSlides), pageContent.id]
    );
    
    console.log('Banner slides updated in database!');
    console.log('=== MISSING FILES FIX COMPLETED ===');
    
  } catch (err) {
    console.error('Error in missing files fix:', err);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);