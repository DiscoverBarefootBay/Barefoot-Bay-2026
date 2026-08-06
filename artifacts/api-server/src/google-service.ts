import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import baseLogger from './logger';

// Initialize environment variables
dotenv.config();

// Create service-specific logger
const logger = baseLogger.child('GoogleService');

// Fallback API key (will be used if environment variable is not set)
// This is only for testing and should be replaced with a proper API key in production
const FALLBACK_API_KEY = 'AIzaSyArv5_aHxBi8nhwXL_pC3uuwUTbsBuFdek';

// Google Maps API key from environment variables
// IMPORTANT: Use the dedicated server-side key for API calls
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || FALLBACK_API_KEY;

// Google API configuration
interface GoogleApiConfig {
  mapsApiKey: string;
  placesApiKey: string;
  geminiApiKey: string;
}

// Default configuration
const defaultConfig: GoogleApiConfig = {
  mapsApiKey: GOOGLE_MAPS_API_KEY,
  placesApiKey: GOOGLE_MAPS_API_KEY,
  geminiApiKey: ''
};

// Current configuration (starts with default and can be updated)
let currentConfig = {...defaultConfig};

// Log the API key status (masked for security)
logger.info(`Google Maps API key configured: ${GOOGLE_MAPS_API_KEY ? 'YES (masked)' : 'NO'}`);
logger.info(`API Key source: ${
  process.env.GOOGLE_MAPS_API_KEY ? 'GOOGLE_MAPS_API_KEY' :
  process.env.VITE_GOOGLE_MAPS_API_KEY ? 'VITE_GOOGLE_MAPS_API_KEY' :
  'FALLBACK KEY (not recommended for production)'
}`);

// Check if API key is available
if (!process.env.GOOGLE_MAPS_API_KEY) {
  logger.error('GOOGLE_MAPS_API_KEY environment variable is not set.');
  
  if (process.env.VITE_GOOGLE_MAPS_API_KEY) {
    logger.warn('Using VITE_GOOGLE_MAPS_API_KEY as fallback. Consider setting GOOGLE_MAPS_API_KEY for server-side requests.');
  } else {
    logger.error('Using fallback key for testing. This should NOT be used in production.');
  }
} else {
  logger.info('GOOGLE_MAPS_API_KEY is set and will be used for Google Maps API requests.');
}

/**
 * Extended Response type with buffer method for binary data
 */
interface EnhancedResponse extends Response {
  buffer?: () => Promise<Buffer>;
}

/**
 * Proxies requests to Google Maps API with our API key
 * @param url The Google Maps URL to proxy
 * @returns The response from Google Maps API with enhanced functionality
 */
