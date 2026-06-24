/**
 * Fix Banner Slides for Production
 * 
 * This script normalizes the banner slide URLs in the database to ensure they 
 * work in the production environment by removing the /uploads/ prefix.
 * 
 * Run this script before deploying to production:
 * node fix-banner-slides-for-production.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixBannerSlidesForProduction() {
  const client = await pool.connect();
  
  try {
    console.log('Fetching banner slides from database...');
    
    // First, find banner slides content in the database
    const result = await client.query(
      'SELECT id, content FROM pages WHERE slug = $1',
      ['banner-slides']
    );
    
    if (result.rows.length === 0) {
      console.log('No banner slides found in the database.');
      return;
    }
    
    const page = result.rows[0];
    const id = page.id;
    
    console.log(`Found banner slides with ID: ${id}`);
    
    let slideContent;
    try {
      slideContent = JSON.parse(page.content);
      
      if (!Array.isArray(slideContent)) {
        console.error('Banner slides content is not an array:', slideContent);
        return;
      }
      
      console.log(`Found ${slideContent.length} banner slides.`);
    } catch (error) {
      console.error('Error parsing banner slides content:', error);
      return;
    }
    
    // Track changes
    let changesMade = false;
    
    // Fix slide paths to use production format without /uploads/ prefix
    const fixedSlides = slideContent.map(slide => {
      // Make a copy of the slide
      const fixedSlide = { ...slide };
      
      // Check if the src property exists and needs fixing
      if (fixedSlide.src && typeof fixedSlide.src === 'string') {
        if (fixedSlide.src.startsWith('/uploads/banner-slides/')) {
          // Extract the file name
          const fileName = fixedSlide.src.replace('/uploads/banner-slides/', '');
          
          // Replace with production format
          fixedSlide.src = `/banner-slides/${fileName}`;
          
          // Note the change
          console.log(`Fixed slide path: ${slide.src} → ${fixedSlide.src}`);
          changesMade = true;
        }
      }
      
      return fixedSlide;
    });
    
    if (!changesMade) {
      console.log('No changes needed to banner slides. They are already in production format.');
      return;
    }
    
    // Update the banner slides with fixed content
    console.log('Updating banner slides with fixed content...');
    
    await client.query(
      'UPDATE pages SET content = $1 WHERE id = $2',
      [JSON.stringify(fixedSlides), id]
    );
    
    console.log('Banner slides successfully updated for production environment!');
    
    // Create a version
    console.log('Creating a content version for backup...');
    
    await client.query(
      'INSERT INTO content_versions (page_id, content, version_notes, created_at) VALUES ($1, $2, $3, NOW())',
      [id, page.content, 'Backup before fixing banner slide paths for production']
    );
    
    console.log('Content version created!');
    
  } catch (error) {
    console.error('Error fixing banner slides:', error);
  } finally {
    client.release();
  }
}

// Run the function and exit when done
fixBannerSlidesForProduction()
  .then(() => {
    console.log('Script completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });