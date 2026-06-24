/**
 * Banner Cache Manager
 * 
 * Provides utilities for managing banner image/video caches and path normalization.
 * This helps prevent issues with stale cached images and ensures consistent path formats.
 */

interface CacheResults {
  localStorage: string[];
  sessionStorage: string[];
  memoryCache: string[];
  imageCache: string[];
}

// Global map to track what paths we've tried for each source
declare global {
  interface Window {
    globalTriedPathsCache: Map<string, Set<string>>;
    loadingVideos: Set<string>;
    inMemoryMediaCache: Map<string, any>;
    __forceReloadBanners: boolean;
    __lastCacheClear: string;
    __cacheBustParam: number;
  }
}

/**
 * Clear all banner and media related caches
 * @returns Cache clearing results summary
 */
export function clearMediaCache(): CacheResults | number {
  console.log("Running cache clearing script...");
  
  const clearedItems: CacheResults = {
    localStorage: [],
    sessionStorage: [],
    memoryCache: [],
    imageCache: []
  };
  
  // Clear localStorage cache entries
  if (typeof window !== 'undefined' && window.localStorage) {
    // Find all cache entries related to media
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
          key.includes('banner') || 
          key.includes('media-cache:') ||
          key.includes('image-') ||
          key.includes('uploads') ||
          key.includes('community') ||
          key.includes('carousel') ||
          key.includes('slide')
        )) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all found keys
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
        clearedItems.localStorage.push(key);
      } catch (e) {
        console.error(`Error clearing localStorage item ${key}:`, e);
      }
    });
    
    console.log(`Cleared ${keysToRemove.length} cached items from localStorage`);
  }
  
  // Clear sessionStorage cache entries
  if (typeof window !== 'undefined' && window.sessionStorage) {
    // Find all cache entries related to media
    const keysToRemove = [];
    
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (
          key.includes('banner') || 
          key.includes('media') ||
          key.includes('image') ||
          key.includes('upload') ||
          key.includes('community') ||
          key.includes('slide')
        )) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all found keys
    keysToRemove.forEach(key => {
      try {
        sessionStorage.removeItem(key);
        clearedItems.sessionStorage.push(key);
      } catch (e) {
        console.error(`Error clearing sessionStorage item ${key}:`, e);
      }
    });
  }
  
  // Reset any global cache maps that might exist on window
  if (typeof window !== 'undefined') {
    try {
      // Reset global component cache maps if they exist
      if (window.globalTriedPathsCache) {
        window.globalTriedPathsCache.clear();
        clearedItems.memoryCache.push('globalTriedPathsCache');
      }
      
      // Reset in-memory media cache
      if (window.inMemoryMediaCache) {
        window.inMemoryMediaCache.clear();
        clearedItems.memoryCache.push('inMemoryMediaCache');
      }
      
      // Reset loading videos set
      if (window.loadingVideos) {
        window.loadingVideos.clear();
        clearedItems.memoryCache.push('loadingVideos');
      }
    } catch (e) {
      console.error('Error clearing memory caches:', e);
    }
    
    // Set flags to force reloading of banners
    window.__forceReloadBanners = true;
    window.__lastCacheClear = new Date().toISOString();
    window.__cacheBustParam = Date.now();
  }
  
  // Report comprehensive summary
  const totalCleared = 
    clearedItems.localStorage.length + 
    clearedItems.sessionStorage.length + 
    clearedItems.memoryCache.length +
    clearedItems.imageCache.length;
  
  console.log("Cache clearing complete - errors should be resolved on next page refresh.");
  
  return clearedItems;
}

/**
 * Add cache busting parameter to a URL to force refresh
 * @param url The URL to add cache busting to
 * @returns URL with cache busting parameter
 */
export function addCacheBustingParam(url: string): string {
  if (!url) return url;
  
  const cacheBuster = typeof window !== 'undefined' && window.__cacheBustParam 
    ? window.__cacheBustParam 
    : Date.now();
  
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_cb=${cacheBuster}`;
}

/**
 * Normalize a banner media URL to use the preferred format
 * @param url The URL to normalize
 * @param preferObjectStorage Whether to prefer Object Storage paths over filesystem paths
 * @returns Normalized URL
 */
export function normalizeBannerUrl(url: string, preferObjectStorage = true): string {
  if (!url) return url;
  
  // Skip non-banner-related content
  if (!url.includes('banner-slides') && 
      !url.includes('banner') && 
      !url.includes('carousel')) {
    return url;
  }
  
  let normalizedUrl = url;
  
  // Convert old path format to new format
  if (url.includes('/uploads/banner-slides/') && preferObjectStorage) {
    // Extract the filename from the path
    const filename = url.split('/').pop();
    if (filename) {
      // Use direct banner endpoint for most reliable access
      normalizedUrl = `/direct-banner/${filename}`;
    }
  }
  
  // For Object Storage URLs, convert to our proxy to avoid CORS issues
  if (url.includes('object-storage.replit.app')) {
    const urlParts = url.split('object-storage.replit.app/');
    if (urlParts.length > 1) {
      const parts = urlParts[1].split('/');
      if (parts.length >= 2) {
        const bucket = parts[0];
        const filepath = parts.slice(1).join('/');
        normalizedUrl = `/api/storage-proxy/${bucket}/${filepath}`;
      }
    }
  }
  
  // Add cache busting parameter
  return addCacheBustingParam(normalizedUrl);
}

/**
 * Get image dimensions from a URL by loading it in-memory
 * @param url The image URL to check
 * @returns Promise resolving to image dimensions or null on failure
 */
export function getImageDimensions(url: string): Promise<{width: number, height: number} | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    
    const img = new Image();
    let timeoutId: NodeJS.Timeout;
    
    // Set a timeout to prevent hanging
    timeoutId = setTimeout(() => {
      console.warn(`Timeout getting dimensions for: ${url}`);
      resolve(null);
    }, 5000);
    
    img.onload = () => {
      clearTimeout(timeoutId);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    
    img.onerror = () => {
      clearTimeout(timeoutId);
      console.warn(`Failed to load image for dimensions: ${url}`);
      resolve(null);
    };
    
    // Add cache busting to prevent using cached versions
    img.src = addCacheBustingParam(url);
  });
}