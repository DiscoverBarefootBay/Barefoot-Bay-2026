/**
 * Generate realistic vendor content for Barefoot Bay community platform using Google's Gemini AI
 * 
 * This script uses Google's Generative AI (Gemini) to generate vendor listings
 * based on the Barefoot Bay community profile and services categories.
 * 
 * Features:
 * - Generates realistic vendor listings for different categories
 * - Includes appropriate imagery for each vendor category
 * - Formats content with proper HTML and structure
 * 
 * Usage:
 * node ai-generate-vendor-content.js
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { format } from 'date-fns';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Load environment variables
dotenv.config();

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Use the GEMINI_API_KEY or VITE_GEMINI_API_KEY for Gemini API (configured in .env file)
const googleApiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!googleApiKey) {
  console.error("No Gemini API key found. Please set GEMINI_API_KEY or VITE_GEMINI_API_KEY in your environment.");
  process.exit(1);
}

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(googleApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

// Define vendor categories
const VENDOR_CATEGORIES = [
  {
    slug: "home-services",
    name: "Home Services",
    description: "Cleaning, maintenance, and general home services"
  },
  {
    slug: "landscaping",
    name: "Landscaping",
    description: "Lawn care, gardening, and outdoor maintenance"
  },
  {
    slug: "contractors",
    name: "Contractors",
    description: "Building, remodeling, and construction services"
  },
  {
    slug: "plumbing",
    name: "Plumbing",
    description: "Plumbing services, repairs, and installations"
  },
  {
    slug: "electrical",
    name: "Electrical",
    description: "Electrical services and repairs"
  },
  {
    slug: "hvac",
    name: "HVAC",
    description: "Heating, ventilation, and air conditioning services"
  }
];

// Community context for Barefoot Bay
const COMMUNITY_CONTEXT = `
Barefoot Bay is a residential community located in Brevard County, Florida, near Sebastian. 
It's primarily a retirement and vacation community with many amenities including:
- Community pool and recreation center
- Golf courses
- Tennis and pickleball courts
- Walking trails
- Community events and activities
- Close to beaches, fishing, and water activities

Residents are typically aged 55+, though there are some younger families. 
The community is known for its friendly atmosphere, active lifestyle options, and natural Florida beauty.

The community is located in a tropical climate zone with hot, humid summers and mild winters.
Many residents are concerned about proper home maintenance in this climate and dealing with issues
like humidity, mold prevention, hurricane preparedness, and proper landscaping for the Florida environment.
`;

// Generate vendor listings for a specific category using AI
async function generateVendorListings(category) {
  console.log(`Generating AI vendor listings for ${category.name}...`);
  
  try {
    if (googleApiKey) {
      const prompt = `
You are creating realistic vendor listings for the Barefoot Bay community platform in Florida.
Generate 5 realistic vendor business listings for the "${category.name}" category. 
The description of this category is: "${category.description}".

${COMMUNITY_CONTEXT}

For each vendor, include:
1. Business name (that would realistically serve this area)
2. Detailed business description with services offered (200-300 words)
3. Years in business (most businesses should be established 5-20+ years ago)
4. Service area (which should include Barefoot Bay and nearby communities)
5. Contact information (realistic Florida phone numbers in format (XXX) XXX-XXXX, email, website)
6. Any specialties or certifications relevant to their industry
7. Hours of operation

Format each vendor as a well-structured HTML content block that includes:
- A professional heading with the business name
- Well-organized sections with proper HTML tags
- Contact information in a neatly formatted section
- A "Why Choose Us" section highlighting key selling points

IMPORTANT: Make the listings very realistic for businesses that would serve this Florida retirement community.
Don't include generic placeholders. Each listing should feel like a real, established business in the area.
`;
      
      // Use Google SDK to call Gemini API
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Simple parser to extract business listings from AI response
      const businessHtmlBlocks = responseText.split(/(?=<h1>|<h2>)/).filter(block => block.trim());
      console.log(`Generated ${businessHtmlBlocks.length} vendor listings`);
      
      // Process and format each business block
      return businessHtmlBlocks.map(htmlBlock => {
        // Try to extract a title from the HTML
        let title = "";
        const titleMatch = htmlBlock.match(/<h[12][^>]*>(.*?)<\/h[12]>/i);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
        } else {
          // If no h1/h2 found, try to get the first line
          title = htmlBlock.split('\n')[0].replace(/<[^>]*>/g, '').trim();
        }
        
        if (!title) {
          // Fallback title if nothing else works
          title = `${category.name} Vendor ${Math.floor(Math.random() * 1000)}`;
        }
        
        // Generate slug from title
        const slug = title.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
          .trim();
        
        // Clean up any HTML errors or formatting issues
        const content = cleanHtml(htmlBlock);
        
        return {
          title,
          slug: `vendors-${category.slug}-${slug}`,
          content,
          category: category.slug
        };
      });
    } else {
      console.log("No Google AI API key available. Using fallback content.");
      return getFallbackContent(category);
    }
  } catch (error) {
    console.error(`Error generating content for ${category.name}:`, error);
    return getFallbackContent(category);
  }
}

/**
 * Download an image for a vendor category from Unsplash
 * @param {string} category - Vendor category slug
 * @returns {Promise<string|null>} - URL to the image or null if download failed
 */
