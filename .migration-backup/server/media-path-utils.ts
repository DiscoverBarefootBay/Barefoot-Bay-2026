/**
 * Media path utility functions for both standard and production paths
 * 
 * This file contains utilities to handle media paths, ensuring files are stored
 * in both /uploads/{mediaType} format for development and /{mediaType} format for production
 */

import fs from 'fs';
import path from 'path';

// Define the mapping of media types to paths
export const MEDIA_TYPES = {
  BANNER_SLIDES: 'banner-slides',
  CALENDAR: 'calendar',
  FORUM: 'forum-media',
  VENDOR: 'vendor-media',
  COMMUNITY: 'community-media',
  CONTENT: 'content-media',
  AVATARS: 'avatars',
  ICONS: 'icons',
  REAL_ESTATE: 'Real Estate', // Keep for backward compatibility
  REAL_ESTATE_MEDIA: 'real-estate-media', // New dedicated folder for real estate media
  FOR_SALE: 'for-sale-media', // Alternative name for the same folder
  PRODUCTS: 'products',
  ATTACHED_ASSETS: 'attached_assets'
};

// List of media directories for static file serving
export const MEDIA_DIRECTORIES = [
  'banner-slides',
  'calendar',
  'forum-media',
  'vendor-media',
  'community-media',
  'content-media',
  'avatars',
  'icons',
  'Real Estate', // For backward compatibility
  'real-estate-media', // New dedicated folder
  'for-sale-media', // Alternative name for the same folder
  'products',
  'attached_assets'
];

/**
 * Ensure a directory exists, creating it if it doesn't
 * @param dirPath Path to ensure exists
 * @returns true if directory was created, false if it already existed
 */
export function ensureDirectoryExists(dirPath: string): boolean {
  if (!fs.existsSync(dirPath)) {
    console.log(`[MediaPath] Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }
  return false;
}

/**
 * Copy a file from the uploads folder to its production location
 * @param filePath Path to file in uploads directory
 * @returns true if copied successfully, false if failed
 */
export function copyFileToProductionLocation(filePath: string): boolean {
  try {
    // Extract the media type folder from the path
    const parts = filePath.split('/');
    
    // Must have at least 3 parts: uploads/media-type/filename
    if (parts.length < 3 || parts[0] !== 'uploads') {
      console.error(`[MediaPath] Invalid uploads path: ${filePath}`);
      return false;
    }
    
    const mediaTypeFolder = parts[1];
    const productionPath = filePath.replace(/^uploads\//, '');
    const absoluteSource = path.resolve(filePath);
    const absoluteTarget = path.resolve(productionPath);
    
    // Don't proceed if the file doesn't exist
    if (!fs.existsSync(absoluteSource)) {
      console.error(`[MediaPath] Source file doesn't exist: ${absoluteSource}`);
      return false;
    }
    
    // Ensure the target directory exists
    const targetDir = path.dirname(absoluteTarget);
    ensureDirectoryExists(targetDir);
    
    // Copy the file to its production location
    fs.copyFileSync(absoluteSource, absoluteTarget);
    console.log(`[MediaPath] Copied ${absoluteSource} → ${absoluteTarget}`);
    
    return true;
  } catch (error) {
    console.error('[MediaPath] Error copying file to production location:', error);
    return false;
  }
}

/**
 * Generate both development and production URLs for a media file
 * @param mediaType Media type constant from MEDIA_TYPES
 * @param filename Filename with extension
 * @returns Object with both URLs
 */
export function generateMediaUrls(mediaType: string, filename: string) {
  const devUrl = `/uploads/${mediaType}/${filename}`;
  const prodUrl = `/${mediaType}/${filename}`;
  
  return {
    devUrl,
    prodUrl,
  };
}

/**
 * Create a consistent media filename with timestamp and random suffix
 * @param prefix Prefix for the filename (e.g., 'banner', 'avatar')
 * @param extension File extension with dot (e.g., '.png', '.jpg')
 * @returns Generated filename
 */
export function createMediaFilename(prefix: string, extension: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000000000);
  return `${prefix}-${timestamp}-${randomSuffix}${extension}`;
}

/**
 * Save a media file to both uploads and production locations
 * @param buffer File content as Buffer
 * @param mediaType Media type constant from MEDIA_TYPES
 * @param filename Filename to use
 * @returns Object with dev and prod URLs if successful, null if failed
 */
