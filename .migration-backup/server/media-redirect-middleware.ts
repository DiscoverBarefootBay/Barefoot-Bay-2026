import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware for redirecting media requests to the correct location and normalizing paths
 * 
 * This middleware handles multiple tasks:
 * 1. Redirects media requests to the correct file location
 * 2. Normalizes all media paths in API responses (/uploads/path → /path)
 * 3. Handles both development and production path formats
 * 
 * This solves the problem where paths are different between environments:
 * - In development: /uploads/category/file.ext
 * - In production: /category/file.ext
 */
/**
 * Recursively normalize all media paths in an object
 * Only converts paths for special media types or special cases
 * Important: We now preserve /uploads/ paths when needed
 */
function normalizeMediaPathsInObject(obj: any): void {
  if (!obj || typeof obj !== 'object') return;
  
  // Check if we're in production environment
  const isProductionEnv = process.env.NODE_ENV === 'production';
  
  // Handle arrays
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (typeof obj[i] === 'string') {
        // We no longer automatically strip /uploads/ from all paths
        // Only special handling for rocket icon for backward compatibility
        if (obj[i].includes('Asset1.svg') || obj[i].includes('rocket-icon.svg')) {
          if (isProductionEnv && obj[i].startsWith('/uploads/icons/')) {
            obj[i] = obj[i].replace('/uploads/icons/', '/icons/');
          }
        }
      } else if (typeof obj[i] === 'object') {
        // Recursively process objects in arrays
        normalizeMediaPathsInObject(obj[i]);
      }
    }
    return;
  }
  
  // Process each property of the object
  for (const key in obj) {
    const value = obj[key];
    
    if (typeof value === 'string') {
      // We no longer automatically strip /uploads/ from all paths
      // Only special handling for rocket icon for backward compatibility
      if (value.includes('Asset1.svg') || value.includes('rocket-icon.svg')) {
        if (isProductionEnv && value.startsWith('/uploads/icons/')) {
          obj[key] = value.replace('/uploads/icons/', '/icons/');
        }
      }
    } else if (Array.isArray(value)) {
      // Process each item in arrays
      normalizeMediaPathsInObject(value);
    } else if (value && typeof value === 'object') {
      // Recursively process nested objects
      normalizeMediaPathsInObject(value);
    }
  }
}

/**
 * Main middleware function for handling media requests and normalizing paths
 */
