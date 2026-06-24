import React, { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
// Import the Google Maps util module polyfill
import "@/components/maps/maps-util-polyfill";

type LocationPickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

// Helper function to construct a formatted address from address components
const constructAddressFromComponents = (components: any[] = []): string | null => {
  if (!components || !Array.isArray(components) || components.length === 0) {
    return null;
  }
  
  // Extract necessary address components
  const streetNumber = components.find(c => c.types?.includes('street_number'))?.text || '';
  const route = components.find(c => c.types?.includes('route'))?.text || '';
  const locality = components.find(c => c.types?.includes('locality'))?.text || '';
  const sublocality = components.find(c => c.types?.includes('sublocality'))?.text || '';
  const administrativeArea = components.find(c => c.types?.includes('administrative_area_level_1'))?.text || '';
  const country = components.find(c => c.types?.includes('country'))?.text || '';
  const postalCode = components.find(c => c.types?.includes('postal_code'))?.text || '';
  
  // Construct address with fallbacks
  const city = locality || sublocality;
  const streetAddress = `${streetNumber} ${route}`.trim();
  
  // Build a formatted address string
  const parts = [];
  if (streetAddress) parts.push(streetAddress);
  if (city) parts.push(city);
  if (administrativeArea) parts.push(administrativeArea);
  if (postalCode) parts.push(postalCode);
  if (country) parts.push(country);
  
  return parts.join(', ');
};

declare global {
  interface Window {
    google: any;
    initAutocomplete: () => void;
    handlePlacesError: (error: any) => void;
  }
}

export function LocationPicker({ value = "", onChange, placeholder }: LocationPickerProps) {
  const [inputValue, setInputValue] = useState(value || "");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditable, setIsEditable] = useState(!value); // Start editable if no initial value
  const [useFallbackMode, setUseFallbackMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const placeAutocompleteRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEditable) {
      setInputValue(value || "");
    }
  }, [value, isEditable]);

  // Cleanup function to prevent memory leaks
  const cleanup = useCallback(() => {
    // Clean up event listeners for Autocomplete API
    if (autocompleteRef.current && window.google?.maps?.event) {
      try {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      } catch (e) {
        console.warn("Error cleaning up autocomplete:", e);
      }
    }
    
    // Remove any added script tags
    if (scriptRef.current && document.head.contains(scriptRef.current)) {
      document.head.removeChild(scriptRef.current);
    }
    
    // Clear global callback
    if (window.initAutocomplete) {
      window.initAutocomplete = () => console.warn("Stale Google Maps callback called after component unmount");
    }
    
    if (window.handlePlacesError) {
      window.handlePlacesError = () => console.warn("Stale error handler called after component unmount");
    }
  }, []);

  // Server-side geocode fallback
  const geocodeAddress = useCallback(async (searchAddress: string): Promise<string | null> => {
    try {
      console.log("Using server-side geocoding as fallback");
      const response = await fetch(`/api/google/geocode?address=${encodeURIComponent(searchAddress)}`);
      
      if (!response.ok) {
        throw new Error(`Geocoding failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data?.results?.[0]?.formatted_address) {
        return data.results[0].formatted_address;
      }
      return null;
    } catch (error) {
      console.error("Server-side geocoding error:", error);
      return null;
    }
  }, []);

  // Manual search handler when in fallback mode
  const handleManualSearch = useCallback(async () => {
    if (!inputValue.trim()) return;
    
    setIsLoading(true);
    try {
      const formattedAddress = await geocodeAddress(inputValue);
      if (formattedAddress) {
        setInputValue(formattedAddress);
        onChange(formattedAddress);
        setIsEditable(false);
      } else {
        // If geocoding didn't return a formatted address, just use what the user entered
        onChange(inputValue);
      }
    } catch (e) {
      console.error("Error in manual search:", e);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, onChange, geocodeAddress]);

  // Function to initialize the new PlaceAutocompleteElement API
  const initializePlaceAutocompleteElement = () => {
    if (!containerRef.current || !window.google?.maps?.places?.PlaceAutocompleteElement) {
      console.error("Required PlaceAutocompleteElement API or container not available");
      return false;
    }

    try {
      console.log("Using new PlaceAutocompleteElement API");
      
      // Clear any existing content
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }

      // Create the Place Autocomplete Element
      // Warning: The API for PlaceAutocompleteElement is different from legacy Autocomplete
      try {
        // Create with minimal options to prevent 'Unknown property' errors
        placeAutocompleteRef.current = new window.google.maps.places.PlaceAutocompleteElement();
        
        // Set options after creation (this approach is more reliable with the new API)
        if (placeAutocompleteRef.current) {
          // Set input type to address (for addresses only)
          placeAutocompleteRef.current.type = 'address';
          
          // Set country restriction if available on this API version
          try {
            placeAutocompleteRef.current.componentRestrictions = { country: 'us' };
          } catch (restrictError) {
            console.warn('Could not set component restrictions:', restrictError);
          }
        }
      } catch (elementError) {
        console.error('Error creating PlaceAutocompleteElement:', elementError);
        
        // Fallback to even simpler initialization if the above fails
        try {
          placeAutocompleteRef.current = new window.google.maps.places.PlaceAutocompleteElement();
        } catch (fallbackError) {
          console.error('Complete failure initializing PlaceAutocompleteElement:', fallbackError);
          return false;
        }
      }

      // Add the element to our container
      containerRef.current.appendChild(placeAutocompleteRef.current);

      // Listen for place selection events
      placeAutocompleteRef.current.addEventListener('gmp-placeselect', (event: any) => {
        try {
          const place = event.detail.place;
          // Check various possible property names for the formatted address
          const formattedAddress = place?.formattedAddress || place?.formatted_address || place?.address;
          
          if (formattedAddress) {
            console.log("PlaceAutocompleteElement selected address:", formattedAddress);
            setInputValue(formattedAddress);
            onChange(formattedAddress);
            setIsEditable(false);
          } else {
            console.warn("No formatted address found in place object:", place);
            // If we can't find the address, try to construct from components
            if (place?.addressComponents) {
              const constructedAddress = constructAddressFromComponents(place.addressComponents);
              if (constructedAddress) {
                setInputValue(constructedAddress);
                onChange(constructedAddress);
                setIsEditable(false);
              }
            }
          }
        } catch (placeError) {
          console.error("Error handling place selection with PlaceAutocompleteElement:", placeError);
          setUseFallbackMode(true);
        }
      });

      // Update styling to match our UI
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        gmp-placeautocomplete {
          width: 100%;
          height: 40px;
          display: block;
          font-family: inherit;
        }
        
        .gmp-input {
          width: 100% !important;
          height: 40px !important;
          padding: 0 0.75rem !important;
          border-radius: 0.375rem !important;
          border: 1px solid hsl(var(--input)) !important;
          background-color: transparent !important;
          font-size: 0.875rem !important;
          color: hsl(var(--foreground)) !important;
          font-family: inherit !important;
        }
        
        /* Fix dropdown styling */
        .pac-container {
          border-radius: 0.375rem;
          margin-top: 4px;
          border: 1px solid hsl(var(--border));
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          background-color: hsl(var(--background));
          color: hsl(var(--foreground));
          font-family: inherit;
          z-index: 9999 !important;
        }
        
        .pac-item {
          padding: 8px 12px;
          color: hsl(var(--foreground));
          font-family: inherit;
          border-color: hsl(var(--border));
        }
        
        .pac-item:hover {
          background-color: hsl(var(--accent));
        }
      `;
      
      containerRef.current.appendChild(styleElement);
      
      return true;
    } catch (error) {
      console.error("Error initializing PlaceAutocompleteElement:", error);
      return false;
    }
  };

  // Function to initialize the legacy Autocomplete API as fallback
  const initializeAutocompleteAPI = () => {
    if (!inputRef.current || !window.google?.maps?.places) {
      console.error("Required dependencies not loaded");
      setUseFallbackMode(true);
      setIsLoading(false);
      return;
    }

    try {
      // Check if the Google Maps Places API is available
      const placesApi = window.google?.maps?.places;
      if (!placesApi) {
        console.error("Google Maps Places API not available");
        setUseFallbackMode(true);
        setIsLoading(false);
        return;
      }
      
      // For backward compatibility, use the legacy Autocomplete API
      console.log("Using legacy Autocomplete API for reliability");
      
      try {
        // Create a legacy Autocomplete instance which is more reliable
        if (!inputRef.current) {
          console.error("Input element reference not available");
          setUseFallbackMode(true);
          setIsLoading(false);
          return;
        }
        
        autocompleteRef.current = new placesApi.Autocomplete(
          inputRef.current,
          {
            types: ["address"],
            componentRestrictions: { country: "us" },
            fields: ["formatted_address", "geometry"]
          }
        );
        
        if (autocompleteRef.current && typeof autocompleteRef.current.addListener === 'function') {
          autocompleteRef.current.addListener("place_changed", () => {
            try {
              const place = autocompleteRef.current?.getPlace?.();
              if (place?.formatted_address) {
                setInputValue(place.formatted_address);
                onChange(place.formatted_address);
                setIsEditable(false);
              }
            } catch (placeError) {
              console.error("Error getting place details:", placeError);
              setUseFallbackMode(true);
            }
          });
        } else {
          console.error("Autocomplete object missing required methods");
          setUseFallbackMode(true);
        }
      } catch (autocompleteError) {
        console.error("Error initializing Autocomplete:", autocompleteError);
        setUseFallbackMode(true);
        setIsLoading(false);
      }

      // Fall back to manual mode if the autocomplete fails
      console.warn("Using manual address entry as backup");
      
      // Set up a safety check to ensure fallback mode works
      setTimeout(() => {
        if (!autocompleteRef.current) {
          console.warn("No active autocomplete after initialization, using fallback mode");
          setUseFallbackMode(true);
        }
      }, 1000);

      // Set up error handler for places_impl errors
      window.addEventListener('google-maps-places-error', (e: any) => {
        console.warn('Caught Places API implementation error:', e.detail);
        setUseFallbackMode(true);
      });

      setIsLoading(false);
    } catch (err) {
      console.error("Error initializing Autocomplete:", err);
      setError("Error initializing address search");
      setUseFallbackMode(true);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initialize Google Maps functionality once the library is loaded
    const initializeGoogleMaps = () => {
      // Try to initialize using the new PlaceAutocompleteElement first
      if (window.google?.maps?.places?.PlaceAutocompleteElement) {
        const success = initializePlaceAutocompleteElement();
        if (success) {
          setIsLoading(false);
          return;
        }
      }
      
      // Fall back to the legacy Autocomplete API if the new API fails
      initializeAutocompleteAPI();
    };

    // Set up global error handler for places_impl issues
    window.handlePlacesError = (error) => {
      console.warn("Places API error caught:", error);
      setUseFallbackMode(true);
      setIsLoading(false);
    };

    // Always initialize when the component mounts or becomes editable
    if (window.google?.maps?.places) {
      initializeGoogleMaps();
    } else {
      // Use our server-side proxy for loading Google Maps script
      const script = document.createElement("script");
      scriptRef.current = script;
      
      script.src = `${window.location.origin}/google-maps-proxy?libraries=places&callback=initAutocomplete`;
      script.async = true;
      script.defer = true;

      window.initAutocomplete = () => {
        console.log("Google Places API initialized via proxy");
        initializeGoogleMaps();
      };

      script.onerror = (error) => {
        console.error("Failed to load Google Maps script:", error);
        setError("Failed to load address search");
        setUseFallbackMode(true);
        setIsLoading(false);
        
        // Fallback to geocoding through our server API if autocomplete fails
        if (value) {
          setInputValue(value);
        }
      };

      document.head.appendChild(script);
      
      // Safety timeout - if script takes too long, show error
      const timeout = setTimeout(() => {
        if (isLoading) {
          console.warn("Google Maps script load timeout");
          setError("Address search timed out");
          setUseFallbackMode(true);
          setIsLoading(false);
        }
      }, 10000);
      
      return () => {
        clearTimeout(timeout);
        cleanup();
      };
    }

    return cleanup;
  }, [onChange, value, isLoading, cleanup]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (isEditable) {
      onChange(e.target.value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (useFallbackMode) {
        handleManualSearch();
      }
    }
  };

  const handleClearLocation = () => {
    setIsEditable(true);
    setInputValue('');
    onChange('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  return (
    <div className="relative w-full">
      {/* Container for PlaceAutocompleteElement - will be used if available */}
      <div 
        ref={containerRef}
        className={`w-full ${useFallbackMode ? 'hidden' : 'block'}`}
        style={{ minHeight: '40px' }}
      ></div>
      
      {/* Fallback Input - will be used if PlaceAutocompleteElement is not available */}
      <div className={`relative w-full flex gap-2 ${useFallbackMode ? 'block' : 'hidden'}`}>
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={error ? "Error loading address search" : (isLoading ? "Loading..." : (placeholder || "Enter your address..."))}
          className="w-full"
          disabled={isLoading}
        />
        
        {useFallbackMode && isEditable && !isLoading && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleManualSearch}
            className="flex-shrink-0"
            title="Search address"
          >
            <Search className="h-4 w-4" />
          </Button>
        )}
        
        {!isLoading && value && !isEditable && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleClearLocation}
            className="flex-shrink-0"
            title="Clear address"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
      
      {useFallbackMode && !error && (
        <div className="absolute top-full left-0 w-full text-xs text-muted-foreground mt-1">
          Using simple address search mode. Press enter or search to confirm.
        </div>
      )}
      
      {error && (
        <div className="absolute top-full left-0 w-full text-xs text-destructive mt-1">
          {error}. Using manual address input instead.
        </div>
      )}
    </div>
  );
}