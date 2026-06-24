import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, AlertTriangle } from "lucide-react";
import { LocationPicker } from "@/components/calendar/location-picker";

// Extend window interface for our Google Maps error handling
declare global {
  interface WindowEventMap {
    'google-maps-load-error': CustomEvent;
    'google-maps-places-error': CustomEvent;
  }
}

/**
 * A component to test different implementation approaches for Google Maps Places API
 */
export function GooglePlacesTester() {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<string>("idle");
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiMode, setApiMode] = useState<string>("checking");
  
  // Function to load Google Maps API if it's not already loaded
  const loadGoogleMapsApi = useCallback(() => {
    // Return if the script is already in the document
    if (document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
      return;
    }
    
    // Create script element and add to document
    const script = document.createElement('script');
    script.src = `${window.location.origin}/google-maps-proxy?libraries=places`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      setApiError("Failed to load Google Maps API");
      setStatus("fallback");
    };
    
    document.head.appendChild(script);
  }, []);
  
  // Check Google Maps API mode when component mounts
  useEffect(() => {
    const checkGoogleMapsApi = () => {
      if (typeof window === 'undefined') return;
      
      // If Google Maps is not loaded yet, wait for it
      if (!window.google?.maps?.places) {
        setApiMode("loading");
        
        // Try to load the API if it's not already loading
        if (apiMode === "checking") {
          console.log("Google Maps API not found, attempting to load it");
          loadGoogleMapsApi();
        }
        return;
      }
      
      try {
        // Check which Places API is available
        const placesApi = window.google.maps.places;
        
        // Always use the legacy API for consistency with our implementation
        setApiMode("legacy");
        console.log("Using legacy Autocomplete API");
      } catch (error) {
        console.error("Error checking Google Maps API:", error);
        setApiError("Error initializing Google Maps API");
        setApiMode("error");
        setStatus("fallback");
      }
    };
    
    // Check initially
    checkGoogleMapsApi();
    
    // Set up a listener for when Google Maps loads
    const checkApiInterval = setInterval(() => {
      if (apiMode === "checking" || apiMode === "loading") {
        checkGoogleMapsApi();
      } else {
        clearInterval(checkApiInterval);
      }
    }, 1000);
    
    // Set a timeout for loading
    const timeout = setTimeout(() => {
      if (apiMode === "checking" || apiMode === "loading") {
        console.warn("Google Maps API load timeout");
        setApiError("Google Maps API failed to load in time");
        setApiMode("timeout");
        setStatus("fallback");
      }
    }, 10000);
    
    return () => {
      clearInterval(checkApiInterval);
      clearTimeout(timeout);
    };
  }, [apiMode, loadGoogleMapsApi]);
  
  const handleAddressChange = (newAddress: string) => {
    setAddress(newAddress);
    
    if (newAddress) {
      setStatus("success");
    }
  };
  
  const clearAddress = () => {
    setAddress("");
    setStatus("idle");
  };
  
  // Listen for any Google Maps errors on load
  useEffect(() => {
    const handleMapLoadError = (event: CustomEvent) => {
      console.warn("Google Maps error detected:", event.detail);
      setApiError(event.detail?.message || "Google Maps failed to load properly. Using fallback mode.");
      setStatus("fallback");
    };
    
    window.addEventListener('google-maps-load-error', handleMapLoadError);
    window.addEventListener('google-maps-places-error', handleMapLoadError);
    
    return () => {
      window.removeEventListener('google-maps-load-error', handleMapLoadError);
      window.removeEventListener('google-maps-places-error', handleMapLoadError);
    };
  }, []);
  
  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Google Places API Tester</CardTitle>
        <CardDescription>
          This component demonstrates our solution to the Google Places API deprecation issue
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="locationpicker">
          <TabsList className="mb-4">
            <TabsTrigger value="locationpicker">Location Picker</TabsTrigger>
            <TabsTrigger value="raw">Raw Status</TabsTrigger>
          </TabsList>
          
          <TabsContent value="locationpicker" className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Address Search</label>
                <LocationPicker 
                  value={address} 
                  onChange={handleAddressChange}
                  placeholder="Enter an address to test the API"
                />
              </div>
              
              {status === "success" && (
                <Alert className="bg-green-50">
                  <InfoIcon className="h-4 w-4" />
                  <AlertTitle>Success!</AlertTitle>
                  <AlertDescription>
                    Address selected: {address}
                  </AlertDescription>
                </Alert>
              )}
              
              {status === "fallback" && (
                <Alert className="bg-amber-50">
                  <InfoIcon className="h-4 w-4" />
                  <AlertTitle>Using Fallback Mode</AlertTitle>
                  <AlertDescription>
                    {apiError}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="raw" className="space-y-4">
            <div className="space-y-2">
              <div className="font-medium">API Mode:</div>
              <div className="p-2 bg-gray-100 rounded">
                {apiMode === "legacy" ? (
                  <span className="text-amber-600 font-medium">Legacy Autocomplete API</span>
                ) : (
                  <span className="text-gray-600">{apiMode}...</span>
                )}
              </div>
              
              <div className="font-medium">Current Status:</div>
              <div className="p-2 bg-gray-100 rounded">{status}</div>
              
              <div className="font-medium">Selected Address:</div>
              <div className="p-2 bg-gray-100 rounded break-all">{address || "(none)"}</div>
              
              {apiError && (
                <>
                  <div className="font-medium">Error:</div>
                  <div className="p-2 bg-red-50 rounded text-red-800">{apiError}</div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={clearAddress}>
          Clear
        </Button>
        <span className="text-sm text-muted-foreground">
          Using legacy Autocomplete API with manual fallback
        </span>
      </CardFooter>
    </Card>
  );
}