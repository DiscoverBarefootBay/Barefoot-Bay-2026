import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { RocketEasterEggOverlay } from '@/components/launch/rocket-easter-egg-overlay';

interface RocketEasterEggContextType {
  triggerLaunch: () => void;
  isLaunching: boolean;
}

const RocketEasterEggContext = createContext<RocketEasterEggContextType | undefined>(undefined);

export function RocketEasterEggProvider({ children }: { children: ReactNode }) {
  const [isLaunching, setIsLaunching] = useState(false);

  const triggerLaunch = useCallback(() => {
    setIsLaunching(true);
  }, []);

  const handleComplete = useCallback(() => {
    setIsLaunching(false);
  }, []);

  return (
    <RocketEasterEggContext.Provider value={{ triggerLaunch, isLaunching }}>
      {children}
      {createPortal(
        <RocketEasterEggOverlay isActive={isLaunching} onComplete={handleComplete} />,
        document.body
      )}
    </RocketEasterEggContext.Provider>
  );
}

export function useRocketEasterEgg() {
  const context = useContext(RocketEasterEggContext);
  if (context === undefined) {
    throw new Error('useRocketEasterEgg must be used within a RocketEasterEggProvider');
  }
  return context;
}
