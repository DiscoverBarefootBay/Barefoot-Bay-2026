/**
 * Create one real estate listing for each category in Barefoot Bay
 * 
 * This script:
 * 1. Downloads one image for each real estate category
 * 2. Creates one listing for each category with appropriate details
 * 3. Inserts the listings into the database
 */

import pg from 'pg';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to the database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Ensure we have the UNSPLASH_ACCESS_KEY
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!UNSPLASH_ACCESS_KEY) {
  console.error('Error: UNSPLASH_ACCESS_KEY environment variable is required');
  process.exit(1);
}

// Define categories to download
const REAL_ESTATE_CATEGORIES = [
  { type: 'FSBO', keywords: ['luxury home', 'residential house'], count: 1 },
  { type: 'Agent', keywords: ['modern house', 'contemporary home'], count: 1 },
  { type: 'Rent', keywords: ['apartment rental', 'condo'], count: 1 },
  { type: 'OpenHouse', keywords: ['open house real estate', 'home tour'], count: 1 },
  { type: 'Wanted', keywords: ['dream home', 'house hunting'], count: 1 },
  { type: 'Classified', keywords: ['home office', 'garage sale'], count: 1 },
];

// Ensure the directory exists
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'Real Estate');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Generate realistic street addresses in Barefoot Bay
const generateBarefootBayAddress = () => {
  const streets = [
    'Barefoot Boulevard', 'Sandpiper Lane', 'Ocean Breeze Drive', 'Seagull Street',
    'Palm Tree Way', 'Beachcomber Avenue', 'Lakeside Circle', 'Sunset Drive',
    'Dolphin Drive', 'Sandy Shores Lane', 'Golfview Drive', 'Marina Way',
    'Coral Reef Road', 'Lighthouse Lane', 'Bayside Drive', 'Pelican Point',
    'Manatee Drive', 'Shell Bay Circle', 'Coconut Grove Avenue', 'Harbor View Drive'
  ];
  
  const street = streets[Math.floor(Math.random() * streets.length)];
  const houseNumber = Math.floor(Math.random() * 9000) + 1000;
  
  return `${houseNumber} ${street}, Barefoot Bay, FL 32976`;
};

// Generate a realistic phone number
const generatePhoneNumber = () => {
  const area = '321';
  const prefix = Math.floor(Math.random() * 900) + 100;
  const line = Math.floor(Math.random() * 9000) + 1000;
  return `(${area}) ${prefix}-${line}`;
};

// Generate contact info for listings
const generateContactInfo = (type) => {
  const agents = [
    { name: 'Sarah Johnson', email: 'sarah.johnson@barefootrealty.com' },
    { name: 'Michael Chen', email: 'michael.chen@barefootrealty.com' },
    { name: 'Emily Rodriguez', email: 'emily.rodriguez@barefootrealty.com' },
    { name: 'David Wilson', email: 'david.wilson@barefootrealty.com' },
    { name: 'Jessica Lee', email: 'jessica.lee@barefootrealty.com' }
  ];
  
  const owners = [
    { name: 'Robert Smith', email: 'rsmith@example.com' },
    { name: 'Jennifer Davis', email: 'jdavis@example.com' },
    { name: 'Thomas Brown', email: 'tbrown@example.com' },
    { name: 'Patricia Garcia', email: 'pgarcia@example.com' },
    { name: 'James Martinez', email: 'jmartinez@example.com' }
  ];
  
  if (type === 'Agent') {
    const agent = agents[Math.floor(Math.random() * agents.length)];
    return {
      name: agent.name,
      phone: generatePhoneNumber(),
      email: agent.email
    };
  } else {
    const owner = owners[Math.floor(Math.random() * owners.length)];
    return {
      name: owner.name,
      phone: generatePhoneNumber(),
      email: owner.email
    };
  }
};

// Generate listing title based on property features
const generateTitle = (type, bedrooms, bathrooms, squareFeet) => {
  const adjectives = ['Beautiful', 'Stunning', 'Charming', 'Elegant', 'Luxurious', 'Cozy', 'Spacious'];
  const propertyTypes = ['Home', 'House', 'Property', 'Residence'];
  const features = ['Waterfront', 'Golf Course', 'Lake View', 'Pool', 'Private Backyard'];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const propertyType = propertyTypes[Math.floor(Math.random() * propertyTypes.length)];
  const feature = features[Math.floor(Math.random() * features.length)];
  
  if (type === 'Rent') {
    return `${adjective} ${bedrooms} BD/${bathrooms} BA ${propertyType} for Rent - ${feature}`;
  } else if (type === 'OpenHouse') {
    return `Open House: ${adjective} ${bedrooms} BD/${bathrooms} BA ${propertyType} - ${feature}`;
  } else if (type === 'Wanted') {
    return `Looking For: ${bedrooms}+ BD/${bathrooms}+ BA ${propertyType} in Barefoot Bay`;
  } else if (type === 'Classified') {
    return `Estate Sale: Quality ${propertyType} Furnishings and Decor`;
  } else {
    return `${adjective} ${bedrooms} BD/${bathrooms} BA ${propertyType} - ${squareFeet} sqft, ${feature}`;
  }
};

