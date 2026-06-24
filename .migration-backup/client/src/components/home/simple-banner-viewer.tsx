import React, { useState, useEffect } from 'react';

/**
 * Simple Banner Viewer component
 * 
 * This component provides a simplified way to display banner content
 * without the ref forwarding issues of the more complex components.
 */
interface SimpleBannerViewerProps {
  srcList: string[];  // List of image/video sources to try
  alt?: string;
  isVideo?: boolean;
  className?: string;
}

export const SimpleBannerViewer: React.FC<SimpleBannerViewerProps> = ({
  srcList,
  alt = 'Banner media',
  isVideo = false,
  className = '',
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>(srcList[0] || '');
  const [hasError, setHasError] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [attemptIdx, setAttemptIdx] = useState<number>(0);
  
  useEffect(() => {
    // Reset states when srcs change
    setCurrentSrc(srcList[0] || '');
    setHasError(false);
    setLoaded(false);
    setAttemptIdx(0);
  }, [srcList]);
  
  // Handle error by trying next source
  const handleError = () => {
    console.warn(`Error loading ${isVideo ? 'video' : 'image'} from ${currentSrc}`);
    
    // Try next source if available
    const nextIdx = attemptIdx + 1;
    if (nextIdx < srcList.length) {
      setAttemptIdx(nextIdx);
      setCurrentSrc(srcList[nextIdx]);
      setLoaded(false);
    } else {
      // All sources failed
      setHasError(true);
    }
  };
  
  const handleLoad = () => {
    setLoaded(true);
  };
  
  // Show error state if all sources failed
  if (hasError || srcList.length === 0) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-slate-100 ${className}`}>
        <div className="text-center p-4">
          <p className="text-red-500 font-medium">Content Unavailable</p>
          <p className="text-sm text-gray-500 mt-1">Unable to load banner content</p>
        </div>
      </div>
    );
  }
  
  // Show loading indicator while not loaded
  const loadingIndicator = !loaded && (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  
  // Render video or image based on isVideo prop
  return (
    <div className={`w-full h-full relative ${className}`}>
      {isVideo ? (
        <video
          src={currentSrc}
          className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          autoPlay
          muted
          loop
          playsInline
          poster="/public/banner-placeholder.jpg"
          onError={handleError}
          onLoadedData={handleLoad}
          aria-label={alt}
        />
      ) : (
        <img
          src={currentSrc}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onError={handleError}
          onLoad={handleLoad}
        />
      )}
      {loadingIndicator}
    </div>
  );
};