/**
 * Fix Vendor URL Slug Format
 * 
 * This script repairs all vendor page slugs in the database to ensure
 * they follow the consistent format: vendors-[category]-[unique-identifier]
 * 
 * It will:
 * 1. Fetch all pages with slugs starting with 'vendors-'
 * 2. Extract the title and category from each page
 * 3. Generate a properly formatted slug using the improved vendor-url-converter
 * 4. Update the database with the corrected slugs
 * 
 * Usage:
 * node fix-vendor-slugs.js
 */

// Use ES modules format as required by the project
import { Pool, neonConfig } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import ws from 'ws';

// Configure neon to use WebSockets
neonConfig.webSocketConstructor = ws;

// Load environment variables
dotenv.config();

// Import the vendor URL utilities
// Define them directly here since importing from the TypeScript file would be complex
function generateVendorSlug(title, category) {
  if (!title || !category) return '';
  
  // Format the category slug - handle special characters and convert to kebab-case
  const categorySlug = category.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  // Format the title slug similarly
  const titleSlug = title.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  // Create the full slug with proper format: vendors-category-title
  // This format is essential for consistent display in both database and URLs
  return `vendors-${categorySlug}-${titleSlug}`;
}

// Check for required environment variable
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

// Database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Utilities for extracting category from slug
function getCategoryFromSlug(slug) {
  if (!slug || !slug.startsWith('vendors-')) return '';
  
  // Remove 'vendors-' prefix and split by hyphen
  const parts = slug.substring(8).split('-');
  
  // The first part after 'vendors-' is the category
  return parts[0] || '';
}

// Helper to extract compound categories (e.g., "technology-and-electronics")
function extractCompoundCategory(slug) {
  if (!slug || !slug.startsWith('vendors-')) return '';
  
  const withoutPrefix = slug.substring(8); // Remove "vendors-"
  
  // Check for common compound categories
  const compoundCategories = [
    'home-services', 
    'food-dining', 
    'health-wellness', 
    'professional-services',
    'real-estate',
    'technology-electronics',
    'technology-and-electronics', // Add both formats to handle existing data
    'retail-shops'
  ];
  
  for (const compound of compoundCategories) {
    if (withoutPrefix.startsWith(`${compound}-`)) {
      return compound;
    }
  }
  
  // If no exact match is found, check for partial matches that should be corrected
  if (withoutPrefix.startsWith('technology-')) {
    // Special case for technology/electronics which might be split incorrectly
    return 'technology-and-electronics';
  }
  
  // Get the content from the database too
  const parts = withoutPrefix.split('-');
  if (parts.length >= 1) {
    // Attempt to map the category to a standardized form
    const categoryWord = parts[0].toLowerCase();
    
    // Map standard categories
    const categoryMap = {
      'food': 'food-dining',
      'home': 'home-services',
      'health': 'health-wellness',
      'professional': 'professional-services',
      'tech': 'technology-and-electronics',
      'technology': 'technology-and-electronics',
      'retail': 'retail-shops',
      'real': 'real-estate'
    };
    
    if (categoryMap[categoryWord]) {
      return categoryMap[categoryWord];
    }
  }
  
  // If no compound category is found, just return the first segment
  return withoutPrefix.split('-')[0] || '';
}

