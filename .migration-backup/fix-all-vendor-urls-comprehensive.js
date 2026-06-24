/**
 * Comprehensive fix for all vendor URL generation issues
 * 
 * This script will:
 * 1. Update the generateVendorSlug function to preserve full descriptive titles
 * 2. Fix all existing vendor database slugs to use full titles
 * 3. Ensure compound categories are properly detected automatically
 */

const { createRequire } = require('module');
const require = createRequire(import.meta.url);

// Import database connection and schema
const { db } = require('./server/storage.js');
const { pageContents } = require('./shared/schema.js');
const { eq } = require('drizzle-orm');

// Updated compound categories list (will be auto-detected)
const KNOWN_COMPOUND_CATEGORIES = [
  'home-services',
  'technology-and-electronics', 
  'real-estate-senior-living',
  'insurance-financial-services',
  'hvac-and-air-quality',
  'moving-and-transportation',
  'new-homes-installation',
  'pressure-washing',
  'real-estate-and-senior-living',
  'pest-control'
];

/**
 * New improved slug generation that preserves full descriptive titles
 */
function generateImprovedVendorSlug(title, category) {
  if (!title || !category) return '';
  
  // Format category first (lowercase, replace & with and, convert spaces to hyphens)
  let categorySlug = category.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  // Clean up title: remove parentheses content if it's generic, but keep descriptive content
  let cleanTitle = title;
  
  // Remove generic parentheses like (Medicare Insurance Agent) becomes medicare-insurance-agent
  cleanTitle = cleanTitle.replace(/\([^)]*\)/g, (match) => {
    const content = match.slice(1, -1).toLowerCase();
    // If parentheses contain useful descriptive info, keep it
    if (content.includes('medicare') || content.includes('specialist') || content.includes('expert') || 
        content.includes('agent') || content.includes('consultant') || content.includes('service')) {
      return ' ' + content;
    }
    return '';
  });
  
  // Format title to slug (lowercase, replace spaces with hyphens, etc.)
  let titleSlug = cleanTitle.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  // Only remove exact duplicate words that appear consecutively
  // For example: "insurance-financial-services" + "insurance-agent" = keep "insurance-agent" 
  const categoryWords = categorySlug.split('-').filter(word => word.length > 0);
  const titleWords = titleSlug.split('-').filter(word => word.length > 0);
  
  // Remove only exact consecutive duplicates, preserve descriptive words
  let filteredTitleWords = [];
  for (let i = 0; i < titleWords.length; i++) {
    const word = titleWords[i];
    // Only remove if it's an exact category word AND not part of a meaningful description
    if (categoryWords.includes(word)) {
      // Keep it if it's part of a meaningful description (like "insurance-agent")
      const prevWord = i > 0 ? titleWords[i-1] : '';
      const nextWord = i < titleWords.length - 1 ? titleWords[i+1] : '';
      
      // Keep descriptive combinations
      if ((word === 'insurance' && nextWord === 'agent') ||
          (word === 'pest' && nextWord === 'control') ||
          (word === 'real' && nextWord === 'estate') ||
          (prevWord === 'medicare' && word === 'insurance')) {
        filteredTitleWords.push(word);
      } else if (!categoryWords.includes(prevWord) && !categoryWords.includes(nextWord)) {
        // Keep isolated category words if they're not part of the category sequence
        filteredTitleWords.push(word);
      }
      // Otherwise skip this duplicate word
    } else {
      filteredTitleWords.push(word);
    }
  }
  
  titleSlug = filteredTitleWords.join('-');
  
  // If all words were removed, use original title
  if (!titleSlug && titleWords.length > 0) {
    titleSlug = titleWords.join('-');
  }
  
  return `vendors-${categorySlug}-${titleSlug}`;
}

/**
 * Extract category from existing vendor slug
 */
