import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Mail, TrendingUp, MousePointer, AlertCircle, Users, Calendar, Search, RefreshCw, CreditCard, Pencil, Plus, Trash2, RotateCcw } from "lucide-react";
import { format, subDays } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmailActivitySkeleton, EmailTableSkeleton } from "@/components/email-activity-skeleton";
import ForSaleEmailsTab from "./forsale-emails-tab";
import WeeklyListingsTab from "./weekly-listings-tab";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";

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

interface BillingAddOn {
  name: string;
  price: number;
}

interface BillingStats {
  monthlyLimit: number;
  emailsSent: number;
  emailsRemaining: number;
  percentageUsed: number;
  currentMonth: string;
  planName: string;
  planPrice: number;
  currency: string;
  addOns: BillingAddOn[];
  estimatedInvoice: number;
}

function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
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

  const { toast } = useToast();
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [planForm, setPlanForm] = useState<{
    planName: string;
    planPrice: string;
    currency: string;
    monthlyLimit: string;
    addOns: BillingAddOn[];
  }>({ planName: '', planPrice: '', currency: 'USD', monthlyLimit: '', addOns: [] });

  // Snapshot of the form values taken when editing starts. Comparing the live
  // form against this lets us tell whether the admin has actually changed
  // anything, so we only nag about discarding when there's real work to lose.
  const [planFormBaseline, setPlanFormBaseline] = useState<string>('');
  // Queues the Cancel/close action behind a confirmation when the form is
  // dirty. `null` means nothing is queued (dialog closed).
  const [pendingPlanCancel, setPendingPlanCancel] = useState(false);

  const startEditingPlan = () => {
    if (!billingData) return;
    const initial = {
      planName: billingData.planName,
      planPrice: String(billingData.planPrice),
      currency: billingData.currency,
      monthlyLimit: String(billingData.monthlyLimit),
      addOns: billingData.addOns.map((a) => ({ ...a })),
    };
    setPlanForm(initial);
    setPlanFormBaseline(JSON.stringify(initial));
    setIsEditingPlan(true);
  };

  // Dirty only while editing and the form differs from the baseline snapshot.
  const hasUnsavedPlanChanges =
    isEditingPlan && JSON.stringify(planForm) !== planFormBaseline;

  // Warn before navigating away (router transition, back button, browser
  // unload) while the plan form has edits that haven't been saved or
  // discarded.
  const unsavedChangesDialog = useUnsavedChangesPrompt(hasUnsavedPlanChanges, {
    title: "Unsaved plan changes",
    description:
      "You have unsaved changes to the billing plan. If you leave now, your edits will be lost.",
    confirmLabel: "Discard & Leave",
    cancelLabel: "Stay on Page",
  });

  // Handler for the Cancel button. If there are unsaved edits, queue the close
  // behind a confirmation instead of silently dropping the admin's work.
  const handleCancelEditingPlan = () => {
    if (hasUnsavedPlanChanges) {
      setPendingPlanCancel(true);
      return;
    }
    setIsEditingPlan(false);
  };

  // Confirm the queued discard: leave edit mode and clear the queued cancel.
  const confirmDiscardPlanChanges = () => {
    setIsEditingPlan(false);
    setPendingPlanCancel(false);
  };

  const savePlanMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        planName: planForm.planName.trim(),
        planPrice: planForm.planPrice === '' ? undefined : Number(planForm.planPrice),
        currency: planForm.currency.trim(),
        monthlyLimit: planForm.monthlyLimit === '' ? undefined : Number(planForm.monthlyLimit),
        addOns: planForm.addOns.map((a) => ({ name: a.name.trim(), price: Number(a.price) || 0 })),
      };
      const res = await apiRequest('PUT', '/api/admin/email-activity/billing/config', payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save plan details');
      }
      return res.json() as Promise<BillingStats>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['/api/admin/email-activity/billing'], updated);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-activity/billing'] });
      setIsEditingPlan(false);
      toast({ title: 'Plan details saved', description: 'Billing panel updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
    },
  });

  const resetPlanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', '/api/admin/email-activity/billing/config');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to reset plan details');
      }
      return res.json() as Promise<BillingStats>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['/api/admin/email-activity/billing'], updated);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-activity/billing'] });
      setIsEditingPlan(false);
      toast({ title: 'Reset to defaults', description: 'Billing panel reverted to environment defaults.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Could not reset', description: error.message, variant: 'destructive' });
    },
  });

  const handleAddOnChange = (index: number, field: 'name' | 'price', value: string) => {
    setPlanForm((prev) => {
      const addOns = [...prev.addOns];
      addOns[index] = {
        ...addOns[index],
        [field]: field === 'price' ? (value === '' ? 0 : Number(value)) : value,
      };
      return { ...prev, addOns };
    });
  };

  const addAddOnRow = () => {
    setPlanForm((prev) => ({ ...prev, addOns: [...prev.addOns, { name: '', price: 0 }] }));
  };

  const removeAddOnRow = (index: number) => {
    setPlanForm((prev) => ({ ...prev, addOns: prev.addOns.filter((_, i) => i !== index) }));
  };

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
      {unsavedChangesDialog}
      <AlertDialog
        open={pendingPlanCancel}
        onOpenChange={(open) => {
          // Treat any close (Escape, overlay click, Keep Editing) of the
          // discard prompt as "stay" so edit mode and edits stick around.
          if (!open) setPendingPlanCancel(false);
        }}
      >
        <AlertDialogContent data-testid="dialog-plan-unsaved-changes">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved plan changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to the billing plan. If you cancel now,
              your edits will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-plan-unsaved-changes-cancel">
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDiscardPlanChanges}
              data-testid="button-plan-unsaved-changes-confirm"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
              <TabsTrigger value="forsale-emails" data-testid="tab-forsale-emails">
                <Mail className="h-4 w-4 mr-2" />
                On The Market Emails
              </TabsTrigger>
              <TabsTrigger value="weekly-listings" data-testid="tab-weekly-listings">
                <Mail className="h-4 w-4 mr-2" />
                Weekly Promo
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
                      {isEditingPlan ? (
                        <Card className="border-blue-200 dark:border-blue-900">
                          <CardHeader>
                            <CardTitle className="text-base">Edit Plan &amp; Add-ons</CardTitle>
                            <CardDescription>
                              These values override the SENDGRID_* environment defaults. Usage data still comes live from SendGrid.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label htmlFor="plan-name">Plan name</Label>
                                <Input
                                  id="plan-name"
                                  value={planForm.planName}
                                  onChange={(e) => setPlanForm((p) => ({ ...p, planName: e.target.value }))}
                                  placeholder="Essentials 50K"
                                  data-testid="input-plan-name"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="monthly-limit">Monthly limit (emails)</Label>
                                <Input
                                  id="monthly-limit"
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={planForm.monthlyLimit}
                                  onChange={(e) => setPlanForm((p) => ({ ...p, monthlyLimit: e.target.value }))}
                                  placeholder="50000"
                                  data-testid="input-monthly-limit"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="plan-price">Plan price (per month)</Label>
                                <Input
                                  id="plan-price"
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={planForm.planPrice}
                                  onChange={(e) => setPlanForm((p) => ({ ...p, planPrice: e.target.value }))}
                                  placeholder="19.95"
                                  data-testid="input-plan-price"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="currency">Currency</Label>
                                <Input
                                  id="currency"
                                  value={planForm.currency}
                                  onChange={(e) => setPlanForm((p) => ({ ...p, currency: e.target.value }))}
                                  placeholder="USD"
                                  maxLength={3}
                                  data-testid="input-currency"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label>Add-ons</Label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={addAddOnRow}
                                  data-testid="button-add-addon"
                                >
                                  <Plus className="h-4 w-4 mr-1" /> Add
                                </Button>
                              </div>
                              {planForm.addOns.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No add-ons. Use "Add" to create one.</p>
                              ) : (
                                <div className="space-y-2">
                                  {planForm.addOns.map((addOn, index) => (
                                    <div key={index} className="flex items-center gap-2" data-testid={`row-edit-addon-${index}`}>
                                      <Input
                                        value={addOn.name}
                                        onChange={(e) => handleAddOnChange(index, 'name', e.target.value)}
                                        placeholder="Add-on name"
                                        className="flex-1"
                                        data-testid={`input-addon-name-${index}`}
                                      />
                                      <Input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={String(addOn.price)}
                                        onChange={(e) => handleAddOnChange(index, 'price', e.target.value)}
                                        placeholder="0.00"
                                        className="w-28"
                                        data-testid={`input-addon-price-${index}`}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeAddOnRow(index)}
                                        data-testid={`button-remove-addon-${index}`}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => resetPlanMutation.mutate()}
                                disabled={savePlanMutation.isPending || resetPlanMutation.isPending}
                                className="text-destructive hover:text-destructive"
                                data-testid="button-reset-plan"
                              >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                {resetPlanMutation.isPending ? 'Resetting...' : 'Reset to defaults'}
                              </Button>
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleCancelEditingPlan}
                                  disabled={savePlanMutation.isPending || resetPlanMutation.isPending}
                                  data-testid="button-cancel-plan"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  onClick={() => savePlanMutation.mutate()}
                                  disabled={savePlanMutation.isPending || resetPlanMutation.isPending || !planForm.planName.trim()}
                                  data-testid="button-save-plan"
                                >
                                  {savePlanMutation.isPending ? 'Saving...' : 'Save changes'}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card className="border-blue-200 dark:border-blue-900">
                          <CardContent className="pt-6">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Email API Plan</p>
                                <p className="text-xl font-bold" data-testid="text-plan-name">
                                  {billingData.planName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {billingData.monthlyLimit.toLocaleString()} emails/month
                                </p>
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="text-right">
                                  <p className="text-2xl font-bold" data-testid="text-plan-price">
                                    {formatCurrency(billingData.planPrice, billingData.currency)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">per month</p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={startEditingPlan}
                                  data-testid="button-edit-plan"
                                >
                                  <Pencil className="h-4 w-4 mr-1" /> Edit
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

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

                      <Card>
                        <CardContent className="pt-6 space-y-4">
                          <div>
                            <h4 className="font-semibold mb-2">Add-ons</h4>
                            {billingData.addOns.length > 0 ? (
                              <div className="space-y-2">
                                {billingData.addOns.map((addOn) => (
                                  <div
                                    key={addOn.name}
                                    className="flex items-center justify-between text-sm"
                                    data-testid={`row-addon-${addOn.name}`}
                                  >
                                    <span className="text-muted-foreground">{addOn.name}</span>
                                    <span className="font-medium">
                                      {formatCurrency(addOn.price, billingData.currency)}/mo
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No add-ons</p>
                            )}
                          </div>
                          <div className="border-t pt-4 flex items-center justify-between">
                            <div>
                              <p className="font-semibold">Estimate for Next Invoice</p>
                              <p className="text-xs text-muted-foreground">
                                Plan price plus add-ons. Overages may apply.
                              </p>
                            </div>
                            <p className="text-2xl font-bold" data-testid="text-estimated-invoice">
                              {formatCurrency(billingData.estimatedInvoice, billingData.currency)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

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
                        <h4 className="font-semibold mb-2">Note about Plan &amp; Billing</h4>
                        <p className="text-sm text-muted-foreground">
                          Usage data is fetched live from SendGrid's API. The plan name, monthly limit, plan price, and add-ons are editable here (use <span className="font-medium">Edit</span> above). Saved values are stored for the site and override the environment defaults (<code className="bg-background px-1 py-0.5 rounded">SENDGRID_PLAN_NAME</code>, <code className="bg-background px-1 py-0.5 rounded">SENDGRID_MONTHLY_LIMIT</code>, <code className="bg-background px-1 py-0.5 rounded">SENDGRID_PLAN_PRICE</code>, <code className="bg-background px-1 py-0.5 rounded">SENDGRID_ADDONS</code>). The next-invoice estimate is the plan price plus add-ons.
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

            <TabsContent value="weekly-listings">
              <WeeklyListingsTab />
            </TabsContent>

            <TabsContent value="forsale-emails">
              <ForSaleEmailsTab />
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
