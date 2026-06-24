/**
 * Enhanced Forum Media Redirect Middleware
 * 
 * This middleware handles all forum media URLs and redirects them to the appropriate location,
 * with multiple fallback mechanisms to ensure images always display correctly.
 * 
 * Key features:
 * - Supports multiple URL formats (/forum-media/, /uploads/forum/, direct object storage URLs)
 * - Checks both filesystem and Object Storage for media
 * - Prioritizes local files for faster delivery
 * - Provides useful fallback images when media is not found
 * - Detailed logging for troubleshooting
 */

import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { objectStorageService } from './object-storage-service';
import { unifiedStorageService, STORAGE_BUCKETS } from './unified-storage-service';

// Constants
const FORUM_BUCKET = STORAGE_BUCKETS.FORUM;
const UPLOADS_FORUM_DIR = path.join('uploads', 'forum'); // Path for new format
const FORUM_MEDIA_DIR = 'forum-media'; // Root path
const UPLOADS_FORUM_MEDIA_DIR = path.join('uploads', 'forum-media'); // Legacy path

/**
 * Enhanced middleware to handle forum media requests with multiple fallbacks
 */
export default function forumMediaRedirectMiddleware(req: Request, res: Response, next: NextFunction) {
  // Handle a wider range of forum media paths including both old and new formats
  const isForumMediaPath = 
    req.path.startsWith('/forum-media/') || 
    req.path.startsWith('/uploads/forum-media/') ||
    req.path.startsWith('/uploads/forum/') ||
    req.path.startsWith('/uploads/api/storage-proxy/FORUM/') ||
    req.path.startsWith('/api/storage-proxy/FORUM/forum/') ||
    req.path.startsWith('/forum/media-') ||  // Support the new format
    (req.path.includes('/FORUM/forum/') && req.path.includes('object-storage')); 
  
  if (!isForumMediaPath) {
    return next();
  }
  
  console.log(`[ForumMediaRedirect] Handling forum media request: ${req.path}`);
  
  // Extract the filename based on URL pattern
  let filename: string;
  let storageKey: string;
  
  if (req.path.startsWith('/forum-media/')) {
    // Format: /forum-media/filename.ext
    filename = req.path.substring('/forum-media/'.length);
    storageKey = `forum/${filename}`;
  } else if (req.path.startsWith('/uploads/forum-media/')) {
    // Legacy format: /uploads/forum-media/filename.ext
    filename = req.path.substring('/uploads/forum-media/'.length);
    storageKey = `forum/${filename}`;
  } else if (req.path.startsWith('/uploads/forum/')) {
    // New format: /uploads/forum/filename.ext
    filename = req.path.substring('/uploads/forum/'.length);
    storageKey = `forum/${filename}`;
  } else if (req.path.startsWith('/forum/')) {
    // Newest format: /forum/media-timestamp-random.ext
    filename = req.path.substring('/forum/'.length);
    storageKey = `forum/${filename}`;
    console.log(`[ForumMediaRedirect] Found newest format URL. Using storageKey: ${storageKey}`);
  } else if (req.path.startsWith('/uploads/api/storage-proxy/FORUM/')) {
    // Malformed storage proxy URL: /uploads/api/storage-proxy/FORUM/forum/filename.ext
    const pathWithoutUploads = req.path.substring('/uploads/'.length);
    console.log(`[ForumMediaRedirect] Correcting malformed URL: ${req.path} → ${pathWithoutUploads}`);
    
    // Extract the filename from the remaining path
    const parts = pathWithoutUploads.split('/');
    if (parts.length >= 4) {
      filename = parts.slice(4).join('/');
      storageKey = `forum/${filename}`;
    }
    
    // Redirect to the correct URL format
    return res.redirect(pathWithoutUploads);
  } else if (req.path.startsWith('/api/storage-proxy/FORUM/forum/')) {
    // Storage proxy URL format: /api/storage-proxy/FORUM/forum/filename.ext
    const parts = req.path.split('/');
    if (parts.length >= 5) {
      filename = parts.slice(5).join('/');
      storageKey = `forum/${filename}`;
    }
  } else if (req.path.includes('/FORUM/forum/') && req.path.includes('object-storage')) {
    // Direct object storage URL:
    // Format: /object-storage.replit.app/FORUM/forum/filename.ext
    const parts = req.path.split('/');
    const forumIndex = parts.findIndex(part => part === 'forum');
    if (forumIndex >= 0 && forumIndex + 1 < parts.length) {
      filename = parts.slice(forumIndex + 1).join('/');
      storageKey = `forum/${filename}`;
    }
  }
  
  // Skip if no filename could be extracted
  if (!filename) {
    console.warn(`[ForumMediaRedirect] Could not extract filename from path: ${req.path}`);
    return next();
  }
  
  // Remove query parameters if present
  if (filename.includes('?')) {
    filename = filename.split('?')[0];
  }
  
  console.log(`[ForumMediaRedirect] Extracted filename: ${filename}, Storage key: ${storageKey}`);
  
  // Check all possible file locations - both filesystem and Object Storage
  
  // Filesystem paths to check
  const pathsToCheck = [
    path.join(process.cwd(), FORUM_MEDIA_DIR, filename), // /forum-media/filename
    path.join(process.cwd(), UPLOADS_FORUM_DIR, filename), // /uploads/forum/filename
    path.join(process.cwd(), UPLOADS_FORUM_MEDIA_DIR, filename), // /uploads/forum-media/filename
    path.join(process.cwd(), 'uploads', filename) // /uploads/filename (fallback)
  ];
  
  // Log the paths we're checking
  console.log(`[ForumMediaRedirect] Checking filesystem paths for ${filename}:`);
  pathsToCheck.forEach((p, i) => console.log(`  ${i+1}. ${p} - exists: ${fs.existsSync(p)}`));
  
  // Find the first existing file
  const existingPath = pathsToCheck.find(p => fs.existsSync(p));
  
  if (existingPath) {
    // Found in filesystem - serve directly
    console.log(`[ForumMediaRedirect] Found file in filesystem: ${existingPath}`);
    
    // Serve the file with appropriate headers
    res.set({
      'Cache-Control': 'public, max-age=86400', // 24 hours
      'Access-Control-Allow-Origin': '*'
    });
    return res.sendFile(existingPath);
  }
  
  // Not found in filesystem, try Object Storage
  console.log(`[ForumMediaRedirect] File not found in filesystem, checking Object Storage: ${storageKey}`);
  
  // First attempt: Ask UnifiedStorageService
  unifiedStorageService.fileExists(storageKey, FORUM_BUCKET)
    .then(existsInUnifiedStorage => {
      if (existsInUnifiedStorage) {
        // Found in Unified Storage
        // Use direct-forum endpoint to avoid redirect loops
        const directForumUrl = `/api/storage-proxy/direct-forum/${filename}`;
        console.log(`[ForumMediaRedirect] File exists in UnifiedStorage, redirecting to: ${directForumUrl}`);
        return res.redirect(directForumUrl);
      }
      
      // Second attempt: Ask ObjectStorageService
      return objectStorageService.fileExists(storageKey, FORUM_BUCKET)
        .then(existsInObjectStorage => {
          if (existsInObjectStorage) {
            // Found in Object Storage
            // Use direct-forum endpoint to avoid redirect loops
            const directForumUrl = `/api/storage-proxy/direct-forum/${filename}`;
            console.log(`[ForumMediaRedirect] File exists in ObjectStorageService, redirecting to: ${directForumUrl}`);
            return res.redirect(directForumUrl);
          }
          
          // File not found anywhere - use fallback
          console.log(`[ForumMediaRedirect] File not found in any location: ${filename}`);
          
          // Use local fallback image
          const fallbackPath = '/media-placeholder/default-forum-image.svg';
          console.log(`[ForumMediaRedirect] Using local fallback image: ${fallbackPath}`);
          return res.redirect(fallbackPath);
        });
    })
    .catch(error => {
      console.error(`[ForumMediaRedirect] Error checking storage services: ${error.message}`);
      
      // If both storage services fail, try one more time with the filesystem
      if (existingPath) {
        console.log(`[ForumMediaRedirect] Error handler - Using filesystem fallback: ${existingPath}`);
        return res.sendFile(existingPath);
      } else {
        // Use local fallback image
        const fallbackPath = '/media-placeholder/default-forum-image.svg';
        console.log(`[ForumMediaRedirect] Error handler - Using local fallback image: ${fallbackPath}`);
        return res.redirect(fallbackPath);
      }
    });
}