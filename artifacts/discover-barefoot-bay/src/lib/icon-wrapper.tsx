import React from 'react';
import * as LucideIcons from 'lucide-react';
import { SVGAttributeCleanup } from './svg-cleanup';

// Type for Lucide icon props
export type IconProps = React.ComponentProps<typeof LucideIcons.AlertCircle>;

// Creates a wrapped version of a Lucide icon that fixes SVG attribute formatting issues
export function createCleanIcon(IconComponent: React.ComponentType<IconProps>) {
  const CleanIcon = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => {
    return (
      <IconComponent
        ref={ref as any}
        {...props}
        // @ts-ignore - Override the SVG element to use our cleanup component
        svgComponent={SVGAttributeCleanup}
      />
    );
  });
  
  CleanIcon.displayName = `Clean${IconComponent.displayName || 'Icon'}`;
  return CleanIcon;
}

// Create wrapped versions of commonly used Lucide icons
export const CleanIcons = {
  Check: createCleanIcon(LucideIcons.Check),
  ChevronRight: createCleanIcon(LucideIcons.ChevronRight),
  ChevronDown: createCleanIcon(LucideIcons.ChevronDown),
  ChevronLeft: createCleanIcon(LucideIcons.ChevronLeft),
  Circle: createCleanIcon(LucideIcons.Circle),
  Settings: createCleanIcon(LucideIcons.Settings),
  Loader2: createCleanIcon(LucideIcons.Loader2),
  CalendarIcon: createCleanIcon(LucideIcons.Calendar),
  X: createCleanIcon(LucideIcons.X),
  MoreHorizontal: createCleanIcon(LucideIcons.MoreHorizontal),
  GripVertical: createCleanIcon(LucideIcons.GripVertical)
};