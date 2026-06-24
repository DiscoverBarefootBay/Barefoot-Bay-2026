/**
 * EMERGENCY FIX: Banner Slides Path Correction 
 * 
 * This script:
 * 1. Normalizes all paths in the database to use /uploads/banner-slides/
 * 2. Removes references to missing files
 * 3. Ensures both directories have identical content
 */

// NOTE: Node.js with ESM support
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
  console.log('=== STARTING EMERGENCY BANNER SLIDE FIX ===');
  
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
    
    // Step 3: Get existing files in both directories
    const uploadsFiles = fs.readdirSync(uploadsDir);
    const rootFiles = fs.readdirSync(rootDir);
    console.log(`Found ${uploadsFiles.length} files in uploads dir and ${rootFiles.length} files in root dir`);
    
    // Create sets for faster lookups
    const uploadsFileSet = new Set(uploadsFiles);
    const rootFileSet = new Set(rootFiles);
    
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
    
    // Step 5: Update the database
    console.log(`Updating ${normalizedSlides.length} banner slides in database...`);
    await pool.query(
      "UPDATE page_contents SET content = $1 WHERE id = $2",
      [JSON.stringify(normalizedSlides), pageContent.id]
    );
    
    console.log('Banner slides updated in database!');
    console.log('=== EMERGENCY FIX COMPLETED ===');
    
  } catch (err) {
    console.error('Error in emergency fix:', err);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);