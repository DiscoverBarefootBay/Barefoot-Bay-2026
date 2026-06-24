/**
 * Media Cache and Optimization Utility Functions
 * 
 * This module provides browser-compatible techniques for media optimization
 * without requiring service workers, which may not be available in all environments.
 */

// Global media cache - memory cache for the current session
const inMemoryMediaCache = new Map<string, string>();

/**
 * Safe wrapper for localStorage access
 */
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('Error accessing localStorage:', e);
      return null;
    }
  },
  setItem: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn('Error writing to localStorage:', e);
      return false;
    }
  },
  removeItem: (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn('Error removing from localStorage:', e);
      return false;
    }
  }
};

/**
 * Cache a media URL in both localStorage and memory
 * @param url - The URL to cache
 * @param data - The data URL or blob URL
 */
export const cacheMedia = (url: string, data: string): void => {
  try {
    // Only cache if the URL is for media
    if (isMediaUrl(url)) {
      // Add to memory cache first
      inMemoryMediaCache.set(url, data);
      
      // Try to store in localStorage, but handle quota exceeded errors
      // First try to remove any existing entries for this URL
      safeLocalStorage.removeItem(`media-cache:${url}`);
      safeLocalStorage.removeItem(`media-cache:${url}-timestamp`);
      
      // Add the data and timestamp
      if (!safeLocalStorage.setItem(`media-cache:${url}`, data)) {
        // Clear old entries if we hit storage limits
        clearOldMediaCache();
        
        // Try again after clearing
        safeLocalStorage.setItem(`media-cache:${url}`, data);
        safeLocalStorage.setItem(`media-cache:${url}-timestamp`, Date.now().toString());
      } else {
        safeLocalStorage.setItem(`media-cache:${url}-timestamp`, Date.now().toString());
      }
    }
  } catch (e) {
    console.warn('Error caching media:', e);
  }
};

/**
 * Get a cached media URL if available
 * @param url - The URL to check
 * @returns The cached data URL or undefined if not cached
 */
export const getCachedMedia = (url: string): string | undefined => {
  // Check memory cache first (fastest)
  if (inMemoryMediaCache.has(url)) {
    return inMemoryMediaCache.get(url);
  }
  
  // Then check localStorage
  const cached = safeLocalStorage.getItem(`media-cache:${url}`);
  if (cached) {
    // If found in localStorage, add to memory cache for faster access next time
    inMemoryMediaCache.set(url, cached);
    return cached;
  }
  
  return undefined;
};

/**
 * Clear old media cache entries when we're running out of space
 * 
 * This version is more aggressive in clearing cache entries when quota is exceeded:
 * 1. First tries to clear entries older than 7 days
 * 2. If no entries were cleared, clears entries older than 1 day
 * 3. If still no entries, clears a percentage of all cache entries
 */
export const clearOldMediaCache = (): void => {
  try {
    let keysToRemove: string[] = [];
    const cacheKeys: string[] = [];
    
    try {
      // Collect all media cache keys first
      for (let i = 0; i < localStorage.length; i++) {
        try {
          const key = localStorage.key(i);
          if (key && key.startsWith('media-cache:') && !key.endsWith('-timestamp')) {
            cacheKeys.push(key);
          }
        } catch (e) {
          // Skip this key if there's an error
          console.warn('Error accessing localStorage key:', e);
        }
      }
    } catch (e) {
      console.warn('Error iterating through localStorage:', e);
      return; // Exit early if we can't even access localStorage
    }
    
    if (cacheKeys.length === 0) {
      console.log('No media cache entries to clear');
      return;
    }
    
    // 1. Try to remove entries older than 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const key of cacheKeys) {
      const timestamp = safeLocalStorage.getItem(`${key}-timestamp`);
      if (timestamp && parseInt(timestamp, 10) < sevenDaysAgo) {
        keysToRemove.push(key);
      }
    }
    
    // 2. If no old entries found, try 1 day old entries
    if (keysToRemove.length === 0) {
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      for (const key of cacheKeys) {
        const timestamp = safeLocalStorage.getItem(`${key}-timestamp`);
        if (timestamp && parseInt(timestamp, 10) < oneDayAgo) {
          keysToRemove.push(key);
        }
      }
    }
    
    // 3. If still no entries to remove, take the oldest 30% of entries
    // or entries without timestamps (which means they're in an inconsistent state)
    if (keysToRemove.length === 0) {
      const timestampedKeys: Array<{key: string; timestamp: number}> = [];
      const unstampedKeys: string[] = [];
      
      for (const key of cacheKeys) {
        const timestamp = safeLocalStorage.getItem(`${key}-timestamp`);
        if (timestamp) {
          timestampedKeys.push({
            key,
            timestamp: parseInt(timestamp, 10)
          });
        } else {
          // Keys without timestamps are prioritized for removal
          unstampedKeys.push(key);
        }
      }
      
      // First add all unstamped keys
      keysToRemove = [...unstampedKeys];
      
      // Sort by timestamp (oldest first) and take 30% of them
      if (timestampedKeys.length > 0) {
        timestampedKeys.sort((a, b) => a.timestamp - b.timestamp);
        const oldestCount = Math.ceil(timestampedKeys.length * 0.3);
        keysToRemove = [
          ...keysToRemove,
          ...timestampedKeys.slice(0, oldestCount).map(item => item.key)
        ];
      }
    }
    
    // Remove keys
    keysToRemove.forEach(key => {
      safeLocalStorage.removeItem(key);
      safeLocalStorage.removeItem(`${key}-timestamp`);
      
      // Also remove from memory cache
      const url = key.replace('media-cache:', '');
      inMemoryMediaCache.delete(url);
    });
    
    console.log(`Cleared ${keysToRemove.length} old media cache entries`);
  } catch (e) {
    console.warn('Error clearing old cache:', e);
  }
};

