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

// Initialize analytics
export const initAnalytics = () => {
  // Track initial page view
  trackPageView();
  
  // Set up tracking for navigation
  const originalPushState = history.pushState;
  history.pushState = function(state, title, url) {
    originalPushState.apply(this, [state, title, url]);
    
    // Track page view after navigation
    if (typeof url === 'string') {
      trackPageView(url);
    }
  };
  
  // Track page views on history navigation
  window.addEventListener('popstate', () => {
    trackPageView();
  });
  
  // Set up click tracking for important elements
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    
    // Track button clicks
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      const button = target.tagName === 'BUTTON' ? target : target.closest('button');
      if (button) {
        const id = button.id || '';
        const text = button.textContent?.trim() || '';
        const classes = Array.from(button.classList).join(' ');
        
        trackEvent({
          eventType: 'click',
          eventCategory: 'button',
          eventAction: 'click',
          eventLabel: id || text || classes,
          properties: {
            elementId: id,
            elementText: text,
            elementClasses: classes,
            path: getElementPath(button as HTMLElement)
          }
        });
      }
    }
    
    // Track link clicks
    if (target.tagName === 'A' || target.closest('a')) {
      const link = target.tagName === 'A' ? target : target.closest('a');
      if (link && link instanceof HTMLAnchorElement) {
        const href = link.href || '';
        const text = link.textContent?.trim() || '';
        
        trackEvent({
          eventType: 'click',
          eventCategory: 'link',
          eventAction: 'click',
          eventLabel: text || href,
          properties: {
            href,
            elementText: text,
            path: getElementPath(link as HTMLElement)
          }
        });
      }
    }
  });
  
  // Set up form submission tracking
  document.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement;
    const formId = form.id || '';
    const formAction = form.action || '';
    const formMethod = form.method || '';
    
    trackEvent({
      eventType: 'form_submit',
      eventCategory: 'form',
      eventAction: 'submit',
      eventLabel: formId || formAction,
      properties: {
        formId,
        formAction,
        formMethod,
        path: getElementPath(form)
      }
    });
  });
  
  // Track page unload
  window.addEventListener('beforeunload', () => {
    // Use navigator.sendBeacon for more reliable tracking on page unload
    const data = JSON.stringify({});
    navigator.sendBeacon('/api/analytics/track/endsession', data);
  });
  
  console.log('Analytics tracking initialized');
};

// Utility function to get element path for better tracking context
function getElementPath(element: HTMLElement, maxLength = 5): string {
  const path: string[] = [];
  let currentElement: HTMLElement | null = element;
  
  while (currentElement && path.length < maxLength) {
    let identifier = currentElement.tagName.toLowerCase();
    
    if (currentElement.id) {
      identifier += `#${currentElement.id}`;
    } else if (currentElement.className) {
      const classes = Array.from(currentElement.classList).join('.');
      if (classes) {
        identifier += `.${classes}`;
      }
    }
    
    path.unshift(identifier);
    currentElement = currentElement.parentElement;
  }
  
  return path.join(' > ');
}