import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';

/**
 * Very simple standalone analytics dashboard
 * This page uses minimal dependencies to ensure it works properly
 */
export default function AnalyticsStandalone() {
  const [data, setData] = useState({
    pageViews: 0,
    uniqueVisitors: 0,
    avgSessionDuration: 0,
    bounceRate: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Simulate loading analytics data
    const timer = setTimeout(() => {
      setData({
        pageViews: 15278,
        uniqueVisitors: 4209,
        avgSessionDuration: 143,
        bounceRate: 32
      });
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">Analytics Dashboard</span>
          </div>
          <Link href="/" className="text-primary hover:underline">
            Home
          </Link>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Site Analytics</h1>
        
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-card p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-2">Page Views</h2>
              <p className="text-3xl font-bold">{data.pageViews.toLocaleString()}</p>
            </div>
            
            <div className="bg-card p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-2">Unique Visitors</h2>
              <p className="text-3xl font-bold">{data.uniqueVisitors.toLocaleString()}</p>
            </div>
            
            <div className="bg-card p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-2">Avg. Session</h2>
              <p className="text-3xl font-bold">{Math.floor(data.avgSessionDuration / 60)}m {data.avgSessionDuration % 60}s</p>
            </div>
            
            <div className="bg-card p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-2">Bounce Rate</h2>
              <p className="text-3xl font-bold">{data.bounceRate}%</p>
            </div>
          </div>
        )}
        
        <div className="bg-card p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Traffic Sources</h2>
          <div className="h-64 flex items-center justify-center border rounded bg-accent/10">
            <p className="text-muted-foreground">Traffic source visualization would appear here</p>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Visitor Locations</h2>
          <div className="h-96 flex items-center justify-center border rounded bg-accent/10">
            <p className="text-muted-foreground">Geographic map would appear here</p>
          </div>
        </div>
      </main>
      
      <footer className="mt-8 border-t py-6">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>Analytics Dashboard</p>
        </div>
      </footer>
    </div>
  );
}