import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getMediaUrl } from "@/lib/media-helper";

interface EventMediaGallerySimpleProps {
  mediaUrls: string[];
}

export function EventMediaGallerySimple({ mediaUrls }: EventMediaGallerySimpleProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Return null if there are no media files
  if (!mediaUrls?.length) {
    return null;
  }

  const goToPrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : mediaUrls.length - 1;
    console.log('EventMediaGallery: Going to previous slide:', newIndex);
    setCurrentIndex(newIndex);
  };

  const goToNext = () => {
    const newIndex = currentIndex < mediaUrls.length - 1 ? currentIndex + 1 : 0;
    console.log('EventMediaGallery: Going to next slide:', newIndex);
    setCurrentIndex(newIndex);
  };

  const goToSlide = (index: number) => {
    console.log('EventMediaGallery: Going to slide:', index);
    setCurrentIndex(index);
  };

  const isVideo = (url: string) => {
    return url.match(/\.(mp4|webm|ogg|mov|quicktime|avi|wmv|flv|mkv)$/i) !== null;
  };

  const currentUrl = mediaUrls[currentIndex];
  const isVideoFile = isVideo(currentUrl);

  console.log('EventMediaGallery render: Showing slide', currentIndex, 'of', mediaUrls.length, 'URL:', currentUrl);

  return (
    <>
      <div className="relative">
        {/* Main display area */}
        <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden relative">
          <div 
            className="w-full h-full cursor-pointer"
            onClick={() => setSelectedImage(currentUrl)}
          >
            {isVideoFile ? (
              <video 
                key={currentUrl} // Force re-render when URL changes
                className="w-full h-full object-contain bg-gray-800"
                controls
                playsInline
                preload="metadata"
                src={getMediaUrl(currentUrl, 'event')}
                onError={(e) => {
                  console.error(`Video failed to load: ${currentUrl}`);
                  
                  let filename;
                  if (currentUrl.includes('/')) {
                    filename = currentUrl.split('/').pop();
                  } else {
                    filename = currentUrl;
                  }
                  
                  if (filename) {
                    const proxyUrl = `/api/storage-proxy/CALENDAR/events/${filename}`;
                    (e.target as HTMLVideoElement).src = proxyUrl;
                  }
                }}
              />
            ) : (
              <img 
                key={currentUrl} // Force re-render when URL changes
                className="w-full h-full object-contain bg-gray-100"
                src={getMediaUrl(currentUrl, 'event')}
                alt={`Event media ${currentIndex + 1}`}
                onError={(e) => {
                  console.error(`Image failed to load: ${currentUrl}`);
                  
                  let filename;
                  if (currentUrl.includes('/')) {
                    filename = currentUrl.split('/').pop();
                  } else {
                    filename = currentUrl;
                  }
                  
                  if (filename) {
                    const proxyUrl = `/api/storage-proxy/CALENDAR/events/${filename}`;
                    (e.target as HTMLImageElement).src = proxyUrl;
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Navigation buttons - only show if more than 1 item */}
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
                goToPrevious();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Left button touch end');
                goToPrevious();
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
                goToNext();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Right button touch end');
                goToNext();
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
                    currentIndex === index ? "bg-white" : "bg-white/50 hover:bg-white/80"
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
                    goToSlide(index);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Dot touched, going to slide:', index);
                    goToSlide(index);
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal for full-screen view */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-black/90">
          <DialogTitle className="sr-only">Full size media view</DialogTitle>
          <div className="relative w-full h-full flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20 z-50"
              onClick={() => setSelectedImage(null)}
            >
              <X className="h-6 w-6" />
            </Button>
            {selectedImage && (
              isVideo(selectedImage) ? (
                <video 
                  className="max-w-full max-h-full object-contain"
                  controls
                  autoPlay
                  playsInline
                  src={getMediaUrl(selectedImage, 'event')}
                />
              ) : (
                <img 
                  className="max-w-full max-h-full object-contain"
                  src={getMediaUrl(selectedImage, 'event')}
                  alt="Full size view"
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}