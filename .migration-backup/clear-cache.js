/**
 * Cache clearing script for banner slides and other media
 * This script thoroughly cleans all browser caches related to media content
 */

function clearMediaCache() {
  try {
    // Clear localStorage cache entries
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('banner') || 
        key.includes('media') || 
        key.includes('cache') ||
        key.includes('storage')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`Removed cache key: ${key}`);
    });
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    console.log(`Cache clearing complete - cleared ${keysToRemove.length} items`);
    
    // Force reload banner components if they exist
    if (window.dispatchEvent) {
      window.dispatchEvent(new Event('cache-cleared'));
    }
    
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

// Auto-run cache clearing
console.log('Running cache clearing script...');
clearMediaCache();