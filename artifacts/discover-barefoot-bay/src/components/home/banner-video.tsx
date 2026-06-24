import React, { useState, useEffect, useRef, forwardRef, useCallback } from 'react';
// Use direct WebSocket implementation to avoid circular dependencies
import { websocketHelper } from '../../utils/websocket-helper';
import { clearMediaCache } from '../../utils/banner-cache-manager';
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

// Global rendering state for all BannerVideo components - prevents simultaneous loads
const loadingVideos = new Set<string>();

// Helper function to get descriptive error messages for video error codes
function getVideoErrorMessage(code: number): string {
  switch(code) {
    case 1:
      return "MEDIA_ERR_ABORTED - Fetching process aborted by user";
    case 2:
      return "MEDIA_ERR_NETWORK - Network error occurred while fetching";
    case 3:
      return "MEDIA_ERR_DECODE - Media decoding error";
    case 4:
      return "MEDIA_ERR_SRC_NOT_SUPPORTED - Media source not supported";
    default:
      return "UNKNOWN_ERROR";
  }
}

interface BannerVideoProps {
  src: string;
  alt?: string;
  currentSlide?: boolean;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  preload?: 'auto' | 'metadata' | 'none';
  bgPosition?: string;
  onError?: (error: any) => void;
}

/**
 * Banner video component with format validation and error handling
 * Will check if the provided source is a valid video file and fall back to
 * a placeholder if the video fails to load
 */
