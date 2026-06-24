import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { normalizeMediaUrl } from '@/lib/media-cache';
import { createPortal } from 'react-dom';

export interface MediaGalleryItem {
  url: string;
  altText?: string;
  mediaType: 'image' | 'video';
}

interface MediaGalleryProps {
  items: MediaGalleryItem[];
  className?: string; 
  style?: React.CSSProperties;
}

export function MediaGallery({ items, className = '', style = {} }: MediaGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const currentItem = items[currentIndex];
  
  // Reset index when items change
  useEffect(() => {
    setCurrentIndex(0);
  }, [items]);

  // Handle escape key to close fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreen) return;
      
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isFullscreen, items.length]);

  const openFullscreen = useCallback((index?: number) => {
    if (typeof index === 'number') {
      setCurrentIndex(index);
    }
    setIsFullscreen(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);
  
  // If there are no items, don't render anything
  if (!items.length) return null;
  
  // If there's only one item, just render it without navigation
  if (items.length === 1) {
    return (
      <>
        <div 
          className={`media-gallery ${className} cursor-pointer relative group`} 
          style={style}
          onClick={() => openFullscreen(0)}
        >
          {renderMediaItem(items[0])}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
            <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
          </div>
        </div>
        {isFullscreen && <FullscreenLightbox 
          items={items} 
          currentIndex={currentIndex} 
          setCurrentIndex={setCurrentIndex}
          onClose={closeFullscreen}
        />}
      </>
    );
  }
  
  const handlePrevious = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Gallery: Previous button clicked, current index:', currentIndex);
    setCurrentIndex((prev) => {
      const newIndex = prev > 0 ? prev - 1 : items.length - 1;
      console.log('Gallery: Moving from index', prev, 'to index', newIndex);
      return newIndex;
    });
  }, [currentIndex, items.length]);
  
  const handleNext = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Gallery: Next button clicked, current index:', currentIndex);
    setCurrentIndex((prev) => {
      const newIndex = prev < items.length - 1 ? prev + 1 : 0;
      console.log('Gallery: Moving from index', prev, 'to index', newIndex);
      return newIndex;
    });
  }, [currentIndex, items.length]);
  
  // Touch/swipe support for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }, []);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  }, []);
  
  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe) {
      console.log('Gallery: Swipe left detected');
      handleNext({ preventDefault: () => {}, stopPropagation: () => {} } as React.MouseEvent);
    }
    if (isRightSwipe) {
      console.log('Gallery: Swipe right detected');
      handlePrevious({ preventDefault: () => {}, stopPropagation: () => {} } as React.MouseEvent);
    }
  }, [touchStart, touchEnd, handleNext, handlePrevious]);
  
  function renderMediaItem(item: MediaGalleryItem) {
    const normalizedUrl = normalizeMediaUrl(item.url);
    
    // Add fallback placeholder image
    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
      console.log("Image failed to load:", normalizedUrl);
      e.currentTarget.src = '/public/placeholder-image.jpg';
      e.currentTarget.onerror = null; // Prevent infinite loops
    };
    
    return item.mediaType === 'video' ? (
      <video 
        src={normalizedUrl}
        controls
        className="max-w-full h-auto"
        alt={item.altText || 'Video'}
        onError={(e) => {
          console.error(`Failed to load video at ${normalizedUrl}`);
          // Add error handling UI for videos if needed
          const videoElement = e.target as HTMLVideoElement;
          videoElement.poster = '/public/media-placeholder/video-placeholder.png';
          
          // Create error message overlay
          const parent = videoElement.parentElement;
          if (parent) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'absolute inset-0 flex items-center justify-center bg-black/50 text-white p-4 text-center text-sm';
            errorDiv.textContent = 'Video could not be loaded';
            parent.appendChild(errorDiv);
          }
        }}
      />
    ) : (
      <img 
        src={normalizedUrl}
        alt={item.altText || 'Image'}
        className="max-w-full h-auto object-contain"
        onError={(e) => {
          console.log(`Image failed to load: ${normalizedUrl}`);
          
          const target = e.target as HTMLImageElement;
          const currentFallbackIndex = parseInt(target.getAttribute('data-fallback-index') || '0');
          
          if (currentFallbackIndex >= 5) {
            // We've tried all fallbacks, show placeholder
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `
                <div class="bg-gray-100 flex items-center justify-center w-full h-64">
                  <span class="text-gray-500 text-sm">Image not available</span>
                </div>
              `;
            }
            return;
          }
          
          // Get original path without leading slash for processing
          const originalPath = item.url.startsWith('/') ? item.url.substring(1) : item.url;
          const filename = originalPath.split('/').pop();
          
          let nextSrc = '';
          
          // Try different path formats as fallbacks (same logic as ListingImage)
          if (currentFallbackIndex === 0) {
            // Try Object Storage proxy URL for REAL_ESTATE bucket
            if (filename) {
              nextSrc = `/api/storage-proxy/REAL_ESTATE/real-estate-media/${filename}`;
            }
          } else if (currentFallbackIndex === 1) {
            // Try with direct Object Storage path
            if (filename) {
              nextSrc = `/api/storage-proxy/direct-realestate/${filename}`;
            }
          } else if (currentFallbackIndex === 2) {
            // If URL has /uploads/, try without it
            if (originalPath.startsWith('uploads/')) {
              nextSrc = '/' + originalPath.substring(8);
            } else {
              // If URL doesn't have /uploads/, add it
              nextSrc = '/uploads/' + originalPath;
            }
          } else if (currentFallbackIndex === 3) {
            // Try with real-estate-media directly (bypassing uploads)
            if (filename) {
              nextSrc = '/real-estate-media/' + filename;
            }
          } else if (currentFallbackIndex === 4) {
            // Try uploads/real-estate-media/filename
            if (filename) {
              nextSrc = '/uploads/real-estate-media/' + filename;
            }
          }
          
          if (nextSrc) {
            target.setAttribute('data-fallback-index', (currentFallbackIndex + 1).toString());
            target.src = nextSrc;
          }
        }}
      />
    );
  }
  
  return (
    <>
      <div 
        className={`media-gallery relative ${className}`} 
        style={style}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Gallery counter */}
        <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm z-20">
          {currentIndex + 1} / {items.length}
        </div>
        
        {/* Navigation controls */}
        <div className="absolute top-1/2 left-0 right-0 flex justify-between items-center transform -translate-y-1/2 px-2 z-20 pointer-events-none">
          <Button 
            onClick={handlePrevious}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePrevious(e as any);
            }}
            size="icon"
            variant="secondary"
            className="rounded-full bg-black/60 hover:bg-black/80 text-white border-2 border-white/20 min-h-[48px] min-w-[48px] pointer-events-auto touch-manipulation"
            style={{ userSelect: 'none' }}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          
          <Button 
            onClick={handleNext}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNext(e as any);
            }}
            size="icon"
            variant="secondary"
            className="rounded-full bg-black/60 hover:bg-black/80 text-white border-2 border-white/20 min-h-[48px] min-w-[48px] pointer-events-auto touch-manipulation"
            style={{ userSelect: 'none' }}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
        
        {/* Current media item - clickable to open fullscreen */}
        <div 
          className="media-content flex justify-center items-center cursor-pointer relative group"
          onClick={() => openFullscreen(currentIndex)}
        >
          {renderMediaItem(currentItem)}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none">
            <Maximize2 className="w-10 h-10 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow-lg" />
          </div>
        </div>
        
        {/* Dot indicators - responsive for both desktop and mobile */}
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-3 z-20">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                console.log('Gallery: Dot clicked, moving to index', index);
                setCurrentIndex(index);
              }}
              className={`w-4 h-4 md:w-2 md:h-2 rounded-full transition-colors touch-manipulation ${
                currentIndex === index ? "bg-white" : "bg-white/50 hover:bg-white/80"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
      
      {/* Fullscreen lightbox */}
      {isFullscreen && <FullscreenLightbox 
        items={items} 
        currentIndex={currentIndex} 
        setCurrentIndex={setCurrentIndex}
        onClose={closeFullscreen}
      />}
    </>
  );
}

interface FullscreenLightboxProps {
  items: MediaGalleryItem[];
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
}

function FullscreenLightbox({ items, currentIndex, setCurrentIndex, onClose }: FullscreenLightboxProps) {
  const currentItem = items[currentIndex];
  
  const handlePrevious = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : items.length - 1));
  }, [items.length, setCurrentIndex]);
  
  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setCurrentIndex(prev => (prev < items.length - 1 ? prev + 1 : 0));
  }, [items.length, setCurrentIndex]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderFullscreenMedia = (item: MediaGalleryItem) => {
    const normalizedUrl = normalizeMediaUrl(item.url);
    
    return item.mediaType === 'video' ? (
      <video 
        src={normalizedUrl}
        controls
        autoPlay
        className="max-h-[70vh] max-w-[90vw] object-contain"
      />
    ) : (
      <img 
        src={normalizedUrl}
        alt={item.altText || 'Image'}
        className="max-h-[70vh] max-w-[90vw] object-contain"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          const filename = item.url.split('/').pop();
          if (filename && !target.dataset.tried) {
            target.dataset.tried = 'true';
            target.src = `/api/storage-proxy/REAL_ESTATE/real-estate-media/${filename}`;
          }
        }}
      />
    );
  };

  const lightboxContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
      onClick={handleBackdropClick}
    >
      {/* Header with close button and counter */}
      <div className="flex justify-between items-center p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-medium">
          {currentIndex + 1} / {items.length}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          aria-label="Close fullscreen"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      
      {/* Main image area with navigation */}
      <div className="flex-1 flex items-center justify-center relative px-4" onClick={(e) => e.stopPropagation()}>
        {/* Previous button */}
        <button
          onClick={(e) => { e.stopPropagation(); handlePrevious(e); }}
          className="absolute left-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-8 h-8 text-white" />
        </button>
        
        {/* Current image */}
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {renderFullscreenMedia(currentItem)}
        </div>
        
        {/* Next button */}
        <button
          onClick={(e) => { e.stopPropagation(); handleNext(e); }}
          className="absolute right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
          aria-label="Next image"
        >
          <ChevronRight className="w-8 h-8 text-white" />
        </button>
      </div>
      
      {/* Thumbnail strip at bottom */}
      <div className="p-4 bg-black/50" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center gap-2 overflow-x-auto pb-2">
          {items.map((item, index) => {
            const thumbUrl = normalizeMediaUrl(item.url);
            return (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                  currentIndex === index 
                    ? 'border-white scale-105' 
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                {item.mediaType === 'video' ? (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <span className="text-white text-xs">Video</span>
                  </div>
                ) : (
                  <img 
                    src={thumbUrl}
                    alt={item.altText || `Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const filename = item.url.split('/').pop();
                      if (filename && !target.dataset.tried) {
                        target.dataset.tried = 'true';
                        target.src = `/api/storage-proxy/REAL_ESTATE/real-estate-media/${filename}`;
                      }
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return null;
  }
  
  return createPortal(lightboxContent, document.body);
}