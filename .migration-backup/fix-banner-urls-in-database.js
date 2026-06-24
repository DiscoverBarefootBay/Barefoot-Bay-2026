/**
 * Fix Banner Slide URLs in Database
 * 
 * This script updates the database to use working proxy URLs instead of 
 * non-existent Object Storage URLs, eliminating the 404 errors.
 */

import pg from 'pg';
const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Convert Object Storage URL to working proxy URL
 */
function convertToProxyUrl(originalUrl) {
  // Extract filename from Object Storage URL
  const filename = originalUrl.split('/').pop();
  
  // Return proxy URL that we know works
  return `/api/storage-proxy/BANNER/banner-slides/${filename}`;
}

/**
 * Update banner slides in database
 */
async function updateBannerSlideUrls() {
  try {
    console.log('🔄 Fetching current banner slides from database...');
    
    // Get current banner slides
    const result = await pool.query(
      `SELECT id, content FROM page_contents WHERE slug = 'banner-slides'`
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No banner slides found in database');
      return;
    }
    
    const pageContent = result.rows[0];
    let slides = JSON.parse(pageContent.content);
    
    console.log(`📋 Found ${slides.length} banner slides`);
    
    let updatedCount = 0;
    
    // Update each slide's URL
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      
      if (slide.src && slide.src.includes('object-storage.replit.app')) {
        const oldUrl = slide.src;
        const newUrl = convertToProxyUrl(oldUrl);
        
        slides[i].src = newUrl;
        
        console.log(`✅ Updated slide ${i + 1}:`);
        console.log(`   From: ${oldUrl}`);
        console.log(`   To:   ${newUrl}`);
        
        updatedCount++;
      }
    }
    
    if (updatedCount === 0) {
      console.log('ℹ️ No URLs needed updating');
      return;
    }
    
    // Save updated slides back to database
    console.log(`\n💾 Saving ${updatedCount} updated URLs to database...`);
    
    await pool.query(
      `UPDATE page_contents 
       SET content = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE slug = 'banner-slides'`,
      [JSON.stringify(slides)]
    );
    
    console.log('✅ Database updated successfully!');
    console.log(`🎉 Fixed ${updatedCount} banner slide URLs`);
    console.log('\n📱 The 404 errors should now be resolved.');
    console.log('💡 Refresh your website to see the changes take effect.');
    
  } catch (error) {
    console.error('❌ Error updating banner slides:', error);
  } finally {
    await pool.end();
  }
}

// Run the update
updateBannerSlideUrls();