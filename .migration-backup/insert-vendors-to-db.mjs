/**
 * Insert predefined vendor listings into the database
 * This script inserts the vendors we've created into the page_contents table
 * 
 * Usage:
 * node insert-vendors-to-db.mjs [--category category-slug]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pkg from 'pg';
const { Pool } = pkg;

// Get the directory name properly in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection config (uses DATABASE_URL from environment)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Insert vendors from JSON files into the database
 * @param {string} categorySlug - Optional category slug to only process that category
 */
async function insertVendorsToDatabase(categorySlug = null) {
  console.log("Starting database insertion...");
  
  try {
    // Path to the predefined vendors directory
    const vendorsDir = path.join(__dirname, 'predefined-vendors');
    let insertCount = 0;
    
    // Determine which JSON files to process
    let jsonFiles;
    if (categorySlug) {
      // Process only the specified category
      const categoryFile = `${categorySlug}-vendors.json`;
      if (fs.existsSync(path.join(vendorsDir, categoryFile))) {
        jsonFiles = [categoryFile];
        console.log(`Processing only ${categorySlug} category`);
      } else {
        console.error(`Category file ${categoryFile} not found`);
        return;
      }
    } else {
      // Process all category files (excluding all-vendors.json)
      jsonFiles = fs.readdirSync(vendorsDir)
        .filter(file => file.endsWith('-vendors.json') && file !== 'all-vendors.json');
      console.log(`Processing all ${jsonFiles.length} vendor categories`);
    }
    
    // Process each JSON file
    for (const jsonFile of jsonFiles) {
      console.log(`Processing ${jsonFile}...`);
      const filePath = path.join(vendorsDir, jsonFile);
      
      // Read and parse the JSON file
      const vendorsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Insert each vendor
      for (const vendor of vendorsData) {
        // First check if this vendor already exists
        const vendorCheckResult = await pool.query(
          `SELECT * FROM page_contents WHERE slug = $1`,
          [vendor.slug]
        );
        
        if (vendorCheckResult.rows.length > 0) {
          console.log(`Vendor ${vendor.title} already exists, skipping.`);
          continue;
        }
        
        console.log(`Creating vendor ${vendor.title} (${vendor.slug})...`);
        
        // Insert vendor
        await pool.query(
          `INSERT INTO page_contents 
           (slug, title, content, media_urls, updated_by, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [
            vendor.slug,
            vendor.title,
            vendor.content,
            [], // No images for now
            6,  // Admin user ID
          ]
        );
        
        insertCount++;
      }
    }
    
    console.log(`Database insertion complete! Added ${insertCount} new vendors.`);
    
  } catch (error) {
    console.error("Error inserting vendors into database:", error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Process command line arguments
const args = process.argv.slice(2);
let categorySlug = null;

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--category' || args[i] === '-c') && i + 1 < args.length) {
    categorySlug = args[i + 1];
    i++; // Skip the next argument since we've used it
  }
}

// Run the insertion process
insertVendorsToDatabase(categorySlug).catch(console.error);