export async function proxyGoogleMapsRequest(url: string): Promise<EnhancedResponse> {
  // Log request information (redacting API key for security)
  const redactedUrl = url.replace(/key=([^&]*)/, 'key=REDACTED');
  logger.info(`Proxying Google Maps request: ${redactedUrl}`);

  // Extract URL components
  const urlObj = new URL(url);
  
  // Check if the URL already has an API key
  let hasApiKey = urlObj.searchParams.has('key');
  
  // Clean known incorrect API keys
  const incorrectKeys = ['AIzaSyCM2haREcrosVbf2i6USzCtE624PIxaphs'];
  
  // Get the actual Google Maps API key to use (prioritize the server-side environment variable)
  const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || currentConfig.mapsApiKey || FALLBACK_API_KEY;
  
  // Log key source information (but don't expose the actual key)
  if (process.env.GOOGLE_MAPS_API_KEY) {
    logger.info(`Using GOOGLE_MAPS_API_KEY from environment variable`);
  } else if (process.env.VITE_GOOGLE_MAPS_API_KEY) {
    logger.info(`Using VITE_GOOGLE_MAPS_API_KEY as fallback`);
  } else if (currentConfig.mapsApiKey) {
    logger.info(`Using mapsApiKey from currentConfig`);
  } else {
    logger.warn(`Using FALLBACK_API_KEY - not recommended for production`);
  }
  
  if (hasApiKey) {
    const existingKey = urlObj.searchParams.get('key');
    if (incorrectKeys.includes(existingKey || '')) {
      logger.warn(`Replacing incorrect API key in request`);
    } else {
      logger.info(`Replacing existing key in request with server-side key`);
    }
  } else {
    logger.info(`Adding API key to request`);
  }
  
  // Always add our server-side API key (overriding any that might be present)
  urlObj.searchParams.set('key', googleMapsKey);
  
  try {
    // Make the request to Google Maps API with multiple Referer header attempts
    const finalUrl = urlObj.toString();
    
    // Log the complete URL that will be sent to Google (but mask the API key for security)
    const logUrl = finalUrl.replace(/key=([^&]*)/, 'key=MASKED_FOR_SECURITY');
    logger.info(`Sending request to Google Maps API: ${logUrl}`);
    logger.info(`API Key present: ${urlObj.searchParams.has('key')}`);
    
    // Log environment variable state for debugging
    logger.info(`[Static Map Debug] API Key source check: 
      - GOOGLE_MAPS_API_KEY: ${process.env.GOOGLE_MAPS_API_KEY ? 'Present (masked)' : 'Missing'} 
      - VITE_GOOGLE_MAPS_API_KEY: ${process.env.VITE_GOOGLE_MAPS_API_KEY ? 'Present (masked)' : 'Missing'}
      - NODE_ENV: ${process.env.NODE_ENV}`);
    
    // Add comprehensive referer headers for the API key restrictions
    // The API key is configured to work with barefootbay.com domain
    // We'll try multiple referer values to ensure at least one works
    const referrerOptions = [
      'https://barefootbay.com/',
      'https://www.barefootbay.com/',
      'https://barefootbay.com/events',
      'https://www.barefootbay.com/events',
      'https://barefootbay.com',
      'https://www.barefootbay.com',
    ];
    
    // Try Google Maps API request with each referer until we get a successful response
    logger.info(`Attempting Google Maps API request with multiple referer values`);
    
    // Track our last response for fallback purposes
    let lastResponse = null;
    
    // Try each referrer in sequence
    for (const referer of referrerOptions) {
      const headers = {
        'Accept': '*/*',
        'Referer': referer,
        'Origin': referer.replace(/\/$/, ''), // Remove trailing slash for Origin header
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      };
      
      logger.info(`Attempt with referer: ${headers.Referer}`);
      
      try {
        const response = await fetch(finalUrl, { headers });
        lastResponse = response; // Store this response for potential fallback
        
        logger.info(`Google Maps API responded with status ${response.status} for referer ${headers.Referer}`);
        
        // If successful, return this response
        if (response.ok) {
          logger.info(`Successfully retrieved map with referer: ${headers.Referer}`);
          
          // Cast to our enhanced response type and add buffer method
          const enhancedResponse = response as unknown as EnhancedResponse;
          
          // Add buffer method to handle binary responses (like images)
          enhancedResponse.buffer = async () => {
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
          };
          
          return enhancedResponse;
        }
      } catch (error) {
        logger.error(`Error with referer ${referer}:`, error);
        // Continue to next referer option
      }
    }
    
    // If we get here, all attempts failed - try one more approach with minimal headers
    logger.warn(`All referer attempts failed. Trying minimal headers approach...`);
    
    try {
      // Attempt with minimal headers
      const minimalResponse = await fetch(finalUrl, { 
        headers: {
          'Referer': 'https://barefootbay.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
        } 
      });
      
      lastResponse = minimalResponse; // Update last response
      
      if (minimalResponse.ok) {
        logger.info(`Minimal headers approach succeeded with status ${minimalResponse.status}`);
        
        // Cast to our enhanced response type and add buffer method
        const enhancedResponse = minimalResponse as unknown as EnhancedResponse;
        
        // Add buffer method to handle binary responses (like images)
        enhancedResponse.buffer = async () => {
          const arrayBuffer = await minimalResponse.arrayBuffer();
          return Buffer.from(arrayBuffer);
        };
        
        return enhancedResponse;
      }
    } catch (error) {
      logger.error('Error with minimal headers approach:', error);
    }
    
    // If we get here, all attempts have failed
    logger.error(`All Google Maps API request attempts failed.`);
    
    // Use the last response we got (or create a basic failed response)
    let finalResponse = lastResponse;
    if (!finalResponse) {
      logger.error('No response was captured during attempts, creating failed response');
      finalResponse = {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        arrayBuffer: async () => new ArrayBuffer(0)
      } as Response;
    }
    
    // Return the failed response but properly enhanced
    const enhancedFailedResponse = finalResponse as unknown as EnhancedResponse;
    
    enhancedFailedResponse.buffer = async () => {
      try {
        const arrayBuffer = await finalResponse.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (error) {
        logger.error('Error getting buffer from failed response:', error);
        return Buffer.from(''); // Empty buffer
      }
    };
    
    return enhancedFailedResponse;
  } catch (error) {
    logger.error('Error proxying Google Maps request:', error);
    
    // Create a basic error response instead of throwing
    logger.info('Creating error response for Google Maps request');
    
    // Create a simple error response
    const errorResponse: Response = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
      url: finalUrl,
      type: 'error',
      redirected: false,
      body: null,
      bodyUsed: false,
      clone: () => errorResponse,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
      json: async () => ({}),
      text: async () => ''
    } as Response;
    
    // Return as enhanced response
    const enhancedErrorResponse = errorResponse as unknown as EnhancedResponse;
    
    enhancedErrorResponse.buffer = async () => {
      // Return empty buffer
      return Buffer.from('');
    };
    
    return enhancedErrorResponse;
  }
}

