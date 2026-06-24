import { apiRequest } from "@/lib/queryClient";

/**
 * LocationService status response from the API
 */
export interface LocationServiceStatus {
  available: boolean;
  services: {
    maps: boolean;
    places: boolean;
  };
  message: string;
}

/**
 * Check if location services are available
 * @returns Promise with location service status details
 */
export async function checkLocationServiceStatus(): Promise<LocationServiceStatus> {
  try {
    // Call the server-side endpoint to check Google Maps API status
    const response = await apiRequest('GET', '/api/location/service-status');
    return await response.json();
  } catch (error) {
    console.error('Error checking location service status:', error);
    // Return a default response assuming services are available to avoid UI disruption
    return {
      available: true,
      services: {
        maps: true,
        places: true
      },
      message: 'Location service status check failed, assuming available'
    };
  }
}

/**
 * Get a place autocomplete suggestion
 * @param input - Search text to get suggestions for
 * @returns Promise with place suggestions
 */
export async function getPlaceSuggestions(input: string) {
  try {
    if (!input || input.length < 3) {
      return { predictions: [] };
    }
    
    // Call the server-side proxy endpoint for Places API
    const response = await apiRequest('GET', `/api/google/places/autocomplete?input=${encodeURIComponent(input)}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching place suggestions:', error);
    return { predictions: [] };
  }
}

/**
 * Geocode an address to get latitude and longitude
 * @param address - Address to geocode
 * @returns Promise with geocoding results
 */
export async function geocodeAddress(address: string) {
  try {
    if (!address) {
      return { results: [] };
    }
    
    // Call the server-side proxy endpoint for Geocoding API
    const response = await apiRequest('GET', `/api/google/geocode?address=${encodeURIComponent(address)}`);
    return await response.json();
  } catch (error) {
    console.error('Error geocoding address:', error);
    return { results: [] };
  }
}