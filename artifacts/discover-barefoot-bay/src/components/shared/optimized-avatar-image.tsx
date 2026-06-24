import React, { useState, useEffect, useRef } from "react";
import { AvatarImage } from "@/components/ui/avatar";

interface OptimizedAvatarImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Enhanced avatar image component with loading states, error handling, and retry logic
 */
export function OptimizedAvatarImage({ 
  src, 
  alt, 
  className, 
  onLoad, 
  onError 
}: OptimizedAvatarImageProps) {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(src);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const maxRetries = 2;
  const retryDelay = 1000; // 1 second
  const loadTimeout = 8000; // 8 seconds timeout

  // Reset state when src changes
  useEffect(() => {
    if (src !== currentSrc) {
      setCurrentSrc(src);
      setImageState('loading');
      setRetryCount(0);
    }
  }, [src, currentSrc]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleImageLoad = () => {
    setImageState('loaded');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onLoad?.();
  };

  const handleImageError = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (retryCount < maxRetries && currentSrc) {
      // Retry with cache-busting parameter
      const separator = currentSrc.includes('?') ? '&' : '?';
      const retryUrl = `${currentSrc}${separator}retry=${retryCount + 1}&t=${Date.now()}`;
      
      setTimeout(() => {
        setCurrentSrc(retryUrl);
        setRetryCount(prev => prev + 1);
        setImageState('loading');
      }, retryDelay);
    } else {
      setImageState('error');
      onError?.();
    }
  };

  // Set loading timeout
  useEffect(() => {
    if (imageState === 'loading' && currentSrc) {
      timeoutRef.current = setTimeout(() => {
        handleImageError();
      }, loadTimeout);
    }
  }, [imageState, currentSrc]);

  // Don't render anything if no src
  if (!currentSrc) {
    return null;
  }

  return (
    <div className="relative w-full h-full">
      {/* Loading shimmer effect */}
      {imageState === 'loading' && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse rounded-full" />
      )}
      
      {/* Main image */}
      <AvatarImage
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        className={`transition-opacity duration-300 ${
          imageState === 'loaded' ? 'opacity-100' : 'opacity-0'
        } ${className || ''}`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="eager" // Prioritize avatar loading
      />
      
      {/* Retry indicator */}
      {imageState === 'loading' && retryCount > 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}