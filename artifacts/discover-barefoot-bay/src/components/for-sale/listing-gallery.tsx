import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ListingImage } from './listing-image';

interface ListingGalleryProps {
  mediaUrls: string[];
  thumbnailMode?: boolean;
  className?: string;
}

/**
 * Enhanced media gallery component that uses the ListingImage component
 * with fallback handling for real estate listing images
 */
export function ListingGallery({ mediaUrls, thumbnailMode = false, className = '' }: ListingGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  if (!mediaUrls || mediaUrls.length === 0) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center h-64 ${className}`}>
        <span className="text-gray-500">No images available</span>
      </div>
    );
  }

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? mediaUrls.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === mediaUrls.length - 1 ? 0 : prev + 1));
  };

  // For thumbnail mode (used in cards), only show the first image
  if (thumbnailMode) {
    return (
      <div className={`relative w-full h-full ${className}`}>
        <ListingImage
          src={mediaUrls[0]}
          alt="Listing image"
          className="w-full h-full object-cover"
        />
        {mediaUrls.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-md">
            +{mediaUrls.length - 1} more
          </div>
        )}
      </div>
    );
  }

  // For full gallery mode
  return (
    <div className={`relative w-full h-full ${className}`}>
      <div className="relative w-full h-full">
        <ListingImage
          src={mediaUrls[currentIndex]}
          alt={`Image ${currentIndex + 1} of ${mediaUrls.length}`}
          className="w-full h-full object-contain"
        />

        {/* Navigation buttons */}
        {mediaUrls.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1/2 left-2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full h-8 w-8 p-0"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full h-8 w-8 p-0"
              onClick={handleNext}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}

        {/* Image counter */}
        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
          {currentIndex + 1} / {mediaUrls.length}
        </div>

        {/* Fullscreen button */}
        <Dialog open={isFullscreenOpen} onOpenChange={setIsFullscreenOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 bg-black/40 hover:bg-black/60 text-white rounded-full h-8 w-8 p-0"
            >
              <Maximize2 className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[90vw] h-[90vh] p-0 border-none bg-black">
            <div className="relative w-full h-full flex items-center justify-center">
              <ListingImage
                src={mediaUrls[currentIndex]}
                alt={`Fullscreen image ${currentIndex + 1} of ${mediaUrls.length}`}
                className="max-w-full max-h-full object-contain"
              />
              
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full"
                onClick={() => setIsFullscreenOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>

              {mediaUrls.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white rounded-full h-10 w-10"
                    onClick={handlePrevious}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white rounded-full h-10 w-10"
                    onClick={handleNext}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}

              {/* Image counter */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-3 py-1 rounded-md">
                {currentIndex + 1} / {mediaUrls.length}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default ListingGallery;