export function saveMediaFile(buffer: Buffer, mediaType: string, filename: string) {
  try {
    // Create paths
    const uploadsDir = path.resolve('uploads', mediaType);
    const prodDir = path.resolve(mediaType);
    
    // Ensure directories exist
    ensureDirectoryExists(uploadsDir);
    ensureDirectoryExists(prodDir);
    
    // Create file paths
    const uploadsPath = path.join(uploadsDir, filename);
    const prodPath = path.join(prodDir, filename);
    
    // Write the files with error checking
    try {
      fs.writeFileSync(uploadsPath, buffer);
      console.log(`[MediaPath] Successfully saved ${filename} to uploads location`);
    } catch (uploadError) {
      console.error(`[MediaPath] Failed to save to uploads location: ${uploadError}`);
      throw new Error(`Failed to save to uploads location: ${uploadError.message}`);
    }
    
    try {
      fs.writeFileSync(prodPath, buffer);
      console.log(`[MediaPath] Successfully saved ${filename} to production location`);
    } catch (prodError) {
      console.error(`[MediaPath] Failed to save to production location: ${prodError}`);
      // If production save fails but uploads succeeded, try to remove the uploads file to maintain consistency
      try {
        if (fs.existsSync(uploadsPath)) {
          fs.unlinkSync(uploadsPath);
          console.log(`[MediaPath] Removed uploads file after production save failure`);
        }
      } catch (cleanupError) {
        console.error(`[MediaPath] Failed to clean up uploads file: ${cleanupError}`);
      }
      throw new Error(`Failed to save to production location: ${prodError.message}`);
    }
    
    // Verify files exist at both locations
    const uploadsExists = fs.existsSync(uploadsPath);
    const prodExists = fs.existsSync(prodPath);
    
    if (!uploadsExists || !prodExists) {
      console.error(`[MediaPath] Verification failed - uploads: ${uploadsExists}, production: ${prodExists}`);
      
      // Attempt cleanup of any files that did save
      if (uploadsExists) {
        try {
          fs.unlinkSync(uploadsPath);
        } catch (error) {
          console.error(`[MediaPath] Failed to clean up uploads file after verification failure: ${error}`);
        }
      }
      
      if (prodExists) {
        try {
          fs.unlinkSync(prodPath);
        } catch (error) {
          console.error(`[MediaPath] Failed to clean up production file after verification failure: ${error}`);
        }
      }
      
      throw new Error('File verification failed after save');
    }
    
    // Generate URLs
    const urls = generateMediaUrls(mediaType, filename);
    
    // Log file sizes for debugging
    try {
      const uploadStats = fs.statSync(uploadsPath);
      const prodStats = fs.statSync(prodPath);
      console.log(`[MediaPath] File sizes - uploads: ${uploadStats.size}, production: ${prodStats.size}`);
    } catch (error) {
      console.warn(`[MediaPath] Could not verify file sizes: ${error.message}`);
    }
    
    console.log(`[MediaPath] Saved ${filename} to both locations successfully`);
    return urls;
  } catch (error) {
    console.error('[MediaPath] Error saving media file:', error);
    return null;
  }
}

/**
 * Try to find a file in multiple possible locations
 * @param filename Filename to look for
 * @returns Full path to the file if found, null if not found
 */
export function findMediaFile(filename: string): string | null {
  // List of possible media directories
  const mediaTypes = Object.values(MEDIA_TYPES);
  
  // Check production locations first (preferred)
  for (const mediaType of mediaTypes) {
    const prodPath = path.resolve(mediaType, filename);
    if (fs.existsSync(prodPath)) {
      return prodPath;
    }
  }
  
  // Then check uploads locations
  for (const mediaType of mediaTypes) {
    const uploadsPath = path.resolve('uploads', mediaType, filename);
    if (fs.existsSync(uploadsPath)) {
      return uploadsPath;
    }
  }
  
  // File not found in any location
  return null;
}

/**
 * Fix URLs in database records to ensure they use the correct format
 * @param url URL to fix
 * @param forProduction Whether to convert the URL to production format (removing /uploads/)
 * @returns Fixed URL
 */
