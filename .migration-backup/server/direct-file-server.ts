/**
 * Direct File Server
 * 
 * A simple middleware to serve static files directly with minimal overhead.
 * This bypasses complex routing paths and serves the files with proper MIME types.
 */

import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

// Files that should be served directly
const DIRECT_SERVE_FILES = [
  'test.html',
  'event-media-test.html',
  'direct-event-media-test.html',
  'event-media-fix.html',
  'create-test-event.html',
  'calendar-upload-test.html',
  'media-debug.html',
  'debug-middleware.html',
  'object-storage-test.html',
  'path-format-test.html'
];

/**
 * Middleware to serve specific files directly from the public directory
 */
export function directFileServerMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get the path from the URL
  const urlPath = req.path;
  
  // Remove query string if present
  const cleanPath = urlPath.split('?')[0];
  
  // Remove leading slash and trailing slash
  const fileName = cleanPath.replace(/^\//, '').replace(/\/$/, '');
  
  // Check if this is a file we should serve directly
  if (DIRECT_SERVE_FILES.includes(fileName)) {
    console.log(`[DirectFileServer] Intercepting request for ${fileName}`);
    
    // Build the absolute path to the file in the public directory
    const filePath = path.join(process.cwd(), 'public', fileName);
    
    // Check if the file exists
    if (fs.existsSync(filePath)) {
      console.log(`[DirectFileServer] File exists: ${filePath}`);
      
      // Get the content type based on file extension
      const contentType = mime.lookup(fileName) || 'text/html';
      
      // Set headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      // Explicitly ensure text/html for HTML files
      if (fileName.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
      }
      
      // Read the file and send it
      try {
        const fileContent = fs.readFileSync(filePath);
        console.log(`[DirectFileServer] Serving ${fileName} (${fileContent.length} bytes)`);
        return res.send(fileContent);
      } catch (err) {
        console.error(`[DirectFileServer] Error reading file: ${err}`);
        return res.status(500).send(`Error reading file: ${err.message}`);
      }
    } else {
      console.log(`[DirectFileServer] File not found: ${filePath}`);
      return res.status(404).send(`File not found: ${fileName}`);
    }
  }
  
  // Not a direct-serve file, continue to next middleware
  next();
}