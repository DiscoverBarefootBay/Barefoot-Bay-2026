/**
 * Create realistic real estate listings for Barefoot Bay
 * 
 * This script:
 * 1. Downloads images for different real estate categories using the download-real-estate-images.js script
 * 2. Creates realistic listings for each category with appropriate details
 * 3. Inserts the listings into the database
 */

import pg from 'pg';
import { downloadAllRealEstateImages } from './download-real-estate-images.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to the database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
  } else {
    return `${adjective} ${bedrooms} BD/${bathrooms} BA ${propertyType} - ${squareFeet} sqft, ${feature}`;
  }
};

// Generate property description
const generateDescription = (type, bedrooms, bathrooms, squareFeet, yearBuilt) => {
  if (type === 'FSBO' || type === 'Agent') {
    return `This beautiful home features ${bedrooms} bedrooms and ${bathrooms} bathrooms with ${squareFeet} square feet of living space. Built in ${yearBuilt}, this property has been well-maintained and offers a modern kitchen, open floor plan, and a spacious backyard perfect for entertaining. Enjoy the Barefoot Bay community amenities including golf courses, pools, and access to private beaches. Don't miss this opportunity to own your piece of paradise!`;
  } else if (type === 'Rent') {
    return `Available for immediate move-in! This lovely rental property offers ${bedrooms} bedrooms and ${bathrooms} bathrooms in a spacious ${squareFeet} square foot layout. Built in ${yearBuilt}, the home features updated appliances, fresh paint, and a beautifully landscaped yard. Enjoy all the amenities of Barefoot Bay community including golf, tennis, and swimming pools. Lease terms: 12-month minimum, background check required. No pets allowed.`;
  } else if (type === 'OpenHouse') {
    return `Come view this spectacular property during our open house event! This ${yearBuilt} built home offers ${bedrooms} bedrooms, ${bathrooms} bathrooms, and ${squareFeet} square feet of elegant living space. Features include granite countertops, stainless steel appliances, and a covered lanai overlooking a private backyard. Barefoot Bay amenities include community pools, golf courses, and private beach access. Light refreshments will be served. Don't miss this opportunity!`;
  } else if (type === 'Wanted') {
    return `Serious buyer looking for a ${bedrooms}+ bedroom, ${bathrooms}+ bathroom home in Barefoot Bay. Prefer approximately ${squareFeet} square feet with modern updates, and willing to consider properties built after ${yearBuilt}. Must have garage and would love a water view or pool. Pre-approved for financing and ready to move quickly for the right property. Please contact with details if you're thinking of selling!`;
  } else if (type === 'Classified') {
    return `Moving sale in Barefoot Bay! Quality home furniture available including ${bedrooms} bedroom sets, dining room table with ${bathrooms} chairs, and living room furniture. All items are in excellent condition from our ${yearBuilt} built, ${squareFeet} sq ft home. Available for pickup only. Cash only, please contact for viewing appointment and pricing.`;
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

// Main function to create listings
async function createRealEstateListings() {
  console.log('Starting to create real estate listings...');
  
  try {
    // First, download all the images we need
    console.log('Downloading real estate images...');
    const imageResults = await downloadAllRealEstateImages();
    
    const listingsToCreate = [];
    
    // Create listings for each category
    for (const type of Object.keys(imageResults)) {
      const images = imageResults[type];
      console.log(`Creating listings for type: ${type} with ${images.length} images`);
      
      // Create a listing for each image
      for (const image of images) {
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
          const categories = ['Furniture', 'Garage Sale', 'Home Decor', 'Electronics', 'Sporting Goods'];
          listing.category = categories[Math.floor(Math.random() * categories.length)];
        }
        
        listingsToCreate.push(listing);
      }
    }
    
    console.log(`Prepared ${listingsToCreate.length} listings to insert into database`);
    
    // Insert all listings into the database
    for (const listing of listingsToCreate) {
      const contactInfoJson = JSON.stringify(listing.contactInfo);
      const photosArray = listing.photos ? `{${listing.photos.map(p => `"${p}"`).join(',')}}` : '{}';
      
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
        console.log(`Created listing ID: ${result.rows[0].id}`);
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

// Run the main function if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createRealEstateListings()
    .then(() => console.log('Process completed!'))
    .catch(err => console.error('Error in main process:', err));
}

export { createRealEstateListings };