/**
 * Check if a URL is for a media file
 * @param url - The URL to check
 * @returns True if the URL is for a media file
 */
export const isMediaUrl = (url: string): boolean => {
  if (!url) return false;
  
  const mediaExtensions = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 
    'mp4', 'webm', 'ogg', 'mov',
    'mp3', 'wav', 'aac', 'flac', 'm4a'
  ];
  
  const lowercaseUrl = url.toLowerCase();
  
  // Check for file extension
  const hasMediaExtension = mediaExtensions.some(ext => 
    lowercaseUrl.endsWith(`.${ext}`)
  );
  
  // Check for typical media paths
  const hasMediaPath = [
    '/uploads/', 
    '/images/', 
    '/media/', 
    '/videos/',
    '/banner-slides/',
    '/calendar/',
    '/forum-media/',
    '/vendor-media/',
    '/community-media/',
    '/content-media/',
    '/avatars/',
    '/icons/',
    '/products/',
    '/attached_assets/'
  ].some(path => lowercaseUrl.includes(path));
  
  // Also check for media filenames without proper paths
  const hasMediaPattern = lowercaseUrl.includes('bannerimage-') || 
                          lowercaseUrl.includes('media-');
  
  return hasMediaExtension || hasMediaPath || hasMediaPattern;
};

/**
 * Normalize a media URL to ensure it works in all environments
 * @param url - The URL to normalize
 * @returns Normalized URL
 */
