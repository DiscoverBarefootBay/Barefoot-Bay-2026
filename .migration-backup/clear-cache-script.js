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
  console.log('Running cache clearing script...');
  let clearedCount = 0;
  
  // Clear all banner-related localStorage items
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
          key.includes('banner') || 
          key.includes('slide') || 
          key.includes('media') ||
          key.includes('cache') ||
          key.includes('image') ||
          key.includes('video') ||
          key.includes('tinymce') || // Add TinyMCE-related caches
          key.includes('editor')
        )) {
        console.log(`Clearing localStorage item: ${key}`);
        localStorage.removeItem(key);
        clearedCount++;
      }
    }
    console.log(`Cleared ${clearedCount} cached items from localStorage`);
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
  
  // Clear sessionStorage items that might be related to media
  try {
    let sessionClearedCount = 0;
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (
          key.includes('banner') || 
          key.includes('slide') || 
          key.includes('media') ||
          key.includes('cache') ||
          key.includes('image') ||
          key.includes('video') ||
          key.includes('tinymce') || // Add TinyMCE-related caches
          key.includes('editor')
        )) {
        console.log(`Clearing sessionStorage item: ${key}`);
        sessionStorage.removeItem(key);
        sessionClearedCount++;
      }
    }
    if (sessionClearedCount > 0) {
      console.log(`Cleared ${sessionClearedCount} cached items from sessionStorage`);
    }
  } catch (error) {
    console.error('Error clearing sessionStorage:', error);
  }
  
  // Force reload any React Query cache
  try {
    if (window.__REACT_QUERY_GLOBAL_CACHE__) {
      window.__REACT_QUERY_GLOBAL_CACHE__.clear();
      console.log('Cleared React Query cache');
    }
  } catch (error) {
    console.error('Error clearing React Query cache:', error);
  }
  
  // Try to reset TinyMCE if it's loaded
  try {
    if (window.tinymce) {
      console.log('TinyMCE detected, attempting to refresh editors');
      window.tinymce.editors.forEach(editor => {
        try {
          // Refresh content from the textarea
          editor.load();
          console.log(`Refreshed TinyMCE editor: ${editor.id}`);
        } catch (e) {
          console.error(`Error refreshing TinyMCE editor ${editor.id}:`, e);
        }
      });
    }
  } catch (error) {
    console.error('Error handling TinyMCE:', error);
  }
  
  // Set a flag to indicate cache was cleared
  try {
    localStorage.setItem('cache_cleared_timestamp', Date.now().toString());
    sessionStorage.setItem('force_media_reload', 'true');
    localStorage.setItem('tinymce_cache_cleared', Date.now().toString());
  } catch (error) {
    console.error('Error setting cache flags:', error);
  }
  
  console.log('Cache clearing complete - errors should be resolved on next page refresh.');
}

function addCacheClearButton() {
  // Add a button to the page for easy cache clearing
  const button = document.createElement('button');
  button.innerText = 'Clear Media Cache';
  button.style.position = 'fixed';
  button.style.bottom = '20px';
  button.style.right = '20px';
  button.style.zIndex = '9999';
  button.style.padding = '10px 15px';
  button.style.backgroundColor = '#f44336';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.borderRadius = '4px';
  button.style.cursor = 'pointer';
  
  button.addEventListener('click', () => {
    clearMediaCache();
    alert('Media cache cleared successfully. Refresh the page to see changes.');
  });
  
  document.body.appendChild(button);
}

// Execute cache clearing
clearMediaCache();

