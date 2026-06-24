/**
 * Script for clearing banner slide cache in the browser
 * This script should be added to an HTML page or run in the browser console
 */

function clearBannerCache() {
  console.log('Starting banner cache clearing process...');
  
  // Clear localStorage cache for banner slides
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && 
        (key.includes('media-cache:') || 
         key.includes('communityBannerSlides') || 
         key.includes('banner-slide'))) {
      keysToRemove.push(key);
    }
  }
  
  console.log(`Found ${keysToRemove.length} cache entries to remove`);
  
  // Remove all identified keys
  keysToRemove.forEach(key => {
    console.log(`Removing cached item: ${key}`);
    localStorage.removeItem(key);
  });
  
  // Clear sessionStorage too
  const sessionKeysToRemove = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && 
        (key.includes('media-cache:') || 
         key.includes('communityBannerSlides') || 
         key.includes('banner-slide'))) {
      sessionKeysToRemove.push(key);
    }
  }
  
  console.log(`Found ${sessionKeysToRemove.length} session cache entries to remove`);
  
  // Remove all identified session keys
  sessionKeysToRemove.forEach(key => {
    console.log(`Removing session cached item: ${key}`);
    sessionStorage.removeItem(key);
  });
  
  // Clear any in-memory caches that might be defined
  if (window.inMemoryMediaCache) {
    console.log('Clearing in-memory media cache');
    window.inMemoryMediaCache.clear();
  }
  
  // Set a flag to force reload content on next visit
  localStorage.setItem('force-banner-reload', Date.now().toString());
  
  console.log('Cache clearing complete - banner content will be refreshed on next page load');
  
  // Reload the page to see changes
  if (confirm('Cache cleared. Reload the page to see changes?')) {
    window.location.reload(true);
  }
}

// Create a button to run the cache clearing
function addClearCacheButton() {
  const button = document.createElement('button');
  button.textContent = 'Clear Banner Cache';
  button.style.position = 'fixed';
  button.style.top = '10px';
  button.style.right = '10px';
  button.style.zIndex = '9999';
  button.style.padding = '8px 12px';
  button.style.backgroundColor = '#f44336';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.borderRadius = '4px';
  button.style.cursor = 'pointer';
  
  button.addEventListener('click', clearBannerCache);
  
  document.body.appendChild(button);
  console.log('Cache clear button added to page');
}

// Run the cache clearing function
clearBannerCache();

// Add the button for future use
addClearCacheButton();