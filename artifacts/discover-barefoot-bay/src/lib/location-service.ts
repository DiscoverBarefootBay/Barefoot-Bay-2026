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

export type PlaceSuggestionsResult =
  | { ok: true; predictions: { description: string; place_id: string }[] }
  | { ok: false; denied: boolean; message: string };

/**
 * Get place autocomplete suggestions via the server-side proxy.
 * Returns a discriminated union so callers can distinguish a denied key
 * (needs Google Cloud Console fix) from a transient error.
 */
export async function getPlaceSuggestions(input: string): Promise<PlaceSuggestionsResult> {
  if (!input || input.length < 3) {
    return { ok: true, predictions: [] };
  }

  try {
    const response = await apiRequest('GET', `/api/google/places/autocomplete?input=${encodeURIComponent(input)}`);
    const data = await response.json();

    // Google returns status:'REQUEST_DENIED' when the Places API isn't enabled
    // on the key's Cloud project (billing alone is not enough — the API itself
    // must be toggled on at console.cloud.google.com/apis/library).
    if (data.status === 'REQUEST_DENIED') {
      console.error('Places API denied:', data.error_message);
      return {
        ok: false,
        denied: true,
        message:
          'Address suggestions unavailable — the Google Places API is not enabled for this project. ' +
          'Go to console.cloud.google.com/apis/library and enable "Places API".',
      };
    }

    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('Places API non-OK status:', data.status, data.error_message);
      return { ok: false, denied: false, message: 'Address suggestions temporarily unavailable.' };
    }

    return { ok: true, predictions: Array.isArray(data.predictions) ? data.predictions : [] };
  } catch (error) {
    console.error('Error fetching place suggestions:', error);
    return { ok: false, denied: false, message: 'Could not fetch address suggestions.' };
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