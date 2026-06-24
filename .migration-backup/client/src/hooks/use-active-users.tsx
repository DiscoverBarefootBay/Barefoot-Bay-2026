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

    // Track initial activity
    trackActivity();

    // Set up periodic activity tracking (every 30 seconds)
    trackingIntervalRef.current = setInterval(trackActivity, 30000);

    // Set up periodic fetching of active users (every 10 seconds)
    fetchActiveUsers();
    intervalRef.current = setInterval(fetchActiveUsers, 10000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
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