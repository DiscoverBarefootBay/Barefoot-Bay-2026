import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ScrollableContentProps extends React.HTMLAttributes<HTMLDivElement> {
  maxHeight?: string;
  className?: string;
  contentClassName?: string;
}

/**
 * A component that wraps content in a scrollable container while allowing dropdowns to overflow
 * 
 * This component positions selects and dropdowns correctly by creating a container with
 * overflow-y: auto for vertical scrolling, but still allowing popups and dropdowns to
 * be visible outside the container.
 */
export function ScrollableContent({
  maxHeight = "70vh",
  className,
  contentClassName,
  children,
  ...props
}: ScrollableContentProps) {
  return (
    <div
      className={cn(
        "relative max-w-full",
        className
      )}
      {...props}
    >
      <div 
        className={cn(
          "overflow-y-auto",
          contentClassName
        )}
        style={{ maxHeight }}
      >
        {children}
      </div>
    </div>
  );
}