export const normalizeMediaUrl = (url: string): string => {
  if (!url) return '/public/media-placeholder/default-image.svg';
  
  // Remove console logging to reduce noise
  // console.log("Normalizing URL:", url);
    
  // If the URL is already absolute, don't modify it
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // IMPORTANT FIX: Handle attached_assets media specifically
  // Convert it to forum-media path for consistency across environments
  if (url.startsWith('/attached_assets/')) {
    const fileName = url.replace('/attached_assets/', '');
    const forumMediaUrl = `/forum-media/${fileName}`;
    console.log("Converting attached_assets to forum-media path:", url, "->", forumMediaUrl);
    return forumMediaUrl;
  }

  // CRITICAL FIX: Handle Object Storage proxy URLs correctly - DON'T add /uploads/ prefix
  // This includes BANNER, COMMUNITY, FORUM, VENDORS, REAL_ESTATE, and all other storage-proxy URLs
  if (url.includes('/api/storage-proxy/') || url.includes('api/storage-proxy/')) {
    // These are already correct Object Storage proxy URLs - return as-is
    console.log("Object Storage proxy URL detected, using as-is:", url);
    return url.startsWith('/') ? url : `/${url}`;
  }
  
  // Handle vendor media URLs specifically
  if (url.includes('vendor-media') || url.includes('/vendors/media/')) {
    // Check if it's already using the storage proxy
    if (url.includes('/api/storage-proxy/direct-vendors/')) {
      console.log("Already using direct-vendors proxy format:", url);
      return url;
    }
    
    // Extract filename from various vendor media path formats
    let fileName = url;
    if (url.startsWith('/uploads/vendor-media/')) {
      fileName = url.replace('/uploads/vendor-media/', '');
    } else if (url.startsWith('/vendor-media/')) {
      fileName = url.replace('/vendor-media/', '');
    } else if (url.includes('/vendors/media/')) {
      const parts = url.split('/vendors/media/');
      fileName = parts[parts.length - 1];
    }
    
    // Convert to storage proxy format for vendors
    const vendorProxyUrl = `/api/storage-proxy/direct-vendors/${fileName}`;
    console.log("Converting vendor media to storage proxy URL:", url, "->", vendorProxyUrl);
    return vendorProxyUrl;
  }

  // Force bannerImage files to use /uploads/banner-slides/ or /banner-slides/ path consistently
  // This is critical to ensure proper display in both dev and prod
  if (url.includes('bannerImage-')) {
    // Handle different path formats
    if (url.startsWith('/uploads/banner-slides/')) {
      // Already in the preferred format
      console.log("Banner URL already in uploads format:", url);
      return url;
    } else if (url.startsWith('/banner-slides/')) {
      // Convert /banner-slides/ to /uploads/banner-slides/ for consistent handling
      const fileName = url.replace('/banner-slides/', '');
      const normalizedUrl = `/uploads/banner-slides/${fileName}`;
      console.log("Converted banner URL from production to uploads format:", url, "->", normalizedUrl);
      
      // ALWAYS use the uploads path format regardless of whether the file exists
      // This ensures consistent behavior across environments
      return normalizedUrl;
    } else if (url.startsWith('bannerImage-')) {
      // Bare filename without path, add the path
      const normalizedUrl = `/uploads/banner-slides/${url}`;
      console.log("Added path to bare banner filename:", url, "->", normalizedUrl);
      return normalizedUrl;
    }
  }
  
  // CRITICAL FIX: Priority handling for Object Storage URLs from direct-forum or api/storage-proxy
  // This is essential for properly displaying thumbnails in the rich text editor
  if (url.includes('api/storage-proxy/FORUM/') || 
      url.includes('api/storage-proxy/direct-forum/') ||
      url.includes('media-') && (url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg'))) {
    
    // For already normalized URLs that use the recommended formats, return as-is
    if (url.startsWith('/api/storage-proxy/direct-forum/')) {
      console.log("Already using direct-forum proxy format:", url);
      return url;
    }
    
    // For standard Object Storage proxy URLs, convert to direct-forum format
    if (url.startsWith('/api/storage-proxy/FORUM/')) {
      const fileName = url.replace('/api/storage-proxy/FORUM/', '').replace('forum/', '');
      const directForumUrl = `/api/storage-proxy/direct-forum/${fileName}`;
      console.log("Converting FORUM storage URL to direct-forum URL:", url, "->", directForumUrl);
      return directForumUrl;
    }
    
    // Extract just the filename if it's a media-timestamp filename pattern
    if (url.includes('media-') && (
      url.includes('.png') || 
      url.includes('.jpg') || 
      url.includes('.jpeg') || 
      url.includes('.mp3') || 
      url.includes('.wav') || 
      url.includes('.ogg') || 
      url.includes('.aac') ||
      url.includes('.mp4') ||
      url.includes('.webm')
    )) {
      const parts = url.split('/');
      const fileName = parts[parts.length - 1];
      const directForumUrl = `/api/storage-proxy/direct-forum/${fileName}`;
      console.log("Converting filename to direct-forum URL:", url, "->", directForumUrl);
      return directForumUrl;
    }
  }
  
  // Handle standard forum media - ALWAYS use /forum-media/ path format for file storage
  // This is necessary for consistent display in both dev and prod environments
  const isForumMedia = url.includes('forum-') || url.includes('mediaFile-') || url.includes('image_');
  
  if (isForumMedia && !url.includes('api/storage-proxy/')) {
    // Get just the filename regardless of the current path format
    let fileName = url;
    
    // Handle various path formats
    if (url.startsWith('/uploads/forum-media/')) {
      fileName = url.replace('/uploads/forum-media/', '');
    } else if (url.startsWith('/forum-media/')) {
      fileName = url.replace('/forum-media/', '');
    } else if (url.startsWith('/uploads/')) {
      fileName = url.replace('/uploads/', '');
    } else if (url.startsWith('/')) {
      fileName = url.substring(1);
    }
    
    // Always use the forum-media path for consistency
    const normalizedUrl = `/forum-media/${fileName}`;
    console.log("Standardized forum media path:", url, "->", normalizedUrl);
    return normalizedUrl;
  }
  
  // Handle real estate media specifically
  if (url.includes('real-estate-media') || url.includes('property-media')) {
    let fileName = url;
    
    // Get just the filename
    if (url.startsWith('/uploads/real-estate-media/')) {
      fileName = url.replace('/uploads/real-estate-media/', '');
    } else if (url.startsWith('/real-estate-media/')) {
      fileName = url.replace('/real-estate-media/', '');
    } else if (url.includes('/real-estate-media/')) {
      const parts = url.split('/real-estate-media/');
      fileName = parts[parts.length - 1];
    }
    
    // Use object storage path for consistency
    const normalizedUrl = `/api/real-estate-media/${fileName}`;
    console.log("Using object storage path for real estate media:", url, "->", normalizedUrl);
    return normalizedUrl;
  }
    
  // If the path is already using uploads, don't modify it
  if (url.startsWith('/uploads/')) {
    return url;
  }
  
  // Handle production path directories - keep them as is
  const productionPaths = [
    '/banner-slides/',
    '/calendar/',
    '/forum-media/',
    '/content-media/',
    '/vendor-media/',
    '/community-media/',
    '/avatars/',
    '/icons/',
    '/Real Estate/',
    '/products/'
  ];
  
  for (const prodPath of productionPaths) {
    if (url.startsWith(prodPath)) {
      // First try loading with /uploads/ path as that's more reliable in dev
      const withUploads = `/uploads${url}`;
      console.log("Converting production path to uploads path:", withUploads);
      return withUploads;
    }
  }
    
  // Handle media IDs without proper path
  if (url.startsWith('media-')) {
    return `/uploads/media/${url}`;
  }
  
  // Special case for AI-generated image names
  if (url.includes('ChatGPT Image') || url.match(/^(?:\/)?ChatGPT\sImage/i)) {
    // For AI-generated images with dates in the name (e.g., "ChatGPT Image Mar 27, 2025, 08_56_09 PM")
    return `/uploads/generated/${url.replace(/^\//, '')}`;
  }
  
  // Legacy: Handle old-style URLs that might just have the filename without any path
  if (url.startsWith('/') && !url.includes('/')) {
    // Just a filename with a leading slash
    return `/uploads/media${url}`;
  } else if (!url.startsWith('/')) {
    // Filename without even a leading slash
    return `/uploads/media/${url}`;
  }
    
  // For any other path formats, try adding /uploads/
  return `/uploads${url}`;
};

/**
 * Prefetch important media assets
 * @param urls - Array of URLs to prefetch
 */
export const prefetchCriticalMedia = (urls: string[]): void => {
  if (typeof window === 'undefined') return;
  
  const prefetch = () => {
    urls.forEach(url => {
      // Check if already cached
      if (getCachedMedia(url)) return;
      
      // Create link for browser prefetching
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      link.as = url.match(/\.(mp4|webm|ogg|mov)$/i) ? 'video' : 'image';
      document.head.appendChild(link);
      
      // For images, also try to load and cache them
      if (!url.match(/\.(mp4|webm|ogg|mov)$/i)) {
        const img = new Image();
        img.src = url;
        img.onload = () => {
          // Mark as cached in localStorage with timestamp
          safeLocalStorage.setItem(`media-cache:${url}-timestamp`, Date.now().toString());
        };
      }
    });
  };
  
  // Wait for idle time or use setTimeout as fallback
  if (window.requestIdleCallback) {
    window.requestIdleCallback(prefetch, { timeout: 2000 });
  } else {
    setTimeout(prefetch, 1000);
  }
};

/**
 * Initialize the media optimization system
 */
export const initMediaCache = (): void => {
  // Prefetch critical assets
  prefetchCriticalMedia([
    '/uploads/banner-slides/placeholder-banner.png',
    '/uploads/background-image-placeholder.jpg'
  ]);
  
  // Clean up old cache entries on initialization
  clearOldMediaCache();
  
  // Set up periodic cache cleanup
  const ONE_DAY = 24 * 60 * 60 * 1000;
  setInterval(clearOldMediaCache, ONE_DAY);
  
  console.log('Media optimization initialized');
};

// Export a default function to initialize everything
export default initMediaCache;