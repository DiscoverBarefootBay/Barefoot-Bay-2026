import React from 'react';
import { useLocation } from 'wouter';
import { BarChart3, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DirectAnalyticsLink() {
  const [, navigate] = useLocation();

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        onClick={() => navigate('/admin/analytics-dashboard')}
        size="lg"
        className="rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg flex items-center gap-2 py-6 px-6"
      >
        <BarChart3 className="h-5 w-5" />
        <span className="font-bold">Analytics Dashboard</span>
        <ExternalLink className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}