async function downloadCategoryImage(category) {
  try {
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Create vendors subdirectory if it doesn't exist
    const vendorsDir = path.join(uploadsDir, 'vendors');
    if (!fs.existsSync(vendorsDir)) {
      fs.mkdirSync(vendorsDir, { recursive: true });
    }
    
    // Create search term based on category
    let searchTerm = '';
    switch(category.slug) {
      case 'home-services':
        searchTerm = 'home cleaning service florida';
        break;
      case 'landscaping':
        searchTerm = 'florida landscaping garden';
        break;
      case 'contractors':
        searchTerm = 'home contractor renovation florida';
        break;
      case 'plumbing':
        searchTerm = 'plumbing service professional';
        break;
      case 'electrical':
        searchTerm = 'electrician service professional';
        break;
      case 'hvac':
        searchTerm = 'air conditioning service florida';
        break;
      default:
        searchTerm = 'florida professional service';
    }
    
    // Use Unsplash source for random category-related image
    const imageUrl = `https://source.unsplash.com/featured/?${encodeURIComponent(searchTerm)}`;
    
    // Generate a unique filename
    const timestamp = Date.now();
    const randomHash = crypto.createHash('md5').update(category.slug + timestamp).digest('hex').substring(0, 8);
    const filename = `vendor-${category.slug}-${timestamp}-${randomHash}.jpg`;
    const filepath = path.join(vendorsDir, filename);
    
    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    // Save the image to disk
    const buffer = await response.buffer();
    fs.writeFileSync(filepath, buffer);
    console.log(`Downloaded image for ${category.name} to ${filepath}`);
    
    // Return the URL to the saved image
    return `/uploads/vendors/${filename}`;
  } catch (error) {
    console.error(`Error downloading image for category ${category.name}:`, error);
    return null;
  }
}

// Simple HTML cleaner
function cleanHtml(html) {
  // Add any HTML cleaning/fixing logic here if needed
  return html;
}

