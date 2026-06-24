/**
 * Create vendor listings to match the admin categories in Barefoot Bay
 * 
 * This script creates 3 vendors for each admin category:
 * - Home Services
 * - Health & Wellness
 * - Landscaping Companies
 * - Food & Dining
 * - Professional Services
 * - Retail
 * - Automotive
 * - Technology
 * - Other
 * 
 * Usage:
 * node create-admin-vendor-content.js
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

// Define vendor categories from the admin panel
const ADMIN_VENDOR_CATEGORIES = [
  {
    slug: "health-wellness",
    name: "Health & Wellness",
    description: "Health, wellness, and medical services"
  },
  {
    slug: "landscaping-companies",
    name: "Landscaping Companies",
    description: "Lawn care, gardening, and outdoor maintenance"
  },
  {
    slug: "food-dining",
    name: "Food & Dining",
    description: "Restaurants, catering, and food services"
  },
  {
    slug: "professional-services",
    name: "Professional Services",
    description: "Legal, financial, and consulting services"
  },
  {
    slug: "retail",
    name: "Retail",
    description: "Retail stores and shopping services"
  },
  {
    slug: "automotive",
    name: "Automotive",
    description: "Car repair, maintenance, and automotive services"
  },
  {
    slug: "technology",
    name: "Technology",
    description: "Technology services and products"
  },
  {
    slug: "other",
    name: "Other",
    description: "Miscellaneous services not covered by other categories"
  }
];

// Main function to generate content for each category
async function generateVendorContent() {
  try {
    console.log("Starting vendor content generation for admin categories...");
    
    // Process each category
    for (const category of ADMIN_VENDOR_CATEGORIES) {
      console.log(`Generating content for ${category.name}...`);
      
      // First, check if a category page exists, create if it doesn't
      const categoryPageResult = await pool.query(
        `SELECT * FROM page_contents WHERE slug = $1`,
        [`vendors-${category.slug}`]
      );
      
      if (categoryPageResult.rows.length === 0) {
        // Create category page
        await pool.query(
          `INSERT INTO page_contents 
           (slug, title, content, media_urls, updated_by, created_at, updated_at, is_hidden) 
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), FALSE)`,
          [
            `vendors-${category.slug}`,
            category.name,
            `<h1>${category.name}</h1><p>Find trusted ${category.description.toLowerCase()} serving Barefoot Bay.</p>`,
            [],
            6, // Admin user ID
          ]
        );
        console.log(`Created category page for ${category.name}`);
      }
      
      // Generate 3 vendors per category
      const vendors = generateVendorsForCategory(category);
      
      // Insert each vendor
      for (const vendor of vendors) {
        // Check if vendor already exists
        const existingVendor = await pool.query(
          `SELECT * FROM page_contents WHERE slug = $1`,
          [vendor.slug]
        );
        
        if (existingVendor.rows.length > 0) {
          console.log(`Vendor ${vendor.title} already exists, skipping.`);
          continue;
        }
        
        // Insert new vendor
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
        
        console.log(`Created vendor: ${vendor.title}`);
      }
    }
    
    console.log("Vendor content generation complete for all admin categories!");
    
  } catch (error) {
    console.error("Error generating vendor content:", error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Generate 3 vendors for each category
function generateVendorsForCategory(category) {
  const vendors = [];
  
  // HEALTH & WELLNESS VENDORS
  if (category.slug === "health-wellness") {
    vendors.push({
      title: "Barefoot Bay Wellness Center",
      slug: `vendors-${category.slug}-barefoot-bay-wellness-center`,
      content: `<h2>Barefoot Bay Wellness Center</h2>
        <div class="vendor-description">
          <p>Barefoot Bay Wellness Center has been serving the health and wellness needs of our community since 2006. Our integrative approach combines traditional and holistic therapies to provide comprehensive care for residents of all ages.</p>
          
          <p>Our center was founded by Dr. Sarah Johnson, a long-time Barefoot Bay resident who recognized the need for accessible wellness services in our community. We offer a wide range of therapies and programs designed to enhance physical, mental, and emotional well-being.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Physical therapy and rehabilitation</li>
            <li>Massage therapy and bodywork</li>
            <li>Nutritional counseling</li>
            <li>Stress management programs</li>
            <li>Senior fitness classes</li>
            <li>Weight management support</li>
            <li>Acupuncture and pain management</li>
            <li>Health education workshops</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>As part of the Barefoot Bay community, we understand the unique health challenges facing our residents, particularly our senior population. Our staff is specifically trained in geriatric care, and we offer personalized treatment plans that respect your individual needs and goals. All of our practitioners are licensed, certified, and committed to ongoing professional development to bring you the best in wellness care.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-8765</p>
          <p><strong>Email:</strong> info@barefootbaywellness.com</p>
          <p><strong>Website:</strong> www.barefootbaywellness.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 8:00 AM - 6:00 PM</p>
          <p>Saturday: 9:00 AM - 2:00 PM</p>
          <p>Sunday: Closed</p>
          
          <h3>Location</h3>
          <p>937 Barefoot Bay Blvd, Barefoot Bay, FL 32976</p>
        </div>`
    });
    
    vendors.push({
      title: "Treasure Coast Physical Therapy",
      slug: `vendors-${category.slug}-treasure-coast-physical-therapy`,
      content: `<h2>Treasure Coast Physical Therapy</h2>
        <div class="vendor-description">
          <p>Since 2003, Treasure Coast Physical Therapy has been the region's trusted provider of rehabilitative care. We specialize in helping Barefoot Bay residents recover from injuries, surgeries, and chronic conditions to regain their mobility and independence.</p>
          
          <p>Our team of licensed physical therapists brings decades of combined experience in orthopedic rehabilitation, balance training, and pain management. We're committed to creating personalized treatment plans that address your specific concerns and goals.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Post-surgical rehabilitation</li>
            <li>Sports injury recovery</li>
            <li>Balance and fall prevention</li>
            <li>Arthritis management</li>
            <li>Neurological rehabilitation</li>
            <li>Manual therapy techniques</li>
            <li>Aquatic therapy</li>
            <li>In-home therapy options</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>We understand the unique challenges faced by our senior community members, and our facility is designed with accessibility and comfort in mind. Our therapists specialize in gentle, effective techniques appropriate for older adults, and we coordinate care with your primary physician to ensure a comprehensive approach. We accept Medicare and most major insurance plans, making quality care accessible to all Barefoot Bay residents.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-4321</p>
          <p><strong>Email:</strong> appointments@treasurecoastpt.com</p>
          <p><strong>Website:</strong> www.treasurecoastpt.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Thursday: 7:00 AM - 7:00 PM</p>
          <p>Friday: 7:00 AM - 5:00 PM</p>
          <p>Saturday & Sunday: Closed</p>
          
          <h3>Location</h3>
          <p>1120 Medical Plaza Dr, Sebastian, FL 32958</p>
          <p>Serving all of Barefoot Bay and the surrounding communities</p>
        </div>`
    });
    
    vendors.push({
      title: "Florida Coastal Hearing Center",
      slug: `vendors-${category.slug}-florida-coastal-hearing-center`,
      content: `<h2>Florida Coastal Hearing Center</h2>
        <div class="vendor-description">
          <p>Florida Coastal Hearing Center has been providing exceptional audiology services to Barefoot Bay and the Treasure Coast since 2009. We specialize in comprehensive hearing evaluations, advanced hearing aid technology, and personalized hearing healthcare solutions.</p>
          
          <p>Our center is owned and operated by Dr. Michael Roberts, AuD, a board-certified audiologist with over 20 years of experience in hearing healthcare. We pride ourselves on combining cutting-edge technology with compassionate, patient-centered care.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Comprehensive hearing evaluations</li>
            <li>Custom hearing aid fittings and programming</li>
            <li>Tinnitus assessment and management</li>
            <li>Hearing protection devices</li>
            <li>Assistive listening technology</li>
            <li>Earwax removal</li>
            <li>Hearing aid repairs and maintenance</li>
            <li>Free hearing screenings</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>We understand that hearing loss can significantly impact your quality of life and ability to engage with the community. Our patient-first approach ensures that you receive personalized attention and solutions tailored to your specific hearing needs and lifestyle. We work with all major hearing aid manufacturers and offer no-obligation trials, allowing you to experience better hearing before making a decision. As a local practice, we're committed to providing ongoing support and service to our Barefoot Bay neighbors.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-2233</p>
          <p><strong>Email:</strong> info@floridacoastalhearing.com</p>
          <p><strong>Website:</strong> www.floridacoastalhearing.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 9:00 AM - 5:00 PM</p>
          <p>Saturday: By appointment only</p>
          <p>Sunday: Closed</p>
          
          <h3>Location</h3>
          <p>565 US Highway 1, Sebastian, FL 32958</p>
          <p>Serving Barefoot Bay, Sebastian, and surrounding areas</p>
        </div>`
    });
  }
  
  // LANDSCAPING COMPANIES VENDORS
  else if (category.slug === "landscaping-companies") {
    vendors.push({
      title: "Barefoot Bay Garden Masters",
      slug: `vendors-${category.slug}-barefoot-bay-garden-masters`,
      content: `<h2>Barefoot Bay Garden Masters</h2>
        <div class="vendor-description">
          <p>Barefoot Bay Garden Masters has been creating and maintaining beautiful landscapes in our community since 2005. As local residents ourselves, we understand the unique climate challenges and soil conditions that affect Barefoot Bay properties.</p>
          
          <p>Our team specializes in Florida-friendly landscaping practices that conserve water, reduce maintenance, and thrive in our tropical environment. From routine lawn care to complete landscape redesigns, we bring expertise and attention to detail to every project.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Regular lawn maintenance and mowing</li>
            <li>Florida-friendly landscape design</li>
            <li>Irrigation system installation and repair</li>
            <li>Palm tree trimming and maintenance</li>
            <li>Mulching and soil amendments</li>
            <li>Native plant selection and installation</li>
            <li>Hardscape installation (pavers, retaining walls)</li>
            <li>Seasonal color enhancement</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>As certified Florida-Friendly Landscaping™ professionals, we create sustainable, low-maintenance landscapes that conserve water while still looking beautiful. Our team is fully licensed and insured, and we're committed to environmentally responsible practices. We offer flexible maintenance packages tailored to your property's needs and your budget, with special discounts for Barefoot Bay senior residents.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-7890</p>
          <p><strong>Email:</strong> info@barefootbaygardens.com</p>
          <p><strong>Website:</strong> www.barefootbaygardens.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 7:00 AM - 5:00 PM</p>
          <p>Saturday: 8:00 AM - 12:00 PM</p>
          <p>Sunday: Closed</p>
          
          <h3>Service Area</h3>
          <p>Serving Barefoot Bay, Micco, Sebastian, and surrounding areas</p>
        </div>`
    });
    
    vendors.push({
      title: "Tropical Paradise Landscaping",
      slug: `vendors-${category.slug}-tropical-paradise-landscaping`,
      content: `<h2>Tropical Paradise Landscaping</h2>
        <div class="vendor-description">
          <p>Since 1998, Tropical Paradise Landscaping has been transforming Barefoot Bay properties into beautiful outdoor sanctuaries. We specialize in creating lush, tropical landscapes that capture the essence of Florida living while being practical and sustainable.</p>
          
          <p>Our founder, Jim Peterson, has over 30 years of landscaping experience in Florida's unique environment. Our team includes certified horticulturists, irrigation specialists, and landscape designers committed to excellence in every project we undertake.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Complete landscape design and installation</li>
            <li>Tropical and native plant specialization</li>
            <li>Water features and pond installation</li>
            <li>Custom outdoor living spaces</li>
            <li>Drought-tolerant xeriscaping</li>
            <li>Tree services and palm maintenance</li>
            <li>Landscape lighting design</li>
            <li>Residential and community common areas</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our deep understanding of Florida's climate allows us to create beautiful landscapes that withstand heat, humidity, and seasonal weather challenges. We're committed to using sustainable practices that conserve water and reduce maintenance. Our designs consider both aesthetics and functionality, creating outdoor spaces that enhance your lifestyle while adding value to your property. As one of the longest-operating landscaping companies in the area, our reputation for quality and reliability is unmatched.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-3456</p>
          <p><strong>Email:</strong> design@tropicalparadiselandscaping.com</p>
          <p><strong>Website:</strong> www.tropicalparadiselandscaping.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 7:30 AM - 5:30 PM</p>
          <p>Saturday: 8:00 AM - 2:00 PM</p>
          <p>Sunday: Closed</p>
          
          <h3>Service Area</h3>
          <p>Barefoot Bay, Sebastian, Vero Beach, Melbourne, and throughout Brevard and Indian River Counties</p>
        </div>`
    });
    
    vendors.push({
      title: "Coastal Lawn & Irrigation",
      slug: `vendors-${category.slug}-coastal-lawn-irrigation`,
      content: `<h2>Coastal Lawn & Irrigation</h2>
        <div class="vendor-description">
          <p>Coastal Lawn & Irrigation has been serving the Barefoot Bay community since 2008, specializing in comprehensive lawn care and irrigation solutions that conserve water while maintaining beautiful landscapes.</p>
          
          <p>Our company was founded with a mission to provide environmentally responsible landscape maintenance services specifically tailored to Florida's unique coastal environment. We employ a team of certified irrigation specialists and horticulture experts who understand the specific challenges of maintaining healthy lawns and gardens in our climate.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Weekly lawn maintenance programs</li>
            <li>Irrigation system design and installation</li>
            <li>Smart irrigation controllers and rain sensors</li>
            <li>System repairs and efficiency upgrades</li>
            <li>Seasonal lawn treatments and fertilization</li>
            <li>Pest control and disease management</li>
            <li>Drought management solutions</li>
            <li>Water conservation consulting</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>We specialize in water-efficient irrigation systems that save you money while keeping your landscape healthy. Our technicians are certified in Florida water conservation practices and stay updated on the latest irrigation technology. We offer customized maintenance plans based on your property's specific needs and can help you reduce water consumption by up to 50% with our smart irrigation solutions. Our commitment to outstanding customer service includes prompt response times and clear communication throughout any project.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-9876</p>
          <p><strong>Email:</strong> service@coastallawnirrigation.com</p>
          <p><strong>Website:</strong> www.coastallawnirrigation.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 7:00 AM - 6:00 PM</p>
          <p>Saturday: 8:00 AM - 1:00 PM</p>
          <p>Sunday: Closed (Emergency irrigation repairs available)</p>
          
          <h3>Service Area</h3>
          <p>Barefoot Bay, Sebastian, Grant-Valkaria, Micco, and surrounding communities</p>
        </div>`
    });
  }
  
  // FOOD & DINING VENDORS
  else if (category.slug === "food-dining") {
    vendors.push({
      title: "Barefoot Bay Catering",
      slug: `vendors-${category.slug}-barefoot-bay-catering`,
      content: `<h2>Barefoot Bay Catering</h2>
        <div class="vendor-description">
          <p>Barefoot Bay Catering has been delighting community residents with exceptional food and service since 2010. We specialize in creating memorable dining experiences for events of all sizes, from intimate dinner parties to large community gatherings.</p>
          
          <p>Our company was founded by Chef Maria Santiago, a culinary professional with over 25 years of experience in fine dining and event catering. We take pride in using fresh, locally sourced ingredients to create diverse menu options that can accommodate any dietary requirement or preference.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Full-service event catering</li>
            <li>Private in-home dining experiences</li>
            <li>Community event food service</li>
            <li>Prepared meal delivery for seniors</li>
            <li>Special occasion cakes and desserts</li>
            <li>Holiday meal packages</li>
            <li>Cooking classes and demonstrations</li>
            <li>Custom menu planning for dietary needs</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>As Barefoot Bay residents ourselves, we understand the community's unique preferences and needs. We offer flexible menu options that range from elegant fine dining to casual comfort food, all prepared with the same attention to quality. Our special senior meal delivery service provides nutritious, portion-controlled meals perfect for individuals or couples who want to enjoy restaurant-quality food at home. We're fully licensed and insured, with impeccable food safety practices and a commitment to exceeding your expectations.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-6789</p>
          <p><strong>Email:</strong> info@barefootbaycatering.com</p>
          <p><strong>Website:</strong> www.barefootbaycatering.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Office Hours:</p>
          <p>Monday - Friday: 9:00 AM - 5:00 PM</p>
          <p>Saturday & Sunday: By appointment only</p>
          <p>Catering services available 7 days a week</p>
          
          <h3>Service Area</h3>
          <p>Serving all of Barefoot Bay and surrounding communities within a 25-mile radius</p>
        </div>`
    });
    
    vendors.push({
      title: "Coastal Fresh Seafood Market",
      slug: `vendors-${category.slug}-coastal-fresh-seafood-market`,
      content: `<h2>Coastal Fresh Seafood Market</h2>
        <div class="vendor-description">
          <p>Coastal Fresh Seafood Market has been bringing the bounty of Florida's waters to Barefoot Bay residents since 2007. Our family-owned market specializes in locally caught, sustainable seafood delivered fresh daily from boats along the Treasure Coast.</p>
          
          <p>Owner Captain Tom Wilson spent 30 years as a commercial fisherman before opening our market to provide truly fresh seafood to the community. We're committed to supporting local fishing families while offering the highest quality seafood available.</p>
          
          <h3>Our Products & Services</h3>
          <ul>
            <li>Fresh local catch delivered daily</li>
            <li>Gulf and Atlantic seafood specialties</li>
            <li>Prepared seafood dishes ready to heat</li>
            <li>Custom seafood platters for entertaining</li>
            <li>Seafood smoking and specialty preparations</li>
            <li>Cooking tips and recipe suggestions</li>
            <li>Special orders and seasonal specialties</li>
            <li>Home delivery available for Barefoot Bay residents</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our direct relationships with local fishing boats ensure that you're getting the freshest possible seafood, often caught the same day it's sold. We personally inspect every delivery for quality and freshness, and our staff is knowledgeable about seafood preparation and cooking techniques. Our prepared foods section offers restaurant-quality items ready to enjoy at home, perfect for residents who want the health benefits of seafood without the preparation work. We also offer special discounts for Barefoot Bay community members.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-2468</p>
          <p><strong>Email:</strong> orders@coastalfreshseafood.com</p>
          <p><strong>Website:</strong> www.coastalfreshseafood.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Tuesday - Saturday: 9:00 AM - 6:00 PM</p>
          <p>Sunday: 10:00 AM - 4:00 PM</p>
          <p>Monday: Closed</p>
          
          <h3>Location</h3>
          <p>8734 US Highway 1, Sebastian, FL 32958</p>
          <p>Just 10 minutes from Barefoot Bay</p>
        </div>`
    });
    
    vendors.push({
      title: "Florida Citrus Delivery Service",
      slug: `vendors-${category.slug}-florida-citrus-delivery-service`,
      content: `<h2>Florida Citrus Delivery Service</h2>
        <div class="vendor-description">
          <p>Florida Citrus Delivery Service has been bringing the freshest fruits and produce directly to Barefoot Bay residents since 2012. We specialize in locally grown citrus and seasonal Florida produce delivered straight to your door.</p>
          
          <p>Founded by third-generation citrus farmers, our company partners with small family farms throughout Indian River County to provide tree-ripened fruit and fresh vegetables harvested at peak flavor. We're committed to supporting sustainable farming practices while making healthy eating convenient for our community.</p>
          
          <h3>Our Products & Services</h3>
          <ul>
            <li>Weekly produce delivery subscriptions</li>
            <li>Premium Indian River citrus packages</li>
            <li>Seasonal fruit baskets and gift boxes</li>
            <li>Local honey, jams, and specialty foods</li>
            <li>Florida-grown vegetables and greens</li>
            <li>Custom produce boxes based on preferences</li>
            <li>Shipping services for gifts to family up north</li>
            <li>Fresh-squeezed juice delivery</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our direct relationship with local growers means we can deliver produce that's been harvested within 24-48 hours, ensuring maximum freshness and nutritional value. Our flexible subscription service allows you to customize your orders based on your preferences and schedule, with easy pausing for seasonal residents. We offer special pricing for Barefoot Bay community members, and our delivery service is particularly valuable for residents with limited mobility who may find grocery shopping challenging.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-1357</p>
          <p><strong>Email:</strong> orders@floridacitrusdelivery.com</p>
          <p><strong>Website:</strong> www.floridacitrusdelivery.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Office Hours:</p>
          <p>Monday - Friday: 8:00 AM - 4:00 PM</p>
          <p>Deliveries to Barefoot Bay: Tuesday and Friday</p>
          
          <h3>Service Area</h3>
          <p>Serving Barefoot Bay, Sebastian, Micco, and surrounding communities</p>
        </div>`
    });
  }
  
  // PROFESSIONAL SERVICES VENDORS
  else if (category.slug === "professional-services") {
    vendors.push({
      title: "Coastal Retirement Planning",
      slug: `vendors-${category.slug}-coastal-retirement-planning`,
      content: `<h2>Coastal Retirement Planning</h2>
        <div class="vendor-description">
          <p>Coastal Retirement Planning has been serving Barefoot Bay retirees and pre-retirees since 2005. We specialize in comprehensive financial planning with a focus on retirement income strategies, wealth preservation, and estate planning.</p>
          
          <p>Our firm was founded by William Stevens, CFP®, a CERTIFIED FINANCIAL PLANNER™ professional with over 25 years of experience helping Florida seniors optimize their retirement resources. We provide personalized, fiduciary guidance tailored to the unique needs of our community members.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Retirement income planning</li>
            <li>Investment management</li>
            <li>Social Security optimization</li>
            <li>Tax-efficient withdrawal strategies</li>
            <li>Long-term care planning</li>
            <li>Estate planning coordination</li>
            <li>IRA and 401(k) rollovers</li>
            <li>Medicare supplement analysis</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>As financial professionals who specifically focus on retirees, we understand the unique challenges facing Barefoot Bay residents. Our fiduciary commitment means we always place your interests first, providing objective advice without product sales pressure. We offer a complimentary retirement income analysis for all community members and specialize in helping seasonal residents coordinate their financial affairs across multiple states. Our convenient location near Barefoot Bay and flexible in-home appointments make working with us easy and accessible.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-8765</p>
          <p><strong>Email:</strong> info@coastalretirementplanning.com</p>
          <p><strong>Website:</strong> www.coastalretirementplanning.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 9:00 AM - 4:00 PM</p>
          <p>Evenings and weekends by appointment</p>
          <p>In-home consultations available</p>
          
          <h3>Location</h3>
          <p>7890 Professional Plaza, Suite 205</p>
          <p>Sebastian, FL 32958</p>
          <p>Just 10 minutes from Barefoot Bay</p>
        </div>`
    });
    
    vendors.push({
      title: "Florida Seniors Legal Services",
      slug: `vendors-${category.slug}-florida-seniors-legal-services`,
      content: `<h2>Florida Seniors Legal Services</h2>
        <div class="vendor-description">
          <p>Florida Seniors Legal Services has been providing specialized legal assistance to Barefoot Bay and Treasure Coast seniors since 2008. We focus exclusively on legal matters affecting older adults, offering experienced counsel with sensitivity to the unique needs of our senior clients.</p>
          
          <p>Our practice is led by Attorney James Wilson, who has dedicated his 30-year legal career to elder law and estate planning. Our team includes paralegals and staff who are specifically trained to work with senior clients, ensuring comfortable and accessible legal services.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Estate planning and wills</li>
            <li>Living trusts and asset protection</li>
            <li>Durable powers of attorney</li>
            <li>Healthcare directives and living wills</li>
            <li>Probate administration and avoidance</li>
            <li>Medicaid planning and applications</li>
            <li>Guardianship services</li>
            <li>Real estate matters for seniors</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our practice is exclusively dedicated to serving seniors, giving us specialized expertise in the legal issues that matter most to Barefoot Bay residents. We offer a free initial consultation to all community members and provide clear, fixed-fee pricing so there are never any surprises. For clients with mobility challenges, we gladly provide in-home visits throughout Barefoot Bay at no additional charge. We pride ourselves on explaining complex legal concepts in plain English, ensuring you fully understand all your options before making decisions.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-4321</p>
          <p><strong>Email:</strong> info@floridaseniorslaw.com</p>
          <p><strong>Website:</strong> www.floridaseniorslaw.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Thursday: 9:00 AM - 4:00 PM</p>
          <p>Friday: 9:00 AM - 1:00 PM</p>
          <p>Evenings and weekends by appointment</p>
          <p>Home visits available throughout Barefoot Bay</p>
          
          <h3>Location</h3>
          <p>6543 US Highway 1, Suite 201</p>
          <p>Sebastian, FL 32958</p>
        </div>`
    });
    
    vendors.push({
      title: "Barefoot Bay Tax Solutions",
      slug: `vendors-${category.slug}-barefoot-bay-tax-solutions`,
      content: `<h2>Barefoot Bay Tax Solutions</h2>
        <div class="vendor-description">
          <p>Barefoot Bay Tax Solutions has been providing specialized tax preparation and planning services to our community since 2011. We focus on the unique tax situations faced by retirees, seasonal residents, and seniors transitioning into retirement.</p>
          
          <p>Our firm was established by Mark Anderson, CPA, a tax professional with over 25 years of experience working with retirees and multi-state tax situations. Our team includes Enrolled Agents and tax preparers who specialize in senior tax issues and stay current with the constantly changing tax laws.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Individual tax preparation</li>
            <li>Retirement tax planning</li>
            <li>Multi-state tax returns for seasonal residents</li>
            <li>Required Minimum Distribution planning</li>
            <li>Social Security taxation strategies</li>
            <li>Tax-efficient charitable giving</li>
            <li>IRS representation and problem resolution</li>
            <li>Florida homestead exemption assistance</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our specialized knowledge of retiree tax issues helps Barefoot Bay residents minimize their tax burden while staying compliant with tax laws. We understand the complexities facing seasonal residents who maintain homes in multiple states and can help navigate these multi-state tax challenges. Our convenient location near Barefoot Bay and reasonable, transparent fee structure make professional tax help accessible to all community members. We offer year-round service, not just during tax season, providing ongoing support for all your tax-related questions.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-6543</p>
          <p><strong>Email:</strong> info@barefootbaytax.com</p>
          <p><strong>Website:</strong> www.barefootbaytax.com</p>
          
          <h3>Hours of Operation</h3>
          <p>January - April 15:</p>
          <p>Monday - Friday: 8:00 AM - 6:00 PM</p>
          <p>Saturday: 9:00 AM - 2:00 PM</p>
          <p>April 16 - December:</p>
          <p>Monday - Thursday: 9:00 AM - 4:00 PM</p>
          <p>Friday: 9:00 AM - 1:00 PM</p>
          
          <h3>Location</h3>
          <p>9876 Micco Road, Suite B</p>
          <p>Micco, FL 32976</p>
          <p>Just 5 minutes from Barefoot Bay</p>
        </div>`
    });
  }
  
  // RETAIL VENDORS
  else if (category.slug === "retail") {
    vendors.push({
      title: "Barefoot Bay Gift & Souvenir Shop",
      slug: `vendors-${category.slug}-barefoot-bay-gift-souvenir-shop`,
      content: `<h2>Barefoot Bay Gift & Souvenir Shop</h2>
        <div class="vendor-description">
          <p>Barefoot Bay Gift & Souvenir Shop has been the community's favorite source for local mementos, gifts, and Florida-themed merchandise since 2010. Our locally owned boutique specializes in unique items that celebrate the Barefoot Bay and Treasure Coast lifestyle.</p>
          
          <p>Founded by long-time residents Barbara and Richard Martin, our shop grew from a passion for supporting local artisans and providing residents and visitors with quality keepsakes that capture the spirit of our beautiful coastal community.</p>
          
          <h3>Our Products</h3>
          <ul>
            <li>Barefoot Bay branded apparel and accessories</li>
            <li>Florida-themed home décor and gifts</li>
            <li>Handcrafted items by local artisans</li>
            <li>Beach accessories and casual wear</li>
            <li>Greeting cards and stationery</li>
            <li>Gourmet Florida food products</li>
            <li>Books by local authors</li>
            <li>Gifts for visiting family and friends</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our shop offers a carefully curated selection of products you won't find at chain stores, with many items handcrafted by local artisans. We take pride in our personalized service and gift-wrapping, making it easy to find the perfect present for any occasion. As Barefoot Bay residents ourselves, we understand the community and carry products that reflect our unique lifestyle. We offer a 10% discount to all Barefoot Bay residents with ID, and our convenient location makes shopping local easy and enjoyable.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-7890</p>
          <p><strong>Email:</strong> shop@barefootbaygifts.com</p>
          <p><strong>Website:</strong> www.barefootbaygifts.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Saturday: 10:00 AM - 5:00 PM</p>
          <p>Sunday: 12:00 PM - 4:00 PM</p>
          <p>Extended hours during holiday season</p>
          
          <h3>Location</h3>
          <p>5432 Barefoot Bay Blvd</p>
          <p>Barefoot Bay, FL 32976</p>
        </div>`
    });
    
    vendors.push({
      title: "Coastal Home Furnishings",
      slug: `vendors-${category.slug}-coastal-home-furnishings`,
      content: `<h2>Coastal Home Furnishings</h2>
        <div class="vendor-description">
          <p>Coastal Home Furnishings has been serving Barefoot Bay and the Treasure Coast since 2007, specializing in stylish, durable furniture and home décor designed specifically for Florida coastal living.</p>
          
          <p>Our showroom features carefully selected pieces that combine beauty, comfort, and practicality for the Florida lifestyle. We understand the unique considerations of furnishing homes in our climate and offer products that withstand humidity while maintaining their appearance and comfort.</p>
          
          <h3>Our Products & Services</h3>
          <ul>
            <li>Indoor and outdoor furniture collections</li>
            <li>Florida-friendly fabrics and materials</li>
            <li>Coastal-inspired home décor and accessories</li>
            <li>Custom upholstery and design services</li>
            <li>Space planning and interior design consultation</li>
            <li>Patio and lanai furnishings</li>
            <li>Mattresses and bedroom collections</li>
            <li>White-glove delivery and setup</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our furniture specialists understand the unique needs of Florida homes, from humidity-resistant materials to scale and proportion for Florida floor plans. We offer complimentary design consultations to help you create a cohesive, beautiful space that reflects your personal style while addressing practical concerns like durability and maintenance. Our pricing is competitive with larger chain stores, but with personalized service you won't find elsewhere. We offer special discounts for Barefoot Bay residents and convenient delivery scheduling for seasonal homeowners.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-3456</p>
          <p><strong>Email:</strong> info@coastalhomefurnishings.com</p>
          <p><strong>Website:</strong> www.coastalhomefurnishings.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Saturday: 10:00 AM - 6:00 PM</p>
          <p>Sunday: 12:00 PM - 5:00 PM</p>
          <p>Evening appointments available by request</p>
          
          <h3>Location</h3>
          <p>8765 US Highway 1</p>
          <p>Sebastian, FL 32958</p>
          <p>Just 15 minutes from Barefoot Bay</p>
        </div>`
    });
    
    vendors.push({
      title: "Florida Garden Center & Nursery",
      slug: `vendors-${category.slug}-florida-garden-center-nursery`,
      content: `<h2>Florida Garden Center & Nursery</h2>
        <div class="vendor-description">
          <p>Florida Garden Center & Nursery has been helping Barefoot Bay residents create beautiful, sustainable landscapes since 2004. We specialize in Florida-friendly plants, garden supplies, and expert advice tailored to our unique growing conditions.</p>
          
          <p>Our locally owned garden center is operated by Florida Master Gardeners with decades of experience in coastal horticulture. We grow many of our plants on-site, ensuring they're already acclimated to local conditions and ready to thrive in your landscape.</p>
          
          <h3>Our Products & Services</h3>
          <ul>
            <li>Native Florida plants and trees</li>
            <li>Salt-tolerant coastal varieties</li>
            <li>Drought-resistant landscaping options</li>
            <li>Organic soils, mulches, and amendments</li>
            <li>Garden tools and supplies</li>
            <li>Decorative pottery and garden art</li>
            <li>Free gardening workshops</li>
            <li>Landscape design consultation</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our extensive knowledge of Florida horticulture helps you select plants that will thrive in your specific microclimate with minimal maintenance. Unlike big box stores, we carry varieties specifically chosen for success in Barefoot Bay's conditions and can provide detailed care instructions for everything we sell. Our weekly gardening workshops address specific challenges of Florida gardening, from pest management to water conservation. We offer delivery service to Barefoot Bay residents and provide a one-year guarantee on most trees and shrubs when planted according to our guidelines.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-9876</p>
          <p><strong>Email:</strong> plants@floridagardencenter.com</p>
          <p><strong>Website:</strong> www.floridagardencenter.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Saturday: 8:00 AM - 5:30 PM</p>
          <p>Sunday: 9:00 AM - 4:00 PM</p>
          <p>Summer hours (June-August): Closed Sundays</p>
          
          <h3>Location</h3>
          <p>7654 Micco Road</p>
          <p>Micco, FL 32976</p>
          <p>Just 5 minutes from Barefoot Bay</p>
        </div>`
    });
  }
  
  // AUTOMOTIVE VENDORS
  else if (category.slug === "automotive") {
    vendors.push({
      title: "Barefoot Bay Auto Care",
      slug: `vendors-${category.slug}-barefoot-bay-auto-care`,
      content: `<h2>Barefoot Bay Auto Care</h2>
        <div class="vendor-description">
          <p>Barefoot Bay Auto Care has been keeping community vehicles running smoothly since 2008. Our family-owned shop specializes in comprehensive automotive maintenance and repair services with a focus on honest advice and quality workmanship.</p>
          
          <p>Founded by master technician Robert Johnson, our team includes ASE-certified mechanics with decades of combined experience. We're committed to providing transparent service without unnecessary upsells or confusing technical jargon.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Complete vehicle maintenance</li>
            <li>Air conditioning service and repair</li>
            <li>Brake system service</li>
            <li>Engine diagnostics and repair</li>
            <li>Electrical system troubleshooting</li>
            <li>Tire sales and service</li>
            <li>Pre-purchase inspections</li>
            <li>Vehicle storage preparation</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>We understand the unique needs of Barefoot Bay residents, including seasonal vehicle storage concerns and Florida-specific maintenance requirements. Our courtesy shuttle service makes dropping off your vehicle convenient, and we offer priority scheduling for urgent repairs. We provide clear explanations of all recommended services and respect your decisions without pressure tactics. Our technicians receive ongoing training to stay current with evolving automotive technology, ensuring we can service both older and newer vehicles with equal expertise.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-1234</p>
          <p><strong>Email:</strong> service@barefootbayauto.com</p>
          <p><strong>Website:</strong> www.barefootbayauto.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 7:30 AM - 5:30 PM</p>
          <p>Saturday: 8:00 AM - 1:00 PM</p>
          <p>Sunday: Closed</p>
          
          <h3>Location</h3>
          <p>12345 US Highway 1</p>
          <p>Sebastian, FL 32958</p>
          <p>Just 10 minutes from Barefoot Bay</p>
        </div>`
    });
    
    vendors.push({
      title: "Golf Cart Specialists of Florida",
      slug: `vendors-${category.slug}-golf-cart-specialists-of-florida`,
      content: `<h2>Golf Cart Specialists of Florida</h2>
        <div class="vendor-description">
          <p>Golf Cart Specialists of Florida has been serving Barefoot Bay residents since 2011, providing sales, service, and customization of golf carts and neighborhood electric vehicles. We specialize in making your cart reliable, comfortable, and personalized to your needs.</p>
          
          <p>Our business was founded by Tom Wilson, a golf cart technician with over 20 years of experience working with all major brands. We understand how important these vehicles are for Barefoot Bay residents' mobility and independence, so we focus on prompt service and quality workmanship.</p>
          
          <h3>Our Products & Services</h3>
          <ul>
            <li>New and pre-owned golf cart sales</li>
            <li>Comprehensive maintenance and repairs</li>
            <li>Battery replacement and electrical system service</li>
            <li>Customization and upgrades</li>
            <li>Lift kits and performance enhancements</li>
            <li>Accessories and personalization</li>
            <li>Insurance-approved safety features</li>
            <li>Mobile service available in Barefoot Bay</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our specialized knowledge of golf carts and neighborhood electric vehicles ensures that repairs are done right the first time. We offer mobile service throughout Barefoot Bay, bringing our expertise directly to your home for convenience. Our pre-owned carts undergo a rigorous 30-point inspection, and we stand behind our work with a solid warranty. We also provide seasonal maintenance programs and storage preparation services specifically designed for part-time residents.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-6789</p>
          <p><strong>Email:</strong> info@golfcartspecialistsfl.com</p>
          <p><strong>Website:</strong> www.golfcartspecialistsfl.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 8:00 AM - 5:00 PM</p>
          <p>Saturday: 9:00 AM - 3:00 PM</p>
          <p>Sunday: Closed</p>
          <p>Mobile service: By appointment throughout Barefoot Bay</p>
          
          <h3>Location</h3>
          <p>6789 US Highway 1</p>
          <p>Sebastian, FL 32958</p>
          <p>Serving all of Barefoot Bay with mobile service</p>
        </div>`
    });
    
    vendors.push({
      title: "Sunshine State Mobile Detailing",
      slug: `vendors-${category.slug}-sunshine-state-mobile-detailing`,
      content: `<h2>Sunshine State Mobile Detailing</h2>
        <div class="vendor-description">
          <p>Sunshine State Mobile Detailing has been keeping Barefoot Bay vehicles looking their best since 2014. We bring professional auto detailing services directly to your driveway, saving you time while providing exceptional results.</p>
          
          <p>Our company was founded by Michael Davis, who built his expertise detailing high-end vehicles for luxury car dealerships. We use professional-grade products and techniques to restore and maintain your vehicle's appearance, while protecting it from Florida's harsh environmental conditions.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Full exterior and interior detailing</li>
            <li>Paint correction and polishing</li>
            <li>Ceramic coating application</li>
            <li>Headlight restoration</li>
            <li>Leather conditioning and repair</li>
            <li>Engine bay cleaning</li>
            <li>Golf cart detailing</li>
            <li>Pre-storage detailing for seasonal residents</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our mobile service means you don't have to leave the comfort of your home - we bring everything needed to perform professional detailing right in your driveway. We understand the unique challenges Florida's climate poses to vehicles, from sun damage to salt air exposure, and use specialized techniques to combat these issues. Our water reclamation system ensures environmental responsibility, and we offer special packages for seasonal residents preparing vehicles for storage. We also provide golf cart detailing services, which many detailers won't tackle.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-9876</p>
          <p><strong>Email:</strong> schedule@sunshinestatedetailing.com</p>
          <p><strong>Website:</strong> www.sunshinestatedetailing.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Saturday: 8:00 AM - 6:00 PM</p>
          <p>Service by appointment throughout Barefoot Bay</p>
          <p>Early morning and evening appointments available</p>
          
          <h3>Service Area</h3>
          <p>Mobile service throughout Barefoot Bay and surrounding communities</p>
        </div>`
    });
  }
  
  // TECHNOLOGY VENDORS
  else if (category.slug === "technology") {
    vendors.push({
      title: "Senior Tech Solutions",
      slug: `vendors-${category.slug}-senior-tech-solutions`,
      content: `<h2>Senior Tech Solutions</h2>
        <div class="vendor-description">
          <p>Senior Tech Solutions has been serving Barefoot Bay residents since 2013, providing friendly, patient technology support specifically designed for older adults. We help you navigate the digital world with confidence, offering everything from device setup to personalized training.</p>
          
          <p>Our company was founded by James Wilson, a technology educator with a passion for making technology accessible to seniors. Our team of patient, respectful tech experts specializes in explaining complex concepts in clear, understandable terms without confusing jargon or rushed service.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>In-home computer and device setup</li>
            <li>One-on-one technology training</li>
            <li>Smartphone and tablet assistance</li>
            <li>Computer troubleshooting and repair</li>
            <li>WiFi network setup and security</li>
            <li>Email and social media assistance</li>
            <li>Video calling setup for connecting with family</li>
            <li>Smart home device installation</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>We understand the unique frustrations seniors may face with technology and provide patient, respectful support without making you feel rushed or inadequate. Our in-home service means you learn on your own devices in a comfortable environment. We offer both one-time assistance and ongoing support plans with priority scheduling for emergencies. Our "Tech Made Simple" workshops cover popular topics like smartphone basics, internet safety, and connecting with family online, and are held regularly in the Barefoot Bay community center.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-2468</p>
          <p><strong>Email:</strong> help@seniortechsolutions.com</p>
          <p><strong>Website:</strong> www.seniortechsolutions.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 9:00 AM - 5:00 PM</p>
          <p>Saturday: By appointment only</p>
          <p>Sunday: Closed</p>
          <p>Evening appointments available upon request</p>
          
          <h3>Service Area</h3>
          <p>In-home service throughout Barefoot Bay and surrounding communities</p>
        </div>`
    });
    
    vendors.push({
      title: "Coastal Computer Services",
      slug: `vendors-${category.slug}-coastal-computer-services`,
      content: `<h2>Coastal Computer Services</h2>
        <div class="vendor-description">
          <p>Coastal Computer Services has been providing reliable technology solutions to Barefoot Bay residents and businesses since 2009. We offer comprehensive computer repair, network setup, and IT support with a focus on prompt, affordable service.</p>
          
          <p>Our company was founded by Michael Chen, an IT professional with over 20 years of experience. We pride ourselves on explaining technical issues in plain English and offering honest assessments of the most cost-effective solutions for your needs.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Computer and laptop repair</li>
            <li>Virus and malware removal</li>
            <li>Data recovery and backup solutions</li>
            <li>Home network installation and security</li>
            <li>Smart TV and home entertainment setup</li>
            <li>New computer setup and data transfer</li>
            <li>Remote support and monitoring</li>
            <li>Hardware upgrades and optimization</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our technicians are certified professionals who stay current with the latest technology developments. We offer both in-shop repair at our nearby location and convenient in-home service throughout Barefoot Bay. Our transparent pricing means no surprises, with estimates provided before any work begins. We prioritize data security and privacy, ensuring your personal information remains protected. Many of our clients are seniors, and we take extra time to ensure you understand the work we've done and how to prevent future issues.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-7890</p>
          <p><strong>Email:</strong> support@coastalcomputerservices.com</p>
          <p><strong>Website:</strong> www.coastalcomputerservices.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Shop Hours:</p>
          <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
          <p>Saturday: 10:00 AM - 4:00 PM</p>
          <p>In-home Service:</p>
          <p>Monday - Saturday: By appointment</p>
          
          <h3>Location</h3>
          <p>8765 Sebastian Blvd</p>
          <p>Sebastian, FL 32958</p>
          <p>In-home service throughout Barefoot Bay</p>
        </div>`
    });
    
    vendors.push({
      title: "Florida Smart Home Solutions",
      slug: `vendors-${category.slug}-florida-smart-home-solutions`,
      content: `<h2>Florida Smart Home Solutions</h2>
        <div class="vendor-description">
          <p>Florida Smart Home Solutions has been helping Barefoot Bay residents enhance their homes with user-friendly technology since 2016. We specialize in designing and installing smart home systems that improve convenience, security, and energy efficiency.</p>
          
          <p>Our founder, David Martinez, brings 15 years of experience in home automation and security. We focus on creating customized solutions that are simple to use, reliable, and appropriate for your specific needs and technical comfort level.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Smart lighting and thermostat installation</li>
            <li>Voice-controlled home automation</li>
            <li>Video doorbell and security cameras</li>
            <li>Wireless home security systems</li>
            <li>Automated shade and blind control</li>
            <li>Whole-home audio and entertainment systems</li>
            <li>Remote home monitoring for seasonal residents</li>
            <li>Energy management solutions</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>We design systems with seniors in mind, focusing on intuitive interfaces and practical benefits rather than unnecessarily complex technology. Our thorough training ensures you're comfortable using your new systems, with printed guides and video tutorials created specifically for your installation. We offer remote support and monitoring options that are particularly valuable for seasonal residents who want to keep an eye on their Florida home while away. All installations come with our "No-Worry Warranty" and ongoing technical support.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-3698</p>
          <p><strong>Email:</strong> info@floridasmarthomesolutions.com</p>
          <p><strong>Website:</strong> www.floridasmarthomesolutions.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Monday - Friday: 8:30 AM - 5:30 PM</p>
          <p>Saturday: By appointment only</p>
          <p>Installations scheduled at client convenience</p>
          
          <h3>Service Area</h3>
          <p>Serving Barefoot Bay and all of Brevard and Indian River Counties</p>
        </div>`
    });
  }
  
  // OTHER VENDORS
  else if (category.slug === "other") {
    vendors.push({
      title: "Barefoot Bay Home Watch Services",
      slug: `vendors-${category.slug}-barefoot-bay-home-watch-services`,
      content: `<h2>Barefoot Bay Home Watch Services</h2>
        <div class="vendor-description">
          <p>Barefoot Bay Home Watch Services has been protecting part-time residents' properties since 2010. We provide professional home monitoring for seasonal homeowners, ensuring your property remains secure and well-maintained while you're away.</p>
          
          <p>Founded by former law enforcement officer James Sullivan, our company is fully licensed, insured, and accredited by the National Home Watch Association. Our team of trustworthy professionals treats your home with the same care and attention we would give our own.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Regular interior and exterior home inspections</li>
            <li>Customized inspection schedules and checklists</li>
            <li>Detailed reports with photos after each visit</li>
            <li>Storm preparation and post-storm inspections</li>
            <li>Coordination with repair services when needed</li>
            <li>Mail collection and package receiving</li>
            <li>Pre-arrival home preparation</li>
            <li>Concierge services for returning residents</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our extensive experience with Barefoot Bay properties means we understand the specific issues that can affect homes in our community. We're familiar with area-specific concerns such as humidity control, pest prevention, and hurricane preparedness. Our detailed reporting system provides peace of mind with photographic documentation and secure online access to your inspection history. We're available 24/7 for emergency situations and have an established network of trusted vendors if repairs are needed. All staff are background-checked, bonded, and highly trained in home monitoring best practices.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-4567</p>
          <p><strong>Email:</strong> service@barefootbayhomewatch.com</p>
          <p><strong>Website:</strong> www.barefootbayhomewatch.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Office Hours:</p>
          <p>Monday - Friday: 9:00 AM - 4:00 PM</p>
          <p>Home inspections performed 7 days a week</p>
          <p>24/7 emergency response for clients</p>
          
          <h3>Service Area</h3>
          <p>Exclusively serving the Barefoot Bay community</p>
        </div>`
    });
    
    vendors.push({
      title: "Florida Pet Sitting & Dog Walking",
      slug: `vendors-${category.slug}-florida-pet-sitting-dog-walking`,
      content: `<h2>Florida Pet Sitting & Dog Walking</h2>
        <div class="vendor-description">
          <p>Florida Pet Sitting & Dog Walking has been caring for Barefoot Bay pets since 2012. We provide loving, reliable pet care in your home, allowing your furry family members to maintain their routine and comfort while you're away.</p>
          
          <p>Founded by certified veterinary technician Sarah Johnson, our team consists of animal lovers with professional training in pet care. We're fully insured, bonded, and committed to providing the highest standard of care for your beloved pets.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Daily dog walking and exercise</li>
            <li>In-home pet sitting visits</li>
            <li>Overnight pet sitting</li>
            <li>Medication administration</li>
            <li>Pet taxi to veterinary appointments</li>
            <li>Plant watering and mail collection</li>
            <li>Regular updates with photos and videos</li>
            <li>Special care for senior pets</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our professional approach to pet sitting includes a comprehensive initial consultation to understand your pet's specific needs, routines, and preferences. We're trained in pet first aid and CPR, and our veterinary background helps us recognize potential health concerns early. We provide secure access to daily visit reports through our online portal, complete with photos or videos of your pet enjoying their care. For Barefoot Bay residents, we offer flexible scheduling options ideal for medical appointments, day trips, or extended vacations.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (772) 555-8765</p>
          <p><strong>Email:</strong> care@floridapetsitting.com</p>
          <p><strong>Website:</strong> www.floridapetsitting.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Pet Care Services:</p>
          <p>7 days a week, 6:00 AM - 9:00 PM</p>
          <p>Office Hours:</p>
          <p>Monday - Friday: 9:00 AM - 5:00 PM</p>
          
          <h3>Service Area</h3>
          <p>Serving Barefoot Bay, Micco, Sebastian, and surrounding areas</p>
        </div>`
    });
    
    vendors.push({
      title: "Barefoot Bay Estate Sales & Downsizing",
      slug: `vendors-${category.slug}-barefoot-bay-estate-sales-downsizing`,
      content: `<h2>Barefoot Bay Estate Sales & Downsizing</h2>
        <div class="vendor-description">
          <p>Barefoot Bay Estate Sales & Downsizing has been helping community residents with life transitions since 2014. We specialize in organizing and conducting professional estate sales, downsizing assistance, and relocation services tailored to seniors' needs.</p>
          
          <p>Founded by Barbara Martin, a certified senior move manager with a background in antiques and valuables, our compassionate team understands the emotional and logistical challenges of downsizing or managing a loved one's estate. We provide comprehensive services to make these transitions as smooth and stress-free as possible.</p>
          
          <h3>Our Services</h3>
          <ul>
            <li>Professional estate sales and liquidation</li>
            <li>Downsizing and decluttering assistance</li>
            <li>Senior move management</li>
            <li>Appraisal of antiques and collectibles</li>
            <li>Donation coordination</li>
            <li>Clean-out and preparation for home sale</li>
            <li>Consignment of valuable items</li>
            <li>Digital inventory of possessions</li>
          </ul>
          
          <h3>Why Choose Us</h3>
          <p>Our specialized experience with Barefoot Bay properties gives us unique insight into the local market and buyers. We handle every aspect of an estate sale or downsizing project with sensitivity and respect, understanding that these transitions often come during emotional times. Our professional staging and marketing attract serious buyers, maximizing returns for our clients. We're fully bonded and insured, providing detailed accounting of all sales and transparent fee structures. For downsizing clients, we help prioritize what to keep, sell, donate, or discard, making the process manageable and less overwhelming.</p>
        </div>
        
        <div class="vendor-contact">
          <h3>Contact Information</h3>
          <p><strong>Phone:</strong> (321) 555-9876</p>
          <p><strong>Email:</strong> info@barefootbayestatesales.com</p>
          <p><strong>Website:</strong> www.barefootbayestatesales.com</p>
          
          <h3>Hours of Operation</h3>
          <p>Office Hours:</p>
          <p>Monday - Friday: 9:00 AM - 4:00 PM</p>
          <p>Estate Sales: Typically Friday-Sunday</p>
          <p>Consultations: By appointment</p>
          
          <h3>Service Area</h3>
          <p>Barefoot Bay, Sebastian, Micco, and surrounding communities</p>
        </div>`
    });
  }
  
  return vendors;
}

// Run the script
generateVendorContent();