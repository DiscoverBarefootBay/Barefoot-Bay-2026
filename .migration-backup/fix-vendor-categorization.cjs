/**
 * Fix Vendor Categorization System
 * 
 * This script investigates and fixes the vendor categorization issue where pages
 * with updated slugs are no longer appearing under their proper categories.
 * 
 * The system relies on slug patterns like "vendors-{category}-{name}" for categorization.
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function investigateCategorizationIssue() {
  try {
    console.log('🔍 Investigating vendor categorization system...\n');
    
    // 1. Get all vendor categories from database
    const { rows: categories } = await pool.query(`
      SELECT id, name, slug, is_hidden 
      FROM vendor_categories 
      ORDER BY name
    `);
    
    console.log(`📋 Found ${categories.length} vendor categories:`);
    categories.forEach(cat => {
      console.log(`- ${cat.name} (slug: "${cat.slug}", hidden: ${cat.is_hidden})`);
    });
    
    // 2. Get all vendor pages
    const { rows: vendorPages } = await pool.query(`
      SELECT id, title, slug, is_hidden, created_at, updated_at
      FROM page_contents 
      WHERE slug LIKE 'vendors-%' 
      AND slug != 'vendors-main' 
      AND slug != 'vendors'
      ORDER BY slug
    `);
    
    console.log(`\n📄 Found ${vendorPages.length} vendor pages:`);
    vendorPages.forEach(page => {
      console.log(`- "${page.title}" → ${page.slug} (hidden: ${page.is_hidden})`);
    });
    
    // 3. Analyze categorization patterns
    console.log('\n🔍 Analyzing categorization patterns...');
    const categorizedPages = {};
    const uncategorizedPages = [];
    
    // Initialize categories
    categories.forEach(cat => {
      categorizedPages[cat.slug] = [];
    });
    
    // Categorize pages using the same logic as the frontend
    vendorPages.forEach(page => {
      const slug = page.slug;
      let categorized = false;
      
      // Skip main vendor pages
      if (slug === 'vendors-main' || slug === 'vendors') {
        return;
      }
      
      // Check each category
      categories.forEach(category => {
        const categorySlug = category.slug;
        
        // Extract vendor category part from slug
        let vendorCategoryPart = '';
        
        if (slug.includes(' ')) {
          // For slugs with spaces
          vendorCategoryPart = slug.substring('vendors-'.length, slug.indexOf(' '));
        } else {
          // For slugs with dashes
          const slugParts = slug.split('-');
          if (slugParts.length >= 3 && slugParts[0] === 'vendors') {
            // Check for compound categories
            const possibleCategorySlug1 = slugParts[1];
            const possibleCategorySlug2 = `${slugParts[1]}-${slugParts[2]}`;
            
            // First check compound category
            const matchingCompoundCategory = categories.find(cat => cat.slug === possibleCategorySlug2);
            if (matchingCompoundCategory) {
              vendorCategoryPart = matchingCompoundCategory.slug;
            } else {
              // Check single word category
              const matchingSingleCategory = categories.find(cat => cat.slug === possibleCategorySlug1);
              if (matchingSingleCategory) {
                vendorCategoryPart = matchingSingleCategory.slug;
              }
            }
          }
        }
        
        // Check if this page belongs to this category
        if (
          vendorCategoryPart === categorySlug ||
          slug.startsWith(`vendors-${categorySlug}-`) ||
          (categorySlug === 'home-services' && vendorCategoryPart === 'home-service') ||
          (categorySlug === 'home-services' && vendorCategoryPart === 'homeservices') ||
          (categorySlug === 'food-dining' && (vendorCategoryPart === 'food' || vendorCategoryPart === 'dining')) ||
          (categorySlug === 'professional-services' && vendorCategoryPart === 'professional')
        ) {
          categorizedPages[categorySlug].push(page);
          categorized = true;
        }
      });
      
      if (!categorized) {
        uncategorizedPages.push(page);
      }
    });
    
    // 4. Report categorization results
    console.log('\n📊 Categorization Results:');
    categories.forEach(category => {
      const pages = categorizedPages[category.slug];
      console.log(`\n${category.name} (${category.slug}): ${pages.length} pages`);
      pages.forEach(page => {
        console.log(`  ✓ "${page.title}" → ${page.slug}`);
      });
    });
    
    if (uncategorizedPages.length > 0) {
      console.log(`\n❌ Uncategorized pages: ${uncategorizedPages.length}`);
      uncategorizedPages.forEach(page => {
        console.log(`  ⚠️ "${page.title}" → ${page.slug}`);
      });
    }
    
    // 5. Focus on "All County Pest Control" issue
    console.log('\n🎯 Analyzing "All County Pest Control" specifically...');
    const pestControlPages = vendorPages.filter(page => 
      page.title.toLowerCase().includes('pest') || 
      page.slug.includes('pest')
    );
    
    pestControlPages.forEach(page => {
      console.log(`Found pest-related page: "${page.title}" → ${page.slug}`);
      
      // Check if it matches pest-control category
      const pestControlCategory = categories.find(cat => cat.slug === 'pest-control');
      if (pestControlCategory) {
        console.log(`Pest Control category exists: ${pestControlCategory.name} (${pestControlCategory.slug})`);
        
        // Test categorization logic
        const slug = page.slug;
        const slugParts = slug.split('-');
        console.log(`Slug parts: [${slugParts.join(', ')}]`);
        
        if (slugParts.length >= 3 && slugParts[0] === 'vendors') {
          const possibleCategorySlug1 = slugParts[1]; // "pest"
          const possibleCategorySlug2 = `${slugParts[1]}-${slugParts[2]}`; // "pest-all" or similar
          
          console.log(`Checking category matches:`);
          console.log(`  - Single word: "${possibleCategorySlug1}" vs "${pestControlCategory.slug}"`);
          console.log(`  - Compound: "${possibleCategorySlug2}" vs "${pestControlCategory.slug}"`);
          console.log(`  - Direct pattern: "${slug}" starts with "vendors-${pestControlCategory.slug}-"? ${slug.startsWith(`vendors-${pestControlCategory.slug}-`)}`);
        }
      }
    });
    
    return { categories, vendorPages, categorizedPages, uncategorizedPages };
    
  } catch (error) {
    console.error('❌ Error investigating categorization:', error);
    throw error;
  }
}

async function fixCategorizationIssues() {
  try {
    console.log('\n🔧 Starting categorization fixes...\n');
    
    const investigation = await investigateCategorizationIssue();
    const { categories, uncategorizedPages } = investigation;
    
    if (uncategorizedPages.length === 0) {
      console.log('✅ All pages are properly categorized!');
      return;
    }
    
    console.log(`\n🔧 Fixing ${uncategorizedPages.length} uncategorized pages...\n`);
    
    // For each uncategorized page, determine the correct category and fix the slug
    for (const page of uncategorizedPages) {
      console.log(`\nProcessing: "${page.title}" (${page.slug})`);
      
      // Special handling for known cases
      if (page.title.toLowerCase().includes('pest')) {
        const pestControlCategory = categories.find(cat => cat.slug === 'pest-control');
        if (pestControlCategory) {
          // Generate correct slug for pest control vendor
          const titleSlug = page.title.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
          
          // Remove "pest" and "control" from title slug to avoid duplication
          const titleWords = titleSlug.split('-');
          const filteredWords = titleWords.filter(word => 
            word !== 'pest' && word !== 'control'
          );
          const cleanTitleSlug = filteredWords.join('-');
          
          const newSlug = `vendors-${pestControlCategory.slug}-${cleanTitleSlug}`;
          
          console.log(`  Proposed new slug: ${newSlug}`);
          
          // Check if this new slug already exists
          const { rows: existingPages } = await pool.query(
            'SELECT id FROM page_contents WHERE slug = $1',
            [newSlug]
          );
          
          if (existingPages.length > 0) {
            console.log(`  ⚠️ Slug ${newSlug} already exists, copying content instead...`);
            
            // Copy content from old slug to new slug
            await pool.query(`
              INSERT INTO page_contents (slug, title, content, media_urls, updated_by, created_at, updated_at, is_hidden)
              SELECT $1, title, content, media_urls, updated_by, NOW(), NOW(), is_hidden
              FROM page_contents 
              WHERE slug = $2
            `, [newSlug, page.slug]);
            
            console.log(`  ✅ Copied content from ${page.slug} to ${newSlug}`);
          } else {
            // Update the existing slug
            await pool.query(
              'UPDATE page_contents SET slug = $1, updated_at = NOW() WHERE id = $2',
              [newSlug, page.id]
            );
            
            console.log(`  ✅ Updated slug from ${page.slug} to ${newSlug}`);
          }
        }
      }
      
      // Add more category-specific handling here for other uncategorized pages
    }
    
    console.log('\n✅ Categorization fixes completed!');
    
  } catch (error) {
    console.error('❌ Error fixing categorization:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting vendor categorization analysis and fix...\n');
    
    await investigateCategorizationIssue();
    await fixCategorizationIssues();
    
    console.log('\n🎉 Process completed successfully!');
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { investigateCategorizationIssue, fixCategorizationIssues };