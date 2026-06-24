/**
 * Object Storage utility for managing media files
 * 
 * This utility handles the uploading and management of media files using Replit's Object Storage
 */

import { Client } from "@replit/object-storage";
import { createObjectStorageClient } from "./lib/object-storage-client";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create an object storage client with default configuration
const client = createObjectStorageClient();

// Define the bucket prefix for real estate media
const REAL_ESTATE_MEDIA_PREFIX = "real-estate-media/";

/**
 * Upload a file to the object storage
 * @param filePath The local path to the file
 * @param fileName Optional name for the file (if not provided, uses a UUID + original extension)
 * @returns The URL to the uploaded file in the format 'real-estate-media/{filename}'
 */
export async function uploadRealEstateMedia(filePath: string, fileName?: string): Promise<string> {
  try {
    // Get the file extension
    const ext = path.extname(filePath);
    
    // Generate a unique filename if one isn't provided
    const uniqueFileName = fileName || `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    const storageKey = `${REAL_ESTATE_MEDIA_PREFIX}${uniqueFileName}`;
    
    // Upload to object storage using uploadFromFilename method
    const { ok, error } = await client.uploadFromFilename(storageKey, filePath);
    
    if (!ok) {
      console.error("Error uploading to object storage:", error);
      throw new Error(`Failed to upload file to object storage: ${error}`);
    }
    
    console.log(`Successfully uploaded file to object storage: ${storageKey}`);
    
    // Return the path that will be used for accessing the file
    return storageKey;
  } catch (error) {
    console.error("Error in uploadRealEstateMedia:", error);
    throw error;
  }
}

/**
 * Upload a file buffer directly to object storage
 * @param buffer The file buffer to upload
 * @param originalFilename The original filename (used for extension)
 * @returns The URL to the uploaded file
 */
export async function uploadRealEstateMediaFromBuffer(buffer: Buffer, originalFilename: string): Promise<string> {
  try {
    // Get the file extension
    const ext = path.extname(originalFilename);
    
    // Generate a unique filename
    const uniqueFileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    const storageKey = `${REAL_ESTATE_MEDIA_PREFIX}${uniqueFileName}`;
    
    // Upload to object storage using uploadFromBytes method
    try {
      const { ok, error } = await client.uploadFromBytes(storageKey, buffer);
      
      if (!ok) {
        console.error("Error uploading to object storage:", error);
        // If Object Storage fails, save to local filesystem as fallback
        console.log("Object Storage failed, saving to local filesystem");
        const fallbackPath = path.join(process.cwd(), 'uploads', 'real-estate-media', uniqueFileName);
        await fs.ensureDir(path.dirname(fallbackPath));
        await fs.writeFile(fallbackPath, buffer);
        return `/uploads/real-estate-media/${uniqueFileName}`;
      }
    } catch (storageError) {
      console.error("Object Storage client error:", storageError);
      // If Object Storage client fails, save to local filesystem as fallback
      console.log("Object Storage client failed, saving to local filesystem");
      const fallbackPath = path.join(process.cwd(), 'uploads', 'real-estate-media', uniqueFileName);
      await fs.ensureDir(path.dirname(fallbackPath));
      await fs.writeFile(fallbackPath, buffer);
      return `/uploads/real-estate-media/${uniqueFileName}`;
    }
    
    console.log(`Successfully uploaded file buffer to object storage: ${storageKey}`);
    
    // Return the correct URL format for accessing the file through the storage proxy
    return `/api/storage-proxy/REAL_ESTATE/${storageKey}`;
  } catch (error) {
    console.error("Error in uploadRealEstateMediaFromBuffer:", error);
    throw error;
  }
}

/**
 * List all real estate media files in the object storage
 * @returns Array of media file keys
 */
export async function listRealEstateMedia(): Promise<string[]> {
  try {
    const { ok, value, error } = await client.list({ prefix: REAL_ESTATE_MEDIA_PREFIX });
    
    if (!ok) {
      console.error("Error listing real estate media:", error);
      throw new Error(`Failed to list real estate media: ${error}`);
    }
    
    // Extract just the names from the objects
    return value.map(obj => obj.name);
  } catch (error) {
    console.error("Error in listRealEstateMedia:", error);
    throw error;
  }
}

/**
 * Delete a real estate media file from object storage
 * @param mediaUrl The URL or key of the media file to delete
 * @returns Boolean indicating success
 */
export async function deleteRealEstateMedia(mediaUrl: string): Promise<boolean> {
  try {
    // Extract the key from the URL if it's a full URL
    let key = mediaUrl;
    
    // If it doesn't start with the prefix, add it
    if (!key.startsWith(REAL_ESTATE_MEDIA_PREFIX)) {
      // Extract just the filename part
      const filename = path.basename(mediaUrl);
      key = `${REAL_ESTATE_MEDIA_PREFIX}${filename}`;
    }
    
    const { ok, error } = await client.delete(key);
    
    if (!ok) {
      console.error(`Error deleting ${key} from object storage:`, error);
      return false;
    }
    
    console.log(`Successfully deleted ${key} from object storage`);
    return true;
  } catch (error) {
    console.error("Error in deleteRealEstateMedia:", error);
    return false;
  }
}

/**
 * Get a server-routed URL for a real estate media file
 * Since Replit Object Storage doesn't have a direct method to generate presigned URLs,
 * we use a server-side middleware approach to serve the files
 * 
 * @param mediaKey The key of the media file
 * @param expirationSeconds Not used, but kept for compatibility
 * @returns The URL to access the file through our server middleware
 */
export async function getPresignedUrl(mediaKey: string, expirationSeconds: number = 3600): Promise<string> {
  try {
    // Normalize the key to remove leading slash if present
    const normalizedKey = mediaKey.startsWith('/') ? mediaKey.substring(1) : mediaKey;
    
    // Check if the file exists
    const fileExists = await objectExists(normalizedKey);
    
    if (!fileExists) {
      console.error(`File does not exist in Object Storage: ${normalizedKey}`);
      throw new Error(`File does not exist in Object Storage: ${normalizedKey}`);
    }
    
    // Construct a path that will be routed through our API storage proxy middleware
    // Format: /api/storage-proxy/{BUCKET}/{KEY}
    return `/api/storage-proxy/REAL_ESTATE/${normalizedKey.replace(/^real-estate-media\//, '')}`;
  } catch (error) {
    console.error("Error in getPresignedUrl:", error);
    throw error;
  }
}

/**
 * Normalize media URLs to the proper format for Object Storage
 * @param url The URL to normalize
 * @returns The normalized URL
 */
export function normalizeRealEstateMediaUrl(url: string): string {
  // If this is already an object storage URL, return it as is
  if (url.startsWith(REAL_ESTATE_MEDIA_PREFIX)) {
    return url;
  }
  
  // Check if it's a filesystem URL that needs to be converted
  if (url.includes('/uploads/real-estate-media/') || url.includes('/real-estate-media/')) {
    // Extract the filename
    const filename = path.basename(url);
    return `${REAL_ESTATE_MEDIA_PREFIX}${filename}`;
  }
  
  // Return the original if we can't normalize it
  return url;
}

/**
 * Check if a file exists in object storage
 * @param key The key to check
 * @returns Boolean indicating if the file exists
 */
export async function objectExists(key: string): Promise<boolean> {
  try {
    // Normalize the key to remove leading slash if present
    const normalizedKey = key.startsWith('/') ? key.substring(1) : key;
    
    console.log(`Checking if object exists: ${normalizedKey}`);
    
    // Use the client.exists method which is the correct method for checking existence
    const { ok, value, error } = await client.exists(normalizedKey);
    
    if (!ok) {
      console.error(`Error checking if ${normalizedKey} exists:`, error);
      return false;
    }
    
    return value;
  } catch (error) {
    console.error(`Error checking if ${key} exists:`, error);
    return false;
  }
}

export default {
  uploadRealEstateMedia,
  uploadRealEstateMediaFromBuffer,
  listRealEstateMedia,
  deleteRealEstateMedia,
  getPresignedUrl,
  normalizeRealEstateMediaUrl,
  objectExists,
};