// Generate property description
const generateDescription = (type, bedrooms, bathrooms, squareFeet, yearBuilt) => {
  if (type === 'FSBO') {
    return `This beautiful home features ${bedrooms} bedrooms and ${bathrooms} bathrooms with ${squareFeet} square feet of living space. Built in ${yearBuilt}, this property has been well-maintained and offers a modern kitchen, open floor plan, and a spacious backyard perfect for entertaining. Enjoy the Barefoot Bay community amenities including golf courses, pools, and access to private beaches. For Sale By Owner - call today to schedule a viewing!`;
  } else if (type === 'Agent') {
    return `Exclusive listing! This stunning home offers ${bedrooms} bedrooms and ${bathrooms} bathrooms with ${squareFeet} square feet of living space. Built in ${yearBuilt}, this property features granite countertops, stainless steel appliances, and a beautifully landscaped yard with covered lanai. Barefoot Bay offers residents access to golf, tennis, and community pools. Contact our office today to schedule your private showing!`;
  } else if (type === 'Rent') {
    return `Available for immediate move-in! This lovely rental property offers ${bedrooms} bedrooms and ${bathrooms} bathrooms in a spacious ${squareFeet} square foot layout. Built in ${yearBuilt}, the home features updated appliances, fresh paint, and a beautifully landscaped yard. Enjoy all the amenities of Barefoot Bay community including golf, tennis, and swimming pools. Lease terms: 12-month minimum, background check required. No pets allowed.`;
  } else if (type === 'OpenHouse') {
    return `Come view this spectacular property during our open house event! This ${yearBuilt} built home offers ${bedrooms} bedrooms, ${bathrooms} bathrooms, and ${squareFeet} square feet of elegant living space. Features include granite countertops, stainless steel appliances, and a covered lanai overlooking a private backyard. Barefoot Bay amenities include community pools, golf courses, and private beach access. Light refreshments will be served. Don't miss this opportunity!`;
  } else if (type === 'Wanted') {
    return `Serious buyer looking for a ${bedrooms}+ bedroom, ${bathrooms}+ bathroom home in Barefoot Bay. Prefer approximately ${squareFeet} square feet with modern updates, and willing to consider properties built after ${yearBuilt}. Must have garage and would love a water view or pool. Pre-approved for financing and ready to move quickly for the right property. Please contact with details if you're thinking of selling!`;
  } else if (type === 'Classified') {
    return `Estate sale in Barefoot Bay! Quality home furnishings and decor available including bedroom sets, dining room table with chairs, and living room furniture. All items are from our ${yearBuilt} built, ${squareFeet} sq ft home and are in excellent condition. Kitchenware, artwork, and patio furniture also available. Saturday and Sunday from 9am-3pm. Cash only, all sales final.`;
  }
};

// Generate open house details
const generateOpenHouseDetails = () => {
  // Generate a date within the next 2 weeks
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + Math.floor(Math.random() * 14) + 1);
  
  // Random start time between 9am and 3pm
  const startHour = Math.floor(Math.random() * 6) + 9;
  const startTime = `${startHour}:00 AM`;
  const endTime = `${startHour + 3}:00 PM`;
  
  return {
    date: futureDate,
    startTime: startTime,
    endTime: endTime
  };
};

/**
 * Find images on Unsplash for a given keyword
 * @param {string} keyword - Search keyword
 * @param {number} count - Number of images to retrieve
 * @returns {Promise<Array>} - Array of image data or empty array if none found
 */
async function findUnsplashImages(keyword, count = 1) {
  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error(`Error finding images for "${keyword}":`, error.message);
    return [];
  }
}

/**
 * Download an image and save to the uploads directory
 * @param {string} url - Image URL
 * @param {string} filename - Target filename
 * @param {Object} metadata - Image metadata to save
 * @returns {Promise<string>} - Local path to the saved image
 */
