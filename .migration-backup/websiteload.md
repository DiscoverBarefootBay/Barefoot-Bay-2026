# Website Loading Issue Analysis and Fix

## Problem Summary

The website is failing to load in production, showing a React error: 
> Minified React error #300; visit https://reactjs.org/docs/error-decoder.html?invariant=300

This error occurs when there's an issue with component rendering, specifically related to violating the rules of React Hooks or having problems with references to outdated/missing components.

## Root Cause Analysis

After examining the codebase, the primary issue appears to be related to the WebSocket implementation and how it interacts with the banner image/video components.

### Key Findings:

1. **WebSocket Helper Implementation Issue**:
   - The `websocket-helper.ts` module has been intentionally disabled to prevent conflicts with Replit Object Storage.
   - However, components like `BannerVideo` still reference methods like `websocketHelper.isConnected()`.
   - This creates a reference to a disabled function that likely returns `undefined` instead of the expected boolean.

2. **Banner Components Dependencies**:
   - The banner components (`BannerImage.tsx` and `BannerVideo.tsx`) use the WebSocket helper for real-time updates.
   - These components also attempt to clear media cache on mount, which may cause issues if the cache implementation relies on WebSocket functionality.

3. **Object Storage Access Issues**:
   - There are 404 errors for banner slide images in the format: `object-storage.replit.app/BANNER/banner-slides/bannerImage-*.jpg`
   - This suggests that either:
     - The media doesn't exist at these locations
     - The paths are incorrectly formatted
     - There is an access/permission issue

4. **Media Path Handling Inconsistencies**:
   - The system uses multiple path formats for media (with/without `/uploads/` prefix)
   - Fallback strategies may be looping or not working correctly in production

## Detailed Fix Plan

### 1. Fix WebSocket Helper Implementation

Create a safer implementation of the WebSocket helper that properly handles the disabled state:

```typescript
// Updated implementation in client/src/utils/websocket-helper.ts
class WebSocketHelper {
  private static instance: WebSocketHelper;
  
  // Safe constructor that creates a legitimate stub
  private constructor() {
    console.log("[WebSocket] WebSocket functionality is disabled to prevent conflicts with Object Storage");
  }
  
  // Singleton pattern
  public static getInstance(): WebSocketHelper {
    if (!WebSocketHelper.instance) {
      WebSocketHelper.instance = new WebSocketHelper();
    }
    return WebSocketHelper.instance;
  }
  
  // All methods return safe values rather than undefined
  public isConnected(): boolean {
    return false; // Always return false instead of undefined
  }
  
  public connect(): Promise<void> {
    return Promise.resolve(); // Return resolved promise instead of error
  }
  
  // Add event listeners but don't actually do anything
  public onConnect(handler: () => void): void {}
  public offConnect(handler: () => void): void {}
  public onDisconnect(handler: () => void): void {}
  public offDisconnect(handler: () => void): void {}
  public on(event: string, handler: (data: any) => void): void {}
  public off(event: string, handler: (data: any) => void): void {}
  public getClientId(): null {
    return null;
  }
}

// Export the singleton instance
export const websocketHelper = WebSocketHelper.getInstance();

// Export the class for advanced usage
export default WebSocketHelper;
```

### 2. Fix Banner Video Component

Update the BannerVideo component to safely handle the disabled WebSocket helper:

```typescript
// In client/src/components/home/banner-video.tsx
export const BannerVideo = forwardRef<HTMLVideoElement, BannerVideoProps>((props, ref) => {
  // Other state variables...
  
  // Safely check WebSocket connection status - with fallback
  const [isConnected, setIsConnected] = useState(() => {
    try {
      return websocketHelper.isConnected();
    } catch (e) {
      console.warn('WebSocket helper error:', e);
      return false;
    }
  });
  
  // Updated useEffect for WebSocket events
  useEffect(() => {
    // Skip WebSocket setup if in production - this is critical
    if (import.meta.env.MODE === 'production') {
      return; // Don't attempt to use WebSocket in production
    }
    
    // Only try to use WebSocket in development
    try {
      // Define handlers...
      websocketHelper.onConnect(handleConnect);
      websocketHelper.onDisconnect(handleDisconnect);
      websocketHelper.on('video-status', handleVideoStatusMessage);
      
      // Cleanup handlers on unmount
      return () => {
        websocketHelper.offConnect(handleConnect);
        websocketHelper.offDisconnect(handleDisconnect);
        websocketHelper.off('video-status', handleVideoStatusMessage);
      };
    } catch (e) {
      console.warn('Error setting up WebSocket handlers:', e);
      return () => {}; // Empty cleanup function
    }
  }, [normalizedSrc]);
  
  // Rest of component implementation...
});
```

### 3. Improve Image Path Handling

Update the media path handling to better handle Object Storage URLs:

```typescript
// In client/src/lib/media-path-utils.ts
export function getEnvironmentAppropriateUrl(url: string, mediaType: string = 'banner-slides'): string {
  if (!url) return url;
  
  // If already a complete URL, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Extract filename regardless of path format
  const filename = url.split('/').pop() || '';
  
  // For banner slides in production, prefer Object Storage proxy path
  if (mediaType === 'banner-slides' && import.meta.env.MODE === 'production') {
    return `/api/storage-proxy/BANNER/${mediaType}/${filename}`;
  }
  
  // Otherwise return the original URL
  return url;
}
```

### 4. Add Global Error Boundary

Implement a global error boundary to prevent the entire app from crashing:

```typescript
// In client/src/components/error-boundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
          <div className="p-6 bg-white rounded-lg shadow-md max-w-md w-full text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">
              The application encountered an error. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### 5. Use the Error Boundary in App.tsx

```typescript
// In client/src/App.tsx
import ErrorBoundary from '@/components/error-boundary';

function App() {
  // ...existing code
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AnalyticsProvider>
            <ChatProvider>
              <ThemeProvider>
                <AppContent />
              </ThemeProvider>
            </ChatProvider>
          </AnalyticsProvider>
        </AuthProvider>
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
```

### 6. Fix Media Cache Implementation

Ensure the media cache functionality doesn't depend on WebSocket:

```typescript
// In client/src/lib/media-cache.ts
export const initMediaCache = (): void => {
  // Prefetch critical assets
  prefetchCriticalMedia([
    '/uploads/banner-slides/placeholder-banner.png',
    '/uploads/background-image-placeholder.jpg'
  ]);
  
  // Clean up old cache entries on initialization
  clearOldMediaCache();
  
  // Set up periodic cache cleanup
  const ONE_DAY = 24 * 60 * 60 * 1000;
  setInterval(clearOldMediaCache, ONE_DAY);
  
  console.log('Media optimization initialized');
};
```

## Implementation Priority

1. **Critical:** Fix WebSocket Helper Implementation
2. **Critical:** Fix Banner Video Component
3. **High:** Add Global Error Boundary
4. **High:** Use Error Boundary in App.tsx
5. **Medium:** Improve Image Path Handling
6. **Medium:** Fix Media Cache Implementation

## Testing Strategy

1. Implement changes locally first
2. Verify website loads without errors
3. Test banner image and video loading
4. Check for any console errors
5. Deploy to production and verify fix

## Long-term Recommendations

1. Simplify the media path handling to use a consistent pattern
2. Consider implementing a proper feature flag system to disable features in different environments
3. Add more robust error logging to identify issues faster
4. Consider a dedicated solution for media management to avoid the Object Storage/WebSocket conflict