import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';

/**
 * Middleware specifically for handling banner slide image errors
 * This ensures that even if a banner image is missing, the site doesn't break
 */
export const bannerSlidesErrorHandler = (req: Request, res: Response, next: NextFunction) => {
  // Only handle banner-slides paths
  if (!req.path.includes('/banner-slides/')) {
    return next();
  }

  console.log(`Banner slide request: ${req.path}`);
  
  // Get the filename from the path
  const filename = path.basename(req.path);
  
  // Check if the requested file exists
  const filePath = path.join(process.cwd(), 'banner-slides', filename);
  const uploadsPath = path.join(process.cwd(), 'uploads', 'banner-slides', filename);
  
  if (fs.existsSync(filePath) || fs.existsSync(uploadsPath)) {
    // If the file exists, let the normal static file handlers take care of it
    return next();
  }
  
  console.log(`Banner slide image not found: ${filename}`);
  
  // If the file doesn't exist, serve a placeholder image
  const placeholderPath = path.join(process.cwd(), 'public', 'banner-placeholder.jpg');
  
  // Make sure we have a placeholder image
  if (!fs.existsSync(placeholderPath)) {
    // Create a directory for the placeholder if needed
    const placeholderDir = path.dirname(placeholderPath);
    if (!fs.existsSync(placeholderDir)) {
      fs.mkdirSync(placeholderDir, { recursive: true });
    }
    
    // If no placeholder exists, create a simple one-pixel transparent PNG
    // This is just a base64-encoded transparent PNG pixel
    const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    fs.writeFileSync(placeholderPath, transparentPixel);
    console.log(`Created placeholder image at ${placeholderPath}`);
  }
  
  // Add appropriate headers
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=600'); // Cache for 10 minutes
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Send the placeholder image
  return res.sendFile(placeholderPath);
};