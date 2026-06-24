/**
 * Calendar Media Fallback Middleware
 * 
 * This middleware intercepts requests for calendar media files in the filesystem
 * and redirects them to Replit Object Storage if available.
 * 
 * It uses a mapping file generated during the migration process to determine
 * the appropriate Object Storage URL for each filesystem path.
 */

import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import { normalizeEventMediaUrl } from './media-path-utils.js';

// Get the directory path for this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Path to the URL mapping file
// In production, __dirname will be in the dist folder, so we need to go up one level
const MAPPING_FILE_PATH = path.join(rootDir, 'server', 'calendar-media-mapping.json');

// Paths that might contain calendar media
const CALENDAR_PATHS = ['/uploads/calendar/', '/calendar/', '/media/'];

// Default image URL for events - using local file in public directory
const DEFAULT_EVENT_IMAGE = '/default-event-image.svg';

// URL mapping cache
let urlMapping: Record<string, string> = {};
let lastMapLoadTime = 0;
const MAP_RELOAD_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Load URL mapping from file
 * @returns {Object} Mapping of filesystem URLs to Object Storage URLs
 */
function loadUrlMapping() {
  try {
    // Check if file exists
    if (!fs.existsSync(MAPPING_FILE_PATH)) {
      console.log('Calendar media mapping file not found, creating empty mapping');
      return {};
    }
    
    // Load and parse the mapping file
    const content = fs.readFileSync(MAPPING_FILE_PATH, 'utf8');
    const mapping = JSON.parse(content);
    
    console.log(`Loaded calendar media mapping with ${Object.keys(mapping).length} entries`);
    lastMapLoadTime = Date.now();
    
    return mapping;
  } catch (error) {
    console.error('Error loading calendar media mapping:', error);
    return {};
  }
}

/**
 * Check if a URL is a calendar media URL
 * @param {string} url - URL to check
 * @returns {boolean} True if the URL is a calendar media URL
 */
function isCalendarMediaUrl(url: string): boolean {
  // Skip HTML files - they're not media
  if (url.endsWith('.html') || url.endsWith('.htm')) {
    return false;
  }
  return CALENDAR_PATHS.some(prefix => url.startsWith(prefix));
}

/**
 * Check if a URL appears to be an event media URL
 * @param {string} url - URL to check
 * @returns {boolean} True if the URL is likely event media
 */
function isEventMediaUrl(url: string): boolean {
  // Skip HTML files - they're not media
  if (url.endsWith('.html') || url.endsWith('.htm')) {
    return false;
  }
  
  // Common prefixes for event media
  if (url.startsWith('/media/media-') || 
      url.startsWith('/calendar/media-') || 
      url.startsWith('/uploads/calendar/media-') ||
      url.startsWith('/events/media-')) {
    return true;
  }
  
  // Check for common event media filenames
  const filename = url.split('/').pop() || '';
  if (filename.startsWith('media-') || 
      filename.startsWith('event-') || 
      filename.startsWith('calendar-')) {
    return true;
  }
  
  return false;
}

/**
 * Get the Object Storage URL for a filesystem path
 * @param {string} url - Filesystem URL
 * @returns {string|null} Object Storage URL or null if not found
 */
function getObjectStorageUrl(url: string): string | null {
  // Reload mapping if necessary
  const now = Date.now();
  if (now - lastMapLoadTime > MAP_RELOAD_INTERVAL) {
    urlMapping = loadUrlMapping();
  }
  
  // Check if URL exists in mapping
  return urlMapping[url] || null;
}

/**
 * Check media accessibility and return appropriate URL
 * @param {string} url - The URL to check
 * @returns {Promise<string>} - The accessible URL or default image
 */
export async function checkMedia(url: string): Promise<string> {
  console.log(`[CalendarMediaFallback] Checking media accessibility for: ${url}`);
  
  try {
    // Extract filename from any URL format
    let filename = '';
    if (url.includes('/')) {
      filename = url.split('/').pop() || '';
    } else {
      filename = url;
    }
    
    if (!filename) {
      console.log(`[CalendarMediaFallback] Could not extract filename from URL: ${url}`);
      return `/default-event-image.svg`;
    }
    
    // Use storage proxy URL format - this avoids CORS issues and ensures we only use Object Storage
    const proxyUrl = `/api/storage-proxy/CALENDAR/events/${filename}`;
    console.log(`[CalendarMediaFallback] Using storage proxy URL: ${proxyUrl}`);
    
    // Return the proxy URL - we'll let the storage proxy handle the fallback to default image if needed
    return proxyUrl;
  } catch (error) {
    console.error(`[CalendarMediaFallback] Error checking media: ${error.message}`);
    return `/default-event-image.svg`;
  }
}

/**
 * Calendar media fallback middleware
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function
 */
export function calendarMediaFallbackMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only handle GET requests
  if (req.method !== 'GET') {
    return next();
  }
  
  // Handle URL decoding to properly match paths with spaces or special characters
  // Strip query parameters to ensure we match the base URL
  const urlWithoutParams = req.url.split('?')[0];
  const url = decodeURIComponent(urlWithoutParams);
  
  console.log(`[CalendarMediaFallback] Checking URL: ${url}`);
  
  // Check if this is a calendar or event media URL
  if (isCalendarMediaUrl(url) || isEventMediaUrl(url)) {
    console.log(`[CalendarMediaFallback] This is a calendar/event media URL: ${url}`);
    
    // Lazy-load the mapping on first request
    if (Object.keys(urlMapping).length === 0) {
      console.log(`[CalendarMediaFallback] Loading URL mapping for the first time`);
      urlMapping = loadUrlMapping();
      console.log(`[CalendarMediaFallback] Mapping contains ${Object.keys(urlMapping).length} entries`);
    }
    
    // Get Object Storage URL if available
    const objectStorageUrl = getObjectStorageUrl(url);
    
    if (objectStorageUrl) {
      // Redirect to Object Storage URL with 302 status code for better compatibility
      console.log(`[CalendarMediaFallback] Redirecting: ${url} -> ${objectStorageUrl}`);
      return res.status(302).redirect(objectStorageUrl);
    } else {
      // If no direct mapping found, but it looks like event media, use our storage proxy
      if (isEventMediaUrl(url)) {
        // Extract the filename from the URL for use with the storage proxy
        let filename = '';
        if (url.includes('/')) {
          filename = url.split('/').pop() || '';
        } else {
          filename = url;
        }
        
        // If we couldn't extract a valid filename, use the default image
        if (!filename) {
          console.log(`[CalendarMediaFallback] Could not extract filename, using default image`);
          return res.status(302).redirect('/default-event-image.svg');
        }
        
        // Create a storage proxy URL that will access Object Storage exclusively
        const proxyUrl = `/api/storage-proxy/CALENDAR/events/${filename}`;
        console.log(`[CalendarMediaFallback] Using storage proxy URL for event media: ${proxyUrl}`);
        return res.status(302).redirect(proxyUrl);
      }
      
      console.log(`[CalendarMediaFallback] No Object Storage URL found for ${url}`);
    }
  }
  
  // Pass through to next middleware if not redirected
  next();
}

// Export the middleware function
export default calendarMediaFallbackMiddleware;