export const BannerVideo = forwardRef<HTMLVideoElement, BannerVideoProps>((props, ref) => {
  const {
    src,
    alt = 'Banner video',
    currentSlide = false,
    className = '',
    autoPlay = true,
    loop = true,
    muted = false, // Changed from true to false to allow audio playback by default
    controls = false,
    preload = 'metadata',
    bgPosition = 'center',
    onError,
  } = props;
  const isMounted = useIsMounted();
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [normalizedSrc, setNormalizedSrc] = useState(src);
  // Track which paths we've already tried to avoid loops
  const [triedPaths, setTriedPaths] = useState<string[]>([]);
  const [fallbackAttempt, setFallbackAttempt] = useState(0);
  
  // Use singleton WebSocket helper safely, with proper production handling
  const [isConnected, setIsConnected] = useState(false);
  
  // Clear the banner cache when the component mounts
  useEffect(() => {
    clearMediaCache();
  }, []);

  // Handle page visibility changes to stop audio when user leaves page/switches tabs
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && videoRef.current) {
        // Pause the video when page becomes hidden
        videoRef.current.pause();
        console.log('Video paused due to page visibility change');
      }
    };

    const handlePageHide = () => {
      if (videoRef.current) {
        // Force pause when page is being hidden/closed
        videoRef.current.pause();
        videoRef.current.currentTime = 0; // Reset to beginning for mobile
        console.log('Video paused and reset due to page hide');
      }
    };

    const handleBeforeUnload = () => {
      if (videoRef.current) {
        // Stop video before page unloads
        videoRef.current.pause();
        videoRef.current.src = '';
        console.log('Video stopped before page unload');
      }
    };

    // Add event listeners for various page leave scenarios
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Also handle when the component unmounts
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Stop video when component unmounts
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
    };
  }, []);
  
  // Skip WebSocket setup in production mode to avoid conflicts with Object Storage
  useEffect(() => {
    // Don't use WebSocket functionality in production mode
    if (import.meta.env.MODE === 'production') {
      return; // Early return - no WebSocket in production
    }
    
    try {
      // Safe check for isConnected with try/catch to prevent errors
      let initialConnected = false;
      try {
        initialConnected = websocketHelper.isConnected();
        setIsConnected(initialConnected);
      } catch (e) {
        console.warn('Could not check WebSocket connection:', e);
      }
      
      // Handler for connection events
      const handleConnect = () => {
        if (isMounted.current) {
          setIsConnected(true);
        }
      };
      
      // Handler for disconnection events
      const handleDisconnect = () => {
        if (isMounted.current) {
          setIsConnected(false);
        }
      };
      
      // Handler for video status messages
      const handleVideoStatusMessage = (data: any) => {
        if (data?.url === normalizedSrc) {
          console.log(`Received video sync for ${normalizedSrc}: ${data.status}`);
        }
      };
      
      try {
        // Register the handlers
        websocketHelper.onConnect(handleConnect);
        websocketHelper.onDisconnect(handleDisconnect);
        websocketHelper.on('video-status', handleVideoStatusMessage);
        
        // Try to connect if not already connected
        if (!initialConnected) {
          websocketHelper.connect().catch(err => {
            console.warn('Error connecting to WebSocket:', err);
          });
        }
        
        // Cleanup handlers on unmount
        return () => {
          try {
            websocketHelper.offConnect(handleConnect);
            websocketHelper.offDisconnect(handleDisconnect);
            websocketHelper.off('video-status', handleVideoStatusMessage);
          } catch (e) {
            console.warn('Error cleaning up WebSocket handlers:', e);
          }
        };
      } catch (e) {
        console.warn('Error setting up WebSocket handlers:', e);
        return () => {}; // Empty cleanup function
      }
    } catch (e) {
      console.warn('WebSocket functionality disabled or unavailable:', e);
      return () => {}; // Empty cleanup function
    }
  }, [normalizedSrc]);

  // Reset states when src changes
  useEffect(() => {
    setLoaded(false);
    setHasError(false);
    // Apply normalization at the source
    const normalized = normalizeSource(src);
    setNormalizedSrc(normalized);
    setTriedPaths([normalized]);
    setFallbackAttempt(0);
    
    // Log for debugging
    if (normalized !== src) {
      console.log(`Normalized banner video src from ${src} to ${normalized}`);
    }
  }, [src]);

  // Check if this is a valid video file
  const isValidVideoFormat = (source: string): boolean => {
    // Check file extension to validate video format
    const lowerSrc = source.toLowerCase();
    return lowerSrc.endsWith('.mp4') || 
           lowerSrc.endsWith('.webm') || 
           lowerSrc.endsWith('.mov') || 
           lowerSrc.endsWith('.m4v') ||
           lowerSrc.endsWith('.ogg');
  };

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
        !sourcePath.includes('BANNER/banner') &&
        !sourcePath.includes('DEFAULT/banner') &&
        !sourcePath.includes('object-storage.replit.app')) {
      return sourcePath;
    }
    
    // Use proxy for Object Storage URLs to avoid CORS issues
    if (sourcePath.startsWith('http') && sourcePath.includes('object-storage.replit.app')) {
      // Extract bucket and path from Object Storage URL
      const urlParts = sourcePath.split('object-storage.replit.app/');
      if (urlParts.length > 1) {
        const parts = urlParts[1].split('/');
        if (parts.length >= 2) {
          const bucket = parts[0];
          const filepath = parts.slice(1).join('/');
          
          // Always use our server's proxy endpoint
          const proxyPath = `/api/storage-proxy/${bucket}/${filepath}`;
          console.log(`Converting banner video Object Storage URL to proxy: ${proxyPath}`);
          return proxyPath;
        }
      }
    }

    // If it's already an API proxy path, just return it
    if (sourcePath.startsWith('/api/storage-proxy/')) {
      return sourcePath;
    }
    
    // Handle local paths like /uploads/banner-slides/* and convert to Object Storage format
    if (sourcePath.startsWith('/uploads/banner-slides/')) {
      // Extract filename from path
      const filename = sourcePath.split('/').pop();
      if (filename) {
        // Convert to Object Storage proxy URL
        const proxyPath = `/api/storage-proxy/BANNER/banner-slides/${filename}`;
        console.log(`Converting local banner path ${sourcePath} to Object Storage proxy: ${proxyPath}`);
        return proxyPath;
      }
    }
    
    // Handle root-level banner-slides path
    if (sourcePath.startsWith('/banner-slides/')) {
      // Extract filename from path
      const filename = sourcePath.split('/').pop();
      if (filename) {
        // Convert to Object Storage proxy URL
        const proxyPath = `/api/storage-proxy/BANNER/banner-slides/${filename}`;
        console.log(`Converting root banner path ${sourcePath} to Object Storage proxy: ${proxyPath}`);
        return proxyPath;
      }
    }

    return sourcePath;
  };

  // Try alternate path when video fails to load - using proxy only approach
  // Completely rewritten with anti-cycle protection
  const tryAlternatePath = () => {
    // Don't retry if already has error or component is unmounting
    if (hasError || !isMounted.current) {
      if (isMounted.current) {
        setHasError(true);
      }
      return;
    }
    
    // Global cache key based on original source
    const cacheKey = src;
    if (!globalTriedPathsCache.has(cacheKey)) {
      globalTriedPathsCache.set(cacheKey, new Set<string>());
    }
    const globalTriedPaths = globalTriedPathsCache.get(cacheKey)!;
    
    // Mark current path as tried in global cache to prevent cycles
    globalTriedPaths.add(normalizedSrc);
    
    // Get filename for direct access approach
    const filename = getFilenameFromPath(normalizedSrc);
    
    // Check if this video format is actually valid
    if (!isValidVideoFormat(filename)) {
      console.error(`[BannerVideo] Invalid video format: ${filename}. Must be mp4, webm, mov, m4v, or ogg.`);
      setHasError(true);
      reportVideoStatus('invalid-video-format');
      return;
    }
    
    // Prevent too many videos loading at once to reduce browser stress
    if (filename && loadingVideos.has(filename)) {
      console.log(`[BannerVideo] This video ${filename} is already being loaded in another component`);
      return;
    }
    
    try {
      // Hard cap on attempts to prevent runaway loops
      if (fallbackAttempt >= 2) {
        console.log(`[BannerVideo] Max fallback attempts (${fallbackAttempt}) reached for ${filename}, marking as error`);
        reportVideoStatus('max-fallback-attempts');
        setHasError(true);
        return;
      }
      
      // Add this file to the loading set
      if (filename) {
        loadingVideos.add(filename);
      }
      
      // Increment the attempt counter first
      const newAttemptCount = fallbackAttempt + 1;
      
      // Try BANNER bucket as first choice - most reliable for banner slides
      if (filename && !globalTriedPaths.has(`/api/storage-proxy/BANNER/banner-slides/${filename}`)) {
        const bannerPath = `/api/storage-proxy/BANNER/banner-slides/${filename}`;
        console.log(`[BannerVideo] Trying BANNER bucket: ${bannerPath}`);
        
        // Mark as tried in global cache
        globalTriedPaths.add(bannerPath);
        
        // Update component state after a delay to break synchronous cycle
        setTimeout(() => {
          if (isMounted.current) {
            setFallbackAttempt(newAttemptCount);
            setTriedPaths(prev => [...prev, bannerPath]);
            setNormalizedSrc(bannerPath);
            reportVideoStatus('trying-banner-bucket');
          }
        }, 50 * newAttemptCount); // Increasing delays for each attempt
        return;
      }
      
      // Try direct banner endpoint as second choice
      if (filename && !globalTriedPaths.has(`/api/storage-proxy/direct-banner/${filename}`)) {
        const directPath = `/api/storage-proxy/direct-banner/${filename}`;
        console.log(`[BannerVideo] Trying direct banner endpoint: ${directPath}`);
        
        // Mark as tried in global cache
        globalTriedPaths.add(directPath);
        
        setTimeout(() => {
          if (isMounted.current) {
            setFallbackAttempt(newAttemptCount);
            setTriedPaths(prev => [...prev, directPath]);
            setNormalizedSrc(directPath);
            reportVideoStatus('trying-direct-banner');
          }
        }, 100 * newAttemptCount);
        return;
      }
      
      // Try DEFAULT bucket as next choice
      if (filename && !globalTriedPaths.has(`/api/storage-proxy/DEFAULT/banner-slides/${filename}`)) {
        const defaultPath = `/api/storage-proxy/DEFAULT/banner-slides/${filename}`;
        console.log(`[BannerVideo] Trying DEFAULT bucket: ${defaultPath}`);
        
        // Mark as tried in global cache
        globalTriedPaths.add(defaultPath);
        
        setTimeout(() => {
          if (isMounted.current) {
            setFallbackAttempt(newAttemptCount);
            setTriedPaths(prev => [...prev, defaultPath]);
            setNormalizedSrc(defaultPath);
            reportVideoStatus('trying-default-bucket');
          }
        }, 150 * newAttemptCount);
        return;
      }
      
      // Try static videos folder as final fallback
      if (filename && !globalTriedPaths.has(`/static/videos/${filename}`)) {
        const staticPath = `/static/videos/${filename}`;
        console.log(`[BannerVideo] Trying static videos folder: ${staticPath}`);
        
        // Mark as tried in global cache
        globalTriedPaths.add(staticPath);
        
        setTimeout(() => {
          if (isMounted.current) {
            setFallbackAttempt(newAttemptCount);
            setTriedPaths(prev => [...prev, staticPath]);
            setNormalizedSrc(staticPath);
            reportVideoStatus('trying-static-folder');
          }
        }, 200 * newAttemptCount);
        return;
      }
      
      // Try with a generic fallback video as last resort
      const fallbackPath = `/static/videos/BackgroundVideo.mp4`;
      if (!globalTriedPaths.has(fallbackPath)) {
        console.log(`[BannerVideo] Trying generic fallback video: ${fallbackPath}`);
        
        // Mark as tried in global cache
        globalTriedPaths.add(fallbackPath);
        
        setTimeout(() => {
          if (isMounted.current) {
            setFallbackAttempt(newAttemptCount);
            setTriedPaths(prev => [...prev, fallbackPath]);
            setNormalizedSrc(fallbackPath);
            reportVideoStatus('trying-generic-fallback');
          }
        }, 250 * newAttemptCount);
        return;
      }
      
      // If all those fail, mark as error
      console.log(`[BannerVideo] All video sources failed`);
      reportVideoStatus('all-paths-failed');
      
      // Use an even longer timeout for setting error state to give other attempts time
      setTimeout(() => {
        if (isMounted.current) {
          setHasError(true);
        }
        
        // Remove from loading set
        if (filename) {
          loadingVideos.delete(filename);
        }
      }, 300);
      
    } catch (err) {
      console.error(`[BannerVideo] Error in tryAlternatePath: ${err}`);
      reportVideoStatus('path-error');
      
      // In case of error, set error state with delay
      setTimeout(() => {
        if (isMounted.current) {
          setHasError(true);
        }
        
        // Remove from loading set
        if (filename) {
          loadingVideos.delete(filename);
        }
      }, 50);
    }
  };

  // Handler to report video status via WebSocket - safely handles production mode
  const reportVideoStatus = useCallback((status: string) => {
    // Skip WebSocket reporting in production mode
    if (import.meta.env.MODE === 'production') {
      return; // No WebSocket reporting in production
    }
    
    try {
      if (isConnected && normalizedSrc) {
        websocketHelper.send('video-status', {
          url: normalizedSrc,
          status,
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {
      // Silently catch any WebSocket errors to prevent app crashes
      console.warn('Error reporting video status:', e);
    }
  }, [isConnected, normalizedSrc]);

  // Play video when it becomes current slide with improved error handling
  useEffect(() => {
    if (!videoRef.current) return;
    
    if (currentSlide && autoPlay) {
      // Use a flag to track if we're deliberately pausing to avoid error logs
      let isDeliberatelyPausing = false;
      let playAttempts = 0;
      const MAX_ATTEMPTS = 3;
      
      // Add a cleanup function that runs when the component unmounts or effect re-runs
      const videoElement = videoRef.current;
      
      // Create an event handler to log play errors
      const handlePlayError = (err: any) => {
        if (isDeliberatelyPausing) return;
        
        // Handle user interaction requirement gracefully without counting as an error
        if (err.name === 'NotAllowedError' || 
            err.message?.includes('user didn\'t interact') || 
            err.message?.includes('user gesture') ||
            err.message?.includes('play() request was interrupted')) {
          console.log('Video autoplay blocked by browser policy - this is normal. Video will play after user interaction.');
          // Don't count this as an error attempt, just silently handle it
          return;
        }
        
        playAttempts++;
        console.warn(`Video playback issue (attempt ${playAttempts}/${MAX_ATTEMPTS}):`, err.message || 'Unknown issue');
        
        // If we've tried too many times with actual errors, mark as error and stop trying
        if (playAttempts >= MAX_ATTEMPTS) {
          console.warn('Maximum play attempts reached, marking as error');
          if (isConnected) {
            reportVideoStatus('max-attempts-error');
          }
          setHasError(true);
        } else {
          // Only retry for actual video loading errors, not autoplay restrictions
          setTimeout(() => {
            if (videoElement && !isDeliberatelyPausing) {
              attemptPlay();
            }
          }, 1000);
        }
      };
      
      // Check if the video is actually ready before trying to play
      const attemptPlay = () => {
        // Don't attempt if we already have an error
        if (hasError) return;
        
        try {
          if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA or better
            videoElement.play().catch(handlePlayError);
          } else {
            // If not ready, wait for the canplay event
            const playWhenReady = () => {
              if (!isDeliberatelyPausing) {
                videoElement.play().catch(handlePlayError);
              }
              videoElement.removeEventListener('canplay', playWhenReady);
            };
            videoElement.addEventListener('canplay', playWhenReady);
            
            // Set a timer to automatically check readyState again
            // This helps with browsers that may not fire canplay reliably
            setTimeout(() => {
              if (!isDeliberatelyPausing && videoElement.readyState >= 2 && 
                  playAttempts < MAX_ATTEMPTS) {
                videoElement.play().catch(handlePlayError);
              }
            }, 1000);
          }
        } catch (err) {
          handlePlayError(err);
        }
      };
      
      attemptPlay();
      
      // Cleanup function to prevent memory leaks and prepare for pause
      return () => {
        isDeliberatelyPausing = true;
        if (videoElement) {
          // Remove any pending event listeners
          videoElement.removeEventListener('canplay', () => {});
          videoElement.pause();
        }
      };
    } else if (videoRef.current) {
      videoRef.current.pause();
    }
  }, [currentSlide, autoPlay, hasError, isConnected, reportVideoStatus]);

  // Check for valid video format
  useEffect(() => {
    if (!isValidVideoFormat(normalizedSrc) && isMounted.current) {
      console.error(`Invalid video source format: ${normalizedSrc}. Must be mp4, webm, mov, or m4v.`);
      setHasError(true);
    }
  }, [normalizedSrc, isMounted]);

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    // Don't process error if component is unmounting
    if (!isMounted.current) return;
    
    // More focused error logging
    if (e.nativeEvent instanceof Event) {
      // Extract useful info without stringifying the entire event
      const videoEl = e.currentTarget as HTMLVideoElement;
      const sourceUrl = videoEl?.currentSrc || normalizedSrc;
      const sourceFile = sourceUrl.split('/').pop() || 'unknown';
      
      console.warn(`Video error occurred loading ${sourceFile} - attempting fallback`);
      console.error("Video error: ", e);
      
      // Log detailed video error information for debugging
      if (videoEl.error) {
        const errorEvent = videoEl.error;
        console.error(`Video error event triggered (${fallbackAttempt + 1}/2): `, e.nativeEvent);
        console.error(`Detailed video error: Code ${errorEvent.code}: ${getVideoErrorMessage(errorEvent.code)}`);
      }
      
      // Report error via WebSocket for diagnostics with more details
      reportVideoStatus(`error-${sourceFile}`);
      
      // Check network errors directly through fetch to get specific status codes
      if (sourceUrl && (sourceUrl.startsWith('http') || sourceUrl.startsWith('/'))) {
        fetch(sourceUrl, { method: 'HEAD' })
          .then(response => {
            if (!response.ok) {
              console.warn(`Video source returned status ${response.status} for ${sourceFile}`);
              reportVideoStatus(`status-${response.status}-${sourceFile}`);
            }
          })
          .catch(fetchErr => {
            console.warn(`Network error for ${sourceFile}: ${fetchErr.message}`);
            reportVideoStatus(`network-error-${sourceFile}`);
          });
      }
    }
    
    // Call the provided onError handler if available
    if (onError) {
      onError(e);
    }
    
    // Try alternative paths
    tryAlternatePath();
  };

  // If format validation failed, show error state
  if (hasError) {
    return (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
        <div className="text-center p-4">
          <p className="text-destructive font-medium">Video Error</p>
          <p className="text-xs text-muted-foreground mt-1">
            Unable to load video content
          </p>
        </div>
      </div>
    );
  }

  // Create handlers for video events
  const handleVideoLoaded = useCallback(() => {
    if (isMounted.current) {
      setLoaded(true);
      reportVideoStatus('loaded');
    }
  }, [reportVideoStatus, isMounted]);

  const handleVideoPlay = useCallback(() => {
    if (isMounted.current) {
      reportVideoStatus('playing');
    }
  }, [reportVideoStatus, isMounted]);

  const handleVideoPause = useCallback(() => {
    if (isMounted.current) {
      reportVideoStatus('paused');
    }
  }, [reportVideoStatus, isMounted]);

  // Use a mutable ref to track the current video element
  const currentVideoElement = useRef<HTMLVideoElement | null>(null);
  
  // Create a combined ref callback that handles both the external ref and our internal ref
  const setRefCallback = useCallback((el: HTMLVideoElement | null) => {
    // Handle both refs properly
    if (typeof ref === 'function') {
      ref(el);
    } else if (ref) {
      ref.current = el;
    }
    
    // Store the video element in our internal mutable ref
    currentVideoElement.current = el;
    
    // Also update the videoRef but only if it's a new element
    if (el !== videoRef.current) {
      // Using a try/catch to handle any potential errors with the readonly property
      try {
        // @ts-ignore - Assigning to current which might be readonly
        videoRef.current = el;
      } catch (e) {
        console.warn('Unable to update videoRef directly, using currentVideoElement instead');
      }
    }
  }, [ref]);

  return (
    <video
      ref={setRefCallback}
      className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
      src={normalizeSource(normalizedSrc)}
      autoPlay={currentSlide && autoPlay} // Only autoplay current slide
      loop={loop}
      muted={muted}
      playsInline
      controls={controls}
      preload={preload}
      poster="/public/banner-placeholder.jpg" // Show placeholder until video loads
      aria-label={alt}
      onError={handleVideoError}
      onLoadedData={handleVideoLoaded}
      onPlay={handleVideoPlay}
      onPause={handleVideoPause}
      style={{ objectPosition: bgPosition || 'center' }}
      crossOrigin="anonymous" // Add crossOrigin attribute to handle CORS
    />
  );
});