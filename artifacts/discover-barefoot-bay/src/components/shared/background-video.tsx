import { useEffect, useRef, useState, memo, useCallback, useMemo } from "react";
import { cacheMedia, getCachedMedia } from "@/lib/media-cache";
import { websocketHelper } from "@/utils/websocket-helper";

interface BackgroundVideoProps {
  videoUrl?: string; // Optional, will use default if not provided
}

// Using memo for performance optimization
export const BackgroundVideo = memo(function BackgroundVideo({ videoUrl }: BackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [videoMetadataLoaded, setVideoMetadataLoaded] = useState(false);
  const [fallbackCount, setFallbackCount] = useState(0);

  // Video source prioritization:
  // 1. Local filesystem paths (highest priority for reliable access)
  // 2. Object Storage URLs (fallback options)
  const VIDEO_SOURCES = [
    // Local filesystem options (primary for reliable access)
    "/static/videos/BackgroundVideo.mp4",
    "/uploads/banner-slides/background-video.mp4",
    "/banner-slides/background-video.mp4",
    
    // Object Storage fallbacks
    "https://object-storage.replit.app/DEFAULT/banner-slides/BackgroundVideo.mp4",
    "https://object-storage.replit.app/DEFAULT/videos/BackgroundVideo.mp4",
    "https://object-storage.replit.app/DEFAULT/banner-slides/background-video.mp4",
    "https://object-storage.replit.app/DEFAULT/videos/background-video.mp4",
  ];

  // Get the best available video source based on fallback count
  const getVideoSource = useCallback(() => {
    // Check if we had a previously successful source and use it first
    try {
      const previouslySuccessfulSource = localStorage.getItem('successful-video-source');
      if (previouslySuccessfulSource && fallbackCount === 0) {
        console.log('Using previously successful video source:', previouslySuccessfulSource);
        return previouslySuccessfulSource;
      }
    } catch (e) {
      // localStorage might be unavailable
    }
    
    // If user provided a video URL and we haven't fallen back yet, use it
    if (videoUrl && fallbackCount === 0) {
      return videoUrl;
    }
    
    // Otherwise use one of our fallback sources based on the fallback count
    const sourceIndex = Math.min(fallbackCount, VIDEO_SOURCES.length - 1);
    return VIDEO_SOURCES[sourceIndex];
  }, [videoUrl, fallbackCount]);

  // Current video source based on fallback state - memoize to prevent reference changes
  const videoSource = useMemo(() => getVideoSource(), [getVideoSource]);
  
  // Check if we have the video cached
  const cachedVideo = getCachedMedia(videoSource);

  // Define tryNextSource first to avoid circular reference
  const tryNextSource = useCallback(() => {
    if (fallbackCount < VIDEO_SOURCES.length) {
      console.log(`Trying fallback source #${fallbackCount + 1}`);
      setFallbackCount(prevCount => prevCount + 1);
    } else {
      console.error("All video sources failed");
      setError("All video sources failed to load");
    }
  }, [fallbackCount]);

  const loadVideo = useCallback(() => {
    if (videoRef.current) {
      // Set preload to metadata to load just enough to display
      videoRef.current.preload = 'metadata';
      
      // Set the src attribute directly for better control
      if (!videoRef.current.src || videoRef.current.src !== videoSource) {
        videoRef.current.src = videoSource;
      }
      
      // Check if video can be accessed with a fetch request to verify URL availability
      fetch(videoSource, { method: 'HEAD' })
        .then(response => {
          if (response.ok) {
            console.log(`✅ Video URL is valid and accessible: ${videoSource}`);
            // URL is valid, now load the video properly
            videoRef.current?.load();
          } else {
            console.error(`❌ Video URL returned status ${response.status}: ${videoSource}`);
            tryNextSource();
          }
        })
        .catch(error => {
          console.error(`❌ Failed to check video URL: ${videoSource}`, error);
          tryNextSource();
        });
      
      console.log(`Loading video from: ${videoSource}`);
    }
  }, [videoSource, tryNextSource]);

  const playVideo = useCallback(() => {
    if (!videoRef.current) return;
    
    // Clear any previous errors
    setError(null);
    
    // Make sure video has loaded
    if (!videoRef.current.src || videoRef.current.src !== videoSource) {
      videoRef.current.src = videoSource;
      videoRef.current.load();
    }
    
    // Try to play with a slight delay to allow video to initialize
    setTimeout(() => {
      if (!videoRef.current) return;
      
      videoRef.current.play()
        .then(() => {
          console.log("Video playing successfully");
          setVideoMetadataLoaded(true);
        })
        .catch(error => {
          console.error("Error playing video:", error);
          setError("Failed to play video");
          tryNextSource();
        });
    }, 300);
  }, [videoSource, tryNextSource]);

  // Check if we're on the homepage - only load background video on homepage
  const isHomepage = typeof window !== "undefined" &&
    (window.location.pathname === "/" || window.location.pathname === "/home");

  // Simplified loading approach - load immediately on homepage
  useEffect(() => {
    if (!isHomepage) return;

    // Start loading immediately on homepage for better UX
    if (!isVideoLoaded) {
      console.log('Background video: Starting immediate load on homepage');
      setIsVisible(true);
      
      // Small delay to allow DOM to settle
      timerRef.current = setTimeout(() => {
        loadVideo();
        setIsVideoLoaded(true);
      }, 200);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isHomepage, isVideoLoaded, loadVideo]);

  // WebSocket connection effect
  useEffect(() => {
    if (!isHomepage) return;
    
    // Initialize WebSocket connection
    websocketHelper.connect().catch(err => {
      console.warn('WebSocket connection failed:', err);
      // Continue without WebSocket - it's not critical
    });
    
    return () => {
      // No need to disconnect - other components might be using it
    };
  }, [isHomepage]);

  // Video event listeners and source handling
  useEffect(() => {
    if (!isHomepage || !isVisible || !videoRef.current) return;

    // Load the video when source changes (due to fallbacks)
    loadVideo();
    
    // Prevent rapidly cycling through fallback sources
    let isMounted = true;
    let errorCount = 0;
    const MAX_ERRORS = 2;
    
    // Event listener setup
    const handleMetadataLoaded = () => {
      if (!isMounted) return;
      setVideoMetadataLoaded(true);
      
      // Save successful source to localStorage to prioritize in future
      if (videoSource.includes('object-storage.replit.app')) {
        try {
          localStorage.setItem('successful-video-source', videoSource);
          console.log(`Saved successful video source: ${videoSource}`);
        } catch (e) {
          // localStorage might be unavailable in incognito mode
        }
      }
      
      // Report video metadata loaded to server via WebSocket
      websocketHelper.sendVideoStatus(videoSource, 'loaded');
      console.log(`[WebSocket] Reported video metadata loaded: ${videoSource}`);
    };
    
    const handleDataLoaded = () => {
      if (!isMounted) return;
      
      // Only attempt to play if we haven't already loaded
      if (!videoMetadataLoaded) {
        playVideo();
      }
      
      // Report video playing to server via WebSocket when it starts playing
      if (videoRef.current) {
        const playingHandler = () => {
          if (!isMounted) return;
          websocketHelper.sendVideoStatus(videoSource, 'playing');
          console.log(`[WebSocket] Reported video playing: ${videoSource}`);
        };
        
        videoRef.current.addEventListener('playing', playingHandler, { once: true });
      }
    };
    
    const handleError = (e: Event) => {
      if (!isMounted) return;
      
      errorCount++;
      console.error(`Video error event triggered (${errorCount}/${MAX_ERRORS}):`, e);
      
      // Prevent multiple error handling for the same source
      if (errorCount > MAX_ERRORS) {
        console.error(`Too many errors for source ${videoSource}, giving up on this source`);
        setError("Failed to load video after multiple attempts");
        tryNextSource();
        return;
      }
      
      // Additional detailed error logging
      const videoElement = videoRef.current;
      let errorDetails = 'Unknown video error';
      
      if (e instanceof ErrorEvent) {
        errorDetails = e.message;
      } else if (videoElement && videoElement.error) {
        // Extract detailed error information from the video element
        const videoError = videoElement.error;
        const errorCodes = {
          1: 'MEDIA_ERR_ABORTED - Media loading aborted',
          2: 'MEDIA_ERR_NETWORK - Network error during media loading',
          3: 'MEDIA_ERR_DECODE - Error decoding media',
          4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - Media source not supported',
          5: 'MEDIA_ERR_ENCRYPTED - Media is encrypted'
        };
        
        errorDetails = `Code ${videoError.code}: ${errorCodes[videoError.code as keyof typeof errorCodes] || 'Unknown'}\n`;
        
        if (videoError.message) {
          errorDetails += `Message: ${videoError.message}`;
        }
      }
      
      console.error(`Detailed video error: ${errorDetails}`);
      
      // Report error to server via WebSocket with enhanced error details
      websocketHelper.sendVideoStatus(
        videoSource,
        'error', 
        errorDetails
      );
      console.log(`[WebSocket] Reported video error: ${videoSource}`);
      
      // Try an alternative source only if this was our first attempt
      if (errorCount >= MAX_ERRORS) {
        tryNextSource();
      }
    };

    // Add event listeners
    videoRef.current.addEventListener("loadedmetadata", handleMetadataLoaded);
    videoRef.current.addEventListener("loadeddata", handleDataLoaded);
    videoRef.current.addEventListener("error", handleError);

    // Cleanup function
    return () => {
      isMounted = false;
      
      if (!videoRef.current) return;
      
      videoRef.current.removeEventListener("loadedmetadata", handleMetadataLoaded);
      videoRef.current.removeEventListener("loadeddata", handleDataLoaded);
      videoRef.current.removeEventListener("error", handleError);
    };
  }, [isHomepage, isVisible, loadVideo, playVideo, tryNextSource, videoSource, videoMetadataLoaded]);

  // Don't render anything if not on homepage
  if (!isHomepage) {
    return null;
  }

  // Determine video opacity - make it more visible when loaded
  const videoOpacity = videoMetadataLoaded ? 0.09 : 0;

  return (
    <div className="fixed top-0 left-0 w-full h-screen -z-10 overflow-hidden pointer-events-none background-video-container">
      {/* Static background image placeholder */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(/uploads/background-image-placeholder.jpg)`,
          opacity: videoMetadataLoaded ? 0 : 0.08,
          transition: "opacity 2s ease-in-out",
        }}
      />

      {/* The video element - simplified approach with single source */}
      <video
        ref={videoRef}
        className="absolute w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="none" // Prevents loading until we explicitly call load()
        style={{
          opacity: videoOpacity,
          transition: "opacity 2s ease-in-out",
          willChange: "opacity", // Hint to browser to use GPU acceleration
          transform: "translateZ(0)", // Force hardware acceleration to fix blinking
        }}
      >
        {/* No sources here - we set src attribute directly in code for better control */}
        Your browser does not support the video tag.
      </video>
    </div>
  );
});