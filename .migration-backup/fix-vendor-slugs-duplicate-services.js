/**
 * Script to fix vendor page slugs that have duplicate "services" prefixes
 * 
 * This script identifies vendor pages where the slug incorrectly contains duplicated
 * "services-" prefixes like "vendors-home-services-services-company-name" and corrects them
 * to the proper format "vendors-home-services-company-name".
 * 
 * This script also fixes URLs where the pattern is vendors-home/services-company-name
 * to the correct format vendors-home-services-company-name.
 * 
 * Usage:
 * node fix-vendor-slugs-duplicate-services.js
 */

import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;

// Load environment variables from .env file
dotenv.config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixVendorSlugs() {
  const client = await pool.connect();
  
  try {
    console.log("Starting vendor slug cleanup...");
    
    // Fetch all vendor pages
    const { rows: vendorPages } = await client.query(`
      SELECT id, slug, title 
      FROM page_contents 
      WHERE slug LIKE 'vendors-%'
    `);
    
    console.log(`Found ${vendorPages.length} vendor pages to check`);
    
    // Check each vendor page for problems
    const pagesToFix = [];
    
    for (const page of vendorPages) {
      const parts = page.slug.split('-');
      
      // Ensure it's a vendor page with enough parts to analyze
      if (parts.length < 3 || parts[0] !== 'vendors') {
        continue;
      }
      
      // 1. Check for duplicated "services" parts
      const servicesCount = parts.filter(part => part === 'services').length;
      
      // 2. Check for special compound category cases (e.g., "home-services")
      const potentialCompoundCategory = `${parts[1]}-${parts[2]}`;
      const isCompoundCategory = [
        'home-services', 
        'food-dining', 
        'health-wellness', 
        'professional-services',
        'real-estate',
        'anchor-vapor'
      ].includes(potentialCompoundCategory);
      
      // 3. Determine if we need to fix this slug
      let needsFix = false;
      let fixType = '';
      let correctedSlug = '';
      
      // Case 1: Multiple "services" segments (most common issue)
      if (servicesCount > 1 || page.slug.includes('-services-services-')) {
        needsFix = true;
        fixType = 'duplicate-services';
        
        // Extract category and vendor name parts
        const categoryPart = isCompoundCategory ? 
          parts.slice(1, 3).join('-') : parts[1];
        
        // Get vendor name, removing any duplicated services prefixes
        let vendorNamePart = isCompoundCategory ?
          parts.slice(3).join('-') : parts.slice(2).join('-');
          
        if (vendorNamePart.startsWith('services-')) {
          vendorNamePart = vendorNamePart.substring('services-'.length);
        }
        
        // Build corrected slug
        correctedSlug = isCompoundCategory ?
          `vendors-${categoryPart}-${vendorNamePart}` :
          `vendors-${categoryPart}-${vendorNamePart}`;
      }
      // Case 2: Compound category issues
      else if (parts.length >= 4 && 
              ['home', 'food', 'health', 'professional', 'real'].includes(parts[1]) &&
              parts[3] === 'services') {
        needsFix = true;
        fixType = 'compound-category';
        
        // This is likely a case where a compound category was split incorrectly
        // e.g. vendors-home/services-company instead of vendors-home-services-company
        const categoryWord = parts[1];
        const compoundCategory = categoryWord === 'home' ? 'home-services' :
                                categoryWord === 'food' ? 'food-dining' :
                                categoryWord === 'health' ? 'health-wellness' :
                                categoryWord === 'professional' ? 'professional-services' :
                                categoryWord === 'real' ? 'real-estate' : `${categoryWord}-services`;
        
        // Extract everything after the services part
        const vendorNamePart = parts.slice(4).join('-');
        
        // Build the corrected slug
        correctedSlug = `vendors-${compoundCategory}-${vendorNamePart}`;
      }
      
      // If this page needs fixing, add it to the list
      if (needsFix) {
        pagesToFix.push({
          id: page.id,
          oldSlug: page.slug,
          newSlug: correctedSlug,
          title: page.title,
          fixType
        });
        
        console.log(`Found page to fix (${fixType}): "${page.slug}" → "${correctedSlug}" (${page.title})`);
      }
    }
    
    console.log(`Found ${pagesToFix.length} pages with slug issues to fix`);
    
    // Fix each problematic page
    const updatePromises = pagesToFix.map(async page => {
      console.log(`Fixing: "${page.oldSlug}" → "${page.newSlug}"`);
      
      // Update the database
      const result = await client.query(`
        UPDATE page_contents 
        SET slug = $1 
        WHERE id = $2
      `, [page.newSlug, page.id]);
      
      return {
        ...page,
        success: result.rowCount === 1
      };
    });
    
    // Execute all updates
    const results = await Promise.all(updatePromises);
    
    // Report on the results
    const successCount = results.filter(r => r.success).length;
    console.log(`\nSuccessfully updated ${successCount} of ${pagesToFix.length} pages:`);
    
    results.forEach(result => {
      console.log(`${result.success ? '✅' : '❌'} [${result.id}] "${result.title}" (${result.fixType})`);
      console.log(`   ${result.oldSlug} → ${result.newSlug}`);
    });
    
    console.log("\nVendor slug cleanup completed!");
    
  } catch (error) {
    console.error("Error fixing vendor slugs:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Execute the function
fixVendorSlugs().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});