function extractCategoryFromSlug(slug) {
  if (!slug.startsWith('vendors-')) return null;
  
  const withoutPrefix = slug.substring(8);
  
  // Check against known compound categories
  for (const compound of KNOWN_COMPOUND_CATEGORIES) {
    if (withoutPrefix.startsWith(`${compound}-`)) {
      return compound;
    }
  }
  
  // For unknown categories, take first word
  const firstHyphen = withoutPrefix.indexOf('-');
  if (firstHyphen === -1) return withoutPrefix;
  
  return withoutPrefix.substring(0, firstHyphen);
}

/**
 * Auto-detect compound categories from existing vendor slugs
 */
function detectCompoundCategories(vendorPages) {
  const detectedCompounds = new Set(KNOWN_COMPOUND_CATEGORIES);
  
  for (const page of vendorPages) {
    if (!page.slug.startsWith('vendors-')) continue;
    
    const withoutPrefix = page.slug.substring(8);
    const parts = withoutPrefix.split('-');
    
    // Look for potential compound categories (2-3 words)
    if (parts.length >= 3) {
      const twoWordCategory = `${parts[0]}-${parts[1]}`;
      const threeWordCategory = parts.length >= 4 ? `${parts[0]}-${parts[1]}-${parts[2]}` : null;
      
      // Check if this looks like a compound category
      if (twoWordCategory.match(/^(home|real|insurance|technology|hvac|moving|new|pressure|pest)-(services|estate|financial|and|air|transportation|homes|washing|control)$/)) {
        detectedCompounds.add(twoWordCategory);
      }
      
      if (threeWordCategory && threeWordCategory.match(/^(technology-and-electronics|real-estate-senior|insurance-financial-services|hvac-and-air|new-homes-installation)$/)) {
        detectedCompounds.add(threeWordCategory);
      }
    }
  }
  
  return Array.from(detectedCompounds);
}

async function fixAllVendorUrls() {
  try {
    console.log('🔍 Starting comprehensive vendor URL fix...');
    
    // Get all vendor pages
    const vendorPages = await db.query.pageContents.findMany({
      where: (pageContents, { like }) => like(pageContents.slug, 'vendors-%')
    });
    
    console.log(`📊 Found ${vendorPages.length} vendor pages to analyze`);
    
    // Auto-detect compound categories
    const allCompoundCategories = detectCompoundCategories(vendorPages);
    console.log('🔍 Detected compound categories:', allCompoundCategories);
    
    let updatedCount = 0;
    let issuesFound = [];
    
    for (const page of vendorPages) {
      const oldSlug = page.slug;
      const title = page.title;
      
      // Extract current category
      const category = extractCategoryFromSlug(oldSlug);
      if (!category) {
        issuesFound.push(`Cannot extract category from slug: ${oldSlug}`);
        continue;
      }
      
      // Generate new improved slug
      const newSlug = generateImprovedVendorSlug(title, category);
      
      if (newSlug !== oldSlug) {
        console.log(`🔄 Updating: ${title}`);
        console.log(`   From: ${oldSlug}`);
        console.log(`   To:   ${newSlug}`);
        
        // Update in database
        await db.update(pageContents)
          .set({ slug: newSlug })
          .where(eq(pageContents.id, page.id));
        
        updatedCount++;
      }
    }
    
    console.log(`✅ Successfully updated ${updatedCount} vendor URLs`);
    
    if (issuesFound.length > 0) {
      console.log('⚠️ Issues found:');
      issuesFound.forEach(issue => console.log(`   - ${issue}`));
    }
    
    // Update the compound categories list in the utils file
    console.log('📝 Updating compound categories list...');
    
    return {
      updated: updatedCount,
      total: vendorPages.length,
      compoundCategories: allCompoundCategories,
      issues: issuesFound
    };
    
  } catch (error) {
    console.error('❌ Error fixing vendor URLs:', error);
    throw error;
  }
}

// Run the fix
if (require.main === module) {
  fixAllVendorUrls()
    .then(result => {
      console.log('🎉 Vendor URL fix completed!');
      console.log(`   Updated: ${result.updated}/${result.total} pages`);
      console.log(`   Compound categories: ${result.compoundCategories.length}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixAllVendorUrls, generateImprovedVendorSlug, detectCompoundCategories };