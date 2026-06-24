import { useState, useEffect } from 'react';
import { AlertCircle, Loader2, MapPin } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface StaticMapImageProps {
  location: string;
  width?: number;
  height?: number;
  zoom?: number;
  className?: string;
  showFallback?: boolean;
}

/**
 * Component that displays a static Google Map image
 * Handles direct API access and server-side proxy fallback automatically
 */
export function StaticMapImage({
  location,
  width = 600,
  height = 300,
  zoom = 15,
  className = '',
  showFallback = true,
}: StaticMapImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapUrl, setMapUrl] = useState<string>('');
  const [hasProxy, setHasProxy] = useState(true); // Assume proxy by default

  // Attempt direct connection to Google if API key is available
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  // Function to get a map URL with direct API access
  const getDirectMapUrl = () => {
    // Don't use direct URL approach - Google Maps API key restrictions 
    // are set for barefootbay.com domain, but the HEAD requests we use to check
    // appear to have the wrong Referer header in production
    return null;
    
    // Keeping the code below for reference, but not using it
    /*
    if (!apiKey) return null;
    
    // Create direct Google Maps URL with API key
    const params = new URLSearchParams({
      center: location,
      zoom: zoom.toString(),
      size: `${width}x${height}`,
      maptype: 'roadmap',
      markers: `color:red|${location}`,
      key: apiKey,
    });
    
    return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
    */
  };
  
  // Function to get a map URL via server proxy
  const getProxyMapUrl = () => {
    // Create proxy-based URL that uses server-side API key
    const params = new URLSearchParams({
      center: location,
      zoom: zoom.toString(),
      size: `${width}x${height}`,
      markers: `color:red|${location}`,
    });
    
    return `/api/google/staticmap?${params.toString()}`;
  };

  // Check if an image URL is valid
  const checkImageUrl = async (url: string): Promise<boolean> => {
    try {
      // Use fetch with HEAD request to check if the image exists without downloading it
      const response = await fetch(url, { 
        method: 'HEAD',
        headers: {
          'Referer': window.location.origin,
          'Origin': window.location.origin
        }
      });
      
      // Accept both 200 OK and 304 Not Modified as valid responses
      // 304 means the resource is valid but hasn't changed since last request
      return response.ok || response.status === 304;
    } catch (err) {
      console.error('Error checking image URL:', err);
      return false;
    }
  };

  // Load and verify the map image
  useEffect(() => {
    if (!location) {
      setError('No location provided');
      setIsLoading(false);
      return;
    }
    
    // Instead of complex validation, just use the proxy URL directly
    // This is more reliable in production environments and eliminates checking issues
    setIsLoading(false);
    setError(null);
    setMapUrl(getProxyMapUrl());
    setHasProxy(true);
    
    // Add a cache-busting parameter in production to ensure fresh content
    if (import.meta.env.PROD) {
      const cacheBuster = `_cb=${Date.now()}`;
      setMapUrl(prev => prev + (prev.includes('?') ? '&' : '?') + cacheBuster);
    }
  }, [location, width, height, zoom]);

  // Show loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-md ${className}`} style={{ width, height }}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show error state
  if (error && showFallback) {
    // Create a simple map fallback with a pin icon and styled background
    return (
      <div className={`flex flex-col items-center justify-center p-4 bg-gray-100 rounded-md ${className}`} style={{ minHeight: '200px' }}>
        <div className="bg-primary/10 p-4 rounded-full mb-2">
          <MapPin size={24} className="text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium mb-1">{location}</p>
          <p className="text-xs text-muted-foreground mb-3">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank')}
          >
            View on Google Maps
          </Button>
        </div>
      </div>
    );
  }

  // Prepare fallback image paths - try SVG first, then PNG as backup
  const svgFallbackPath = '/media-placeholder/map-placeholder.svg';
  const pngFallbackPath = '/media-placeholder/map-placeholder.png';

  // Show map image with enhanced fallback mechanism
  return (
    <div className={`overflow-hidden rounded-md ${className}`}>
      {mapUrl && (
        <div className="relative w-full h-full">
          {/* Primary map image */}
          <img
            src={mapUrl}
            alt={`Map showing ${location}`}
            width={width}
            height={height}
            className="object-cover w-full h-full"
            style={{ maxWidth: '100%' }}
            onError={(e) => {
              // Log the error for diagnostics
              console.log(`Map image failed to load: ${mapUrl}, using fallback`);
              
              // First try SVG fallback (vector format)
              if (showFallback && e.currentTarget.src !== svgFallbackPath && e.currentTarget.src !== pngFallbackPath) {
                e.currentTarget.src = svgFallbackPath;
                
                // Add a second error handler for the SVG fallback
                e.currentTarget.onerror = (e2) => {
                  console.log("SVG fallback failed, trying PNG");
                  // If SVG fails, try PNG
                  if (e2.currentTarget && e2.currentTarget.src !== pngFallbackPath) {
                    e2.currentTarget.src = pngFallbackPath;
                    
                    // Final fallback if PNG also fails
                    e2.currentTarget.onerror = () => {
                      console.log("All image fallbacks failed");
                      setError('Failed to load map image');
                    };
                  }
                };
              } else {
                // If we're already using a fallback that failed, show error
                setError('Failed to load map image');
              }
            }}
          />
          
          {/* Overlay with location text that's always visible */}
          <div className="absolute bottom-0 left-0 right-0 bg-white/70 p-1 text-center">
            <small className="text-gray-700 text-xs">{location}</small>
          </div>
        </div>
      )}
    </div>
  );
}