/**
 * Media Sync Middleware
 * 
 * This middleware ensures that uploaded media files are saved to both the development
 * (/uploads/{mediaType}/) and production (/{mediaType}/) directories to ensure consistent
 * access in both environments.
 */

import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { MEDIA_TYPES, normalizeMediaPath, syncMediaFile, ensureDirectoryExists } from './media-path-utils';

// Console log with timestamp for better debugging
const logWithTimestamp = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] [MediaSync] ${message}`, data);
  } else {
    console.log(`[${timestamp}] [MediaSync] ${message}`);
  }
};

/**
 * Middleware function that runs after multer has processed the files
 * Copies files from /uploads/{mediaType} to /{mediaType} directory and vice versa
 */
export function mediaSyncMiddleware(req: Request, res: Response, next: NextFunction) {
  const files = req.files as Express.Multer.File[] || [];
  const file = req.file as Express.Multer.File | undefined;
  
  // Skip if no files were uploaded
  if ((!files || files.length === 0) && !file) {
    logWithTimestamp('No files uploaded, skipping sync');
    return next();
  }
  
  // Get mediaType from the request (should be set by multer middleware)
  const mediaType = (req as any).mediaType;
  if (!mediaType) {
    logWithTimestamp('Media type not found in request, skipping sync');
    return next();
  }
  
  // Process all uploaded files
  const allFiles = file ? [file] : files;
  logWithTimestamp(`Processing ${allFiles.length} files with mediaType: ${mediaType}`);
  
  allFiles.forEach(fileObj => {
    try {
      // Skip if file is missing path
      if (!fileObj.path) {
        logWithTimestamp(`Skipping file sync - missing path: ${fileObj.originalname}`);
        return;
      }
      
      // Get the source path (where multer saved the file)
      const sourcePath = fileObj.path;
      
      // Extract the filename
      const filename = path.basename(sourcePath);
      
      // Additional handling for forum media
      if (mediaType === MEDIA_TYPES.FORUM) {
        logWithTimestamp(`Forum media upload detected: ${filename}`);
        
        // Check if the file was accidentally uploaded to attached_assets
        if (sourcePath.includes('attached_assets')) {
          logWithTimestamp(`Found forum media in attached_assets: ${sourcePath}`, {sourcePath});
          
          // Set up paths for the forum media
          const forumMediaPath = path.join(process.cwd(), 'forum-media', filename);
          const uploadsForumMediaPath = path.join(process.cwd(), 'uploads', 'forum-media', filename);
          
          // Ensure forum-media directories exist
          ensureDirectoryExists(path.dirname(forumMediaPath));
          ensureDirectoryExists(path.dirname(uploadsForumMediaPath));
          
          // Copy the file to both correct locations
          try {
            fs.copyFileSync(sourcePath, forumMediaPath);
            fs.copyFileSync(sourcePath, uploadsForumMediaPath);
            logWithTimestamp(`Relocated misplaced forum media from attached_assets to forum-media: ${filename}`);
          } catch (copyErr) {
            logWithTimestamp(`Failed to copy from attached_assets to forum-media: ${filename}`, copyErr);
          }
        }
      }
      
      // Set up paths for both standard locations
      const developmentPath = path.join(process.cwd(), 'uploads', mediaType, filename);
      const productionPath = path.join(process.cwd(), mediaType, filename);
      
      // Ensure directories exist
      ensureDirectoryExists(path.dirname(developmentPath));
      ensureDirectoryExists(path.dirname(productionPath));
      
      // Make sure the file exists in both locations (uploads/ and direct)
      if (sourcePath === developmentPath) {
        // File was saved to development path, copy to production
        fs.copyFileSync(developmentPath, productionPath);
        logWithTimestamp(`Copied ${filename} from development to production path`);
      } 
      else if (sourcePath === productionPath) {
        // File was saved to production path, copy to development
        fs.copyFileSync(productionPath, developmentPath);
        logWithTimestamp(`Copied ${filename} from production to development path`);
      } 
      else {
        // File is in a different location, copy to both paths
        fs.copyFileSync(sourcePath, developmentPath);
        fs.copyFileSync(sourcePath, productionPath);
        logWithTimestamp(`Copied ${filename} to both development and production paths`);
      }
      
      // Verify that both copies exist
      const devExists = fs.existsSync(developmentPath);
      const prodExists = fs.existsSync(productionPath);
      
      if (!devExists || !prodExists) {
        logWithTimestamp(`Verification failed for ${filename}: devExists=${devExists}, prodExists=${prodExists}`);
        
        // Try to recover by copying again if one exists but not the other
        if (devExists && !prodExists) {
          try {
            fs.copyFileSync(developmentPath, productionPath);
            logWithTimestamp(`Recovery: Copied from dev to prod for ${filename}`);
          } catch (recoveryErr) {
            logWithTimestamp(`Recovery failed for ${filename}:`, recoveryErr);
          }
        } else if (!devExists && prodExists) {
          try {
            fs.copyFileSync(productionPath, developmentPath);
            logWithTimestamp(`Recovery: Copied from prod to dev for ${filename}`);
          } catch (recoveryErr) {
            logWithTimestamp(`Recovery failed for ${filename}:`, recoveryErr);
          }
        }
      }
      
      // Add response metadata for debugging
      (req as any).mediaSyncPaths = {
        dev: developmentPath,
        prod: productionPath,
        devExists: fs.existsSync(developmentPath),
        prodExists: fs.existsSync(productionPath)
      };
      
      // If this is a request with mediaUrls in the body, ensure they are normalized
      if (req.body && req.body.mediaUrls && Array.isArray(req.body.mediaUrls)) {
        const originalUrls = [...req.body.mediaUrls];
        req.body.mediaUrls = req.body.mediaUrls.map((url: string) => normalizeMediaPath(url));
        
        // Log any changes to help with debugging
        for (let i = 0; i < originalUrls.length; i++) {
          if (originalUrls[i] !== req.body.mediaUrls[i]) {
            logWithTimestamp(`Normalized URL: ${originalUrls[i]} -> ${req.body.mediaUrls[i]}`);
          }
        }
      }
      
    } catch (error) {
      logWithTimestamp(`Error processing file ${fileObj.originalname}:`, error);
    }
  });
  
  // Override JSON response to normalize mediaUrls in the response
  const originalJson = res.json;
  res.json = function(body: any) {
    // If the response has mediaUrls, normalize them
    if (body && body.mediaUrls && Array.isArray(body.mediaUrls)) {
      const originalUrls = [...body.mediaUrls];
      body.mediaUrls = body.mediaUrls.map((url: string) => normalizeMediaPath(url));
      
      // Log any URL changes for debugging
      for (let i = 0; i < originalUrls.length; i++) {
        if (originalUrls[i] !== body.mediaUrls[i]) {
          logWithTimestamp(`Normalized URL in response: ${originalUrls[i]} -> ${body.mediaUrls[i]}`);
        }
      }
    }
    
    // Special handling for forum content responses to ensure consistent URL formats
    if (body && body.content && typeof body.content === 'string' && 
        (body.categorySlug === 'announcements' || 
         req.originalUrl?.includes('/forum/') || 
         req.path?.includes('/forum/'))) {
      
      // Look for attached_assets URLs in forum content and convert them to forum-media
      if (body.content.includes('/attached_assets/')) {
        logWithTimestamp('Found attached_assets references in forum content - normalizing paths');
        
        const originalContent = body.content;
        
        // Replace all /attached_assets/ references with /forum-media/
        body.content = body.content.replace(/\/attached_assets\//g, '/forum-media/');
        
        if (originalContent !== body.content) {
          logWithTimestamp('Normalized attached_assets paths in forum content response');
        }
      }
    }
    
    // Call the original json method
    return originalJson.call(this, body);
  };
  
  // Continue processing the request
  next();
}