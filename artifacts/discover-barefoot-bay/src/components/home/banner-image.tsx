import React, { useState, useEffect, useRef } from 'react';
import { clearMediaCache, addCacheBustingParam } from '../../utils/banner-cache-manager';
import { BannerMediaFallback } from './banner-media-fallback';

// Custom hook to track if component is mounted
function useIsMounted() {
  const isMounted = useRef(true);
  
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  return isMounted;
}

// Keep a global cache of attempted paths to prevent cycles across remounts
const globalTriedPathsCache = new Map<string, Set<string>>();

interface BannerImageProps {
  src: string;
  alt: string;
  bgPosition?: string;
  className?: string;
  isCurrentSlide?: boolean;
}

/**
 * Banner image component with error handling and path normalization
 * Will attempt to load image from multiple path formats and fall back to placeholder
 * when image fails to load
 */
export function BannerImage({ 
  src, 
  alt, 
  bgPosition = 'center', 
  className = '',
  isCurrentSlide = false 
}: BannerImageProps) {
  const isMounted = useIsMounted();
  const [loaded, setLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState(src);
  const [error, setError] = useState(false);
  // Track which paths we've already tried to avoid loops
  const [triedPaths, setTriedPaths] = useState<string[]>([]);
  const [fallbackAttempt, setFallbackAttempt] = useState(0);
  
  // Add debug logging to track what source is being used
  console.log(`🔍 [BANNER IMAGE DEBUG] Component for src: ${src}, current imageSrc: ${imageSrc}`);

  // Clear the banner cache when the component mounts
  useEffect(() => {
    clearMediaCache();
  }, []);

  // Check for Object Storage URL in slide data
  const checkForObjectStorageUrl = (currentSrc: string): string => {
    // Simple pass-through function for now - let's not try to access DOM elements
    // directly as it can cause issues with React's virtual DOM
    return currentSrc;
  };

  // Reset states when src changes
  useEffect(() => {
    setLoaded(false);
    setError(false);
    
    // Check if we have an Object Storage URL available
    const bestSource = checkForObjectStorageUrl(src);
    setImageSrc(bestSource);
    setTriedPaths([bestSource]);
    setFallbackAttempt(0);
  }, [src]);

  // Extract filename from path or URL
  const getFilenameFromPath = (path: string): string => {
    // Get the part after the last slash
    return path.split('/').pop() || '';
  };

  // Normalize source to handle different path formats and always use proxy for Object Storage
  // This is specifically for banner content to avoid affecting other components
  const normalizeSource = (sourcePath: string): string => {
    // Skip normalization for non-banner content to avoid affecting other components
    if (!sourcePath.includes('banner-slides') && 
        !sourcePath.includes('bannerImage') && 
        !sourcePath.includes('DEFAULT/banner') &&
        !sourcePath.includes('object-storage.replit.app')) {
      return sourcePath;
    }
    
    // Use proxy for Object Storage URLs to avoid CORS issues
    if (sourcePath.includes('object-storage.replit.app')) {
      // First try to extract the full path regardless of whether it starts with http or not
      let urlParts: string[];
      
      if (sourcePath.startsWith('http')) {
        urlParts = sourcePath.split('object-storage.replit.app/');
      } else if (sourcePath.startsWith('//object-storage.replit.app')) {
        urlParts = sourcePath.split('//object-storage.replit.app/');
      } else {
        urlParts = sourcePath.split('object-storage.replit.app/');
      }
      
      if (urlParts.length > 1) {
        const parts = urlParts[1].split('/');
        if (parts.length >= 2) {
          const bucket = parts[0];
          const filepath = parts.slice(1).join('/');
          
          // Always use our server's proxy endpoint
          let proxyPath = `/api/storage-proxy/${bucket}/${filepath}`;
          
          // Add cache-busting for Object Storage URLs if required
          if ((window as any).__forceReloadBanners) {
            proxyPath = addCacheBustingParam(proxyPath);
          }
          
          console.log(`Converting banner Object Storage URL to proxy: ${proxyPath}`);
          return proxyPath;
        }
      }
      
      // If this is a banner image but we couldn't parse the URL, 
      // extract just the filename and try a direct-banner endpoint
      const filename = sourcePath.split('/').pop() || '';
      if (filename && (filename.includes('bannerImage') || filename.includes('banner-'))) {
        console.log(`Extracted filename ${filename} from unparseable Object Storage URL`);
        return `/api/storage-proxy/direct-banner/${filename}`;
      }
      
      // If we couldn't parse the URL, just return it
      return sourcePath;
    }
    
    // If it's already an API proxy path, just return it (maybe with cache busting)
    if (sourcePath.startsWith('/api/storage-proxy/')) {
      // Add cache-busting if needed
      if ((window as any).__forceReloadBanners) {
        return addCacheBustingParam(sourcePath);
      }
      return sourcePath;
    }

    // Handle absolute vs. relative paths
    const normalizedPath = sourcePath.startsWith('/') ? sourcePath : `/${sourcePath}`;
    
    // Only validate banner images to avoid breaking other components
    if (normalizedPath.includes('banner-slides') || normalizedPath.includes('bannerImage')) {
      // Validate this is an image path by extension
      const isImagePath = normalizedPath.match(/\.(jpg|jpeg|png|gif|webp|svg|avif)$/i);
      if (!isImagePath) {
        console.error(`Invalid banner image format: ${normalizedPath}. Must be jpg, jpeg, png, gif, webp, svg, or avif.`);
        return '/public/banner-placeholder.jpg';
      }
    }

    // Add cache-busting for banner-slides paths if force flag is set
    if (normalizedPath.includes('banner-slides') && (window as any).__forceReloadBanners) {
      return addCacheBustingParam(normalizedPath);
    }

    return normalizedPath;
  };

  // Try alternate path when image fails to load - using proxy only, no filesystem fallbacks
  // Completely rewritten with anti-cycle protection
  const tryAlternatePath = () => {
    // Don't retry if already using placeholder or component is unmounting
    if (imageSrc === '/public/banner-placeholder.jpg' || !isMounted.current) {
      if (isMounted.current) {
        setError(true);
      }
      return;
    }
    
    // Global cache key based on original source
    const cacheKey = src;
    if (!globalTriedPathsCache.has(cacheKey)) {
      globalTriedPathsCache.set(cacheKey, new Set<string>());
    }
    const globalTriedPaths = globalTriedPathsCache.get(cacheKey)!;
    
    // Mark current path as tried in global cache
    globalTriedPaths.add(imageSrc);
    
    // Get filename for direct access approach
    const filename = getFilenameFromPath(imageSrc);
    
    try {
      // Hard cap on attempts to prevent runaway loops
      if (fallbackAttempt >= 2) {
        console.log(`[Banner] Max fallback attempts (${fallbackAttempt}) reached for ${filename}, using placeholder`);
        setImageSrc('/public/banner-placeholder.jpg');
        setError(true);
        return;
      }
      
      // Increment the attempt counter first
      const newAttemptCount = fallbackAttempt + 1;
      
      // Try direct banner endpoint first - most reliable
      if (filename && !globalTriedPaths.has(`/api/storage-proxy/direct-banner/${filename}`)) {
        const directPath = `/api/storage-proxy/direct-banner/${filename}`;
        console.log(`[Banner] Trying direct banner endpoint: ${directPath}`);
        
        // Mark as tried in global cache
        globalTriedPaths.add(directPath);
        
        // Update component state after a delay to break synchronous cycle
        setTimeout(() => {
          if (isMounted.current) {
            setFallbackAttempt(newAttemptCount);
            setTriedPaths(prev => [...prev, directPath]);
            setImageSrc(directPath);
          }
        }, 25 * newAttemptCount); // Increasing delays for each attempt
        return;
      }
      
      // Try BANNER bucket as second choice
      if (filename && !globalTriedPaths.has(`/api/storage-proxy/BANNER/banner-slides/${filename}`)) {
        const bannerPath = `/api/storage-proxy/BANNER/banner-slides/${filename}`;
        console.log(`[Banner] Trying BANNER bucket: ${bannerPath}`);
        
        // Mark as tried in global cache
        globalTriedPaths.add(bannerPath);
        
        setTimeout(() => {
          if (isMounted.current) {
            setFallbackAttempt(newAttemptCount);
            setTriedPaths(prev => [...prev, bannerPath]);
            setImageSrc(bannerPath);
          }
        }, 50 * newAttemptCount);
        return;
      }
      
      // Try DEFAULT bucket as third choice
      if (filename && !globalTriedPaths.has(`/api/storage-proxy/DEFAULT/banner-slides/${filename}`)) {
        const defaultPath = `/api/storage-proxy/DEFAULT/banner-slides/${filename}`;
        console.log(`[Banner] Trying DEFAULT bucket: ${defaultPath}`);
        
        // Mark as tried in global cache
        globalTriedPaths.add(defaultPath);
        
        setTimeout(() => {
          if (isMounted.current) {
            setFallbackAttempt(newAttemptCount);
            setTriedPaths(prev => [...prev, defaultPath]);
            setImageSrc(defaultPath);
          }
        }, 75 * newAttemptCount);
        return;
      }
      
      // If all those fail, use the placeholder
      console.log(`[Banner] All fallback paths failed for ${filename}, using placeholder`);
      
      // Use an even longer timeout for the placeholder to give other attempts time
      setTimeout(() => {
        if (isMounted.current) {
          setImageSrc('/public/banner-placeholder.jpg');
          setError(true);
        }
      }, 100);
      
    } catch (err) {
      console.error(`[Banner] Error in tryAlternatePath: ${err}`);
      
      // In case of error, use placeholder with delay
      setTimeout(() => {
        if (isMounted.current) {
          setImageSrc('/public/banner-placeholder.jpg');
          setError(true);
        }
      }, 50);
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // Don't process error if component is unmounting
    if (!isMounted.current) return;
    
    // If this is already the placeholder, don't try to handle error
    if (imageSrc === '/public/banner-placeholder.jpg') {
      setError(true);
      setLoaded(true);
      return;
    }
    
    // More focused error logging for debugging
    if (e && e.nativeEvent instanceof Event) {
      // Avoid logging entire event objects that can't be serialized
      console.warn(`Image load error for: ${imageSrc.substring(0, 50)}${imageSrc.length > 50 ? '...' : ''} - trying fallback`);
      
      // Add specific detailed logging for Object Storage URLs
      const imgEl = e.currentTarget as HTMLImageElement;
      const sourceUrl = imgEl?.currentSrc || imageSrc;
      const sourceFile = sourceUrl.split('/').pop() || 'unknown';
      
      // Check network errors directly through fetch to get specific status codes
      if (sourceUrl && sourceUrl.startsWith('http')) {
        fetch(sourceUrl, { method: 'HEAD' })
          .then(response => {
            if (!isMounted.current) return;
            if (!response.ok) {
              console.warn(`Image source returned status ${response.status} for ${sourceFile}`);
            }
          })
          .catch(fetchErr => {
            if (!isMounted.current) return;
            console.warn(`Network error for ${sourceFile}: ${fetchErr.message}`);
          });
      }
    }

    // TEMPORARILY DISABLED: Complex fallback logic causing all images to use same placeholder
    // Try alternate path
    console.log(`🔍 [BANNER IMAGE DEBUG] Image failed for ${src}, setting error state without fallback attempts`);
    setError(true);
    // tryAlternatePath();
  };

  const handleImageLoad = () => {
    if (isMounted.current) {
      setLoaded(true);
      setError(false);
    }
  };

  return (
    <div 
      className={`w-full h-full relative ${className}`}
      style={{ 
        backgroundColor: error ? '#f0f0f0' : 'transparent',
      }}
    >
      <img
        src={normalizeSource(imageSrc)}
        alt={alt || 'Banner image'}
        onError={handleImageError}
        onLoad={handleImageLoad}
        className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ objectPosition: bgPosition }}
        crossOrigin="anonymous" // Add crossOrigin attribute to handle CORS
      />
      
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0">
          <BannerMediaFallback 
            error="Unable to load banner image" 
            className="h-full"
            onRetry={() => {
              // Reset error states
              setError(false);
              
              // Clear media cache and try again with the original source
              clearMediaCache();
              
              // Reset counters and paths
              setFallbackAttempt(0);
              setTriedPaths([]);
              
              // Set back to original source
              if (src) {
                setImageSrc(src);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}