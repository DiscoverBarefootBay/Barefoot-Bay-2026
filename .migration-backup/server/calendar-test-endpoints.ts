/**
 * Calendar Media Test Endpoints
 * 
 * This module provides test endpoints for debugging calendar media URLs
 * and the dual-storage implementation (filesystem + Object Storage).
 */

import { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory path for this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Path to the URL mapping file (same as in calendar-media-fallback.ts)
const mappingPaths = [
  path.join(rootDir, 'server', 'calendar-media-mapping.json'),
  path.join(rootDir, 'calendar-media-mapping.json'),
  path.join(rootDir, 'dist', 'server', 'calendar-media-mapping.json')
];

let urlMapping: Record<string, string> = {};

/**
 * Load URL mapping from first available path
 */
function loadUrlMapping() {
  for (const mappingPath of mappingPaths) {
    try {
      if (fs.existsSync(mappingPath)) {
        console.log(`Loading calendar media mapping from ${mappingPath}`);
        const content = fs.readFileSync(mappingPath, 'utf8');
        const mapping = JSON.parse(content);
        
        console.log(`Loaded calendar media mapping with ${Object.keys(mapping).length} entries`);
        return mapping;
      }
    } catch (error) {
      console.error(`Error loading calendar media mapping from ${mappingPath}:`, error);
    }
  }
  
  console.log('Could not find calendar media mapping file in any location');
  return {};
}

/**
 * Check if a file exists in the filesystem
 */
function checkFileExists(filePath: string): boolean {
  try {
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(rootDir, filePath.startsWith('/') ? filePath.slice(1) : filePath);
    
    return fs.existsSync(absolutePath);
  } catch (error) {
    console.error('Error checking file existence:', error);
    return false;
  }
}

/**
 * Create a router with test endpoints
 */
export function createCalendarTestRouter(): Router {
  const router = Router();

  // Test endpoint to list all mapped calendar media
  router.get('/list-calendar-media', (req: Request, res: Response) => {
    // Load mapping file if not already loaded
    if (Object.keys(urlMapping).length === 0) {
      urlMapping = loadUrlMapping();
    }
    
    const result = {
      mappingEntries: Object.keys(urlMapping).length,
      entries: Object.entries(urlMapping).map(([fsPath, osUrl]) => {
        const fsExists = checkFileExists(fsPath);
        return {
          filesystemPath: fsPath,
          objectStorageUrl: osUrl,
          existsOnFilesystem: fsExists
        };
      })
    };
    
    res.json(result);
  });

  // Test endpoint to check a specific file
  router.get('/check-calendar-media', (req: Request, res: Response) => {
    const { path: mediaPath } = req.query;
    
    if (!mediaPath || typeof mediaPath !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid path parameter' });
    }
    
    // Load mapping file if not already loaded
    if (Object.keys(urlMapping).length === 0) {
      urlMapping = loadUrlMapping();
    }
    
    // Normalize path
    const normalizedPath = mediaPath.startsWith('/') ? mediaPath : `/${mediaPath}`;
    
    // Check if file exists in the mapping
    const objectStorageUrl = urlMapping[normalizedPath];
    
    // Check if file exists in the filesystem
    const existsOnFilesystem = checkFileExists(normalizedPath);
    
    const result = {
      path: normalizedPath,
      existsInMapping: !!objectStorageUrl,
      objectStorageUrl: objectStorageUrl || null,
      existsOnFilesystem,
      accessUrls: {
        filesystem: normalizedPath,
        objectStorage: objectStorageUrl || null
      }
    };
    
    res.json(result);
  });

  return router;
}

export default createCalendarTestRouter;