// Fallback content if AI generation fails
function getFallbackContent(category) {
  console.log(`Using fallback content for ${category.name}`);
  
  // Generate more detailed fallback content that mimics what the AI would have generated
  let businesses = [];
  
  // First business
  const business1 = {
    title: `Treasure Coast ${category.name}`,
    slug: `vendors-${category.slug}-treasure-coast-${category.slug.replace(/-/g, '')}`,
    content: `<h2>Treasure Coast ${category.name}</h2>
      <div class="vendor-description">
        <p>Serving Barefoot Bay and the Treasure Coast area since 1997, we provide high-quality ${category.description.toLowerCase()} with attention to detail and customer satisfaction as our top priorities.</p>
        
        <p>As a family-owned business with over 20 years of experience, we understand the unique needs of Florida homeowners, especially in retirement communities like Barefoot Bay. Our team is fully licensed, insured, and certified to provide reliable services that meet and exceed your expectations.</p>
        
        <h3>Our Services</h3>
        <ul>
          <li>Comprehensive ${category.description.toLowerCase()}</li>
          <li>Emergency services available</li>
          <li>Free estimates and consultations</li>
          <li>Senior citizen discounts</li>
          <li>Warranty on all work performed</li>
        </ul>
        
        <h3>Why Choose Us</h3>
        <p>With our decades of experience serving the Barefoot Bay area, we've built a reputation for reliability, quality, and fair pricing. Our technicians are fully trained, background-checked, and committed to providing exceptional service on every job. We understand the unique challenges of Florida's climate and how it affects your home, allowing us to provide tailored solutions that last.</p>
      </div>
      
      <div class="vendor-contact">
        <h3>Contact Information</h3>
        <p><strong>Phone:</strong> (772) 555-1234</p>
        <p><strong>Email:</strong> info@treasurecoast${category.slug.replace(/-/g, '')}.com</p>
        <p><strong>Website:</strong> www.treasurecoast${category.slug.replace(/-/g, '')}.com</p>
        
        <h3>Hours of Operation</h3>
        <p>Monday - Friday: 8:00 AM - 5:00 PM</p>
        <p>Saturday: 9:00 AM - 2:00 PM</p>
        <p>Sunday: Closed</p>
        <p>Emergency services available 24/7</p>
        
        <h3>Service Area</h3>
        <p>Barefoot Bay, Sebastian, Vero Beach, Melbourne, and surrounding Brevard and Indian River County areas.</p>
      </div>`,
    category: category.slug
  };
  
  // Second business
  const business2 = {
    title: `Barefoot Bay ${category.name} Specialists`,
    slug: `vendors-${category.slug}-barefoot-bay-${category.slug.replace(/-/g, '')}-specialists`,
    content: `<h2>Barefoot Bay ${category.name} Specialists</h2>
      <div class="vendor-description">
        <p>For over 15 years, Barefoot Bay ${category.name} Specialists has been the trusted provider of ${category.description.toLowerCase()} for the Barefoot Bay community and beyond.</p>
        
        <p>Founded by long-time Barefoot Bay residents, our company understands the specific needs of the community and provides customized solutions that address the unique challenges of Florida's climate and environment. Whether you need routine maintenance or emergency services, our team of professionals is just a phone call away.</p>
        
        <h3>Our Services</h3>
        <ul>
          <li>Comprehensive ${category.name.toLowerCase()} solutions</li>
          <li>Personalized service plans</li>
          <li>Preventative maintenance programs</li>
          <li>24/7 emergency response</li>
          <li>Free estimates and consultations</li>
        </ul>
        
        <h3>Why Choose Us</h3>
        <p>As Barefoot Bay residents ourselves, we take pride in serving our neighbors with integrity and professionalism. Our deep knowledge of the local area and its specific challenges allows us to provide tailored solutions that perfectly meet your needs. We're fully licensed, insured, and dedicated to delivering exceptional service on every job, large or small.</p>
        
        <p>Our technicians undergo continuous training to stay updated with the latest industry developments, ensuring you receive the most efficient and effective service possible. We've built our reputation on reliability, quality workmanship, and fair pricing.</p>
      </div>
      
      <div class="vendor-contact">
        <h3>Contact Information</h3>
        <p><strong>Phone:</strong> (321) 555-7890</p>
        <p><strong>Email:</strong> service@barefootbayspecialists.com</p>
        <p><strong>Website:</strong> www.barefootbay${category.slug.replace(/-/g, '')}specialists.com</p>
        
        <h3>Hours of Operation</h3>
        <p>Monday - Friday: 7:30 AM - 6:00 PM</p>
        <p>Saturday: 8:00 AM - 3:00 PM</p>
        <p>Sunday: Closed (Emergency services only)</p>
        
        <h3>Service Area</h3>
        <p>Barefoot Bay, Micco, Sebastian, Grant, Valkaria, and all of South Brevard County.</p>
      </div>`,
    category: category.slug
  };
  
  // Third business - more specific to the category
  let business3 = {};
  
  if (category.slug === "landscaping") {
    business3 = {
      title: "Florida Lawn & Garden Masters",
      slug: `vendors-${category.slug}-florida-lawn-garden-masters`,
      content: `<h2>Florida Lawn & Garden Masters</h2>
        <div class="vendor-description">
          <p>Florida Lawn & Garden Masters has been beautifying properties in Barefoot Bay and the surrounding areas since 2003. We specialize in creating and maintaining stunning, low-maintenance landscapes that thrive in Florida's unique climate.</p>
          
          <p>Our team of landscape professionals understands the challenges of Florida gardening, from pest management to water conservation. We design beautiful outdoor spaces that are both environmentally responsible and visually appealing.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Regular lawn maintenance and mowing</li>
            <li>Florida-friendly landscape design</li>
            <li>Irrigation system installation and repair</li>
            <li>Palm tree trimming and maintenance</li>
            <li>Mulching and soil amendment</li>
            <li>Pest and disease management</li>
            <li>Hardscape installation (pavers, retaining walls)</li>
            <li>Seasonal planting and color enhancement</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>As Florida Certified Landscape Professionals, we bring expertise specifically tailored to Florida's unique environment. Our team stays up-to-date on the latest practices in sustainable landscaping, drought-resistant plants, and eco-friendly pest management techniques.</p>
          
          <p>We pride ourselves on reliability and attention to detail. Our maintenance schedules are consistent, and we always leave your property looking immaculate. Whether you need a complete landscape renovation or regular maintenance, our team delivers professional results that will make your property stand out.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-8765</p>
          <p><strong>Email:</strong> info@floridalawnmasters.com</p>
          <p><strong>Website:</strong> www.floridalawnmasters.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 7:00 AM - 5:00 PM</p>
          <p>Saturday: 8:00 AM - 2:00 PM</p>
          <p>Sunday: Closed</p>
          
          <h3>Service Area</h3>
          <p>Barefoot Bay, Micco, Sebastian, Vero Beach, Melbourne and Palm Bay areas.</p>
          
          <h3>Certifications</h3>
          <p>Florida Certified Landscape Professionals, Certified Irrigation Technicians, Licensed Pest Control Operators</p>
        </div>`,
      category: category.slug
    };
  } else if (category.slug === "plumbing") {
    business3 = {
      title: "Quality Plumbing Solutions",
      slug: `vendors-${category.slug}-quality-plumbing-solutions`,
      content: `<h2>Quality Plumbing Solutions</h2>
        <div class="vendor-description">
          <p>Quality Plumbing Solutions has been serving Barefoot Bay and surrounding communities since 1998. We specialize in all aspects of residential plumbing, from routine maintenance to emergency repairs.</p>
          
          <p>Our master plumbers bring decades of combined experience to every job, ensuring that your plumbing issues are resolved efficiently and effectively. We understand the unique challenges that Florida's water quality and climate present to plumbing systems.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Leak detection and repair</li>
            <li>Fixture installation and replacement</li>
            <li>Water heater service and installation</li>
            <li>Pipe repair and replacement</li>
            <li>Drain cleaning and maintenance</li>
            <li>Sewer line service</li>
            <li>Water filtration systems</li>
            <li>Bathroom and kitchen remodeling</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our team of licensed, bonded, and insured plumbers takes pride in delivering exceptional service on every call. We arrive on time in fully-stocked trucks, ready to solve your plumbing problems on the first visit whenever possible.</p>
          
          <p>We understand that plumbing emergencies can be stressful, which is why we offer transparent pricing with no hidden fees or overtime charges. Our workmanship is backed by a comprehensive warranty, giving you peace of mind that the job is done right.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-4321</p>
          <p><strong>Email:</strong> service@qualityplumbingsolutions.com</p>
          <p><strong>Website:</strong> www.qualityplumbingsolutions.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 8:00 AM - 5:00 PM</p>
          <p>Saturday: 9:00 AM - 1:00 PM</p>
          <p>Sunday: Emergency service only</p>
          <p>24/7 Emergency service available</p>
          
          <h3>Service Area</h3>
          <p>Barefoot Bay, Sebastian, Vero Beach, Melbourne, and all of Brevard and Indian River Counties.</p>
          
          <h3>Certifications</h3>
          <p>State of Florida Certified Master Plumbers, Backflow Prevention Certified</p>
        </div>`,
      category: category.slug
    };
  } else {
    // Generic third business for other categories
    business3 = {
      title: `Sebastian ${category.name} Pros`,
      slug: `vendors-${category.slug}-sebastian-${category.slug.replace(/-/g, '')}-pros`,
      content: `<h2>Sebastian ${category.name} Pros</h2>
        <div class="vendor-description">
          <p>Established in 2008, Sebastian ${category.name} Pros has been delivering professional ${category.description.toLowerCase()} to the Barefoot Bay and Sebastian communities for over 15 years.</p>
          
          <p>Our team of certified professionals combines technical expertise with outstanding customer service to ensure your complete satisfaction. We stay current with the latest industry innovations and best practices to deliver high-quality, reliable solutions for all your ${category.name.toLowerCase()} needs.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Comprehensive ${category.name.toLowerCase()} services</li>
            <li>Repairs and maintenance</li>
            <li>Installation and upgrades</li>
            <li>Emergency service available</li>
            <li>Residential and commercial solutions</li>
            <li>Free consultations and estimates</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>We've built our reputation on reliability, quality workmanship, and attention to detail. Our technicians undergo rigorous training and certification, ensuring they have the skills and knowledge needed to handle any ${category.name.toLowerCase()} challenge.</p>
          
          <p>As a locally owned and operated business, we're invested in our community and committed to providing exceptional service to our neighbors. We offer competitive pricing, honest assessments, and solutions designed to fit your needs and budget.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-9876</p>
          <p><strong>Email:</strong> info@sebastian${category.slug.replace(/-/g, '')}pros.com</p>
          <p><strong>Website:</strong> www.sebastian${category.slug.replace(/-/g, '')}pros.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 8:00 AM - 5:30 PM</p>
          <p>Saturday: 9:00 AM - 2:00 PM</p>
          <p>Sunday: Closed</p>
          <p>After-hours emergency services available</p>
          
          <h3>Service Area</h3>
          <p>Sebastian, Barefoot Bay, Micco, Vero Beach, and surrounding areas of Indian River and Brevard Counties.</p>
        </div>`,
      category: category.slug
    };
  }
  
  businesses = [business1, business2, business3];
  
  return businesses;
}