async function downloadImage(url, filename, metadata) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const filePath = path.join(UPLOAD_DIR, filename);
    await pipeline(response.body, createWriteStream(filePath));

    // Save metadata alongside the image
    const metadataPath = path.join(UPLOAD_DIR, `${path.parse(filename).name}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`Downloaded: ${filename}`);
    return `/uploads/Real Estate/${filename}`;
  } catch (error) {
    console.error(`Error downloading image ${filename}:`, error.message);
    return null;
  }
}

/**
 * Download one image for each real estate category
 */
async function downloadSingleRealEstateImages() {
  console.log('Starting to download real estate images...');
  
  const results = {
    FSBO: [],
    Agent: [],
    Rent: [],
    OpenHouse: [],
    Wanted: [],
    Classified: []
  };

  // Process each category
  for (const category of REAL_ESTATE_CATEGORIES) {
    console.log(`\nProcessing category: ${category.type}`);
    
    // Process the first keyword for this category
    const keyword = category.keywords[0];
    const images = await findUnsplashImages(keyword, 1);
    
    if (images.length > 0) {
      const image = images[0];
      const filename = `${category.type.toLowerCase()}-${keyword.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.jpg`;
      
      const metadata = {
        id: image.id,
        type: category.type,
        keyword: keyword,
        description: image.description || image.alt_description || keyword,
        width: image.width,
        height: image.height,
        color: image.color,
        user: {
          name: image.user.name,
          username: image.user.username,
          portfolio_url: image.user.portfolio_url
        },
        urls: image.urls,
        links: image.links
      };
      
      const localPath = await downloadImage(image.urls.regular, filename, metadata);
      if (localPath) {
        results[category.type].push({
          path: localPath,
          metadata
        });
      }
    }
  }

  // Save the overall summary
  const summaryPath = path.join(UPLOAD_DIR, 'single_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\nSummary saved to ${summaryPath}`);

  return results;
}

// Main function to create listings
async function createSingleRealEstateListings() {
  console.log('Starting to create real estate listings (one per category)...');
  
  try {
    // First, download one image for each category
    console.log('Downloading real estate images...');
    const imageResults = await downloadSingleRealEstateImages();
    
    const listingsToCreate = [];
    
    // Create one listing for each category
    for (const type of Object.keys(imageResults)) {
      const images = imageResults[type];
      if (images.length === 0) {
        console.log(`No images available for type: ${type}, skipping`);
        continue;
      }
      
      console.log(`Creating listing for type: ${type}`);
      const image = images[0];
      
      // Generate basic property details
      const bedrooms = Math.floor(Math.random() * 3) + 2; // 2-4 bedrooms
      const bathrooms = Math.floor(Math.random() * 2) + 1; // 1-2.5 bathrooms
      const squareFeet = (Math.floor(Math.random() * 2000) + 1000); // 1000-3000 sqft
      const yearBuilt = Math.floor(Math.random() * 40) + 1980; // 1980-2020
      const price = type === 'Rent' 
        ? (Math.floor(Math.random() * 1500) + 1500) // Rent: $1500-3000
        : (Math.floor(Math.random() * 400000) + 200000); // Sale: $200k-600k
        
      // Create listing object
      const listing = {
        listingType: type,
        title: generateTitle(type, bedrooms, bathrooms, squareFeet),
        price: price,
        address: generateBarefootBayAddress(),
        bedrooms: bedrooms,
        bathrooms: bathrooms,
        squareFeet: squareFeet,
        yearBuilt: yearBuilt,
        description: generateDescription(type, bedrooms, bathrooms, squareFeet, yearBuilt),
        photos: [image.path],
        contactInfo: generateContactInfo(type),
        isApproved: true, // Auto-approve these listings
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Add open house details if applicable
      if (type === 'OpenHouse') {
        const openHouse = generateOpenHouseDetails();
        listing.openHouseDate = openHouse.date;
        listing.openHouseStartTime = openHouse.startTime;
        listing.openHouseEndTime = openHouse.endTime;
      }
      
      // Add category for classified ads
      if (type === 'Classified') {
        listing.category = 'Estate Sale';
      }
      
      listingsToCreate.push(listing);
    }
    
    console.log(`Prepared ${listingsToCreate.length} listings to insert into database`);
    
    // Insert all listings into the database
    for (const listing of listingsToCreate) {
      const contactInfoJson = JSON.stringify(listing.contactInfo);
      
      const query = `
        INSERT INTO real_estate_listings (
          listing_type, title, price, address, bedrooms, bathrooms, square_feet, 
          year_built, description, photos, cash_only, open_house_date, 
          open_house_start_time, open_house_end_time, contact_info, 
          is_approved, category, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        ) RETURNING id;
      `;
      
      const values = [
        listing.listingType,
        listing.title,
        listing.price,
        listing.address,
        listing.bedrooms,
        listing.bathrooms,
        listing.squareFeet,
        listing.yearBuilt,
        listing.description,
        listing.photos,
        listing.cashOnly || false,
        listing.openHouseDate || null,
        listing.openHouseStartTime || null,
        listing.openHouseEndTime || null,
        contactInfoJson,
        listing.isApproved,
        listing.category || null,
        listing.createdAt,
        listing.updatedAt
      ];
      
      try {
        const result = await pool.query(query, values);
        console.log(`Created listing ID: ${result.rows[0].id} - Type: ${listing.listingType}`);
      } catch (err) {
        console.error('Error inserting listing:', err);
        console.error('Failed listing:', listing);
      }
    }
    
    console.log('All listings created successfully!');
  } catch (error) {
    console.error('Error creating listings:', error);
  } finally {
    pool.end();
  }
}

// Run the main function
createSingleRealEstateListings()
  .then(() => console.log('Process completed!'))
  .catch(err => console.error('Error in main process:', err));