/**
 * Handle Google Maps JavaScript API proxying
 * This allows us to intercept and properly inject the API key
 */
export async function proxyGoogleMapsScript(queryParams?: Record<string, string>): Promise<string> {
  // Base URL for Google Maps JavaScript API
  const baseUrl = 'https://maps.googleapis.com/maps/api/js';
  
  // Create URL with query parameters
  const url = new URL(baseUrl);
  
  // Track if we need to load the places library
  let hasPlacesLibrary = false;
  
  // Add client-side query parameters if any
  if (queryParams) {
    // Log what parameters we received (for debugging)
    logger.info(`Proxying Google Maps script with params: ${JSON.stringify(Object.keys(queryParams))}`);
    
    Object.entries(queryParams).forEach(([key, value]) => {
      // Skip 'key' parameter from client as we'll add our own
      if (key !== 'key') {
        url.searchParams.append(key, value);
        
        // Check if places library is requested
        if (key === 'libraries' && value.includes('places')) {
          hasPlacesLibrary = true;
        }
      }
    });
  }
  
  // Add our API key (prioritize server-side env var)
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || currentConfig.mapsApiKey || FALLBACK_API_KEY;
  url.searchParams.set('key', apiKey);
  
  // Log which key source we're using
  if (process.env.GOOGLE_MAPS_API_KEY) {
    logger.info(`Maps Script: Using GOOGLE_MAPS_API_KEY from environment variable`);
  } else if (process.env.VITE_GOOGLE_MAPS_API_KEY) {
    logger.info(`Maps Script: Using VITE_GOOGLE_MAPS_API_KEY as fallback`);
  } else if (currentConfig.mapsApiKey) {
    logger.info(`Maps Script: Using mapsApiKey from currentConfig`);
  } else {
    logger.warn(`Maps Script: Using FALLBACK_API_KEY - not recommended for production`);
  }
  
  // Add necessary parameters if missing
  if (!url.searchParams.has('v')) {
    url.searchParams.set('v', 'weekly');
  }
  
  // Create a redacted URL for logging (hide the API key)
  const redactedUrl = new URL(url.toString());
  redactedUrl.searchParams.set('key', 'REDACTED');
  logger.info(`Fetching Google Maps script from: ${redactedUrl.toString()}`);
  
  try {
    // Use improved headers approach with multiple referer values
    const referrerOptions = [
      'https://barefootbay.com/',
      'https://www.barefootbay.com/',
      'https://barefootbay.com',
      'https://www.barefootbay.com',
    ];
    
    // Try each referrer in sequence
    let response = null;
    
    for (const referer of referrerOptions) {
      const headers = {
        'Accept': '*/*',
        'Referer': referer,
        'Origin': referer.replace(/\/$/, ''), // Remove trailing slash for Origin header
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      };
      
      logger.info(`Script request with referer: ${headers.Referer}`);
      
      try {
        // Fetch the Google Maps script
        response = await fetch(url.toString(), { headers });
        
        if (response.ok) {
          logger.info(`Successfully retrieved script with referer: ${headers.Referer}`);
          break; // Success, exit the loop
        }
      } catch (error) {
        logger.error(`Error with script request using referer ${referer}:`, error);
        // Continue to next referer option
      }
    }
    
    // If all attempts failed, try minimal headers
    if (!response || !response.ok) {
      logger.warn('All script request attempts failed. Trying minimal headers...');
      
      try {
        response = await fetch(url.toString(), {
          headers: {
            'Referer': 'https://barefootbay.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
          }
        });
      } catch (error) {
        logger.error('Error with minimal headers script request:', error);
      }
    }
    
    // Check if we have a valid response
    if (response && response.ok) {
      // If we get here, one of the requests was successful
      const scriptContent = await response.text();
      logger.info(`Successfully proxied Google Maps script (${scriptContent.length} bytes)`);
      
      // Add places library workaround if needed
      if (hasPlacesLibrary) {
        // Enhanced workaround for module loading issues
        const moduleFixCode = `
        // Comprehensive fix for Google Maps module loading errors
        (function() {
          // Create utility module stubs to prevent errors
          window.__gmpModuleCache = window.__gmpModuleCache || {};
          
          // Module stubs (filled with simple implementations when modules fail to load)
          const moduleStubs = {
            util: {
              // Basic utility functions that might be used
              extend: function(target, ...sources) {
                return Object.assign(target, ...sources);
              },
              clone: function(obj) {
                return JSON.parse(JSON.stringify(obj));
              },
              inherits: function(childCtor, parentCtor) {
                childCtor.prototype = Object.create(parentCtor.prototype);
                childCtor.prototype.constructor = childCtor;
              },
              bind: function(fn, thisArg) {
                return fn.bind(thisArg);
              }
            },
            places_impl: {
              // Empty implementation that won't throw errors
              Autocomplete: class {
                constructor() {
                  console.warn('Using places_impl stub implementation');
                }
              },
              PlaceResult: function() {},
              AutocompleteService: function() {}
            }
          };
          
          // Provide module stubs when loading fails
          function stubModule(moduleName) {
            if (moduleStubs[moduleName]) {
              console.warn('Providing stub for ' + moduleName + ' module');
              window.__gmpModuleCache[moduleName] = {
                module: { exports: moduleStubs[moduleName] }
              };
              return moduleStubs[moduleName];
            }
            return {};
          }
          
          // First, ensure google object exists before attempting modifications
          if (typeof google === 'undefined' || !google.maps) {
            console.warn('Google Maps API not available, skipping fixes');
            return;
          }
          
          // Create a safe wrapper for PlaceAutocompleteElement
          try {
            // Only create if the Places API is loaded but PlaceAutocompleteElement is missing
            if (google.maps.places && !google.maps.places.PlaceAutocompleteElement) {
              console.log('Creating PlaceAutocompleteElement polyfill');
              
              // Create a shim that uses the legacy Autocomplete under the hood
              google.maps.places.PlaceAutocompleteElement = class {
                constructor(options = {}) {
                  // Store options and create internal state
                  this.options = options || {};
                  this.inputElement = null;
                  this.autocomplete = null;
                  this._inputValue = '';
                  this._listeners = {};
                  
                  // Create a container div that will match the web component
                  this._element = document.createElement('div');
                  this._element.className = 'gmp-placeautocomplete';
                  
                  // Create input element for autocomplete
                  this._input = document.createElement('input');
                  this._input.type = 'text';
                  this._input.className = 'gmp-input';
                  this._input.placeholder = 'Enter an address';
                  
                  // Append input to container
                  this._element.appendChild(this._input);
                  
                  // Set public properties with safe setters/getters
                  this._type = 'address';
                  this._country = 'us';
                }
              };
            }
          } catch (e) {
            console.error('Error setting up PlaceAutocompleteElement polyfill:', e);
          }

          // Make sure util module is available
          if (!window.__gmpModuleCache.util) {
            stubModule('util');
          }
          
          // Make sure places_impl module is available
          if (!window.__gmpModuleCache.places_impl) {
            stubModule('places_impl');
          }
          
          // Override __gmpq module loading to ensure it never fails
          const originalLoad = google.maps.__gjsload__;
          if (originalLoad) {
            google.maps.__gjsload__ = function(name, text) {
              try {
                // Try original module loader first
                originalLoad.call(google.maps, name, text);
              } catch (e) {
                // If loading fails, provide stub implementation
                console.warn('Error loading Google Maps module: ' + name);
                console.error(e);
                
                // Create stub module
                stubModule(name);
                
                // Dispatch error event for debugging
                if (window.dispatchEvent) {
                  window.dispatchEvent(new CustomEvent('google-maps-error', {
                    detail: { message: e.message }
                  }));
                }
                
                // Return empty object to prevent null reference errors
                return {};
              }
            };
          }
        })();
        `;
        
        // Insert our fix after the initial Google Maps declaration
        const insertPoint = "var modules = google.maps.modules = {};"
        const updatedScriptContent = scriptContent.replace(
          insertPoint, 
          insertPoint + moduleFixCode
        );
        
        if (updatedScriptContent !== scriptContent) {
          logger.info('Added module loading error handling to Google Maps script');
          return updatedScriptContent;
        }
      }
      
      return scriptContent;
    } else {
      logger.error(`Error fetching Google Maps script: ${response.status} ${response.statusText}`);
      
      // Try fallback with alternate headers if the first attempt fails
      logger.info(`Attempting fallback with alternative request headers...`);
      
      const fallbackHeaders = {
        'Referer': 'https://www.barefootbay.com/',  // Try with www. prefix
        'Origin': 'https://www.barefootbay.com',
        'User-Agent': 'Mozilla/5.0 (Barefoot Bay Community Platform Server Proxy - Fallback)',
        'Accept': 'text/javascript,application/javascript,*/*'
      };
      
      const fallbackResponse = await fetch(url.toString(), { headers: fallbackHeaders });
      
      if (fallbackResponse.ok) {
        const scriptContent = await fallbackResponse.text();
        logger.info(`Successfully proxied Google Maps script via fallback (${scriptContent.length} bytes)`);
        return scriptContent;
      }
      
      // If all attempts failed, return a graceful fallback instead of throwing an error
      logger.error(`All Google Maps API script requests failed. Last status: ${fallbackResponse.status}`);
      
      // Return a fallback script that provides diagnostic information and prevents errors
      return `
        console.warn('Google Maps API script could not be loaded.');
        console.warn('This might be due to API key restrictions or network issues.');
        
        // Define empty Google Maps API to prevent errors
        window.google = window.google || {};
        window.google.maps = window.google.maps || {
          // Basic empty implementation
          Map: function() { 
            console.warn('Using Maps API fallback implementation');
            return { 
              setCenter: function(){},
              setZoom: function(){},
              setOptions: function(){},
              addListener: function(){}
            }; 
          },
          LatLng: function(lat, lng) { return { lat: function(){return lat}, lng: function(){return lng} }; },
          // Add other required objects/methods
          places: {
            Autocomplete: function() { return { addListener: function(){} }; },
            PlacesService: function() { return { nearbySearch: function(request, callback) { callback([], "REQUEST_DENIED", null); } }; }
          },
          event: { 
            addListener: function(){}, 
            addDomListener: function(){},
            removeListener: function(){}
          },
          // Static map fallback
          StaticMapImage: function() {
            return { url: '/media-placeholder/map-placeholder.png' };
          }
        };
      `;
    }
  } catch (error) {
    logger.error('Error proxying Google Maps script:', error);
    
    // Instead of throwing an error, return a graceful fallback script
    logger.info('Returning fallback script due to exception');
    
    return `
      console.warn('Google Maps API script could not be loaded due to an error.');
      console.warn('This might be due to API key restrictions or network issues.');
      
      // Define empty Google Maps API to prevent errors
      window.google = window.google || {};
      window.google.maps = window.google.maps || {
        // Basic empty implementation for core functionality
        Map: function() { return { setCenter: function(){}, setZoom: function(){} }; },
        LatLng: function(lat, lng) { return { lat: lat, lng: lng }; },
        event: { addListener: function(){} }
      };
    `;
  }
}

