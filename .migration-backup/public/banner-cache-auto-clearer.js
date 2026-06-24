/**
 * Automatic Banner Cache Clearer
 * 
 * This script automatically clears banner-related caches
 * when included in a page. It runs immediately upon loading
 * and helps solve caching issues with banner slide media.
 */

(function() {
  // Function to check if we're on a page that displays banners
  function isOnBannerDisplayPage() {
    return window.location.pathname === "/" ||
           window.location.pathname.includes("/home") ||
           window.location.pathname.includes("/dashboard");
  }
  
  // Only run on pages that display banners
  if (isOnBannerDisplayPage()) {
    console.log("Running banner cache auto-clearer...");
    
    // Clear localStorage cache for banner-related media
    let clearedCount = 0;
    
    if (window.localStorage) {
      // Find and remove banner-related entries
      const keysToRemove = [];
      
      // Gather all keys first to avoid modification during iteration
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key && (
            key.includes('banner-slides') || 
            key.includes('bannerImage') ||
            (key.includes('media-cache') && key.includes('/uploads/banner-slides'))
          )) {
          keysToRemove.push(key);
        }
      }
      
      // Now remove the keys
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        clearedCount++;
        console.log(`Auto-cleared cache: ${key}`);
      });
    }
    
    // Set a flag to force fresh media loading
    window.__forceReloadBanners = true;
    window.__lastBannerCacheClear = new Date().toISOString();
    
    // Only log if we found items to clear
    if (clearedCount > 0) {
      console.log(`Banner cache auto-clearer removed ${clearedCount} cached items`);
    }
    
    // Create and dispatch a custom event that components can listen for
    const event = new CustomEvent('bannercachecleared', { 
      detail: { 
        automatic: true,
        timestamp: new Date().toISOString(),
        itemsCleared: clearedCount
      } 
    });
    window.dispatchEvent(event);
  }
})();