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
  positionData?: Record<string, any>;
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
          positionData: options.positionData || {},
          path: window.location.pathname,
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

  // Track click and form-submit interactions so the Events dashboard receives
  // data (the provider previously only tracked page views). Registered in its
  // own effect with cleanup so listeners are not duplicated across HMR/remounts,
  // which would otherwise double-count events.
  useEffect(() => {
    // Interactive controls we want to attribute clicks to. Goes well beyond
    // native <button>/<a> to cover custom components (role="button", tabs, menu
    // items, switches, etc.) — the previous narrow matching was the documented
    // cause of most sessions recording zero events.
    const INTERACTIVE_SELECTOR =
      'a, button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"], input[type="button"], input[type="submit"], input[type="reset"], summary, [data-analytics-id], [data-testid]';

    const recordInteraction = (el: HTMLElement, x: number, y: number) => {
      // Anchor activations are recorded as links; everything else as a button-like control.
      const link = el instanceof HTMLAnchorElement ? el : (el.closest('a') as HTMLAnchorElement | null);
      if (link) {
        // Strip query string / hash to avoid persisting tokens or PII in analytics
        let safeHref = link.href || '';
        try {
          const url = new URL(link.href);
          safeHref = url.origin + url.pathname;
        } catch {
          // keep the raw href if it cannot be parsed
        }
        const text = link.textContent?.trim().slice(0, 120) || '';
        trackEvent({
          eventType: 'click',
          eventCategory: 'link',
          eventAction: 'click',
          eventLabel: text || safeHref,
          positionData: { x, y, elementType: 'link', elementId: link.id || '' },
          properties: {
            href: safeHref,
            elementText: text,
            elementPath: getElementPath(link),
          },
        });
        return;
      }

      const id = el.id || '';
      const text = el.textContent?.trim().slice(0, 120) || '';
      const classes = Array.from(el.classList).join(' ');
      const role = el.getAttribute('role') || el.tagName.toLowerCase();
      trackEvent({
        eventType: 'click',
        eventCategory: 'button',
        eventAction: 'click',
        eventLabel: id || text || classes,
        positionData: { x, y, elementType: role, elementId: id },
        properties: {
          elementId: id,
          elementRole: role,
          elementText: text,
          elementClasses: classes,
          elementPath: getElementPath(el),
        },
      });
    };

    // Native controls (button, a, input) fire a synthetic `click` after Enter/
    // Space activation. We record on keydown (so custom role-based controls that
    // never emit a click are still captured) and then swallow the immediately
    // following click for the same element to avoid double-counting.
    let recentKeyActivation: { el: HTMLElement; at: number } | null = null;

    const handleClick = (event: MouseEvent) => {
      const start = event.target as HTMLElement | null;
      if (!start || typeof start.closest !== 'function') return;
      const el = start.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
      if (!el) return;
      if (
        recentKeyActivation &&
        recentKeyActivation.el === el &&
        Date.now() - recentKeyActivation.at < 700
      ) {
        recentKeyActivation = null;
        return;
      }
      recordInteraction(el, event.pageX, event.pageY);
    };

    // Keyboard activation (Enter / Space) of interactive controls, so we still
    // record users who operate the UI without a mouse.
    const handleKeyActivate = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
      const start = event.target as HTMLElement | null;
      if (!start || typeof start.closest !== 'function') return;
      const el = start.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
      if (!el) return;
      recentKeyActivation = { el, at: Date.now() };
      const rect = el.getBoundingClientRect();
      recordInteraction(
        el,
        Math.round(rect.left + rect.width / 2 + window.scrollX),
        Math.round(rect.top + rect.height / 2 + window.scrollY)
      );
    };

    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      if (!form) return;
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
          elementPath: getElementPath(form),
        },
      });
    };

    // Capture phase so an interaction is still recorded even when an inner
    // handler calls stopPropagation() before it reaches document in the
    // bubbling phase.
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyActivate, true);
    document.addEventListener('submit', handleSubmit, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyActivate, true);
      document.removeEventListener('submit', handleSubmit, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        positionData: options.positionData || {},
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