// Add a diagnostic function to detect broken media in TinyMCE editor
function findBrokenMediaInEditor() {
  console.log('Scanning for broken media in TinyMCE editor...');
  
  // Check if TinyMCE is available
  if (!window.tinymce) {
    console.warn('TinyMCE not available for scanning');
    return;
  }
  
  // Loop through all TinyMCE editors
  window.tinymce.editors.forEach(editor => {
    try {
      console.log(`Scanning editor: ${editor.id}`);
      
      // Get the editor's DOM element
      const editorBody = editor.getBody();
      if (!editorBody) {
        console.warn(`No body found for editor ${editor.id}`);
        return;
      }
      
      // Find all images
      const images = editorBody.querySelectorAll('img');
      console.log(`Found ${images.length} images in editor ${editor.id}`);
      
      // Check each image
      let brokenImageCount = 0;
      images.forEach((img, index) => {
        const src = img.getAttribute('src');
        
        // Check for signs of broken images
        if (!src || 
            src === 'null' || 
            src === 'undefined' || 
            (img.complete && img.naturalHeight === 0) ||
            img.naturalWidth === 0 ||
            (src && src.includes('scales')) ||
            (src && src.includes('object-storage') && img.naturalWidth === 0)) {
          
          // Mark broken image for easy identification
          img.setAttribute('data-error', 'true');
          img.style.border = '2px dashed red';
          
          console.warn(`Found broken image #${index} in ${editor.id} with src: ${src || 'empty'}`);
          brokenImageCount++;
          
          // Add an overlay for visibility
          const parent = img.parentElement;
          if (parent) {
            const errorSpan = document.createElement('span');
            errorSpan.innerText = "❌";
            errorSpan.style.position = 'absolute';
            errorSpan.style.color = 'red';
            errorSpan.style.fontWeight = 'bold';
            errorSpan.style.fontSize = '24px';
            parent.style.position = 'relative';
            parent.appendChild(errorSpan);
          }
        }
      });
      
      // Find all videos
      const videos = editorBody.querySelectorAll('video');
      console.log(`Found ${videos.length} videos in editor ${editor.id}`);
      
      // Check each video
      let brokenVideoCount = 0;
      videos.forEach((video, index) => {
        const src = video.getAttribute('src');
        
        // Check for signs of broken videos
        if (!src || 
            src === 'null' || 
            src === 'undefined' || 
            video.error !== null ||
            video.networkState === 3 ||
            (src && src.includes('object-storage') && video.networkState !== 1)) {
          
          // Mark broken video for easy identification
          video.setAttribute('data-error', 'true');
          video.style.border = '2px dashed red';
          
          console.warn(`Found broken video #${index} in ${editor.id} with src: ${src || 'empty'}`);
          brokenVideoCount++;
          
          // Add an overlay for visibility
          const parent = video.parentElement;
          if (parent) {
            const errorSpan = document.createElement('span');
            errorSpan.innerText = "❌ Video Error";
            errorSpan.style.position = 'absolute';
            errorSpan.style.color = 'red';
            errorSpan.style.fontWeight = 'bold';
            errorSpan.style.fontSize = '16px';
            errorSpan.style.background = 'rgba(0,0,0,0.5)';
            errorSpan.style.padding = '4px';
            parent.style.position = 'relative';
            parent.appendChild(errorSpan);
          }
        }
      });
      
      // Report results
      console.log(`Scan complete for editor ${editor.id}:`);
      console.log(`- ${brokenImageCount} broken images found`);
      console.log(`- ${brokenVideoCount} broken videos found`);
      
      if (brokenImageCount > 0 || brokenVideoCount > 0) {
        // Create a notification
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.top = '10px';
        notification.style.right = '10px';
        notification.style.backgroundColor = '#ff5555';
        notification.style.color = 'white';
        notification.style.padding = '10px';
        notification.style.borderRadius = '4px';
        notification.style.zIndex = '9999';
        notification.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        notification.innerHTML = `
          <p style="margin:0;font-weight:bold">Broken Media Detected!</p>
          <p style="margin:4px 0">Found ${brokenImageCount} broken images and ${brokenVideoCount} broken videos.</p>
          <p style="margin:4px 0;font-size:12px">Use Delete or Backspace to remove them</p>
        `;
        
        // Add a close button
        const closeButton = document.createElement('button');
        closeButton.innerText = '×';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '5px';
        closeButton.style.right = '5px';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.color = 'white';
        closeButton.style.fontSize = '20px';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => notification.remove();
        notification.appendChild(closeButton);
        
        // Auto-dismiss after 10 seconds
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 10000);
      }
      
    } catch (e) {
      console.error(`Error scanning editor ${editor.id}:`, e);
    }
  });
}

// Run media check 2 seconds after TinyMCE editors load
setTimeout(() => {
  try {
    findBrokenMediaInEditor();
  } catch (e) {
    console.error('Error running media diagnostic:', e);
  }
}, 2000);

// Create and add a button for manual clearing and scanning
// This makes it easier for users to run the cache clearing routines
addCacheClearButton();

console.log('Cache clearing script loaded successfully. Look for the "Clear Media Cache" button in the bottom right corner.');
console.log('Use this button when you notice broken media in the editor that cannot be deleted properly.');