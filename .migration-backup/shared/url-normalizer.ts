/**
 * URL Normalizer Utility
 * 
 * This utility provides standardized URL handling across the application,
 * ensuring consistent format for media URLs, especially for Object Storage access.
 */

/**
 * Normalizes a URL to ensure it uses the proxy format for Object Storage access
 * This prevents direct Object Storage access which can cause CORS issues
 * 
 * @param url The URL to normalize
 * @param context Optional context to provide more specific handling (e.g., 'event', 'banner')
 * @returns The normalized URL
 */
export function normalizeMediaUrl(url: string, context?: string): string {
  // Handle null, undefined, or empty strings
  if (!url || typeof url !== 'string') {
    console.warn(`[URLNormalizer] Received invalid URL value to normalize: ${typeof url}`);
    return '';
  }
  
  try {
    // If it's already in the proxy format, return as is
    if (url.startsWith('/api/storage-proxy/')) {
      return url;
    }
    
    // Direct Object Storage URLs should be converted to proxy format
    if (url.startsWith('https://object-storage.replit.app/')) {
      // Check if it's a calendar event media URL
      if (url.includes('/CALENDAR/events/')) {
        // Extract the filename from the URL
        const filename = url.split('/').pop();
        if (filename) {
          // Convert to storage proxy URL format
          const proxyUrl = `/api/storage-proxy/CALENDAR/events/${filename}`;
          console.log(`[URLNormalizer] Converting direct Object Storage URL to proxy: ${url} -> ${proxyUrl}`);
          return proxyUrl;
        }
      }
      
      // For any other Object Storage URL, parse the bucket and path
      try {
        const urlObj = new URL(url);
        
        // Extract path components after the hostname
        const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
        
        if (pathParts.length >= 2) {
          const bucket = pathParts[0];
          const remainingPath = pathParts.slice(1).join('/');
          const proxyUrl = `/api/storage-proxy/${bucket}/${remainingPath}`;
          console.log(`[URLNormalizer] Converting Object Storage URL to proxy format: ${url} -> ${proxyUrl}`);
          return proxyUrl;
        }
      } catch (parseError) {
        console.error('[URLNormalizer] Error parsing Object Storage URL:', parseError);
      }
    }
    
    // Handle special path formats for calendar events - expanded to catch more variations
    if (context === 'event' || 
        context === 'calendar' || 
        url.includes('/calendar/') || 
        url.includes('/uploads/calendar/') ||
        url.includes('/uploads/events/') ||
        url.includes('/events/')) {
      
      // Extract the filename, handling any path structure
      const filename = url.split('/').pop();
      if (filename) {
        const proxyUrl = `/api/storage-proxy/CALENDAR/events/${filename}`;
        console.log(`[URLNormalizer] Converting calendar path to proxy format: ${url} -> ${proxyUrl}`);
        return proxyUrl;
      }
    }
    
    // Return the URL unchanged if no normalization rules apply
    return url;
  } catch (error) {
    console.error(`[URLNormalizer] Unexpected error normalizing URL "${url}":`, error);
    // In case of error, return the original URL to maintain functionality
    return url;
  }
}

/**
 * Batch normalize an array of media URLs to ensure consistent format
 * 
 * @param urls Array of URLs to normalize
 * @param context Optional context for more specific handling
 * @returns Array of normalized URLs
 */
export function normalizeMediaUrls(urls: string[] | null | undefined, context?: string): string[] {
  if (!urls || !Array.isArray(urls)) {
    console.warn(`[URLNormalizer] Received invalid URLs array: ${typeof urls}`);
    return [];
  }
  
  try {
    return urls
      .filter(url => url !== null && url !== undefined)
      .map(url => {
        try {
          return normalizeMediaUrl(url, context);
        } catch (error) {
          console.error(`[URLNormalizer] Error normalizing URL in batch: ${url}`, error);
          return url; // Return original URL on error
        }
      });
  } catch (error) {
    console.error(`[URLNormalizer] Error normalizing URLs array`, error);
    return urls; // Return original array on error
  }
}

/**
 * Safely access a URL from a mediaUrls array field, returning normalized URL
 * 
 * @param mediaUrls Array of media URLs
 * @param index Index to access (defaults to 0 for first image)
 * @param context Optional context for normalization
 * @returns Normalized URL or empty string if not available
 */
export function getMediaUrlSafe(mediaUrls: string[] | null | undefined, index: number = 0, context?: string): string {
  if (!mediaUrls || !Array.isArray(mediaUrls) || mediaUrls.length === 0) {
    return '';
  }
  
  try {
    // Check for valid URL at specified index
    if (index < 0 || index >= mediaUrls.length || !mediaUrls[index]) {
      return '';
    }
    
    return normalizeMediaUrl(mediaUrls[index], context);
  } catch (error) {
    console.error(`[URLNormalizer] Error accessing mediaUrl at index ${index}:`, error);
    return '';
  }
}

/**
 * Get the default image URL for a specific context
 * 
 * @param context Context identifier (e.g., 'event', 'banner', 'vendor')
 * @returns Appropriate default image URL for the context
 */
export function getDefaultImageUrl(context: string): string {
  switch (context) {
    case 'event':
      return '/api/storage-proxy/CALENDAR/events/default-event-image.svg';
    case 'banner':
      return '/public/banner-placeholder.jpg';
    case 'vendor':
      return '/public/vendor-placeholder.png';
    case 'forum':
      return '/public/forum-placeholder.jpg';
    default:
      return '';
  }
}

/**
 * Determine if a URL is a direct Object Storage URL
 * 
 * @param url URL to check
 * @returns Boolean indicating if this is a direct Object Storage URL
 */
export function isDirectObjectStorageUrl(url: string): boolean {
  return url.startsWith('https://object-storage.replit.app/');
}

/**
 * Determine if a URL is already in proxy format
 * 
 * @param url URL to check
 * @returns Boolean indicating if this URL is already in proxy format
 */
export function isProxyUrl(url: string): boolean {
  return url.startsWith('/api/storage-proxy/');
}

/**
 * Extract filename from a URL path
 * 
 * @param url URL to extract from
 * @returns Filename or empty string if not found
 */
export function extractFilename(url: string): string {
  if (!url) return '';
  const parts = url.split('/');
  return parts[parts.length - 1] || '';
}