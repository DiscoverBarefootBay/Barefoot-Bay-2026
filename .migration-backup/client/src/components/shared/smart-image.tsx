import React, { useState, useEffect } from 'react';

/**
 * SmartImage component that handles multiple path formats and error cases
 * 
 * Features:
 * - Tries multiple path formats (with/without /uploads/ prefix, domain-relative, absolute)
 * - Falls back to alternative paths if the primary path fails
 * - Handles CDN and cache-related issues
 * - Provides a placeholder for missing images
 * - Supports additional image attributes
 */
interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  forceWidth?: number;
  forceHeight?: number;
  disableFullDomainFallback?: boolean;
  cacheBust?: boolean;
}

export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  className = '',
  fallbackSrc,
  forceWidth,
  forceHeight,
  disableFullDomainFallback = false,
  cacheBust = false,
  ...props
}) => {
  // Track which path format we're currently using
  const [currentSrc, setCurrentSrc] = useState<string>(src);
  const [pathIndex, setPathIndex] = useState<number>(0);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Generate possible paths for the image
  const generatePaths = (originalSrc: string): string[] => {
    if (!originalSrc) return [];
    
    // Clean the source path first
    let cleanPath = originalSrc.trim();
    
    // Handle empty or null paths
    if (!cleanPath) {
      return [];
    }
    
    // Strip query params for path manipulation, but keep them for actual usage
    let queryParams = '';
    if (cleanPath.includes('?')) {
      const parts = cleanPath.split('?');
      cleanPath = parts[0];
      queryParams = `?${parts[1]}`;
    }
    
    // Add cache-busting parameter if requested
    if (cacheBust) {
      queryParams = queryParams ? 
        `${queryParams}&t=${Date.now()}` : 
        `?t=${Date.now()}`;
    }
    
    // Ensure path is absolute (starts with /)
    if (!cleanPath.startsWith('/') && !cleanPath.startsWith('http')) {
      cleanPath = `/${cleanPath}`;
    }
    
    // Extract the path segments
    const segments = cleanPath.split('/').filter(s => s.length > 0);
    
    // No segments (e.g., just "/" or empty string)
    if (segments.length === 0) {
      return [];
    }
    
    // Create variations
    const variations: string[] = [];
    
    // Original path - this is always first
    variations.push(`${cleanPath}${queryParams}`);
    
    // Handle uploads directory variations
    if (cleanPath.includes('/uploads/')) {
      // Without /uploads prefix
      variations.push(cleanPath.replace('/uploads/', '/') + queryParams);
    } else if (segments.length >= 2) {
      // With /uploads prefix
      const pathWithUploads = `/${segments.slice(0, 1).map(s => `uploads/${s}`).join('/')}/${segments.slice(1).join('/')}`;
      variations.push(pathWithUploads + queryParams);
    }

    // Also try paths without leading slash for edge cases
    if (cleanPath.startsWith('/')) {
      variations.push(cleanPath.substring(1) + queryParams);
    }
    
    // For common directory patterns, try alternatives
    if (cleanPath.includes('real-estate-media')) {
      // Try both with and without uploads
      variations.push(`/real-estate-media/${segments[segments.length - 1]}${queryParams}`);
      variations.push(`/uploads/real-estate-media/${segments[segments.length - 1]}${queryParams}`);
    } else if (cleanPath.includes('forum-media')) {
      variations.push(`/forum-media/${segments[segments.length - 1]}${queryParams}`);
      variations.push(`/uploads/forum-media/${segments[segments.length - 1]}${queryParams}`);
    } else if (cleanPath.includes('vendor-media')) {
      variations.push(`/vendor-media/${segments[segments.length - 1]}${queryParams}`);
      variations.push(`/uploads/vendor-media/${segments[segments.length - 1]}${queryParams}`);
    } else if (cleanPath.includes('calendar')) {
      variations.push(`/calendar/${segments[segments.length - 1]}${queryParams}`);
      variations.push(`/uploads/calendar/${segments[segments.length - 1]}${queryParams}`);
    } else if (cleanPath.includes('banner-slides')) {
      variations.push(`/banner-slides/${segments[segments.length - 1]}${queryParams}`);
      variations.push(`/uploads/banner-slides/${segments[segments.length - 1]}${queryParams}`);
    } else if (cleanPath.includes('avatars')) {
      variations.push(`/avatars/${segments[segments.length - 1]}${queryParams}`);
      variations.push(`/uploads/avatars/${segments[segments.length - 1]}${queryParams}`);
    }
    
    // For remote assets, we don't add more variations to avoid CORS issues
    if (!cleanPath.startsWith('http') && !disableFullDomainFallback) {
      // Attempt with full domain for production cases
      // This helps when the site might be served from a CDN or subdomain
      const productionDomain = 'https://barefootbay.com';
      variations.push(`${productionDomain}${cleanPath}${queryParams}`);
    }

    // Filter out duplicate paths
    return variations.filter((value, index, self) => self.indexOf(value) === index);
  };

  const paths = React.useMemo(() => generatePaths(src), [src, cacheBust, disableFullDomainFallback]);
  
  // Determine the width and height to use
  const width = forceWidth || (props.width as number) || undefined;
  const height = forceHeight || (props.height as number) || undefined;

  // Handle image errors by trying the next path
  const handleError = () => {
    // If we've tried all paths, show the fallback or placeholder
    if (pathIndex >= paths.length - 1) {
      setHasError(true);
      if (fallbackSrc) {
        setCurrentSrc(fallbackSrc);
      }
      return;
    }
    
    // Try the next path
    setPathIndex(pathIndex + 1);
    setCurrentSrc(paths[pathIndex + 1]);
  };

  const handleLoad = () => {
    setIsLoaded(true);
  };

  // Update current source when path index changes
  useEffect(() => {
    if (paths.length > 0 && pathIndex < paths.length) {
      setCurrentSrc(paths[pathIndex]);
    }
  }, [pathIndex, paths]);

  // Reset state when src changes
  useEffect(() => {
    setPathIndex(0);
    setHasError(false);
    setIsLoaded(false);
    setCurrentSrc(paths[0] || src);
  }, [src, paths]);

  if (hasError && !fallbackSrc) {
    // Render placeholder for failed images
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 ${className}`}
        style={{ width: width ? `${width}px` : '100%', height: height ? `${height}px` : '200px' }}
        title={`Could not load image: ${alt}`}
      >
        <div className="text-center p-4">
          <svg 
            className="mx-auto h-12 w-12 text-gray-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
            />
          </svg>
          <p className="mt-2 text-sm text-gray-500">Image not available</p>
        </div>
      </div>
    );
  }

  // Render the image with the current source
  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={handleError}
      onLoad={handleLoad}
      width={width}
      height={height}
      {...props}
    />
  );
};

/**
 * BannerImage component specifically optimized for banner slides
 */
export const BannerImage: React.FC<SmartImageProps> = (props) => {
  return <SmartImage {...props} forceWidth={1200} forceHeight={400} />;
};

/**
 * AvatarImage component specifically optimized for user avatars
 */
export const AvatarImage: React.FC<SmartImageProps> = (props) => {
  return <SmartImage {...props} forceWidth={100} forceHeight={100} />;
};

/**
 * ListingImage component specifically optimized for real estate listings
 */
export const ListingImage: React.FC<SmartImageProps> = (props) => {
  // Default fallback for listing images
  const fallbackSrc = props.fallbackSrc || '/placeholder-home.jpg';
  
  return (
    <SmartImage 
      {...props} 
      fallbackSrc={fallbackSrc}
      forceWidth={props.forceWidth || 400}
      forceHeight={props.forceHeight || 300}
    />
  );
};

export default SmartImage;