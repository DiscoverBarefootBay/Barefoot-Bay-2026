/**
 * Fix Banner Slide URLs script
 * 
 * This script finds and fixes any banner slide URLs in the database
 * that are using the wrong format. It converts URLs from:
 * /uploads/banner-slides/filename.ext to /banner-slides/filename.ext
 * 
 * Usage:
 * node scripts/fix-banner-slide-urls.js
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixBannerSlideUrls() {
  const client = await pool.connect();
  console.log('Connected to database');
  
  try {
    // Get the banner slides content
    const result = await client.query(
      'SELECT id, content FROM pages WHERE slug = $1',
      ['banner-slides']
    );
    
    if (result.rows.length === 0) {
      console.log('No banner slides found in the database');
      return;
    }
    
    const page = result.rows[0];
    console.log(`Found banner slides with ID ${page.id}`);
    
    // Parse the content
    let content;
    try {
      content = JSON.parse(page.content);
      if (!Array.isArray(content)) {
        throw new Error('Content is not an array');
      }
    } catch (err) {
      console.error('Failed to parse banner slides content:', err);
      return;
    }
    
    console.log(`Found ${content.length} banner slides`);
    
    // Process each slide
    let didChange = false;
    const fixedContent = content.map(slide => {
      const originalSrc = slide.src;
      
      // Fix the URL if needed
      if (originalSrc && typeof originalSrc === 'string' && originalSrc.startsWith('/uploads/banner-slides/')) {
        // Extract the filename
        const filename = originalSrc.split('/').pop();
        if (!filename) {
          return slide;
        }
        
        // Create the fixed URL
        const fixedSrc = `/banner-slides/${filename}`;
        
        // Check if the file exists in the production directory
        const prodFilePath = path.join(__dirname, '..', 'banner-slides', filename);
        
        // If the production file doesn't exist, try to copy it
        if (!fs.existsSync(prodFilePath)) {
          const uploadsFilePath = path.join(__dirname, '..', 'uploads', 'banner-slides', filename);
          if (fs.existsSync(uploadsFilePath)) {
            try {
              // Make sure the destination directory exists
              if (!fs.existsSync(path.dirname(prodFilePath))) {
                fs.mkdirSync(path.dirname(prodFilePath), { recursive: true });
              }
              // Copy the file
              fs.copyFileSync(uploadsFilePath, prodFilePath);
              console.log(`Copied file from ${uploadsFilePath} to ${prodFilePath}`);
            } catch (copyErr) {
              console.error(`Failed to copy file ${filename}:`, copyErr);
            }
          } else {
            console.log(`Warning: Original file does not exist at ${uploadsFilePath}`);
          }
        }
        
        // Return the updated slide
        didChange = true;
        console.log(`Updated slide URL: ${originalSrc} -> ${fixedSrc}`);
        return { ...slide, src: fixedSrc };
      }
      
      return slide;
    });
    
    if (!didChange) {
      console.log('No changes needed, all URLs are already in the correct format');
      return;
    }
    
    // Save the updated content back to the database
    const stringifiedContent = JSON.stringify(fixedContent);
    await client.query(
      'UPDATE pages SET content = $1 WHERE id = $2',
      [stringifiedContent, page.id]
    );
    
    console.log(`Updated ${fixedContent.length} banner slides in the database`);
    
  } catch (err) {
    console.error('Error fixing banner slide URLs:', err);
  } finally {
    client.release();
  }
}

// Run the function
fixBannerSlideUrls()
  .then(() => {
    console.log('Banner slide URL fixing completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Uncaught error:', err);
    process.exit(1);
  });