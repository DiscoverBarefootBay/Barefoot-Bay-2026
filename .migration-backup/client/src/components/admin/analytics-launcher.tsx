import React from 'react';
import { useLocation } from 'wouter';
import { BarChart3, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AnalyticsLauncher() {
  const [, navigate] = useLocation();

  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col gap-2">
      <Button
        onClick={() => navigate('/admin/analytics-dashboard')}
        size="sm"
        className="rounded-md bg-primary/90 hover:bg-primary text-white shadow-lg flex items-center gap-2"
      >
        <BarChart3 className="h-4 w-4" />
        <span>Analytics</span>
        <ArrowUpRight className="h-3 w-3" />
      </Button>
      <Button
        onClick={() => navigate('/admin/enhanced-analytics')}
        size="sm"
        className="rounded-md bg-green-600/90 hover:bg-green-600 text-white shadow-lg flex items-center gap-2"
      >
        <BarChart3 className="h-4 w-4" />
        <span>Enhanced Analytics</span>
        <ArrowUpRight className="h-3 w-3" />
      </Button>
    </div>
  );
}