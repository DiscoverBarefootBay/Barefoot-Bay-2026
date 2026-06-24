import { useRef, useCallback } from 'react';

interface UseMultiClickEasterEggOptions {
  clickCount: number;
  timeWindow: number;
  onTrigger: () => void;
}

export function useMultiClickEasterEgg({
  clickCount,
  timeWindow,
  onTrigger,
}: UseMultiClickEasterEggOptions) {
  const clickTimestamps = useRef<number[]>([]);
  const hasTriggered = useRef(false);

  const handleClick = useCallback(() => {
    const now = Date.now();
    
    clickTimestamps.current.push(now);
    
    clickTimestamps.current = clickTimestamps.current.filter(
      timestamp => now - timestamp <= timeWindow
    );
    
    console.log('[EASTER-EGG] Click registered. Count in window:', clickTimestamps.current.length);
    
    if (clickTimestamps.current.length >= clickCount && !hasTriggered.current) {
      console.log('[EASTER-EGG] Trigger condition met! Launching easter egg...');
      hasTriggered.current = true;
      clickTimestamps.current = [];
      onTrigger();
      
      setTimeout(() => {
        hasTriggered.current = false;
      }, 5000);
      
      return true;
    }
    
    return false;
  }, [clickCount, timeWindow, onTrigger]);

  const isSequenceActive = useCallback(() => {
    const now = Date.now();
    const recentClicks = clickTimestamps.current.filter(
      timestamp => now - timestamp <= timeWindow
    );
    return recentClicks.length >= 2;
  }, [timeWindow]);

  const reset = useCallback(() => {
    clickTimestamps.current = [];
    hasTriggered.current = false;
  }, []);

  return { handleClick, reset, isSequenceActive };
}