export const mediaRedirectMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Intercept API responses to normalize media paths
  if (req.path.startsWith('/api/')) {
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Override send to normalize paths in JSON string responses
    res.send = function(body: any) {
      if (typeof body === 'string' && body.includes('/uploads/')) {
        try {
          // Try to parse as JSON 
          const data = JSON.parse(body);
          // Normalize all media paths in the response
          normalizeMediaPathsInObject(data);
          // Re-stringify with normalized paths
          body = JSON.stringify(data);
        } catch (e) {
          // Not valid JSON or couldn't parse, continue with original body
        }
      }
      
      // Call original send with possibly modified body
      return originalSend.call(this, body);
    };
    
    // Override json to normalize paths in object responses
    res.json = function(body: any) {
      // Normalize all media paths in the response object
      if (body && typeof body === 'object') {
        normalizeMediaPathsInObject(body);
      }
      
      // Call original json with normalized body
      return originalJson.call(this, body);
    };
  }
  
  // Handle banner-slides specially - this is a common case for homepage banners
  if (req.path.includes('/banner-slides/')) {
    console.log(`Banner slide request: ${req.path} (full URL: ${req.originalUrl})`);
    
    // Extract the filename part (example: bannerImage-1743591277841-110589692.mp4)
    const filenameMatch = req.path.match(/\/banner-slides\/([^\/]+)$/);
    if (!filenameMatch) {
      return next();
    }
    
    const filename = filenameMatch[1];
    console.log(`Banner slide filename: ${filename}`);
    
    // First try the direct path in uploads/banner-slides/
    const directPath = path.join(process.cwd(), 'uploads', 'banner-slides', filename);
    if (fs.existsSync(directPath)) {
      console.log(`Found banner slide at direct path: ${directPath}`);
      return res.sendFile(directPath);
    }
    
    // If not found, try other common subdirectories as fallback
    const fallbackDirs = ['', 'calendar/', 'content-media/', 'Real Estate/', 'products/'];
    for (const dir of fallbackDirs) {
      const fallbackPath = path.join(process.cwd(), 'uploads', dir, filename);
      if (fs.existsSync(fallbackPath)) {
        console.log(`Found banner slide in alternate location: ${fallbackPath}`);
        return res.sendFile(fallbackPath);
      }
    }
    
    console.log(`Banner slide not found: ${filename}`);
  }
  
  // Handle avatar requests
  if (req.path.startsWith('/avatars/')) {
    const filename = req.path.substring('/avatars/'.length);
    if (!filename) {
      return next();
    }
    
    console.log(`Avatar request for: ${filename}`);
    
    // Try both locations - uploads/avatars (development) and /avatars (production)
    const uploadsPath = path.join(process.cwd(), 'uploads', 'avatars', filename);
    const rootPath = path.join(process.cwd(), 'avatars', filename);
    
    // Check uploads/avatars first (development path)
    if (fs.existsSync(uploadsPath)) {
      console.log(`Found avatar at: ${uploadsPath}`);
      res.set({
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400', // 1 hour cache, serve stale for 24 hours
        'Access-Control-Allow-Origin': '*',
        'ETag': `"${filename}-${fs.statSync(uploadsPath).mtime.getTime()}"`, // Add ETag for better caching
        'Vary': 'Accept-Encoding'
      });
      return res.sendFile(uploadsPath);
    }
    
    // Then check /avatars (production path)
    if (fs.existsSync(rootPath)) {
      console.log(`Found avatar at root path: ${rootPath}`);
      res.set({
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400', // 1 hour cache, serve stale for 24 hours
        'Access-Control-Allow-Origin': '*',
        'ETag': `"${filename}-${fs.statSync(rootPath).mtime.getTime()}"`, // Add ETag for better caching
        'Vary': 'Accept-Encoding'
      });
      return res.sendFile(rootPath);
    }
    
    // If filesystem paths fail, try Object Storage fallback via proxy redirect
    console.log(`Avatar not found in filesystem, trying Object Storage fallback: ${filename}`);
    
    // Redirect to the Object Storage proxy endpoint for avatars
    const objectStorageProxyUrl = `/api/storage-proxy/direct-avatars/${filename}`;
    console.log(`Redirecting avatar request to Object Storage proxy: ${objectStorageProxyUrl}`);
    
    return res.redirect(objectStorageProxyUrl);
  }

  // New centralized media endpoint to handle all media files
  if (req.path.startsWith('/media/')) {
    const filename = req.path.substring('/media/'.length);
    if (!filename) {
      return next();
    }
    
    console.log(`Media service request for: ${filename}`);
    
    // Special case - if this is a full path that was passed incorrectly
    if (filename.includes('/')) {
      console.log(`Media service received path instead of filename: ${filename}`);
      const actualFilename = filename.split('/').pop();
      if (actualFilename) {
        console.log(`Extracting actual filename: ${actualFilename}`);
        
        // Recursively call the same endpoint with just the filename
        req.url = `/media/${actualFilename}`;
        return mediaRedirectMiddleware(req, res, next);
      }
    }
    
    // Try to match different media file patterns common in our system
    const isMediaFile = filename.startsWith('media-') || 
                     filename.startsWith('bannerImage-') || 
                     filename.startsWith('mediaFile-') || // Add explicit support for mediaFile pattern 
                     filename.includes('ChatGPT Image');
    
    // Add all possible subdirectories where files might be stored
    // Added real-estate-media and other important directories for better coverage
    const subdirectories = [
      '', 
      'calendar/', 
      'banner-slides/', 
      'content-media/', 
      'Real Estate/', 
      'real-estate-media/', 
      'generated/', 
      'avatars/', 
      'products/',
      'forum-media/',
      'vendor-media/',
      'community-media/'
    ];
    
    // Build list of possible paths
    const possiblePaths = [];
    
    // Add all possible subdirectory combinations
    for (const subdir of subdirectories) {
      possiblePaths.push(path.join(process.cwd(), 'uploads', subdir, filename));
    }
    
    // If we have a media file, also check pattern variations (with or without extensions)
    if (isMediaFile) {
      const baseMediaName = filename.split('.')[0]; // Strip extension if any
      const commonExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm'];
      
      // Try different extensions if none was provided
      if (!filename.includes('.')) {
        for (const ext of commonExtensions) {
          for (const subdir of subdirectories) {
            possiblePaths.push(path.join(process.cwd(), 'uploads', subdir, `${baseMediaName}${ext}`));
          }
        }
      }
    }
    
    console.log(`Media service checking ${possiblePaths.length} possible paths for ${filename}`);
    
    // Try to find the file in one of the possible locations
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        console.log(`Media service found file at: ${filePath}`);
        // Serve the file directly with caching headers
        res.set({
          'Cache-Control': 'public, max-age=86400', // 24 hours
          'Access-Control-Allow-Origin': '*'
        });
        return res.sendFile(filePath);
      }
    }
    
    console.log(`Media service could not find file: ${filename}`);
    // Return a 404 but also include useful debug info in the response
    return res.status(404).send(`
      <h1>Media File Not Found</h1>
      <p>The requested file "${filename}" could not be found in any of the expected locations.</p>
      <p>We checked the following paths:</p>
      <ul>
        ${possiblePaths.map(p => `<li>${p}</li>`).join('')}
      </ul>
    `);
  }
  
  // Legacy path-based media redirect (for backward compatibility)
  if (req.path.includes('/media-') || req.path.includes('/bannerImage-') || req.path.includes('/mediaFile-') || req.path.includes('ChatGPT Image')) {
    console.log(`Media request path: ${req.path} (full URL: ${req.originalUrl})`);
    
    // Extract the filename part (media-timestamp-random.ext)
    const filenameMatch = req.path.match(/\/([^\/]+)$/);
    if (!filenameMatch) {
      return next();
    }
    
    const filename = filenameMatch[1];
    
    // Add all possible subdirectories where files might be stored
    // Added real-estate-media and other important directories for better coverage
    const subdirectories = [
      '', 
      'calendar/', 
      'banner-slides/', 
      'content-media/', 
      'Real Estate/', 
      'real-estate-media/', 
      'generated/', 
      'avatars/', 
      'products/',
      'forum-media/',
      'vendor-media/',
      'community-media/'
    ];
    
    // Build list of possible paths
    const possiblePaths = [];
    
    // Add all possible subdirectory combinations
    for (const subdir of subdirectories) {
      possiblePaths.push(path.join(process.cwd(), 'uploads', subdir, filename));
    }
    
    // Check non-uploads paths too
    for (const subdir of subdirectories) {
      // Skip empty subdir case (already covered by real-estate-media below)
      if (subdir === '') continue;
      
      // Remove trailing slash for proper path join
      const cleanSubdir = subdir.endsWith('/') ? subdir.slice(0, -1) : subdir;
      possiblePaths.push(path.join(process.cwd(), cleanSubdir, filename));
    }
    
    // Special handling for real estate media - check both with and without uploads prefix
    possiblePaths.push(path.join(process.cwd(), 'real-estate-media', filename));
    
    // Try to find the file in one of the possible locations
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        console.log(`Found media file at: ${filePath}`);
        // Serve the file directly with caching headers
        res.set({
          'Cache-Control': 'public, max-age=86400', // 24 hours
          'Access-Control-Allow-Origin': '*'
        });
        return res.sendFile(filePath);
      }
    }
    
    // If we get here, the file wasn't found in any location
    console.log(`Media file not found: ${filename}`);
    
    // Redirect to the central media endpoint for a more thorough search
    if (filename.startsWith('media-') || filename.startsWith('bannerImage-') || filename.startsWith('mediaFile-') || filename.includes('ChatGPT Image')) {
      console.log(`Redirecting legacy media request to central /media/ endpoint`);
      return res.redirect(`/media/${filename}`);
    }
  }
  
  // Special handling for content-media (adds support for Dan Hess vendor image)
  if (req.path.startsWith('/content-media/')) {
    const filename = req.path.substring('/content-media/'.length);
    if (!filename) {
      return next();
    }
    
    console.log(`Content media request for: ${filename}`);
    
    // Try both locations - uploads/content-media and /content-media
    const uploadsPath = path.join(process.cwd(), 'uploads', 'content-media', filename);
    const rootPath = path.join(process.cwd(), 'content-media', filename);
    
    // Check content-media first (production path)
    if (fs.existsSync(rootPath)) {
      console.log(`Found content media at root path: ${rootPath}`);
      res.set({
        'Cache-Control': 'public, max-age=86400', // 24 hours
        'Access-Control-Allow-Origin': '*'
      });
      return res.sendFile(rootPath);
    }
    
    // Then check uploads/content-media (development path)
    if (fs.existsSync(uploadsPath)) {
      console.log(`Found content media at: ${uploadsPath}`);
      res.set({
        'Cache-Control': 'public, max-age=86400', // 24 hours
        'Access-Control-Allow-Origin': '*'
      });
      return res.sendFile(uploadsPath);
    }
    
    // If we get here, the file wasn't found in either location
    console.log(`Content media not found: ${filename}`);
    
    // Redirect to the central media endpoint for a more thorough search
    console.log(`Redirecting content media request to central /media/ endpoint`);
    return res.redirect(`/media/${filename}`);
  }
  
  // Special handling for calendar media files
  if (req.path.startsWith('/uploads/calendar/')) {
    const filename = req.path.substring('/uploads/calendar/'.length);
    if (!filename) {
      return next();
    }
    
    console.log(`Calendar media request from uploads path for: ${filename}`);
    
    // Try both locations - uploads/calendar and /calendar
    const uploadsPath = path.join(process.cwd(), 'uploads', 'calendar', filename);
    const rootPath = path.join(process.cwd(), 'calendar', filename);
    
    // Check uploads/calendar first (development path)
    if (fs.existsSync(uploadsPath)) {
      console.log(`Found calendar media at uploads path: ${uploadsPath}`);
      
      // Also make sure the production path is synced
      try {
        if (!fs.existsSync(rootPath)) {
          // Create directories if needed
          const rootDir = path.dirname(rootPath);
          if (!fs.existsSync(rootDir)) {
            fs.mkdirSync(rootDir, { recursive: true });
          }
          
          // Copy file to production path
          fs.copyFileSync(uploadsPath, rootPath);
          console.log(`Copied calendar media to production path: ${rootPath}`);
        }
      } catch (error) {
        console.error(`Error syncing calendar media to production path: ${error.message}`);
      }
      
      res.set({
        'Cache-Control': 'public, max-age=86400', // 24 hours
        'Access-Control-Allow-Origin': '*'
      });
      return res.sendFile(uploadsPath);
    }
    
    // Then check calendar (production path)
    if (fs.existsSync(rootPath)) {
      console.log(`Found calendar media at root path: ${rootPath}`);
      
      // Also make sure the development path is synced
      try {
        if (!fs.existsSync(uploadsPath)) {
          // Create directories if needed
          const uploadsDir = path.dirname(uploadsPath);
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          
          // Copy file to development path
          fs.copyFileSync(rootPath, uploadsPath);
          console.log(`Copied calendar media to uploads path: ${uploadsPath}`);
        }
      } catch (error) {
        console.error(`Error syncing calendar media to uploads path: ${error.message}`);
      }
      
      res.set({
        'Cache-Control': 'public, max-age=86400', // 24 hours
        'Access-Control-Allow-Origin': '*'
      });
      return res.sendFile(rootPath);
    }
    
    // If we get here, the file wasn't found in either location
    console.log(`Calendar media not found in uploads path: ${filename}`);
    
    // Redirect to the central media endpoint for a more thorough search
    console.log(`Redirecting uploads/calendar request to central /media/ endpoint`);
    return res.redirect(`/media/${filename}`);
  }
  
  // Also handle direct calendar path requests
  if (req.path.startsWith('/calendar/')) {
    const filename = req.path.substring('/calendar/'.length);
    if (!filename) {
      return next();
    }
    
    console.log(`Calendar media request from root path for: ${filename}`);
    
    // Try both locations - /calendar and uploads/calendar
    const rootPath = path.join(process.cwd(), 'calendar', filename);
    const uploadsPath = path.join(process.cwd(), 'uploads', 'calendar', filename);
    
    // Check calendar first (production path)
    if (fs.existsSync(rootPath)) {
      console.log(`Found calendar media at root path: ${rootPath}`);
      
      // Also make sure the development path is synced
      try {
        if (!fs.existsSync(uploadsPath)) {
          // Create directories if needed
          const uploadsDir = path.dirname(uploadsPath);
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          
          // Copy file to development path
          fs.copyFileSync(rootPath, uploadsPath);
          console.log(`Copied calendar media to uploads path: ${uploadsPath}`);
        }
      } catch (error) {
        console.error(`Error syncing calendar media to uploads path: ${error.message}`);
      }
      
      res.set({
        'Cache-Control': 'public, max-age=86400', // 24 hours
        'Access-Control-Allow-Origin': '*'
      });
      return res.sendFile(rootPath);
    }
    
    // Then check uploads/calendar (development path)
    if (fs.existsSync(uploadsPath)) {
      console.log(`Found calendar media at uploads path: ${uploadsPath}`);
      
      // Also make sure the production path is synced
      try {
        if (!fs.existsSync(rootPath)) {
          // Create directories if needed
          const rootDir = path.dirname(rootPath);
          if (!fs.existsSync(rootDir)) {
            fs.mkdirSync(rootDir, { recursive: true });
          }
          
          // Copy file to production path
          fs.copyFileSync(uploadsPath, rootPath);
          console.log(`Copied calendar media to production path: ${rootPath}`);
        }
      } catch (error) {
        console.error(`Error syncing calendar media to production path: ${error.message}`);
      }
      
      res.set({
        'Cache-Control': 'public, max-age=86400', // 24 hours
        'Access-Control-Allow-Origin': '*'
      });
      return res.sendFile(uploadsPath);
    }
    
    // If we get here, the file wasn't found in either location
    console.log(`Calendar media not found in root path: ${filename}`);
    
    // Redirect to the central media endpoint for a more thorough search
    console.log(`Redirecting calendar request to central /media/ endpoint`);
    return res.redirect(`/media/${filename}`);
  }
  
  // Special handling for uploads/content-media (alternative path)
  if (req.path.startsWith('/uploads/content-media/')) {
    const filename = req.path.substring('/uploads/content-media/'.length);
    if (!filename) {
      return next();
    }
    
    console.log(`Uploads content media request for: ${filename}`);
    
    // First, check if content exists in root path
    const rootPath = path.join(process.cwd(), 'content-media', filename);
    if (fs.existsSync(rootPath)) {
      console.log(`Found content media at root path: ${rootPath}`);
      res.set({
        'Cache-Control': 'public, max-age=86400', // 24 hours
        'Access-Control-Allow-Origin': '*'
      });
      return res.sendFile(rootPath);
    }
    
    // Then check uploads path
    const uploadsPath = path.join(process.cwd(), 'uploads', 'content-media', filename);
    if (fs.existsSync(uploadsPath)) {
      console.log(`Found content media at uploads path: ${uploadsPath}`);
      res.set({
        'Cache-Control': 'public, max-age=86400', // 24 hours
        'Access-Control-Allow-Origin': '*'
      });
      return res.sendFile(uploadsPath);
    }
    
    // If we get here, the file wasn't found in either location
    console.log(`Content media not found in uploads path: ${filename}`);
    
    // Redirect to the non-uploads path first
    console.log(`Redirecting uploads/content-media request to /content-media/ path`);
    return res.redirect(`/content-media/${filename}`);
  }

  // Special handling for real estate media - Object Storage exclusively
  if (req.path.startsWith('/real-estate-media/')) {
    const filename = req.path.substring('/real-estate-media/'.length);
    if (!filename) {
      return next();
    }
    
    console.log(`Real estate media request for: ${filename} (using Object Storage exclusively)`);
    
    // Use Object Storage exclusively - no filesystem fallback
    try {
      // Dynamically import the object-storage module since it uses ESM syntax
      import('./object-storage.js').then(async (objectStorage) => {
        // Construct the object storage key
        const objectKey = `real-estate-media/${filename}`;
        
        // Check if the file exists in Object Storage
        const exists = await objectStorage.default.objectExists(objectKey);
        
        if (exists) {
          console.log(`Found real estate media in Object Storage: ${objectKey}`);
          
          // Get a presigned URL
          const presignedUrl = await objectStorage.default.getPresignedUrl(objectKey);
          
          // Set response headers
          res.set({
            'Cache-Control': 'public, max-age=86400', // 24 hours
            'Access-Control-Allow-Origin': '*'
          });
          
          // Redirect to the presigned URL
          return res.redirect(presignedUrl);
        } else {
          // If not found in Object Storage, it doesn't exist
          console.log(`Real estate media not found in Object Storage: ${objectKey}`);
          
          // Redirect to the central media endpoint for a more thorough search
          console.log(`Redirecting real estate media request to central /media/ endpoint`);
          req.url = `/media/${filename}`;
          return mediaRedirectMiddleware(req, res, next);
        }
      }).catch(err => {
        console.error(`Error importing object-storage module:`, err);
        // Report the error but continue processing
        res.status(500).json({ 
          error: 'Internal server error while accessing Object Storage',
          details: err instanceof Error ? err.message : String(err)
        });
      });
    } catch (error) {
      console.error(`Error checking Object Storage for real estate media:`, error);
      // Report the error
      res.status(500).json({ 
        error: 'Internal server error while accessing Object Storage',
        details: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Need to return something to prevent Express from continuing
    return;
  }
  
  // Special handling for forum-media paths
  if (req.path.startsWith('/forum-media/') || req.path.startsWith('/uploads/forum-media/')) {
    // Extract the filename
    const filename = req.path.startsWith('/forum-media/') 
      ? req.path.substring('/forum-media/'.length)
      : req.path.substring('/uploads/forum-media/'.length);
      
    if (!filename) {
      return next();
    }
    
    console.log(`Forum media request for: ${filename} (path: ${req.path})`);
    
    // Define both possible locations
    const uploadsPath = path.join(process.cwd(), 'uploads', 'forum-media', filename);
    const rootPath = path.join(process.cwd(), 'forum-media', filename);
    
    const existsInUploads = fs.existsSync(uploadsPath);
    const existsInRoot = fs.existsSync(rootPath);
    
    // If file exists in one location but not the other, sync them
    if (existsInUploads && !existsInRoot) {
      try {
        // Create the directory if it doesn't exist
        const rootDir = path.join(process.cwd(), 'forum-media');
        if (!fs.existsSync(rootDir)) {
          fs.mkdirSync(rootDir, { recursive: true });
          console.log(`Created forum-media directory at: ${rootDir}`);
        }
        
        // Copy the file
        fs.copyFileSync(uploadsPath, rootPath);
        console.log(`Synced forum media from uploads to root: ${filename}`);
      } catch (error) {
        console.error(`Error syncing forum media: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else if (existsInRoot && !existsInUploads) {
      try {
        // Create the directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), 'uploads', 'forum-media');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
          console.log(`Created uploads/forum-media directory at: ${uploadsDir}`);
        }
        
        // Copy the file
        fs.copyFileSync(rootPath, uploadsPath);
        console.log(`Synced forum media from root to uploads: ${filename}`);
      } catch (error) {
        console.error(`Error syncing forum media: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // After potential syncing, serve from the appropriate path
    if (existsInUploads || fs.existsSync(uploadsPath)) {
      console.log(`Serving forum media from uploads path: ${uploadsPath}`);
      res.set({
        'Cache-Control': 'public, max-age=86400', // 24 hours
        'Access-Control-Allow-Origin': '*'
      });
      return res.sendFile(uploadsPath);
    } else if (existsInRoot || fs.existsSync(rootPath)) {
      console.log(`Serving forum media from root path: ${rootPath}`);
      res.set({
        'Cache-Control': 'public, max-age=86400', // 24 hours
        'Access-Control-Allow-Origin': '*'
      });
      return res.sendFile(rootPath);
    }
    
    // If we get here, the file wasn't found in either location
    console.log(`Forum media not found: ${filename}`);
    
    // Redirect to the central media endpoint for a more thorough search
    console.log(`Redirecting forum media request to central /media/ endpoint`);
    return res.redirect(`/media/${filename}`);
  }
  
  // Continue to the next middleware if this one couldn't handle the request
  return next();
};