import { useState, useEffect, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, X, Play } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getMediaUrl, handleImageError } from "@/lib/media-helper";

interface EventMediaGalleryProps {
  mediaUrls: string[];
}

export function EventMediaGallery({ mediaUrls }: EventMediaGalleryProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    dragFree: false,
    containScroll: 'trimSnaps',
    skipSnaps: false,
    watchDrag: true,
    align: 'start'
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Return null if there are no media files
  if (!mediaUrls?.length) {
    return null;
  }

  // Set up embla carousel listeners
  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      console.log('EventMediaGallery: Slide changed to index:', index);
      setCurrentSlide(index);
    };
    
    const onInit = () => {
      console.log('EventMediaGallery: Embla initialized');
      setCurrentSlide(emblaApi.selectedScrollSnap());
    };
    
    emblaApi.on('select', onSelect);
    emblaApi.on('init', onInit);
    
    // Initialize immediately if already ready
    if (emblaApi.rootNode()) {
      onInit();
    }
    
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('init', onInit);
    };
  }, [emblaApi]);

  const scrollPrev = () => {
    console.log('EventMediaGallery: Previous button triggered, current slide:', currentSlide);
    if (emblaApi) {
      emblaApi.scrollPrev();
      console.log('EventMediaGallery: Scroll previous executed');
    } else {
      console.log('EventMediaGallery: EmblaApi not available');
    }
  };

  const scrollNext = () => {
    console.log('EventMediaGallery: Next button triggered, current slide:', currentSlide);
    if (emblaApi) {
      emblaApi.scrollNext();
      console.log('EventMediaGallery: Scroll next executed');
    } else {
      console.log('EventMediaGallery: EmblaApi not available');
    }
  };

  const isVideo = (url: string) => {
    // Check common video file extensions
    return url.match(/\.(mp4|webm|ogg|mov|quicktime|avi|wmv|flv|mkv)$/i) !== null;
  };

  console.log('EventMediaGallery render: Current slide:', currentSlide, 'Total slides:', mediaUrls.length);

  return (
    <div className="relative">
      <div 
        className="overflow-hidden rounded-lg" 
        ref={emblaRef}
        style={{ 
          position: 'relative',
          height: 'auto' 
        }}
      >
        <div 
          className="flex"
          style={{ 
            touchAction: 'pan-y',
            display: 'flex',
            flexDirection: 'row',
            height: '100%'
          }}
        >
          {mediaUrls.map((url, index) => {
            const isVideoFile = isVideo(url);
            
            return (
              <div 
                key={index} 
                className="relative min-w-0 cursor-pointer"
                onClick={() => setSelectedImage(url)}
                style={{ 
                  flex: '0 0 100%',
                  minWidth: 0,
                  position: 'relative'
                }}
              >
                {isVideoFile ? (
                  <div className="aspect-video bg-gray-800 relative">
                    <video 
                      className="w-full h-full object-contain pointer-events-auto"
                      controls
                      playsInline
                      preload="metadata"
                      src={getMediaUrl(url, 'event')}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      onError={(e) => {
                        console.error(`Video failed to load: ${url}`);
                        
                        // Extract the filename regardless of URL format
                        let filename;
                        if (url.includes('/')) {
                          filename = url.split('/').pop();
                        } else {
                          filename = url;
                        }
                        
                        if (filename) {
                          // ALWAYS try storage proxy path first
                          console.log(`Video load error recovery - using storage proxy path for: ${filename}`);
                          const proxyUrl = `/api/storage-proxy/CALENDAR/events/${filename}`;
                          (e.target as HTMLVideoElement).src = proxyUrl;
                          
                          // Add a second error handler that displays a message if proxy fails
                          (e.target as HTMLVideoElement).onerror = () => {
                            console.error(`Storage proxy failed for video ${filename}`);
                            
                            // Replace the video with an error message
                            const videoContainer = (e.target as HTMLVideoElement).parentElement;
                            if (videoContainer) {
                              videoContainer.innerHTML = `
                                <div class="flex flex-col items-center justify-center h-full p-2 bg-black/80 text-white rounded-lg text-xs">
                                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-500 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                  </svg>
                                  <p class="text-center text-gray-200 text-xs">Video unavailable</p>
                                </div>
                              `;
                            }
                          };
                        } else {
                          // Display error message for invalid URL format
                          console.error(`Invalid URL format for video: ${url}`);
                          const videoContainer = (e.target as HTMLVideoElement).parentElement;
                          if (videoContainer) {
                            videoContainer.innerHTML = `
                              <div class="flex flex-col items-center justify-center h-full p-2 bg-black/80 text-white rounded-lg text-xs">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-500 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                  <circle cx="12" cy="12" r="10"></circle>
                                  <line x1="12" y1="8" x2="12" y2="12"></line>
                                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                                <p class="text-center text-gray-200 text-xs">Video format error</p>
                              </div>
                            `;
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gray-100">
                    <img
                      src={getMediaUrl(url, 'event')}
                      alt={`Event media ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error(`Image failed to load: ${url}`);
                        
                        // Extract the filename regardless of URL format
                        let filename;
                        if (url.includes('/')) {
                          filename = url.split('/').pop();
                        } else {
                          filename = url;
                        }
                        
                        if (filename) {
                          // ALWAYS try storage proxy path first
                          console.log(`Image load error recovery - using storage proxy path for: ${filename}`);
                          const proxyUrl = `/api/storage-proxy/CALENDAR/events/${filename}`;
                          (e.target as HTMLImageElement).src = proxyUrl;
                          
                          // Add a second error handler to use default image if proxy fails
                          (e.target as HTMLImageElement).onerror = () => {
                            console.error(`Storage proxy failed for ${filename}, trying default image`);
                            // Try the SVG version first (more reliable)
                            (e.target as HTMLImageElement).src = '/default-event-image.svg'; // Use local file in public directory
                            
                            // Final fallback handler to ensure we stop the error cascade
                            (e.target as HTMLImageElement).onerror = () => {
                              console.error(`All fallbacks failed for ${filename}, using inline fallback`);
                              // Replace with an inline SVG as a final fallback that cannot fail
                              const container = (e.target as HTMLImageElement).parentElement;
                              if (container) {
                                container.innerHTML = `
                                  <div class="flex flex-col items-center justify-center h-full w-full bg-gray-100 text-gray-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" 
                                      stroke="currentColor" stroke-width="2" class="h-12 w-12 mb-2 opacity-70">
                                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                      <polyline points="21 15 16 10 5 21"></polyline>
                                    </svg>
                                    <span class="text-sm">Image unavailable</span>
                                  </div>
                                `;
                              }
                            };
                          };
                        } else {
                          // Direct fallback if we don't have a valid URL format
                          console.error(`Invalid URL format for media: ${url}`);
                          (e.target as HTMLImageElement).src = '/default-event-image.svg';
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {mediaUrls.length > 1 && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white border-2 border-white/20 min-h-[48px] min-w-[48px] z-30 touch-manipulation"
            style={{ 
              userSelect: 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none'
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Left button clicked');
              scrollPrev();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Left button touch start');
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Left button touch end');
              scrollPrev();
            }}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white border-2 border-white/20 min-h-[48px] min-w-[48px] z-30 touch-manipulation"
            style={{ 
              userSelect: 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none'
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Right button clicked');
              scrollNext();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Right button touch start');
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Right button touch end');
              scrollNext();
            }}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
          
          {/* Pagination indicators - responsive for both desktop and mobile */}
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-3 z-20">
            {mediaUrls.map((_, index) => (
              <button
                key={index}
                className={`w-4 h-4 md:w-2 md:h-2 rounded-full transition-colors touch-manipulation ${
                  currentSlide === index ? "bg-white" : "bg-white/50 hover:bg-white/80"
                }`}
                style={{ 
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none'
                }}
                aria-label={`Go to slide ${index + 1}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Dot clicked, going to slide:', index);
                  emblaApi?.scrollTo(index);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Dot touched, going to slide:', index);
                  emblaApi?.scrollTo(index);
                }}
              />
            ))}
          </div>
        </>
      )}

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-screen-xl max-h-screen p-0 overflow-hidden flex items-center justify-center bg-black/95">
          <DialogTitle className="sr-only">
            Event Media Viewer
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 z-50 bg-black/50 hover:bg-black/70 text-white"
            onClick={() => setSelectedImage(null)}
            aria-label="Close media viewer"
          >
            <X className="h-6 w-6" />
          </Button>
          
          {selectedImage && !isVideo(selectedImage) && (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={selectedImage ? getMediaUrl(selectedImage, 'event') : ''}
                alt="Full size image"
                className="max-w-full max-h-[90vh] w-auto h-auto object-contain"
                onError={(e) => {
                  console.error(`Fullscreen image failed to load: ${selectedImage}`);
                  
                  // Extract the filename regardless of URL format
                  let filename;
                  if (selectedImage.includes('/')) {
                    filename = selectedImage.split('/').pop();
                  } else {
                    filename = selectedImage;
                  }
                  
                  if (filename) {
                    // ALWAYS try storage proxy path first
                    console.log(`Fullscreen image load error recovery - using storage proxy path for: ${filename}`);
                    const proxyUrl = `/api/storage-proxy/CALENDAR/events/${filename}`;
                    (e.target as HTMLImageElement).src = proxyUrl;
                    
                    // Add a second error handler to use default image if proxy fails
                    (e.target as HTMLImageElement).onerror = () => {
                      console.error(`Storage proxy failed for ${filename}, trying default image`);
                      // Try the SVG version first (more reliable)
                      (e.target as HTMLImageElement).src = '/default-event-image.svg';
                      
                      // Final fallback handler to ensure we stop the error cascade
                      (e.target as HTMLImageElement).onerror = () => {
                        console.error(`All fallbacks failed for ${filename}, using inline fallback`);
                        // Replace with an inline SVG as a final fallback that cannot fail
                        const container = (e.target as HTMLImageElement).parentElement;
                        if (container) {
                          container.innerHTML = `
                            <div class="flex flex-col items-center justify-center h-full w-full bg-gray-100 text-gray-500 p-8 rounded-lg">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" 
                                stroke="currentColor" stroke-width="2" class="h-24 w-24 mb-4 opacity-70">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                              </svg>
                              <h3 class="text-xl font-medium mb-2">Image Unavailable</h3>
                              <p class="text-center text-gray-400 max-w-md">The requested image could not be loaded. It may have been moved or deleted.</p>
                            </div>
                          `;
                        }
                      };
                    };
                  } else {
                    // Direct fallback if we don't have a valid URL format
                    console.error(`Invalid URL format for media: ${selectedImage}`);
                    (e.target as HTMLImageElement).src = '/default-event-image.svg';
                  }
                }}
              />
            </div>
          )}
          
          {selectedImage && isVideo(selectedImage) && (
            <div className="relative bg-black/90 p-4 rounded-lg w-full max-w-4xl mx-auto">
              <video
                src={selectedImage ? getMediaUrl(selectedImage, 'event') : ''}
                className="max-w-full max-h-[80vh] w-full h-auto"
                controls
                autoPlay
                playsInline
                onError={(e) => {
                  console.error(`Video failed to load: ${selectedImage}`);
                  
                  // Extract the filename regardless of URL format
                  let filename;
                  if (selectedImage.includes('/')) {
                    filename = selectedImage.split('/').pop();
                  } else {
                    filename = selectedImage;
                  }
                  
                  if (filename) {
                    // ALWAYS try storage proxy path first
                    console.log(`Video load error recovery - using storage proxy path for: ${filename}`);
                    const proxyUrl = `/api/storage-proxy/CALENDAR/events/${filename}`;
                    (e.target as HTMLVideoElement).src = proxyUrl;
                    
                    // Add a second error handler that displays a message if proxy fails
                    (e.target as HTMLVideoElement).onerror = () => {
                      console.error(`Storage proxy failed for video ${filename}`);
                      
                      // Replace the video with an error message
                      const videoContainer = (e.target as HTMLVideoElement).parentElement;
                      if (videoContainer) {
                        videoContainer.innerHTML = `
                          <div class="flex flex-col items-center justify-center h-full p-8 bg-black/80 text-white rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-red-500 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="12" y1="8" x2="12" y2="12"></line>
                              <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            <h3 class="text-xl font-bold mb-2">Video Unavailable</h3>
                            <p class="text-center text-gray-200">Sorry, this video could not be loaded. It may have been moved or deleted.</p>
                          </div>
                        `;
                      }
                    };
                  } else {
                    // Display error message for invalid URL format
                    console.error(`Invalid URL format for video: ${selectedImage}`);
                    const videoContainer = (e.target as HTMLVideoElement).parentElement;
                    if (videoContainer) {
                      videoContainer.innerHTML = `
                        <div class="flex flex-col items-center justify-center h-full p-8 bg-black/80 text-white rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-red-500 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                          <h3 class="text-xl font-bold mb-2">Video Unavailable</h3>
                          <p class="text-center text-gray-200">Sorry, this video could not be loaded due to an invalid format.</p>
                        </div>
                      `;
                    }
                  }
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}