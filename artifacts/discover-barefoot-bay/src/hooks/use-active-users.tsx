import { useState, useEffect, useRef } from 'react';

interface ActiveUser {
  userId: number | string;
  username: string;
  lastActive: string;
  path: string;
}

interface UseActiveUsersReturn {
  activeUsers: ActiveUser[];
  activeUserCount: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for tracking and retrieving active users on a specific page
 * @param path - The page path to track (e.g., '/forum/post/267')
 * @param enabled - Whether to enable tracking (default: true)
 * @returns Object with active users data and state
 */
export function useActiveUsers(path: string, enabled: boolean = true): UseActiveUsersReturn {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track user activity on this page
  const trackActivity = async () => {
    if (!enabled) return;
    
    try {
      const response = await fetch('/api/active-users/track-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ path })
      });

      if (!response.ok) {
        console.warn('Failed to track user activity:', response.statusText);
      }
    } catch (err) {
      console.warn('Error tracking user activity:', err);
    }
  };

  // Fetch active users for this page
  const fetchActiveUsers = async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/active-users?path=${encodeURIComponent(path)}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.activeUsers) {
          setActiveUsers(result.activeUsers);
          setError(null);
        } else {
          setActiveUsers([]);
          setError(null);
        }
      } else {
        setError('Failed to fetch active users');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) {
      setActiveUsers([]);
      setIsLoading(false);
      return;
    }

    // Track initial activity and fetch immediately
    trackActivity();
    fetchActiveUsers();

    const startTimers = () => {
      if (trackingIntervalRef.current || intervalRef.current) return;
      trackingIntervalRef.current = setInterval(trackActivity, 30000);
      intervalRef.current = setInterval(fetchActiveUsers, 10000);
    };
    const stopTimers = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
    };

    // Only run the polling timers while the tab is visible. The Replit iOS
    // app backgrounds the WebView every time the user switches to chat with
    // the agent; without this gate these intervals kept firing in the
    // background and contributed to the reload loop on return.
    const onVisibility = () => {
      if (document.hidden) {
        stopTimers();
      } else {
        // Trigger an immediate refresh so we don't show stale data after wake.
        trackActivity();
        fetchActiveUsers();
        startTimers();
      }
    };

    if (typeof document === "undefined" || !document.hidden) {
      startTimers();
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      stopTimers();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [path, enabled]);

  return {
    activeUsers,
    activeUserCount: activeUsers.length,
    isLoading,
    error
  };
}

interface SiteActiveUser {
  userId: number | string;
  username: string;
  lastActive: string;
  path: string;
  device: string;
}

interface UseSiteActiveUsersReturn {
  activeUsers: SiteActiveUser[];
  activeUserCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook for the admin Analytics Dashboard: returns SITE-WIDE active users (everyone
 * active across the whole site in the last 15 minutes), not page-scoped.
 * Backed by the admin endpoint GET /api/analytics/activeusers.
 * @param pollIntervalMs - how often to refresh (default 30s)
 */
export function useSiteActiveUsers(pollIntervalMs: number = 30000): UseSiteActiveUsersReturn {
  const [activeUsers, setActiveUsers] = useState<SiteActiveUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchActiveUsers = async () => {
    try {
      const response = await fetch('/api/analytics/activeusers', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch active users: ${response.statusText}`);
      }

      const result = await response.json();
      const users = Array.isArray(result?.data?.users) ? result.data.users : [];
      const mapped: SiteActiveUser[] = users.map((u: any) => ({
        userId: u?.user?.id ?? u?.sessionId ?? 'unknown',
        username: u?.user?.username || u?.user?.fullName || 'Guest',
        lastActive: u?.endTime || u?.startTime || new Date().toISOString(),
        path: u?.currentPage?.path || '/',
        device: u?.device || 'Unknown',
      }));
      setActiveUsers(mapped);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveUsers();

    const startTimer = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(fetchActiveUsers, pollIntervalMs);
    };
    const stopTimer = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Only poll while the tab is visible (avoids background timers on the Replit iOS app).
    const onVisibility = () => {
      if (document.hidden) {
        stopTimer();
      } else {
        fetchActiveUsers();
        startTimer();
      }
    };

    if (typeof document === 'undefined' || !document.hidden) {
      startTimer();
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      stopTimer();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollIntervalMs]);

  return {
    activeUsers,
    activeUserCount: activeUsers.length,
    isLoading,
    error,
    refresh: fetchActiveUsers,
  };
}