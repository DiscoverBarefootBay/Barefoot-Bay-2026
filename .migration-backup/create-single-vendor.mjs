/**
 * Create and insert a single vendor for a specific category
 * 
 * This script helps create a single vendor entry with a well-formatted structure
 * and inserts it into the database.
 * 
 * Usage:
 * node create-single-vendor.mjs --category <category-slug> --title "Vendor Name"
 * 
 * Options:
 *   --category, -c  The vendor category (food-dining, landscaping, etc.)
 *   --title, -t     The title of the vendor (will be used to generate a slug)
 *   --dry-run       Generate the entry but don't insert into the database
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

// Available vendor categories
const VALID_CATEGORIES = [
  'food-dining',
  'landscaping',
  'home-services',
  'professional-services',
  'retails',
  'automotive',
  'technology',
  'other'
];

/**
 * Generate a slug from a title
 * @param {string} title - The title to convert to a slug
 * @param {string} category - The category slug
 * @returns {string} - The generated slug
 */
function generateSlug(title, category) {
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  return `vendors-${category}-${titleSlug}`;
}

/**
 * Create a vendor entry with content template
 * @param {string} category - The category slug
 * @param {string} title - The vendor title
 * @returns {Object} - Vendor object with title, slug, and content
 */
function createVendorEntry(category, title) {
  const slug = generateSlug(title, category);
  
  // Create a template for the vendor content
  const content = `<h2>${title}</h2>
<div class="vendor-description">
  <p>Welcome to ${title}, a trusted provider in the Barefoot Bay community. We specialize in offering high-quality services tailored to the unique needs of area residents and visitors.</p>
  
  <p>With our commitment to excellence and customer satisfaction, we've built a reputation for reliability and professionalism that makes us a preferred choice in the ${getCategoryName(category)} category.</p>
  
  <h3>Our Services</h3>
  <ul>
    <li>Professional and reliable service options</li>
    <li>Customized solutions for residents</li>
    <li>Competitive pricing with transparent quotes</li>
    <li>Highly trained and experienced staff</li>
    <li>Fast response times and flexible scheduling</li>
    <li>Special discounts for Barefoot Bay residents</li>
  </ul>
  
  <div class="vendor-contact">
    <h3>Contact Information</h3>
    <p><strong>Phone:</strong> (321) 555-0000</p>
    <p><strong>Email:</strong> info@${slug.replace('vendors-', '').replace(/-/g, '')}.com</p>
    <p><strong>Website:</strong> www.${slug.replace('vendors-', '').replace(/-/g, '')}.com</p>
    
    <h3>Hours of Operation</h3>
    <p>Monday - Friday: 9:00 AM - 5:00 PM</p>
    <p>Saturday: 10:00 AM - 2:00 PM</p>
    <p>Sunday: Closed</p>
    
    <h3>Location</h3>
    <p>123 Barefoot Bay Boulevard, Barefoot Bay, FL 32976</p>
    <p>Serving all of Barefoot Bay and surrounding areas</p>
  </div>
</div>`;

  return {
    title,
    slug,
    content
  };
}

/**
 * Get a human-readable category name from a slug
 * @param {string} categorySlug - The category slug
 * @returns {string} - The category name
 */
function getCategoryName(categorySlug) {
  const categoryMap = {
    'food-dining': 'Food & Dining',
    'landscaping': 'Landscaping',
    'home-services': 'Home Services',
    'professional-services': 'Professional Services',
    'retails': 'Retail',
    'automotive': 'Automotive',
    'technology': 'Technology',
    'other': 'Other Services'
  };
  
  return categoryMap[categorySlug] || categorySlug;
}

/**
 * Insert a vendor into the database
 * @param {Object} vendor - The vendor object with title, slug, and content
 * @returns {Promise<boolean>} - True if inserted, false if vendor already exists
 */
async function insertVendorToDatabase(vendor) {
  try {
    // First check if this vendor already exists
    const vendorCheckResult = await pool.query(
      `SELECT * FROM page_contents WHERE slug = $1`,
      [vendor.slug]
    );
    
    if (vendorCheckResult.rows.length > 0) {
      console.log(`Vendor ${vendor.title} already exists, skipping.`);
      return false;
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
    
    console.log(`Successfully created vendor in database!`);
    return true;
    
  } catch (error) {
    console.error("Error inserting vendor into database:", error);
    return false;
  }
}

/**
 * Main function to create and insert a vendor
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let category = null;
  let title = null;
  let dryRun = false;
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--category' || args[i] === '-c') && i + 1 < args.length) {
      category = args[i + 1];
      i++; // Skip the next argument
    } else if ((args[i] === '--title' || args[i] === '-t') && i + 1 < args.length) {
      title = args[i + 1];
      i++; // Skip the next argument
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }
  
  // Validate inputs
  if (!category || !VALID_CATEGORIES.includes(category)) {
    console.error(`Error: Invalid or missing category. Please provide one of: ${VALID_CATEGORIES.join(', ')}`);
    process.exit(1);
  }
  
  if (!title) {
    console.error('Error: Missing vendor title. Please provide a title with --title');
    process.exit(1);
  }
  
  try {
    // Create vendor entry
    const vendor = createVendorEntry(category, title);
    
    console.log('Generated vendor entry:');
    console.log(JSON.stringify(vendor, null, 2));
    
    // Save to file (optional)
    const outputDir = path.join(__dirname, 'generated-vendors');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    const filePath = path.join(outputDir, `${vendor.slug}.json`);
    fs.writeFileSync(filePath, JSON.stringify(vendor, null, 2));
    console.log(`Saved vendor to file: ${filePath}`);
    
    // Insert into database if not a dry run
    if (!dryRun) {
      await insertVendorToDatabase(vendor);
    } else {
      console.log('Dry run mode: Skipping database insertion');
    }
    
  } catch (error) {
    console.error('Error creating vendor:', error);
  } finally {
    // Close the database connection
    if (!dryRun) {
      await pool.end();
    }
  }
}

// Run the main function
main().catch(console.error);