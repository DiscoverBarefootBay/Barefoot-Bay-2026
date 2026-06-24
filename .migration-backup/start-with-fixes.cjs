/**
 * Startup script with fixes for banner slides
 * This script runs before starting the main application, fixing any path issues in the database
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Create placeholder image if needed
async function ensurePlaceholderExists() {
  console.log('Checking for placeholder banner image...');
  const uploadsDir = path.join(process.cwd(), 'uploads/banner-slides');
  const rootDir = path.join(process.cwd(), 'banner-slides');

  // Ensure directories exist
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`Created uploads directory: ${uploadsDir}`);
  }

  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
    console.log(`Created root directory: ${rootDir}`);
  }

  const placeholderPathUploads = path.join(uploadsDir, 'placeholder-banner.png');
  const placeholderPathRoot = path.join(rootDir, 'placeholder-banner.png');
  
  // Check if placeholder images already exist
  let needToCreatePlaceholder = false;
  if (!fs.existsSync(placeholderPathUploads)) {
    console.log('Placeholder missing in uploads directory');
    needToCreatePlaceholder = true;
  }
  
  if (!fs.existsSync(placeholderPathRoot)) {
    console.log('Placeholder missing in root directory');
    needToCreatePlaceholder = true;
  }
  
  if (needToCreatePlaceholder) {
    console.log('Creating placeholder banner images...');
    
    // Simple 1-pixel transparent PNG for placeholder
    const placeholderBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    
    // Decode the base64 string to a buffer
    const buffer = Buffer.from(placeholderBase64, 'base64');
    
    // Write the placeholder files
    fs.writeFileSync(placeholderPathUploads, buffer);
    console.log(`Created placeholder at ${placeholderPathUploads}`);
    
    fs.writeFileSync(placeholderPathRoot, buffer);
    console.log(`Created placeholder at ${placeholderPathRoot}`);
  } else {
    console.log('Placeholder banner images already exist');
  }
}

// Fix database paths for banner slides
async function fixDatabasePaths() {
  console.log('Checking and fixing database paths for banner slides...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    // Get current content
    const { rows } = await pool.query('SELECT id, slug, content FROM page_contents WHERE slug = $1', ['banner-slides']);
    
    if (rows.length === 0) {
      console.log('No banner slides content found in database');
      return;
    }
    
    const bannerContent = rows[0];
    console.log(`Found banner slides content with ID: ${bannerContent.id}`);
    
    // Parse content
    let slides = [];
    try {
      slides = JSON.parse(bannerContent.content);
      console.log(`Successfully parsed ${slides.length} banner slides`);
    } catch (e) {
      console.error('Error parsing banner slides JSON:', e);
      return;
    }
    
    // Check each banner slide src and normalize to /uploads/banner-slides/ format
    let modified = false;
    const normalizedSlides = slides.map(slide => {
      // Skip if no src
      if (!slide.src) return slide;
      
      if (!slide.src.startsWith('/uploads/banner-slides/')) {
        console.log(`Normalizing path for ${slide.src}`);
        modified = true;
        
        let fileName;
        if (slide.src.startsWith('/banner-slides/')) {
          // Convert from root to uploads format
          fileName = slide.src.replace('/banner-slides/', '');
        } else if (slide.src.includes('/banner-slides/')) {
          // Extract the filename from any path that includes /banner-slides/
          const match = slide.src.match(/\/banner-slides\/([^?#]+)/);
          if (match && match[1]) {
            fileName = match[1];
          } else {
            // Can't determine the filename, use placeholder
            console.log(`Can't determine filename from ${slide.src}, using placeholder`);
            return { ...slide, src: '/uploads/banner-slides/placeholder-banner.png' };
          }
        } else {
          // Can't normalize, use placeholder
          console.log(`Can't normalize ${slide.src}, using placeholder`);
          return { ...slide, src: '/uploads/banner-slides/placeholder-banner.png' };
        }
        
        // Check if the file exists in either location
        const uploadsPath = path.join(process.cwd(), 'uploads/banner-slides', fileName);
        const rootPath = path.join(process.cwd(), 'banner-slides', fileName);
        
        if (!fs.existsSync(uploadsPath) && !fs.existsSync(rootPath)) {
          console.log(`⚠️ File ${fileName} not found in either directory. Will be replaced with placeholder.`);
          return { ...slide, src: '/uploads/banner-slides/placeholder-banner.png' };
        }
        
        // Return normalized path
        return { ...slide, src: `/uploads/banner-slides/${fileName}` };
      }
      
      return slide;
    });
    
    if (modified) {
      console.log('Updating banner slides in database with normalized paths...');
      
      // Update database
      await pool.query(
        'UPDATE page_contents SET content = $1 WHERE id = $2',
        [JSON.stringify(normalizedSlides), bannerContent.id]
      );
      
      console.log('Banner slides updated in database with normalized paths');
    } else {
      console.log('All banner slide paths are already normalized, no update needed');
    }
  } catch (error) {
    console.error('Error fixing database paths:', error);
  } finally {
    await pool.end();
  }
}

// Main function to run all fixes, then start the app
async function main() {
  console.log('=== RUNNING PRE-START FIXES ===');
  
  try {
    // Ensure placeholder exists
    await ensurePlaceholderExists();
    
    // Fix database paths
    await fixDatabasePaths();
    
    console.log('=== PRE-START FIXES COMPLETED ===');
    
    // Start the actual application
    console.log('=== STARTING MAIN APPLICATION ===');
    require('child_process').spawn(
      'node',
      ['dist/index.js'],
      {
        env: {
          ...process.env,
          PORT: '5000',
          NODE_ENV: 'production'
        },
        stdio: 'inherit'
      }
    );
  } catch (error) {
    console.error('Error during pre-start fixes:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(err => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});