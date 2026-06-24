/**
 * Object Storage Proxy
 * Provides a server-side proxy for accessing Object Storage files
 * Eliminates CORS issues by serving files through our own server
 * 
 * Supports multiple URL formats for backward compatibility:
 * - /api/storage-proxy/CALENDAR/events/filename.jpg (standard)
 * - /api/storage-proxy/CALENDAR/CALENDAR/events/filename.jpg (double bucket)
 * - /api/storage-proxy/events/filename.jpg (missing bucket)
 */

import { Router, Request, Response } from 'express';
import { objectStorageService } from './object-storage-service';
import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

const router = Router();

// Apply CORS middleware specifically for object storage proxy routes
router.use(cors({
  origin: '*',
  methods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'Range'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Add explicit CORS headers for all routes
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, Accept, Range');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

/**
 * Special route handler for URLs that are missing the bucket prefix
 * URL format: /api/storage-proxy/events/filename.jpg
 * 
 * This route assumes CALENDAR bucket for any path starting with "events/"
 */
router.get('/events/*filename', async (req: Request, res: Response) => {
  // Extract filename from path parameter
  const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
  console.log(`[StorageProxy] Missing bucket format detected - redirecting 'events/${filename}' to proper format`);
  
  // Redirect to the proper format with CALENDAR bucket
  return res.redirect(`/api/storage-proxy/CALENDAR/events/${filename}`);
});

/**
 * Special route handler for message attachment URLs
 * URL format: /api/storage-proxy/MESSAGES/attachments/filename.jpg
 * 
 * This route handles message attachments stored in the MESSAGES bucket
 */
router.get('/MESSAGES/attachments/*filename', async (req: Request, res: Response) => {
  try {
    // Extract filename from path parameter
    const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
    console.log(`[StorageProxy] Message attachment request: ${filename}`);
    
    // Define storage path for attachment in MESSAGES bucket
    const storageKey = `attachments/${filename}`;
    const bucket = 'MESSAGES';
    const ext = path.extname(filename).toLowerCase();
    const contentType = getContentType(ext);
    
    console.log(`[StorageProxy:MessageAttachment] Accessing file: ${storageKey} from ${bucket} bucket`);
    
    // Try to get the file directly using the object storage service
    try {
      const buffer = await objectStorageService.getFile(storageKey, bucket);
      
      if (buffer && buffer.length > 0) {
        console.log(`[StorageProxy:MessageAttachment] Successfully retrieved file: ${storageKey} (${buffer.length} bytes)`);
        
        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24-hour cache
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Send the file
        return res.send(buffer);
      } else {
        console.log(`[StorageProxy:MessageAttachment] File not found in Object Storage: ${storageKey}`);
        return res.status(404).send('File not found');
      }
    } catch (serviceError) {
      console.error('Error getting message attachment from Object Storage:', serviceError);
      return res.status(404).send('File not found in storage');
    }
  } catch (error) {
    console.error('Message attachment storage proxy error:', error);
    return res.status(500).send('Internal server error');
  }
});

/**
 * Special route handler for forum media URLs without bucket
 * URL format: /api/storage-proxy/forum/filename.jpg
 * 
 * This route assumes FORUM bucket for any path starting with "forum/"
 */
router.get('/forum/*filename', async (req: Request, res: Response) => {
  try {
    // Extract filename from path parameter
    const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
    console.log(`[StorageProxy] Direct forum endpoint handling - accessing 'forum/${filename}'`);
    
    // Instead of redirecting (which is causing an infinite loop), directly fetch the file
    const bucket = 'FORUM';
    const storageKey = `forum/${filename}`;
    const ext = path.extname(filename).toLowerCase();
    const contentType = getContentType(ext);
    
    console.log(`[DirectForumAccess] Accessing forum file: ${storageKey} from bucket ${bucket}`);
    
    // Try to get the file directly using the client
    try {
      const buffer = await objectStorageService.getFile(storageKey, bucket);
      
      if (buffer && buffer.length > 0) {
        console.log(`[DirectForumAccess] Successfully retrieved file from Object Storage client: ${storageKey} (${buffer.length} bytes)`);
        
        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24-hour cache
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Send the file
        return res.send(buffer);
      }
    } catch (error) {
      console.log(`[DirectForumAccess] Error retrieving file: ${error.message}`);
    }
    
    // If we reach here, we couldn't get the file directly - try via HTTP
    const objectStorageUrl = `https://object-storage.replit.app/${bucket}/${storageKey}`;
    
    try {
      const response = await fetch(objectStorageUrl, {
        headers: {
          'X-Obj-Bucket': bucket,
          'Accept': '*/*'
        }
      });
      
      if (response.ok) {
        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Stream the content
        return response.body?.pipe(res);
      } else {
        // File not found or error - serve placeholder
        const placeholderPath = path.join(process.cwd(), 'public', 'media-placeholder', 'default-forum-image.svg');
        if (fs.existsSync(placeholderPath)) {
          console.log(`[DirectForumAccess] Serving default forum image for: ${filename}`);
          res.setHeader('Content-Type', 'image/svg+xml');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.setHeader('X-Default-Forum-Image', 'true');
          return res.sendFile(placeholderPath);
        }
      }
    } catch (error) {
      console.log(`[DirectForumAccess] Error with HTTP fetch: ${error.message}`);
    }
    
    // If we get here, all attempts failed
    return res.status(404).send('Forum media file not found');
  } catch (error) {
    console.error(`[DirectForumAccess] Unhandled error: ${error.message}`);
    return res.status(500).send('Internal server error');
  }
});

/**
 * Special direct access endpoint for forum media files
 * This provides direct access to forum media in the FORUM bucket
 * 
 * IMPORTANT: We no longer use nested 'forum/' prefixes in the FORUM bucket
 * to avoid the double nesting problem (forum/forum/) that causes 'No such object' errors
 */
router.get('/direct-forum/*filename', async (req: Request, res: Response) => {
  try {
    const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
    const bucket = 'FORUM'; // Always FORUM bucket for forum media
    // Try bare key first, then common prefixed locations (legacy uploads landed under forum/)
    const candidateKeys = [filename, `forum/${filename}`, `FORUM/${filename}`];
    const storageKey = filename;

    // Determine content type
    const ext = path.extname(filename).toLowerCase();
    const contentType = getContentType(ext);

    console.log(`[DirectForum] Accessing forum file: ${storageKey} from bucket ${bucket}`);

    // First try to get the file directly using the client (more reliable approach)
    for (const key of candidateKeys) {
      try {
        const buffer = await objectStorageService.getFile(key, bucket);
        if (buffer && buffer.length > 0) {
          console.log(`[DirectForum] Successfully retrieved file (key=${key}, ${buffer.length} bytes)`);
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.send(buffer);
        }
      } catch (clientError: any) {
        console.log(`[DirectForum] Miss key=${key}: ${clientError?.message ?? clientError}`);
      }
    }
    
    // Fallback to HTTP method if client approach fails
    const fetchUrl = `https://object-storage.replit.app/${bucket}/${storageKey}`;
    console.log(`[DirectForum] Falling back to HTTP: ${fetchUrl} with ${bucket} bucket header`);
    
    // Try to fetch from Object Storage via HTTP - with detailed debug info
    try {
      console.log(`[DirectForum] Attempting to fetch file with X-Obj-Bucket header from Object Storage: ${fetchUrl}`);
      
      // CRITICAL FIX: Set the X-Obj-Bucket header to the correct bucket name
      const fetchOptions = {
        headers: {
          'Accept': '*/*',
          'User-Agent': 'DirectForum-Proxy/1.0',
          'X-Obj-Bucket': bucket  // Add the correct X-Obj-Bucket header
        }
      };
      
      // Try HEAD request first to check if the file exists - with bucket header
      const headResponse = await fetch(fetchUrl, { 
        method: 'HEAD',
        headers: {
          'X-Obj-Bucket': bucket
        } 
      });
      console.log(`[DirectForum] HEAD request status: ${headResponse.status}`);
      
      if (headResponse.ok) {
        console.log(`[DirectForum] File exists, fetching full content with bucket header...`);
        const response = await fetch(fetchUrl, fetchOptions);
        
        if (response.ok) {
          console.log(`[DirectForum] Successfully fetched file, status: ${response.status}`);
          // Log headers for debugging
          const headers = response.headers.raw();
          console.log(`[DirectForum] Response headers: ${JSON.stringify(headers)}`);
          
          // Apply headers
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Direct-Forum-Access', 'true');
          
          // Stream the content
          return response.body?.pipe(res);
        } else {
          console.log(`[DirectForum] Failed to fetch full content, status: ${response.status}`);
          return res.redirect(`/api/storage-proxy/FORUM/forum/${filename}`);
        }
      } else {
        console.log(`[DirectForum] File not found at direct path: ${fetchUrl}`);
        return res.redirect(`/api/storage-proxy/FORUM/forum/${filename}`);
      }
    } catch (directError) {
      console.error(`[DirectForum] Error fetching direct URL: ${directError}`);
      return res.redirect(`/api/storage-proxy/FORUM/forum/${filename}`);
    }
  } catch (error) {
    console.error(`[DirectForum] Error: ${error}`);
    return res.status(500).send('Internal server error');
  }
});

/**
 * Special direct access endpoint for vendor media files
 * This provides direct access to vendor media in the VENDORS bucket
 */
router.get('/direct-vendors/*filename', async (req: Request, res: Response) => {
  try {
    const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
    const bucket = 'VENDORS';
    const candidateKeys = [filename, `vendors/${filename}`, `VENDORS/${filename}`, `vendor-media/${filename}`];
    const storageKey = filename;

    const ext = path.extname(filename).toLowerCase();
    const contentType = getContentType(ext);

    console.log(`[DirectVendors] Accessing vendor file: ${storageKey} from bucket ${bucket}`);

    for (const key of candidateKeys) {
      try {
        const buffer = await objectStorageService.getFile(key, bucket);
        if (buffer && buffer.length > 0) {
          console.log(`[DirectVendors] Successfully retrieved file (key=${key}, ${buffer.length} bytes)`);
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.send(buffer);
        }
      } catch (clientError: any) {
        console.log(`[DirectVendors] Miss key=${key}: ${clientError?.message ?? clientError}`);
      }
    }
    
    // Fallback to HTTP method if client approach fails
    const fetchUrl = `https://object-storage.replit.app/${bucket}/${storageKey}`;
    console.log(`[DirectVendors] Falling back to HTTP: ${fetchUrl}`);
    
    try {
      const fetchOptions = {
        headers: {
          'Accept': '*/*',
          'User-Agent': 'DirectVendors-Proxy/1.0',
          'X-Obj-Bucket': bucket
        }
      };
      
      const response = await fetch(fetchUrl, fetchOptions);
      
      if (response.ok) {
        console.log(`[DirectVendors] Successfully fetched file, status: ${response.status}`);
        
        // Apply headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Direct-Vendors-Access', 'true');
        
        // Stream the content
        return response.body?.pipe(res);
      } else {
        console.log(`[DirectVendors] Failed to fetch file, status: ${response.status}`);
        return res.status(404).send('Vendor media file not found');
      }
    } catch (fetchError) {
      console.error(`[DirectVendors] Error fetching file: ${fetchError}`);
      return res.status(404).send('Vendor media file not found');
    }
  } catch (error) {
    console.error(`[DirectVendors] Error: ${error}`);
    return res.status(500).send('Internal server error');
  }
});

/**
 * Special direct access endpoint for real estate media files
 * This provides direct access to real estate media in the REAL_ESTATE bucket
 */
router.get('/direct-realestate/*filename', async (req: Request, res: Response) => {
  try {
    const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
    const bucket = 'REAL_ESTATE'; // Always REAL_ESTATE bucket for real estate media
    const candidateKeys = [
      `real-estate-media/${filename}`,
      filename,
      `realestate/${filename}`,
      `real-estate/${filename}`,
      `REAL_ESTATE/${filename}`,
      `REAL_ESTATE/real-estate-media/${filename}`,
    ];
    const storageKey = `real-estate-media/${filename}`;

    // Determine content type
    const ext = path.extname(filename).toLowerCase();
    const contentType = getContentType(ext);

    console.log(`[DirectRealEstate] Accessing real estate file: ${storageKey} from bucket ${bucket}`);

    for (const key of candidateKeys) {
      try {
        const buffer = await objectStorageService.getFile(key, bucket);
        if (buffer && buffer.length > 0) {
          console.log(`[DirectRealEstate] Successfully retrieved file (key=${key}, ${buffer.length} bytes)`);
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.send(buffer);
        }
      } catch (clientError: any) {
        console.log(`[DirectRealEstate] Miss key=${key}: ${clientError?.message ?? clientError}`);
      }
    }
    
    // Fallback to HTTP method if client approach fails
    const fetchUrl = `https://object-storage.replit.app/${bucket}/${storageKey}`;
    console.log(`[DirectRealEstate] Falling back to HTTP: ${fetchUrl} with ${bucket} bucket header`);
    
    // Try to fetch from Object Storage via HTTP - with detailed debug info
    try {
      console.log(`[DirectRealEstate] Attempting to fetch file with X-Obj-Bucket header from Object Storage: ${fetchUrl}`);
      
      // CRITICAL FIX: Set the X-Obj-Bucket header to the correct bucket name
      const fetchOptions = {
        headers: {
          'Accept': '*/*',
          'User-Agent': 'DirectRealEstate-Proxy/1.0',
          'X-Obj-Bucket': bucket  // Add the correct X-Obj-Bucket header
        }
      };
      
      // Try HEAD request first to check if the file exists - with bucket header
      const headResponse = await fetch(fetchUrl, { 
        method: 'HEAD',
        headers: {
          'X-Obj-Bucket': bucket
        } 
      });
      console.log(`[DirectRealEstate] HEAD request status: ${headResponse.status}`);
      
      if (headResponse.ok) {
        console.log(`[DirectRealEstate] File exists, fetching full content with bucket header...`);
        const response = await fetch(fetchUrl, fetchOptions);
        
        if (response.ok) {
          console.log(`[DirectRealEstate] Successfully fetched file, status: ${response.status}`);
          // Log headers for debugging
          const headers = response.headers.raw();
          console.log(`[DirectRealEstate] Response headers: ${JSON.stringify(headers)}`);
          
          // Apply headers
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Direct-RealEstate-Access', 'true');
          
          // Stream the content
          return response.body?.pipe(res);
        } else {
          console.log(`[DirectRealEstate] Failed to fetch full content, status: ${response.status}`);
          return res.status(404).send('Real estate media file not found');
        }
      } else {
        console.log(`[DirectRealEstate] File not found at direct path: ${fetchUrl}`);
        return res.status(404).send('Real estate media file not found');
      }
    } catch (directError) {
      console.error(`[DirectRealEstate] Error fetching direct URL: ${directError}`);
      return res.status(500).send('Internal server error');
    }
  } catch (error) {
    console.error(`[DirectRealEstate] Error: ${error}`);
    return res.status(500).send('Internal server error');
  }
});

/**
 * Special direct access endpoint for banner-slides/ prefix files
 * This provides direct access to banner media in the BANNER bucket
 */
router.get('/direct-banner/*filename', async (req: Request, res: Response) => {
  try {
    const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
    const storageKey = `banner-slides/${filename}`; // Key format in the storage bucket
    const bucket = 'BANNER'; // Always BANNER bucket for banner media
    
    // Determine content type
    const ext = path.extname(filename).toLowerCase();
    const contentType = getContentType(ext);
    
    console.log(`[DirectBanner] Accessing banner file: ${storageKey} from bucket ${bucket}`);
    
    // First try to get the file directly using the client (more reliable approach)
    try {
      // Use objectStorageService directly to get the file
      const buffer = await objectStorageService.getFile(storageKey, bucket);
      
      if (buffer && buffer.length > 0) {
        console.log(`[DirectBanner] Successfully retrieved file from Object Storage client: ${storageKey} (${buffer.length} bytes)`);
        
        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24-hour cache
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Send the file
        return res.send(buffer);
      } else {
        console.log(`[DirectBanner] Object Storage client returned empty buffer for ${storageKey}`);
        // Fall through to HTTP method
      }
    } catch (clientError) {
      console.log(`[DirectBanner] Client error getting file: ${clientError.message}, falling back to HTTP method`);
      // Fall through to HTTP method as backup
    }
    
    // Try falling back to DEFAULT bucket if BANNER bucket fails
    try {
      const buffer = await objectStorageService.getFile(storageKey, 'DEFAULT');
      
      if (buffer && buffer.length > 0) {
        console.log(`[DirectBanner] Successfully retrieved file from DEFAULT bucket: ${storageKey} (${buffer.length} bytes)`);
        
        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24-hour cache
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Banner-Source', 'default-bucket-fallback');
        
        // Send the file
        return res.send(buffer);
      }
    } catch (defaultError) {
      console.log(`[DirectBanner] Client error getting file from DEFAULT bucket: ${defaultError.message}`);
      // Continue to HTTP fallback
    }
    
    // Fallback to HTTP method if client approach fails
    const fetchUrl = `https://object-storage.replit.app/${bucket}/${storageKey}`;
    console.log(`[DirectBanner] Falling back to HTTP: ${fetchUrl} with ${bucket} bucket header`);
    
    // Try to fetch from Object Storage via HTTP - with detailed debug info
    try {
      console.log(`[DirectBanner] Attempting to fetch file with X-Obj-Bucket header from Object Storage: ${fetchUrl}`);
      
      // CRITICAL FIX: Set the X-Obj-Bucket header to the correct bucket name
      const fetchOptions = {
        headers: {
          'Accept': '*/*',
          'User-Agent': 'DirectBanner-Proxy/1.0',
          'X-Obj-Bucket': bucket  // Add the correct X-Obj-Bucket header
        }
      };
      
      // Try HEAD request first to check if the file exists - with bucket header
      const headResponse = await fetch(fetchUrl, { 
        method: 'HEAD',
        headers: {
          'X-Obj-Bucket': bucket
        } 
      });
      console.log(`[DirectBanner] HEAD request status: ${headResponse.status}`);
      
      if (headResponse.ok) {
        console.log(`[DirectBanner] File exists, fetching full content with bucket header...`);
        const response = await fetch(fetchUrl, fetchOptions);
        
        if (response.ok) {
          console.log(`[DirectBanner] Successfully fetched file, status: ${response.status}`);
          
          // Apply headers
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Direct-Banner-Access', 'true');
          
          // Stream the content
          return response.body?.pipe(res);
        } else {
          console.log(`[DirectBanner] Failed to fetch full content, status: ${response.status}`);
          return res.status(404).send('Banner media file not found');
        }
      } else {
        console.log(`[DirectBanner] File not found at direct path: ${fetchUrl}`);
        
        // Try DEFAULT bucket as fallback
        const defaultUrl = `https://object-storage.replit.app/DEFAULT/${storageKey}`;
        console.log(`[DirectBanner] Trying DEFAULT bucket fallback: ${defaultUrl}`);
        
        const defaultHeadResponse = await fetch(defaultUrl, { 
          method: 'HEAD',
          headers: {
            'X-Obj-Bucket': 'DEFAULT'
          } 
        });
        
        if (defaultHeadResponse.ok) {
          console.log(`[DirectBanner] File exists in DEFAULT bucket, fetching content...`);
          const defaultResponse = await fetch(defaultUrl, {
            headers: {
              'Accept': '*/*',
              'User-Agent': 'DirectBanner-Proxy/1.0',
              'X-Obj-Bucket': 'DEFAULT'
            }
          });
          
          if (defaultResponse.ok) {
            // Apply headers
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('X-Direct-Banner-Access', 'true');
            res.setHeader('X-Banner-Source', 'default-bucket-fallback');
            
            // Stream the content
            return defaultResponse.body?.pipe(res);
          }
        }
        
        // If we get here, try serving placeholder
        const placeholderPath = path.join(process.cwd(), 'public', 'banner-placeholder.jpg');
        if (fs.existsSync(placeholderPath)) {
          console.log(`[DirectBanner] Serving banner placeholder for: ${filename}`);
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache for placeholder
          res.setHeader('X-Banner-Placeholder', 'true'); // Indicate this is a placeholder
          return res.sendFile(placeholderPath);
        }
        
        return res.status(404).send('Banner media file not found');
      }
    } catch (directError) {
      console.error(`[DirectBanner] Error fetching direct URL: ${directError}`);
      return res.status(500).send('Internal server error');
    }
  } catch (error) {
    console.error(`[DirectBanner] Error: ${error}`);
    return res.status(500).send('Internal server error');
  }
});

/**
 * Special direct access endpoint for community media files
 * This provides direct access to community media in the COMMUNITY bucket
 */
router.get('/direct-community/*filename', async (req: Request, res: Response) => {
  try {
    const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
    const bucket = 'COMMUNITY';
    const candidateKeys = [
      `community/${filename}`,
      filename,
      `COMMUNITY/${filename}`,
      `COMMUNITY/community/${filename}`,
    ];
    const storageKey = `community/${filename}`;

    // Determine content type
    const ext = path.extname(filename).toLowerCase();
    const contentType = getContentType(ext);

    console.log(`[DirectCommunity] Accessing community file: ${storageKey} from bucket ${bucket}`);

    for (const key of candidateKeys) {
      try {
        const buffer = await objectStorageService.getFile(key, bucket);
        if (buffer && buffer.length > 0) {
          console.log(`[DirectCommunity] Successfully retrieved file (key=${key}, ${buffer.length} bytes)`);
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.send(buffer);
        }
      } catch (clientError: any) {
        console.log(`[DirectCommunity] Miss key=${key}: ${clientError?.message ?? clientError}`);
      }
    }
    
    // Fallback to HTTP method if client approach fails
    const fetchUrl = `https://object-storage.replit.app/${bucket}/${storageKey}`;
    console.log(`[DirectCommunity] Falling back to HTTP: ${fetchUrl} with ${bucket} bucket header`);
    
    // Try to fetch from Object Storage via HTTP - with detailed debug info
    try {
      console.log(`[DirectCommunity] Attempting to fetch file with X-Obj-Bucket header from Object Storage: ${fetchUrl}`);
      
      // Set the X-Obj-Bucket header to the correct bucket name
      const fetchOptions = {
        headers: {
          'Accept': '*/*',
          'User-Agent': 'DirectCommunity-Proxy/1.0',
          'X-Obj-Bucket': bucket
        }
      };
      
      // Try HEAD request first to check if the file exists - with bucket header
      const headResponse = await fetch(fetchUrl, { 
        method: 'HEAD',
        headers: {
          'X-Obj-Bucket': bucket
        } 
      });
      console.log(`[DirectCommunity] HEAD request status: ${headResponse.status}`);
      
      if (headResponse.ok) {
        console.log(`[DirectCommunity] File exists, fetching full content with bucket header...`);
        const response = await fetch(fetchUrl, fetchOptions);
        
        if (response.ok) {
          console.log(`[DirectCommunity] Successfully fetched file, status: ${response.status}`);
          
          // Apply headers
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Direct-Community-Access', 'true');
          
          // Stream the content
          return response.body?.pipe(res);
        } else {
          console.log(`[DirectCommunity] Failed to fetch full content, status: ${response.status}`);
          return res.status(404).send('Community media file not found');
        }
      } else {
        console.log(`[DirectCommunity] File not found at direct path: ${fetchUrl}`);
        return res.status(404).send('Community media file not found');
      }
    } catch (directError) {
      console.error(`[DirectCommunity] Error fetching direct URL: ${directError}`);
      return res.status(500).send('Internal server error');
    }
  } catch (error) {
    console.error(`[DirectCommunity] Error: ${error}`);
    return res.status(500).send('Internal server error');
  }
});

/**
 * Special direct access endpoint for legacy /content-media/ files
 * These were migrated with type `content-media`, which has no explicit
 * MEDIA_TYPE_TO_BUCKET mapping and therefore lives in the DEFAULT bucket.
 */
router.get('/direct-content/*filename', async (req: Request, res: Response) => {
  try {
    const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
    const bucket = 'DEFAULT';
    const candidateKeys = [
      `content-media/${filename}`,
      filename,
      `uploads/content-media/${filename}`,
      `DEFAULT/content-media/${filename}`,
    ];
    const storageKey = `content-media/${filename}`;

    const ext = path.extname(filename).toLowerCase();
    const contentType = getContentType(ext);

    console.log(`[DirectContent] Accessing content file: ${storageKey} from bucket ${bucket}`);

    for (const key of candidateKeys) {
      try {
        const buffer = await objectStorageService.getFile(key, bucket);
        if (buffer && buffer.length > 0) {
          console.log(`[DirectContent] Successfully retrieved file (key=${key}, ${buffer.length} bytes)`);
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.send(buffer);
        }
      } catch (clientError: any) {
        console.log(`[DirectContent] Miss key=${key}: ${clientError?.message ?? clientError}`);
      }
    }

    // Fallback to HTTP method if client approach fails
    const fetchUrl = `https://object-storage.replit.app/${bucket}/${storageKey}`;
    console.log(`[DirectContent] Falling back to HTTP: ${fetchUrl} with ${bucket} bucket header`);

    try {
      const fetchOptions = {
        headers: {
          'Accept': '*/*',
          'User-Agent': 'DirectContent-Proxy/1.0',
          'X-Obj-Bucket': bucket,
        },
      };

      const headResponse = await fetch(fetchUrl, {
        method: 'HEAD',
        headers: { 'X-Obj-Bucket': bucket },
      });
      console.log(`[DirectContent] HEAD request status: ${headResponse.status}`);

      if (headResponse.ok) {
        const response = await fetch(fetchUrl, fetchOptions);
        if (response.ok) {
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Direct-Content-Access', 'true');
          return response.body?.pipe(res);
        }
        console.log(`[DirectContent] Failed to fetch full content, status: ${response.status}`);
        return res.status(404).send('Content media file not found');
      }

      console.log(`[DirectContent] File not found at direct path: ${fetchUrl}`);
      return res.status(404).send('Content media file not found');
    } catch (directError) {
      console.error(`[DirectContent] Error fetching direct URL: ${directError}`);
      return res.status(500).send('Internal server error');
    }
  } catch (error) {
    console.error(`[DirectContent] Error: ${error}`);
    return res.status(500).send('Internal server error');
  }
});

/**
 * Special direct access endpoint for avatar files
 * This is needed to serve avatars from the AVATARS bucket with proper fallback support
 */
router.get('/direct-avatars/*filename', async (req: Request, res: Response) => {
  try {
    const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
    const bucket = 'AVATARS';
    const candidateKeys = [filename, `avatars/${filename}`, `AVATARS/${filename}`];
    const storageKey = filename;

    const ext = path.extname(filename).toLowerCase();
    const contentType = getContentType(ext);

    console.log(`[DirectAvatars] Accessing avatar file: ${storageKey} from bucket ${bucket}`);

    for (const key of candidateKeys) {
      try {
        const buffer = await objectStorageService.getFile(key, bucket);
        if (buffer && buffer.length > 0) {
          console.log(`[DirectAvatars] Successfully retrieved file (key=${key}, ${buffer.length} bytes)`);
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Avatar-Source', 'object-storage');
          return res.send(buffer);
        }
      } catch (clientError: any) {
        console.log(`[DirectAvatars] Miss key=${key}: ${clientError?.message ?? clientError}`);
      }
    }
    
    // Fallback to HTTP method if client approach fails
    const fetchUrl = `https://object-storage.replit.app/${storageKey}`;
    console.log(`[DirectAvatars] Falling back to HTTP: ${fetchUrl} with ${bucket} bucket header`);
    
    // Try to fetch from Object Storage via HTTP - with detailed debug info
    try {
      console.log(`[DirectAvatars] Attempting to fetch file with X-Obj-Bucket header from Object Storage: ${fetchUrl}`);
      
      // Set the X-Obj-Bucket header to the correct bucket name (AVATARS)
      const fetchOptions = {
        headers: {
          'Accept': '*/*',
          'User-Agent': 'DirectAvatars-Proxy/1.0',
          'X-Obj-Bucket': bucket  // Add the correct X-Obj-Bucket header
        }
      };
      
      // Try HEAD request first to check if the file exists - with bucket header
      const headResponse = await fetch(fetchUrl, { 
        method: 'HEAD',
        headers: {
          'X-Obj-Bucket': bucket
        } 
      });
      console.log(`[DirectAvatars] HEAD request status: ${headResponse.status}`);
      
      if (headResponse.ok) {
        console.log(`[DirectAvatars] File exists, fetching full content with bucket header...`);
        const response = await fetch(fetchUrl, fetchOptions);
        
        if (response.ok) {
          console.log(`[DirectAvatars] Successfully fetched file, status: ${response.status}`);
          
          // Apply headers
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Avatar-Source', 'object-storage-http');
          
          // Stream the content
          return response.body?.pipe(res);
        } else {
          console.log(`[DirectAvatars] Failed to fetch full content, status: ${response.status}`);
        }
      } else {
        console.log(`[DirectAvatars] File not found at direct path: ${fetchUrl}`);
      }
    } catch (httpError) {
      console.log(`[DirectAvatars] Error fetching from Object Storage via HTTP: ${httpError.message}`);
    }
    
    // If all Object Storage methods fail, try serving a default avatar placeholder
    const placeholderPath = path.join(process.cwd(), 'public', 'default-avatar.png');
    if (fs.existsSync(placeholderPath)) {
      console.log(`[DirectAvatars] Serving default avatar placeholder for: ${filename}`);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache for placeholder
      res.setHeader('X-Avatar-Placeholder', 'true'); // Indicate this is a placeholder
      return res.sendFile(placeholderPath);
    }
    
    return res.status(404).send('Avatar file not found');
  } catch (error) {
    console.error(`[DirectAvatars] Error: ${error}`);
    return res.status(500).send('Internal server error');
  }
});

/**
 * Special direct access endpoint for events/ prefix files
 * This is needed because the files are stored with just events/ prefix without the CALENDAR/ bucket
 */
router.get('/direct-events/*filename', async (req: Request, res: Response) => {
  try {
    const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
    const bucket = 'CALENDAR'; // Always CALENDAR bucket for events
    // Try bare key first, then common prefixed locations (live bucket has both events/<f> and CALENDAR/events/<f>)
    const candidateKeys = [`events/${filename}`, filename, `CALENDAR/events/${filename}`, `CALENDAR/${filename}`];
    const storageKey = `events/${filename}`;

    // Determine content type
    const ext = path.extname(filename).toLowerCase();
    const contentType = getContentType(ext);

    console.log(`[DirectEvents] Accessing events file: ${storageKey} from bucket ${bucket}`);

    // First try to get the file directly using the client across candidate keys
    for (const key of candidateKeys) {
      try {
        const buffer = await objectStorageService.getFile(key, bucket);
        if (buffer && buffer.length > 0) {
          console.log(`[DirectEvents] Successfully retrieved file (key=${key}, ${buffer.length} bytes)`);
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.send(buffer);
        }
      } catch (clientError: any) {
        console.log(`[DirectEvents] Miss key=${key}: ${clientError?.message ?? clientError}`);
      }
    }
    
    // Fallback to HTTP method if client approach fails
    const fetchUrl = `https://object-storage.replit.app/events/${filename}`;
    console.log(`[DirectEvents] Falling back to HTTP: ${fetchUrl} with ${bucket} bucket header`);
    
    // Try to fetch from Object Storage via HTTP - with detailed debug info
    try {
      console.log(`[DirectEvents] Attempting to fetch file with X-Obj-Bucket header from Object Storage: ${fetchUrl}`);
      
      // CRITICAL FIX: Set the X-Obj-Bucket header to the correct bucket name (CALENDAR)
      // This is required for the Replit Object Storage service to properly identify the bucket
      const fetchOptions = {
        headers: {
          'Accept': '*/*',
          'User-Agent': 'DirectEvents-Proxy/1.0',
          'X-Obj-Bucket': bucket  // Add the correct X-Obj-Bucket header
        }
      };
      
      // Try HEAD request first to check if the file exists - with bucket header
      const headResponse = await fetch(fetchUrl, { 
        method: 'HEAD',
        headers: {
          'X-Obj-Bucket': bucket
        } 
      });
      console.log(`[DirectEvents] HEAD request status: ${headResponse.status}`);
      
      if (headResponse.ok) {
        console.log(`[DirectEvents] File exists, fetching full content with bucket header...`);
        const response = await fetch(fetchUrl, fetchOptions);
        
        if (response.ok) {
          console.log(`[DirectEvents] Successfully fetched file, status: ${response.status}`);
          // Log headers for debugging
          const headers = response.headers.raw();
          console.log(`[DirectEvents] Response headers: ${JSON.stringify(headers)}`);
          
          // Apply headers
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Direct-Events-Access', 'true');
          
          // Stream the content
          return response.body?.pipe(res);
        } else {
          console.log(`[DirectEvents] Failed to fetch full content, status: ${response.status}`);
          return res.redirect(`/api/storage-proxy/CALENDAR/events/${filename}`);
        }
      } else {
        console.log(`[DirectEvents] File not found at direct path: ${fetchUrl}`);
        return res.redirect(`/api/storage-proxy/CALENDAR/events/${filename}`);
      }
    } catch (directError) {
      console.error(`[DirectEvents] Error fetching direct URL: ${directError}`);
      return res.redirect(`/api/storage-proxy/CALENDAR/events/${filename}`);
    }
  } catch (error) {
    console.error(`[DirectEvents] Error: ${error}`);
    return res.status(500).send('Internal server error');
  }
});

/**
 * Special handler for REAL_ESTATE/real-estate-media URLs in standard format (full path)
 * This is a dedicated handler for the exact full path format
 * 
 * Note: The issue was that in ObjectStorage, the key is stored without the bucket name in the path
 * Format: /api/storage-proxy/REAL_ESTATE/real-estate-media/filename.ext -> real-estate-media/filename.ext
 */
// We need the full path matching to work correctly
router.get('/REAL_ESTATE/real-estate-media/*filename', async (req: Request, res: Response) => {
  try {
    const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
    console.log(`[StorageProxy] REAL_ESTATE/real-estate-media dedicated handler for: ${filename}`);
    
    // Get just the filename, stripping any path components
    const fileNameOnly = path.basename(filename);
    
    // CRITICAL FIX: Don't include the real-estate-media/ in the path since it's already in the URL
    // Don't include REAL_ESTATE/ either - that's the bucket name which is passed separately 
    const storageKey = `real-estate-media/${fileNameOnly}`;
    const bucket = 'REAL_ESTATE';
    
    const ext = path.extname(filename).toLowerCase();
    const contentType = getContentType(ext);
    
    console.log(`[StorageProxy:REAL_ESTATE/full] Accessing file directly: ${storageKey} from ${bucket} bucket`);
    
    // Try to get the file directly using the client
    try {
      const buffer = await objectStorageService.getFile(storageKey, bucket);
      
      if (buffer && buffer.length > 0) {
        console.log(`[StorageProxy:REAL_ESTATE/full] Successfully retrieved file: ${storageKey} (${buffer.length} bytes)`);
        
        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24-hour cache
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Standard-RealEstate-FullPath-Format', 'true');
        
        // Send the file
        return res.send(buffer);
      }
      
      console.log(`[StorageProxy:REAL_ESTATE/full] Empty buffer returned`);
    } catch (error) {
      console.log(`[StorageProxy:REAL_ESTATE/full] Error getting file: ${error.message}`);
    }
    
    // If we get here, try redirecting to the direct-realestate endpoint which should handle all the fallbacks
    return res.redirect(`/api/storage-proxy/direct-realestate/${fileNameOnly}`);
  } catch (error) {
    console.error(`[StorageProxy:REAL_ESTATE/full] Unexpected error: ${error}`);
    return res.status(404).send('Real estate media file not found');
  }
});

/**
 * Special handler for REAL_ESTATE URLs in standard format
 * This handles the specific path format used for real estate media files
 * Format: /api/storage-proxy/REAL_ESTATE/filename.ext (without real-estate-media/ prefix)
 */
router.get('/api/storage-proxy/REAL_ESTATE/*filename', async (req: Request, res: Response) => {
  try {
    const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
    console.log(`[StorageProxy] REAL_ESTATE special handler for: ${filename}`);
    
    // Determine the correct storage key based on the path structure
    let storageKey = filename;
    
    // If it doesn't start with real-estate-media/, add it
    if (!filename.startsWith('real-estate-media/')) {
      if (filename.includes('/')) {
        // Extract just the filename part if there are subdirectories
        const fileNameOnly = path.basename(filename);
        storageKey = `real-estate-media/${fileNameOnly}`;
      } else {
        // Simple filename without any directory structure
        storageKey = `real-estate-media/${filename}`;
      }
    }
    
    const ext = path.extname(filename).toLowerCase();
    const contentType = getContentType(ext);
    
    console.log(`[StorageProxy:REAL_ESTATE] Accessing file directly: ${storageKey} from REAL_ESTATE bucket`);
    
    // Try to get the file directly using the client
    try {
      const buffer = await objectStorageService.getFile(storageKey, 'REAL_ESTATE');
      
      if (buffer && buffer.length > 0) {
        console.log(`[StorageProxy:REAL_ESTATE] Successfully retrieved file: ${storageKey} (${buffer.length} bytes)`);
        
        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24-hour cache
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Standard-RealEstate-Format', 'true');
        
        // Send the file
        return res.send(buffer);
      }
      
      console.log(`[StorageProxy:REAL_ESTATE] Empty buffer returned`);
    } catch (error) {
      console.log(`[StorageProxy:REAL_ESTATE] Error getting file: ${error.message}`);
    }
    
    // If we get here, try redirecting to the direct-realestate endpoint which should handle all the fallbacks
    const fileNameOnly = path.basename(filename);
    return res.redirect(`/api/storage-proxy/direct-realestate/${fileNameOnly}`);
  } catch (error) {
    console.error(`[StorageProxy:REAL_ESTATE] Unexpected error: ${error}`);
    return res.status(404).send('Real estate media file not found');
  }
});

/**
 * CRITICAL FIX: Special handler for FORUM/forum URLs in standard format
 * This has to come before the generic /:bucket/*filename handler
 * 
 * Note: Route parameters in Express are identified by prefixing with a colon (:)
 * but /FORUM/forum is a literal path component that Express is matching exactly,
 * which is why it's not matching our request for /api/storage-proxy/FORUM/forum/...
 * We need to match the full path including /api/storage-proxy prefix
 */
router.get('/api/storage-proxy/FORUM/forum/*filename', async (req: Request, res: Response) => {
  try {
    const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
    console.log(`[StorageProxy] FORUM/forum special handler for: ${filename}`);
    
    // We need to access this file directly in the FORUM bucket with the forum/ prefix
    // but without adding a second forum/ prefix (that caused the bug)
    const storageKey = `forum/${filename}`;
    const ext = path.extname(filename).toLowerCase();
    const contentType = getContentType(ext);
    
    console.log(`[StorageProxy:FORUM/forum] Accessing file directly: ${storageKey} from FORUM bucket`);
    
    // Try to get the file directly using the client
    try {
      const buffer = await objectStorageService.getFile(storageKey, 'FORUM');
      
      if (buffer && buffer.length > 0) {
        console.log(`[StorageProxy:FORUM/forum] Successfully retrieved file: ${storageKey} (${buffer.length} bytes)`);
        
        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24-hour cache
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Standard-Forum-Format', 'true');
        
        // Send the file
        return res.send(buffer);
      }
      
      console.log(`[StorageProxy:FORUM/forum] Empty buffer returned`);
    } catch (error) {
      console.log(`[StorageProxy:FORUM/forum] Error getting file: ${error.message}`);
    }
    
    // If we get here, try redirecting to the direct-forum endpoint which is known to work
    return res.redirect(`/api/storage-proxy/direct-forum/${filename}`);
  } catch (error) {
    console.error(`[StorageProxy:FORUM/forum] Unexpected error: ${error}`);
    return res.redirect(`/api/storage-proxy/direct-forum/${(Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string)) || 'index.html'}`);
  }
});

/**
 * Special handler for BANNER bucket requests
 * Redirects to the working direct-banner endpoint
 */
router.get('/BANNER/banner-slides/*filename', async (req: Request, res: Response) => {
  try {
    const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
    console.log(`[StorageProxy] BANNER/banner-slides handler redirecting to direct-banner: ${filename}`);
    
    // Extract just the filename without any path components
    const fileNameOnly = path.basename(filename);
    
    // Redirect to the working direct-banner endpoint
    return res.redirect(`/api/storage-proxy/direct-banner/${fileNameOnly}`);
  } catch (error) {
    console.error(`[StorageProxy:BANNER] Error: ${error}`);
    return res.status(404).send('Banner file not found');
  }
});

/**
 * Special handler for AVATARS bucket requests
 * Redirects to the working direct-avatars endpoint
 */
router.get('/AVATARS/*filename', async (req: Request, res: Response) => {
  try {
    const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
    console.log(`[StorageProxy] AVATARS handler redirecting to direct-avatars: ${filename}`);
    
    // Extract just the filename without any path components
    const fileNameOnly = path.basename(filename);
    
    // Redirect to the working direct-avatars endpoint
    return res.redirect(`/api/storage-proxy/direct-avatars/${fileNameOnly}`);
  } catch (error) {
    console.error(`[StorageProxy:AVATARS] Error: ${error}`);
    return res.status(404).send('Avatar file not found');
  }
});

/**
 * Proxy endpoint for accessing Object Storage files
 * URL format: /api/storage-proxy/:bucket/:filename
 * Also handles direct Object Storage URLs with normalized format
 */
router.get('/:bucket/*filename', async (req: Request, res: Response) => {
  // Special case for FORUM bucket with forum/ prefix to avoid redirect loops
  const bucket = req.params.bucket;
  const filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : (req.params.filename as string);
  
  // Critical fix: Check for FORUM bucket with either forum/ prefix or forum/forum/ double prefix
  if (bucket === 'FORUM' && (filename.startsWith('forum/') || filename === 'forum')) {
    console.log(`[StorageProxy] Special case: FORUM bucket path detected, using direct access`);
    
    // Handle both forum/ and forum/forum/ cases
    let actualFilename = '';
    
    if (filename.startsWith('forum/forum/')) {
      // Double forum case: forum/forum/filename.txt -> filename.txt
      actualFilename = filename.substring('forum/forum/'.length);
      console.log(`[StorageProxy:DEBUG] Double forum prefix detected: ${filename} -> ${actualFilename}`);
    } else if (filename.startsWith('forum/')) {
      // Single forum case: forum/filename.txt -> filename.txt
      actualFilename = filename.substring('forum/'.length);
      console.log(`[StorageProxy:DEBUG] Single forum prefix detected: ${filename} -> ${actualFilename}`);
    } else {
      // Just 'forum' without a trailing slash - shouldn't happen normally
      actualFilename = '';
      console.log(`[StorageProxy:DEBUG] Just 'forum' without trailing slash: ${filename}`);
    }
    
    // Skip if no actual filename could be extracted
    if (!actualFilename) {
      console.log(`[StorageProxy:DEBUG] No filename extracted, falling back to direct-forum endpoint`);
      return res.redirect(`/api/storage-proxy/direct-forum/index.html`);
    }
    
    console.log(`[StorageProxy:DEBUG] Full URL path: ${req.path}`);
    
    // Instead of redirecting, handle the file access directly
    try {
      // Try to get the file directly using the client
      const storageKey = `forum/${actualFilename}`;
      const ext = path.extname(actualFilename).toLowerCase();
      const contentType = getContentType(ext);
      
      console.log(`[StorageProxy:ForumSpecialCase] Accessing file directly: ${storageKey} from FORUM bucket`);
      
      const buffer = await objectStorageService.getFile(storageKey, 'FORUM');
      
      if (buffer && buffer.length > 0) {
        console.log(`[StorageProxy:ForumSpecialCase] Successfully retrieved file from Object Storage: ${storageKey} (${buffer.length} bytes)`);
        console.log(`[StorageProxy:ForumSpecialCase] Content preview: ${buffer.toString().substring(0, 50)}`);
        
        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24-hour cache
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Forum-Special-Case', 'true');
        
        // Send the file
        return res.send(buffer);
      } else {
        console.log(`[StorageProxy:ForumSpecialCase] Object Storage returned empty buffer, falling back to redirect`);
      }
    } catch (error) {
      console.log(`[StorageProxy:ForumSpecialCase] Error getting file directly: ${error.message}, falling back to redirect`);
    }
    
    // If direct access failed, redirect as a fallback
    console.log(`[StorageProxy:ForumSpecialCase] Falling back to direct-forum endpoint for ${actualFilename}`);
    return res.redirect(`/api/storage-proxy/direct-forum/${actualFilename}`);
  }
  
  // Continue with normal processing for other cases
  // Hoist storageKey so the outer catch block can reference it safely even
  // if an error is thrown before it gets assigned inside the try.
  let storageKey = `${bucket}/${filename}`;
  try {
    // Note: `bucket` and `filename` are already declared and normalized above
    // (Express 5 returns the wildcard `*filename` param as an array). Do NOT
    // re-destructure `req.params` here — that would clobber `filename` back
    // to an array and break `.replace(...)` below.

    // Skip verbose logging for common requests but keep it for debugging problems
    const isDebug = req.query.debug === 'true';
    
    if (isDebug) {
      console.log(`Storage proxy request for bucket: ${bucket}, file: ${filename}`);
      
      // Log request headers for debugging only when needed
      console.log('Request headers:', JSON.stringify({
        range: req.headers.range,
        origin: req.headers.origin,
        referer: req.headers.referer,
        'user-agent': req.headers['user-agent']
      }));
    }
    
    // Handle path with directories - allow nested paths in filename
    const filePath = filename.replace(/\.\.\//g, ''); // Remove any path traversal attempts
    
    // Convert from URL parameters to storage key (reassign the hoisted var)
    storageKey = `${bucket}/${filePath}`;
    if (isDebug) {
      console.log(`Using storage key: ${storageKey}`);
    }
    
    // Check if this is a direct URL from the database that needs fixing
    if (req.headers.referer) {
      const referer = req.headers.referer.toString();
      if (referer.includes('/events/') && storageKey.startsWith('object-storage.replit.app/')) {
        // This looks like a direct URL from the database - extract the real filename
        const actualFilename = storageKey.split('/').pop();
        if (actualFilename) {
          // Redirect to the proper proxy URL
          const properProxyUrl = `/api/storage-proxy/CALENDAR/events/${actualFilename}`;
          console.log(`Redirecting direct URL to proper proxy URL: ${properProxyUrl}`);
          return res.redirect(properProxyUrl);
        }
      }
    }
    
    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    const contentType = getContentType(ext);
    
    // Skip filesystem access and go directly to Object Storage
    // We're prioritizing Object Storage exclusively as per requirements
    console.log(`Storage proxy: Accessing exclusively from Object Storage for ${bucket}/${filePath}`);
    
    // Handle range requests - important for video streaming
    const range = req.headers.range;
    let fetchOptions = {};
    
    if (range && contentType.startsWith('video/')) {
      console.log(`Processing range request: ${range}`);
      fetchOptions = {
        headers: {
          'Range': range
        }
      };
    }
    
    // Check if we're requesting an event media file and adjust the path correctly
    let storagePathToUse = storageKey;
    
    // Critical fix for calendar event media path handling
    if (bucket === 'CALENDAR' && (
      filePath.startsWith('events/') || 
      filePath.includes('/events/') || 
      filePath.includes('/calendar/')
    )) {
      // Extract just the filename without any path prefixes
      const fileNameOnly = path.basename(filePath);
      
      // IMPORTANT: Calendar event files are stored with just 'events/' prefix for consistency
      // without the BUCKET prefix in the key (but still using the CALENDAR bucket)
      storagePathToUse = `events/${fileNameOnly}`;
      console.log(`[StorageProxy] Using simplified calendar event path: ${storagePathToUse} (from ${filePath})`);
      
      // Add debugging
      console.log(`[StorageProxy] Event media debug:
        - Original bucket: ${bucket}
        - Original filePath: ${filePath}
        - Extracted filename: ${fileNameOnly}
        - Final storage path: ${storagePathToUse}
        - Final object storage URL will be: https://object-storage.replit.app/${bucket}/${storagePathToUse}
      `);
    }
    
    // Special handling for forum media - fix the path if needed
    if (bucket === 'FORUM') {
      // If this is forum media, ensure it has the 'forum/' prefix
      if (!filePath.startsWith('forum/')) {
        // Extract just the filename
        const fileNameOnly = path.basename(filePath);
        
        // Set the proper storage path for forum media
        storagePathToUse = `forum/${fileNameOnly}`;
        console.log(`[StorageProxy] Corrected forum media path: ${storagePathToUse} (from ${filePath})`);
      }
      
      // Add debugging
      console.log(`[StorageProxy] Forum media debug:
        - Original bucket: ${bucket}
        - Original filePath: ${filePath}
        - Final storage path: ${storagePathToUse}
        - Final object storage URL will be: https://object-storage.replit.app/${bucket}/${storagePathToUse}
      `);
    }
    
    // Special handling for real estate media - fix the path if needed
    if (bucket === 'REAL_ESTATE') {
      // If this is real estate media, ensure it has the 'real-estate-media/' prefix
      if (!filePath.startsWith('real-estate-media/')) {
        // Extract just the filename
        const fileNameOnly = path.basename(filePath);
        
        // Set the proper storage path for real estate media
        storagePathToUse = `real-estate-media/${fileNameOnly}`;
        console.log(`[StorageProxy] Corrected real estate media path: ${storagePathToUse} (from ${filePath})`);
      }
      
      // Add debugging
      console.log(`[StorageProxy] Real estate media debug:
        - Original bucket: ${bucket}
        - Original filePath: ${filePath}
        - Final storage path: ${storagePathToUse}
        - Final object storage URL will be: https://object-storage.replit.app/${bucket}/${storagePathToUse}
      `);
    }
    
    // First try to fetch from Object Storage directly using the client rather than HTTP
    try {
      // Attempt to get the file directly from Object Storage using the client
      console.log(`[StorageProxy] Attempting to get file directly with client: ${storagePathToUse} from bucket ${bucket}`);
      
      // Use our objectStorageService instead of direct HTTP
      try {
        const buffer = await objectStorageService.getFile(storagePathToUse, bucket);
        
        if (buffer && buffer.length > 0) {
          console.log(`[StorageProxy] Successfully retrieved file from Object Storage: ${storagePathToUse} (${buffer.length} bytes)`);
          
          // Set response headers
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Cache-Control', 'public, max-age=86400'); // 24-hour cache
          res.setHeader('Access-Control-Allow-Origin', '*');
          
          // Send the file
          return res.send(buffer);
        } else {
          console.log(`[StorageProxy] Object Storage returned empty buffer for ${storagePathToUse}`);
          // Fall through to HTTP method
        }
      } catch (clientError) {
        console.log(`[StorageProxy] Client error getting file: ${clientError.message}`);
        // Fall through to HTTP method
      }
    } catch (directError) {
      console.log(`[StorageProxy] Error in direct client access: ${directError.message}`);
      // Fall through to HTTP method
    }
      
    // Fallback to HTTP approach if client method fails
    // Try to fetch directly from Object Storage URL with optional range request
    const objectStorageUrl = `https://object-storage.replit.app/${storagePathToUse}`;
    if (isDebug) {
      console.log(`Proxying request to: ${objectStorageUrl}`, fetchOptions);
    }
    
    // CRITICAL FIX: Add X-Obj-Bucket header to all requests to Replit Object Storage
    // This is required for the Replit Object Storage service to know which bucket to access
    const fetchOptionsWithBucket = {
      ...fetchOptions,
      headers: {
        ...(fetchOptions.headers || {}),
        'X-Obj-Bucket': bucket,  // Add bucket name header
        'Accept': '*/*'
      }
    };
    
    if (isDebug) {
      console.log(`[StorageProxy] Using headers: ${JSON.stringify(fetchOptionsWithBucket.headers)}`);
    }
    
    try {
      // Fetch the file from Object Storage with server-side fetch and proper bucket header
      const response = await fetch(objectStorageUrl, fetchOptionsWithBucket);
      
      // Log response headers for debugging
      if (isDebug || response.status !== 200) {
        console.log('Object Storage response status:', response.status);
      }
      
      // Check if response was successful
      if (response.status === 404) {
        console.log(`File not found in Object Storage: ${storageKey}`);
        console.log(`CRITICAL DEBUG: Attempted to access: ${objectStorageUrl}`);
        
        // For calendar events, try alternate paths before falling back to default image
        if (storageKey.includes('CALENDAR/events/')) {
          console.log(`Trying alternate paths for calendar event media: ${storageKey}`);
          
          // Extract just the filename without path
          const fileNameOnly = path.basename(filePath);
          
          // CRITICAL FIX: Check if this specific file exists in the bucket directly
          // This directly checks for the file we saw in the bucket listing
          const directUrl = `https://object-storage.replit.app/events/${fileNameOnly}`;
          console.log(`CRITICAL FIX: Checking direct URL format: ${directUrl}`);
          
          try {
            // Add bucket header to HEAD request
            const directResponse = await fetch(directUrl, { 
              method: 'HEAD',
              headers: {
                'X-Obj-Bucket': 'CALENDAR',
                'Accept': '*/*'
              }
            });
            
            if (directResponse.ok) {
              console.log(`CRITICAL FIX SUCCESS! File found at direct path: events/${fileNameOnly}`);
              
              // If successful, get the actual content (with bucket header)
              const contentResponse = await fetch(directUrl, {
                ...fetchOptions, 
                headers: {
                  ...(fetchOptions.headers || {}),
                  'X-Obj-Bucket': 'CALENDAR',
                  'Accept': '*/*'
                }
              });
              
              if (contentResponse.ok) {
                // Apply headers from response
                const headers = contentResponse.headers.raw();
                Object.entries(headers).forEach(([key, values]) => {
                  if (!['content-length', 'content-type', 'cache-control'].includes(key.toLowerCase())) {
                    res.setHeader(key, values);
                  }
                });
                
                // Set our own headers
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('X-Direct-Path-Fix', 'true');
                
                // Stream the content to the client
                return contentResponse.body?.pipe(res);
              }
            } else {
              console.log(`CRITICAL FIX: Direct URL not found, status: ${directResponse.status}`);
            }
          } catch (directError) {
            console.error(`CRITICAL FIX: Error checking direct URL: ${directError.message}`);
          }
          
          // Fall back to the standard alternate paths if direct fix fails
          // Try different path combinations that might exist
          const alternatePaths = [
            // Try without events/ directory
            {key: `${bucket}/${fileNameOnly}`, url: `https://object-storage.replit.app/${bucket}/${fileNameOnly}`},
            // Try with different directory structure
            {key: `events/${fileNameOnly}`, url: `https://object-storage.replit.app/events/${fileNameOnly}`},
            // Try with CALENDAR prefix in key but no events/ prefix
            {key: `CALENDAR/${fileNameOnly}`, url: `https://object-storage.replit.app/CALENDAR/${fileNameOnly}`},
            // Try with just events as the bucket
            {key: `events/${fileNameOnly}`, url: `https://object-storage.replit.app/events/${fileNameOnly}`},
            // Try with explicit doubled path
            {key: `CALENDAR/CALENDAR/events/${fileNameOnly}`, url: `https://object-storage.replit.app/CALENDAR/CALENDAR/events/${fileNameOnly}`}
          ];
          
          // Try each alternate path
          for (const altPath of alternatePaths) {
            try {
              console.log(`Trying alternate path: ${altPath.key} (${altPath.url})`);
              
              // CRITICAL FIX: Add X-Obj-Bucket header to all HEAD requests
              // Always use CALENDAR bucket since we're specifically handling event images
              const altResponse = await fetch(altPath.url, { 
                method: 'HEAD',
                headers: {
                  'X-Obj-Bucket': 'CALENDAR',
                  'Accept': '*/*'
                }
              });
              
              if (altResponse.ok) {
                console.log(`SUCCESS! Found at alternate path: ${altPath.key}`);
                
                // Get the full file with proper bucket header
                const contentResponse = await fetch(altPath.url, {
                  ...fetchOptions,
                  headers: {
                    ...(fetchOptions.headers || {}),
                    'X-Obj-Bucket': 'CALENDAR',
                    'Accept': '*/*'
                  }
                });
                
                if (contentResponse.ok) {
                  // Apply headers from response
                  const headers = contentResponse.headers.raw();
                  Object.entries(headers).forEach(([key, values]) => {
                    if (!['content-length', 'content-type', 'cache-control'].includes(key.toLowerCase())) {
                      res.setHeader(key, values);
                    }
                  });
                  
                  // Set our own headers
                  res.setHeader('Content-Type', contentType);
                  res.setHeader('Cache-Control', 'public, max-age=86400');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.setHeader('X-Found-At-Alternate-Path', altPath.key);
                  
                  // Stream the content to the client
                  return contentResponse.body?.pipe(res);
                }
              }
            } catch (altError) {
              console.error(`Error checking alternate path ${altPath.key}:`, altError);
            }
          }
          
          // If we get here, none of the alternate paths worked, fall back to default image
          console.log(`All alternate paths failed, using default event image for: ${storageKey}`);
          
          try {
            // Use local default image from public directory instead of Object Storage
            const defaultImagePath = path.join(process.cwd(), 'client', 'public', 'default-event-image.svg');
            if (fs.existsSync(defaultImagePath)) {
              console.log(`Serving local default event image for: ${storageKey}`);
              res.setHeader('Content-Type', 'image/svg+xml');
              res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache for default image
              res.setHeader('X-Default-Event-Image', 'true'); // Indicate this is a default image
              res.setHeader('Access-Control-Allow-Origin', '*');
              return res.sendFile(defaultImagePath);
            }
            
            // Fallback to Object Storage as a last resort (though we shouldn't need this anymore)
            const defaultImageUrl = 'https://object-storage.replit.app/events/default-event-image.svg';
            const defaultResponse = await fetch(defaultImageUrl, {
              headers: {
                'X-Obj-Bucket': 'CALENDAR',
                'Accept': '*/*'
              }
            });
            
            if (defaultResponse.ok) {
              // Apply response headers
              res.setHeader('Content-Type', 'image/svg+xml');
              res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache for default image
              res.setHeader('X-Default-Event-Image', 'true'); // Indicate this is a default image
              res.setHeader('Access-Control-Allow-Origin', '*');
              
              // Stream the response
              defaultResponse.body?.pipe(res);
              return;
            } else {
              console.log(`Default event image not found, returning 404`);
              return res.status(404).send('File not found');
            }
          } catch (defaultErr) {
            console.error('Error serving default event image:', defaultErr);
            return res.status(500).send('Error serving default image');
          }
        }
        
        // Special dedicated handling for banner slide media with custom fallbacks
        if (storageKey.includes('banner-slides/')) {
          console.log(`[StorageProxy] Banner slide media detected: ${storageKey}`);
          const fileNameOnly = path.basename(filePath);
          
          // Check if this is a BANNER bucket request (preferred)
          if (bucket === 'BANNER') {
            console.log(`[StorageProxy] Using dedicated BANNER bucket for: ${fileNameOnly}`);
            
            // Try to get from BANNER bucket first (correct location)
            try {
              // First try simplified path in BANNER bucket
              const bannerPath = `banner-slides/${fileNameOnly}`;
              const bannerUrl = `https://object-storage.replit.app/${bucket}/${bannerPath}`;
              
              console.log(`[StorageProxy] Checking BANNER path: ${bannerUrl}`);
              
              // Try HEAD request first
              const bannerResponse = await fetch(bannerUrl, { 
                method: 'HEAD',
                headers: {
                  'X-Obj-Bucket': bucket,
                  'Accept': '*/*'
                }
              });
              
              if (bannerResponse.ok) {
                console.log(`[StorageProxy] Found in BANNER bucket: ${bannerPath}`);
                
                // Now get the full file with proper bucket header
                const contentResponse = await fetch(bannerUrl, {
                  ...fetchOptions,
                  headers: {
                    ...(fetchOptions.headers || {}),
                    'X-Obj-Bucket': bucket,
                    'Accept': '*/*'
                  }
                });
                
                if (contentResponse.ok) {
                  // Set response headers
                  res.setHeader('Content-Type', contentType);
                  res.setHeader('Cache-Control', 'public, max-age=86400');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.setHeader('X-Banner-Source', 'banner-bucket-direct');
                  
                  // Stream the content
                  return contentResponse.body?.pipe(res);
                }
              }
            } catch (bannerErr) {
              console.error(`[StorageProxy] Error accessing BANNER bucket: ${bannerErr.message}`);
            }
          }
          
          // If we get here, try the DEFAULT bucket as fallback
          try {
            const defaultPath = `banner-slides/${fileNameOnly}`;
            const defaultUrl = `https://object-storage.replit.app/DEFAULT/${defaultPath}`;
            
            console.log(`[StorageProxy] Trying DEFAULT bucket fallback: ${defaultUrl}`);
            
            // Try HEAD request first
            const defaultResponse = await fetch(defaultUrl, { 
              method: 'HEAD',
              headers: {
                'X-Obj-Bucket': 'DEFAULT',
                'Accept': '*/*'
              }
            });
            
            if (defaultResponse.ok) {
              console.log(`[StorageProxy] Found in DEFAULT bucket: ${defaultPath}`);
              
              // Now get the full file with proper bucket header
              const contentResponse = await fetch(defaultUrl, {
                ...fetchOptions,
                headers: {
                  ...(fetchOptions.headers || {}),
                  'X-Obj-Bucket': 'DEFAULT',
                  'Accept': '*/*'
                }
              });
              
              if (contentResponse.ok) {
                // Set response headers
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('X-Banner-Source', 'default-bucket-fallback');
                
                // Stream the content
                return contentResponse.body?.pipe(res);
              }
            }
          } catch (defaultErr) {
            console.error(`[StorageProxy] Error accessing DEFAULT bucket: ${defaultErr.message}`);
          }
          
          // As a last resort, try to get the file directly from objectStorageService
          try {
            // Try BANNER bucket first
            let buffer = await objectStorageService.getFile(`banner-slides/${fileNameOnly}`, 'BANNER');
            
            // If not found, try DEFAULT bucket
            if (!buffer || buffer.length === 0) {
              buffer = await objectStorageService.getFile(`banner-slides/${fileNameOnly}`, 'DEFAULT');
            }
            
            if (buffer && buffer.length > 0) {
              console.log(`[StorageProxy] Retrieved banner slide from Object Storage client: ${fileNameOnly} (${buffer.length} bytes)`);
              
              // Set response headers
              res.setHeader('Content-Type', contentType);
              res.setHeader('Content-Length', buffer.length);
              res.setHeader('Cache-Control', 'public, max-age=86400');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('X-Banner-Source', 'direct-client-access');
              
              // Send the file
              return res.send(buffer);
            }
          } catch (clientErr) {
            console.error(`[StorageProxy] Error with direct client access: ${clientErr.message}`);
          }
          
          // Use a server-side placeholder for banner slides if all else fails
          try {
            const placeholderPath = path.join(process.cwd(), 'public', 'banner-placeholder.jpg');
            if (fs.existsSync(placeholderPath)) {
              console.log(`[StorageProxy] Serving banner placeholder for: ${storageKey}`);
              res.setHeader('Content-Type', 'image/jpeg');
              res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache for placeholder
              res.setHeader('X-Banner-Placeholder', 'true'); // Indicate this is a placeholder
              return res.sendFile(placeholderPath);
            }
          } catch (placeholderErr) {
            console.error('[StorageProxy] Error serving placeholder:', placeholderErr);
          }
        }
        
        // For forum media, try to serve a placeholder instead of a 404
        if (bucket === 'FORUM' || storageKey.includes('forum/') || storageKey.includes('forum-media/')) {
          try {
            const placeholderPath = path.join(process.cwd(), 'public', 'media-placeholder', 'default-forum-image.svg');
            if (fs.existsSync(placeholderPath)) {
              console.log(`[StorageProxy] Serving forum media placeholder for: ${storageKey}`);
              res.setHeader('Content-Type', 'image/svg+xml');
              res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache for placeholder
              res.setHeader('X-Forum-Placeholder', 'true'); // Indicate this is a placeholder
              return res.sendFile(placeholderPath);
            }
          } catch (placeholderErr) {
            console.error('[StorageProxy] Error serving forum placeholder:', placeholderErr);
          }
        }
        
        return res.status(404).send('File not found');
      }
      
      if (!response.ok && response.status !== 206) { // 206 is Partial Content - valid for range requests
        throw new Error(`Failed to fetch from Object Storage: ${response.status} ${response.statusText}`);
      }
      
      // Apply all response headers from the Object Storage response
      const headers = response.headers.raw();
      Object.entries(headers).forEach(([key, values]) => {
        // Skip certain headers we want to set ourselves
        if (!['content-length', 'content-type', 'cache-control'].includes(key.toLowerCase())) {
          res.setHeader(key, values);
        }
      });
      
      // Set our own headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hour cache
      
      // Ensure CORS headers are set properly
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, Accept, Range');
      
      // Handle range response
      if (response.status === 206) {
        // Ensure we pass through the Content-Range header
        const contentRange = response.headers.get('content-range');
        if (contentRange) {
          res.setHeader('Content-Range', contentRange);
          res.status(206); // Set status to 206 Partial Content
        }
      }
      
      // Set content length if available
      if (response.headers.get('content-length')) {
        res.setHeader('Content-Length', response.headers.get('content-length') || '');
      }
      
      // Add headers for video streaming if needed
      if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
        res.setHeader('Accept-Ranges', 'bytes');
      }
      
      // Pipe the response directly to the client
      response.body?.pipe(res);
    } catch (error) {
      console.error('Error fetching from Object Storage URL:', error);
      
      // Try to get file directly from our Object Storage service as a fallback
      try {
        console.log('Falling back to direct Object Storage service');
        const buffer = await objectStorageService.getFile(storageKey);
        
        if (!buffer || buffer.length === 0) {
          console.log(`Empty buffer returned from Object Storage service for: ${storageKey}`);
          return res.status(404).send('File not found');
        }
        
        // Handle range requests
        if (range && contentType.startsWith('video/')) {
          const fileSize = buffer.length;
          
          // Parse range
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          
          // Calculate chunk size
          const chunksize = (end - start) + 1;
          
          // Set headers
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*'
          });
          
          // Send the slice of the buffer
          return res.end(buffer.slice(start, end + 1));
        } else {
          // Regular response
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Length', buffer.length.toString());
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Accept-Ranges', 'bytes');
          
          return res.send(buffer);
        }
      } catch (serviceError) {
        console.error('Error getting file from Object Storage service:', serviceError);
        
        // Check if this is forum media and serve a fallback image
        if (bucket === 'FORUM' || storageKey.includes('forum/') || storageKey.includes('forum-media/')) {
          try {
            const forumPlaceholderPath = path.join(process.cwd(), 'public', 'media-placeholder', 'default-forum-image.svg');
            if (fs.existsSync(forumPlaceholderPath)) {
              console.log(`[StorageProxy] Service error - Serving forum media placeholder for: ${storageKey}`);
              res.setHeader('Content-Type', 'image/svg+xml');
              res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache for placeholder
              res.setHeader('X-Forum-Placeholder', 'true');
              res.setHeader('X-Error-Fallback', 'true');
              return res.sendFile(forumPlaceholderPath);
            }
          } catch (placeholderErr) {
            console.error('[StorageProxy] Error serving forum placeholder after service error:', placeholderErr);
          }
        }
        
        return res.status(500).send('Failed to proxy file from Object Storage');
      }
    }
  } catch (error) {
    console.error('Storage proxy error:', error);
    
    // Global error handler for forum media
    if (bucket === 'FORUM' || storageKey.includes('forum/') || storageKey.includes('forum-media/')) {
      try {
        const forumPlaceholderPath = path.join(process.cwd(), 'public', 'media-placeholder', 'default-forum-image.svg');
        if (fs.existsSync(forumPlaceholderPath)) {
          console.log(`[StorageProxy] Global error handler - Serving forum media placeholder for: ${storageKey}`);
          res.setHeader('Content-Type', 'image/svg+xml');
          res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache for placeholder
          res.setHeader('X-Forum-Placeholder', 'true');
          res.setHeader('X-Global-Error-Fallback', 'true');
          return res.sendFile(forumPlaceholderPath);
        }
      } catch (placeholderErr) {
        console.error('[StorageProxy] Error serving forum placeholder in global error handler:', placeholderErr);
      }
    }
    
    return res.status(500).send('Internal server error');
  }
});

/**
 * Get content type based on file extension
 */
function getContentType(ext: string): string {
  // Make sure we're working with lowercase extensions
  const lowerExt = ext.toLowerCase();
  
  switch (lowerExt) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.mp4':
    case '.m4v': // Support M4V format (which is essentially MP4)
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mov':
      return 'video/quicktime';
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.pdf':
      return 'application/pdf';
    case '.txt':
      return 'text/plain';
    case '.json':
      return 'application/json';
    default:
      // Log unrecognized extensions to help with debugging
      console.log(`Unrecognized file extension: ${ext}, using default content type`);
      return 'application/octet-stream';
  }
}

/**
 * CRITICAL FIX: Add a debug logging middleware to capture all requests
 * This helps us see exactly what routes are being matched
 */
router.use((req, res, next) => {
  // Only log for special routes we're debugging
  if (req.path.includes('/FORUM/forum/')) {
    console.log(`[RouteDebug] Request path: ${req.path}, Method: ${req.method}`);
    console.log(`[RouteDebug] All registered routes: ${router.stack.length} total`);
    
    // List all route handlers
    router.stack.forEach((layer, index) => {
      if (layer.route) {
        const path = layer.route.path;
        const methods = Object.keys(layer.route.methods).join(',');
        console.log(`[RouteDebug] Route ${index}: ${methods} ${path}`);
      }
    });
  }
  next();
});

// The getContentType function is already defined above, no need to redefine it

export default router;