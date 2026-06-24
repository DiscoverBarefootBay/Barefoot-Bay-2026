/**
 * Emergency cache-busting script to fix banner slide URL format issue
 * This script forces a complete refresh of banner slide data
 */

// Clear all possible caches
function forceCacheClear() {
  console.log('🔧 [CACHE FIX] Starting emergency cache clear...');
  
  // Clear localStorage
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('banner') || key.includes('community') || key.includes('slides'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`🔧 [CACHE FIX] Removed localStorage key: ${key}`);
  });
  
  // Clear sessionStorage
  const sessionKeysToRemove = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && (key.includes('banner') || key.includes('community') || key.includes('slides'))) {
      sessionKeysToRemove.push(key);
    }
  }
  
  sessionKeysToRemove.forEach(key => {
    sessionStorage.removeItem(key);
    console.log(`🔧 [CACHE FIX] Removed sessionStorage key: ${key}`);
  });
  
  // Force page reload to get fresh data
  console.log('🔧 [CACHE FIX] Forcing page reload to fetch fresh data...');
  window.location.reload(true);
}

// Execute the cache clear
forceCacheClear();