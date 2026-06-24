/**
 * Special handler for the standard FORUM/forum format
 * 
 * This is a specialized handler to address the issues with the standard storage proxy format
 * URL format: /api/storage-proxy/FORUM/forum/filename.ext
 */

import { Request, Response } from 'express';
import { objectStorageService } from './object-storage-service';
import path from 'path';

/**
 * Get the content type based on file extension
 */
function getContentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.txt':
      return 'text/plain';
    case '.html':
      return 'text/html';
    case '.css':
      return 'text/css';
    case '.js':
      return 'application/javascript';
    case '.json':
      return 'application/json';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Handle special forum format
 */
export async function handleStandardForumFormat(req: Request, res: Response): Promise<boolean> {
  // Check if this is a request for /api/storage-proxy/FORUM/forum/*
  const path = req.path;
  const forumRegex = /^\/api\/storage-proxy\/FORUM\/forum\/(.*)/;
  const match = path.match(forumRegex);
  
  if (!match) {
    return false; // Not a standard forum format request
  }
  
  const filename = match[1];
  console.log(`[ForumStandardHandler] Handling request for: ${filename}`);
  
  try {
    // Access the file directly with the correct path
    const storageKey = `forum/${filename}`;
    const ext = path.extname(filename).toLowerCase();
    const contentType = getContentType(ext);
    
    // Try to get the file from Object Storage
    try {
      const buffer = await objectStorageService.getFile(storageKey, 'FORUM');
      
      if (buffer && buffer.length > 0) {
        console.log(`[ForumStandardHandler] Success! Retrieved file: ${storageKey} (${buffer.length} bytes)`);
        
        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24-hour cache
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Forum-Standard-Handler', 'true');
        
        // Send the file
        res.send(buffer);
        return true; // Successfully handled
      }
    } catch (error) {
      console.log(`[ForumStandardHandler] Error getting file: ${error.message}`);
    }
    
    // If we get here, redirect to direct-forum endpoint
    console.log(`[ForumStandardHandler] Falling back to direct-forum endpoint`);
    res.redirect(`/api/storage-proxy/direct-forum/${filename}`);
    return true; // We handled it by redirecting
  } catch (error) {
    console.error(`[ForumStandardHandler] Unexpected error: ${error}`);
    return false; // Let the regular handlers take over
  }
}