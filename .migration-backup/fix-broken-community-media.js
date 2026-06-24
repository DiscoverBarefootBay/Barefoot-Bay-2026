/**
 * Fix Broken Community Media Links
 * 
 * This script removes broken media links from Community pages that use the old /uploads/ path format.
 * These broken links cannot be deleted from the visual editor, so we'll clean them up directly in the database.
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { pageContents } = require('./shared/schema.ts');
const { eq } = require('drizzle-orm');

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = postgres(connectionString);
const db = drizzle(client);

/**
 * Remove broken image tags from HTML content
 * @param {string} content - HTML content to clean
 * @returns {string} - Cleaned HTML content
 */
function removeBrokenImageTags(content) {
  if (!content) return content;
  
  // Remove img tags that contain /uploads/ paths (these are broken)
  const cleanedContent = content.replace(
    /<img[^>]*src="[^"]*\/uploads\/[^"]*"[^>]*>/g, 
    ''
  );
  
  // Also remove any empty img tags with src=""
  return cleanedContent.replace(
    /<img[^>]*src=""[^>]*>/g, 
    ''
  );
}

/**
 * Fix broken media links in Community pages
 */
async function fixBrokenCommunityMedia() {
  console.log('🔧 Starting Community media cleanup...\n');
  
  try {
    // Find pages with broken media links
    const pagesWithBrokenMedia = await db
      .select()
      .from(pageContents)
      .where(
        // Look for pages containing /uploads/ or empty src="" in content
        // Using a simple LIKE query since we know the specific patterns
      );
    
    const brokenPages = pagesWithBrokenMedia.filter(page => 
      page.content && (
        page.content.includes('/uploads/') || 
        page.content.includes('src=""')
      )
    );
    
    console.log(`Found ${brokenPages.length} pages with broken media links:`);
    
    let fixedCount = 0;
    
    for (const page of brokenPages) {
      console.log(`\n📄 Processing: ${page.title} (${page.slug})`);
      console.log(`   Original content length: ${page.content.length} characters`);
      
      const originalContent = page.content;
      const cleanedContent = removeBrokenImageTags(originalContent);
      
      if (originalContent !== cleanedContent) {
        // Update the page with cleaned content
        await db
          .update(pageContents)
          .set({ 
            content: cleanedContent,
            updatedAt: new Date()
          })
          .where(eq(pageContents.id, page.id));
        
        console.log(`   ✅ Cleaned content length: ${cleanedContent.length} characters`);
        console.log(`   ✅ Removed ${originalContent.length - cleanedContent.length} characters of broken media`);
        fixedCount++;
      } else {
        console.log(`   ℹ️  No broken media found in this page`);
      }
    }
    
    console.log(`\n🎉 Cleanup complete!`);
    console.log(`   Pages processed: ${brokenPages.length}`);
    console.log(`   Pages fixed: ${fixedCount}`);
    console.log(`   Pages unchanged: ${brokenPages.length - fixedCount}`);
    
    if (fixedCount > 0) {
      console.log('\n✨ The broken media links have been removed from the Community pages.');
      console.log('   You can now edit these pages normally in the visual editor.');
    }
    
  } catch (error) {
    console.error('❌ Error fixing broken community media:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the fix
fixBrokenCommunityMedia()
  .then(() => {
    console.log('\n🏁 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });