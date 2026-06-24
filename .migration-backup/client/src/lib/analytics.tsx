/**
 * Client-side Analytics Integration
 * 
 * This module provides a unified API for tracking page views and events,
 * integrating with our backend analytics service.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Types
export interface TrackPageViewOptions {
  url?: string;
  title?: string;
  properties?: Record<string, any>;
}

export interface TrackEventOptions {
  eventType: string;
  eventCategory?: string;
  eventAction?: string;
  eventLabel?: string;
  eventValue?: number;
  properties?: Record<string, any>;
}

// Context for analytics
interface AnalyticsContextValue {
  trackPageView: (options?: TrackPageViewOptions) => Promise<void>;
  trackEvent: (options: TrackEventOptions) => Promise<void>;
}

const AnalyticsContext = createContext<AnalyticsContextValue | undefined>(undefined);

// Provider component
export const AnalyticsProvider = ({ children }: { children: ReactNode }) => {
  const [initialized, setInitialized] = useState(false);

  console.log('[Analytics Provider] Component mounting...', { initialized });

  // Initialize tracking on mount
  useEffect(() => {
    console.log('[Analytics Provider] UseEffect triggered', { initialized });
    if (!initialized) {
      console.log('[Analytics Provider] Initializing analytics tracking...');
      // Track initial page view
      trackPageView();
      setupPageChangeTracking();
      setInitialized(true);
      console.log('[Analytics Provider] Analytics initialized successfully');
    }
  }, [initialized]);

  // Track page view
  const trackPageView = async (options?: TrackPageViewOptions) => {
    try {
      const url = options?.url || window.location.pathname;
      const title = options?.title || document.title;
      const properties = options?.properties || {};

      // Get performance metrics if available
      const loadTime = window.performance?.timing
        ? window.performance.timing.domContentLoadedEventEnd - window.performance.timing.navigationStart
        : undefined;

      // Add screen dimensions
      const screen = {
        width: window.innerWidth,
        height: window.innerHeight
      };

      // Send tracking data to server
      await fetch('/api/analytics/track/pageview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({
          url,
          title,
          loadTime,
          screen,
          properties: {
            ...properties,
            referrer: document.referrer || null,
            userAgent: navigator.userAgent,
            language: navigator.language,
            timestamp: new Date().toISOString()
          }
        })
      });

      console.info(`[Analytics] Page view tracked: ${url}`);
    } catch (error) {
      console.error('[Analytics] Error tracking page view:', error);
    }
  };

  // Track event
  const trackEvent = async (options: TrackEventOptions) => {
    try {
      // Send tracking data to server
      await fetch('/api/analytics/track/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({
          eventType: options.eventType,
          eventCategory: options.eventCategory,
          eventAction: options.eventAction,
          eventLabel: options.eventLabel,
          eventValue: options.eventValue,
          properties: {
            ...options.properties,
            url: window.location.pathname,
            title: document.title,
            timestamp: new Date().toISOString()
          }
        })
      });

      console.info(`[Analytics] Event tracked: ${options.eventType}`);
    } catch (error) {
      console.error('[Analytics] Error tracking event:', error);
    }
  };

  // Setup tracking for page changes
  const setupPageChangeTracking = () => {
    // Track navigation events
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      trackPageView();
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      trackPageView();
    };

    // Track popstate events (back/forward buttons)
    window.addEventListener('popstate', () => {
      trackPageView();
    });

    // Track page unload
    window.addEventListener('beforeunload', () => {
      // Send a synchronous beacon to end the session
      navigator.sendBeacon('/api/analytics/track/endsession', JSON.stringify({}));
    });
  };

  return (
    <AnalyticsContext.Provider value={{ trackPageView, trackEvent }}>
      {children}
    </AnalyticsContext.Provider>
  );
};

// Hook to use analytics
export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
};

// Standalone tracking functions
export const trackPageView = async (options?: TrackPageViewOptions) => {
  try {
    const url = options?.url || window.location.pathname;
    const title = options?.title || document.title;
    const properties = options?.properties || {};

    // Get performance metrics if available
    const loadTime = window.performance?.timing
      ? window.performance.timing.domContentLoadedEventEnd - window.performance.timing.navigationStart
      : undefined;

    // Add screen dimensions
    const screen = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    // Send tracking data to server
    await fetch('/api/analytics/track/pageview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify({
        url,
        title,
        loadTime,
        screen,
        properties: {
          ...properties,
          referrer: document.referrer || null,
          userAgent: navigator.userAgent,
          language: navigator.language,
          timestamp: new Date().toISOString()
        }
      })
    });

    console.info(`[Analytics] Page view tracked: ${url}`);
  } catch (error) {
    console.error('[Analytics] Error tracking page view:', error);
  }
};

export const trackEvent = async (options: TrackEventOptions) => {
  try {
    // Send tracking data to server
    await fetch('/api/analytics/track/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify({
        eventType: options.eventType,
        eventCategory: options.eventCategory,
        eventAction: options.eventAction,
        eventLabel: options.eventLabel,
        eventValue: options.eventValue,
        properties: {
          ...options.properties,
          url: window.location.pathname,
          title: document.title,
          timestamp: new Date().toISOString()
        }
      })
    });

    console.info(`[Analytics] Event tracked: ${options.eventType}`);
  } catch (error) {
    console.error('[Analytics] Error tracking event:', error);
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
      trackPageView({ url });
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
            elementPath: getElementPath(button as HTMLElement)
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
            elementPath: getElementPath(link as HTMLElement)
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
        elementPath: getElementPath(form)
      }
    });
  });
  
  // Track page unload
  window.addEventListener('beforeunload', () => {
    // Use navigator.sendBeacon for more reliable tracking on page unload
    const data = JSON.stringify({});
    navigator.sendBeacon('/api/analytics/track/endsession', data);
  });
  
  console.info('[Analytics] Tracking initialized');
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