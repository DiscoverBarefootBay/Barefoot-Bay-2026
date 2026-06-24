/**
 * Media Helper Utility
 * 
 * This utility provides functions to help with media loading and error handling,
 * especially for the production environment where paths might be different.
 */

/**
 * Get the correct URL for media files based on the current environment
 * This helps handle different path structures between development and production
 * 
 * @param url The original URL to the media file
 * @returns A corrected URL that should work in both environments
 */
export function getMediaUrl(url: string, context: string = 'default'): string {
  if (!url) {
    // Return appropriate default image based on context
    if (context === 'event') {
      // Use storage proxy instead of direct Object Storage URL to avoid CORS issues
      return '/api/storage-proxy/CALENDAR/events/default-event-image.svg';
    }
    return '';
  }
  
  // If URL is already in the correct proxy format, return it as is
  if (url.startsWith('/api/storage-proxy/')) {
    console.log(`URL already in correct proxy format: ${url}`);
    return url;
  }
  
  // Handle attachments specifically with guaranteed direct API access path
  if (url.includes('/uploads/attachments/') || url.includes('/attachments/') || context === 'attachment') {
    try {
      // Get the filename from the path (no matter what format the original URL is in)
      const parts = url.split('/');
      const filename = parts[parts.length - 1];
      
      // Remove any query parameters from the filename (like ?t=1234567890)
      const cleanFilename = filename.split('?')[0];
      
      // Check if we're in production by looking at the current hostname
      const isProduction = typeof window !== 'undefined' && 
        (window.location.hostname.includes('replit.app') || 
         window.location.hostname.includes('replit.dev') ||
         window.location.hostname.includes('janeway.replit') ||
         window.location.hostname.includes('barefootbay.com'));
      
      // Debug information
      console.log(`[MediaHelper] Processing attachment URL:`, {
        originalUrl: url,
        extractedFilename: filename,
        cleanFilename,
        context,
        isProduction,
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown'
      });
      
      // Ensure we have a valid filename to work with
      if (!cleanFilename || cleanFilename.length < 3) {
        console.error(`[MediaHelper] Invalid attachment filename: ${cleanFilename} from URL: ${url}`);
        return url; // Return original if we can't extract a valid filename
      }
      
      // ALWAYS use our guaranteed direct API access path first
      // This ensures attachments are always accessible regardless of environment
      const apiPath = `/api/attachments/${cleanFilename}`;
      
      // Also include fallback paths for client-side error handling
      const directAttachmentPath = `/attachments/${cleanFilename}`;
      const uploadsAttachmentPath = `/uploads/attachments/${cleanFilename}`;
      const storageProxyPath = `/api/storage-proxy/MESSAGES/attachments/${cleanFilename}`;
      
      // Generate fallback array of paths in order of preference
      const fallbackPaths = [directAttachmentPath, uploadsAttachmentPath, storageProxyPath];
      
      // Store fallback paths for client-side error handling
      if (typeof window !== 'undefined') {
        if (!window._attachmentFallbackPaths) {
          window._attachmentFallbackPaths = {};
        }
        window._attachmentFallbackPaths[cleanFilename] = [apiPath, ...fallbackPaths];
      }
      
      console.log(`[MediaHelper] Using direct API path for attachment: ${apiPath}`);
      
      // CRITICAL FIX: Make sure we're not returning a URL with the domain in it
      // This was causing problems in production where URLs were constructed as 
      // https://barefootbay.com/uploads/attachments/... which fails to load
      if (url.includes('https://barefootbay.com') || url.includes('http://barefootbay.com')) {
        console.log(`[MediaHelper] Fixing absolute URL by converting to relative path: ${url} -> ${apiPath}`);
      }
      
      return apiPath;
    } catch (error) {
      console.error(`[MediaHelper] Error processing attachment URL:`, error);
      return url; // Return original URL if there was an error
    }
  }
  
  // Convert direct Object Storage URLs to use our proxy instead
  if (url.startsWith('https://object-storage.replit.app/')) {
    // Check if it's a calendar event
    if (url.includes('/CALENDAR/events/')) {
      const filename = url.split('/').pop();
      if (filename) {
        console.log(`Converting direct Object Storage URL to proxy: ${url} -> /api/storage-proxy/CALENDAR/events/${filename}`);
        return `/api/storage-proxy/CALENDAR/events/${filename}`;
      }
    }
    
    // Check if it's a message attachment
    if (url.includes('/MESSAGES/attachments/')) {
      const filename = url.split('/').pop();
      if (filename) {
        console.log(`Converting direct Object Storage URL to proxy for attachment: ${url} -> /api/storage-proxy/MESSAGES/attachments/${filename}`);
        return `/api/storage-proxy/MESSAGES/attachments/${filename}`;
      }
    }
    
    // If it's any other Object Storage URL, parse the bucket and path
    // This handles URLs formatted like https://object-storage.replit.app/BUCKET/path/to/file.ext
    try {
      const objectStorageHost = 'object-storage.replit.app';
      const urlObj = new URL(url);
      
      if (urlObj.hostname === objectStorageHost) {
        // Extract path components after the hostname
        const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
        
        if (pathParts.length >= 2) {
          const bucket = pathParts[0];
          const remainingPath = pathParts.slice(1).join('/');
          const proxyUrl = `/api/storage-proxy/${bucket}/${remainingPath}`;
          console.log(`Converting Object Storage URL to proxy format: ${url} -> ${proxyUrl}`);
          return proxyUrl;
        }
      }
    } catch (e) {
      console.error('Error parsing Object Storage URL:', e);
    }
  }
  
  // Also check for different format of Object Storage URLs
  if (url.includes('object-storage.replit.app') && url.includes('/events/')) {
    const parts = url.split('/');
    const bucketIndex = parts.findIndex(part => part === 'object-storage.replit.app') + 1;
    if (bucketIndex < parts.length) {
      const bucket = parts[bucketIndex];
      // Extract all parts after 'events/' to the end to capture the full filename
      const eventsIndex = parts.findIndex(part => part === 'events') + 1;
      if (eventsIndex < parts.length) {
        const restOfPath = parts.slice(eventsIndex).join('/');
        console.log(`Converting alternate Object Storage URL format: ${url} -> /api/storage-proxy/${bucket}/events/${restOfPath}`);
        return `/api/storage-proxy/${bucket}/events/${restOfPath}`;
      }
    }
  }
  
  // Also intercept any URL path that contains the specific media ID we're having issues with
  if (url.includes('media-1746255825619-326598596.png') || url.includes('media-1746255825619-32659859')) {
    console.log(`Intercepting problematic media URL: ${url}`);
    return `/api/storage-proxy/CALENDAR/events/media-1746255825619-326598596.png`;
  }
  
  // If URL is already a full URL (starts with http/https), return as is (except for Object Storage URLs)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Different subdirectories where files might be stored
  const subdirectories = [
    '', // Default (no additional subdirectory)
    'calendar/',
    'banner-slides/',
    'content-media/',
    'forum-media/',
    'vendor-media/',
    'community-media/',
    'Real Estate/',
    'icons/'
  ];

  // Check if we're in production by looking at the current hostname
  // This allows us to use different paths in production vs development
  const isProduction = typeof window !== 'undefined' && 
    (window.location.hostname.includes('replit.app') || 
     window.location.hostname.includes('replit.dev') ||
     window.location.hostname.includes('janeway.replit') ||
     window.location.hostname.includes('barefootbay.com'));

  // Critical assets like the rocket icon need special handling in production
  if ((
      url.includes('Asset1.svg') || 
      url.includes('rocket-icon.svg') || 
      url === '/uploads/icons/Asset1.svg')) {
    console.log('Critical asset detected', url, 'isProduction:', isProduction);
    
    // PRODUCTION FIX: Always use an absolute URL for the icon in production
    // This ensures the icon isn't affected by path resolution issues
    if (isProduction) {
      console.log('Production environment: using hardcoded rocket icon path with timestamp');
      // Force using the direct /icons/ path in production with cache-busting timestamp
      // This bypasses any path resolution issues and cache problems
      const timestamp = new Date().getTime();
      return `/icons/Asset1.svg?v=${timestamp}`;
    } else {
      console.log('Development environment: using /uploads/icons/Asset1.svg for rocket icon');
      return '/uploads/icons/Asset1.svg';
    }
  }
  
  // Handle calendar event media with enhanced Object Storage support
  if (url.includes('/uploads/calendar/') || url.includes('/calendar/') || url.includes('/media/') || 
      url.includes('/CALENDAR/events/') || url.includes('media-') || url.includes('event-')) {
    console.log('Calendar media detected:', url);
    
    // Extract the filename from the path
    let filename;
    if (url.includes('/')) {
      filename = url.split('/').pop();
    } else {
      // Handle case where URL is just a filename
      filename = url;
    }
    
    if (filename) {
      // ALWAYS use proxy format for event media to ensure consistent paths
      if (context === 'event') {
        console.log('Event context - ALWAYS using storage proxy for consistent path access');
        return `/api/storage-proxy/CALENDAR/events/${filename}`;
      }
      
      // For non-event contexts but still calendar media
      // Generate a cache-busting timestamp for production
      const timestamp = isProduction ? `?v=${new Date().getTime()}` : '';
      
      // Also use storage proxy for calendar files to ensure consistency
      return `/api/storage-proxy/CALENDAR/events/${filename}`;
    }
  }
  
  // We're now handling all event media in the previous section
  
  // Handle banner slide media in production environment
  if (isProduction && url.includes('/uploads/banner-slides/')) {
    console.log('Production environment detected for banner slide:', url);
    
    // Get the filename from the path
    const filename = url.split('/').pop();
    if (filename) {
      // In production, serve banner slide files directly from the root /banner-slides/ directory
      return `/banner-slides/${filename}`;
    }
  }
  
  // Handle content-media and forum media content - preserve original path structure 
  if (url.includes('/uploads/forum-media/') || url.includes('/uploads/content-media/')) {
    // Preserve the /uploads/ prefix to ensure paths work in both environments
    // Previously we were converting these to root paths in production which caused broken images
    return url;
  }
  
  // For content-media without uploads prefix, ensure it works consistently
  if (url.includes('/content-media/')) {
    // Check if this is the specific Dan Hess image
    if (url.includes('mediaFile-1745355164980-265491046.png')) {
      console.log('Found Dan Hess content-media image URL', url);
      // Try both formats to ensure it works in all environments
      return url;
    }
    
    // For other content-media files, keep the format consistent
    return url;
  }
  
  // Handle vendor media content with flexible path handling to support both environments
  if (url.includes('/uploads/vendor-media/')) {
    // In production environment, convert to the direct vendor-media path
    if (isProduction) {
      const filename = url.split('/').pop();
      if (filename) {
        console.log('Converting vendor media path in production:', url, '->', `/vendor-media/${filename}`);
        return `/vendor-media/${filename}`;
      }
    }
    // In development, preserve the /uploads/ prefix
    return url;
  }
  
  // Special handling for vendor detail pages with URLs like /vendors/automotive/autotest
  if (typeof window !== 'undefined') {
    // Check if we're on a vendor detail page
    const pathname = window.location.pathname;
    const isVendorDetailPage = pathname.match(/^\/vendors\/[^\/]+\/[^\/]+$/);
    
    if (isVendorDetailPage && url.includes('/uploads/')) {
      console.log('Vendor detail page media detected:', url);
      
      // Get the filename from the path
      const filename = url.split('/').pop();
      if (filename) {
        // For production environment, use direct vendor-media path
        if (isProduction) {
          console.log('Production environment - using direct vendor-media path for:', filename);
          return `/vendor-media/${filename}`;
        }
        
        // For development environment, preserve the original path if it has vendor-media
        if (url.includes('/uploads/vendor-media/')) {
          return url;
        } else {
          // For other images in vendor pages, try vendor-media path
          return `/uploads/vendor-media/${filename}`;
        }
      }
    }
  }
  
  // Handle community page media content - use storage proxy for consistent access
  if (url.includes('/uploads/community-media/') || url.includes('/community-media/') || 
      url.includes('/api/storage-proxy/direct-community/')) {
    
    // Extract the filename from the path
    let filename;
    if (url.includes('/api/storage-proxy/direct-community/')) {
      // Already in correct proxy format
      return url;
    } else if (url.includes('/uploads/community-media/')) {
      filename = url.substring(url.lastIndexOf('/') + 1);
    } else if (url.includes('/community-media/')) {
      filename = url.substring(url.indexOf('/community-media/') + '/community-media/'.length);
    }
    
    // Log the detected community media
    console.log('Community media detected:', url, 'filename:', filename);
    
    if (filename) {
      // Always use storage proxy format for community media to ensure it works in both dev and production
      const proxyUrl = `/api/storage-proxy/direct-community/${filename}`;
      console.log('Converting community media to proxy format:', url, '->', proxyUrl);
      return proxyUrl;
    }
    
    // If we can't extract filename, preserve original URL
    return url;
  }
  
  // Handle real estate media - enhanced handling for both for-sale listings and property pages
  if (url.includes('/uploads/real-estate-media/') || url.includes('/real-estate-media/')) {
    // Get the filename regardless of the path format
    const filename = url.includes('/uploads/real-estate-media/') 
      ? url.substring(url.lastIndexOf('/') + 1)
      : url.includes('/real-estate-media/') 
        ? url.substring('/real-estate-media/'.length)
        : '';
        
    // Log the detected real estate media
    console.log('Real estate media detected:', url, 'filename:', filename);
        
    // Special handling for for-sale listings
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/for-sale')) {
      console.log('On for-sale page, using optimized path for:', filename);
      // For for-sale page, try both paths simultaneously to ensure it works in both environments
      // We'll return the original URL but handle fallbacks in the error handler
      return url;
    }
    
    // Check if the URL starts with /uploads/
    if (!url.startsWith('/uploads/') && url.startsWith('/real-estate-media/')) {
      // Convert /real-estate-media/ to /uploads/real-estate-media/ for better compatibility
      if (filename) {
        console.log('Converting real estate media path to /uploads/ format:', url);
        return `/uploads/real-estate-media/${filename}`;
      }
    }
    
    // Otherwise preserve the /uploads/ prefix to ensure paths work in both environments
    console.log('Preserving real estate media path:', url);
    return url;
  }

  // If URL already has /uploads/ in it
  if (url.includes('/uploads/')) {
    // Make sure it starts with a slash
    if (!url.startsWith('/')) {
      url = '/' + url;
    }
    
    // If we're in production, we need to check for certain critical paths
    if (isProduction) {
      // For icons in production, try to use the public directory version
      if (url.includes('/uploads/icons/')) {
        const filename = url.split('/').pop();
        if (filename) {
          return `/icons/${filename}`;
        }
      }
    }
    
    // Already properly formatted with /uploads/, return it
    return url;
  }
  
  // If URL is just a filename (no slashes), try to determine the appropriate folder
  if (!url.includes('/')) {
    // Special handling for specific file patterns
    if (url.startsWith('Asset') || url.endsWith('.svg')) {
      // In production, use /icons/ directory for SVG files
      if (isProduction) {
        return `/icons/${url}`;
      }
      return `/uploads/icons/${url}`;
    }
    
    if (url.startsWith('bannerImage-')) {
      // For banner slide files, handle differently based on environment
      if (isProduction) {
        // In production, use the direct /banner-slides/ directory
        return `/banner-slides/${url}`;
      } else {
        // In development, use the /uploads/ prefix
        return `/uploads/banner-slides/${url}`;
      }
    }
    
    if (url.startsWith('media-')) {
      // For media files, handle differently based on environment
      if (isProduction) {
        // In production, try the direct /calendar/ directory
        return `/calendar/${url}`;
      } else {
        // In development, use the /uploads directory
        return `/uploads/${url}`;
      }
    }
    
    // For other files, default to /uploads/
    return `/uploads/${url}`;
  }
  
  // If we've reached here, the URL might be missing /uploads/ prefix
  if (!url.startsWith('/uploads/')) {
    return `/uploads${url.startsWith('/') ? '' : '/'}${url}`;
  }
  
  // Return the URL as is if none of the above conditions match
  return url;
}

