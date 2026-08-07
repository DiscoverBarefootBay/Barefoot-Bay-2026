import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'wouter';

type TooltipType = 'weather' | 'rocket' | 'chat' | null;

interface NavigationTooltipContextType {
  activeTooltip: TooltipType;
  setActiveTooltip: (tooltip: TooltipType) => void;
  toggleTooltip: (tooltip: TooltipType) => void;
}

const NavigationTooltipContext = createContext<NavigationTooltipContextType | undefined>(undefined);

export function NavigationTooltipProvider({ children }: { children: ReactNode }) {
  const [activeTooltip, setActiveTooltip] = useState<TooltipType>(null);
  const [location] = useLocation();

  // Close any open tooltip whenever the route changes so popups never bleed
  // across pages (the nav bar persists across routes; context state does not reset).
  useEffect(() => {
    setActiveTooltip(null);
  }, [location]);

  const toggleTooltip = (tooltip: TooltipType) => {
    setActiveTooltip(current => current === tooltip ? null : tooltip);
  };

  return (
    <NavigationTooltipContext.Provider value={{
      activeTooltip,
      setActiveTooltip,
      toggleTooltip
    }}>
      {children}
    </NavigationTooltipContext.Provider>
  );
}

export function useNavigationTooltip() {
  const context = useContext(NavigationTooltipContext);
  if (context === undefined) {
    throw new Error('useNavigationTooltip must be used within a NavigationTooltipProvider');
  }
  return context;
}