/**
 * Google Maps Utility Module Polyfill - Enhanced Version
 * 
 * This polyfill addresses multiple issues with Google Maps JS API:
 * 1. The "Could not load util" error that breaks Places API
 * 2. Content Security Policy (CSP) violations when using Maps API
 * 3. Various browser compatibility issues with module loading
 * 
 * It provides a more comprehensive set of polyfills and installs them
 * aggressively at the earliest possible moment to prevent loading failures.
 */

// Only run the polyfill if we're in a browser environment
if (typeof window !== 'undefined') {
  console.log('[Maps Polyfill] Initializing enhanced Google Maps polyfill');

  // Create utility module with the all required functions needed by Google Maps
  const utilModuleExports = {
    // Core utility functions
    clone: function(obj: any) {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
      
      // Handle arrays
      if (Array.isArray(obj)) {
        return [...obj];
      }
      
      // Handle dates
      if (obj instanceof Date) {
        return new Date(obj.getTime());
      }
      
      // Handle regular objects (try to cover possible circular references)
      try {
        return JSON.parse(JSON.stringify(obj));
      } catch (e) {
        // Fallback implementation for circular references or non-serializable objects
        const result: Record<string, any> = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            result[key] = obj[key];
          }
        }
        return result;
      }
    },
    
    extend: function(target: any, ...sources: any[]) {
      if (!target) return {};
      
      for (const source of sources) {
        if (source) {
          for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
              target[key] = source[key];
            }
          }
        }
      }
      
      return target;
    },
    
    inherits: function(childCtor: any, parentCtor: any) {
      if (typeof childCtor !== 'function' || typeof parentCtor !== 'function') {
        return;
      }
      
      childCtor.prototype = Object.create(parentCtor.prototype);
      childCtor.prototype.constructor = childCtor;
      
      // Also copy static properties
      for (const prop in parentCtor) {
        if (Object.prototype.hasOwnProperty.call(parentCtor, prop)) {
          childCtor[prop] = parentCtor[prop];
        }
      }
    },
    
    bind: function(fn: Function, context: any) {
      if (typeof fn !== 'function') {
        return function() {};
      }
      return fn.bind(context);
    },
    
    // Additional utility functions that Maps API might need
    isDef: function(val: any) {
      return val !== undefined;
    },
    
    isNull: function(val: any) {
      return val === null;
    },
    
    isDefAndNotNull: function(val: any) {
      return val != null; // Intentionally using loose comparison
    },
    
    isArray: Array.isArray,
    
    isObject: function(val: any) {
      const type = typeof val;
      return type === 'object' && val !== null || type === 'function';
    },
    
    toArray: function(obj: any) {
      return Array.prototype.slice.call(obj || [], 0);
    }
  };

  // Function to check if Google Maps is available
  const isGoogleMapsLoaded = (): boolean => {
    return typeof window.google !== 'undefined' && 
           typeof window.google.maps !== 'undefined';
  };

  // Install module in Google Maps module cache - different versions use different patterns
  const installModulePolyfill = (moduleName: string, moduleExports: any) => {
    try {
      if (!isGoogleMapsLoaded()) return false;

      // Method 1: Using __gmpModuleCache (newer versions)
      if (!window.__gmpModuleCache) {
        (window as any).__gmpModuleCache = {};
      }

      // Create module cache entry
      (window as any).__gmpModuleCache[moduleName] = {
        module: { exports: moduleExports }
      };
      
      // Method 2: Add module directly to google.maps namespace (older versions)
      const parts = moduleName.split('/');
      let currentObj = window.google.maps;
      
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!currentObj[part]) {
          currentObj[part] = {};
        }
        currentObj = currentObj[part];
      }
      
      // Last part is the actual module name
      const modulePart = parts[parts.length - 1];
      if (!currentObj[modulePart]) {
        currentObj[modulePart] = moduleExports;
      }
      
      console.log(`[Maps Polyfill] Successfully installed polyfill for "${moduleName}" module`);
      return true;
    } catch (e) {
      console.error(`[Maps Polyfill] Error installing polyfill for ${moduleName}:`, e);
    }
    return false;
  };

  // Handle errors from Google Maps module loading
  const createErrorHandler = () => {
    // Create a custom error event to notify components of Places API issues
    const dispatchPlacesError = (error: any) => {
      const errorEvent = new CustomEvent('google-maps-places-error', {
        detail: { error, message: error?.message || 'Unknown Maps error' }
      });
      window.dispatchEvent(errorEvent);
    };
    
    // Replace fetch to capture CSP errors
    // ONLY IF NOT ALREADY POLYFILLED - this prevents double polyfilling
    if (!window.fetch.__mapsPolyfilled) {
      console.log('[Maps Polyfill] Installing fetch polyfill');
      const originalFetch = window.fetch;
      
      // Add a property to identify our polyfilled version
      const wrappedFetch = function(input: RequestInfo, init?: RequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        
        // CRITICAL FIX: ALWAYS allow FormData uploads to pass through without any interception
        // This is absolutely essential for file uploads to work properly
        if (init?.body instanceof FormData) {
          console.log('[Maps Polyfill] BYPASSING for FormData upload:', url);
          // Use original fetch to prevent any interference with uploads
          return originalFetch.apply(this, arguments);
        }
        
        // CRITICAL FIX: ALWAYS allow all API requests to pass through without any interception
        // This ensures the application's own APIs work correctly
        if (url && typeof url === 'string' && (url.includes('/api/') || url.startsWith('/api/'))) {
          console.log('[Maps Polyfill] BYPASSING for API request:', url);
          return originalFetch.apply(this, arguments);
        }
        
        // If it's a Google Maps resource that would be blocked by CSP, intercept it
        if (url && typeof url === 'string' && url.includes('maps.googleapis.com') && url.includes('gen_204')) {
          console.warn('[Maps Polyfill] Intercepted Maps CSP-blocked request:', url);
          
          // Return a fake successful response to prevent errors
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
            text: () => Promise.resolve(''),
            headers: new Headers(),
          } as Response);
        }
        
        // Explicitly allow Gemini API requests through without interception
        if (url && typeof url === 'string' && url.includes('generativelanguage.googleapis.com')) {
          console.log('[Maps Polyfill] Allowing Gemini API request to pass through:', url);
          return originalFetch.apply(this, arguments);
        }
        
        // Otherwise proceed with the original fetch
        return originalFetch.apply(this, arguments);
      };
      
      // Add marker property to detect if already polyfilled
      (wrappedFetch as any).__mapsPolyfilled = true;
      
      // Replace the global fetch
      window.fetch = wrappedFetch;
    };
    
    // Set up window.onerror to catch the specific Map errors
    const originalOnError = window.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
      if (typeof message === 'string' && message.includes('Could not load "util"')) {
        console.warn('[Maps Polyfill] Caught util module error in onerror:', message);
        dispatchPlacesError({ message, source, lineno, colno, error });
        return true; // Prevent default error handling
      }
      
      if (originalOnError) {
        return originalOnError.call(window, message, source, lineno, colno, error);
      }
      return false;
    };
    
    // Also listen for unhandled promise rejections which might contain Maps errors
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      if (error && typeof error.message === 'string' && 
          (error.message.includes('Could not load "util"') || 
           error.message.includes('Google Maps'))) {
        console.warn('[Maps Polyfill] Caught Maps error in unhandled rejection:', error);
        dispatchPlacesError(error);
        event.preventDefault();
      }
    });
  };

  // Observe script additions to patch Maps scripts as soon as they're added
  const setupWatcher = () => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node.nodeName === 'SCRIPT' && 
                (node as HTMLScriptElement).src && 
                (node as HTMLScriptElement).src.includes('maps.googleapis.com')) {
              
              // Google Maps script detected, prepare for its load
              console.log('[Maps Polyfill] Google Maps script detected, applying pre-load hooks');
              
              // Add load event listener
              (node as HTMLScriptElement).addEventListener('load', () => {
                console.log('[Maps Polyfill] Google Maps script loaded, installing polyfills');
                setTimeout(installPolyfills, 0);
              });
              
              // Add error event listener
              (node as HTMLScriptElement).addEventListener('error', (error) => {
                console.error('[Maps Polyfill] Google Maps script failed to load:', error);
                // Dispatch custom error event
                window.dispatchEvent(new CustomEvent('google-maps-error', { 
                  detail: { error, type: 'script-load-failure' } 
                }));
              });
            }
          }
        }
      }
    });

    // Observe document and its descendants for script additions
    observer.observe(document.documentElement, { 
      childList: true,
      subtree: true
    });

    // Also check if Google Maps is already loaded
    if (isGoogleMapsLoaded()) {
      console.log('[Maps Polyfill] Google Maps already loaded, installing polyfills now');
      installPolyfills();
    }
  };

  // Install all required polyfills
  const installPolyfills = () => {
    // Check if Google is already defined
    if (!isGoogleMapsLoaded()) {
      console.warn('[Maps Polyfill] Google Maps not loaded yet, will try again later');
      setTimeout(installPolyfills, 500);
      return;
    }

    // Install the util module polyfill
    installModulePolyfill('util', utilModuleExports);
    installModulePolyfill('common/util', utilModuleExports);

    // Create a more robust places_impl stub with the minimum functionality needed
    const placesImplStub = {
      __polyfilled: true,
      Autocomplete: class {
        constructor() {
          console.warn('[Maps Polyfill] Using places_impl.Autocomplete stub implementation');
        }
        addListener() { return { remove: () => {} }; }
        bindTo() { return this; }
        get() { return null; }
        notify() { return this; }
        set() { return this; }
      },
      PlaceResult: function() {},
      AutocompleteService: function() {
        return {
          getPlacePredictions: function(request: any, callback: any) {
            console.warn('[Maps Polyfill] Using AutocompleteService stub');
            // Return empty results to avoid crashes
            setTimeout(() => callback([], 'OK'), 0);
            return;
          }
        };
      },
      PlacesService: function() {
        return {
          getDetails: function(request: any, callback: any) {
            console.warn('[Maps Polyfill] Using PlacesService stub');
            setTimeout(() => callback(null, 'NOT_FOUND'), 0);
            return;
          },
          findPlaceFromQuery: function(request: any, callback: any) {
            console.warn('[Maps Polyfill] Using PlacesService.findPlaceFromQuery stub');
            setTimeout(() => callback([], 'OK'), 0);
            return;
          }
        };
      }
    };

    // Install the places_impl module with more robust stubs
    // Make extra effort to ensure this specific module works
    installModulePolyfill('places_impl', placesImplStub);
    installModulePolyfill('common/places_impl', placesImplStub);
    
    // Make explicit places directory structure
    if (window.google && window.google.maps) {
      if (!window.google.maps.places) {
        window.google.maps.places = {};
      }
      
      // Ensure these specific classes exist
      if (!window.google.maps.places.AutocompleteService) {
        window.google.maps.places.AutocompleteService = placesImplStub.AutocompleteService;
      }
      
      if (!window.google.maps.places.PlacesService) {
        window.google.maps.places.PlacesService = placesImplStub.PlacesService;
      }
    }

    // Comprehensive set of additional modules that may be needed
    const additionalModules = [
      'common',
      'marker',
      'common/stats',
      'places/place_impl',
      'map',
      'geometry',
      'drawing',
      'visualization'
    ];
    
    // Install minimum stubs for these modules
    for (const module of additionalModules) {
      installModulePolyfill(module, {
        // This is a stub implementation that will be replaced by actual
        // module if it loads successfully, but prevents crashes if it doesn't
        __polyfilled: true
      });
    }

    // The core patches for the module system
    monitorModuleLoading();
    
    // Dispatch event that polyfill is installed
    window.dispatchEvent(new Event('google-maps-polyfill-loaded'));
  };

  // Add aggressive module loading error handling
  const monitorModuleLoading = () => {
    if (!isGoogleMapsLoaded()) return;
    
    // If Load function exists, we need to patch it to handle module loading errors
    if (window.google.maps.Load && typeof window.google.maps.Load === 'function') {
      const originalLoad = window.google.maps.Load;
      
      // Monkey patch Load function to handle module loading errors
      window.google.maps.Load = function(apiLoad: any) {
        // Not the expected format, just call original
        if (!apiLoad || !Array.isArray(apiLoad) || !apiLoad[0] || typeof apiLoad[0] !== 'function') {
          return originalLoad.apply(this, arguments);
        }

        const originalModuleLoader = apiLoad[0];
        
        // Replace module loader with our patched version
        apiLoad[0] = function(moduleArr: any) {
          try {
            // Attempt to call the original
            return originalModuleLoader(moduleArr);
          } catch (e: any) {
            // Extract module name from error
            const moduleName = (e.message || '').match(/Could not load "([^"]+)"/)?.[1];
            console.warn(`[Maps Polyfill] Caught module loading error for "${moduleName || 'unknown'}": ${e.message}`);
            
            // Dispatch custom error event
            window.dispatchEvent(new CustomEvent('google-maps-module-error', { 
              detail: { error: e, moduleName } 
            }));
            
            // Return our polyfill for specific modules
            if (moduleName === 'util') {
              console.log('[Maps Polyfill] Substituting util module polyfill');
              return utilModuleExports;
            }
            
            // Special handling for the places_impl module
            if (moduleName === 'places_impl') {
              console.log('[Maps Polyfill] Substituting places_impl module polyfill');
              // Create places_impl polyfill with necessary stubs on the fly
              const placesImplStub = {
                __polyfilled: true,
                Autocomplete: class {
                  constructor() {
                    console.warn('[Maps Polyfill] Using places_impl.Autocomplete stub implementation');
                  }
                  addListener() { return { remove: () => {} }; }
                  bindTo() { return this; }
                  get() { return null; }
                  notify() { return this; }
                  set() { return this; }
                },
                PlaceResult: function() {},
                AutocompleteService: function() {
                  return {
                    getPlacePredictions: function(request: any, callback: any) {
                      console.warn('[Maps Polyfill] Using AutocompleteService stub');
                      // Return empty results to avoid crashes
                      setTimeout(() => callback([], 'OK'), 0);
                      return;
                    }
                  };
                },
                PlacesService: function() {
                  return {
                    getDetails: function(request: any, callback: any) {
                      console.warn('[Maps Polyfill] Using PlacesService stub');
                      setTimeout(() => callback(null, 'NOT_FOUND'), 0);
                      return;
                    },
                    findPlaceFromQuery: function(request: any, callback: any) {
                      console.warn('[Maps Polyfill] Using PlacesService.findPlaceFromQuery stub');
                      setTimeout(() => callback([], 'OK'), 0);
                      return;
                    }
                  };
                }
              };
              
              // Make sure places services are available through the standard API too
              if (window.google && window.google.maps) {
                if (!window.google.maps.places) {
                  window.google.maps.places = {};
                }
                
                // Ensure these specific classes exist
                if (!window.google.maps.places.AutocompleteService) {
                  window.google.maps.places.AutocompleteService = placesImplStub.AutocompleteService;
                }
                
                if (!window.google.maps.places.PlacesService) {
                  window.google.maps.places.PlacesService = placesImplStub.PlacesService;
                }
              }
              
              return placesImplStub;
            }
            
            // Return empty object for other modules to prevent crashes
            return {};
          }
        };
        
        try {
          // Call the original Load with our patched loader
          return originalLoad(apiLoad);
        } catch (e) {
          console.error('[Maps Polyfill] Error in patched Load function:', e);
          
          // Try to salvage the situation with direct module installation
          installPolyfills();
          
          // Return undefined to allow continued execution
          return undefined;
        }
      };
      
      console.log('[Maps Polyfill] Successfully patched Google Maps module loader');
    } else {
      console.warn('[Maps Polyfill] Google Maps Load function not found, using alternative patching method');
      
      // If no Load function, we try to directly install modules
      installPolyfills();
    }
  };

  // Initialize error handlers
  createErrorHandler();

  // Install global polyfill (accessible via window.googleMapsUtilPolyfill)
  (window as any).googleMapsUtilPolyfill = utilModuleExports;

  // Helper function to dispatch module loading errors in our custom require
  function dispatchRequireModuleError(moduleName: string, error: any) {
    console.error(`[Maps Polyfill] Error loading module ${moduleName} via require:`, error);
    
    // Dispatch a custom event that our components can listen for
    const errorEvent = new CustomEvent('google-maps-module-error', {
      detail: {
        moduleName,
        error,
        source: 'require',
        timestamp: new Date().toISOString(),
        message: error?.message || 'Unknown module loading error'
      }
    });
    
    window.dispatchEvent(errorEvent);
  }
  
  // Create our own require function to provide modules
  (window as any).__googleMapsApiRequire = function(moduleName: string) {
    console.log(`[Maps Polyfill] Polyfill require called for module: ${moduleName}`);
    
    try {
      // Handle util module
      if (moduleName === 'util') {
        return utilModuleExports;
      }
      
      // Handle places_impl module
      if (moduleName === 'places_impl' || moduleName.includes('places')) {
        console.log('[Maps Polyfill] Providing places_impl polyfill via require');
        
        // Create places_impl polyfill with necessary stubs
        const placesPolyfill = {
          __polyfilled: true,
          Autocomplete: class {
            constructor() {
              console.warn('[Maps Polyfill] Using places_impl.Autocomplete stub implementation');
            }
            addListener() { return { remove: () => {} }; }
            bindTo() { return this; }
            get() { return null; }
            notify() { return this; }
            set() { return this; }
          },
          PlaceResult: function() {},
          AutocompleteService: function() {
            return {
              getPlacePredictions: function(request: any, callback: any) {
                console.warn('[Maps Polyfill] Using AutocompleteService stub');
                // Return empty results to avoid crashes
                setTimeout(() => callback([], 'OK'), 0);
                return;
              }
            };
          },
          PlacesService: function() {
            return {
              getDetails: function(request: any, callback: any) {
                console.warn('[Maps Polyfill] Using PlacesService stub');
                setTimeout(() => callback(null, 'NOT_FOUND'), 0);
                return;
              },
              findPlaceFromQuery: function(request: any, callback: any) {
                console.warn('[Maps Polyfill] Using PlacesService.findPlaceFromQuery stub');
                setTimeout(() => callback([], 'OK'), 0);
                return;
              }
            };
          }
        };
        
        // Notify components of places module being polyfilled
        dispatchRequireModuleError(moduleName, new Error('Places module not available, using polyfill'));
        
        return placesPolyfill;
      }
      
      // Return empty object for other modules to prevent crashes
      return {};
    } catch (error) {
      // If there's an error providing a polyfill, handle it gracefully
      console.error(`[Maps Polyfill] Error in require polyfill for ${moduleName}:`, error);
      dispatchRequireModuleError(moduleName, error);
      
      // Return an empty object to prevent crashes
      return {};
    }
  };

  // Start watching for Google Maps script loading
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupWatcher);
  } else {
    setupWatcher();
  }
  
  // Install polyfills now if Maps is already loaded
  if (isGoogleMapsLoaded()) {
    installPolyfills();
  }
}

// Make TypeScript happy with our extensions to the Window interface
declare global {
  interface Window {
    google: any;
    __gmpModuleCache: Record<string, { module: { exports: any } }>;
    googleMapsUtilPolyfill: any;
  }
}

export default {};