/**
 * Fallback image handler function to be used in onError events
 * This tries multiple alternative paths when an image fails to load
 * 
 * @param event The error event from the img element
 * @param fallbackSrc Optional fallback source to use if all attempts fail
 */
export function handleImageError(event: React.SyntheticEvent<HTMLImageElement, Event>, fallbackSrc?: string): void {
  const target = event.currentTarget;
  const originalSrc = target.src;
  console.error(`Image failed to load: ${originalSrc}`);
  
  // Special handling for calendar event media from Object Storage
  if (originalSrc.includes('object-storage.replit.app/')) {
    // Check if it's a calendar event
    if (originalSrc.includes('/CALENDAR/events/')) {
      // Extract the filename from the URL
      const filename = originalSrc.split('/').pop();
      if (filename) {
        // Use the storage proxy instead of direct Object Storage URL
        const proxyUrl = `/api/storage-proxy/CALENDAR/events/${filename}`;
        console.log(`Converting failed Object Storage URL to proxy: ${originalSrc} -> ${proxyUrl}`);
        target.src = proxyUrl;
        return;
      }
    }
    
    // Handle any other Object Storage URL
    try {
      const objectStorageHost = 'object-storage.replit.app';
      const urlObj = new URL(originalSrc);
      
      if (urlObj.hostname === objectStorageHost) {
        // Extract path components after the hostname
        const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
        
        if (pathParts.length >= 2) {
          const bucket = pathParts[0];
          const remainingPath = pathParts.slice(1).join('/');
          const proxyUrl = `/api/storage-proxy/${bucket}/${remainingPath}`;
          console.log(`Converting failed Object Storage URL to proxy format: ${originalSrc} -> ${proxyUrl}`);
          target.src = proxyUrl;
          return;
        }
      }
    } catch (e) {
      console.error('Error parsing Object Storage URL during error handling:', e);
    }
  }
  
  // Also check for any Object Storage URL that includes events folder
  if (originalSrc.includes('object-storage.replit.app') && originalSrc.includes('/events/')) {
    // Parse the URL parts to extract bucket and path
    const parts = originalSrc.split('/');
    const bucketIndex = parts.findIndex(part => part === 'object-storage.replit.app') + 1;
    if (bucketIndex < parts.length) {
      const bucket = parts[bucketIndex];
      // Extract all parts after 'events/' to the end to capture the full filename
      const eventsIndex = parts.findIndex(part => part === 'events') + 1;
      if (eventsIndex < parts.length) {
        const restOfPath = parts.slice(eventsIndex).join('/');
        const proxyUrl = `/api/storage-proxy/${bucket}/events/${restOfPath}`;
        console.log(`Converting alternate Object Storage URL format: ${originalSrc} -> ${proxyUrl}`);
        target.src = proxyUrl;
        return;
      }
    }
  }
  
  // Specific handling for the problematic media file
  if (originalSrc.includes('media-1746255825619-326598596.png') || originalSrc.includes('media-1746255825619-32659859')) {
    console.log(`Special handling for problematic media: ${originalSrc}`);
    target.src = '/api/storage-proxy/CALENDAR/events/media-1746255825619-326598596.png';
    return;
  }
  
  // Don't retry if we're already using a fallback image
  if (fallbackSrc && originalSrc.includes(fallbackSrc)) {
    console.log('Already using fallback image, not retrying');
    return;
  }
  
  // Build a list of alternative paths to try
  const attempts: string[] = [];
  
  // Special handling for Asset1.svg which is critical in production
  if (originalSrc.includes('Asset1.svg') || originalSrc.includes('rocket-icon.svg')) {
    console.log('Critical asset failure detected, attempting multiple recovery paths');
    
    // Check if we're in production to prioritize order
    const isProduction = typeof window !== 'undefined' && 
      (window.location.hostname.includes('replit.app') || 
       window.location.hostname.includes('replit.dev') ||
       window.location.hostname.includes('janeway.replit') ||
       window.location.hostname.includes('barefootbay.com'));
    
    console.log('Rocket icon recovery - Environment:', isProduction ? 'production' : 'development');
    
    // Generate a timestamp for cache busting
    const timestamp = new Date().getTime();
    
    if (isProduction) {
      // PRODUCTION FIX: For production, try direct /icons/ paths first with cache busting
      attempts.push(`/icons/Asset1.svg?v=${timestamp}`);
      attempts.push(`/icons/Asset 1.svg?v=${timestamp}`);
      attempts.push(`/icons/rocket-icon.svg?v=${timestamp}`);
      
      // Then try uploads paths with cache busting
      attempts.push(`/uploads/icons/Asset1.svg?v=${timestamp}`);
      attempts.push(`/uploads/icons/Asset 1.svg?v=${timestamp}`);
      attempts.push(`/uploads/icons/rocket-icon.svg?v=${timestamp}`);
      
      // Then try root paths with extensions as last resort
      attempts.push(`/Asset1.svg?v=${timestamp}`);
      attempts.push(`/rocket-icon.svg?v=${timestamp}`);
      
      // Emergency fallback: hardcoded data URI of a simple rocket SVG
      attempts.push("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWdvbiBwb2ludHM9IjEyIDIgMTkgMTAgMTIgMTggNSAxMCAxMiAyIi8+PHBhdGggZD0iTTEyIDE4djQiLz48cGF0aCBkPSJNOCAxNHY0Ii8+PHBhdGggZD0iTTE2IDE0djQiLz48L3N2Zz4=");
    } else {
      // For development, we can try either path first (without cache busting)
      attempts.push('/uploads/icons/Asset1.svg');
      attempts.push('/icons/Asset1.svg');
      attempts.push('/uploads/icons/Asset 1.svg');
      attempts.push('/icons/Asset 1.svg');
      attempts.push('/uploads/icons/rocket-icon.svg');
      attempts.push('/icons/rocket-icon.svg');
    }
    
    // Add the fallback at the end if provided
    if (fallbackSrc) {
      attempts.push(fallbackSrc);
    }
  } else {
    // Standard error handling for other images
    
    // Check if this is a special media URL
    const isCalendarMedia = originalSrc.includes('/uploads/calendar/');
    const isBannerSlideMedia = originalSrc.includes('/uploads/banner-slides/');
    const isForumMedia = originalSrc.includes('/uploads/forum-media/') || originalSrc.includes('/uploads/content-media/');
    const isContentMedia = originalSrc.includes('/content-media/');
    const isVendorMedia = originalSrc.includes('/uploads/vendor-media/');
    const isCommunityMedia = originalSrc.includes('/uploads/community-media/');
    const isRealEstateMedia = originalSrc.includes('/uploads/real-estate-media/');
    
    // Check if we're on a real estate page
    const isOnRealEstatePage = typeof window !== 'undefined' && 
      (window.location.pathname.startsWith('/for-sale/') || window.location.pathname === '/for-sale');
    
    // Check if we're on a vendor detail page
    const isOnVendorDetailPage = typeof window !== 'undefined' && 
      window.location.pathname.match(/^\/vendors\/[^\/]+\/[^\/]+$/);
    
    // Special handling for calendar media (high priority recovery)
    if (isCalendarMedia || originalSrc.includes('/calendar/') || originalSrc.includes('/media/') || originalSrc.includes('media-')) {
      console.log('Calendar media recovery paths detected');
      const filename = originalSrc.split('/').pop();
      if (filename) {
        // First try the storage proxy (highest priority) instead of direct Object Storage
        // This avoids CORS issues by routing through our server
        attempts.push(`/api/storage-proxy/CALENDAR/events/${filename}`);
        
        // Then try traditional paths as fallbacks
        attempts.push(`/calendar/${filename}`);
        attempts.push(`/media/${filename}`);
        attempts.push(`/uploads/calendar/${filename}`);
        attempts.push(`/uploads/${filename}`);
        
        // Also try default image through the proxy as last resort
        attempts.push('/api/storage-proxy/CALENDAR/events/default-event-image.svg');
      }
    }
    
    // Special handling for banner slide media (high priority recovery)
    if (isBannerSlideMedia) {
      console.log('Banner slide media recovery paths detected');
      const filename = originalSrc.split('/').pop();
      if (filename) {
        // Try the direct /banner-slides/ path (for production)
        attempts.push(`/banner-slides/${filename}`);
        // Try media service path
        attempts.push(`/media/${filename}`);
        // Try alternative path without banner-slides subdirectory
        attempts.push(`/uploads/${filename}`);
        // Try with bannerImage- prefix even if the original doesn't have it
        if (!filename.startsWith('bannerImage-') && !filename.startsWith('banner')) {
          attempts.push(`/uploads/banner-slides/bannerImage-${filename}`);
        }
      }
    }
    
    // Special handling for forum media (high priority recovery)
    if (isForumMedia) {
      console.log('Forum media recovery paths detected');
      const filename = originalSrc.split('/').pop();
      if (filename) {
        // Try the direct /forum-media/ path (for production)
        attempts.push(`/forum-media/${filename}`);
        // Try content-media path (sometimes used for forum content)
        attempts.push(`/content-media/${filename}`);
        // Try media service path
        attempts.push(`/media/${filename}`);
        // Try alternative paths
        attempts.push(`/uploads/${filename}`);
        attempts.push(`/uploads/forum-media/${filename}`);
        attempts.push(`/uploads/content-media/${filename}`);
      }
    }
    
    // Special handling for vendor media (high priority recovery)
    if (isVendorMedia) {
      console.log('Vendor media recovery paths detected');
      const filename = originalSrc.split('/').pop();
      if (filename) {
        // First try cache busting for vendor media
        const timestamp = new Date().getTime();
        
        // Try the direct /vendor-media/ path first (for production)
        attempts.push(`/vendor-media/${filename}?v=${timestamp}`);
        attempts.push(`/vendor-media/${filename}`);
        
        // Try both formats to ensure cross-environment compatibility
        attempts.push(`/uploads/vendor-media/${filename}?v=${timestamp}`);
        attempts.push(`/uploads/vendor-media/${filename}`);
        
        // Try media service path
        attempts.push(`/media/${filename}`);
        
        // Try alternative paths
        attempts.push(`/uploads/${filename}`);
      }
    }
    
    // Special handling for images on vendor detail pages
    if (isOnVendorDetailPage) {
      console.log('Vendor detail page image recovery paths detected for:', originalSrc);
      const filename = originalSrc.split('/').pop();
      if (filename) {
        // First try cache busting for vendor media in detail pages
        const timestamp = new Date().getTime();
        
        // For any image on a vendor detail page, try these special paths
        // Production paths first with and without cache busting
        attempts.push(`/vendor-media/${filename}?v=${timestamp}`);
        attempts.push(`/vendor-media/${filename}`);
        
        // Development paths next
        attempts.push(`/uploads/vendor-media/${filename}?v=${timestamp}`);
        attempts.push(`/uploads/vendor-media/${filename}`);
        
        // Alternative paths
        attempts.push(`/media/${filename}`);
        attempts.push(`/uploads/${filename}`);
        
        // Handle special case for Dan Hess Antiques & Estate Sales
        if (typeof window !== 'undefined' && 
            window.location.pathname.includes('dan-hess-antiques') || 
            originalSrc.includes('screenshot-2025-04-22')) {
          console.log('Special handling for Dan Hess Antiques image');
          
          // Add the known content-media path that works in edit mode
          attempts.push('/content-media/mediaFile-1745355164980-265491046.png');
          attempts.push('/uploads/content-media/mediaFile-1745355164980-265491046.png');
          
          // Also try vendor media paths
          attempts.push('/vendor-media/dan-hess-antiques.png');
          attempts.push('/uploads/vendor-media/dan-hess-antiques.png');
          
          // Additional fallbacks for screenshot images
          const vendorSlug = window.location.pathname.split('/').pop();
          if (vendorSlug) {
            attempts.push(`/vendor-media/${vendorSlug}.png`);
            attempts.push(`/uploads/vendor-media/${vendorSlug}.png`);
          }
        }
      }
    }
    
    // Special handling for content media paths (high priority recovery)
    if (isContentMedia) {
      console.log('Content media recovery paths detected');
      const filename = originalSrc.split('/').pop();
      if (filename) {
        // Check if this is the Dan Hess image
        if (filename === 'mediaFile-1745355164980-265491046.png' || originalSrc.includes('mediaFile-1745355164980-265491046.png')) {
          console.log('Specific handling for Dan Hess content media image');
          // Add both formats - with and without uploads
          attempts.push(`/content-media/mediaFile-1745355164980-265491046.png`);
          attempts.push(`/uploads/content-media/mediaFile-1745355164980-265491046.png`);
          
          // Also add vendor media paths as fallbacks
          attempts.push(`/vendor-media/dan-hess-antiques.png`);
          attempts.push(`/uploads/vendor-media/dan-hess-antiques.png`);
        } else {
          // For other content media files
          attempts.push(`/content-media/${filename}`);
          attempts.push(`/uploads/content-media/${filename}`);
          // Try media service path
          attempts.push(`/media/${filename}`);
          // Try direct uploads path
          attempts.push(`/uploads/${filename}`);
        }
      }
    }
    
    // Special handling for community media (high priority recovery)
    if (isCommunityMedia || originalSrc.includes('/community-media/') || originalSrc.includes('/api/storage-proxy/direct-community/')) {
      console.log('Community media recovery paths detected');
      const filename = originalSrc.split('/').pop();
      if (filename) {
        // First try the storage proxy (highest priority) for consistent access
        attempts.push(`/api/storage-proxy/direct-community/${filename}`);
        // Try alternative Object Storage path
        attempts.push(`/api/storage-proxy/COMMUNITY/community/${filename}`);
        // Legacy fallback paths (lower priority)
        attempts.push(`/community-media/${filename}`);
        attempts.push(`/uploads/community-media/${filename}`);
      }
    }
    
    // Special handling for real estate media (high priority recovery)
    if (isRealEstateMedia || isOnRealEstatePage) {
      console.log('Real estate media recovery paths detected for:', originalSrc);
      const filename = originalSrc.split('/').pop();
      if (filename) {
        // Try all possible paths for real estate media in both environments

        // For "Media thumbnail" placeholder images on for-sale page
        if (originalSrc.includes('Media thumbnail') || 
            target.alt === 'Media thumbnail' || 
            target.classList.contains('property-thumbnail')) {
          console.log('Handling property listing thumbnail');
          
          // Try direct media paths first
          attempts.push(`/real-estate-media/${filename}`);
          attempts.push(`/uploads/real-estate-media/${filename}`);
          
          // Try standard fallback image for real estate
          attempts.push(`/real-estate-media/default-property.jpg`);
          attempts.push(`/uploads/real-estate-media/default-property.jpg`);
        }
        
        // First, try the original paths (most common)
        attempts.push(`/uploads/real-estate-media/${filename}`);
        attempts.push(`/real-estate-media/${filename}`);
        
        // For specific for-sale listing pages, try direct property image paths
        if (isOnRealEstatePage) {
          console.log('Adding for-sale specific recovery paths');
          
          // Get listing ID from URL if available
          const listingIdMatch = window.location.pathname.match(/\/for-sale\/(\d+)/);
          const listingId = listingIdMatch ? listingIdMatch[1] : null;
          
          if (listingId) {
            // Try listing-specific image patterns
            attempts.push(`/real-estate-media/listing-${listingId}.jpg`);
            attempts.push(`/uploads/real-estate-media/listing-${listingId}.jpg`);
            attempts.push(`/real-estate-media/property-${listingId}.jpg`);
            attempts.push(`/uploads/real-estate-media/property-${listingId}.jpg`);
          }
        }
        
        // Then try with media service path (handles special transformations)
        attempts.push(`/media/${filename}`);
        
        // Add special /Real Estate/ path (different format used in some places)
        attempts.push(`/uploads/Real Estate/${filename}`);
        attempts.push(`/Real Estate/${filename}`);
        
        // Try root uploads as last resort
        attempts.push(`/uploads/${filename}`);
        
        console.log(`Added recovery paths for real estate media: ${filename}`);
        
        // Special handling for media URLs with timestamps (common pattern)
        if (filename.startsWith('media-')) {
          // Also try in calendar directory (sometimes real estate uses calendar media)
          attempts.push(`/calendar/${filename}`);
          attempts.push(`/uploads/calendar/${filename}`);
        }
      }
    }
    
    // 1. Try adding /uploads/ prefix if missing
    if (!originalSrc.includes('/uploads/')) {
      const filename = originalSrc.split('/').pop();
      if (filename) {
        attempts.push(`/uploads/${filename}`);
      }
    }
    
    // 2. Try different subdirectories
    if (originalSrc.includes('/uploads/')) {
      const parts = originalSrc.split('/uploads/');
      if (parts.length > 1) {
        const filename = parts[1].split('/').pop();
        if (filename) {
          // Try different subdirectories
          if (!isCalendarMedia) { // Skip if already handled above
            attempts.push(`/uploads/calendar/${filename}`);
          }
          if (!isBannerSlideMedia) { // Skip if already handled above
            attempts.push(`/uploads/banner-slides/${filename}`);
          }
          if (!isForumMedia) { // Skip if already handled above
            attempts.push(`/uploads/content-media/${filename}`);
            attempts.push(`/uploads/forum-media/${filename}`);
          }
          if (!isVendorMedia) { // Skip if already handled above
            attempts.push(`/uploads/vendor-media/${filename}`);
          }
          if (!isCommunityMedia) { // Skip if already handled above
            attempts.push(`/uploads/community-media/${filename}`);
          }
          attempts.push(`/uploads/icons/${filename}`);
          attempts.push(`/uploads/${filename}`); // Also try directly in uploads
        }
      }
    }
    
    // 3. For SVG files, try both with and without spaces in the filename
    if (originalSrc.includes('.svg')) {
      const withoutSpace = originalSrc.replace(' ', '');
      const withSpace = originalSrc.replace(/Asset(\d+)\.svg/, 'Asset $1.svg');
      attempts.push(withoutSpace);
      attempts.push(withSpace);
      attempts.push(`/uploads/icons/Asset1.svg`); // Last resort for icon files
    }
  }
  
  // Debug logging - list all attempts we're going to try
  console.log('Will attempt the following recovery paths:', attempts);
  
  // Start trying alternatives
  const tryNextAttempt = (index: number) => {
    if (index >= attempts.length) {
      // If we've tried all alternatives and still failed, use the fallback if provided
      if (fallbackSrc && !attempts.includes(fallbackSrc)) {
        console.log(`All attempts failed, using fallback: ${fallbackSrc}`);
        target.src = fallbackSrc;
        // Remove the error handler to prevent infinite loops
        target.onerror = null;
      } else {
        console.error('All alternative paths failed and no fallback provided');
        
        // For critical assets, try one more fallback approach - inline SVG 
        if (originalSrc.includes('Asset1.svg') || originalSrc.includes('rocket-icon.svg')) {
          console.log('Creating inline SVG rocket as final fallback');
          try {
            // Replace the img with an inline SVG rocket
            const parent = target.parentElement;
            if (parent) {
              // Create a simple rocket SVG as absolute last resort
              const svgNS = "http://www.w3.org/2000/svg";
              const svg = document.createElementNS(svgNS, "svg");
              svg.setAttribute("width", "32");
              svg.setAttribute("height", "32");
              svg.setAttribute("viewBox", "0 0 24 24");
              svg.setAttribute("fill", "none");
              svg.setAttribute("stroke", "currentColor");
              svg.setAttribute("stroke-width", "2");
              svg.setAttribute("stroke-linecap", "round");
              svg.setAttribute("stroke-linejoin", "round");
              
              // Create a path for a simple rocket
              const path = document.createElementNS(svgNS, "path");
              path.setAttribute("d", "M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222m0 0l4 2.222V20M12 3v8.75");
              
              svg.appendChild(path);
              
              // Replace the failed image with the SVG
              // Use proper type casting to avoid TypeScript errors
              target.parentElement?.replaceChild(svg, target);
              
              console.log('Replaced failed Asset1.svg with inline SVG rocket');
            }
          } catch (e) {
            console.error('Failed to create inline SVG fallback:', e);
          }
        }
      }
      return;
    }
    
    // Try the next alternative path
    const nextSrc = attempts[index];
    console.log(`Attempt ${index + 1}/${attempts.length}: trying ${nextSrc}`);
    
    // Set up error handler for the next attempt
    target.onerror = () => {
      console.log(`Attempt ${index + 1} failed: ${nextSrc}`);
      tryNextAttempt(index + 1);
    };
    
    // Try the alternative path
    target.src = nextSrc;
  };
  
  // Start trying alternatives
  tryNextAttempt(0);
}

