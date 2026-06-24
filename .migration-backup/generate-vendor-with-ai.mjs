/**
 * Generate a vendor listing using Google's Gemini AI
 * This script creates realistic vendor listings for Barefoot Bay community platform
 * 
 * Usage:
 * node generate-vendor-with-ai.mjs --category <category-slug> --title "Vendor Name" [--dry-run]
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
import { GoogleGenerativeAI } from '@google/generative-ai';
import pkg from 'pg';
const { Pool } = pkg;

// Get the directory name properly in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check for Gemini API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY not found in environment variables");
  console.error("Please set GEMINI_API_KEY in your .env file");
  process.exit(1);
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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

// Category descriptions for AI context
const CATEGORY_DESCRIPTIONS = {
  'food-dining': 'Restaurants, cafes, bakeries, food delivery, catering, and specialty food shops that serve Barefoot Bay residents.',
  'landscaping': 'Landscaping companies, lawn care, garden centers, irrigation specialists, and outdoor design services for Florida homes.',
  'home-services': 'Home repair, cleaning services, plumbing, electrical, HVAC, pest control, and general maintenance providers.',
  'professional-services': 'Legal, financial, accounting, insurance, real estate, and consulting services for Barefoot Bay residents.',
  'retails': 'Retail stores, gift shops, clothing, home goods, specialty items, and local merchandise for the community.',
  'automotive': 'Auto repair, car wash, detailing, tire shops, auto parts, and vehicle maintenance services.',
  'technology': 'Computer repair, IT services, smart home installations, internet services, and technology tutoring for seniors.',
  'other': 'Pet services, senior care, travel agencies, health & wellness services, and other specialized businesses.'
};

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
 * Generate vendor content using AI
 * @param {string} categorySlug - The category slug
 * @param {string} title - The vendor title
 * @returns {Promise<string>} - Generated HTML content
 */
async function generateAIContent(categorySlug, title) {
  const categoryName = getCategoryName(categorySlug);
  const categoryDescription = CATEGORY_DESCRIPTIONS[categorySlug] || '';
  
  // Create prompt for AI
  const prompt = `
    Create detailed content for a business listing on the Barefoot Bay community website.

    Business Name: "${title}"
    Category: ${categoryName}
    Category Description: ${categoryDescription}
    Location: Barefoot Bay, Florida (a retirement and vacation community)

    Please create a complete HTML formatted business listing that includes:
    1. A main heading with the business name (<h2>)
    2. A "vendor-description" div containing:
       - Two paragraphs about the business, its history, and its value to the community
       - A section titled "Our Services" or similar with a bullet list of 6-8 services offered
       - A "vendor-contact" div containing:
         * Contact information (phone, email, website)
         * Hours of operation
         * Location/address in Barefoot Bay

    Use realistic details for a business in this category serving seniors and retirees in Florida.
    Create a fictional but realistic phone number in (321) 555-XXXX format, email, and website URL.
    
    Format using proper HTML with appropriate heading tags, paragraphs, lists, and divs.
    Use the classes "vendor-description" and "vendor-contact" as specified above.
    
    Output ONLY the HTML content, no explanations or additional text.
  `;

  try {
    // Generate content with Gemini - use the correct, working API version
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Clean up the response
    return text.trim();
  } catch (error) {
    console.error("Error generating content with AI:", error);
    // Fallback to template
    return createTemplateContent(categorySlug, title);
  }
}

/**
 * Create a fallback template if AI generation fails
 * @param {string} categorySlug - The category slug 
 * @param {string} title - The vendor title
 * @returns {string} - Template HTML content
 */
function createTemplateContent(categorySlug, title) {
  const categoryName = getCategoryName(categorySlug);
  const slug = generateSlug(title, categorySlug);
  
  return `<h2>${title}</h2>
<div class="vendor-description">
  <p>Welcome to ${title}, a trusted provider in the Barefoot Bay community. We specialize in offering high-quality services tailored to the unique needs of area residents and visitors.</p>
  
  <p>With our commitment to excellence and customer satisfaction, we've built a reputation for reliability and professionalism that makes us a preferred choice in the ${categoryName} category.</p>
  
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
 * Clean HTML content to ensure it's well-formatted
 * @param {string} html - Raw HTML content
 * @returns {string} - Cleaned HTML
 */
function cleanHtml(html) {
  // Remove code blocks and markdown formatting that might come from the AI
  let cleaned = html
    .replace(/```html/g, '')
    .replace(/```/g, '')
    .trim();
  
  // If AI didn't wrap content with vendor-description, do it
  if (!cleaned.includes('vendor-description')) {
    cleaned = `<div class="vendor-description">${cleaned}</div>`;
  }
  
  return cleaned;
}

/**
 * Main function to generate and insert a vendor
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
    console.log(`Generating vendor content for "${title}" in category "${category}"...`);
    
    // Generate slug
    const slug = generateSlug(title, category);
    
    // Generate content with AI
    const content = await generateAIContent(category, title);
    const cleanedContent = cleanHtml(content);
    
    // Create vendor object
    const vendor = {
      title,
      slug,
      content: cleanedContent
    };
    
    console.log('Generated vendor entry:');
    console.log(JSON.stringify({
      title: vendor.title,
      slug: vendor.slug,
      contentPreview: vendor.content.substring(0, 100) + '...'
    }, null, 2));
    
    // Save to file
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