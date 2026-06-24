/**
 * Real Estate Object Storage Middleware
 * 
 * This middleware handles real estate media uploads that are stored in memory buffers
 * rather than on the filesystem, uploading them directly to Object Storage.
 */

import { Request, Response, NextFunction } from 'express';
import { MEDIA_TYPES } from './media-path-utils';
import { uploadRealEstateMediaFromBuffer } from './object-storage';

/**
 * Middleware function that runs after multer has processed in-memory files for real estate listings
 * Uploads them directly to Object Storage (no filesystem writes)
 */
export async function realEstateObjectStorageMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Check if we have any files to process
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      console.log('No real estate media files to process in Object Storage middleware');
      return next();
    }
    
    console.log(`Processing ${files.length} real estate media files for Object Storage`);
    
    // We'll store the URLs of the uploaded files to attach to the request
    const uploadedMediaUrls: string[] = [];
    
    // Upload each file to Object Storage
    for (const file of files) {
      try {
        console.log(`Uploading real estate media: ${file.originalname} (${file.size} bytes) [${file.mimetype}]`);
        
        // Upload directly to Object Storage using the uploadRealEstateMediaFromBuffer function
        // This function automatically creates a unique filename with timestamp-random format
        // and uploads to the correct bucket with the proper prefix
        const mediaUrl = await uploadRealEstateMediaFromBuffer(file.buffer, file.originalname);
        
        // If we get here without an error, upload was successful
        // The mediaUrl returned will already have a leading slash: /real-estate-media/filename.ext
        // We'll convert it to a proxy URL for consistency with other media
        // Need to remove the leading slash when constructing the proxy URL to avoid double slashes
        const proxyUrl = `/api/storage-proxy/REAL_ESTATE${mediaUrl}`;
        uploadedMediaUrls.push(proxyUrl);
        console.log(`Successfully uploaded real estate media to Object Storage: ${proxyUrl}`);
      } catch (uploadError) {
        console.error(`Error uploading real estate media file to Object Storage:`, uploadError);
        // Continue with other files even if one fails
      }
    }
    
    // Attach the uploaded media URLs to the request for use in the route handler
    (req as any).uploadedMediaUrls = uploadedMediaUrls;
    console.log(`Completed real estate media uploads to Object Storage: ${uploadedMediaUrls.length} files`);
    
    // Continue to the next middleware or route handler
    next();
  } catch (error) {
    console.error('Error in real estate Object Storage middleware:', error);
    next(error);
  }
}