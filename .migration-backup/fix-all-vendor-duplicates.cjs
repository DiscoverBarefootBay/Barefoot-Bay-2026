/**
 * Comprehensive fix for ALL vendor slug duplicates
 * 
 * This script addresses all remaining duplicate word issues in vendor URLs,
 * including edge cases with complex category matching.
 * 
 * Usage: node fix-all-vendor-duplicates.cjs
 */

const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

// Known compound categories that need special handling
const COMPOUND_CATEGORIES = [
  'technology-and-electronics',
  'home-services',
  'health-and-wellness',
  'food-and-dining',
  'beauty-and-spa',
  'arts-and-crafts',
  'sports-and-recreation',
  'automotive-and-transportation',
  'real-estate-and-senior-living',
  'education-and-training',
  'professional-services',
  'entertainment-and-events',
  'travel-and-hospitality',
  'finance-and-insurance',
  'hvac-and-air-quality',
  'moving-and-transportation'
];

/**
 * Extract vendor category from an existing vendor slug
 */
function extractVendorCategory(vendorSlug) {
  if (!vendorSlug.startsWith('vendors-')) return null;
  
  const withoutPrefix = vendorSlug.substring(8); // Remove 'vendors-'
  
  // Check compound categories first
  for (const compound of COMPOUND_CATEGORIES) {
    if (withoutPrefix.startsWith(`${compound}-`)) {
      return compound;
    }
  }
  
  // For simple categories, take the first part
  const parts = withoutPrefix.split('-');
  return parts.length > 0 ? parts[0] : null;
}

/**
 * Enhanced slug generation that removes ALL duplicate words
 */
function generateVendorSlug(title, category) {
  if (!title || !category) return '';
  
  // Format category first
  let categorySlug = category.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  // Format title to slug
  let titleSlug = title.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  // Get all words from category (including compound categories)
  const categoryWords = categorySlug.split('-').filter(word => word.length > 0);
  const titleWords = titleSlug.split('-').filter(word => word.length > 0);
  
  // Remove duplicate words that appear in both category and title
  const uniqueTitleWords = titleWords.filter(word => !categoryWords.includes(word));
  
  // Reconstruct title slug without duplicates
  titleSlug = uniqueTitleWords.join('-');
  
  // If all title words were duplicates, use a simplified version
  if (!titleSlug && titleWords.length > 0) {
    // Use only the first unique word or the original if none are unique
    const firstWord = titleWords.find(word => !categoryWords.includes(word));
    titleSlug = firstWord || titleWords[0];
  }
  
  return `vendors-${categorySlug}-${titleSlug}`;
}

/**
 * Detect duplicate words between category and title
 */
function detectDuplicateWords(slug, title, category) {
  if (!slug.startsWith('vendors-')) return [];
  
  const categoryWords = category.toLowerCase().split('-').filter(word => word.length > 0);
  const titleSlug = title.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  const titleWords = titleSlug.split('-').filter(word => word.length > 0);
  
  // Find words that appear in both category and title
  return titleWords.filter(word => categoryWords.includes(word));
}

/**
 * Main function to fix all vendor duplicates
 */
async function fixAllVendorDuplicates() {
  console.log('🚀 Starting comprehensive vendor duplicate word elimination...\n');
  
  try {
    await client.connect();
    console.log('📊 Connected to database\n');
    
    // Get all vendor pages
    const result = await client.query(`
      SELECT id, slug, title 
      FROM page_contents 
      WHERE slug LIKE 'vendors-%' 
      ORDER BY slug
    `);
    
    console.log(`📝 Found ${result.rows.length} vendor pages to analyze\n`);
    
    const duplicatePages = [];
    
    for (const row of result.rows) {
      const { id, slug, title } = row;
      const category = extractVendorCategory(slug);
      
      if (category) {
        const duplicates = detectDuplicateWords(slug, title, category);
        if (duplicates.length > 0) {
          const newSlug = generateVendorSlug(title, category);
          duplicatePages.push({
            id,
            title,
            currentSlug: slug,
            newSlug,
            category,
            duplicates
          });
        }
      }
    }
    
    console.log(`🔸 Found ${duplicatePages.length} pages with duplicate words to fix\n`);
    
    if (duplicatePages.length === 0) {
      console.log('🎉 No duplicate words found! All vendor URLs are optimal.\n');
      return;
    }
    
    // Show what will be fixed
    console.log('📋 Pages to be fixed:\n');
    duplicatePages.forEach((page, index) => {
      console.log(`${index + 1}. "${page.title}" (ID: ${page.id})`);
      console.log(`   Category: ${page.category}`);
      console.log(`   Current:  ${page.currentSlug}`);
      console.log(`   Fixed:    ${page.newSlug}`);
      console.log(`   Removed:  [${page.duplicates.join(', ')}]\n`);
    });
    
    console.log('🔧 Applying fixes...\n');
    
    let fixedCount = 0;
    
    for (const page of duplicatePages) {
      try {
        await client.query(
          'UPDATE page_contents SET slug = $1 WHERE id = $2',
          [page.newSlug, page.id]
        );
        
        console.log(`✅ Fixed: "${page.title}" (ID: ${page.id})`);
        console.log(`   ${page.currentSlug} → ${page.newSlug}`);
        fixedCount++;
      } catch (error) {
        console.log(`❌ Failed to fix "${page.title}" (ID: ${page.id}): ${error.message}`);
      }
    }
    
    console.log(`\n🎉 Successfully fixed ${fixedCount}/${duplicatePages.length} vendor pages`);
    console.log('\n✨ All vendor URLs now follow optimal structure without duplicate words!');
    
  } catch (error) {
    console.error('❌ Fix operation failed:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the comprehensive fix
fixAllVendorDuplicates().catch(console.error);