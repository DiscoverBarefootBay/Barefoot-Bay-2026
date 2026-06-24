import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { GoogleMap, useLoadScript, Marker } from "@react-google-maps/api";
import { MapPin, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface LocationMapProps {
  location: string;
  className?: string;
}

// Default center coordinates (Barefoot Bay area)
const DEFAULT_CENTER = { lat: 28.0, lng: -80.5 };

export function LocationMap({ location, className }: LocationMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  // Check if API key exists
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  // Use a safer approach to specify libraries
  const libraries = useMemo(() => ["places"], []);
  
  // Set a maximum number of retries
  const MAX_RETRIES = 2;

  // Explicitly try to prevent fingerprinting issues by using consistent options
  const mapOptions = useMemo(() => ({
    fullscreenControl: false,
    streetViewControl: false,
    mapTypeControl: false,
    zoomControl: true,
    scrollwheel: false,  // Disable scroll to zoom
    clickableIcons: false, // Disable clickable POIs
    disableDefaultUI: false,
    styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }]
  }), []);

  // Check for API key on mount
  useEffect(() => {
    // We no longer immediately set apiKeyMissing since we have a proxy fallback
    if (!apiKey) {
      console.warn("Direct Google Maps API key is missing - will use server proxy instead");
      // Don't set apiKeyMissing, we'll let the proxy try to handle it
      // setApiKeyMissing(false);
    }
  }, [apiKey]);

  // Use our server-side proxy to handle the API key
  const loadScriptOptions = useMemo(() => {
    console.log(`Using Google Maps API via proxy: ${apiKey ? 'API key available as fallback' : 'Relying on server configuration'}`);
    
    // First attempt: Always use our server-side proxy for reliability
    // This is more reliable as the server can handle API key issues
    return {
      googleMapsApiKey: "",  // Empty since we'll use a custom loader
      googleMapsScriptBaseUrl: window.location.origin + "/google-maps-proxy",
      libraries: libraries as any,
      preventGoogleFontsLoading: false,
      version: undefined, // Don't specify version when using proxy
      channel: "barefoot-bay-community"
    };
    
    /* Original approach with direct API key usage
    if (apiKey) {
      // If we have an API key, use it directly
      return {
        googleMapsApiKey: apiKey,
        libraries: libraries as any,
        preventGoogleFontsLoading: false,
        version: "weekly",
        channel: "barefoot-bay-community"
      };
    } else {
      // Otherwise use proxy endpoint
      return {
        googleMapsApiKey: "",  // Empty since we'll use a custom loader
        googleMapsScriptBaseUrl: window.location.origin + "/google-maps-proxy",
        libraries: libraries as any,
        preventGoogleFontsLoading: false,
        version: undefined, // Don't specify version when using proxy
        channel: "barefoot-bay-community"
      };
    }
    */
  }, [apiKey, libraries]);

  const { isLoaded, loadError: scriptLoadError } = useLoadScript(loadScriptOptions);

  // Handle script load errors
  useEffect(() => {
    if (scriptLoadError) {
      console.error("Google Maps script load error:", scriptLoadError);
      setLoadError("Failed to load Google Maps");
      
      // Try to reload if we haven't hit the max retries
      if (retryCount < MAX_RETRIES) {
        const timer = setTimeout(() => {
          setRetryCount(prev => prev + 1);
          setLoadError(null); // Clear error to allow reloading
        }, 2000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [scriptLoadError, retryCount]);

  // Geocoding function with retry and fallback
  const geocodeAddress = useCallback(async (address: string) => {
    if (!window.google?.maps) {
      console.warn("Google Maps API not loaded, attempting server-side geocoding fallback");
      
      try {
        // Try server-side geocoding as a fallback
        const response = await fetch(`/api/google/geocode?address=${encodeURIComponent(address)}`);
        if (response.ok) {
          const data = await response.json();
          if (data?.results?.[0]?.geometry?.location) {
            return {
              lat: data.results[0].geometry.location.lat,
              lng: data.results[0].geometry.location.lng
            };
          }
        }
        console.error("Server-side geocoding failed");
        return DEFAULT_CENTER;
      } catch (error) {
        console.error("Server-side geocoding error:", error);
        return DEFAULT_CENTER;
      }
    }
    
    const geocoder = new window.google.maps.Geocoder();
    
    try {
      return await new Promise((resolve, reject) => {
        geocoder.geocode({ address }, (results, status) => {
          if (status === window.google.maps.GeocoderStatus.OK && results?.[0]) {
            resolve({
              lat: results[0].geometry.location.lat(),
              lng: results[0].geometry.location.lng(),
            });
          } else {
            reject(new Error(`Geocoding failed: ${status}`));
          }
        });
      });
    } catch (error) {
      console.warn(`Geocoding error for "${address}":`, error);
      // Return default location as fallback
      return DEFAULT_CENTER;
    }
  }, []);

  // Cleanup function for map resources
  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      mapRef.current = null;
    };
  }, []);

  // Handle map loading state
  const handleMapLoad = useCallback(async (map: google.maps.Map) => {
    mapRef.current = map;
    try {
      const coords = await geocodeAddress(location);
      map.setCenter(coords as google.maps.LatLngLiteral);

      // Clear existing marker if any
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }

      // Create new marker
      markerRef.current = new google.maps.Marker({
        position: coords as google.maps.LatLngLiteral,
        map,
        animation: google.maps.Animation.DROP
      });
    } catch (error) {
      console.error("Error setting up map:", error);
      setLoadError("Could not display location on map");
    }
  }, [location, geocodeAddress]);

  // Render error state when API key is missing
  if (apiKeyMissing) {
    return (
      <Alert variant="destructive" className={`${className}`}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Map Unavailable</AlertTitle>
        <AlertDescription>
          Google Maps configuration is missing. Please contact support.
          <div className="mt-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank')}
              className="flex items-center gap-1"
            >
              <ExternalLink className="h-4 w-4" />
              View on Google Maps
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Render a fallback UI if the map isn't loaded or there's an error
  if (!isLoaded || loadError) {
    return (
      <div className={`${className} bg-muted rounded-lg flex flex-col items-center justify-center p-4`}>
        <MapPin className="h-8 w-8 mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">
          {loadError || (retryCount > 0 ? `Trying to load map (attempt ${retryCount}/${MAX_RETRIES})...` : "Loading location map...")}
        </p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank')}
          className="flex items-center gap-1"
        >
          <ExternalLink className="h-4 w-4" />
          View Location
        </Button>
      </div>
    );
  }

  // Render the actual map
  return (
    <GoogleMap
      zoom={15}
      center={DEFAULT_CENTER}
      mapContainerClassName={`${className} rounded-lg shadow-sm border border-muted`}
      options={mapOptions}
      onLoad={handleMapLoad}
      onUnmount={() => {
        if (markerRef.current) {
          markerRef.current.setMap(null);
          markerRef.current = null;
        }
        mapRef.current = null;
      }}
    />
  );
}