export function fixMediaUrl(url: string, forProduction: boolean = false): string {
  if (!url) {
    console.log("[DEBUG: fixMediaUrl] Called with empty URL");
    return url;
  }
  
  console.log(`[DEBUG: fixMediaUrl] Processing URL: "${url}", forProduction: ${forProduction}`);
  
  try {
    // Validate URL to make sure it's a string
    if (typeof url !== 'string') {
      console.error(`[DEBUG: fixMediaUrl] Invalid URL type: ${typeof url}`);
      return '';
    }
    
    // ENHANCED HTML DETECTION: Check for multiple signs of HTML content
    // This is a more comprehensive check to catch vendor page content
    const htmlMarkers = [
      '<span', '<div', '<p', '<br', '<h1', '<h2', '<h3', '<h4', '<h5', '<h6',
      '<img', '<a', '<ul', '<ol', '<li', '<table', '<tr', '<td', '<th',
      'style=', 'class=', 'id=', '&amp;', '&lt;', '&gt;', '&nbsp;'
    ];
    
    // Check if URL contains any HTML markers
    for (const marker of htmlMarkers) {
      if (url.includes(marker)) {
        console.log(`[DEBUG: fixMediaUrl] Detected HTML content (marker: ${marker}), skipping URL fixing`);
        return url;
      }
    }
    
    // Check for general HTML markers (brackets)
    if (url.includes('<') && url.includes('>')) {
      console.log(`[DEBUG: fixMediaUrl] Detected HTML content (brackets), skipping URL fixing`);
      return url;
    }
    
    // ENHANCED TEXT CONTENT DETECTION 
    // Check for vendor page content - multiple rules to identify plain text
    
    // Rule 1: Long text is likely content, not a URL
    if (url.length > 100) {
      console.log(`[DEBUG: fixMediaUrl] Detected likely vendor text content (length > 100), skipping URL fixing`);
      return url;
    }
    
    // Rule 2: Text with spaces AND punctuation is likely content, not a URL
    if (url.includes(' ')) {
      // Additional check for punctuation or common text patterns
      if (url.includes('.') || url.includes(',') || url.includes('!') || 
          url.includes('?') || url.includes(':') || url.includes(';') ||
          /[A-Z][a-z]/.test(url) // Check for properly cased words (capital followed by lowercase)
      ) {
        console.log(`[DEBUG: fixMediaUrl] Detected likely vendor text content (spaces + punctuation/capitalization), skipping URL fixing`);
        return url;
      }
    }
    
    // Rule 3: Sentences (multiple words) are likely content, not URLs
    const wordCount = url.split(/\s+/).filter(word => word.length > 0).length;
    if (wordCount > 2) {
      console.log(`[DEBUG: fixMediaUrl] Detected likely vendor text content (${wordCount} words), skipping URL fixing`);
      return url;
    }
    
    // Only remove /uploads/ when specifically requested for production
    if (forProduction && url.startsWith('/uploads/')) {
      const fixedUrl = url.replace(/^\/uploads\//, '/');
      console.log(`[DEBUG: fixMediaUrl] Production conversion: "${url}" -> "${fixedUrl}"`);
      return fixedUrl;
    }
    
    // Make sure URL has a leading slash for consistency - ONLY for actual media URLs
    // Check if this is likely a valid media path using strict criteria
    const mediaPathCheck = new RegExp(`\\b(${MEDIA_DIRECTORIES.join('|')})\\b`);
    
    // Stricter URL detection - must be a likely media URL, not just any string with a period
    const isLikelyMediaUrl = 
      // Must match a media directory pattern
      (mediaPathCheck.test(url) || 
       // Or be a file with specific media extensions
       /\.(jpg|jpeg|png|gif|svg|mp4|webp|webm|mp3|pdf|doc|docx|xls|xlsx)$/i.test(url)) &&
      // Must not have spaces (URLs don't typically contain spaces)
      !url.includes(' ');
      
    if (url && 
        url.length > 0 && 
        !url.startsWith('/') && 
        !url.startsWith('http') &&
        isLikelyMediaUrl) {
      
      const fixedUrl = `/${url}`;
      console.log(`[DEBUG: fixMediaUrl] Added leading slash: "${url}" -> "${fixedUrl}"`);
      return fixedUrl;
    }
    
    // Keep original URL if it doesn't look like a media path that needs fixing
    console.log(`[DEBUG: fixMediaUrl] No changes needed for: "${url}"`);
    return url;
  } catch (error) {
    console.error('[DEBUG: fixMediaUrl] Error fixing media URL:', error);
    // Return the original URL if any error occurs
    return url;
  }
}

/**
 * Check if a URL appears to be a real estate media URL that's stored in the calendar folder
 * @param url URL to check
 * @returns true if the URL is a real estate media stored in calendar folder
 */
export function isRealEstateMediaInCalendarFolder(url: string): boolean {
  if (!url) {
    console.log("[DEBUG: isRealEstateMediaInCalendarFolder] Called with empty URL");
    return false;
  }
  
  try {
    console.log(`[DEBUG: isRealEstateMediaInCalendarFolder] Checking URL: "${url}"`);
    
    // Validate URL to make sure it's a string
    if (typeof url !== 'string') {
      console.error(`[DEBUG: isRealEstateMediaInCalendarFolder] Invalid URL type: ${typeof url}`);
      return false;
    }
    
    // If it's in the calendar folder but filename starts with real-estate or property
    const isInCalendar = url.includes('/calendar/') || url.includes('/uploads/calendar/');
    const isRealEstateFile = url.includes('real-estate-') || url.includes('property-') || 
                            url.includes('listing-') || url.includes('house-') || 
                            url.includes('home-') || url.includes('forsale-');
    
    // Detailed debugging
    console.log(`[DEBUG: isRealEstateMediaInCalendarFolder] Checks on "${url}":`, {
      isInCalendar,
      isRealEstateFile,
      containsCalendar: url.includes('/calendar/'),
      containsUploadsCalendar: url.includes('/uploads/calendar/'),
      containsRealEstate: url.includes('real-estate-'),
      containsProperty: url.includes('property-'),
      containsListing: url.includes('listing-'),
      result: isInCalendar && isRealEstateFile
    });
    
    return isInCalendar && isRealEstateFile;
  } catch (error) {
    console.error('[DEBUG: isRealEstateMediaInCalendarFolder] Error checking URL:', error);
    return false;
  }
}

/**
 * Normalize a media URL to ensure it works in both development and production
 * @param url Original media URL to normalize
 * @returns Normalized URL with correct path
 */
export function normalizeMediaPath(url: string): string {
  if (!url) return url;
  
  // Extract the filename and media type from the URL
  const parts = url.split('/').filter(Boolean);
  if (parts.length < 2) return url; // Not a valid media URL
  
  let mediaType: string;
  let filename: string;
  
  // Case 1: URL with /uploads/ prefix
  if (parts[0] === 'uploads' && parts.length >= 3) {
    mediaType = parts[1];
    filename = parts[parts.length - 1];
  } 
  // Case 2: Direct URL without /uploads/
  else {
    mediaType = parts[0];
    filename = parts[parts.length - 1];
  }
  
  // Always return the /uploads/ version for consistency
  return `/uploads/${mediaType}/${filename}`;
}

/**
 * Normalize an event media URL to ensure it uses the Object Storage format
 * @param url Original media URL to normalize
 * @returns Normalized URL with Object Storage path
 */
export function normalizeEventMediaUrl(url: string): string {
  // If it's already an Object Storage URL, return it
  if (url && url.startsWith('https://object-storage.replit.app/')) {
    return url;
  }
  
  // If it's already a proxy URL, keep it that way
  if (url && url.startsWith('/api/storage-proxy/')) {
    return url;
  }
  
  // Default image path for empty URLs
  if (!url) return '/api/storage-proxy/CALENDAR/events/default-event-image.svg';
  
  // Extract the filename from various possible URL formats
  let filename = '';
  if (url.includes('/media/')) {
    filename = url.split('/media/')[1];
  } else if (url.includes('/calendar/')) {
    filename = url.split('/calendar/')[1];
  } else if (url.includes('/uploads/calendar/')) {
    filename = url.split('/uploads/calendar/')[1];
  } else if (url.includes('/events/')) {
    filename = url.split('/events/')[1];
  } else {
    // For other URL formats, try to extract the last part as filename
    const parts = url.split('/').filter(Boolean);
    if (parts.length > 0) {
      filename = parts[parts.length - 1];
    } else {
      // If we can't identify the pattern, return default image
      console.warn(`[MediaPath] Cannot parse event media URL: ${url}, using default image`);
      return '/api/storage-proxy/CALENDAR/events/default-event-image.svg';
    }
  }
  
  // Use proxy URL format instead of direct Object Storage URL to avoid CORS issues
  // This ensures we access exclusively through Object Storage by routing through our server-side proxy
  const proxyUrl = `/api/storage-proxy/CALENDAR/events/${filename}`;
  console.log(`[MediaPath] Normalized event media URL: ${url} -> ${proxyUrl}`);
  
  return proxyUrl;
}

/**
 * Synchronize a media file to ensure it exists in both locations
 * @param url Media URL to synchronize
 * @returns Promise resolving to true if sync succeeded, false otherwise
 */
export async function syncMediaFile(url: string): Promise<boolean> {
  if (!url) return false;
  
  try {
    // Extract path components
    const parts = url.split('/').filter(Boolean);
    if (parts.length < 2) return false;
    
    let mediaType: string;
    let filename: string;
    
    // Handle /uploads/ prefix
    if (parts[0] === 'uploads' && parts.length >= 3) {
      mediaType = parts[1];
      filename = parts[parts.length - 1];
    } else {
      mediaType = parts[0];
      filename = parts[parts.length - 1];
    }
    
    // Define both paths
    const uploadPath = path.join(process.cwd(), 'uploads', mediaType, filename);
    const directPath = path.join(process.cwd(), mediaType, filename);
    
    // Ensure directories exist
    ensureDirectoryExists(path.dirname(uploadPath));
    ensureDirectoryExists(path.dirname(directPath));
    
    // Check which version exists and copy as needed
    const uploadExists = fs.existsSync(uploadPath);
    const directExists = fs.existsSync(directPath);
    
    if (uploadExists && !directExists) {
      fs.copyFileSync(uploadPath, directPath);
      console.log(`[MediaSync] Copied ${filename} from uploads to direct path`);
    } else if (directExists && !uploadExists) {
      fs.copyFileSync(directPath, uploadPath);
      console.log(`[MediaSync] Copied ${filename} from direct to uploads path`);
    } else if (!uploadExists && !directExists) {
      console.warn(`[MediaSync] File ${filename} doesn't exist in either location`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`[MediaSync] Error synchronizing media file ${url}:`, error);
    return false;
  }
}

/**
 * Fix real estate media URLs to reflect the new folder structure
 * For backward compatibility - doesn't move the actual files
 * @param url URL to potentially fix
 * @param forProduction Whether to convert the URL to production format
 * @returns The fixed URL or the original if no fix needed
 */
export function fixRealEstateMediaUrl(url: string, forProduction: boolean = false): string {
  if (!url) {
    console.log("[DEBUG: fixRealEstateMediaUrl] Called with empty URL");
    return url;
  }
  
  // Diagnostic logging to track what's happening with URLs
  console.log(`[DEBUG: fixRealEstateMediaUrl] Processing URL: "${url}", forProduction: ${forProduction}`);
  
  try {
    // Validate the URL to make sure it's a string
    if (typeof url !== 'string') {
      console.error(`[DEBUG: fixRealEstateMediaUrl] Invalid URL type: ${typeof url}`, url);
      return '';
    }
    
    // First fix any /uploads/ prefix if requested
    const fixedUrl = fixMediaUrl(url, forProduction);
    console.log(`[DEBUG: fixRealEstateMediaUrl] After fixMediaUrl: "${fixedUrl}"`);
    
    // Check if this needs to be updated with the new folder structure
    const needsUpdate = isRealEstateMediaInCalendarFolder(fixedUrl);
    console.log(`[DEBUG: fixRealEstateMediaUrl] Needs folder structure update: ${needsUpdate}`);
    
    if (needsUpdate) {
      const parts = fixedUrl.split('/');
      console.log(`[DEBUG: fixRealEstateMediaUrl] URL parts:`, parts);
      
      const filename = parts.pop();
      console.log(`[DEBUG: fixRealEstateMediaUrl] Extracted filename: "${filename}"`);
      
      if (filename) {
        let updatedUrl;
        // In production format, no /uploads/ prefix
        if (forProduction) {
          updatedUrl = `/${MEDIA_TYPES.REAL_ESTATE_MEDIA}/${filename}`;
        } else {
          // In development, keep the /uploads/ prefix
          updatedUrl = `/uploads/${MEDIA_TYPES.REAL_ESTATE_MEDIA}/${filename}`;
        }
        console.log(`[DEBUG: fixRealEstateMediaUrl] Converted URL: "${updatedUrl}"`);
        return updatedUrl;
      }
    }
    
    // Check for potential URL inconsistencies
    if (url.includes('/real-estate-media/') && url.includes('/uploads/')) {
      console.log(`[DEBUG: fixRealEstateMediaUrl] Found overlapping path patterns in URL: "${url}"`);
      // Keep the simplest correct path
      const filename = url.split('/').pop();
      if (filename) {
        const cleanPath = forProduction 
          ? `/${MEDIA_TYPES.REAL_ESTATE_MEDIA}/${filename}`
          : `/uploads/${MEDIA_TYPES.REAL_ESTATE_MEDIA}/${filename}`;
        console.log(`[DEBUG: fixRealEstateMediaUrl] Cleaned up problematic URL: "${cleanPath}"`);
        return cleanPath;
      }
    }
    
    console.log(`[DEBUG: fixRealEstateMediaUrl] Returning fixed URL: "${fixedUrl}"`);
    return fixedUrl;
  } catch (error) {
    console.error('[DEBUG: fixRealEstateMediaUrl] Error fixing real estate media URL:', error);
    console.error('[DEBUG: fixRealEstateMediaUrl] Error details:', {
      message: error.message,
      stack: error.stack,
      errorType: error.constructor.name,
      originalUrl: url
    });
    // Return the original URL if any error occurs
    return url;
  }
}

/**
 * Fix content media URLs to ensure they work in both dev and production
 * @param url URL to potentially fix
 * @param forProduction Whether to convert the URL to production format
 * @returns The fixed URL or the original if no fix needed
 */
export function fixContentMediaUrl(url: string, forProduction: boolean = false): string {
  if (!url) return url;
  
  // Check if this is HTML content
  const isHtmlContent = url.includes('<') && url.includes('>');
  
  // For plain URLs (not HTML content)
  if (!isHtmlContent) {
    // First fix any /uploads/ prefix only if requested
    const fixedUrl = fixMediaUrl(url, forProduction);
    
    // Check if this is a content media URL with barefootbay.com prefix (production)
    if (fixedUrl.includes('barefootbay.com/content-media/')) {
      const filename = fixedUrl.split('/').pop();
      if (filename) {
        if (forProduction) {
          return `/${MEDIA_TYPES.CONTENT}/${filename}`;
        } else {
          return `/uploads/${MEDIA_TYPES.CONTENT}/${filename}`;
        }
      }
    }
    
    return fixedUrl;
  }
  
  // For HTML content with image tags, we need to find and replace src attributes
  let contentHtml = url;
  
  // ENHANCED DETECTION: Check for vendor content that might get incorrectly processed
  // Multiple rules to detect text content vs media content
  
  // Rule 1: HTML with styling but no images is likely vendor content
  if (contentHtml.includes('<span') && contentHtml.includes('style=') && !contentHtml.includes('img src=')) {
    console.log(`[DEBUG: fixContentMediaUrl] Detected likely vendor content HTML without images, skipping processing`);
    return contentHtml;
  }
  
  // Rule 2: Any text content with paragraph structures but no media references
  if ((contentHtml.includes('<p') || contentHtml.includes('<div')) && 
      !contentHtml.includes('img src=') && 
      !contentHtml.includes('video src=') &&
      !contentHtml.includes('/content-media/') &&
      !contentHtml.includes('/forum-media/') &&
      !contentHtml.includes('/vendor-media/')) {
    console.log(`[DEBUG: fixContentMediaUrl] Detected vendor content with paragraphs but no media, skipping processing`);
    return contentHtml;
  }
  
  // Rule 3: Plain text with minimal markup - don't process further
  if (contentHtml.length < 500 && contentHtml.split('<').length < 5) {
    console.log(`[DEBUG: fixContentMediaUrl] Detected simple vendor content with minimal markup, skipping processing`);
    return contentHtml;
  }
  
  // Find all image tags with src attributes that contain content-media URLs
  const imgRegex = /<img[^>]*src=["']([^"']*content-media[^"']*)["'][^>]*>/gi;
  let match;
  
  // Use non-iterator approach for better backward compatibility
  while ((match = imgRegex.exec(contentHtml)) !== null) {
    const originalSrc = match[1];
    const fixedSrc = fixContentMediaUrl(originalSrc, forProduction); // Recursively fix the URL
    
    // Only replace if the fix actually changed something
    if (originalSrc !== fixedSrc) {
      // Create a regex that matches this specific img tag's src
      const specificRegex = new RegExp(`src=["']${originalSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'g');
      contentHtml = contentHtml.replace(specificRegex, `src="${fixedSrc}"`);
    }
  }
  
  return contentHtml;
}

/**
 * Verify that a banner slide exists at both target locations
 * @param filename The filename to verify
 * @returns boolean indicating if the file exists at both locations
 */
export function verifyBannerSlideExists(filename: string): boolean {
  try {
    // Check uploads path
    const uploadsPath = path.resolve('uploads', MEDIA_TYPES.BANNER_SLIDES, filename);
    const uploadsExists = fs.existsSync(uploadsPath);
    
    // Check production path
    const prodPath = path.resolve(MEDIA_TYPES.BANNER_SLIDES, filename);
    const prodExists = fs.existsSync(prodPath);
    
    // Log the results for debugging
    console.log(`[MediaPath] Banner slide verification - ${filename}:`, {
      uploadsExists,
      prodExists,
      uploadsPath,
      prodPath
    });
    
    return uploadsExists && prodExists;
  } catch (error) {
    console.error(`[MediaPath] Error verifying banner slide existence:`, error);
    return false;
  }
}

/**
 * Synchronize media URLs for WebSocket messages
 * This handles the case where calendar events with media URLs are updated via WebSocket
 * @param data The data object containing media URLs
 * @returns The data object with synchronized media URLs
 */
export function syncWebSocketMediaUrls(data: any): any {
  if (!data) return data;

  // Check if this is an event update with mediaUrls
  if (data.type === 'calendar_update' && data.data && data.data.event && Array.isArray(data.data.event.mediaUrls)) {
    const event = data.data.event;
    
    // Process each media URL in the event
    if (event.mediaUrls && event.mediaUrls.length > 0) {
      console.log(`[MediaPath] Synchronizing ${event.mediaUrls.length} media URLs for event ${event.id || 'new'} via WebSocket`);
      
      // Create a new array for the processed URLs
      const syncedMediaUrls = event.mediaUrls.map((url: string) => {
        // Extract the filename from the URL
        if (!url) return url;
        
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1];
        
        // Skip if there's no valid filename
        if (!filename) return url;
        
        // Detect media type from URL paths
        let mediaType = MEDIA_TYPES.CALENDAR; // Default to calendar
        
        // Check if it's in the calendar folder
        const isCalendarMedia = url.includes('/calendar/') || url.includes('/uploads/calendar/');
        if (isCalendarMedia) {
          // Synchronize between uploads/calendar and calendar directories
          const uploadsPath = path.resolve('uploads', MEDIA_TYPES.CALENDAR, filename);
          const prodPath = path.resolve(MEDIA_TYPES.CALENDAR, filename);
          
          try {
            // Enhanced logging to debug the issue
            console.log(`[MediaPath] WebSocket: Processing calendar media URL: ${url}`);
            console.log(`[MediaPath] WebSocket: Checking paths: ${uploadsPath} and ${prodPath}`);
            
            // Check which version exists
            const uploadsExists = fs.existsSync(uploadsPath);
            const prodExists = fs.existsSync(prodPath);
            
            console.log(`[MediaPath] WebSocket: File status - uploads: ${uploadsExists}, production: ${prodExists}`);
            
            // If one exists but not the other, synchronize them
            if (uploadsExists && !prodExists) {
              console.log(`[MediaPath] WebSocket: Copying calendar media from uploads to production: ${filename}`);
              
              // Ensure the production directory exists
              const prodDir = path.dirname(prodPath);
              ensureDirectoryExists(prodDir);
              
              // Copy the file
              fs.copyFileSync(uploadsPath, prodPath);
              
              // Verify the copy was successful
              if (fs.existsSync(prodPath)) {
                console.log(`[MediaPath] WebSocket: Successfully copied to production: ${filename}`);
              } else {
                console.error(`[MediaPath] WebSocket: Failed to copy file to production: ${filename}`);
              }
            } else if (!uploadsExists && prodExists) {
              console.log(`[MediaPath] WebSocket: Copying calendar media from production to uploads: ${filename}`);
              
              // Ensure the uploads directory exists
              const uploadsDir = path.dirname(uploadsPath);
              ensureDirectoryExists(uploadsDir);
              
              // Copy the file
              fs.copyFileSync(prodPath, uploadsPath);
              
              // Verify the copy was successful
              if (fs.existsSync(uploadsPath)) {
                console.log(`[MediaPath] WebSocket: Successfully copied to uploads: ${filename}`);
              } else {
                console.error(`[MediaPath] WebSocket: Failed to copy file to uploads: ${filename}`);
              }
            } else if (!uploadsExists && !prodExists) {
              // Special case: neither file exists, which could be the root cause of the issue
              console.error(`[MediaPath] WebSocket: Calendar media file not found in either location: ${filename}`);
              console.error(`[MediaPath] WebSocket: This might be causing media loading issues`);
              
              // Try to locate the file in any of the uploads subdirectories
              const possibleDirectories = [
                'uploads',
                'calendar',
                'uploads/media',
                'media',
                'uploads/forum-media',
                'forum-media',
                'uploads/vendor-media',
                'vendor-media',
                'uploads/content-media',
                'content-media',
                'uploads/real-estate-media',
                'real-estate-media',
                'attached_assets'
              ];
              
              let fileFound = false;
              for (const dir of possibleDirectories) {
                const potentialPath = path.resolve(dir, filename);
                if (fs.existsSync(potentialPath)) {
                  console.log(`[MediaPath] WebSocket: Found missing calendar file in ${dir}: ${filename}`);
                  
                  // Copy to both target locations
                  ensureDirectoryExists(path.dirname(uploadsPath));
                  ensureDirectoryExists(path.dirname(prodPath));
                  
                  fs.copyFileSync(potentialPath, uploadsPath);
                  fs.copyFileSync(potentialPath, prodPath);
                  
                  console.log(`[MediaPath] WebSocket: Recovered missing calendar file: ${filename}`);
                  fileFound = true;
                  break;
                }
              }
              
              if (!fileFound) {
                console.error(`[MediaPath] WebSocket: Could not find the missing calendar file anywhere: ${filename}`);
              }
            } else {
              // Both files exist, verify they're identical
              const uploadsStat = fs.statSync(uploadsPath);
              const prodStat = fs.statSync(prodPath);
              
              if (uploadsStat.size !== prodStat.size) {
                console.log(`[MediaPath] WebSocket: File size mismatch for ${filename}, synchronizing`);
                // Use the newer file as the source
                if (uploadsStat.mtime > prodStat.mtime) {
                  fs.copyFileSync(uploadsPath, prodPath);
                } else {
                  fs.copyFileSync(prodPath, uploadsPath);
                }
              }
            }
            
            console.log(`[MediaPath] WebSocket: Synchronized calendar media: ${filename}`);
          } catch (error) {
            console.error(`[MediaPath] WebSocket: Error synchronizing calendar media: ${error.message}`);
          }
        }
        
        // Return the original URL (we're synchronizing the actual files, not changing URLs)
        return url;
      });
      
      // Replace the mediaUrls in the event
      event.mediaUrls = syncedMediaUrls;
    }
  }
  
  return data;
}

/**
 * Synchronize a specific banner slide between uploads and production directories
 * @param filename The filename to synchronize
 * @returns boolean indicating if synchronization was successful
 */
export function syncBannerSlide(filename: string): boolean {
  try {
    const uploadsPath = path.resolve('uploads', MEDIA_TYPES.BANNER_SLIDES, filename);
    const prodPath = path.resolve(MEDIA_TYPES.BANNER_SLIDES, filename);
    
    // Check if files exist in either location
    const uploadsExists = fs.existsSync(uploadsPath);
    const prodExists = fs.existsSync(prodPath);
    
    if (!uploadsExists && !prodExists) {
      console.error(`[MediaPath] Cannot sync banner slide - missing in both locations: ${filename}`);
      return false;
    }
    
    // If file exists in uploads but not in production, copy it to production
    if (uploadsExists && !prodExists) {
      console.log(`[MediaPath] Copying banner slide from uploads to production: ${filename}`);
      
      // Create the production directory if it doesn't exist
      ensureDirectoryExists(path.dirname(prodPath));
      
      // Copy the file
      fs.copyFileSync(uploadsPath, prodPath);
      return fs.existsSync(prodPath);
    }
    
    // If file exists in production but not in uploads, copy it to uploads
    if (!uploadsExists && prodExists) {
      console.log(`[MediaPath] Copying banner slide from production to uploads: ${filename}`);
      
      // Create the uploads directory if it doesn't exist
      ensureDirectoryExists(path.dirname(uploadsPath));
      
      // Copy the file
      fs.copyFileSync(prodPath, uploadsPath);
      return fs.existsSync(uploadsPath);
    }
    
    // If file exists in both locations, verify they have the same size
    if (uploadsExists && prodExists) {
      const uploadsStats = fs.statSync(uploadsPath);
      const prodStats = fs.statSync(prodPath);
      
      // If sizes differ, update the smaller file with the larger one
      if (uploadsStats.size !== prodStats.size) {
        console.log(`[MediaPath] Sizes differ for banner slide ${filename}:`, {
          uploadsSize: uploadsStats.size,
          prodSize: prodStats.size
        });
        
        if (uploadsStats.size > prodStats.size) {
          console.log(`[MediaPath] Updating production copy with larger uploads copy: ${filename}`);
          fs.copyFileSync(uploadsPath, prodPath);
        } else {
          console.log(`[MediaPath] Updating uploads copy with larger production copy: ${filename}`);
          fs.copyFileSync(prodPath, uploadsPath);
        }
      } else {
        console.log(`[MediaPath] Banner slide already in sync: ${filename}`);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`[MediaPath] Error synchronizing banner slide:`, error);
    return false;
  }
}