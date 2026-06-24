/**
 * DISABLED Utility for calendar synchronization
 * 
 * This is a stub implementation that provides the same interface but performs no operations.
 * All WebSocket functionality has been disabled to prevent conflicts with Object Storage.
 */

import { Event } from '@shared/schema';

export type CalendarEventAction = 'create' | 'update' | 'delete' | 'bulk';
export type CalendarEventHandler = (action: CalendarEventAction, data: any) => void;

export interface CalendarSyncOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  debug?: boolean;
}

// Stub class that implements the CalendarSync interface but performs no operations
export class CalendarSync {
  private handlers: CalendarEventHandler[] = [];
  private options: CalendarSyncOptions;
  
  constructor(options: CalendarSyncOptions = {}) {
    this.options = {
      debug: false,
      ...options
    };
    
    // Log disabled message
    this.log('WebSocket functionality is disabled to prevent conflicts with Object Storage');
  }
  
  // Private helper for logging when debug is enabled
  private log(...args: any[]) {
    if (this.options.debug) {
      console.log('[CalendarSync]', ...args);
    }
  }
  
  // Connect to the WebSocket server - DISABLED
  public connect() {
    this.log('WebSocket connect() call ignored - functionality is disabled');
    return;
  }
  
  // Register a handler for calendar events - DISABLED but maintains API
  public subscribe(handler: CalendarEventHandler) {
    this.log('WebSocket subscribe() call ignored - functionality is disabled');
    return () => this.unsubscribe(handler);
  }
  
  // Remove a previously registered handler - DISABLED but maintains API
  public unsubscribe(handler: CalendarEventHandler) {
    this.log('WebSocket unsubscribe() call ignored - functionality is disabled');
  }
  
  // Manually disconnect - DISABLED but maintains API
  public disconnect() {
    this.log('WebSocket disconnect() call ignored - functionality is disabled');
  }
  
  // Check if currently connected - always returns false
  public isConnected() {
    return false;
  }
}

// Create a singleton instance for app-wide use with clear disabled warning
const calendarSync = new CalendarSync({ debug: true });

// Export as default for use throughout the application
export default calendarSync;