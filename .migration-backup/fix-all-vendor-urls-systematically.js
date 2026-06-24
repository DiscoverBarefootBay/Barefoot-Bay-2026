/**
 * Systematic fix for all vendor URL generation issues
 * 
 * This script applies the corrected generateVendorSlug logic to all vendor pages
 * in the database, ensuring URLs preserve full descriptive titles.
 */

import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

// Updated compound categories based on database analysis
const COMPOUND_CATEGORIES = [
  'technology-and-electronics',
  'home-services',
  'health-and-wellness',
  'food-and-dining',
  'beauty-and-spa',
  'arts-and-crafts',
  'sports-and-recreation',
  'automotive-and-transportation',
  'real-estate-and-property',
  'education-and-training',
  'professional-services',
  'entertainment-and-events',
  'travel-and-hospitality',
  'finance-and-insurance',
  'pest-control',
  'insurance-financial-services',
  'hvac-and-air-quality',
  'moving-and-transportation',
  'new-homes-installation',
  'pressure-washing',
  'real-estate-senior-living',
  'anchor-and-vapor-barrier',
  'funeral-and-cremation',
  'beauty-personal-care',
  'automotive-golf-carts'
];

/**
 * Improved slug generation that preserves full descriptive titles
 */
function generateImprovedVendorSlug(title, category) {
  if (!title || !category) return '';
  
  // Format category first
  let categorySlug = category.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  // Format title to slug - preserve full descriptive information
  let titleSlug = title.toLowerCase()
    .replace(/\([^)]*\)/g, (match) => {
      // Extract content from parentheses and include descriptive parts
      const content = match.slice(1, -1).toLowerCase();
      if (content.includes('medicare') || content.includes('specialist') || 
          content.includes('expert') || content.includes('agent') || 
          content.includes('consultant') || content.includes('service')) {
        return ' ' + content;
      }
      return '';
    })
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  // Only remove exact sequential duplicates at the beginning of title that match category
  const categoryWords = categorySlug.split('-').filter(word => word.length > 0);
  const titleWords = titleSlug.split('-').filter(word => word.length > 0);
  
  let cleanedTitleWords = titleWords;
  let categoryIndex = 0;
  
  for (let i = 0; i < titleWords.length && categoryIndex < categoryWords.length; i++) {
    if (titleWords[i] === categoryWords[categoryIndex]) {
      categoryIndex++;
    } else {
      break;
    }
  }
  
  // Only remove if we matched the entire category sequence at the start
  if (categoryIndex === categoryWords.length) {
    cleanedTitleWords = titleWords.slice(categoryIndex);
  }
  
  // If no words remain, keep the original title
  titleSlug = cleanedTitleWords.length > 0 ? cleanedTitleWords.join('-') : titleWords.join('-');
  
  return `vendors-${categorySlug}-${titleSlug}`;
}

/**
 * Extract category from existing vendor slug
 */
function extractCategoryFromSlug(slug) {
  if (!slug.startsWith('vendors-')) return null;
  
  const withoutPrefix = slug.substring(8);
  
  // Check compound categories first
  for (const compound of COMPOUND_CATEGORIES) {
    if (withoutPrefix.startsWith(`${compound}-`)) {
      return compound;
    }
  }
  
  // For simple categories, take first word
  const firstHyphen = withoutPrefix.indexOf('-');
  if (firstHyphen === -1) return withoutPrefix;
  
  return withoutPrefix.substring(0, firstHyphen);
}

async function fixAllVendorUrls() {
  try {
    console.log('🔍 Starting systematic vendor URL fix...');
    
    // Get all vendor pages
    const vendorPages = await sql`
      SELECT id, slug, title 
      FROM page_contents 
      WHERE slug LIKE 'vendors-%'
      ORDER BY slug
    `;
    
    console.log(`📊 Found ${vendorPages.length} vendor pages to analyze`);
    
    let updatedCount = 0;
    let issuesFound = [];
    const updates = [];
    
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
        console.log(`🔄 Will update: ${title}`);
        console.log(`   From: ${oldSlug}`);
        console.log(`   To:   ${newSlug}`);
        
        updates.push({ id: page.id, oldSlug, newSlug, title });
        updatedCount++;
      }
    }
    
    if (updates.length === 0) {
      console.log('✅ All vendor URLs are already in correct format');
      return { updated: 0, total: vendorPages.length, issues: issuesFound };
    }
    
    console.log(`\n📝 Applying ${updates.length} updates to database...`);
    
    // Apply updates in batches
    for (const update of updates) {
      await sql`
        UPDATE page_contents 
        SET slug = ${update.newSlug}
        WHERE id = ${update.id}
      `;
      console.log(`✅ Updated: ${update.title}`);
    }
    
    console.log(`\n🎉 Successfully updated ${updatedCount} vendor URLs`);
    
    if (issuesFound.length > 0) {
      console.log('\n⚠️ Issues found:');
      issuesFound.forEach(issue => console.log(`   - ${issue}`));
    }
    
    return {
      updated: updatedCount,
      total: vendorPages.length,
      issues: issuesFound,
      updates: updates
    };
    
  } catch (error) {
    console.error('❌ Error fixing vendor URLs:', error);
    throw error;
  }
}

// Run the fix
fixAllVendorUrls()
  .then(result => {
    console.log('\n📋 Summary:');
    console.log(`   Total pages: ${result.total}`);
    console.log(`   Updated: ${result.updated}`);
    console.log(`   Issues: ${result.issues.length}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Fix failed:', error);
    process.exit(1);
  });

export { fixAllVendorUrls, generateImprovedVendorSlug };