import React, { createContext, useContext, useState, ReactNode } from 'react';

type TooltipType = 'weather' | 'rocket' | 'chat' | null;

interface NavigationTooltipContextType {
  activeTooltip: TooltipType;
  setActiveTooltip: (tooltip: TooltipType) => void;
  toggleTooltip: (tooltip: TooltipType) => void;
}

const NavigationTooltipContext = createContext<NavigationTooltipContextType | undefined>(undefined);

export function NavigationTooltipProvider({ children }: { children: ReactNode }) {
  const [activeTooltip, setActiveTooltip] = useState<TooltipType>(null);

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