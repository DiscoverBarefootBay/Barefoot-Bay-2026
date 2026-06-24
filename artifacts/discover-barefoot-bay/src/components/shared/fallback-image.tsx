import { useState } from 'react';
import { cn } from '@/lib/utils';

interface FallbackImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

/**
 * FallbackImage component that handles image loading errors by trying alternative paths
 * Particularly useful for real estate media which might exist in multiple locations
 */
export function FallbackImage({ 
  src, 
  alt, 
  fallbackSrc = '/default-property-image.jpg',
  className,
  ...props 
}: FallbackImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [attemptCount, setAttemptCount] = useState(0);
  
  const handleError = () => {
    // Only attempt different paths if we haven't already tried multiple times
    if (attemptCount < 3) {
      setAttemptCount(prev => prev + 1);
      
      // Try alternate paths based on common patterns in the application
      if (imgSrc?.includes('/real-estate-media/')) {
        console.log('Trying uploads path for:', imgSrc);
        setImgSrc(imgSrc.replace('/real-estate-media/', '/uploads/real-estate-media/'));
      } else if (imgSrc?.includes('/uploads/real-estate-media/')) {
        console.log('Trying direct path for:', imgSrc);
        setImgSrc(imgSrc.replace('/uploads/real-estate-media/', '/real-estate-media/'));
      } else if (imgSrc?.includes('/calendar/')) {
        console.log('Trying real-estate-media path for calendar image:', imgSrc);
        const filename = imgSrc.split('/').pop();
        if (filename) {
          setImgSrc(`/uploads/real-estate-media/${filename}`);
        }
      } else {
        // If we've tried multiple paths or don't recognize the pattern, use the fallback
        console.log('Using fallback image for:', imgSrc);
        setImgSrc(fallbackSrc);
      }
    } else if (imgSrc !== fallbackSrc) {
      // If we've tried multiple times and still failed, use the final fallback
      console.log('All paths failed, using fallback for:', src);
      setImgSrc(fallbackSrc);
    }
  };
  
  return (
    <img 
      src={imgSrc} 
      alt={alt} 
      onError={handleError} 
      className={cn('object-cover', className)}
      {...props} 
    />
  );
}