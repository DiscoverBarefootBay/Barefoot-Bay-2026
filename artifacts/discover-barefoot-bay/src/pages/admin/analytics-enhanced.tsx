import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { format, subDays } from 'date-fns';
import { Loader2, LayoutDashboard } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Link } from 'wouter';

// Import the TrafficMetricsPanel component
import { TrafficMetricsPanel } from '@/components/admin/traffic-metrics-panel';

export default function AnalyticsEnhanced() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>({
    totalPageViews: 0,
    uniqueUsers: 0,
    avgSessionDuration: 0,
    bounce_rate: 0,
    pageViews: [],
    topPages: [],
    devices: [],
    browsers: [],
    referrers: [],
    // Traffic metrics data
    totalUniqueVisitors: 0,
    totalUniqueIPs: 0,
    totalAuthenticatedUsers: 0,
    totalUnauthenticatedUsers: 0,
    totalBounces: 0,
    bounceRate: 0
  });
  
  // Fetch analytics data
  const fetchAnalyticsData = async () => {
    try {
      setIsLoading(true);
      
      const fromDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const toDate = format(new Date(), 'yyyy-MM-dd');
      const queryParams = `?startDate=${fromDate}&endDate=${toDate}`;
      
      const response = await fetch(`/api/analytics-data${queryParams}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics data: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Analytics data received:', data);
      setAnalyticsData(data);
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
  
  // Create a simple layout that works with or without authentication
  const SimpleLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="w-full min-h-screen bg-background">
      <div className="container mx-auto p-4">
        {children}
      </div>
    </div>
  );

  return (
    <SimpleLayout>
      <div className="container mx-auto py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Enhanced Analytics Dashboard</h1>
            <p className="text-muted-foreground">Traffic metrics and visitor analytics</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/'}
              className="flex items-center gap-1"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </Button>
            
            <Button variant="outline" size="icon" onClick={fetchAnalyticsData} title="Refresh Data">
              <Loader2 className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <Tabs defaultValue="overview">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="traffic">Traffic Metrics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Total Page Views</CardTitle>
                  <CardDescription>Last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      analyticsData.totalPageViews.toLocaleString()
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Unique Users</CardTitle>
                  <CardDescription>Last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      analyticsData.uniqueUsers.toLocaleString()
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Avg. Session Duration</CardTitle>
                  <CardDescription>Time spent on site</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      `${Math.floor(analyticsData.avgSessionDuration / 60)}m ${Math.floor(analyticsData.avgSessionDuration % 60)}s`
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Bounce Rate</CardTitle>
                  <CardDescription>Single page sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      `${Math.round(analyticsData.bounce_rate || 0)}%`
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="traffic">
            <div className="mb-6">
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
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="mt-8 p-4 border border-dashed rounded-lg bg-muted">
          <h2 className="text-xl font-semibold mb-2">Implementation Status</h2>
          <p>This is a simplified version of the Enhanced Analytics Dashboard that focuses on the new traffic metrics. The following features were added:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Total unique visitors (by session)</li>
            <li>Unique IP addresses that accessed the site</li>
            <li>Number of signed-in users who visited</li>
            <li>Number of unsigned users who visited</li>
            <li>Bounce count and bounce rate percentage</li>
          </ul>
        </div>
      </div>
    </SimpleLayout>
  );
}