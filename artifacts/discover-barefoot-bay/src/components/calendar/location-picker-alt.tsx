import React, { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, X, Search, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkLocationServiceStatus, getPlaceSuggestions, geocodeAddress as utilGeocodeAddress } from "@/lib/location-service";
import type { LocationServiceStatus } from "@/lib/location-service";

type LocationPickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

// Module-level cache so repeated mounts within the same page session don't
// re-hit the status endpoint.  TTL is 60 seconds.
let _cachedStatus: LocationServiceStatus | null = null;
let _cacheTimestamp = 0;
const STATUS_TTL_MS = 60_000;

async function getCachedLocationServiceStatus(): Promise<LocationServiceStatus> {
  const now = Date.now();
  if (_cachedStatus && now - _cacheTimestamp < STATUS_TTL_MS) {
    return _cachedStatus;
  }
  const status = await checkLocationServiceStatus();
  _cachedStatus = status;
  _cacheTimestamp = now;
  return status;
}

export function LocationPickerAlt({ value = "", onChange, placeholder }: LocationPickerProps) {
  const [inputValue, setInputValue] = useState(value || "");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [predictionsData, setPredictionsData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // true = soft info note (service may be down but input is still usable)
  const [isServiceWarning, setIsServiceWarning] = useState(false);
  const [isEditable, setIsEditable] = useState(!value); // Start editable if no initial value
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Update input value when external value changes (if not in edit mode)
    if (!isEditable) {
      setInputValue(value || "");
    }
  }, [value, isEditable]);
  
  // Check location service status once on component mount (result is cached).
  // A negative result shows a soft info note — it does NOT block the input or
  // prevent autocomplete from being attempted.
  useEffect(() => {
    const checkServiceStatus = async () => {
      try {
        const status = await getCachedLocationServiceStatus();
        if (!status.available) {
          // Soft warning only — the input remains editable and suggestions are
          // still attempted.  The per-suggestion error path handles real failures.
          setIsServiceWarning(true);
        }
      } catch (err) {
        console.error("Error checking location service status:", err);
        // Don't surface anything to the user — treat as "assume available".
      }
    };
    
    checkServiceStatus();
  }, []);

  // Cleanup function to prevent memory leaks
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // Server-side geocode using our utility function
  const geocodeAddress = useCallback(async (searchAddress: string): Promise<string | null> => {
    try {
      console.log("Using server-side geocoding via utility");
      
      // Use our utility function instead of direct fetch
      const data = await utilGeocodeAddress(searchAddress);
      
      if (data.results && data.results.length > 0) {
        return data.results[0].formatted_address || searchAddress;
      }
      
      return searchAddress;
    } catch (err) {
      console.error("Server geocoding error:", err);
      return searchAddress; // Return the original input if geocoding fails
    }
  }, []);

  // Function to handle manual address submission
  const handleManualSubmit = useCallback(async () => {
    if (!inputValue.trim()) return;
    
    // This is the only place we show loading state - when the user explicitly
    // clicks the "Set Address" button, not during typing
    setIsLoading(true);
    try {
      // Try to geocode the address for better formatting/validation
      const geocodedAddress = await geocodeAddress(inputValue);
      if (geocodedAddress) {
        setInputValue(geocodedAddress);
        onChange(geocodedAddress);
        setIsEditable(false);
      }
    } catch (err) {
      console.error("Error processing manual address:", err);
      // Use the raw input value if geocoding fails
      onChange(inputValue);
      setIsEditable(false);
    } finally {
      setIsLoading(false);
      setSuggestions([]);
      setPredictionsData([]);
    }
  }, [inputValue, onChange, geocodeAddress]);

  // Function to fetch address suggestions using the utility functions
  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!query.trim() || query.length < 3) {
        setSuggestions([]);
        setPredictionsData([]);
        return;
      }

      // Important: We're no longer setting loading state during typing
      // This ensures the user can continue typing without interruption
      // We'll only show loading for the explicit submit button
      
      // Clear any previous inline errors (the mount-time soft warning is separate)
      setError(null);
      
      try {
        // Use our utility function to get place suggestions
        const data = await getPlaceSuggestions(query);
        
        // Make sure the input still matches the query we used
        // Only update suggestions if user hasn't typed something new
        if (inputValue.trim() === query.trim()) {
          if (data.predictions && Array.isArray(data.predictions)) {
            // Store full prediction data for potential future use
            setPredictionsData(data.predictions);
            
            // Extract just the description for display
            const addressSuggestions = data.predictions.map((p: any) => p.description);
            setSuggestions(addressSuggestions);
          } else {
            console.warn("Place predictions invalid format:", data);
            setSuggestions([]);
            setPredictionsData([]);
          }
        }
      } catch (error) {
        console.error("Error fetching place suggestions:", error);
        setSuggestions([]);
        setPredictionsData([]);
        setError("Could not retrieve address suggestions. You can still enter your address manually.");
      }
    },
    [inputValue] // Add inputValue as dependency to access its current value
  );

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Always clear any pending timeouts when typing continues
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Only search when the user has typed at least 3 characters
    if (newValue.trim().length >= 3) {
      // Always wait for a typing pause before fetching suggestions
      // This prevents blocking the user's input experience
      timeoutRef.current = setTimeout(() => {
        fetchSuggestions(newValue);
      }, 400); // 400ms pause before fetching - responsive but not disruptive
    } else {
      // Clear suggestions when input is too short
      setSuggestions([]);
      setPredictionsData([]);
    }
  };

  // Handle selection of a suggestion
  const handleSelectSuggestion = (suggestion: string) => {
    setInputValue(suggestion);
    setSuggestions([]);
    setPredictionsData([]);
    onChange(suggestion);
    setIsEditable(false);
  };

  // Handle the clear button click
  const handleClear = () => {
    setInputValue("");
    onChange("");
    setSuggestions([]);
    setPredictionsData([]);
    setIsEditable(true);
    
    // Focus the input if it exists
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Perform cleanup on component unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return (
    <div className="w-full relative">
      {/* Soft info note when service status check indicates unavailability.
          Does NOT block typing or autocomplete — just informs the user they
          can type manually if suggestions don't appear. */}
      {isServiceWarning && !error && (
        <div className="p-2 mb-2 text-xs rounded border flex items-center gap-2 bg-muted border-muted-foreground/20 text-muted-foreground">
          <MapPin className="h-4 w-4 flex-shrink-0" />
          <p>Address suggestions may be limited. You can still type and submit an address manually.</p>
        </div>
      )}
      {/* Inline error shown only when an actual suggestion fetch fails */}
      {error && (
        <div className="p-2 mb-2 text-xs rounded border flex items-center gap-2 bg-amber-50 border-amber-200 text-amber-700">
          <MapPin className="h-4 w-4 flex-shrink-0 text-amber-500" />
          <p>{error}</p>
        </div>
      )}
      
      {isEditable ? (
        <div>
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder={placeholder || "Enter address for suggestions"}
              // Never disable the input - always allow typing
              className="pr-10 w-full"
              autoComplete="off" // Disable browser autocomplete to use our custom one
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleManualSubmit();
                }
              }}
            />
            
            {/* Only show the clear button, never show a loading spinner that would block typing */}
            {inputValue ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="absolute inset-y-0 right-0 flex items-center pr-3"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            ) : null}
          </div>
          
          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
              <ul className="py-1">
                {suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                    onClick={() => handleSelectSuggestion(suggestion)}
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="flex mt-2">
            <Button 
              type="button"
              variant="default"
              size="sm"
              className="ml-auto"
              disabled={isLoading || !inputValue.trim()}
              onClick={handleManualSubmit}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Set Address
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <div className="flex-1 text-sm py-2 px-3 border rounded-md bg-muted mobile-location-display">{inputValue}</div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsEditable(true)}
          >
            Edit
          </Button>
        </div>
      )}
    </div>
  );
}