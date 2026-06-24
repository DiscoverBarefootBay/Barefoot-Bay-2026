/**
 * Enhanced cache clearing script for banner slides and other media
 * This script thoroughly cleans all browser caches related to media content
 * 
 * Features:
 * - Clears localStorage cache entries
 * - Clears sessionStorage cache entries
 * - Resets any global cache maps used by React components
 * - Sets flags to force reloading of content
 * - Provides diagnostic information
 */

function clearMediaCache() {
  console.log("[MediaCache] Running cache clearing...");
  const clearedItems = {
    localStorage: [],
    sessionStorage: [],
    memoryCache: [],
    imageCache: []
  };
  
  // Clear localStorage cache entries
  if (window.localStorage) {
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
        console.log(`[MediaCache] Cleared localStorage item: ${key}`);
      } catch (e) {
        console.error(`[MediaCache] Error clearing localStorage item ${key}:`, e);
      }
    });
  }
  
  // Clear sessionStorage cache entries
  if (window.sessionStorage) {
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
        console.log(`[MediaCache] Cleared sessionStorage item: ${key}`);
      } catch (e) {
        console.error(`[MediaCache] Error clearing sessionStorage item ${key}:`, e);
      }
    });
  }
  
  // Reset any global cache maps that might exist on window
  try {
    // Reset global component cache maps if they exist
    if (window.globalTriedPathsCache) {
      window.globalTriedPathsCache.clear();
      clearedItems.memoryCache.push('globalTriedPathsCache');
      console.log('[MediaCache] Cleared global tried paths cache');
    }
    
    // Reset in-memory media cache
    if (window.inMemoryMediaCache) {
      window.inMemoryMediaCache.clear();
      clearedItems.memoryCache.push('inMemoryMediaCache');
      console.log('[MediaCache] Cleared in-memory media cache');
    }
    
    // Reset loading videos set
    if (window.loadingVideos) {
      window.loadingVideos.clear();
      clearedItems.memoryCache.push('loadingVideos');
      console.log('[MediaCache] Cleared loading videos set');
    }
  } catch (e) {
    console.error('[MediaCache] Error clearing memory caches:', e);
  }
  
  // Set flags to force reloading of banners
  window.__forceReloadBanners = true;
  window.__lastCacheClear = new Date().toISOString();
  window.__cacheBustParam = Date.now();
  
  // Report comprehensive summary
  const totalCleared = 
    clearedItems.localStorage.length + 
    clearedItems.sessionStorage.length + 
    clearedItems.memoryCache.length +
    clearedItems.imageCache.length;
  
  console.log("[MediaCache] Cache clearing completed");
  console.log(`[MediaCache] Cleared ${totalCleared} items total`);
  
  return clearedItems;
}

function addCacheClearButton() {
  // Don't add button if it already exists
  if (document.getElementById('clear-media-cache-button')) {
    return;
  }
  
  // Create the button
  const button = document.createElement('button');
  button.id = 'clear-media-cache-button';
  button.innerText = 'Clear Media Cache';
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    background-color: #4a5568;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
  `;
  
  // Add hover effects
  button.onmouseenter = function() {
    this.style.backgroundColor = '#2d3748';
  };
  button.onmouseleave = function() {
    this.style.backgroundColor = '#4a5568';
  };
  
  // Add click handler
  button.onclick = function() {
    const results = clearMediaCache();
    
    // Show results as a notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 70px;
      right: 20px;
      z-index: 9999;
      background-color: #48bb78;
      color: white;
      border-radius: 4px;
      padding: 12px;
      font-size: 14px;
      max-width: 300px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      animation: fadeIn 0.3s, fadeOut 0.3s 3s forwards;
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-10px); }
      }
    `;
    document.head.appendChild(style);
    
    // Create notification content
    let itemCount = 0;
    let content = '<strong>Cache Cleared!</strong><br>';
    
    if (typeof results === 'object' && results !== null) {
      Object.keys(results).forEach(key => {
        const count = results[key].length;
        itemCount += count;
        if (count > 0) {
          content += `${key}: ${count} items<br>`;
        }
      });
    } else {
      itemCount = results;
      content += `Cleared ${itemCount} items`;
    }
    
    notification.innerHTML = content;
    
    // Add a reload button if items were cleared
    if (itemCount > 0) {
      const reloadButton = document.createElement('button');
      reloadButton.innerText = 'Reload Page';
      reloadButton.style.cssText = `
        background-color: white;
        color: #2d3748;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        margin-top: 8px;
        font-size: 12px;
        cursor: pointer;
      `;
      reloadButton.onclick = function() {
        window.location.reload();
      };
      notification.appendChild(reloadButton);
    }
    
    document.body.appendChild(notification);
    
    // Remove notification after 4 seconds
    setTimeout(() => {
      notification.remove();
    }, 4000);
  };
  
  // Add the button to the page
  document.body.appendChild(button);
  
  console.log('[MediaCache] Cache clear button added to page');
}

// Cache clear button is now disabled and won't be automatically added
// The function is still available via console if needed for debugging
/*
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(addCacheClearButton, 1000);
} else {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(addCacheClearButton, 1000);
  });
}
*/

// Expose the function globally so it can be called from the console
window.clearMediaCache = clearMediaCache;
window.addCacheClearButton = addCacheClearButton;