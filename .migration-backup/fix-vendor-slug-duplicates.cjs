/**
 * Fix Vendor Slug Duplicates
 * 
 * This script identifies and fixes vendor pages that have duplicate words
 * in their URLs (e.g., pest-control appearing twice).
 * 
 * Usage: node fix-vendor-slug-duplicates.js
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
 * Generate a proper slug from title and category (with duplicate word removal)
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
  
  // Remove duplicate words that appear in both category and title
  const categoryWords = categorySlug.split('-').filter(word => word.length > 0);
  const titleWords = titleSlug.split('-').filter(word => word.length > 0);
  
  // Filter out title words that already exist in category
  const uniqueTitleWords = titleWords.filter(word => !categoryWords.includes(word));
  
  // Reconstruct title slug without duplicates
  titleSlug = uniqueTitleWords.join('-');
  
  // If all title words were duplicates, use original title but log a warning
  if (!titleSlug && titleWords.length > 0) {
    console.warn(`All words in title "${title}" are duplicated in category "${category}". Using original title.`);
    titleSlug = titleWords.join('-');
  }
  
  return `vendors-${categorySlug}-${titleSlug}`;
}

/**
 * Convert database slug to public URL format
 */
function dbSlugToPublicUrl(slug) {
  if (!slug.startsWith('vendors-')) return slug;
  
  const withoutPrefix = slug.substring(8); // Remove 'vendors-'
  
  // Check compound categories first
  for (const compound of COMPOUND_CATEGORIES) {
    if (withoutPrefix.startsWith(`${compound}-`)) {
      const remainder = withoutPrefix.substring(compound.length + 1);
      return `/vendors/${compound}/${remainder}`;
    }
  }
  
  // For simple categories, split at first hyphen
  const firstHyphen = withoutPrefix.indexOf('-');
  if (firstHyphen === -1) return `/vendors/${withoutPrefix}`;
  
  const category = withoutPrefix.substring(0, firstHyphen);
  const name = withoutPrefix.substring(firstHyphen + 1);
  
  return `/vendors/${category}/${name}`;
}

/**
 * Test the new slug generation logic
 */
function testSlugGeneration() {
  console.log('🧪 Testing slug generation logic...\n');
  
  const testCases = [
    { title: 'All County Pest Control', category: 'pest-control' },
    { title: 'Control All County Control', category: 'pest-control' },
    { title: 'Home Services Expert', category: 'home-services' },
    { title: 'Service Plus Home Services', category: 'home-services' },
    { title: 'Air Quality Solutions', category: 'hvac-and-air-quality' },
    { title: 'Real Estate Professionals', category: 'real-estate-and-senior-living' }
  ];
  
  testCases.forEach(({ title, category }) => {
    const newSlug = generateVendorSlug(title, category);
    const publicUrl = dbSlugToPublicUrl(newSlug);
    console.log(`📝 "${title}" in "${category}"`);
    console.log(`   Slug: ${newSlug}`);
    console.log(`   URL:  ${publicUrl}\n`);
  });
}

/**
 * Analyze existing vendor slugs for duplicates
 */
async function analyzeVendorSlugs() {
  console.log('🔍 Analyzing existing vendor slugs for duplicates...\n');
  
  const query = `
    SELECT id, slug, title 
    FROM page_contents 
    WHERE slug LIKE 'vendors-%' 
    ORDER BY slug
  `;
  
  const result = await client.query(query);
  const vendorPages = result.rows;
  
  console.log(`Found ${vendorPages.length} vendor pages to analyze\n`);
  
  const duplicateIssues = [];
  
  vendorPages.forEach(page => {
    const { id, slug, title } = page;
    const category = extractVendorCategory(slug);
    
    if (!category) {
      console.log(`⚠️  Cannot extract category from slug: ${slug}`);
      return;
    }
    
    // Extract the title part from the slug
    const withoutPrefix = slug.substring(8); // Remove 'vendors-'
    const categoryLength = category.length;
    const titlePart = withoutPrefix.substring(categoryLength + 1); // +1 for the hyphen
    
    // Check for duplicate words
    const categoryWords = category.split('-').filter(word => word.length > 0);
    const titleWords = titlePart.split('-').filter(word => word.length > 0);
    
    const duplicateWords = titleWords.filter(word => categoryWords.includes(word));
    
    if (duplicateWords.length > 0) {
      const correctSlug = generateVendorSlug(title, category);
      const currentUrl = dbSlugToPublicUrl(slug);
      const correctUrl = dbSlugToPublicUrl(correctSlug);
      
      duplicateIssues.push({
        id,
        title,
        category,
        currentSlug: slug,
        correctSlug,
        currentUrl,
        correctUrl,
        duplicateWords
      });
      
      console.log(`🔸 DUPLICATE FOUND:`);
      console.log(`   ID: ${id}`);
      console.log(`   Title: "${title}"`);
      console.log(`   Category: ${category}`);
      console.log(`   Current URL: ${currentUrl}`);
      console.log(`   Correct URL: ${correctUrl}`);
      console.log(`   Duplicate words: [${duplicateWords.join(', ')}]\n`);
    }
  });
  
  return duplicateIssues;
}

/**
 * Fix duplicate slug issues
 */
async function fixDuplicateSlugs(duplicateIssues) {
  if (duplicateIssues.length === 0) {
    console.log('✅ No duplicate slug issues found. All vendor URLs are properly formatted.\n');
    return;
  }
  
  console.log(`🔧 Fixing ${duplicateIssues.length} vendor pages with duplicate words...\n`);
  
  let fixedCount = 0;
  
  for (const issue of duplicateIssues) {
    const { id, currentSlug, correctSlug, title } = issue;
    
    try {
      const updateQuery = `
        UPDATE page_contents 
        SET slug = $1, updated_at = NOW() 
        WHERE id = $2
      `;
      
      await client.query(updateQuery, [correctSlug, id]);
      
      console.log(`✅ Fixed: "${title}" (ID: ${id})`);
      console.log(`   Old: ${currentSlug}`);
      console.log(`   New: ${correctSlug}\n`);
      
      fixedCount++;
    } catch (error) {
      console.error(`❌ Failed to fix "${title}" (ID: ${id}):`, error.message);
    }
  }
  
  console.log(`🎉 Successfully fixed ${fixedCount} vendor pages\n`);
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🚀 Starting vendor slug duplicate fix process...\n');
    
    await client.connect();
    console.log('📊 Connected to database\n');
    
    // Test the new logic first
    testSlugGeneration();
    
    // Analyze existing slugs
    const duplicateIssues = await analyzeVendorSlugs();
    
    // Fix the issues
    await fixDuplicateSlugs(duplicateIssues);
    
    console.log('✨ Vendor slug duplicate fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during vendor slug fix process:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  analyzeVendorSlugs,
  fixDuplicateSlugs,
  testSlugGeneration
};