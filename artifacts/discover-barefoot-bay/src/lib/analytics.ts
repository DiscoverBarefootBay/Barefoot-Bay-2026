/**
 * Client-side analytics tracking library
 * 
 * This library provides functions to track page views and events.
 * It automatically handles session management via cookies.
 */

// Re-export the components, hooks, and types from analytics.tsx
export { 
  AnalyticsProvider, 
  useAnalytics,
} from './analytics.tsx';
export type { 
  TrackPageViewOptions,
  TrackEventOptions
} from './analytics.tsx';

// Track page view
export const trackPageView = async (url = window.location.pathname, title = document.title) => {
  try {
    // Track performance metrics
    const loadTime = window.performance?.timing
      ? window.performance.timing.domContentLoadedEventEnd - window.performance.timing.navigationStart
      : null;
    
    // Get screen dimensions
    const screen = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    // Additional properties to track
    const properties = {
      screen,
      language: navigator.language,
      userAgent: navigator.userAgent,
      referrer: document.referrer || null,
      timestamp: new Date().toISOString()
    };
    
    // Send tracking data to server
    const response = await fetch('/api/analytics/track/pageview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify({
        url,
        title,
        loadTime,
        properties
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to track page view: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Store page view ID in session storage
    if (data.pageViewId) {
      sessionStorage.setItem('current_page_view_id', data.pageViewId);
    }
    
    console.log('Page view tracked:', url);
    return data;
  } catch (error) {
    console.error('Error tracking page view:', error);
    return null;
  }
};

// Track event
export const trackEvent = async (data: {
  eventType: string;
  eventCategory?: string;
  eventAction?: string;
  eventLabel?: string;
  eventValue?: number;
  properties?: Record<string, any>;
}) => {
  try {
    // Get current page view ID from session storage
    const pageViewId = sessionStorage.getItem('current_page_view_id');
    
    // Send tracking data to server
    const response = await fetch('/api/analytics/track/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify({
        ...data,
        pageViewId,
        properties: {
          ...data.properties,
          url: window.location.pathname,
          timestamp: new Date().toISOString()
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to track event: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    console.log(`Event tracked: ${data.eventType}`);
    return responseData;
  } catch (error) {
    console.error('Error tracking event:', error);
    return null;
  }
};


