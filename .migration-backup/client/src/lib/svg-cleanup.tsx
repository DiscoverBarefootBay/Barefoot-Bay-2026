import React, { forwardRef } from 'react';

// This component overrides SVG attributes to ensure proper React camelCase format
// to fix issues with kebab-case attributes that might come from Lucide React icons
const SVGAttributeCleanup = forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  ({ children, ...props }, ref) => {
    // Convert kebab-case to camelCase for SVG attributes
    const cleanedProps: React.SVGProps<SVGSVGElement> = { ...props };
    
    // Explicitly set the properly camelCased attributes
    if ('stroke-width' in props) {
      cleanedProps.strokeWidth = props['stroke-width' as keyof typeof props] as string;
      delete cleanedProps['stroke-width' as keyof typeof cleanedProps];
    }
    
    if ('stroke-linecap' in props) {
      cleanedProps.strokeLinecap = props['stroke-linecap' as keyof typeof props] as string;
      delete cleanedProps['stroke-linecap' as keyof typeof cleanedProps];
    }
    
    if ('stroke-linejoin' in props) {
      cleanedProps.strokeLinejoin = props['stroke-linejoin' as keyof typeof props] as string;
      delete cleanedProps['stroke-linejoin' as keyof typeof cleanedProps];
    }
    
    return (
      <svg ref={ref} {...cleanedProps}>
        {children}
      </svg>
    );
  }
);

SVGAttributeCleanup.displayName = 'SVGAttributeCleanup';

// Make sure to export the component correctly
export { SVGAttributeCleanup };