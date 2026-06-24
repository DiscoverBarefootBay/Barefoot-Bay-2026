/**
 * Vendor URL Slug Format Fixer
 * 
 * This script performs a quick database scan to identify and fix 
 * vendor slugs with problematic formats.
 * 
 * Issues it addresses:
 * 1. Duplicate category segments in slugs (e.g., technology-electronics-electronics-computer)
 * 2. Inconsistent formatting with service/vendor prefixes
 * 3. Missing "vendors-" prefix in stored slugs
 * 
 * Requirements:
 * - Node.js
 * - Database access via the DATABASE_URL environment variable
 */

const { Pool } = require('pg');
const { COMPOUND_CATEGORIES } = require('./client/src/components/vendors/vendor-url-converter');

// Create a new database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Determines if a slug needs to be repaired for consistency
 * @param {string} slug The database slug to check
 * @returns {boolean} true if the slug needs repair, false if it's properly formatted
 */
function needsSlugRepair(slug) {
  if (!slug) return false;
  if (!slug.startsWith('vendors-')) return true;
  
  // Check for double hyphens that might indicate formatting issues
  if (slug.includes('--')) return true;
  
  // Check for redundant category prefixes
  const parts = slug.split('-');
  if (parts.length < 3) return false;
  
  // If we have vendors-category-category-name pattern, needs repair
  if (parts[1] === parts[2]) return true;
  
  // Check for compound categories with duplicate terms
  for (const compound of COMPOUND_CATEGORIES) {
    if (slug.startsWith(`vendors-${compound}-`)) {
      const compoundParts = compound.split('-');
      const remainingSlug = slug.substring(`vendors-${compound}-`.length);
      
      // Check if the first part of the remaining slug matches the last part of the compound
      // For example: vendors-technology-electronics-electronics-computer
      if (remainingSlug.startsWith(`${compoundParts[1]}-`)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Repairs a malformed vendor slug
 * @param {string} slug The possibly malformed slug
 * @param {string} category The correct category to use
 * @returns {string} A properly formatted slug
 */
function repairVendorSlug(slug, category) {
  if (!slug) return '';
  
  // If slug doesn't start with vendors-, add it
  if (!slug.startsWith('vendors-')) {
    return `vendors-${category}-${slug}`;
  }
  
  // Remove the vendors- prefix
  let remaining = slug.substring(8);
  
  // Special handling for compound categories
  const isCompoundCategory = COMPOUND_CATEGORIES.includes(category);
  
  if (isCompoundCategory) {
    // If it's a compound category like "technology-electronics"
    const categoryParts = category.split('-');
    
    // Detect duplicated terms - like "technology-electronics-electronics-computer"
    if (slug.includes(`-${categoryParts[1]}-${categoryParts[1]}-`)) {
      // Remove the duplicate term
      slug = slug.replace(`-${categoryParts[1]}-${categoryParts[1]}-`, `-${categoryParts[1]}-`);
    }
    
    // Ensure we have the right category prefix
    if (slug.startsWith(`vendors-${category}-`)) {
      // Already has the right format, just return the fixed slug
      return slug;
    } else if (slug.startsWith(`vendors-${categoryParts[0]}-`)) {
      // Has only the first part of the compound category
      return `vendors-${category}-${slug.substring(`vendors-${categoryParts[0]}-`.length)}`;
    } else {
      // Replace with the correct compound category
      return `vendors-${category}-${remaining}`;
    }
  }
  
  // Split the remaining parts
  const parts = remaining.split('-');
  
  // Handle simple category case
  // Check if the first part matches our category
  if (parts[0] === category) {
    // Already has the correct category, just ensure no duplicates
    if (parts[1] === category) {
      // Remove duplicate category
      return `vendors-${category}-${parts.slice(2).join('-')}`;
    }
    return `vendors-${category}-${parts.slice(1).join('-')}`;
  } else {
    // Replace with the correct category
    return `vendors-${category}-${remaining}`;
  }
}

/**
 * Scan the database for pages with vendor slugs and fix any malformed ones
 */
async function scanAndFixVendorSlugs() {
  const client = await pool.connect();
  
  try {
    // Get all vendor pages (with slugs starting with 'vendors-')
    const result = await client.query(`
      SELECT id, slug, title FROM page_content 
      WHERE slug LIKE 'vendors-%' OR slug LIKE 'vendors/%'
    `);
    
    console.log(`Found ${result.rowCount} vendor pages in the database`);
    
    // Track how many pages we've fixed
    let fixedCount = 0;
    let alreadyCorrectCount = 0;
    
    // Process each page
    for (const row of result.rows) {
      const { id, slug, title } = row;
      
      // Extract category from the slug
      let category = 'other';
      
      if (slug.startsWith('vendors-')) {
        const parts = slug.split('-');
        if (parts.length >= 2) {
          if (COMPOUND_CATEGORIES.includes(`${parts[1]}-${parts[2]}`)) {
            category = `${parts[1]}-${parts[2]}`;
          } else {
            category = parts[1];
          }
        }
      }
      
      // Check if the slug needs repair
      if (needsSlugRepair(slug)) {
        // Fix the slug
        const newSlug = repairVendorSlug(slug, category);
        
        console.log(`Fixing slug: "${slug}" -> "${newSlug}" (ID: ${id}, Title: ${title})`);
        
        // Update the database
        await client.query(`
          UPDATE page_content SET slug = $1 WHERE id = $2
        `, [newSlug, id]);
        
        fixedCount++;
      } else {
        alreadyCorrectCount++;
      }
    }
    
    console.log(`
Vendor Slug Fix Summary:
-----------------------
Total vendor pages:  ${result.rowCount}
Pages already correct: ${alreadyCorrectCount}
Pages fixed:         ${fixedCount}
    `);
    
  } catch (err) {
    console.error('Error scanning and fixing vendor slugs:', err);
  } finally {
    client.release();
  }
}

// Run the script
scanAndFixVendorSlugs()
  .then(() => {
    console.log('Vendor slug fix script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error running vendor slug fix script:', err);
    process.exit(1);
  });