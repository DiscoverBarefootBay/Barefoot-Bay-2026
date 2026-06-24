import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import AdminLayout from '@/components/layouts/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LineChart, BarChart, ResponsiveContainer, Area, Legend, 
  Bar, CartesianGrid, XAxis, YAxis, Tooltip, Line } from 'recharts';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRange } from 'react-day-picker';
import { addDays, format, subDays, parseISO } from 'date-fns';
import { Loader2, Download, RefreshCw, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import 'react-datepicker/dist/react-datepicker.css';
import { saveAs } from 'file-saver';
import { Badge } from '@/components/ui/badge';

// Import our custom components
import { ActiveUsersPanel } from '@/components/admin/active-users-panel';
import { UserJourneyVisualization } from '@/components/admin/user-journey-visualization';
import { ActivityHeatmap } from '@/components/admin/activity-heatmap';
import { ClickHeatmap } from '@/components/admin/click-heatmap';
import { UserSegments } from '@/components/admin/user-segments';
import { ExportReports } from '@/components/admin/export-reports';
import { TrafficMetricsPanel } from '@/components/admin/traffic-metrics-panel';
import GeoLocationMap from '@/components/admin/geo-location-map';

// Analytics Dashboard Component
export default function EnhancedAnalyticsDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFrame, setTimeFrame] = useState('30d');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  
  // State for analytics data
  const [analyticsData, setAnalyticsData] = useState<any>({
    totalPageViews: 0,
    uniqueUsers: 0,
    avgSessionDuration: 0,
    bounce_rate: 0,
    pageViews: [],
    topPages: [],
    devices: [],
    browsers: [],
    referrers: []
  });
  
  // Fetch analytics data
  const fetchAnalyticsData = async () => {
    try {
      setIsLoading(true);
      
      let queryParams = '';
      if (dateRange?.from && dateRange?.to) {
        const fromDate = format(dateRange.from, 'yyyy-MM-dd');
        const toDate = format(dateRange.to, 'yyyy-MM-dd');
        queryParams = `?startDate=${fromDate}&endDate=${toDate}`;
      }
      
      const response = await fetch(`/api/analytics-data${queryParams}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics data: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAnalyticsData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle time frame change
  const handleTimeFrameChange = (value: string) => {
    setTimeFrame(value);
    
    // Update date range based on selected time frame
    const now = new Date();
    let from;
    
    switch (value) {
      case '7d':
        from = subDays(now, 7);
        break;
      case '14d':
        from = subDays(now, 14);
        break;
      case '30d':
        from = subDays(now, 30);
        break;
      case '90d':
        from = subDays(now, 90);
        break;
      case 'today':
        from = now;
        break;
      default:
        from = subDays(now, 30);
    }
    
    setDateRange({ from, to: now });
  };
  
  // Export data to CSV
  const exportData = () => {
    const csvData = [
      ['Date', 'Page Views', 'Unique Users'],
      ...analyticsData.pageViews.map((day: any) => [
        day.date,
        day.count,
        day.users
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };
  
  // Fetch data on component mount and when date range changes
  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange]);
  
  return (
    <AdminLayout>
      <div className="container mx-auto py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Track user activity and engagement</p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2">
              <Label htmlFor="timeframe">Time Frame:</Label>
              <Select value={timeFrame} onValueChange={handleTimeFrameChange}>
                <SelectTrigger id="timeframe" className="w-[180px]">
                  <SelectValue placeholder="Select time period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" size="icon" onClick={fetchAnalyticsData} title="Refresh Data">
              <RefreshCw className="h-4 w-4" />
            </Button>
            
            <Button variant="outline" onClick={exportData} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
        
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="realtime">Real-Time</TabsTrigger>
            <TabsTrigger value="journeys">User Journeys</TabsTrigger>
            <TabsTrigger value="location">Geolocation</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Total Page Views</CardTitle>
                  <CardDescription>Last {timeFrame === 'today' ? '24 hours' : timeFrame.replace('d', ' days')}</CardDescription>
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
                  <CardDescription>Last {timeFrame === 'today' ? '24 hours' : timeFrame.replace('d', ' days')}</CardDescription>
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

            {/* Traffic Metrics Panel - New Component */}
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
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle>Page Views Over Time</CardTitle>
                  <CardDescription>Daily page views and unique users</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center items-center h-80">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : analyticsData.pageViews && analyticsData.pageViews.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={analyticsData.pageViews}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(value) => {
                            try {
                              return format(parseISO(value), 'MMM dd');
                            } catch (e) {
                              return value;
                            }
                          }}
                        />
                        <YAxis />
                        <Tooltip 
                          formatter={(value: any) => [value, '']}
                          labelFormatter={(label) => {
                            try {
                              return format(parseISO(label as string), 'MMMM d, yyyy');
                            } catch (e) {
                              return label;
                            }
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="count" 
                          name="Page Views" 
                          stroke="#2563eb" 
                          strokeWidth={2} 
                          dot={{ r: 1 }} 
                          activeDot={{ r: 5 }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="users" 
                          name="Unique Visitors" 
                          stroke="#10b981" 
                          strokeWidth={2}
                          dot={{ r: 1 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex justify-center items-center h-80 text-muted-foreground">
                      No data available for the selected time period
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Top Pages</CardTitle>
                  <CardDescription>Most viewed pages</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center items-center h-80">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : analyticsData.topPages && analyticsData.topPages.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analyticsData.topPages.slice(0, 7)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          dataKey="path" 
                          type="category" 
                          width={150}
                          tickFormatter={(value) => {
                            // Format path for display
                            if (value === '/') return 'Home';
                            return value.replace(/^\//, '').replace(/-/g, ' ');
                          }}
                        />
                        <Tooltip 
                          formatter={(value: any) => [`${value} views`, 'Count']}
                          labelFormatter={(label) => {
                            return label === '/' ? 'Homepage' : `Page: ${label}`;
                          }}
                        />
                        <Bar dataKey="count" name="Views" fill="#2563eb" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex justify-center items-center h-80 text-muted-foreground">
                      No data available for the selected time period
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Devices</CardTitle>
                  <CardDescription>User device types</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : analyticsData.devices && analyticsData.devices.length > 0 ? (
                    <div className="space-y-4">
                      {analyticsData.devices.map((device: any, index: number) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{device.device || 'Unknown'}</Badge>
                          </div>
                          <span className="font-medium">{device.count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex justify-center items-center h-40 text-muted-foreground">
                      No device data available
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Browsers</CardTitle>
                  <CardDescription>User browser types</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : analyticsData.browsers && analyticsData.browsers.length > 0 ? (
                    <div className="space-y-4">
                      {analyticsData.browsers.map((browser: any, index: number) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{browser.browser || 'Unknown'}</Badge>
                          </div>
                          <span className="font-medium">{browser.count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex justify-center items-center h-40 text-muted-foreground">
                      No browser data available
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Referrers</CardTitle>
                  <CardDescription>Traffic sources</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : analyticsData.referrers && analyticsData.referrers.length > 0 ? (
                    <div className="space-y-4">
                      {analyticsData.referrers.map((referrer: any, index: number) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {referrer.referrer ? new URL(referrer.referrer).hostname : 'Direct'}
                            </Badge>
                          </div>
                          <span className="font-medium">{referrer.count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex justify-center items-center h-40 text-muted-foreground">
                      No referrer data available
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Export Reports */}
              <div className="col-span-1 lg:col-span-2 mt-6">
                <ExportReports />
              </div>
            </div>
          </TabsContent>
          
          {/* Real-Time Tab */}
          <TabsContent value="realtime">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <ActiveUsersPanel />
              
              <Card>
                <CardHeader>
                  <CardTitle>Real-Time Activity</CardTitle>
                  <CardDescription>What users are doing right now</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px] flex items-center justify-center">
                  <div className="text-center p-6">
                    <div className="mb-4 text-muted-foreground">
                      Real-time activity tracking is active
                    </div>
                    <Badge variant="outline" className="mb-2">Activity data refreshes every 30 seconds</Badge>
                  </div>
                </CardContent>
              </Card>
              
              {/* Activity heatmap - spans full width */}
              <div className="col-span-1 md:col-span-2">
                <ActivityHeatmap />
              </div>
            </div>
          </TabsContent>
          
          {/* User Journeys Tab */}
          <TabsContent value="journeys">
            <UserJourneyVisualization />
          </TabsContent>
          
          {/* Geolocation Tab */}
          <TabsContent value="location">
            <GeoLocationMap />
          </TabsContent>
          
          {/* Pages Tab */}
          <TabsContent value="pages">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Page Performance</CardTitle>
                  <CardDescription>Detailed metrics for individual pages</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-8 text-muted-foreground">
                    <p className="mb-4">Page-level performance metrics will be implemented here</p>
                    <Badge variant="outline">Coming Soon</Badge>
                  </div>
                </CardContent>
              </Card>
              
              {/* Click Heatmap */}
              <ClickHeatmap />
            </div>
          </TabsContent>
          
          {/* Users Tab */}
          <TabsContent value="users">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>User Insights</CardTitle>
                  <CardDescription>Understand your users better</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-muted-foreground mb-4">
                    <p>Analyze your user base through different segmentation techniques</p>
                  </div>
                </CardContent>
              </Card>
              
              {/* User Segments */}
              <UserSegments />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}