async function fixVendorSlugs() {
  console.log('Starting vendor slug repair process...');
  
  try {
    // Get all vendor category names for proper mapping
    const { rows: categories } = await pool.query("SELECT id, name FROM vendor_categories");
    
    // Create a map for lookup
    const categoryMap = {};
    
    // Special case mappings for common categories with different formats
    const specialCases = {
      'home-improvement': 'Home Services',
      'home': 'Home Services',
      'hvac-and-air-quality': 'HVAC and Air Quality',
      'hvac': 'HVAC and Air Quality',
      'anchor-and-vapor-barrier': 'Anchor and Vapor Barrier',
      'anchor': 'Anchor and Vapor Barrier',
      'real-estate-senior-living': 'Real Estate & Senior Living',
      'real-estate': 'Real Estate & Senior Living',
      'health-and-medical': 'Health and Medical',
      'health-wellness': 'Health and Medical',
      'funeral-and-religious-services': 'Funeral and Religious Services',
      'funeral': 'Funeral and Religious Services',
      'moving-and-transportation': 'Moving and Transportation',
      'moving': 'Moving and Transportation',
      'new-homes-installation': 'New Homes - Installation',
      'automotive-golf-carts': 'Automotive - Golf Carts',
      'automotive': 'Automotive - Golf Carts',
      'retail-shops': 'Retail & Shops',
      'retail': 'Retail & Shops',
      'technology-electronics': 'Technology & Electronics',
      'technology-and-electronics': 'Technology & Electronics',
      'technology': 'Technology & Electronics',
      'pressure-washing': 'Pressure Washing',
      'pressure': 'Pressure Washing',
      'beauty-personal-care': 'Beauty - Personal Care',
      'beauty': 'Beauty - Personal Care',
      'food-dining': 'Food & Dining'
    };
    
    // Add all vendor categories from database
    for (const category of categories) {
      // Convert category name to slug format for matching
      const categorySlug = category.name.toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      
      categoryMap[categorySlug] = category.name;
    }
    
    // Add special cases to the category map
    for (const [slug, name] of Object.entries(specialCases)) {
      categoryMap[slug] = name;
    }
    
    console.log(`Loaded ${Object.keys(categoryMap).length} vendor categories.`);
    
    // Fetch all vendor pages from the database
    const { rows: vendorPages } = await pool.query(
      "SELECT id, title, slug FROM page_contents WHERE slug LIKE 'vendors-%'"
    );
    
    console.log(`Found ${vendorPages.length} vendor pages to process.`);
    
    // Counter for tracking changes
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process each vendor page
    for (const page of vendorPages) {
      const { id, title, slug } = page;
      
      // Extract category slug from the vendor URL slug
      const extractedCategorySlug = extractCompoundCategory(slug);
      
      if (!extractedCategorySlug) {
        console.warn(`⚠️ Could not extract category from slug: ${slug}`);
        skippedCount++;
        continue;
      }
      
      // Find the proper category name from our map
      const categoryName = categoryMap[extractedCategorySlug] || 
        // Try alternate formats
        categoryMap[extractedCategorySlug.replace(/-/g, '')] ||
        categoryMap[extractedCategorySlug.replace('-and-', '')] || 
        // Fallback to extracted slug
        extractedCategorySlug;
      
      // Trim the title to remove any trailing/leading spaces
      const trimmedTitle = title.trim();
      
      // Generate a proper slug using our improved utility
      const correctedSlug = generateVendorSlug(trimmedTitle, categoryName);
      
      // Only update if the slug needs to be changed
      if (slug !== correctedSlug) {
        try {
          console.log(`Updating vendor slug for "${title}" (ID: ${id}):`);
          console.log(`  Old: ${slug}`);
          console.log(`  New: ${correctedSlug}`);
          console.log(`  Category: ${categoryName}`);
          
          // Update the database with the corrected slug
          await pool.query(
            'UPDATE page_contents SET slug = $1 WHERE id = $2',
            [correctedSlug, id]
          );
          
          updatedCount++;
        } catch (err) {
          console.error(`❌ Error updating slug for page ID ${id}:`, err);
          errorCount++;
        }
      } else {
        console.log(`✓ Slug for "${title}" is already in the correct format.`);
        skippedCount++;
      }
    }
    
    // Print summary
    console.log('\nSlug repair completed:');
    console.log(`- Total vendor pages: ${vendorPages.length}`);
    console.log(`- Updated: ${updatedCount}`);
    console.log(`- Already correct: ${skippedCount}`);
    console.log(`- Errors: ${errorCount}`);
    
  } catch (err) {
    console.error('Error fetching vendor pages:', err);
  } finally {
    console.log('Closing database connection...');
    await pool.end();
  }
}

// Run the script
fixVendorSlugs().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});