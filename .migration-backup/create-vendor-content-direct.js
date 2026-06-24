/**
 * Create realistic vendor listings for the Barefoot Bay community
 * This script creates pre-defined vendors for different categories
 * 
 * Usage:
 * node create-vendor-content-direct.js
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

// Load environment variables
dotenv.config();

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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

// Fallback content for vendors
function getFallbackContent(category) {
  console.log(`Using pre-defined content for ${category.name}`);
  
  // Generate detailed fallback content that mimics what the AI would have generated
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
  
  // Third business - with category-specific content
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
          <p>As Florida natives, we understand the local ecosystem and how to create landscapes that thrive in our challenging climate. Our team is certified in Florida-Friendly Landscaping™ practices, ensuring your outdoor space is not only beautiful but also environmentally sustainable and water-efficient.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-4321</p>
          <p><strong>Email:</strong> info@floridalawnmasters.com</p>
          <p><strong>Website:</strong> www.floridalawnmasters.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 7:00 AM - 5:00 PM</p>
          <p>Saturday: 8:00 AM - 12:00 PM</p>
          <p>Sunday: Closed</p>
          
          <h3>Service Area</h3>
          <p>Barefoot Bay, Sebastian, Micco, Grant-Valkaria, Malabar, and Palm Bay</p>
        </div>`,
      category: category.slug
    };
  } else if (category.slug === "hvac") {
    business3 = {
      title: "Comfort Air Solutions",
      slug: `vendors-${category.slug}-comfort-air-solutions`,
      content: `<h2>Comfort Air Solutions</h2>
        <div class="vendor-description">
          <p>Comfort Air Solutions has been keeping Barefoot Bay residents cool and comfortable since 2001. As Florida HVAC specialists, we understand the critical importance of reliable air conditioning in our hot, humid climate.</p>
          
          <p>Our team of certified HVAC technicians specializes in servicing, repairing, and installing all makes and models of air conditioning systems, with a focus on energy efficiency and reliability in Florida's challenging environment.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>AC repair and emergency service</li>
            <li>New system installation and replacement</li>
            <li>Preventative maintenance plans</li>
            <li>Air quality assessment and improvement</li>
            <li>Ductwork inspection and repair</li>
            <li>Energy efficiency upgrades</li>
            <li>Heat pump service and repair</li>
            <li>Thermostat installation and programming</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>We specialize in Florida's unique cooling challenges, providing solutions that manage both temperature and humidity effectively. Our technicians are NATE-certified and regularly trained on the latest HVAC technologies. We're committed to honest pricing, timely service, and ensuring your absolute comfort year-round.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-8765</p>
          <p><strong>Email:</strong> service@comfortairsolutions.com</p>
          <p><strong>Website:</strong> www.comfortairsolutions.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 8:00 AM - 7:00 PM</p>
          <p>Saturday: 9:00 AM - 5:00 PM</p>
          <p>Sunday: Emergency service only</p>
          <p>24/7 Emergency AC Repair Available</p>
          
          <h3>Service Area</h3>
          <p>Barefoot Bay, Sebastian, Vero Beach, Melbourne, and throughout Brevard and Indian River Counties</p>
        </div>`,
      category: category.slug
    };
  } else if (category.slug === "home-services") {
    business3 = {
      title: "Barefoot Bay Home Helpers",
      slug: `vendors-${category.slug}-barefoot-bay-home-helpers`,
      content: `<h2>Barefoot Bay Home Helpers</h2>
        <div class="vendor-description">
          <p>Barefoot Bay Home Helpers provides comprehensive home care and maintenance services designed specifically for the needs of our senior community members. Since 2005, we've been helping residents maintain their homes and their independence.</p>
          
          <p>Our team understands the unique challenges faced by retirees and seasonal residents. We offer a complete range of home services that can be scheduled regularly or on-demand, allowing you to enjoy your Barefoot Bay lifestyle without worry.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Regular home cleaning and maintenance</li>
            <li>Seasonal home opening and closing</li>
            <li>Home watch for absentee owners</li>
            <li>Light repairs and handyman services</li>
            <li>Hurricane preparation and post-storm cleanup</li>
            <li>Grocery delivery and errand service</li>
            <li>Assistance with home organization</li>
            <li>Moving and downsizing help</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>As Barefoot Bay specialists, we understand the community's unique needs. Our staff is thoroughly background-checked, bonded, and insured for your peace of mind. We offer flexible scheduling and personalized service plans to match your exact requirements, whether you're a full-time resident or snowbird.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-3456</p>
          <p><strong>Email:</strong> services@barefootbayhelpers.com</p>
          <p><strong>Website:</strong> www.barefootbayhelpers.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 8:00 AM - 6:00 PM</p>
          <p>Saturday: 9:00 AM - 4:00 PM</p>
          <p>Sunday: By appointment only</p>
          
          <h3>Service Area</h3>
          <p>Exclusively serving Barefoot Bay and immediately surrounding areas</p>
        </div>`,
      category: category.slug
    };
  } else if (category.slug === "plumbing") {
    business3 = {
      title: "Florida Flow Plumbing",
      slug: `vendors-${category.slug}-florida-flow-plumbing`,
      content: `<h2>Florida Flow Plumbing</h2>
        <div class="vendor-description">
          <p>Florida Flow Plumbing has been serving the Barefoot Bay community with expert plumbing services since 1999. We specialize in handling the unique plumbing challenges that come with Florida's coastal environment and water conditions.</p>
          
          <p>Our master plumbers and technicians are experienced in everything from routine maintenance to complex water systems. We pride ourselves on prompt service, transparent pricing, and lasting solutions to keep your home's plumbing flowing smoothly.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Emergency plumbing repairs</li>
            <li>Leak detection and repair</li>
            <li>Fixture installation and upgrades</li>
            <li>Water heater service and replacement</li>
            <li>Water filtration systems</li>
            <li>Drain cleaning and maintenance</li>
            <li>Pipe repair and replacement</li>
            <li>Sewer line service and repair</li>
            <li>Hurricane plumbing preparation</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our team specializes in addressing Florida-specific plumbing issues like hard water, salt corrosion, and seasonal home maintenance. We're fully licensed and insured, with a reputation for honest assessments and fair pricing. Our work is guaranteed, and we offer priority service for our many loyal Barefoot Bay customers.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-5678</p>
          <p><strong>Email:</strong> service@floridaflowplumbing.com</p>
          <p><strong>Website:</strong> www.floridaflowplumbing.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 7:30 AM - 6:00 PM</p>
          <p>Saturday: 8:00 AM - 3:00 PM</p>
          <p>Sunday: Emergency service only</p>
          <p>24/7 Emergency Service Available</p>
          
          <h3>Service Area</h3>
          <p>Barefoot Bay, Sebastian, Micco, Vero Beach, and throughout Indian River and Brevard Counties</p>
        </div>`,
      category: category.slug
    };
  } else if (category.slug === "electrical") {
    business3 = {
      title: "Sunshine State Electric",
      slug: `vendors-${category.slug}-sunshine-state-electric`,
      content: `<h2>Sunshine State Electric</h2>
        <div class="vendor-description">
          <p>Sunshine State Electric has been providing reliable electrical services to Barefoot Bay residents since 2002. Our licensed electricians specialize in residential electrical systems, with particular expertise in Florida building codes and hurricane preparedness.</p>
          
          <p>From simple repairs to complete home rewiring, our team delivers professional, courteous service with a focus on safety and quality workmanship. We understand the electrical needs and challenges specific to Florida homes.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Electrical repairs and troubleshooting</li>
            <li>Ceiling fan installation and repair</li>
            <li>Lighting upgrades and installation</li>
            <li>Outlet and switch replacement</li>
            <li>Circuit breaker and panel upgrades</li>
            <li>Whole-home surge protection</li>
            <li>Generator installation and service</li>
            <li>Electrical safety inspections</li>
            <li>Storm damage repair</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>All our electricians are licensed, insured, and receive ongoing training on the latest electrical codes and technologies. We specialize in Florida-specific electrical solutions including hurricane preparation, humidity protection, and energy efficiency upgrades designed for our unique climate. Our upfront pricing ensures no surprises, and we stand behind all our work with a satisfaction guarantee.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-9876</p>
          <p><strong>Email:</strong> service@sunshinestateelectric.com</p>
          <p><strong>Website:</strong> www.sunshinestateelectric.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 7:00 AM - 6:00 PM</p>
          <p>Saturday: 8:00 AM - 4:00 PM</p>
          <p>Sunday: Emergency service only</p>
          <p>24-Hour Emergency Service Available</p>
          
          <h3>Service Area</h3>
          <p>Barefoot Bay, Sebastian, Vero Beach, Melbourne, and all of Brevard and Indian River Counties</p>
        </div>`,
      category: category.slug
    };
  } else if (category.slug === "contractors") {
    business3 = {
      title: "Coastal Construction & Remodeling",
      slug: `vendors-${category.slug}-coastal-construction-remodeling`,
      content: `<h2>Coastal Construction & Remodeling</h2>
        <div class="vendor-description">
          <p>Coastal Construction & Remodeling has specialized in Barefoot Bay home improvements and renovations since 2004. We understand the unique construction needs of Florida coastal homes and the specific requirements of the Barefoot Bay community.</p>
          
          <p>Our team of licensed contractors brings decades of combined experience in Florida construction, focusing on quality craftsmanship, hurricane-resistant building practices, and beautiful designs suited to the Florida lifestyle.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Kitchen and bathroom remodeling</li>
            <li>Florida room and sunroom additions</li>
            <li>Hurricane impact windows and doors</li>
            <li>Roofing repair and replacement</li>
            <li>Flooring installation and upgrades</li>
            <li>Patio and deck construction</li>
            <li>Whole home renovations</li>
            <li>Aging-in-place modifications</li>
            <li>Custom cabinetry and built-ins</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>We specialize in renovations that enhance your Florida lifestyle while addressing the challenges of our climate. Our designs incorporate energy efficiency, storm protection, and low maintenance materials perfectly suited to coastal living. As a local company, we understand Barefoot Bay building regulations and handle all permitting processes for you. Our projects are completed on time and within budget, with clear communication throughout.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-2345</p>
          <p><strong>Email:</strong> info@coastalconstructionfl.com</p>
          <p><strong>Website:</strong> www.coastalconstructionfl.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 8:00 AM - 5:00 PM</p>
          <p>Saturday: By appointment only</p>
          <p>Sunday: Closed</p>
          
          <h3>Service Area</h3>
          <p>Barefoot Bay, Sebastian, Micco, Grant-Valkaria, and surrounding Brevard and Indian River County areas</p>
        </div>`,
      category: category.slug
    };
  } else {
    // Default third business for other categories
    business3 = {
      title: `${category.name} Experts of Florida`,
      slug: `vendors-${category.slug}-${category.slug.replace(/-/g, '')}-experts-of-florida`,
      content: `<h2>${category.name} Experts of Florida</h2>
        <div class="vendor-description">
          <p>${category.name} Experts of Florida has been serving the Barefoot Bay area for over a decade, providing professional ${category.description.toLowerCase()} with a focus on quality and customer satisfaction.</p>
          
          <p>Our team of certified professionals is committed to delivering exceptional service tailored to the unique needs of Florida residents. We understand the challenges posed by Florida's climate and environment, and we provide solutions designed to withstand these conditions.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Professional ${category.description.toLowerCase()}</li>
            <li>Emergency service available</li>
            <li>Maintenance programs</li>
            <li>Free consultations and estimates</li>
            <li>Senior and military discounts</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our team consists of fully licensed and insured professionals with extensive experience in the ${category.name.toLowerCase()} industry. We pride ourselves on our attention to detail, reliability, and commitment to customer satisfaction. Our knowledge of the specific challenges faced by Florida homeowners allows us to provide customized solutions that address your unique needs.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-6543</p>
          <p><strong>Email:</strong> info@${category.slug.replace(/-/g, '')}expertsfl.com</p>
          <p><strong>Website:</strong> www.${category.slug.replace(/-/g, '')}expertsfl.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 8:00 AM - 5:30 PM</p>
          <p>Saturday: 9:00 AM - 3:00 PM</p>
          <p>Sunday: Closed (Emergency services only)</p>
          
          <h3>Service Area</h3>
          <p>Barefoot Bay, Sebastian, Vero Beach, Melbourne, and surrounding areas in Brevard and Indian River Counties.</p>
        </div>`,
      category: category.slug
    };
  }
  
  businesses.push(business1, business2, business3);
  return businesses;
}

// Main function to generate and insert vendor listings
async function generateVendorContent() {
  try {
    console.log("Starting vendor content generation using pre-defined content...");
    
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
      
      console.log(`Generating vendors for category: ${category.name}...`);
      
      // Get pre-defined content for this category
      const vendors = getFallbackContent(category);
      
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
        
        // Insert vendor without images
        await pool.query(
          `INSERT INTO page_contents 
           (slug, title, content, media_urls, updated_by, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [
            vendor.slug,
            vendor.title,
            vendor.content,
            [],  // No images for now
            6,   // Admin user ID
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