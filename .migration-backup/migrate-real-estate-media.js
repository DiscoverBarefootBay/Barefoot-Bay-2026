/**
 * Migration script to transfer existing real estate media from filesystem to Replit Object Storage
 * 
 * This script:
 * 1. Scans both /uploads/real-estate-media and /real-estate-media directories
 * 2. Uploads each file to Replit Object Storage
 * 3. Updates database entries to use the new Object Storage URLs
 * 4. Creates a backup list of old paths mapped to new paths
 * 
 * Usage:
 * node migrate-real-estate-media.js
 */

import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { eq, sql, like } from 'drizzle-orm';
import { Client } from "@replit/object-storage";

// Define schema directly in this file to avoid import issues
const realEstateListings = {
  id: 'id',
  photos: 'photos'
};

// Set up __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Directories to scan
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'real-estate-media');
const DIRECT_DIR = path.join(__dirname, 'real-estate-media');
const REAL_ESTATE_MEDIA_PREFIX = "real-estate-media/";

// Create a migration mapping file
const MIGRATION_MAPPING_FILE = path.join(__dirname, 'real-estate-media-migration-mapping.json');
const migrationMapping = {};

// Initialize Object Storage client
const client = new Client();

// Initialize Postgres connection
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
const queryClient = postgres(connectionString);
const db = drizzle(queryClient);

/**
 * Upload a file to Object Storage
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - Object Storage key
 */
async function uploadToObjectStorage(filePath) {
  try {
    const fileName = path.basename(filePath);
    const storageKey = `${REAL_ESTATE_MEDIA_PREFIX}${fileName}`;
    
    // Upload to Object Storage using the uploadFromFilename method
    const { ok, error } = await client.uploadFromFilename(storageKey, filePath);
    
    if (!ok) {
      throw new Error(`Failed to upload ${fileName} to Object Storage: ${error}`);
    }
    
    console.log(`Successfully uploaded ${fileName} to Object Storage`);
    return storageKey;
  } catch (error) {
    console.error(`Error uploading file to Object Storage: ${error.message}`);
    throw error;
  }
}

/**
 * Update a listing's photo URLs in the database
 * @param {number} listingId - Listing ID
 * @param {Array<string>} oldPhotos - Old photo URLs
 * @param {Object} pathMapping - Mapping of old paths to new storage keys
 */
async function updateListingPhotos(listingId, oldPhotos, pathMapping) {
  try {
    // Replace old paths with new Object Storage paths
    const newPhotos = oldPhotos.map(photo => {
      const fileName = path.basename(photo);
      // Check if we have a mapping for this file
      const newPath = pathMapping[photo] || pathMapping[`/uploads/real-estate-media/${fileName}`] || 
                      pathMapping[`/real-estate-media/${fileName}`];
      
      if (newPath) {
        return newPath;
      }
      
      // If we don't have a mapping but the URL looks like a real estate media URL,
      // construct the Object Storage path
      if (photo.includes('real-estate-media')) {
        return `${REAL_ESTATE_MEDIA_PREFIX}${fileName}`;
      }
      
      // Otherwise return the original URL
      return photo;
    });
    
    // Update the listing in the database using raw SQL
    await queryClient`
      UPDATE real_estate_listings 
      SET photos = ${newPhotos}
      WHERE id = ${listingId}
    `;
    
    console.log(`Updated photos for listing ID ${listingId}`);
  } catch (error) {
    console.error(`Error updating listing photos: ${error.message}`);
    throw error;
  }
}

/**
 * Get all real estate listings from the database
 */
async function getAllListings() {
  try {
    // Use raw SQL to get listings
    const listings = await queryClient`
      SELECT id, photos FROM real_estate_listings
      WHERE photos IS NOT NULL AND array_length(photos, 1) > 0
    `;
    console.log(`Found ${listings.length} listings in database with photos`);
    return listings;
  } catch (error) {
    console.error(`Error getting listings: ${error.message}`);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrateRealEstateMedia() {
  // Ensure directories exist
  if (!fs.existsSync(UPLOADS_DIR) && !fs.existsSync(DIRECT_DIR)) {
    console.error('No real estate media directories found. Nothing to migrate.');
    process.exit(1);
  }
  
  const processedFiles = new Set();
  let totalMigrated = 0;
  
  // Process uploads directory if it exists
  if (fs.existsSync(UPLOADS_DIR)) {
    const uploadsFiles = fs.readdirSync(UPLOADS_DIR).filter(file => 
      !file.startsWith('.') && fs.statSync(path.join(UPLOADS_DIR, file)).isFile()
    );
    
    console.log(`Found ${uploadsFiles.length} files in ${UPLOADS_DIR}`);
    
    for (const file of uploadsFiles) {
      if (processedFiles.has(file)) continue;
      
      const filePath = path.join(UPLOADS_DIR, file);
      try {
        const storageKey = await uploadToObjectStorage(filePath);
        
        // Add to mapping
        migrationMapping[`/uploads/real-estate-media/${file}`] = storageKey;
        migrationMapping[`/real-estate-media/${file}`] = storageKey;
        
        processedFiles.add(file);
        totalMigrated++;
      } catch (error) {
        console.error(`Failed to migrate ${file}: ${error.message}`);
      }
    }
  }
  
  // Process direct directory if it exists
  if (fs.existsSync(DIRECT_DIR)) {
    const directFiles = fs.readdirSync(DIRECT_DIR).filter(file => 
      !file.startsWith('.') && fs.statSync(path.join(DIRECT_DIR, file)).isFile()
    );
    
    console.log(`Found ${directFiles.length} files in ${DIRECT_DIR}`);
    
    for (const file of directFiles) {
      if (processedFiles.has(file)) continue;
      
      const filePath = path.join(DIRECT_DIR, file);
      try {
        const storageKey = await uploadToObjectStorage(filePath);
        
        // Add to mapping
        migrationMapping[`/uploads/real-estate-media/${file}`] = storageKey;
        migrationMapping[`/real-estate-media/${file}`] = storageKey;
        
        processedFiles.add(file);
        totalMigrated++;
      } catch (error) {
        console.error(`Failed to migrate ${file}: ${error.message}`);
      }
    }
  }
  
  // Save the migration mapping
  fs.writeFileSync(
    MIGRATION_MAPPING_FILE, 
    JSON.stringify(migrationMapping, null, 2)
  );
  
  console.log(`Migrated ${totalMigrated} files to Object Storage`);
  console.log(`Migration mapping saved to ${MIGRATION_MAPPING_FILE}`);
  
  // Now update database entries
  const listings = await getAllListings();
  let updatedListings = 0;
  
  for (const listing of listings) {
    if (listing.photos && listing.photos.length > 0) {
      try {
        await updateListingPhotos(listing.id, listing.photos, migrationMapping);
        updatedListings++;
      } catch (error) {
        console.error(`Failed to update listing ${listing.id}: ${error.message}`);
      }
    }
  }
  
  console.log(`Updated ${updatedListings} listings in the database`);
  console.log('Migration completed');
  
  // Close database connection
  await queryClient.end();
}

// Run the migration
migrateRealEstateMedia().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});