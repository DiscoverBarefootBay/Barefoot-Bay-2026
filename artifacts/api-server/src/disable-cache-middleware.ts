import { Request, Response, NextFunction } from "express";

/**
 * Middleware to disable browser caching for all responses
 * This is especially useful during development or when making UI changes
 * that need to be immediately visible to users
 */
export function disableCacheMiddleware(req: Request, res: Response, next: NextFunction) {
  // Set headers to prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Force clearing browser cache completely if it's an HTML request
  if (req.url === '/' || req.url.endsWith('.html')) {
    // This header forces browsers to clear ALL site data including cookies, storage, and cache
    // Use with caution as it will log users out!
    res.setHeader('Clear-Site-Data', '"cache"'); // Only clear cache, not cookies or storage
  }
  
  // Add a timestamp to JavaScript and CSS files to force reloading
  if (req.url.endsWith('.js') || req.url.endsWith('.css')) {
    // Append or update timestamp parameter to force reload
    if (req.url.includes('?')) {
      req.url = `${req.url}&_t=${Date.now()}`;
    } else {
      req.url = `${req.url}?_t=${Date.now()}`;
    }
  }
  
  next();
}