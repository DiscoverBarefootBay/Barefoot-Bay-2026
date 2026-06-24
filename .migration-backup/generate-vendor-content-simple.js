/**
 * Generate realistic vendor content for Barefoot Bay community platform using Google's Gemini AI
 * This simplified version doesn't interact with the database - it just generates JSON files
 * 
 * This script creates detailed listings for the different vendor categories including:
 * - Food & Dining
 * - Landscaping
 * - Home Services
 * - Professional Services
 * - Retails
 * - Automotive
 * - Technology
 * - Other
 * 
 * Output follows the correct slug format: vendors-[category]-[vendor-name]
 * 
 * Usage:
 * node generate-vendor-content-simple.js
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Define vendor categories from admin panel
const VENDOR_CATEGORIES = [
  {
    slug: "food-dining",
    name: "Food & Dining",
    description: "Restaurants, cafes, catering services, and food-related businesses in Barefoot Bay"
  },
  {
    slug: "landscaping",
    name: "Landscaping",
    description: "Lawn care, gardening, irrigation, and outdoor maintenance services"
  },
  {
    slug: "home-services",
    name: "Home Services",
    description: "Home repair, cleaning, maintenance, and improvement services"
  },
  {
    slug: "professional-services",
    name: "Professional Services",
    description: "Legal, financial, consulting, and other professional services"
  },
  {
    slug: "retails",
    name: "Retails",
    description: "Local retail shops, boutiques, and specialty stores serving the community"
  },
  {
    slug: "automotive",
    name: "Automotive",
    description: "Car repair, maintenance, detailing, and automotive services"
  },
  {
    slug: "technology",
    name: "Technology",
    description: "Computer repair, IT services, tech support, and electronics"
  },
  {
    slug: "other",
    name: "Other",
    description: "Miscellaneous services and businesses for the Barefoot Bay community"
  }
];

/**
 * Generate vendor listings for a specific category using Gemini AI
 * @param {Object} category - Category object with name, slug, and description
 * @returns {Promise<Array>} - Array of vendor objects with title, slug, and content
 */
async function generateVendorListings(category) {
  console.log(`Generating vendors for category: ${category.name}...`);
  
  try {
    // Create a model instance
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // Build a detailed prompt for the AI
    const prompt = `
    Create 3 realistic vendor listings for the "${category.name}" category in the Barefoot Bay community in Florida.
    
    Context:
    - Barefoot Bay is a 55+ retirement community in Florida with approximately 10,000 residents
    - These are local businesses that serve the Barefoot Bay community
    - Each vendor should have a unique name that sounds like a real local business
    - Include complete content with a business description, services offered, contact information (with realistic Florida phone numbers and email addresses), hours of operation, and location
    
    For each vendor, provide:
    1. Business name
    2. Detailed HTML content with:
       - A main heading with the business name
       - Business description (2-3 paragraphs)
       - Services offered (as a bulleted list)
       - Contact information (phone, email, website)
       - Hours of operation
       - Location (use a realistic address in/near Barefoot Bay, FL)
    
    Format each vendor's information with proper HTML tags. Include <h2>, <h3>, <p>, <ul>, <li> tags, and <div> elements with appropriate class names.
    
    Return the response as a JSON array with 3 objects, each containing 'title' and 'content' properties.
    The output should be directly parseable as a JavaScript array.
    `;
    
    // Generate content with Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON array from the response
    let vendorsData;
    try {
      // Try to parse the response as JSON directly
      vendorsData = JSON.parse(text);
    } catch (error) {
      // If direct parsing fails, try to extract JSON from the text
      const jsonMatch = text.match(/\[\s*{[\s\S]*}\s*\]/);
      if (jsonMatch) {
        try {
          vendorsData = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error("Failed to parse extracted JSON:", e);
          return [];
        }
      } else {
        console.error("Could not extract JSON from Gemini response");
        return [];
      }
    }
    
    // Validate and process the vendors data
    if (!Array.isArray(vendorsData)) {
      console.error("Gemini did not return an array of vendors");
      return [];
    }
    
    // Format the vendors with proper slugs
    const formattedVendors = vendorsData.map(vendor => {
      // Generate slug from title
      const baseSlug = vendor.title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')  // Remove special characters
        .replace(/\s+/g, '-')      // Replace spaces with hyphens
        .trim();
      
      const vendorSlug = `vendors-${category.slug}-${baseSlug}`;
      
      return {
        title: vendor.title,
        slug: vendorSlug,
        content: vendor.content
      };
    });
    
    console.log(`Successfully generated ${formattedVendors.length} vendors for ${category.name}`);
    return formattedVendors;
    
  } catch (error) {
    console.error(`Error generating vendors for ${category.name}:`, error);
    return [];
  }
}

/**
 * Main function to generate vendor content for all categories
 */
async function generateVendorContent() {
  console.log("Starting vendor content generation...");
  
  try {
    // Create output directory
    const outputDir = path.join(__dirname, 'generated-vendors');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    // Track all generated vendors
    const allVendors = [];
    
    // Generate vendors for each category
    for (const category of VENDOR_CATEGORIES) {
      const vendors = await generateVendorListings(category);
      
      if (vendors.length > 0) {
        // Save category vendors to a file
        const categoryFile = path.join(outputDir, `${category.slug}-vendors.json`);
        fs.writeFileSync(categoryFile, JSON.stringify(vendors, null, 2));
        
        // Add to all vendors
        allVendors.push(...vendors);
      }
    }
    
    // Save all vendors to a single file
    const allVendorsFile = path.join(outputDir, 'all-vendors.json');
    fs.writeFileSync(allVendorsFile, JSON.stringify(allVendors, null, 2));
    
    console.log(`Vendor content generation complete! Created ${allVendors.length} vendors across ${VENDOR_CATEGORIES.length} categories.`);
    console.log(`Output saved to: ${outputDir}`);
    
  } catch (error) {
    console.error("Error generating vendor content:", error);
  }
}

// Execute the main function
generateVendorContent().catch(console.error);