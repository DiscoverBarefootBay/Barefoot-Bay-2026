/**
 * Fix Vendor URL Formats
 * 
 * This script corrects vendor page slugs to use the proper format:
 * vendors-[category]-[unique-identifier]
 * 
 * It addresses specific issues like:
 * - Fixing "vendors-home-service-dan-hess-antiques-estate-sales" to "vendors-home-services-dan-hess-antiques-estate-sales"
 * - Ensuring consistent category names
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

// Known category mappings
const CATEGORY_MAPPINGS = {
  'home-service': 'home-services',
  'home-services': 'home-services',
  'anchor-and-vapor-barrier': 'anchor-vapor-barrier',
  'anchor-and-vapor': 'anchor-vapor',
};

const COMPOUND_CATEGORIES = [
  'home-services',
  'food-dining',
  'health-wellness',
  'professional-services',
  'real-estate',
  'anchor-vapor',
  'anchor-vapor-barrier',
  'hvac-and',
  'health-and',
  'funeral-and',
  'moving-and',
  'insurance-financial',
  'technology-electronics',
  'retail-shops'
];

/**
 * Fix vendor slugs to use the proper format
 */
async function fixVendorSlugs() {
  const client = await pool.connect();
  
  try {
    console.log('Starting vendor slug fix script...');
    
    // Find all vendor slugs
    const findQuery = `
      SELECT id, slug, title 
      FROM page_contents 
      WHERE slug LIKE 'vendors-%'
    `;
    
    const { rows: vendorPages } = await client.query(findQuery);
    console.log(`Found ${vendorPages.length} vendor pages to check.`);
    
    let updatedCount = 0;
    
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
      const isCompoundCategory = COMPOUND_CATEGORIES.includes(possibleCompoundCategory);
      
      if (isCompoundCategory) {
        // Add the compound category
        newSlugParts.push(possibleCompoundCategory);
        // Add the remaining parts as the vendor name
        newSlugParts.push(parts.slice(3).join('-'));
      } 
      // Check for known category mapping issues
      else if (CATEGORY_MAPPINGS[parts[1]]) {
        // Use the correct category mapping
        newSlugParts.push(CATEGORY_MAPPINGS[parts[1]]);
        // Add the remaining parts as the vendor name
        newSlugParts.push(parts.slice(2).join('-'));
      } 
      // Handle special case for "service" that should be "services"
      else if (parts[1] === 'home' && parts[2] === 'service') {
        newSlugParts.push('home-services');
        // Add the remaining parts as the vendor name
        newSlugParts.push(parts.slice(3).join('-'));
      }
      // Default case - single word category
      else {
        // Add the category
        newSlugParts.push(parts[1]);
        
        // Check if the vendor name starts with the category name
        let vendorNameParts = parts.slice(2);
        if (vendorNameParts.length > 0 && vendorNameParts[0] === parts[1]) {
          // Remove the redundant category name from the vendor name
          console.log(`Removing redundant category name "${parts[1]}" from vendor name part`);
          vendorNameParts = vendorNameParts.slice(1);
        }
        
        // Add the remaining parts as the vendor name
        newSlugParts.push(vendorNameParts.join('-'));
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
      }
    }
    
    console.log(`\nVendor slug fix completed. Updated ${updatedCount} of ${vendorPages.length} vendor pages.`);
  } catch (error) {
    console.error('Error fixing vendor slugs:', error);
  } finally {
    client.release();
  }
}

// Run the fix
fixVendorSlugs().then(() => {
  console.log('Script completed, connection pool ending.');
  pool.end();
}).catch(err => {
  console.error('Script failed:', err);
  pool.end();
  process.exit(1);
});