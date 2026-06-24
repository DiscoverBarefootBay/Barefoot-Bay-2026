/**
 * Enhanced Client-side analytics tracking service
 * 
 * This module provides functions for tracking page views, events, and user behavior
 * on the client side. It sends data to the server's analytics API endpoints.
 * 
 * Features:
 * - Basic page view and event tracking
 * - Scroll depth tracking
 * - Click position tracking for heatmaps
 * - Event categorization
 * - Custom dimensions
 */

import Cookies from 'js-cookie';
import { v4 as uuidv4 } from 'uuid';
import { throttle, debounce } from 'lodash'; // Add this if not already imported

// Types for analytics data
interface PageViewData {
  sessionId: string;
  userId?: number;
  path: string;
  timestamp: Date;
  referrer?: string;
  userAgent?: string;
  ip?: string;
  // Scroll depth tracking
  pageHeight?: number;
  maxScrollDepth?: number; 
  maxScrollPercentage?: number;
  // Page categorization
  pageType?: string;
  pageCategory?: string;
  customDimensions?: Record<string, any>;
}

interface EventData {
  sessionId: string;
  userId?: number;
  eventType: string;
  // Enhanced event categorization
  category?: string;
  action?: string;
  label?: string;
  value?: number;
  // Click tracking for heatmaps
  xPosition?: number;
  yPosition?: number;
  elementId?: string;
  elementType?: string;
  // Custom data
  eventData?: any;
  timestamp: Date;
  path: string;
}

class AnalyticsTracker {
  private sessionId: string;
  private userId: number | null = null;
  private currentPath: string = '';
  private pageViewTimestamp: Date | null = null;
  private initialized: boolean = false;

  constructor() {
    // Get or create session ID
    let sessionId = Cookies.get('analytics_session_id');
    if (!sessionId) {
      sessionId = uuidv4();
      Cookies.set('analytics_session_id', sessionId, { expires: 30 }); // 30 days
    }
    this.sessionId = sessionId;
  }

  // Track maximum scroll position
  private maxScrollDepth: number = 0;
  private maxScrollPercentage: number = 0;
  private pageHeight: number = 0;
  private pageType: string = '';
  private pageCategory: string = '';
  private customDimensions: Record<string, any> = {};

  /**
   * Initialize the analytics tracker with user information
   */
  init(userId?: number) {
    if (this.initialized) return;
    
    if (userId) {
      this.userId = userId;
    }

    // Set up page view tracking
    this.trackInitialPageView();
    this.setupPageExitTracking();
    this.setupPageChangeTracking();
    
    // Set up enhanced tracking features
    this.setupScrollTracking();
    this.setupClickTracking();
    
    // Set up real-time activity tracking
    this.setupActivityTracking();
    
    this.initialized = true;
    console.log('Analytics tracker initialized');
  }
  
  /**
   * Set up real-time activity tracking for admin dashboard
   */
  private setupActivityTracking() {
    // Track initial activity
    this.trackUserActivity();
    
    // Set up interval to periodically ping the activity tracker
    setInterval(() => {
      this.trackUserActivity();
    }, 60 * 1000); // Update every minute
    
    // Track activity on user interactions
    const activityEvents = ['click', 'keydown', 'mousemove', 'scroll'];
    
    // Use a throttled function to avoid excessive tracking
    const throttledActivityTracker = throttle(() => {
      this.trackUserActivity();
    }, 30 * 1000); // At most once every 30 seconds
    
    // Add event listeners for user activity
    activityEvents.forEach(eventType => {
      document.addEventListener(eventType, throttledActivityTracker);
    });
  }
  
  /**
   * Track user activity for real-time dashboard
   */
  private trackUserActivity() {
    // Don't skip tracking activity even if userId is not set
    // because we still want to track anonymous users
    if (!this.initialized) return;
    
    const activityData = {
      path: window.location.pathname,
      username: document.querySelector('meta[name="username"]')?.getAttribute('content') || undefined
    };
    
    fetch('/active-users/track-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(activityData),
      credentials: 'include'
    }).catch(error => {
      console.error('Error tracking user activity:', error);
    });
  }
  
  /**
   * Set up scroll tracking to measure how far users scroll down pages
   */
  private setupScrollTracking() {
    // Update page height when page is fully loaded
    window.addEventListener('load', () => {
      this.updatePageHeight();
    });
    
    // Throttle scroll events to avoid performance issues (max 1 event per 250ms)
    const handleScroll = throttle(() => {
      if (!this.initialized) return;
      
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollDepth = scrollTop + window.innerHeight;
      
      // Update max scroll depth if this is deepest user has scrolled
      if (scrollDepth > this.maxScrollDepth) {
        this.maxScrollDepth = scrollDepth;
        
        // Calculate scroll percentage (0-100)
        if (this.pageHeight > 0) {
          this.maxScrollPercentage = Math.min(
            Math.round((this.maxScrollDepth / this.pageHeight) * 100),
            100
          );
        }
      }
    }, 250);
    
    // Debounced function to send scroll data after scrolling stops
    const sendScrollData = debounce(() => {
      if (this.maxScrollDepth > 0 && this.maxScrollPercentage > 0) {
        this.trackEvent('scroll_depth', { 
          category: 'user_engagement',
          action: 'scroll',
          label: `${this.maxScrollPercentage}%`,
          value: this.maxScrollPercentage,
          maxScrollDepth: this.maxScrollDepth,
          maxScrollPercentage: this.maxScrollPercentage,
          pageHeight: this.pageHeight
        });
      }
    }, 1000);
    
    // Add event listeners
    window.addEventListener('scroll', () => {
      handleScroll();
      sendScrollData();
    });
    
    // Update page dimensions on resize
    window.addEventListener('resize', throttle(() => {
      this.updatePageHeight();
    }, 500));
  }
  
  /**
   * Update page height calculation
   */
  private updatePageHeight() {
    this.pageHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );
  }
  
  /**
   * Set up click tracking for heatmap data
   */
  private setupClickTracking() {
    document.addEventListener('click', (event) => {
      if (!this.initialized) return;
      
      // Get the clicked element
      const target = event.target as HTMLElement;
      
      // Capture click coordinates
      const xPosition = event.clientX;
      const yPosition = event.clientY;
      
      // Get element info
      const elementId = target.id || '';
      const elementType = target.tagName?.toLowerCase() || '';
      const elementText = target.textContent?.trim().substring(0, 50) || '';
      const elementClasses = Array.from(target.classList || []).join(' ');
      
      // Track the click event
      this.trackEnhancedEvent({
        eventType: 'click',
        category: 'user_interaction',
        action: 'click',
        label: elementId || elementType || 'unknown',
        xPosition,
        yPosition,
        elementId,
        elementType,
        eventData: {
          text: elementText,
          classes: elementClasses,
          href: target.tagName === 'A' ? (target as HTMLAnchorElement).href : undefined
        },
        timestamp: new Date(),
        path: window.location.pathname
      });
    });
  }

  /**
   * Track the initial page view when the app loads
   */
  private trackInitialPageView() {
    this.currentPath = window.location.pathname;
    this.trackPageView();
  }

  /**
   * Set up tracking for when the user leaves a page
   */
  private setupPageExitTracking() {
    window.addEventListener('beforeunload', () => {
      if (this.pageViewTimestamp) {
        this.trackPageExit();
      }
    });
  }

  /**
   * Set up tracking for client-side navigation changes
   */
  private setupPageChangeTracking() {
    // This will work for any client-side routing that changes the URL
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.handleLocationChange();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.handleLocationChange();
    };

    window.addEventListener('popstate', () => {
      this.handleLocationChange();
    });
  }

  /**
   * Handle location changes for SPA navigation
   */
  private handleLocationChange() {
    const newPath = window.location.pathname;
    
    // Only track if the path has actually changed
    if (newPath !== this.currentPath) {
      // Track exit from previous page
      if (this.pageViewTimestamp) {
        this.trackPageExit();
      }
      
      // Track view of new page
      this.currentPath = newPath;
      this.trackPageView();
    }
  }

  /**
   * Track a page view with enhanced data
   */
  trackPageView(path?: string, pageType?: string, pageCategory?: string, customDimensions?: Record<string, any>) {
    if (!this.initialized) return;
    
    const viewPath = path || window.location.pathname;
    this.pageViewTimestamp = new Date();
    
    // Reset scroll tracking for new page
    this.maxScrollDepth = 0;
    this.maxScrollPercentage = 0;
    this.updatePageHeight();
    
    // Set page categorization if provided
    if (pageType) this.pageType = pageType;
    if (pageCategory) this.pageCategory = pageCategory;
    if (customDimensions) this.customDimensions = { ...this.customDimensions, ...customDimensions };
    
    // Auto-detect page type and category if not provided
    this.detectPageTypeAndCategory(viewPath);
    
    // First fetch user's IP (which will be captured server-side) for geolocation tracking
    fetch('https://api.ipify.org?format=json')
      .then(response => response.json())
      .then(data => {
        const pageViewData: PageViewData = {
          sessionId: this.sessionId,
          userId: this.userId || undefined,
          path: viewPath,
          timestamp: this.pageViewTimestamp,
          referrer: document.referrer || undefined,
          userAgent: navigator.userAgent,
          ip: data.ip, // Include IP address for geolocation tracking
          // Scroll tracking fields
          pageHeight: this.pageHeight,
          // Page categorization fields
          pageType: this.pageType,
          pageCategory: this.pageCategory,
          customDimensions: Object.keys(this.customDimensions).length > 0 ? this.customDimensions : undefined
        };
        
        // Send page view data to server
        fetch('/api/analytics/page-view', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(pageViewData),
          credentials: 'include'
        }).catch(error => {
          console.error('Error tracking page view:', error);
        });
      })
      .catch(error => {
        // Fallback: send page view without IP address
        console.warn('Failed to get IP for geolocation tracking:', error);
        
        const pageViewData: PageViewData = {
          sessionId: this.sessionId,
          userId: this.userId || undefined,
          path: viewPath,
          timestamp: this.pageViewTimestamp,
          referrer: document.referrer || undefined,
          userAgent: navigator.userAgent,
          // Scroll tracking fields
          pageHeight: this.pageHeight,
          // Page categorization fields
          pageType: this.pageType,
          pageCategory: this.pageCategory,
          customDimensions: Object.keys(this.customDimensions).length > 0 ? this.customDimensions : undefined
        };
        
            // Send page view data to server
        fetch('/api/analytics/page-view', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(pageViewData),
          credentials: 'include'
        }).catch(error => {
          console.error('Error tracking page view:', error);
        });
      });
  }
  
  /**
   * Auto-detect page type and category based on URL patterns
   */
  private detectPageTypeAndCategory(path: string) {
    // Only detect if not manually set
    if (!this.pageType || !this.pageCategory) {
      // Simple path-based categorization
      const parts = path.split('/').filter(p => p);
      
      // Default values
      let detectedType = 'page';
      let detectedCategory = 'general';
      
      // Detect page type based on URL structure
      if (path === '/' || path === '') {
        detectedType = 'homepage';
        detectedCategory = 'core';
      } else if (parts[0] === 'admin') {
        detectedType = 'admin';
        detectedCategory = parts[1] || 'dashboard';
      } else if (parts[0] === 'forum') {
        detectedType = 'forum';
        detectedCategory = parts[1] || 'discussions';
      } else if (parts[0] === 'calendar') {
        detectedType = 'calendar';
        detectedCategory = parts[1] || 'events';
      } else if (parts[0] === 'account') {
        detectedType = 'account';
        detectedCategory = parts[1] || 'profile';
      } else if (parts[0] === 'listings') {
        detectedType = 'listings';
        detectedCategory = parts[1] || 'all';
      }
      
      // Only set if not manually provided
      if (!this.pageType) this.pageType = detectedType;
      if (!this.pageCategory) this.pageCategory = detectedCategory;
    }
  }

  /**
   * Track a page exit (called before navigating away or on beforeunload)
   * Includes scroll depth information and time on page
   */
  private trackPageExit() {
    if (!this.pageViewTimestamp) return;

    const exitTimestamp = new Date();
    const timeOnPage = exitTimestamp.getTime() - this.pageViewTimestamp.getTime();
    
    // Enhanced exit data with scroll depth
    const exitData = {
      sessionId: this.sessionId,
      userId: this.userId || undefined,
      path: this.currentPath,
      exitTimestamp,
      // Enhanced metrics
      pageHeight: this.pageHeight,
      maxScrollDepth: this.maxScrollDepth,
      maxScrollPercentage: this.maxScrollPercentage,
      timeOnPage: timeOnPage,
      pageType: this.pageType,
      pageCategory: this.pageCategory
    };
    
    fetch('/api/analytics/page-exit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(exitData),
      credentials: 'include'
    }).catch(error => {
      console.error('Error tracking page exit:', error);
    });

    // Also track the page view duration as an engagement event
    if (timeOnPage > 1000) { // Only track if user spent at least 1 second
      this.trackEvent('page_view_duration', {
        category: 'user_engagement',
        action: 'time_on_page',
        label: this.currentPath,
        value: Math.floor(timeOnPage / 1000), // Convert to seconds
        maxScrollPercentage: this.maxScrollPercentage
      });
    }

    this.pageViewTimestamp = null;
  }

  /**
   * Track an enhanced event with full categorization and positioning
   */
  trackEnhancedEvent(eventData: EventData) {
    if (!this.initialized) return;
    
    // Ensure required fields
    const event: EventData = {
      sessionId: this.sessionId,
      userId: this.userId || undefined,
      timestamp: new Date(),
      path: window.location.pathname,
      ...eventData
    };

    fetch('/api/analytics/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event),
      credentials: 'include'
    }).catch(error => {
      console.error('Error tracking enhanced event:', error);
    });
  }

  /**
   * Track a custom event (simplified API for backward compatibility)
   */
  trackEvent(eventType: string, eventData?: any) {
    if (!this.initialized) return;
    
    // Extract category, action, label if provided in eventData
    let category, action, label, value;
    if (eventData && typeof eventData === 'object') {
      ({ category, action, label, value, ...eventData } = eventData);
    }
    
    // Create enhanced event data
    const enhancedEventData: EventData = {
      sessionId: this.sessionId,
      userId: this.userId || undefined,
      eventType,
      category: category || this.getCategoryForEventType(eventType),
      action: action || eventType,
      label: label,
      value: value,
      eventData,
      timestamp: new Date(),
      path: window.location.pathname
    };

    // Use the enhanced event tracking
    this.trackEnhancedEvent(enhancedEventData);
  }
  
  /**
   * Helper to map event types to categories
   */
  private getCategoryForEventType(eventType: string): string {
    // Map common event types to categories
    const categoryMap: Record<string, string> = {
      'click': 'user_interaction',
      'view': 'content',
      'scroll': 'user_engagement',
      'search': 'search',
      'form_submit': 'conversion',
      'signup': 'conversion',
      'login': 'auth',
      'logout': 'auth',
      'purchase': 'ecommerce',
      'add_to_cart': 'ecommerce',
      'video_play': 'media',
      'video_pause': 'media',
      'video_complete': 'media',
      'error': 'error',
    };
    
    return categoryMap[eventType] || 'other';
  }

  /**
   * Track user authentication events
   */
  trackAuthentication(isLogin: boolean, userId?: number) {
    if (isLogin && userId) {
      this.userId = userId;
      this.trackEvent('auth', { action: 'login', userId });
    } else {
      this.trackEvent('auth', { action: 'logout', userId: this.userId });
      this.userId = null;
    }
  }

  // Browser, OS, and device info is now captured directly from navigator.userAgent
}

// Export a singleton instance of the analytics tracker
export const analyticsTracker = new AnalyticsTracker();