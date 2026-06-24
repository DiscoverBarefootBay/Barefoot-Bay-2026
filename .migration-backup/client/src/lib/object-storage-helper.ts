/**
 * Helper functions for working with Object Storage media URLs
 */

// Constants
const REAL_ESTATE_MEDIA_PREFIX = "real-estate-media/";

/**
 * Detects if a URL is an Object Storage URL
 * @param url The URL to check
 * @returns Boolean indicating if the URL is an Object Storage URL
 */
export function isObjectStorageUrl(url: string): boolean {
  if (!url) return false;
  
  // Real estate media in Object Storage
  if (url.startsWith(REAL_ESTATE_MEDIA_PREFIX)) {
    return true;
  }
  
  return false;
}

/**
 * Get a presigned URL for Object Storage media
 * This is a placeholder function - actual implementation requires server communication
 * or direct Replit Object Storage SDK integration
 * @param url The Object Storage URL
 * @returns The URL to use for accessing the media
 */
export async function getPresignedUrl(url: string): Promise<string> {
  try {
    // For now, we'll use a server endpoint to get presigned URLs
    const response = await fetch(`/api/media/presigned?key=${encodeURIComponent(url)}`);
    
    if (!response.ok) {
      console.error(`Failed to get presigned URL for ${url}`);
      return url;
    }
    
    const data = await response.json();
    return data.url || url;
  } catch (error) {
    console.error(`Error getting presigned URL for ${url}:`, error);
    return url;
  }
}

/**
 * Normalizes a URL to ensure it's properly formatted for display
 * Handles both Object Storage and filesystem URLs
 * @param url The URL to normalize
 * @returns The normalized URL
 */
export function normalizeMediaUrl(url: string): string {
  if (!url) return '';
  
  // If this is an Object Storage URL, return it as is for now
  // In the future, this might return a presigned URL or CDN path
  if (isObjectStorageUrl(url)) {
    return url;
  }
  
  // Handle real estate media URLs from filesystem
  if (url.includes('real-estate-media')) {
    const filename = url.split('/').pop();
    if (filename) {
      // If this is a filesystem URL but should be Object Storage, convert it
      if (url.includes('/uploads/real-estate-media/') || url.includes('/real-estate-media/')) {
        return `${REAL_ESTATE_MEDIA_PREFIX}${filename}`;
      }
    }
  }
  
  // For all other URLs, maintain existing path format
  return url;
}

/**
 * Loads media from Object Storage with appropriate handling
 * @param url The media URL
 * @param options Optional configuration
 * @returns A Promise resolving to the URL to use for the media
 */
export async function loadObjectStorageMedia(url: string, options: { 
  fallbackUrl?: string,
  timeout?: number 
} = {}): Promise<string> {
  const { fallbackUrl, timeout = 5000 } = options;
  
  if (!url) return fallbackUrl || '';
  
  // Normalize the URL first
  const normalizedUrl = normalizeMediaUrl(url);
  
  // If this is an Object Storage URL, get a presigned URL if needed
  if (isObjectStorageUrl(normalizedUrl)) {
    try {
      return await getPresignedUrl(normalizedUrl);
    } catch (error) {
      console.error(`Error loading Object Storage media:`, error);
      return fallbackUrl || normalizedUrl;
    }
  }
  
  // For regular URLs, just return the normalized URL
  return normalizedUrl;
}

export default {
  isObjectStorageUrl,
  getPresignedUrl,
  normalizeMediaUrl,
  loadObjectStorageMedia,
};