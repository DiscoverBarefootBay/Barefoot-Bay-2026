import { useState, useRef, useCallback, useEffect } from 'react';

interface UsePressAndHoldOptions {
  duration?: number;
  onComplete: () => void;
}

interface PressAndHoldState {
  progress: number;
  isActive: boolean;
  hasFired: boolean;
  reset: () => void;
  attachRef: (node: HTMLElement | null) => void;
}

export function usePressAndHold({ 
  duration = 5000, 
  onComplete 
}: UsePressAndHoldOptions): PressAndHoldState {
  const [progress, setProgress] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [element, setElement] = useState<HTMLElement | null>(null);
  const hasFiredRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const cancelHold = useCallback(() => {
    console.log('[PRESS-HOLD] Canceling hold');
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    startTimeRef.current = null;
    setProgress(0);
    setIsActive(false);
  }, []);

  const reset = useCallback(() => {
    cancelHold();
    hasFiredRef.current = false;
  }, [cancelHold]);

  const updateProgress = useCallback(() => {
    if (startTimeRef.current === null) return;

    const elapsed = Date.now() - startTimeRef.current;
    const newProgress = Math.min(elapsed / duration, 1);
    setProgress(newProgress);

    if (newProgress < 1) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, [duration]);

  const startHold = useCallback(() => {
    if (hasFiredRef.current) {
      console.log('[PRESS-HOLD] Already fired, ignoring start');
      return;
    }

    console.log('[PRESS-HOLD] Starting hold, duration:', duration);
    setIsActive(true);
    startTimeRef.current = Date.now();
    
    animationFrameRef.current = requestAnimationFrame(updateProgress);

    timerRef.current = window.setTimeout(() => {
      console.log('[PRESS-HOLD] Hold completed!');
      hasFiredRef.current = true;
      setIsActive(false);
      setProgress(1);
      onComplete();
      
      setTimeout(() => {
        setProgress(0);
      }, 500);
    }, duration);
  }, [duration, onComplete, updateProgress]);

  // Callback ref to track the DOM element
  const attachRef = useCallback((node: HTMLElement | null) => {
    console.log('[PRESS-HOLD] Callback ref called with node:', node);
    setElement(node);
  }, []);

  // Attach native DOM event listeners when element becomes available
  useEffect(() => {
    if (!element) {
      console.log('[PRESS-HOLD] No target element found');
      return;
    }

    console.log('[PRESS-HOLD] Attaching native event listeners to element');

    // Pointer events
    const handlePointerDown = (e: PointerEvent) => {
      console.log('[PRESS-HOLD] Native pointerdown event fired');
      startHold();
    };

    const handlePointerUp = () => {
      console.log('[PRESS-HOLD] Native pointerup event fired');
      if (isActive && !hasFiredRef.current) {
        cancelHold();
      }
    };

    const handlePointerLeave = () => {
      console.log('[PRESS-HOLD] Native pointerleave event fired');
      if (isActive && !hasFiredRef.current) {
        cancelHold();
      }
    };

    const handlePointerCancel = () => {
      console.log('[PRESS-HOLD] Native pointercancel event fired');
      if (isActive && !hasFiredRef.current) {
        cancelHold();
      }
    };

    // Touch events
    const handleTouchStart = (e: TouchEvent) => {
      console.log('[PRESS-HOLD] Native touchstart event fired');
      startHold();
    };

    const handleTouchEnd = () => {
      console.log('[PRESS-HOLD] Native touchend event fired');
      if (isActive && !hasFiredRef.current) {
        cancelHold();
      }
    };

    const handleTouchCancel = () => {
      console.log('[PRESS-HOLD] Native touchcancel event fired');
      if (isActive && !hasFiredRef.current) {
        cancelHold();
      }
    };

    // Keyboard events
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        if (!isActive) {
          console.log('[PRESS-HOLD] Native keydown event fired');
          e.preventDefault();
          startHold();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        if (isActive && !hasFiredRef.current) {
          console.log('[PRESS-HOLD] Native keyup event fired');
          cancelHold();
        }
      }
    };

    // Window blur event
    const handleBlur = () => {
      if (isActive) {
        console.log('[PRESS-HOLD] Window blur - canceling hold');
        cancelHold();
      }
    };

    // Add all event listeners
    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointerup', handlePointerUp);
    element.addEventListener('pointerleave', handlePointerLeave);
    element.addEventListener('pointercancel', handlePointerCancel);
    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchcancel', handleTouchCancel);
    element.addEventListener('keydown', handleKeyDown);
    element.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    console.log('[PRESS-HOLD] Event listeners attached successfully');

    // Cleanup on unmount
    return () => {
      console.log('[PRESS-HOLD] Removing event listeners');
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointerup', handlePointerUp);
      element.removeEventListener('pointerleave', handlePointerLeave);
      element.removeEventListener('pointercancel', handlePointerCancel);
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
      element.removeEventListener('keydown', handleKeyDown);
      element.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      cancelHold();
    };
  }, [element, startHold, cancelHold, isActive]);

  return {
    progress,
    isActive,
    hasFired: hasFiredRef.current,
    reset,
    attachRef,
  };
}
