// Simple script to include the cache clearing functionality with cache busting
document.write('<script src="/clear-media-cache.js?' + Date.now() + '"></script>');