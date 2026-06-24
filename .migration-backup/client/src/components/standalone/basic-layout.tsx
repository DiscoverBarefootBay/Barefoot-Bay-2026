import React from 'react';
import { cn } from '@/lib/utils';

interface BasicLayoutProps {
  children: React.ReactNode;
  className?: string;
  navbarContent?: React.ReactNode;
}

/**
 * A minimal layout component designed for standalone pages that don't need the full application chrome
 * Use this layout for analytics dashboards, diagnostics, and public-facing pages
 */
export const BasicLayout: React.FC<BasicLayoutProps> = ({ 
  children, 
  className,
  navbarContent
}) => {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {navbarContent && (
        <div className="w-full border-b">
          <div className="container mx-auto p-4">
            {navbarContent}
          </div>
        </div>
      )}
      <main className={cn("flex-1", className)}>
        <div className="container mx-auto p-4">
          {children}
        </div>
      </main>
      <footer className="w-full border-t py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Barefoot Bay Analytics Dashboard</p>
        </div>
      </footer>
    </div>
  );
};

export default BasicLayout;