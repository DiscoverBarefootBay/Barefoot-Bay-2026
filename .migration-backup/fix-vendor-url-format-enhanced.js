/**
 * Enhanced Vendor URL Format Fixer
 * 
 * This script performs a more thorough correction of vendor page slugs:
 * - Ensures all slugs follow the format: vendors-[category]-[unique-identifier]
 * - Handles a wide array of special cases and inconsistencies
 * - Removes redundant category names from unique identifiers
 * - Normalizes compound categories like "home-services" and "food-dining"
 * 
 * The script makes database changes but URLs remain consistent thanks to
 * the client-side translation that converts hyphens to slashes in the browser.
 */

import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;

// Load environment variables from .env file
dotenv.config();

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Map of known compound categories and their correct format
const COMPOUND_CATEGORIES = {
  'home-services': 'home-services',
  'food-dining': 'food-dining',
  'health-wellness': 'health-wellness',
  'professional-services': 'professional-services',
  'real-estate': 'real-estate',
  'anchor-vapor': 'anchor-vapor',
  'anchor-vapor-barrier': 'anchor-vapor-barrier',
  'hvac-and': 'hvac-and',
  'health-and': 'health-and',
  'funeral-and': 'funeral-and',
  'moving-and': 'moving-and',
  'insurance-financial': 'insurance-financial',
  'technology-electronics': 'technology-electronics',
  'retail-shops': 'retail-shops'
};

// Known category mappings to fix common issues
const CATEGORY_MAPPINGS = {
  'home-service': 'home-services',
  'services-home': 'home-services',
  'services': 'services',  // generic services
  'service': 'services',
  'anchor-and-vapor-barrier': 'anchor-vapor-barrier',
  'anchor-and-vapor': 'anchor-vapor',
  'retail-shop': 'retail-shops'
};

/**
 * Check if a string represents a compound category or a partial one
 * @param {string} str - String to check
 * @returns {string|null} - The full compound category or null
 */
function detectCompoundCategory(str) {
  // Direct match
  if (COMPOUND_CATEGORIES[str]) {
    return str;
  }
  
  // Check for partial matches (e.g., if only "home" but should be "home-services")
  for (const [fullCategory, _] of Object.entries(COMPOUND_CATEGORIES)) {
    const parts = fullCategory.split('-');
    if (parts.length > 1 && parts[0] === str) {
      return fullCategory;
    }
  }
  
  return null;
}

/**
 * Enhanced vendor slug fixer that handles complex cases
 */
async function fixVendorSlugs() {
  const client = await pool.connect();
  
  try {
    console.log('Starting enhanced vendor slug fix script...');
    
    // Find all vendor slugs
    const findQuery = `
      SELECT id, slug, title 
      FROM page_contents 
      WHERE slug LIKE 'vendors-%'
    `;
    
    const { rows: vendorPages } = await client.query(findQuery);
    console.log(`Found ${vendorPages.length} vendor pages to check.`);
    
    let updatedCount = 0;
    let noChangeCount = 0;
    
    for (const page of vendorPages) {
      const originalSlug = page.slug;
      let correctedSlug = originalSlug;
      
      // Skip if not a vendor page
      if (!originalSlug.startsWith('vendors-')) {
        continue;
      }
      
      // Extract parts from the slug
      const parts = originalSlug.split('-');
      if (parts.length < 3) {
        console.log(`Skipping ${originalSlug} - not enough parts to process`);
        continue;
      }
      
      // Start with "vendors-"
      let newSlugParts = ['vendors'];
      
      // Check for compound categories
      const possibleCompoundCategory = `${parts[1]}-${parts[2]}`;
      const mappedCategory = CATEGORY_MAPPINGS[parts[1]] || null;
      const compoundCategory = COMPOUND_CATEGORIES[possibleCompoundCategory] || null;
      
      if (compoundCategory) {
        // Case 1: It's a known compound category
        newSlugParts.push(compoundCategory);
        
        // Check for redundant category in the vendor name
        let vendorNameParts = parts.slice(3);
        if (vendorNameParts.length > 0 && 
            (vendorNameParts[0] === parts[1] || 
             (compoundCategory === 'home-services' && vendorNameParts[0] === 'home'))) {
          console.log(`Removing redundant category name part from ${originalSlug}`);
          vendorNameParts = vendorNameParts.slice(1);
        }
        
        const vendorName = vendorNameParts.join('-');
        if (vendorName) {
          newSlugParts.push(vendorName);
        } else {
          newSlugParts.push('main'); // Fallback if no vendor name is left
        }
      } 
      // Check for category mapping corrections
      else if (mappedCategory) {
        // Case 2: It's a category that needs mapping correction
        newSlugParts.push(mappedCategory);
        
        // Check for redundant mapped category in vendor name
        let vendorNameParts = parts.slice(2);
        if (vendorNameParts.length > 0 && vendorNameParts[0] === mappedCategory) {
          console.log(`Removing redundant mapped category name from ${originalSlug}`);
          vendorNameParts = vendorNameParts.slice(1);
        }
        
        const vendorName = vendorNameParts.join('-');
        if (vendorName) {
          newSlugParts.push(vendorName);
        } else {
          newSlugParts.push('main'); // Fallback if no vendor name is left
        }
      } 
      // Handle special case for "home-service" that should be "home-services"
      else if (parts[1] === 'home' && parts[2] === 'service') {
        // Case 3: Special fix for home-service -> home-services
        newSlugParts.push('home-services');
        
        // Add the remaining parts as the vendor name
        const vendorName = parts.slice(3).join('-');
        if (vendorName) {
          newSlugParts.push(vendorName);
        } else {
          newSlugParts.push('main'); // Fallback if no vendor name is left
        }
      }
      // Default case - single word category
      else {
        // Case 4: Standard single-word category
        newSlugParts.push(parts[1]);
        
        // Check if the vendor name starts with the category name
        let vendorNameParts = parts.slice(2);
        if (vendorNameParts.length > 0 && vendorNameParts[0] === parts[1]) {
          console.log(`Removing redundant category name "${parts[1]}" from vendor name part in ${originalSlug}`);
          vendorNameParts = vendorNameParts.slice(1);
        }
        
        // Join remaining parts for vendor name
        const vendorName = vendorNameParts.join('-');
        if (vendorName) {
          newSlugParts.push(vendorName);
        } else {
          newSlugParts.push('main'); // Fallback if no vendor name is left
        }
      }
      
      // Build the corrected slug
      correctedSlug = newSlugParts.join('-');
      
      // Update the database if the slug changed
      if (originalSlug !== correctedSlug) {
        console.log(`Fixing: "${originalSlug}" -> "${correctedSlug}"`);
        
        const updateQuery = `
          UPDATE page_contents 
          SET slug = $1
          WHERE id = $2
        `;
        
        await client.query(updateQuery, [correctedSlug, page.id]);
        console.log(`✅ Updated page ID ${page.id}: "${page.title}"`);
        updatedCount++;
      } else {
        noChangeCount++;
      }
    }
    
    console.log(`\nVendor slug fix completed. Updated ${updatedCount} of ${vendorPages.length} vendor pages.`);
    console.log(`${noChangeCount} pages were already in the correct format.`);
  } catch (error) {
    console.error('Error fixing vendor slugs:', error);
  } finally {
    client.release();
  }
}

// Run the enhanced fix
fixVendorSlugs().then(() => {
  console.log('Script completed, connection pool ending.');
  pool.end();
}).catch(err => {
  console.error('Script failed:', err);
  pool.end();
  process.exit(1);
});