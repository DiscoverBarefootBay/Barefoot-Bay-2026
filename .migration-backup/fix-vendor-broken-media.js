/**
 * Fix Broken Media Links in Vendor Pages
 * 
 * This script removes broken media links from all vendor pages content.
 * It specifically targets img tags with broken src attributes and removes them entirely.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Remove broken img tags from HTML content
 * @param {string} content - HTML content to clean
 * @returns {string} - Cleaned HTML content
 */
function removeBrokenImages(content) {
  if (!content) return content;
  
  // Remove img tags with broken src attributes
  // This regex matches img tags with various patterns of broken/missing src
  const brokenImagePatterns = [
    // Images with empty src
    /<img[^>]*src\s*=\s*["']?\s*["']?[^>]*>/gi,
    // Images with "undefined" src
    /<img[^>]*src\s*=\s*["']?undefined["']?[^>]*>/gi,
    // Images with "null" src  
    /<img[^>]*src\s*=\s*["']?null["']?[^>]*>/gi,
    // Images with broken blob URLs
    /<img[^>]*src\s*=\s*["']?blob:[^"']*["']?[^>]*>/gi,
    // Images with data URLs that don't work
    /<img[^>]*src\s*=\s*["']?data:image\/[^"']*["']?[^>]*>/gi,
    // Images with local file paths
    /<img[^>]*src\s*=\s*["']?file:\/\/[^"']*["']?[^>]*>/gi,
    // Images with broken upload paths that don't exist
    /<img[^>]*src\s*=\s*["']?\/uploads\/[^"']*["']?[^>]*>/gi,
  ];
  
  let cleanedContent = content;
  
  // Apply each pattern to remove broken images
  brokenImagePatterns.forEach(pattern => {
    cleanedContent = cleanedContent.replace(pattern, '');
  });
  
  // Also remove any img tags that have alt="roofs" or other generic alt text
  // that might indicate placeholder/broken images
  const genericImagePatterns = [
    /<img[^>]*alt\s*=\s*["']?roofs["']?[^>]*>/gi,
    /<img[^>]*alt\s*=\s*["']?image["']?[^>]*>/gi,
    /<img[^>]*alt\s*=\s*["']?photo["']?[^>]*>/gi,
    /<img[^>]*alt\s*=\s*["']?picture["']?[^>]*>/gi,
  ];
  
  genericImagePatterns.forEach(pattern => {
    // Only remove if the src is also broken/missing
    cleanedContent = cleanedContent.replace(pattern, (match) => {
      // Check if this img tag has a broken src
      const hasBrokenSrc = 
        !match.includes('src=') || 
        match.includes('src=""') || 
        match.includes("src=''") ||
        match.includes('src="undefined"') ||
        match.includes('src="null"') ||
        match.includes('src="/uploads/');
      
      return hasBrokenSrc ? '' : match;
    });
  });
  
  // Clean up any leftover empty paragraphs or divs that contained only the removed images
  cleanedContent = cleanedContent.replace(/<p[^>]*>\s*<\/p>/gi, '');
  cleanedContent = cleanedContent.replace(/<div[^>]*>\s*<\/div>/gi, '');
  
  // Clean up multiple consecutive line breaks
  cleanedContent = cleanedContent.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return cleanedContent.trim();
}

/**
 * Get all vendor pages from the database
 */
async function getVendorPages() {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT id, slug, title, content 
      FROM page_contents 
      WHERE slug LIKE 'vendors-%' 
      AND content IS NOT NULL 
      AND content != ''
      ORDER BY slug
    `);
    
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Update a vendor page with cleaned content
 */
async function updateVendorPage(pageId, cleanedContent) {
  const client = await pool.connect();
  
  try {
    await client.query(`
      UPDATE page_contents 
      SET content = $1, updated_at = NOW() 
      WHERE id = $2
    `, [cleanedContent, pageId]);
    
    return true;
  } catch (error) {
    console.error(`Error updating page ${pageId}:`, error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Main function to fix broken media in all vendor pages
 */
async function fixVendorBrokenMedia() {
  console.log('🔧 Starting vendor broken media cleanup...');
  
  try {
    // Get all vendor pages
    const vendorPages = await getVendorPages();
    console.log(`📄 Found ${vendorPages.length} vendor pages to process`);
    
    let processedCount = 0;
    let cleanedCount = 0;
    let errorCount = 0;
    
    // Process each vendor page
    for (const page of vendorPages) {
      console.log(`\n📝 Processing: ${page.slug} (${page.title})`);
      
      const originalContent = page.content;
      const cleanedContent = removeBrokenImages(originalContent);
      
      // Check if content was actually changed
      if (cleanedContent !== originalContent) {
        console.log(`🧹 Cleaning broken media from: ${page.slug}`);
        
        // Show what was removed (first 200 chars of diff for debugging)
        const removedContent = originalContent.length - cleanedContent.length;
        console.log(`   📉 Removed ${removedContent} characters of broken media`);
        
        // Update the page
        const success = await updateVendorPage(page.id, cleanedContent);
        
        if (success) {
          cleanedCount++;
          console.log(`   ✅ Updated successfully`);
        } else {
          errorCount++;
          console.log(`   ❌ Failed to update`);
        }
      } else {
        console.log(`   ✨ No broken media found`);
      }
      
      processedCount++;
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Vendor Media Cleanup Complete!');
    console.log('='.repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   • Pages processed: ${processedCount}`);
    console.log(`   • Pages cleaned: ${cleanedCount}`);
    console.log(`   • Errors: ${errorCount}`);
    console.log(`   • No changes needed: ${processedCount - cleanedCount - errorCount}`);
    
    if (cleanedCount > 0) {
      console.log(`\n🔄 Recommendation: Clear your browser cache to see the changes`);
    }
    
  } catch (error) {
    console.error('❌ Error during vendor media cleanup:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
fixVendorBrokenMedia()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });