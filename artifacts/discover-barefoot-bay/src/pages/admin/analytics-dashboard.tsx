import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Users, Eye, MousePointer, Clock, Globe, PieChart, BarChart2, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import ChartErrorBoundary from '@/components/error/chart-error-boundary';

// Types for analytics data
interface DashboardData {
  timeRange: {
    startDate: string;
    endDate: string;
    days: number;
  };
  sessions: {
    total: number;
    uniqueVisitors: number;
    newVsReturning: {
      new: number;
      returning: number;
    };
    byDevice: Array<{
      device: string;
      count: number;
    }>;
    byBrowser: Array<{
      browser: string;
      count: number;
    }>;
    byCountry: Array<{
      country: string;
      count: number;
    }>;
  };
  pageViews: {
    total: number;
    topPages: Array<{
      url: string;
      title: string;
      views: number;
    }>;
    averageLoadTime: number;
  };
  events: {
    total: number;
    byType: Array<{
      type: string;
      count: number;
    }>;
  };
  location: {
    geoData: Array<{
      country: string;
      region: string;
      city: string;
      lat: number;
      lng: number;
      count: number;
    }>;
  };
  traffic: {
    byDay: Array<{
      date: string;
      sessions: number;
    }>;
    pageViewsByDay: Array<{
      date: string;
      pageViews: number;
    }>;
  };
}

interface ActiveUser {
  sessionId: string;
  user: {
    id: number;
    username: string;
    fullName: string;
  } | null;
  deviceType: string;
  browser: string;
  location: {
    country: string;
    city: string;
  };
  startTime: string;
  lastActiveTime: string;
  currentPage: {
    url: string;
    title: string;
  };
}

interface ActiveUsersData {
  count: number;
  users: ActiveUser[];
}

interface UserJourneyData {
  // For pathTransitions
  nodes?: Array<{
    id: string;
    title: string;
  }>;
  links?: Array<{
    source: string;
    target: string;
    value: number;
  }>;
  // For entryPages & exitPages
  url?: string;
  title?: string;
  count?: number;
}

// Normalize a raw API payload into a guaranteed DashboardData shape so the
// render path never throws on a missing/partial/unexpected response.
const toArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const toNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const normalizeDashboardData = (raw: any): DashboardData => ({
  timeRange: {
    startDate: raw?.timeRange?.startDate ?? '',
    endDate: raw?.timeRange?.endDate ?? '',
    days: toNumber(raw?.timeRange?.days),
  },
  sessions: {
    total: toNumber(raw?.sessions?.total),
    uniqueVisitors: toNumber(raw?.sessions?.uniqueVisitors),
    newVsReturning: {
      new: toNumber(raw?.sessions?.newVsReturning?.new),
      returning: toNumber(raw?.sessions?.newVsReturning?.returning),
    },
    byDevice: toArray(raw?.sessions?.byDevice),
    byBrowser: toArray(raw?.sessions?.byBrowser),
    byCountry: toArray(raw?.sessions?.byCountry),
  },
  pageViews: {
    total: toNumber(raw?.pageViews?.total),
    topPages: toArray(raw?.pageViews?.topPages),
    averageLoadTime: toNumber(raw?.pageViews?.averageLoadTime),
  },
  events: {
    total: toNumber(raw?.events?.total),
    byType: toArray(raw?.events?.byType),
  },
  location: {
    geoData: toArray(raw?.location?.geoData),
  },
  traffic: {
    byDay: toArray(raw?.traffic?.byDay),
    pageViewsByDay: toArray(raw?.traffic?.pageViewsByDay),
  },
});

const AnalyticsDashboard: React.FC = () => {
  const [range, setRange] = useState<number>(30);
  const [journeyType, setJourneyType] = useState<'pathTransitions' | 'entryPages' | 'exitPages'>('pathTransitions');
  const [filterBots, setFilterBots] = useState<boolean>(true);

  // Fetch dashboard data
  const { data: dashboardData, isLoading: isLoadingDashboard, error: dashboardError } = useQuery<DashboardData>({
    queryKey: ['analytics', 'dashboard', range, filterBots],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/dashboard?range=${range}&liveDataOnly=${filterBots}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics dashboard data');
      }
      const { data } = await response.json();
      return normalizeDashboardData(data);
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    // Opt out of the global `placeholderData` default (queryClient.ts), which
    // returns `[]` before the first fetch resolves. That empty array is truthy,
    // so it slips past the `!dashboardData` guards below and then `[].traffic`
    // is undefined -> reading `.byDay` throws and crashes the whole page.
    placeholderData: undefined,
  });

  // Fetch active users
  const { data: activeUsersData, isLoading: isLoadingActiveUsers, error: activeUsersError } = useQuery<ActiveUsersData>({
    queryKey: ['analytics', 'activeusers', filterBots],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/activeusers?liveDataOnly=${filterBots}`);
      if (!response.ok) {
        throw new Error('Failed to fetch active users data');
      }
      const result = await response.json();
      if (result.success && result.data) {
        // Map server response to match ActiveUser interface
        return {
          count: result.data.count || result.data.users?.length || 0,
          users: (result.data.users || []).map((session: any) => ({
            sessionId: session.sessionId,
            user: session.user || null,
            deviceType: session.device || 'Unknown',
            browser: session.browser || 'Unknown',
            location: {
              country: session.location?.country || 'Unknown',
              city: session.location?.city || 'Unknown'
            },
            startTime: session.startTime || new Date().toISOString(),
            lastActiveTime: session.endTime || session.startTime || new Date().toISOString(),
            currentPage: {
              url: session.currentPage?.path || '/',
              title: session.currentPage?.pageCategory || 'Unknown'
            }
          }))
        };
      }
      return { count: 0, users: [] };
    },
    refetchInterval: 60 * 1000, // Refetch every minute
    placeholderData: undefined,
  });

  // Fetch user journey data
  const { data: userJourneyData, isLoading: isLoadingJourney, error: journeyError } = useQuery<UserJourneyData[]>({
    queryKey: ['analytics', 'userjourney', journeyType, range, filterBots],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/userjourney/${journeyType}?days=${range}&liveDataOnly=${filterBots}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user journey data');
      }
      const { data } = await response.json();
      // pathTransitions returns a single { nodes, links } object, while
      // entryPages/exitPages return arrays. Normalize both into an array so
      // the render path (userJourneyData[0]) works for every journey type.
      return Array.isArray(data) ? data : (data ? [data] : []);
    },
    placeholderData: undefined,
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Calculate percentage
  const calculatePercentage = (value: number, total: number) => {
    if (total === 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  };

  // Format an ISO date for chart axis ticks (short form)
  const formatChartDate = (value: string) => {
    try {
      return format(parseISO(value), 'MMM d');
    } catch {
      return value;
    }
  };

  // Format an ISO date for chart tooltips (long form)
  const formatChartTooltipDate = (value: any) => {
    try {
      return format(parseISO(value as string), 'MMMM d, yyyy');
    } catch {
      return value;
    }
  };

  // Merge sessions-by-day and page-views-by-day into a single series keyed by date
  const trafficChartData = React.useMemo(() => {
    if (!dashboardData?.traffic) return [];
    const byDate = new Map<string, { date: string; sessions: number; pageViews: number }>();
    for (const day of (dashboardData.traffic.byDay ?? [])) {
      if (!day?.date) continue;
      byDate.set(day.date, { date: day.date, sessions: toNumber(day.sessions), pageViews: 0 });
    }
    for (const day of (dashboardData.traffic.pageViewsByDay ?? [])) {
      if (!day?.date) continue;
      const existing = byDate.get(day.date);
      if (existing) {
        existing.pageViews = toNumber(day.pageViews);
      } else {
        byDate.set(day.date, { date: day.date, sessions: 0, pageViews: toNumber(day.pageViews) });
      }
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [dashboardData]);

  // Aggregate geo data into a labelled, sorted series of visitor counts by location
  const geoChartData = React.useMemo(() => {
    if (!dashboardData?.location) return [];
    return (dashboardData.location.geoData ?? [])
      .map((loc) => {
        const label = [loc.city, loc.region, loc.country].filter(Boolean).join(', ') || 'Unknown';
        return { label, count: toNumber(loc.count) };
      })
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [dashboardData]);

  // Build a labelled, sorted series of the strongest page-to-page transitions
  const pathTransitions = React.useMemo(() => {
    const entry = Array.isArray(userJourneyData) ? userJourneyData[0] : undefined;
    const nodes = entry?.nodes ?? [];
    const links = entry?.links ?? [];
    if (links.length === 0) return [];
    const titleById = new Map<string, string>();
    for (const node of nodes) {
      titleById.set(node.id, node.title || node.id);
    }
    const labelFor = (id: string) => titleById.get(id) || id;
    return links
      .map((link) => ({
        label: `${labelFor(link.source)} → ${labelFor(link.target)}`,
        value: toNumber(link.value),
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [userJourneyData]);

  // Error state - check first so a failed request shows a message instead of
  // being stuck on the loading spinner forever (dashboardData stays undefined).
  if (dashboardError) {
    return (
      <div className="bg-destructive/10 border border-destructive p-4 rounded-md my-4">
        <h3 className="text-destructive font-medium">Error loading analytics</h3>
        <p className="text-destructive/80">{(dashboardError as Error).message}</p>
      </div>
    );
  }

  // Loading state - also check if dashboardData is undefined (can happen during client-side navigation)
  if (isLoadingDashboard || !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading analytics data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="filter-bots" className="text-sm text-muted-foreground cursor-pointer">
              {filterBots ? 'Real Users Only' : 'All Traffic'}
            </Label>
            <Switch
              id="filter-bots"
              checked={filterBots}
              onCheckedChange={setFilterBots}
            />
          </div>
          <Select value={range.toString()} onValueChange={(value) => setRange(parseInt(value))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {dashboardData?.sessions && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="text-2xl font-bold">{dashboardData.sessions.total.toLocaleString()}</div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dashboardData.timeRange.startDate && formatDate(dashboardData.timeRange.startDate)} - {dashboardData.timeRange.endDate && formatDate(dashboardData.timeRange.endDate)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Page Views</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="text-2xl font-bold">{dashboardData.pageViews.total.toLocaleString()}</div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Avg {(dashboardData.sessions.total > 0 ? dashboardData.pageViews.total / dashboardData.sessions.total : 0).toFixed(1)} pages per session
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Unique Visitors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="text-2xl font-bold">{dashboardData.sessions.uniqueVisitors.toLocaleString()}</div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {calculatePercentage(dashboardData.sessions.newVsReturning.new, dashboardData.sessions.total)} new, {calculatePercentage(dashboardData.sessions.newVsReturning.returning, dashboardData.sessions.total)} returning
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <MousePointer className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="text-2xl font-bold">{dashboardData.events.total.toLocaleString()}</div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Interactions tracked across pages
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Dashboard Tabs */}
          <Tabs defaultValue="traffic" className="w-full">
            <TabsList className="grid grid-cols-5 w-full md:w-auto">
              <TabsTrigger value="traffic">Traffic</TabsTrigger>
              <TabsTrigger value="pages">Pages</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="geo">Geography</TabsTrigger>
            </TabsList>

            {/* Traffic Tab */}
            <TabsContent value="traffic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Traffic Overview</CardTitle>
                  <CardDescription>Sessions and page views over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {trafficChartData.length > 0 ? (
                    <ChartErrorBoundary minHeight={300} resetKeys={[range, filterBots, trafficChartData.length]}>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={trafficChartData}>
                        <defs>
                          <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="pageViewsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatChartDate} />
                        <YAxis allowDecimals={false} />
                        <Tooltip labelFormatter={formatChartTooltipDate} />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="sessions"
                          name="Sessions"
                          stroke="#2563eb"
                          strokeWidth={2}
                          fill="url(#sessionsGradient)"
                          activeDot={{ r: 5 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="pageViews"
                          name="Page Views"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#pageViewsGradient)"
                          activeDot={{ r: 5 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    </ChartErrorBoundary>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No traffic data available for the selected time period.
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Sessions by Device</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dashboardData.sessions.byDevice.map((device) => (
                        <div key={device.device} className="flex items-center justify-between">
                          <span>{device.device}</span>
                          <div className="flex items-center">
                            <span className="mr-2">{device.count}</span>
                            <span className="text-muted-foreground">
                              ({calculatePercentage(device.count, dashboardData.sessions.total)})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Browser Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dashboardData.sessions.byBrowser.map((browser) => (
                        <div key={browser.browser} className="flex items-center justify-between">
                          <span>{browser.browser}</span>
                          <div className="flex items-center">
                            <span className="mr-2">{browser.count}</span>
                            <span className="text-muted-foreground">
                              ({calculatePercentage(browser.count, dashboardData.sessions.total)})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Pages Tab */}
            <TabsContent value="pages" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Top Pages</CardTitle>
                  <CardDescription>Most viewed pages in the selected date range</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dashboardData.pageViews.topPages.map((page, index) => (
                      <div key={index} className="flex items-center justify-between p-2 hover:bg-muted rounded-md">
                        <div className="flex-1 truncate">
                          <div className="font-medium">{page.title || 'Untitled Page'}</div>
                          <div className="text-sm text-muted-foreground truncate">{page.url}</div>
                        </div>
                        <div className="flex items-center">
                          <span className="mr-2">{page.views}</span>
                          <span className="text-muted-foreground">
                            ({calculatePercentage(page.views, dashboardData.pageViews.total)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>User Journey</CardTitle>
                  <div className="flex items-center space-x-2 mt-2">
                    <Select value={journeyType} onValueChange={(value) => setJourneyType(value as any)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select view" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pathTransitions">Path Transitions</SelectItem>
                        <SelectItem value="entryPages">Entry Pages</SelectItem>
                        <SelectItem value="exitPages">Exit Pages</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingJourney ? (
                    <div className="flex items-center justify-center h-[200px]">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : journeyError ? (
                    <div className="text-destructive">{(journeyError as Error).message}</div>
                  ) : (
                    <div className="space-y-2">
                      {journeyType === 'pathTransitions' ? (
                        pathTransitions.length > 0 ? (
                          <ChartErrorBoundary minHeight={300} resetKeys={[range, filterBots, journeyType, pathTransitions.length]}>
                          <ResponsiveContainer width="100%" height={Math.max(300, pathTransitions.length * 36)}>
                            <BarChart data={pathTransitions} layout="vertical" margin={{ left: 16, right: 16 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                              <XAxis type="number" allowDecimals={false} />
                              <YAxis
                                dataKey="label"
                                type="category"
                                width={220}
                                tick={{ fontSize: 12 }}
                              />
                              <Tooltip formatter={(value: any) => [`${value} transitions`, 'Count']} />
                              <Bar dataKey="value" name="Transitions" fill="#2563eb" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                          </ChartErrorBoundary>
                        ) : (
                          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                            No path transition data available for the selected time period.
                          </div>
                        )
                      ) : (
                        <div className="space-y-2">
                          {userJourneyData?.map((page, index) => (
                            <div key={index} className="flex items-center justify-between p-2 hover:bg-muted rounded-md">
                              <div className="flex-1 truncate">
                                <div className="font-medium">{page.title || 'Untitled Page'}</div>
                                <div className="text-sm text-muted-foreground truncate">{page.url}</div>
                              </div>
                              <div>{page.count}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Active Users</CardTitle>
                  <CardDescription>
                    {isLoadingActiveUsers ? 'Loading...' : `${activeUsersData?.count || 0} users active in the last 15 minutes`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingActiveUsers ? (
                    <div className="flex items-center justify-center h-[200px]">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : activeUsersError ? (
                    <div className="text-destructive">{(activeUsersError as Error).message}</div>
                  ) : (
                    <div className="space-y-2">
                      {activeUsersData?.users?.map((user) => (
                        <div key={user.sessionId} className="p-2 hover:bg-muted rounded-md">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">
                              {user.user ? user.user.username : 'Anonymous User'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {user.location.city}, {user.location.country}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <div className="text-muted-foreground">
                              {user.deviceType} / {user.browser}
                            </div>
                            <div className="text-muted-foreground">
                              Active for {formatTimeDifference(new Date(user.startTime), new Date(user.lastActiveTime))}
                            </div>
                          </div>
                          <div className="mt-1 text-sm">
                            <span className="font-medium">Current page:</span> {user.currentPage.title || user.currentPage.url}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>New vs Returning</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] flex items-center justify-center">
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-8">
                        <div>
                          <div className="text-3xl font-bold">{dashboardData.sessions.newVsReturning.new}</div>
                          <div className="text-muted-foreground">New Visitors</div>
                        </div>
                        <div>
                          <div className="text-3xl font-bold">{dashboardData.sessions.newVsReturning.returning}</div>
                          <div className="text-muted-foreground">Returning Visitors</div>
                        </div>
                      </div>

                      <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-muted">
                        <div 
                          className="bg-primary"
                          style={{ width: calculatePercentage(dashboardData.sessions.newVsReturning.new, dashboardData.sessions.total) }}
                        ></div>
                      </div>
                      <div className="mt-2 flex justify-between text-xs">
                        <span>New: {calculatePercentage(dashboardData.sessions.newVsReturning.new, dashboardData.sessions.total)}</span>
                        <span>Returning: {calculatePercentage(dashboardData.sessions.newVsReturning.returning, dashboardData.sessions.total)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Events Tab */}
            <TabsContent value="events" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Events by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dashboardData.events.byType.map((event) => (
                      <div key={event.type} className="flex items-center justify-between">
                        <span>{event.type}</span>
                        <div className="flex items-center">
                          <span className="mr-2">{event.count}</span>
                          <span className="text-muted-foreground">
                            ({calculatePercentage(event.count, dashboardData.events.total)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Geography Tab */}
            <TabsContent value="geo" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Visitors by Country</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dashboardData.sessions.byCountry.map((country) => (
                      <div key={country.country} className="flex items-center justify-between">
                        <span>{country.country || 'Unknown'}</span>
                        <div className="flex items-center">
                          <span className="mr-2">{country.count}</span>
                          <span className="text-muted-foreground">
                            ({calculatePercentage(country.count, dashboardData.sessions.total)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Visitor Map</CardTitle>
                </CardHeader>
                <CardContent>
                  {geoChartData.length > 0 ? (
                    <ChartErrorBoundary minHeight={400} resetKeys={[range, filterBots, geoChartData.length]}>
                    <ResponsiveContainer width="100%" height={Math.max(400, geoChartData.length * 32)}>
                      <BarChart data={geoChartData} layout="vertical" margin={{ left: 16, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis
                          dataKey="label"
                          type="category"
                          width={220}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip formatter={(value: any) => [`${value} visitors`, 'Count']} />
                        <Bar dataKey="count" name="Visitors" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    </ChartErrorBoundary>
                  ) : (
                    <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                      No location data available for the selected time period.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

// Helper function to format time difference
const formatTimeDifference = (start: Date, end: Date) => {
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);

  if (diffHrs > 0) {
    return `${diffHrs}h ${diffMins % 60}m`;
  }

  return `${diffMins}m`;
};

export default AnalyticsDashboard;