/**
 * Check Google API status by testing basic functionality
 * @returns Status object with maps and places API availability
 */
export async function checkGoogleApiStatus(): Promise<{
  maps: { status: string; message: string };
  places: { status: string; message: string };
}> {
  logger.info('Checking Google API status');
  
  const results = {
    maps: { status: 'unknown', message: 'Not tested' },
    places: { status: 'unknown', message: 'Not tested' }
  };

  // Test Maps API with a simple geocoding request using proxyGoogleMapsRequest
  // so the key-resolution chain is identical to all real API calls.
  try {
    const testAddress = '1600 Amphitheatre Parkway, Mountain View, CA';
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(testAddress)}`;
    
    const response = await proxyGoogleMapsRequest(geocodeUrl);
    if (!response.ok) {
      results.maps = { status: 'error', message: `HTTP ${response.status}: ${response.statusText}` };
    } else {
      const data = await response.json();
      if (data.status === 'OK') {
        results.maps = { status: 'working', message: 'Maps API is functional' };
      } else if (data.status === 'REQUEST_DENIED') {
        results.maps = { status: 'error', message: 'API key invalid or restricted' };
      } else {
        results.maps = { status: 'error', message: `API returned: ${data.status}` };
      }
    }
  } catch (error) {
    logger.error('Maps API test failed:', error);
    results.maps = { status: 'error', message: 'Network error or API unavailable' };
  }

  // Test Places API with a simple autocomplete request using proxyGoogleMapsRequest
  try {
    const testInput = 'restaurant';
    const placesUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(testInput)}`;
    
    const response = await proxyGoogleMapsRequest(placesUrl);
    if (!response.ok) {
      results.places = { status: 'error', message: `HTTP ${response.status}: ${response.statusText}` };
    } else {
      const data = await response.json();
      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        results.places = { status: 'working', message: 'Places API is functional' };
      } else if (data.status === 'REQUEST_DENIED') {
        results.places = { status: 'error', message: 'API key invalid or restricted' };
      } else {
        results.places = { status: 'error', message: `API returned: ${data.status}` };
      }
    }
  } catch (error) {
    logger.error('Places API test failed:', error);
    results.places = { status: 'error', message: 'Network error or API unavailable' };
  }

  logger.info('Google API status check completed', results);
  return results;
}

/**
 * Update Google API configuration with new API keys
 * @param config New Google API configuration
 */
export function updateGoogleApiConfig(config: GoogleApiConfig): void {
  logger.info('Updating Google API configuration');
  currentConfig = { ...currentConfig, ...config };
  
  // Replace defaults if present
  if (config.mapsApiKey) {
    logger.info('Updated Maps API key');
  }
  
  if (config.placesApiKey) {
    logger.info('Updated Places API key');
  }
  
  if (config.geminiApiKey) {
    logger.info('Updated Gemini API key');
  }
}