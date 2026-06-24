/**
 * Middleware for proxying message attachment requests to Object Storage in production
 * This ensures attachments work properly in both development and production environments
 */

import express from 'express';
import path from 'path';
import fs from 'fs';

// Import the object storage service
import { objectStorageService } from './object-storage-service';

// Constant for attachment bucket name
const ATTACHMENT_BUCKET = 'MESSAGES';

/**
 * Helper to check if we're in a production environment
 */
function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Middleware to handle attachment requests and transform URLs for Object Storage in production
 * Enhanced with additional file path checks and improved content type detection
 */
export const attachmentStorageProxyMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Extract path information
  const url = req.url;
  
  // Determine if this is an API proxy request or direct file access
  const isApiProxyRequest = url.includes('/api/storage-proxy/MESSAGES/attachments/');
  
  // Process attachment URLs - expanded to handle more URL patterns
  if (!url.includes('/uploads/attachments/') && 
      !url.startsWith('/attachments/') && 
      !isApiProxyRequest) {
    return next();
  }
  
  console.log(`[AttachmentStorageProxy] Processing attachment request: ${url}`);
  
  // Extract the filename
  let filename;
  if (isApiProxyRequest) {
    // Extract from /api/storage-proxy/MESSAGES/attachments/filename.ext format
    const parts = url.split('/');
    filename = parts[parts.length - 1];
  } else {
    // Extract from regular path
    const parts = url.split('/');
    filename = parts[parts.length - 1];
  }
  
  console.log(`[AttachmentStorageProxy] Extracted filename: ${filename}`);
  
  // Sanitize filename to prevent directory traversal
  filename = filename.replace(/\.\./g, '').replace(/[\/\\]/g, '');
  
  // Get content type from filename extension
  const getContentType = (filename: string): string => {
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap: {[key: string]: string} = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.mp4': 'video/mp4',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.zip': 'application/zip',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };
    
    return contentTypeMap[ext] || 'application/octet-stream';
  };
  
  // Try multiple approaches to serve the file based on environment
  
  // In production (or if this is an API proxy request), try Object Storage first
  if (isProduction() || isApiProxyRequest) {
    try {
      console.log(`[AttachmentStorageProxy] Production or proxy request detected, trying Object Storage for: ${filename}`);
      
      // Define object storage path
      const objectStoragePath = `attachments/${filename}`;
      
      try {
        // Fetch from object storage
        console.log(`[AttachmentStorageProxy] Attempting to retrieve file from Object Storage: ${objectStoragePath}`);
        const fileBuffer = await objectStorageService.getFile(objectStoragePath, ATTACHMENT_BUCKET);
        
        if (fileBuffer && fileBuffer.length > 0) {
          console.log(`[AttachmentStorageProxy] Successfully retrieved file buffer, size: ${fileBuffer.length} bytes`);
          
          // Set appropriate headers
          res.set({
            'Cache-Control': 'public, max-age=86400', // 24 hours
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          
          // Set content type
          const contentType = getContentType(filename);
          res.type(contentType);
          console.log(`[AttachmentStorageProxy] Setting content type: ${contentType} for file: ${filename}`);
          
          // Send the file
          return res.send(fileBuffer);
        } else {
          console.log(`[AttachmentStorageProxy] Empty buffer returned from Object Storage, falling back to filesystem`);
        }
      } catch (storageError) {
        console.error(`[AttachmentStorageProxy] Error accessing file from Object Storage:`, storageError);
        // Continue to try filesystem as fallback
      }
    } catch (error) {
      console.error('[AttachmentStorageProxy] Error in production Object Storage handling:', error);
      // Fall through to filesystem handling as fallback
    }
  }
  
  // Try multiple filesystem paths as fallback
  const possiblePaths = [
    path.join(process.cwd(), 'uploads', 'attachments', filename),
    path.join(process.cwd(), 'attachments', filename),
    path.join(process.cwd(), 'public', 'attachments', filename)
  ];
  
  for (const filePath of possiblePaths) {
    try {
      if (fs.existsSync(filePath)) {
        console.log(`[AttachmentStorageProxy] Serving attachment from filesystem: ${filePath}`);
        
        // Set appropriate headers
        res.set({
          'Cache-Control': 'public, max-age=86400', // 24 hours
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        
        // Set content type
        const contentType = getContentType(filename);
        res.type(contentType);
        
        return res.sendFile(filePath);
      }
    } catch (fsError) {
      console.error(`[AttachmentStorageProxy] Error checking filesystem path ${filePath}:`, fsError);
    }
  }
  
  // If we can't find the file anywhere, return a proper 404 error
  console.log(`[AttachmentStorageProxy] Attachment not found after trying all paths: ${filename}`);
  
  // Check if the URL contains status=missing (marked as missing in database)
  if (req.url.includes('status=missing')) {
    return res.status(410).json({ 
      error: 'Attachment no longer available', 
      message: 'This attachment was uploaded but is no longer accessible',
      filename: filename
    });
  }
  
  // Return 404 for genuinely missing files
  return res.status(404).json({ 
    error: 'Attachment not found', 
    message: 'The requested attachment could not be found',
    filename: filename
  });
};

/**
 * This helper function uploads attachment files to Object Storage
 * and can be called after saving attachments to the filesystem
 * Enhanced with retry logic and better error handling
 */
export /**
 * Upload an attachment to Object Storage and return the appropriate URL
 * 
 * @param localFilePath Path to the local file to upload
 * @param filename The filename to use in Object Storage
 * @returns Direct Object Storage URL in production, or null in development (unless forced)
 */
async function uploadAttachmentToObjectStorage(localFilePath: string, filename: string): Promise<string | null> {
  // Always try to upload in production, but also allow it to work in development for testing
  const shouldSkip = !isProduction() && process.env.FORCE_UPLOAD_TO_STORAGE !== 'true';
  
  if (shouldSkip) {
    console.log(`[AttachmentStorageProxy] Skipping upload to Object Storage in development: ${filename}`);
    return null; // Skip in development unless forced
  }
  
  // Sanitize filename
  const sanitizedFilename = filename.replace(/\.\./g, '').replace(/[\/\\]/g, '');
  
  // Verify the file exists before attempting upload
  if (!fs.existsSync(localFilePath)) {
    console.error(`[AttachmentStorageProxy] File not found at path: ${localFilePath}`);
    return null;
  }
  
  // Get file stats for logging
  const stats = fs.statSync(localFilePath);
  console.log(`[AttachmentStorageProxy] Preparing to upload attachment: ${sanitizedFilename} (${Math.round(stats.size / 1024)}KB)`);
  
  // Maximum number of retry attempts
  const maxRetries = 3;
  let attempt = 0;
  let lastError: any = null;
  
  while (attempt < maxRetries) {
    attempt++;
    
    try {
      console.log(`[AttachmentStorageProxy] Uploading attachment to Object Storage: ${sanitizedFilename} (Attempt ${attempt}/${maxRetries})`);
      
      // Upload to the Messages bucket with the attachments/ prefix
      const objectStorageUrl = await objectStorageService.uploadFile(
        localFilePath, 
        'attachments',
        sanitizedFilename,
        ATTACHMENT_BUCKET
      );
      
      // Verify the upload was successful by trying to get the file
      try {
        await objectStorageService.getFile(`attachments/${sanitizedFilename}`, ATTACHMENT_BUCKET);
        console.log(`[AttachmentStorageProxy] Successfully verified attachment in Object Storage: ${sanitizedFilename}`);
      } catch (verifyError) {
        console.warn(`[AttachmentStorageProxy] Upload appeared successful but verification failed: ${sanitizedFilename}`, verifyError);
        // Continue with the URL anyway, as the file might still be propagating
      }
      
      // Important: Return the direct Object Storage URL for production use
      // Format: https://object-storage.replit.app/MESSAGES/attachments/filename
      const directObjectStorageUrl = `https://object-storage.replit.app/${ATTACHMENT_BUCKET}/attachments/${sanitizedFilename}`;
      
      console.log(`[AttachmentStorageProxy] Attachment uploaded to Object Storage: ${directObjectStorageUrl}`);
      return directObjectStorageUrl;
    } catch (error) {
      lastError = error;
      console.error(`[AttachmentStorageProxy] Error uploading attachment to Object Storage (attempt ${attempt}/${maxRetries}):`, error);
      
      if (attempt < maxRetries) {
        // Wait before retrying with exponential backoff
        const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s, etc.
        console.log(`[AttachmentStorageProxy] Retrying upload in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`[AttachmentStorageProxy] All upload attempts failed for ${sanitizedFilename}:`, lastError);
  return null;
}

/**
 * Helper function to get a properly formatted URL for an attachment based on environment
 * Enhanced with sanitization and flexible path handling
 */
export /**
 * Get the appropriate URL for an attachment based on environment and storage location
 * This function is critical - it determines what URL gets stored in the database
 * 
 * @param filename The filename of the attachment
 * @param objectStorageUrl Optional object storage URL if already uploaded to cloud storage
 * @returns The appropriate URL to store in the database for this environment
 */
function getAttachmentUrl(filename: string, objectStorageUrl: string | null = null): string {
  // Sanitize filename to prevent directory traversal and unexpected behavior
  const sanitizedFilename = filename.replace(/\.\./g, '').replace(/[\/\\]/g, '');
  
  // CRITICAL FIX: Never use full URLs with domains in any environment
  // Always use relative paths with /api prefix which work in both dev and production
  
  // If we have an objectStorageUrl but it contains a full domain, convert it to a relative API path
  if (objectStorageUrl) {
    // Check if this is a full URL with domain (like https://object-storage.replit.app/...)
    if (objectStorageUrl.startsWith('http')) {
      console.log(`[AttachmentStorageProxy] Converting full URL to relative API path: ${objectStorageUrl}`);
      // Regardless of environment, use the standardized API path
      return `/api/attachments/${sanitizedFilename}`;
    }
    
    // If it's already a relative path, make sure it has the right format
    if (!objectStorageUrl.startsWith('/api/')) {
      console.log(`[AttachmentStorageProxy] Standardizing relative path: ${objectStorageUrl}`);
      return `/api/attachments/${sanitizedFilename}`;
    }
    
    // If it's already a properly formatted API path, just use it
    return objectStorageUrl;
  }
  
  // For all environments, use a consistent API endpoint path
  console.log(`[AttachmentStorageProxy] Using standardized API endpoint URL for attachment: ${sanitizedFilename}`);
  return `/api/attachments/${sanitizedFilename}`;
}

/**
 * Helper function to generate fallback URLs for an attachment that can be tried
 * when the primary URL fails to load
 */
export function getAttachmentFallbackUrls(filename: string): string[] {
  // Sanitize filename to prevent directory traversal and unexpected behavior
  const sanitizedFilename = filename.replace(/\.\./g, '').replace(/[\/\\]/g, '');
  
  // Create an array of possible URLs in order of preference
  const urls = [
    // Primary URL based on environment
    isProduction() 
      ? `/api/storage-proxy/MESSAGES/attachments/${sanitizedFilename}` 
      : `/uploads/attachments/${sanitizedFilename}`,
    
    // Alternative URL formats to try as fallbacks
    isProduction()
      ? `/attachments/${sanitizedFilename}` // Direct path in production
      : `/attachments/${sanitizedFilename}`, // Direct path in development
    
    // Another alternative format
    isProduction()
      ? `/uploads/attachments/${sanitizedFilename}` // Legacy path in production
      : `/api/storage-proxy/MESSAGES/attachments/${sanitizedFilename}`, // Try proxy in development
  ];
  
  return urls;
}