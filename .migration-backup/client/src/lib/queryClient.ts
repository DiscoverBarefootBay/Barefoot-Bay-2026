import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;
    try {
      const errorBody = await res.json();
      errorMessage = errorBody.message || errorMessage;
    } catch (e) {
      // If response is not JSON, use text
      const text = await res.text();
      errorMessage = text || errorMessage;
    }
    throw new Error(`${res.status}: ${errorMessage}`);
  }
}

interface ApiRequestConfig {
  url: string;
  method: string;
  body?: any;
  headers?: Record<string, string>;
}

export async function apiRequest(
  configOrMethod: string | ApiRequestConfig,
  urlOrUndefined?: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Handle both function signatures
  let method: string;
  let url: string;
  let requestData: any;
  let customHeaders: Record<string, string> = {};

  if (typeof configOrMethod === 'string') {
    // Old signature: apiRequest(method, url, data)
    method = configOrMethod;
    url = urlOrUndefined || '';
    requestData = data;
  } else {
    // New signature: apiRequest({ url, method, body, headers })
    method = configOrMethod.method;
    url = configOrMethod.url;
    requestData = configOrMethod.body;
    customHeaders = configOrMethod.headers || {};
  }

  console.log(`Debug: Making ${method} request to ${url} with data:`, requestData);

  const headers: Record<string, string> = {
    "Accept": "application/json",
    ...customHeaders
  };

  // Only set Content-Type for non-FormData requests if not already set in customHeaders
  if (!(requestData instanceof FormData) && !customHeaders["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  // Add proper XMLHttpRequest header for AJAX requests
  headers["X-Requested-With"] = "XMLHttpRequest";

  // Determine if we're in a deployed Replit environment
  const isReplitDeployment = window.location.hostname.includes('repl.co') || 
                           window.location.hostname.includes('replit.app') ||
                           window.location.hostname.includes('barefootbay.com');
  
  // Log the hostname for debugging
  console.log(`Request hostname: ${window.location.hostname}, isDeploy: ${isReplitDeployment}`);
  
  // Enhanced debug logging for authentication state
  try {
    // Check if we have the session cookie and log all cookies for debugging
    const isAuthenticated = !!document.cookie.includes('connect.sid');
    console.log(`Authentication debug: 
      Cookie exists: ${isAuthenticated}
      Full cookie string: ${document.cookie}
      URL: ${url}
      Method: ${method}
      Headers: ${JSON.stringify(headers)}
      Hostname: ${window.location.hostname}
      Origin: ${window.location.origin}
      Protocol: ${window.location.protocol}
    `);
    
    // Call the auth check endpoint to validate server-side authentication status
    // This is a non-blocking check to provide extra debugging information
    const checkAuth = async () => {
      try {
        const checkRes = await fetch('/api/auth/check', {
          credentials: 'include',
          mode: 'cors',
          cache: 'no-cache',
        });
        const authData = await checkRes.json();
        console.log('Server auth check:', authData);
      } catch (authErr) {
        console.error('Auth check error:', authErr);
      }
    };
    
    // Don't wait for this to complete, just run it in the background for debugging
    checkAuth();
  } catch (e) {
    console.log('Could not check authentication state', e);
  }
  
  // For production environments, try to get and use the auth token automatically
  // if we're making an admin-only request to avoid cross-domain issues
  if (isReplitDeployment && 
      (url.includes('/api/users') || 
       url.includes('/api/admin') || 
       url.includes('/api/production-sync'))) {
    try {
      // First, check if we have a valid token in localStorage
      let authToken = localStorage.getItem('authToken');
      let tokenExpiry = localStorage.getItem('tokenExpiry');
      
      // If the token is missing or expired, try to fetch a new one
      if (!authToken || !tokenExpiry || new Date(tokenExpiry) <= new Date()) {
        console.log('No valid auth token found in localStorage, fetching a new one');
        
        const tokenResponse = await fetch('/api/auth/token', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          if (tokenData.success && tokenData.authToken) {
            authToken = tokenData.authToken;
            tokenExpiry = tokenData.tokenExpires;
            
            // Save the token for future requests
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('tokenExpiry', tokenExpiry);
            console.log('New auth token generated and saved to localStorage');
          }
        }
      }
      
      // If we have a valid token, add it to the request as query parameter
      if (authToken) {
        console.log('Using auth token for cross-domain authentication');
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}authToken=${authToken}`;
      }
    } catch (tokenError) {
      console.error('Error fetching or using auth token:', tokenError);
    }
  }
  
  const requestOptions: RequestInit = {
    method,
    headers,
    // ALWAYS include credentials in requests to ensure authentication cookies are sent
    credentials: "include",
    // Always use 'cors' mode to support cross-origin requests with credentials
    // This is necessary for production deployments where the API might be on a different domain/subdomain
    mode: 'cors',
    // Cache control to ensure fresh requests
    cache: "no-cache",
    // Add explicit referrer policy to maintain referrer information
    referrerPolicy: 'origin'
  };

  // Handle the body based on the data type
  if (requestData) {
    requestOptions.body = requestData instanceof FormData ? requestData : JSON.stringify(requestData);
  }

  try {
    const res = await fetch(url, requestOptions);
    
    // Process the response to ensure it has the expected type
    const clonedResponse = res.clone(); // Clone to avoid body already read errors
    
    let responseText = '';
    try {
      responseText = await clonedResponse.text();
      if (!responseText || responseText.trim() === '') {
        console.log(`Empty response from ${method} ${url}`);
        return res; // Return original response for empty responses
      }
      
      console.log(`API response from ${method} ${url}:`, responseText.substring(0, 100) + (responseText.length > 100 ? "..." : ""));
    } catch (textError) {
      console.error(`Error reading response text: ${method} ${url}`, textError);
    }
    
    // Check if response is ok before returning it
    if (!res.ok) {
      let friendlyMessage = '';
      try {
        const json = JSON.parse(responseText);
        friendlyMessage = json.message || json.error || '';
      } catch {
        // not JSON — fall through to status-based message
      }
      if (!friendlyMessage) {
        friendlyMessage = res.status === 401
          ? 'Invalid username or password. Please try again.'
          : res.status === 403
          ? 'You do not have permission to do that.'
          : `Something went wrong (status ${res.status}). Please try again.`;
      }
      const error: any = new Error(friendlyMessage);
      error.status = res.status;
      error.statusText = res.statusText;
      console.error(`API request failed: ${method} ${url} - Status: ${res.status}`, error);
      throw error;
    }
    
    return res;
  } catch (error) {
    console.error(`API request failed: ${method} ${url}`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    console.log("Query fetch:", queryKey[0]);
    
    try {
      // Use the same Replit deployment detection as in apiRequest
      const isReplitDeployment = window.location.hostname.includes('repl.co') || 
                                window.location.hostname.includes('replit.app') ||
                                window.location.hostname.includes('barefootbay.com');
      
      console.log(`Query hostname: ${window.location.hostname}, isDeploy: ${isReplitDeployment}`);
      
      // Enhanced debug authentication state for query
      try {
        const isAuthenticated = !!document.cookie.includes('connect.sid');
        console.log(`Query authentication debug: 
          Cookie exists: ${isAuthenticated}
          Full cookie string: ${document.cookie}
          Query: ${queryKey[0]}
          Hostname: ${window.location.hostname}
          Origin: ${window.location.origin}
          Protocol: ${window.location.protocol}
        `);
        
        // Call the auth check endpoint to validate server-side authentication status
        const checkAuth = async () => {
          try {
            const checkRes = await fetch('/api/auth/check', {
              credentials: 'include',
              mode: 'cors',
              cache: 'no-cache',
            });
            const authData = await checkRes.json();
            console.log('Query auth check:', authData);
          } catch (authErr) {
            console.error('Query auth check error:', authErr);
          }
        };
        
        // Run in background for debugging
        checkAuth();
      } catch (e) {
        console.log('Could not check authentication state for query', e);
      }
      
      let url = queryKey[0] as string;
      
      // For production environments, try to get and use the auth token automatically
      // if we're making an admin-only request to avoid cross-domain issues
      if (isReplitDeployment && 
          (url.includes('/api/users') || 
           url.includes('/api/admin') || 
           url.includes('/api/production-sync'))) {
        try {
          // First, check if we have a valid token in localStorage
          let authToken = localStorage.getItem('authToken');
          let tokenExpiry = localStorage.getItem('tokenExpiry');
          
          // If the token is missing or expired, try to fetch a new one
          if (!authToken || !tokenExpiry || new Date(tokenExpiry) <= new Date()) {
            console.log('No valid auth token found in localStorage for query, fetching a new one');
            
            const tokenResponse = await fetch('/api/auth/token', {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
              }
            });
            
            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              if (tokenData.success && tokenData.authToken) {
                authToken = tokenData.authToken;
                tokenExpiry = tokenData.tokenExpires;
                
                // Save the token for future requests
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('tokenExpiry', tokenExpiry);
                console.log('New auth token generated and saved to localStorage for query');
              }
            }
          }
          
          // If we have a valid token, add it to the request as query parameter
          if (authToken) {
            console.log('Using auth token for cross-domain authentication in query');
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}authToken=${authToken}`;
          }
        } catch (tokenError) {
          console.error('Error fetching or using auth token for query:', tokenError);
        }
      }
      
      const res = await fetch(url, {
        credentials: "include",
        // Always use 'cors' mode to match the updated apiRequest function
        mode: 'cors',
        cache: "no-cache",
        headers: {
          "Accept": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        }
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        console.log("Received 401 for fetch, returning null as configured");
        return null;
      }

      await throwIfResNotOk(res);
      
      try {
        const jsonData = await res.json();
        
        // Check array endpoints that should always return arrays
        // Note: Be specific with paths to avoid matching single-item endpoints
        // e.g., '/api/pages' list endpoint vs '/api/pages/terms-and-agreements' single page endpoint
        const arrayEndpoints = [
          '/api/vendor-categories',
          '/api/community-categories',
          '/api/categories',
          '/api/posts',
          '/api/comments',
          '/api/events',
          '/api/vendors'
        ];
        
        // If this is an endpoint that should return an array but isn't
        const currentEndpoint = queryKey[0]?.toString() || '';
        
        // Only match exact endpoints or list endpoints, not single-item endpoints
        // This prevents /api/pages/some-slug from being treated as an array endpoint
        const shouldBeArray = arrayEndpoints.some(endpoint => 
          currentEndpoint === endpoint || 
          (currentEndpoint.includes(endpoint) && !currentEndpoint.match(/\/api\/[^\/]+\/[^\/]+$/))
        );
        
        if (shouldBeArray && !Array.isArray(jsonData)) {
          console.warn(`Expected array from ${currentEndpoint} but got:`, typeof jsonData);
          
          // If it's an object with a data property that's an array, return that
          if (jsonData && typeof jsonData === 'object' && Array.isArray(jsonData.data)) {
            console.log(`Using data property from response for ${currentEndpoint}`);
            return jsonData.data;
          }
          
          // If the object has any array properties, use the first one found
          if (jsonData && typeof jsonData === 'object') {
            for (const key in jsonData) {
              if (Array.isArray(jsonData[key])) {
                console.log(`Using ${key} array property from response for ${currentEndpoint}`);
                return jsonData[key];
              }
            }
          }
          
          // If we can't find an array, return empty array
          console.warn(`Couldn't find array data in response for ${currentEndpoint}, returning empty array`);
          return [];
        }
        
        return jsonData;
      } catch (jsonError) {
        console.error(`Error parsing JSON from ${queryKey[0]}:`, jsonError);
        // Return empty array as fallback for expected array responses
        return [];
      }
    } catch (error) {
      // Check if this is a forms API query - these tend to 404 often when forms don't exist yet
      if (queryKey[0].toString().includes('/api/forms/by-slug/')) {
        console.log(`Form not found for ${queryKey[0]} - suppressing error`);
        // Return null for form queries that fail to prevent console errors
        return null;
      }
      
      console.error(`Query fetch failed: ${queryKey[0]}`, error);
      throw error;
    }
  };

// Global error logger
function silentErrorHandler(error: unknown) {
  // Log error silently to avoid console.error
  if (process.env.NODE_ENV === 'development') {
    console.warn('React Query error suppressed:', error);
  }
  // Return to prevent React Query from bubbling up the error
  return;
}

/**
 * Special query client configuration that includes interceptor functions
 * to handle common patterns and errors across the application
 */

// Get default empty form structure for when a form doesn't exist yet
const getEmptyFormStructure = (slug: string) => {
  return {
    id: -1, // Use negative ID to indicate this is a placeholder
    title: "",
    description: "",
    slug: slug,
    formFields: [],
    submitButtonText: "Submit",
    successMessage: "Form submitted successfully.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPlaceholder: true // Flag to indicate this is not a real form from the database
  };
};

// Create the query client with extended options
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }), // Changed to returnNull to prevent auth errors
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 60000, // Reduced to 1 minute to refresh stale data occasionally
      retry: false,
      
      // Global settings to prevent error flooding in console
      useErrorBoundary: false, // Don't throw errors to error boundaries
      onError: silentErrorHandler, // Custom silent error handler
      
      // Fallback data for all queries
      placeholderData: (previousData, context) => {
        // If we have previous data, return it
        if (previousData !== undefined) {
          return previousData;
        }
        
        // Safely check if context and queryKey exist before using them
        if (!context) {
          console.log('PlaceholderData called with undefined context');
          return [];  // Return empty array as a safer default
        }
        
        // Safely extract queryKey
        const { queryKey } = context;
        
        // If queryKey is missing or invalid, return a safe empty array
        if (!queryKey || !Array.isArray(queryKey) || queryKey.length === 0) {
          console.log('PlaceholderData called with invalid queryKey:', queryKey);
          return [];
        }
        
        const queryPath = queryKey[0]?.toString() || '';
        
        // Special handling for form queries to prevent errors when forms don't exist
        if (queryPath.includes('/api/forms/by-slug/')) {
          const slug = queryPath.split('/api/forms/by-slug/').pop();
          if (slug) {
            console.log(`Providing empty form structure for missing form: ${slug}`);
            return getEmptyFormStructure(slug);
          }
          // General fallback for form queries
          return null;
        }
        
        // For collection endpoints, return empty array
        if (
          queryPath.includes('/api/vendor-categories') ||
          queryPath.includes('/api/pages') ||
          queryPath.includes('/api/community-categories') ||
          queryPath.includes('/api/categories') ||
          queryPath.includes('/api/posts') ||
          queryPath.includes('/api/comments') ||
          queryPath.includes('/api/events') ||
          queryPath.includes('/api/vendors')
        ) {
          console.log(`Providing empty array for collection endpoint: ${queryPath}`);
          return [];
        }
        
        // Return null as general fallback for non-collection endpoints
        return null;
      }
    },
    mutations: {
      retry: false,
      useErrorBoundary: false,
      onError: silentErrorHandler,
    },
  },
});