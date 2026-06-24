import { useEffect, useRef } from 'react';

/**
 * Custom hook for setting up an interval that cleans up on unmount
 * Leverages the useRef hook to avoid unnecessary re-renders
 * 
 * @param callback Function to call on each interval
 * @param delay Delay in milliseconds (null to pause the interval)
 * @param immediate Whether to run the callback immediately on mount
 */
function useInterval(
  callback: () => void, 
  delay: number | null,
  immediate: boolean = false
) {
  const savedCallback = useRef<() => void>();

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    // If immediate is true, run the callback right away
    if (immediate && savedCallback.current) {
      savedCallback.current();
    }
    
    // Don't schedule if delay is null
    if (delay === null) return;
    
    function tick() {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }
    
    const id = setInterval(tick, delay);
    
    // Cleanup on unmount
    return () => clearInterval(id);
  }, [delay, immediate]);
}

export default useInterval;