import React, { useState } from 'react';

interface ListingImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  width?: number | string;
  height?: number | string;
}

/**
 * Smart image component for listing photos that tries different URL formats
 * when an image fails to load, addressing the issue with media paths.
 * Now includes Object Storage support.
 */
export const ListingImage: React.FC<ListingImageProps> = ({
  src,
  alt,
  className = '',
  width,
  height
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>(src || '');
  const [fallbackIndex, setFallbackIndex] = useState<number>(0);
  const [loadFailed, setLoadFailed] = useState<boolean>(false);
  
  const handleError = () => {
    console.log(`Image failed to load: ${currentSrc}`);
    
    if (!src || fallbackIndex >= 5) {
      // We've tried all fallbacks or no source provided
      setLoadFailed(true);
      console.log(`Media service failed for ${src?.split('/').pop()}, trying default image`);
      return;
    }
    
    // Get original path without leading slash for processing
    const originalPath = src.startsWith('/') ? src.substring(1) : src;
    
    // Extract filename from path
    const filename = originalPath.split('/').pop();
    
    // Try different path formats as fallbacks
    if (fallbackIndex === 0) {
      // Try Object Storage proxy URL for REAL_ESTATE bucket
      if (filename) {
        setCurrentSrc(`/api/storage-proxy/REAL_ESTATE/real-estate-media/${filename}`);
      }
    } else if (fallbackIndex === 1) {
      // Try with direct Object Storage path
      if (filename) {
        setCurrentSrc(`/api/storage-proxy/direct-realestate/${filename}`);
      }
    } else if (fallbackIndex === 2) {
      // If URL has /uploads/, try without it
      if (originalPath.startsWith('uploads/')) {
        setCurrentSrc('/' + originalPath.substring(8));
      } else {
        // If URL doesn't have /uploads/, add it
        setCurrentSrc('/uploads/' + originalPath);
      }
    } else if (fallbackIndex === 3) {
      // Try with real-estate-media directly (bypassing uploads)
      if (filename) {
        setCurrentSrc('/real-estate-media/' + filename);
      }
    } else if (fallbackIndex === 4) {
      // Try uploads/real-estate-media/filename
      if (filename) {
        setCurrentSrc('/uploads/real-estate-media/' + filename);
      }
    }
    
    // Increment fallback index
    setFallbackIndex(prevIndex => prevIndex + 1);
  };

  if (loadFailed) {
    // Placeholder for when all image loading attempts fail
    return (
      <div 
        className={`bg-gray-100 flex items-center justify-center ${className}`}
        style={{ width: width || '100%', height: height || '200px' }}
      >
        <span className="text-gray-500 text-sm">Image not available</span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      width={width}
      height={height}
      onError={handleError}
    />
  );
};

export default ListingImage;