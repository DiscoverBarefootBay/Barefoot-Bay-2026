/**
 * Utility to help clear media cache for banner slides and other media
 * This helps during development and when media sources change
 */

/**
 * Clear media cache for specific paths
 * @param paths Array of paths to clear from cache
 */
export function clearMediaCache(paths: string[] = []) {
  // Default paths to clear
  const defaultPaths = [
    '/uploads/banner-slides/placeholder-banner.png',
    '/public/banner-placeholder.jpg'
  ];
  
  // Combine default and custom paths
  const pathsToClear = [...defaultPaths, ...paths];
  
  // Check if localStorage is available (client-side only)
  if (typeof window !== 'undefined' && window.localStorage) {
    console.log('Running cache clearing script...');
    let clearedCount = 0;
    
    // Get all localStorage keys
    const keys = Object.keys(window.localStorage);
    
    // Loop through all keys and remove those matching our patterns
    keys.forEach(key => {
      // Check for media cache keys
      if (key.startsWith('media-cache:')) {
        // Check if this key matches any of our target paths
        const shouldClear = pathsToClear.some(path => key.includes(path));
        
        // Check for banner slides
        const isBannerSlide = key.includes('banner-slides') || key.includes('banner-slide');
        
        if (shouldClear || isBannerSlide) {
          // Remove the item from localStorage
          window.localStorage.removeItem(key);
          console.log(`Cleared cached item: ${key}`);
          clearedCount++;
        }
      }
    });
    
    console.log(`Cleared ${clearedCount} cached items from localStorage`);
    console.log('Cache clearing complete!');
    
    return clearedCount;
  }
  
  // Not in browser or localStorage not available
  return 0;
}

/**
 * Clear media cache for all image-related paths
 */
export function clearAllImageCache() {
  // Check if localStorage is available (client-side only)
  if (typeof window !== 'undefined' && window.localStorage) {
    console.log('Clearing all image cache...');
    let clearedCount = 0;
    
    // Get all localStorage keys
    const keys = Object.keys(window.localStorage);
    
    // Loop through all keys and remove those matching our patterns
    keys.forEach(key => {
      // Check for media cache keys
      if (key.startsWith('media-cache:')) {
        // Remove the item from localStorage
        window.localStorage.removeItem(key);
        console.log(`Cleared cached item: ${key}`);
        clearedCount++;
      }
    });
    
    console.log(`Cleared ${clearedCount} cached items from localStorage`);
    console.log('Cache clearing complete!');
    
    return clearedCount;
  }
  
  // Not in browser or localStorage not available
  return 0;
}

export default clearMediaCache;