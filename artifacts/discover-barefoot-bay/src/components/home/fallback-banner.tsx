import React, { useState, useEffect } from 'react';

/**
 * FallbackBanner component
 * 
 * A simplified component to display banner content when the main components fail
 */
interface FallbackBannerProps {
  mediaUrl: string;
  altText?: string;
  className?: string;
}

const FallbackBanner: React.FC<FallbackBannerProps> = ({
  mediaUrl,
  altText = 'Banner image',
  className = '',
}) => {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Determine if this is a video or image
  const isVideo = mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i) !== null;
  
  // Extract just the filename from path
  const filename = mediaUrl.split('/').pop() || '';
  
  // Generate potential alternative paths to try
  const [alternativePaths, setAlternativePaths] = useState<string[]>([]);
  
  useEffect(() => {
    // Reset state when media URL changes
    setLoaded(false);
    setHasError(false);
    
    // Generate multiple paths to try for this media
    const paths = [
      mediaUrl,
      // Try without /uploads/ prefix if it exists
      mediaUrl.replace('/uploads/', '/'),
      // Try with /uploads/ prefix if it doesn't exist
      mediaUrl.startsWith('/uploads/') ? mediaUrl : `/uploads${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`,
      // Try Object Storage proxy for banner slides
      `/api/storage-proxy/BANNER/banner-slides/${filename}`,
      `/api/storage-proxy/DEFAULT/banner-slides/${filename}`,
      // Fallback placeholder
      '/public/banner-placeholder.jpg'
    ];
    
    setAlternativePaths(paths);
  }, [mediaUrl, filename]);
  
  const handleError = () => {
    setHasError(true);
  };
  
  const handleLoad = () => {
    setLoaded(true);
  };
  
  return (
    <div className={`w-full h-full ${className}`}>
      {!loaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-200">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <p className="text-red-500">Unable to load banner media</p>
        </div>
      )}
      
      {isVideo ? (
        <video
          src={mediaUrl}
          autoPlay
          loop
          muted
          playsInline
          className={`w-full h-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoadedData={handleLoad}
          onError={handleError}
          poster="/public/banner-placeholder.jpg"
        />
      ) : (
        // Try all alternative paths using multiple img elements with only the first visible
        <div className="relative w-full h-full">
          {alternativePaths.map((path, index) => (
            <img
              key={`${path}-${index}`}
              src={path}
              alt={altText}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                loaded && !hasError ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={handleLoad}
              onError={() => {
                // If this is the last path, show error
                if (index === alternativePaths.length - 1) {
                  handleError();
                }
                // Otherwise hide this image and let the next one try
              }}
              style={{ zIndex: alternativePaths.length - index }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FallbackBanner;