/**
 * Create an inline SVG rocket icon as a last resort
 * @returns HTML Element containing the SVG
 */
export function createInlineRocketSvg(): HTMLElement {
  console.log('Creating inline rocket SVG as direct fallback');
  
  try {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "32");
    svg.setAttribute("height", "32");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    
    // Create a path for a simple rocket
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222m0 0l4 2.222V20M12 3v8.75");
    
    svg.appendChild(path);
    
    // Wrap the SVG in a div to return an HTMLElement
    const wrapper = document.createElement('div');
    wrapper.appendChild(svg);
    return wrapper;
  } catch (e) {
    console.error('Failed to create inline SVG rocket:', e);
    // If SVG creation fails, return a span with a text fallback
    const span = document.createElement('span');
    span.textContent = '🚀';
    span.title = 'Rocket Launch';
    return span;
  }
}

/**
 * Prefetch critical media to ensure it's available
 * @param urls Array of URLs to prefetch
 */
export function prefetchMedia(urls: string[]): void {
  if (typeof window === 'undefined') return;
  
  urls.forEach(url => {
    const correctedUrl = getMediaUrl(url);
    
    // Create link for browser prefetching
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = correctedUrl;
    link.as = correctedUrl.match(/\.(mp4|webm|ogg|mov)$/i) ? 'video' : 'image';
    document.head.appendChild(link);
    
    // For images, also preload them
    if (!correctedUrl.match(/\.(mp4|webm|ogg|mov)$/i)) {
      const img = new Image();
      img.src = correctedUrl;
      
      // For rocket icons, add special error handling
      if (correctedUrl.includes('Asset1.svg') || correctedUrl.includes('rocket-icon.svg')) {
        img.onerror = () => {
          console.log(`Preloading failed for: ${correctedUrl}, will use fallbacks when needed`);
        };
      }
    }
  });
}