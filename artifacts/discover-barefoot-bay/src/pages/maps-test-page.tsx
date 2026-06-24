/**
 * Test page for Google Maps API
 * This page is used for testing and debugging the Google Maps API integration
 */
import React, { useState, useEffect } from "react";
import { PageTitle } from "@/components/shared/page-title";
import { GooglePlacesTester } from "@/components/maps/google-places-tester";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MapPin, RefreshCw } from "lucide-react";

export default function MapsTestPage() {
  const [loading, setLoading] = useState(true);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to load the Google Maps API script
  const loadGoogleMapsApi = () => {
    if (document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
      // Script already exists, don't add it again
      return;
    }

    setLoading(true);
    setApiLoaded(false);
    setError(null);

    // Create a new script element
    const script = document.createElement('script');
    script.src = `${window.location.origin}/google-maps-proxy?libraries=places`;
    script.async = true;
    script.defer = true;
    
    // Set up load and error handlers
    script.onload = () => {
      console.log("Google Maps API script loaded");
      setApiLoaded(true);
      setLoading(false);
    };
    
    script.onerror = (err) => {
      console.error("Error loading Google Maps API script:", err);
      setError("Failed to load Google Maps API. Please check your network connection or API key.");
      setLoading(false);
    };
    
    // Append the script to the document
    document.head.appendChild(script);
    
    // Set a timeout in case script doesn't load or trigger events
    setTimeout(() => {
      if (loading && !apiLoaded) {
        setLoading(false);
        setError("Google Maps API took too long to load. Please try again.");
      }
    }, 10000);
  };

  // Load the API when the component mounts
  useEffect(() => {
    // Check if the API is already loaded
    if (window.google?.maps?.places) {
      console.log("Google Maps API already loaded");
      setApiLoaded(true);
      setLoading(false);
      return;
    }
    
    loadGoogleMapsApi();
    
    // Cleanup function
    return () => {
      const existingScript = document.querySelector('script[src*="/google-maps-proxy"]');
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
    };
  }, []);

  const handleRetry = () => {
    loadGoogleMapsApi();
  };

  return (
    <div className="container py-6 px-4 md:px-6">
      <PageTitle title="Google Maps API Testing" description="Debug and test Google Maps API integration" />
      
      {loading ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            <p className="text-lg font-medium">Loading Google Maps API...</p>
            <p className="text-sm text-muted-foreground mt-2">This may take a few moments</p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="mt-6 border-red-200">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-red-700 flex items-center">
              <MapPin className="mr-2 h-5 w-5" />
              Google Maps API Error
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Unable to load Google Maps</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground mt-2">
              This might be due to network issues or an invalid API key. The application will use a simplified address input mode instead.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleRetry} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Loading API
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="mt-6">
          <GooglePlacesTester />
        </div>
      )}
    </div>
  );
}