/**
 * DISABLED Hook for calendar event synchronization
 * 
 * This is a stub implementation that maintains the same API but does not use WebSockets.
 * WebSocket functionality has been disabled to prevent conflicts with Object Storage.
 * 
 * It still provides:
 * - Calendar data refresh capability
 * - Consistent API for components that expect this hook
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';
import { CalendarEventAction } from '@/utils/calendar-sync';

export interface UseCalendarSyncOptions {
  autoRefresh?: boolean;
  showToasts?: boolean;
  onEventUpdate?: (action: CalendarEventAction, data: any) => void;
}

export function useCalendarSync(options: UseCalendarSyncOptions = {}) {
  // Status is always disconnected since WebSockets are disabled
  const [isConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  
  // Log that WebSocket functionality is disabled
  console.log('[CalendarSync] WebSocket functionality is disabled to prevent conflicts with Object Storage');
  
  // Function to refresh calendar data manually
  const refreshCalendarData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      console.log('[CalendarSync] Calendar data refreshed');
    } catch (error) {
      console.error('[CalendarSync] Error refreshing calendar data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);
  
  // Return the same API shape but without WebSocket functionality
  return {
    isConnected,
    isRefreshing,
    refreshCalendarData
  };
}