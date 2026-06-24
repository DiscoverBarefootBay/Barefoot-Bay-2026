import express from 'express';
import path from 'path';
import fs from 'fs';

/**
 * Middleware specifically for serving message attachments with proper headers
 */
export const attachmentMediaMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const url = req.url;
  
  // Check if this is an attachment request (either /uploads/attachments/ or /attachments/)
  if (url.includes('/uploads/attachments/') || url.startsWith('/attachments/')) {
    console.log(`[AttachmentMediaMiddleware] Handling attachment request: ${url}`);
    
    // Extract the filename from the URL
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    
    // Determine the file path
    const basePath = path.join(process.cwd(), 'uploads', 'attachments');
    const filePath = path.join(basePath, filename);
    
    // Check if the file exists
    if (fs.existsSync(filePath)) {
      console.log(`[AttachmentMediaMiddleware] Found attachment file: ${filePath}`);
      
      // Set appropriate CORS and caching headers
      res.set({
        'Cache-Control': 'public, max-age=86400', // 24 hours
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      
      // Serve the file
      return res.sendFile(filePath);
    } else {
      console.error(`[AttachmentMediaMiddleware] Attachment file not found: ${filePath}`);
    }
  }
  
  // Not an attachment or file not found, proceed to next middleware
  next();
};