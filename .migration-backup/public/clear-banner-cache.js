/**
 * Script to help users clear their browser cache for banner slides
 * This can be included on any page that needs to clear image caches
 */
function clearBannerCache() {
  console.log('Running banner cache clearing script...');
  const clearedItems = [];
  
  // Clear localStorage cache entries
  if (window.localStorage) {
    // Find all cache entries related to banner slides
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
          key.includes('banner-slides') || 
          key.includes('bannerImage') ||
          key.includes('media-cache:/')
        )) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all found keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      clearedItems.push(key);
      console.log(`Cleared cached item: ${key}`);
    });
  }
  
  // Set a flag to force reloading of banners
  window.__forceReloadBanners = true;
  
  // Create and dispatch a custom event that components can listen for
  const event = new CustomEvent('bannercachecleared', { 
    detail: { 
      timestamp: new Date().toISOString(),
      itemsCleared: clearedItems.length
    } 
  });
  window.dispatchEvent(event);
  
  console.log(`Cleared ${clearedItems.length} cached items`);
  console.log('Banner cache clearing complete!');
  
  return clearedItems.length;
}

// Export for use as a module
if (typeof module !== 'undefined') {
  module.exports = { clearBannerCache };
}