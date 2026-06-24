import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Mail, TrendingUp, MousePointer, AlertCircle, Users, Calendar, Search, RefreshCw, CreditCard } from "lucide-react";
import { format, subDays } from "date-fns";
import { EmailActivitySkeleton, EmailTableSkeleton } from "@/components/email-activity-skeleton";

interface AggregatedStats {
  delivered: number;
  opens: number;
  unique_opens: number;
  clicks: number;
  unique_clicks: number;
  bounces: number;
  spam_reports: number;
  unsubscribes: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
}

interface EmailMessage {
  msg_id: string;
  from_email: string;
  to_email: string;
  subject: string;
  status: string;
  opens_count: number;
  clicks_count: number;
  last_event_time: string;
  username?: string | null;
  fullName?: string | null;
}

interface DailyStat {
  date: string;
  stats: Array<{
    metrics: {
      delivered?: number;
      opens?: number;
      unique_opens?: number;
      clicks?: number;
      unique_clicks?: number;
      bounces?: number;
    };
  }>;
}

interface BillingStats {
  monthlyLimit: number;
  emailsSent: number;
  emailsRemaining: number;
  percentageUsed: number;
  currentMonth: string;
}

export default function EmailActivityPage() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchEmail, setSearchEmail] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: enhancedData, isLoading, error, refetch } = useQuery<{
    stats: AggregatedStats;
    messages: EmailMessage[];
    hasActivityApi: boolean;
    dailyStats: DailyStat[];
  }>({
    queryKey: ['/api/admin/email-activity/enhanced', startDate, endDate, searchEmail || undefined, statusFilter === 'all' ? undefined : statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate,
        endDate,
        limit: '100',
      });
      
      if (searchEmail) {
        params.append('email', searchEmail);
      }
      
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      const response = await fetch(`/api/admin/email-activity/enhanced?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch email activity: ${error}`);
      }
      
      return response.json();
    },
    enabled: !!startDate && !!endDate,
  });

  const { data: billingData, isLoading: billingLoading } = useQuery<BillingStats>({
    queryKey: ['/api/admin/email-activity/billing'],
    refetchInterval: 60000, // Refetch every minute
  });

  const handleSearch = () => {
    refetch();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      delivered: { variant: "default", label: "Delivered" },
      processed: { variant: "secondary", label: "Processed" },
      open: { variant: "outline", label: "Opened" },
      click: { variant: "outline", label: "Clicked" },
      bounce: { variant: "destructive", label: "Bounced" },
      dropped: { variant: "destructive", label: "Dropped" },
      deferred: { variant: "secondary", label: "Deferred" },
      blocked: { variant: "destructive", label: "Blocked" },
    };

    const config = statusConfig[status.toLowerCase()] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error Loading Email Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {error instanceof Error ? error.message : "Failed to load email activity data"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email Activity Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Track and monitor all emails sent through SendGrid
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Options</CardTitle>
          <CardDescription>Customize the date range and filters to view email activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-search">Search Email</Label>
              <Input
                id="email-search"
                type="email"
                placeholder="[email protected]"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                data-testid="input-email-search"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="bounce">Bounced</SelectItem>
                  <SelectItem value="dropped">Dropped</SelectItem>
                  <SelectItem value="deferred">Deferred</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSearch} disabled={isLoading} data-testid="button-search">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button onClick={() => refetch()} variant="outline" disabled={isLoading} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">Error loading email activity</p>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {(error as Error)?.message || 'Failed to load email activity data'}
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-20"></div>
                  <div className="h-8 bg-muted rounded w-16"></div>
                  <div className="h-3 bg-muted rounded w-24"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : enhancedData && enhancedData.stats ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Delivered</p>
                    <p className="text-2xl font-bold" data-testid="text-delivered-count">{(enhancedData.stats.delivered || 0).toLocaleString()}</p>
                  </div>
                  <Mail className="h-8 w-8 text-blue-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Successfully delivered emails</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Open Rate</p>
                    <p className="text-2xl font-bold" data-testid="text-open-rate">{(enhancedData.stats.open_rate || 0).toFixed(1)}%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {enhancedData.stats.unique_opens || 0} unique opens
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Click Rate</p>
                    <p className="text-2xl font-bold" data-testid="text-click-rate">{(enhancedData.stats.click_rate || 0).toFixed(1)}%</p>
                  </div>
                  <MousePointer className="h-8 w-8 text-purple-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {enhancedData.stats.unique_clicks || 0} unique clicks
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Bounce Rate</p>
                    <p className="text-2xl font-bold" data-testid="text-bounce-rate">{(enhancedData.stats.bounce_rate || 0).toFixed(1)}%</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {enhancedData.stats.bounces || 0} bounced emails
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="stats" className="space-y-4">
            <TabsList>
              <TabsTrigger value="stats" data-testid="tab-stats">
                <Calendar className="h-4 w-4 mr-2" />
                Daily Statistics
              </TabsTrigger>
              <TabsTrigger value="messages" data-testid="tab-messages">
                <Users className="h-4 w-4 mr-2" />
                Individual Messages
                {!enhancedData.hasActivityApi && (
                  <Badge variant="outline" className="ml-2">Limited</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="billing" data-testid="tab-billing">
                <CreditCard className="h-4 w-4 mr-2" />
                Billing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stats">
              <Card>
                <CardHeader>
                  <CardTitle>Daily Email Statistics</CardTitle>
                  <CardDescription>
                    Breakdown of email metrics by day
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {enhancedData.dailyStats.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Delivered</TableHead>
                          <TableHead className="text-right">Opens</TableHead>
                          <TableHead className="text-right">Unique Opens</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">Unique Clicks</TableHead>
                          <TableHead className="text-right">Bounces</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enhancedData.dailyStats.map((dayStat) => {
                          const metrics = dayStat.stats[0]?.metrics || {};
                          return (
                            <TableRow key={dayStat.date}>
                              <TableCell className="font-medium">
                                {format(new Date(dayStat.date), 'MMM dd, yyyy')}
                              </TableCell>
                              <TableCell className="text-right">{metrics.delivered || 0}</TableCell>
                              <TableCell className="text-right">{metrics.opens || 0}</TableCell>
                              <TableCell className="text-right">{metrics.unique_opens || 0}</TableCell>
                              <TableCell className="text-right">{metrics.clicks || 0}</TableCell>
                              <TableCell className="text-right">{metrics.unique_clicks || 0}</TableCell>
                              <TableCell className="text-right">{metrics.bounces || 0}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="py-4">
                      <EmailTableSkeleton />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="messages">
              <Card>
                <CardHeader>
                  <CardTitle>Individual Email Messages</CardTitle>
                  <CardDescription>
                    {enhancedData.hasActivityApi 
                      ? "Detailed view of individual emails sent"
                      : "Email Activity API not enabled - Showing limited data. Enable 'Email Activity Feed' add-on in SendGrid for detailed message tracking."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {enhancedData.messages.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Full Name</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Opens</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead>Last Event</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enhancedData.messages.map((message) => (
                          <TableRow key={message.msg_id} data-testid={`row-message-${message.msg_id}`}>
                            <TableCell className="font-medium" data-testid={`text-recipient-${message.msg_id}`}>
                              {message.to_email}
                            </TableCell>
                            <TableCell data-testid={`text-username-${message.msg_id}`}>
                              {message.username || '-'}
                            </TableCell>
                            <TableCell data-testid={`text-fullname-${message.msg_id}`}>
                              {message.fullName || '-'}
                            </TableCell>
                            <TableCell className="max-w-xs truncate" data-testid={`text-subject-${message.msg_id}`}>
                              {message.subject}
                            </TableCell>
                            <TableCell>{getStatusBadge(message.status)}</TableCell>
                            <TableCell className="text-right">{message.opens_count || 0}</TableCell>
                            <TableCell className="text-right">{message.clicks_count || 0}</TableCell>
                            <TableCell>
                              {format(new Date(message.last_event_time), 'MMM dd, yyyy HH:mm')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="py-4">
                      <EmailTableSkeleton />
                      {!enhancedData.hasActivityApi && (
                        <p className="text-sm text-center text-muted-foreground mt-4">
                          To track individual messages, enable the "Email Activity Feed" add-on in your SendGrid account.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing">
              <Card>
                <CardHeader>
                  <CardTitle>SendGrid Plan Usage</CardTitle>
                  <CardDescription>
                    Track your monthly email quota and usage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {billingLoading ? (
                    <div className="space-y-4">
                      <div className="animate-pulse">
                        <div className="h-4 bg-muted rounded w-32 mb-2"></div>
                        <div className="h-8 bg-muted rounded w-full mb-4"></div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="h-20 bg-muted rounded"></div>
                          <div className="h-20 bg-muted rounded"></div>
                          <div className="h-20 bg-muted rounded"></div>
                        </div>
                      </div>
                    </div>
                  ) : billingData ? (
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm font-medium">
                            Usage for {billingData.currentMonth}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {billingData.percentageUsed.toFixed(1)}% used
                          </p>
                        </div>
                        <Progress 
                          value={billingData.percentageUsed} 
                          className="h-3"
                          data-testid="progress-usage"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          {billingData.emailsSent.toLocaleString()} of {billingData.monthlyLimit.toLocaleString()} emails sent
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground mb-1">Monthly Limit</p>
                              <p className="text-3xl font-bold" data-testid="text-monthly-limit">
                                {billingData.monthlyLimit.toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">emails/month</p>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground mb-1">Emails Sent</p>
                              <p className="text-3xl font-bold text-blue-600" data-testid="text-emails-sent">
                                {billingData.emailsSent.toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">this month</p>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground mb-1">Remaining</p>
                              <p className={`text-3xl font-bold ${
                                billingData.emailsRemaining < billingData.monthlyLimit * 0.1 
                                  ? 'text-red-600' 
                                  : billingData.emailsRemaining < billingData.monthlyLimit * 0.2
                                  ? 'text-orange-600'
                                  : 'text-green-600'
                              }`} data-testid="text-emails-remaining">
                                {billingData.emailsRemaining.toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">emails left</p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {billingData.percentageUsed >= 80 && (
                        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                            <div>
                              <h4 className="font-semibold text-amber-900 dark:text-amber-100">
                                {billingData.percentageUsed >= 95 ? 'Critical: ' : 'Warning: '}
                                Approaching Monthly Limit
                              </h4>
                              <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                                You've used {billingData.percentageUsed.toFixed(1)}% of your monthly email quota. 
                                {billingData.percentageUsed >= 95 
                                  ? ' Consider upgrading your plan to avoid service interruption.'
                                  : ' Monitor your usage to avoid hitting your limit.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="bg-muted rounded-lg p-4">
                        <h4 className="font-semibold mb-2">Note about Plan Limits</h4>
                        <p className="text-sm text-muted-foreground">
                          The monthly limit is configured via the <code className="bg-background px-1 py-0.5 rounded">SENDGRID_MONTHLY_LIMIT</code> environment variable. 
                          Update this value to match your SendGrid plan. The usage data is fetched directly from SendGrid's API.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-muted-foreground">
                      Unable to load billing data
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle>Additional Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Opens</p>
                  <p className="text-xl font-semibold">{(enhancedData.stats.opens || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Clicks</p>
                  <p className="text-xl font-semibold">{(enhancedData.stats.clicks || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Spam Reports</p>
                  <p className="text-xl font-semibold">{(enhancedData.stats.spam_reports || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unsubscribes</p>
                  <p className="text-xl font-semibold">{(enhancedData.stats.unsubscribes || 0).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <EmailActivitySkeleton />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