// Main function to generate and insert vendor listings
async function generateVendorContent() {
  try {
    console.log("Starting vendor content generation...");
    
    if (!googleApiKey) {
      console.log("No Google AI API key detected. Will use predefined content.");
      console.log("To use AI-generated content, please set GEMINI_API_KEY or VITE_GEMINI_API_KEY in your environment variables.");
    }
    
    // Generate and insert vendor listings for each category
    for (const category of VENDOR_CATEGORIES) {
      // Check if category page exists
      const categoryCheckResult = await pool.query(
        `SELECT * FROM page_contents WHERE slug = $1`,
        [`vendors-${category.slug}`]
      );
      
      // Skip categories that don't have a category page
      if (categoryCheckResult.rows.length === 0) {
        console.log(`Warning: No category page found for ${category.name}, skipping vendor generation.`);
        continue;
      }
      
      // Skip image download to make script run faster
      console.log(`Skipping image download for category: ${category.name}...`);
      const categoryImageUrl = null; // Skip image download
      
      // Get AI-generated content for this category
      const vendors = await generateVendorListings(category);
      
      for (const vendor of vendors) {
        // Check if this vendor already exists
        const vendorCheckResult = await pool.query(
          `SELECT * FROM page_contents WHERE slug = $1`,
          [vendor.slug]
        );
        
        if (vendorCheckResult.rows.length > 0) {
          console.log(`Vendor ${vendor.title} already exists, skipping.`);
          continue;
        }
        
        console.log(`Creating vendor ${vendor.title} for category ${category.name}...`);
        
        // Insert vendor with the category image
        await pool.query(
          `INSERT INTO page_contents 
           (slug, title, content, media_urls, updated_by, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [
            vendor.slug,
            vendor.title,
            vendor.content,
            categoryImageUrl ? [categoryImageUrl] : [], // Use the downloaded image if available
            6,  // Admin user ID
          ]
        );
      }
    }
    
    console.log(`Vendor content generation complete! Created vendors for all categories.`);
    
  } catch (error) {
    console.error("Error generating vendor content:", error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the script
generateVendorContent();