/**
 * Object Storage Upload Middleware
 * 
 * This middleware intercepts file uploads and automatically stores them in
 * Replit Object Storage instead of on the filesystem.
 * 
 * Key features:
 * - Replaces multer storage with memory storage and forwards to Object Storage
 * - Automatically determines appropriate bucket from request parameters
 * - Normalizes all media URLs to use proxy format
 * - Compatible with existing upload endpoints
 */

import { Request, Response, NextFunction } from 'express';
import multer, { StorageEngine, Multer } from 'multer';
import { unifiedStorageService, IStorageResult } from './unified-storage-service';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request interface to include our custom properties
declare global {
  namespace Express {
    interface Request {
      objectStorageResult?: IStorageResult;
    }
  }
}

/**
 * Middleware factory that returns a configured multer middleware
 * which stores files in Object Storage instead of on the filesystem
 * 
 * @param mediaType The type of media being uploaded (avatar, event, forum, etc.)
 * @returns Configured multer middleware
 */
export function createObjectStorageUploadMiddleware(mediaType: string): Multer {
  // Use memory storage so files are not written to disk
  const storage = multer.memoryStorage();
  
  // Create multer instance with memory storage
  const upload = multer({ 
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    }
  });
  
  return upload;
}

/**
 * Middleware to handle Object Storage upload after multer processes the file
 * This middleware takes the file from memory and uploads it to Object Storage
 * 
 * @param mediaTypeGetter Function to get the media type from the request
 * @returns Express middleware function
 */
export function handleObjectStorageUpload(mediaTypeGetter: ((req: Request) => string) | string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // If no file was uploaded, just continue
      if (!req.file) {
        console.log('[ObjectStorageUpload] No file found in request');
        return next();
      }
      
      // Determine the media type
      const mediaType = typeof mediaTypeGetter === 'function' 
        ? mediaTypeGetter(req) 
        : mediaTypeGetter;
      
      console.log(`[ObjectStorageUpload] Processing ${mediaType} upload: ${req.file.originalname}`);
      
      // Get file details from multer
      const { buffer, originalname, mimetype } = req.file;
      
      // Determine if there's an explicit bucket specified in the request
      const explicitBucket = req.body.bucket || req.query.bucket;
      
      // Upload the file to Object Storage
      const uploadResult = await unifiedStorageService.uploadBuffer(
        buffer,
        originalname,
        mediaType,
        {
          contentType: mimetype,
          bucket: explicitBucket,
          generateUniqueName: true
        }
      );
      
      // Store the result in the request for later use
      req.objectStorageResult = uploadResult;
      
      if (!uploadResult.success) {
        console.error(`[ObjectStorageUpload] Upload failed: ${uploadResult.error}`);
        return res.status(uploadResult.statusCode || 500).json({
          success: false,
          message: `File upload failed: ${uploadResult.error}`
        });
      }
      
      // Attach uploadResult to the request for future middlewares/handlers
      console.log(`[ObjectStorageUpload] File uploaded successfully: ${uploadResult.url}`);
      
      next();
    } catch (error) {
      console.error('[ObjectStorageUpload] Error handling upload:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during file upload'
      });
    }
  };
}

/**
 * Combined middleware that handles file upload and storage in one go
 * 
 * @param mediaTypeGetter Function to get the media type from the request or a string
 * @returns Array of middleware functions
 */
export function uploadToObjectStorage(mediaTypeGetter: ((req: Request) => string) | string) {
  const multerMiddleware = createObjectStorageUploadMiddleware(typeof mediaTypeGetter === 'string' ? mediaTypeGetter : 'file');
  const storageMiddleware = handleObjectStorageUpload(mediaTypeGetter);
  
  return [
    multerMiddleware.single('file'), // Process the file field with multer
    storageMiddleware // Handle the upload to Object Storage
  ];
}

/**
 * Process the result of an Object Storage upload and send appropriate response
 * This is typically used as the final handler in a route
 */
export function processObjectStorageUploadResult(req: Request, res: Response) {
  const result = req.objectStorageResult;
  
  if (!result) {
    return res.status(400).json({
      success: false,
      message: 'No file was uploaded'
    });
  }
  
  if (!result.success) {
    return res.status(result.statusCode || 500).json({
      success: false,
      message: result.error || 'Unknown error during file upload'
    });
  }
  
  // Return success response with the URL
  return res.status(200).json({
    success: true,
    url: result.url,
    message: 'File uploaded successfully'
  });
}

/**
 * Create a standard upload route handler that handles everything
 * 
 * @param mediaType The type of media being uploaded
 * @returns Array of middleware functions that complete the entire upload process
 */
export function createStandardUploadHandler(mediaType: string) {
  return [
    ...uploadToObjectStorage(mediaType),
    processObjectStorageUploadResult
  ];
}