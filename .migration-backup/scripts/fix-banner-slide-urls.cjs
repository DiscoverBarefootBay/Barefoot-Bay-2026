/**
 * Fix Banner Slide URLs script
 * 
 * This script finds and fixes any banner slide URLs in the database
 * that are using the wrong format. It converts URLs from:
 * /uploads/banner-slides/filename.ext to /banner-slides/filename.ext
 * 
 * Usage:
 * node scripts/fix-banner-slide-urls.cjs
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Get the database URL from environment
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Initialize database connection
const pool = new Pool({
  connectionString: dbUrl,
});

async function getPageContent() {
  console.log('Looking for banner slides content...');
  try {
    // Try page_contents table first (current schema)
    console.log('Checking page_contents table...');
    const result = await pool.query(
      'SELECT id, slug, title, content FROM page_contents WHERE slug = $1',
      ['banner-slides']
    );
    
    if (result.rows.length > 0) {
      console.log('Found banner slides in page_contents table');
      // Add table name to the result
      return { ...result.rows[0], table: 'page_contents' };
    }
    
    // Try fallback to page_content table (older schema)
    console.log('Checking page_content table...');
    const fallbackResult = await pool.query(
      'SELECT id, slug, title, content FROM page_content WHERE slug = $1',
      ['banner-slides']
    );
    
    if (fallbackResult.rows.length > 0) {
      console.log('Found banner slides in page_content table');
      // Add table name to the result
      return { ...fallbackResult.rows[0], table: 'page_content' };
    }
    
    console.log('No banner slides found in any content tables');
    return null;
  } catch (err) {
    console.error('Error querying content tables:', err);
    return null;
  }
}

async function fixBannerSlideUrls() {
  console.log('Connected to database');
  
  try {
    // Get the banner slides content
    const page = await getPageContent();
    if (!page) {
      console.log('Banner slides page not found, trying alternate tables...');
      return;
    }
    
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
    
    // Determine which table to update based on where we found the content
    const tableName = page.table || 'page_contents'; // Default to page_contents if not specified
    console.log(`Updating content in ${tableName} table`);
    
    await pool.query(
      `UPDATE ${tableName} SET content = $1 WHERE id = $2`,
      [stringifiedContent, page.id]
    );
    
    console.log(`Updated ${fixedContent.length} banner slides in the database`);
    
  } catch (err) {
    console.error('Error fixing banner slide URLs:', err);
  }
}

// Call the function to fix banner slide URLs
fixBannerSlideUrls()
  .then(() => {
    console.log('Banner slide URL fixing completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Uncaught error:', err);
    process.exit(1);
  });