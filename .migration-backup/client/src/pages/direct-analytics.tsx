import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { BasicLayout } from '@/components/standalone/basic-layout';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Home, 
  Users, 
  Clock,
  RefreshCw,
  ExternalLink,
  LayoutDashboard
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Analytics components
import { TrafficMetricsPanel } from '@/components/admin/traffic-metrics-panel';
import { GeoLocationMap } from '@/components/admin/geo-location-map';

/**
 * Direct Analytics Dashboard
 * 
 * A standalone analytics dashboard that can be accessed without authentication
 * Provides a clean interface to view traffic and visitor metrics
 */
export default function DirectAnalytics() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>({
    // Summary metrics
    totalPageViews: 0,
    uniqueUsers: 0,
    avgSessionDuration: 0,
    bounce_rate: 0,
    
    // Detailed metrics
    pageViews: [],
    topPages: [],
    referrers: [],
    
    // Traffic metrics
    totalUniqueVisitors: 0,
    totalUniqueIPs: 0,
    totalAuthenticatedUsers: 0,
    totalUnauthenticatedUsers: 0,
    totalBounces: 0,
    bounceRate: 0,
    
    // Location data
    geoLocations: []
  });
  
  // Navigation header content
  const navbarContent = (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <span className="font-bold text-lg">Analytics Dashboard</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <Home className="h-4 w-4 mr-1" />
            Home
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/analytics-access">
            <LayoutDashboard className="h-4 w-4 mr-1" />
            Analytics Hub
          </Link>
        </Button>
      </div>
    </div>
  );
  
  // Fetch analytics data
  const fetchAnalyticsData = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/analytics/public-dashboard?liveDataOnly=true', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics data: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Analytics data received:', data);
      
      // Process data
      setAnalyticsData({
        ...data,
        // Ensure defaults for any missing properties
        totalPageViews: data.totalPageViews || 0,
        uniqueUsers: data.uniqueUsers || 0,
        avgSessionDuration: data.avgSessionDuration || 0,
        bounce_rate: data.bounce_rate || 0,
        totalUniqueVisitors: data.totalUniqueVisitors || 0,
        totalUniqueIPs: data.totalUniqueIPs || 0,
        totalAuthenticatedUsers: data.totalAuthenticatedUsers || 0,
        totalUnauthenticatedUsers: data.totalUnauthenticatedUsers || 0,
        totalBounces: data.totalBounces || 0,
        bounceRate: data.bounceRate || 0,
        geoLocations: data.geoLocations || []
      });
      
      setError(null);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch data on component mount
  useEffect(() => {
    fetchAnalyticsData();
  }, []);
  
  return (
    <BasicLayout navbarContent={navbarContent} className="py-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Traffic Analytics</h1>
          <p className="text-muted-foreground mt-1">View visitor metrics and engagement</p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchAnalyticsData}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>
      
      {/* Error alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Summary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Page Views
            </CardTitle>
            <CardDescription>Total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading 
                ? <span className="animate-pulse">—</span> 
                : new Intl.NumberFormat().format(analyticsData.totalPageViews)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Unique Visitors
            </CardTitle>
            <CardDescription>Distinct users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading 
                ? <span className="animate-pulse">—</span> 
                : new Intl.NumberFormat().format(analyticsData.uniqueUsers)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Avg. Session
            </CardTitle>
            <CardDescription>Time on site</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading 
                ? <span className="animate-pulse">—</span> 
                : `${Math.floor(analyticsData.avgSessionDuration / 60)}m ${Math.floor(analyticsData.avgSessionDuration % 60)}s`}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-primary" />
              Bounce Rate
            </CardTitle>
            <CardDescription>Single page sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading 
                ? <span className="animate-pulse">—</span> 
                : `${Math.round(analyticsData.bounce_rate || 0)}%`}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabbed sections */}
      <Tabs defaultValue="traffic" className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="traffic">Traffic Stats</TabsTrigger>
          <TabsTrigger value="location">Geographic Data</TabsTrigger>
        </TabsList>
        
        <TabsContent value="traffic">
          <TrafficMetricsPanel
            isLoading={isLoading}
            data={{
              totalUniqueVisitors: analyticsData.totalUniqueVisitors,
              totalUniqueIPs: analyticsData.totalUniqueIPs,
              totalAuthenticatedUsers: analyticsData.totalAuthenticatedUsers,
              totalUnauthenticatedUsers: analyticsData.totalUnauthenticatedUsers,
              totalBounces: analyticsData.totalBounces,
              bounceRate: analyticsData.bounceRate,
            }}
          />
        </TabsContent>
        
        <TabsContent value="location">
          <Card>
            <CardHeader>
              <CardTitle>Visitor Locations</CardTitle>
              <CardDescription>Geographic distribution of site traffic</CardDescription>
            </CardHeader>
            <CardContent className="h-[500px]">
              <GeoLocationMap 
                locations={analyticsData.geoLocations || []} 
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Status info */}
      <div className="p-4 border border-dashed rounded-lg bg-muted/50">
        <p className="text-sm text-muted-foreground">
          This dashboard displays data from the last 30 days.
          <br />
          Last updated: {new Date().toLocaleString()}
        </p>
      </div>
    </BasicLayout>
  );
}