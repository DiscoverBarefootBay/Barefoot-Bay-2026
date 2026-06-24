import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Calendar,
  Trash2,
  RefreshCw,
  AlertCircle,
  Calendar as CalendarIcon,
  ArrowLeft,
  CheckCircle2,
  Mail,
  Send,
  Repeat,
  Link2,
  Download,
  Clock,
  Eye,
  GripVertical,
  X,
  Save,
  ToggleLeft,
  ToggleRight,
  Image as ImageIcon,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import AdminLayout from "@/components/layouts/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BulkEventUpload } from "@/components/calendar/bulk-event-upload";
import CalendarMediaMigration from "@/components/admin/calendar-media-migration";
import { Link, useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Event = {
  id: number;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  category: string;
  location: string | null;
  createdAt: string;
  createdBy: number | null;
  isRecurring: boolean;
  parentEventId: number | null;
};

type ScheduleConfig = {
  enabled: boolean;
  sendTime: string;
  notifyPreference: "none" | "justme" | "admins" | "everyone";
  adminUserId: number | null;
  customEventOrder: number[] | null;
  attachImageEventIds: number[] | null;
  lastSentAt: string | null;
};

type RecipientUser = { username: string; email: string };

function getNextRunDisplay(sendTime: string): string {
  const parts = sendTime.split(':');
  const hours = parseInt(parts[0] ?? '8', 10);
  const minutes = parseInt(parts[1] ?? '0', 10);

  const now = new Date();
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const etHour = parseInt(etParts.find(p => p.type === 'hour')?.value ?? '0', 10);
  const etMin = parseInt(etParts.find(p => p.type === 'minute')?.value ?? '0', 10);

  const currentMins = etHour * 60 + etMin;
  const targetMins = hours * 60 + minutes;

  const sendHour12 = hours % 12 || 12;
  const ampm = hours < 12 ? 'AM' : 'PM';
  const formattedTime = `${sendHour12}:${String(minutes).padStart(2, '0')} ${ampm}`;

  if (currentMins < targetMins) {
    return `Today at ${formattedTime} ET`;
  }
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  }).format(tomorrowDate);
  return `Tomorrow, ${tomorrowStr} at ${formattedTime} ET`;
}

type PreviewEvent = {
  id: number;
  title: string;
  category: string;
  startDate: string;
  mediaUrls: string[] | null;
};

export default function CalendarManagement() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [selectedEvents, setSelectedEvents] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [notifyPreference, setNotifyPreference] = useState<"none" | "justme" | "admins" | "everyone">("none");
  const [notifiedUsers, setNotifiedUsers] = useState<Array<{username: string, email: string, additionalUsernames?: string[]}>>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Auto-schedule panel state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleSendTime, setScheduleSendTime] = useState("08:00");
  const [scheduleNotifyPref, setScheduleNotifyPref] = useState<"none" | "justme" | "admins" | "everyone">("everyone");
  const [scheduleLastSent, setScheduleLastSent] = useState<string | null>(null);
  const [scheduleDirty, setScheduleDirty] = useState(false);

  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [previewEvents, setPreviewEvents] = useState<PreviewEvent[]>([]);
  const [orderedEventIds, setOrderedEventIds] = useState<number[]>([]);
  const [attachImageIds, setAttachImageIds] = useState<number[]>([]);
  const [previewOrderDirty, setPreviewOrderDirty] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const autoRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize search term from URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchFromUrl = urlParams.get('search');
    if (searchFromUrl) {
      setSearchTerm(searchFromUrl);
    }
  }, []);

  // Update URL when search term changes
  const updateSearchTerm = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
    
    // Update URL with search parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (newSearchTerm.trim()) {
      urlParams.set('search', newSearchTerm.trim());
    } else {
      urlParams.delete('search');
    }
    
    const newUrl = '/admin/calendar-management' + (urlParams.toString() ? '?' + urlParams.toString() : '');
    // Use replace instead of push to avoid adding to browser history
    window.history.replaceState({}, '', newUrl);
  };

  // Fetch events
  const eventsQuery = useQuery({
    queryKey: ["/api/events"],
    select: (data: Event[]) => {
      // Sort by startDate descending (newest first)
      return [...data].sort((a, b) => 
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
    }
  });

  // Delete individual event
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete event");
      }
      
      return eventId;
    },
    onSuccess: (eventId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setSelectedEvents(prev => prev.filter(id => id !== eventId));
      toast({
        title: "Event Deleted",
        description: "The event has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete event",
        variant: "destructive",
      });
    }
  });

  // Delete multiple events
  const deleteMultipleEventsMutation = useMutation({
    mutationFn: async (eventIds: number[]) => {
      const promises = eventIds.map(id => 
        fetch(`/api/events/${id}`, {
          method: "DELETE",
          credentials: "include",
        })
      );
      const results = await Promise.all(promises);
      
      const failedDeletions = results.filter(r => !r.ok).length;
      if (failedDeletions > 0) {
        throw new Error(`Failed to delete ${failedDeletions} events`);
      }
      
      return eventIds;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setSelectedEvents([]);
      toast({
        title: "Events Deleted",
        description: "Selected events have been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete events",
        variant: "destructive",
      });
    }
  });

  // Delete all events
  const deleteAllEventsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/events", {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete all events");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setSelectedEvents([]);
      toast({
        title: "All Events Deleted",
        description: "All events have been successfully deleted from the calendar.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete all events",
        variant: "destructive",
      });
    }
  });

  // Send daily calendar notifications
  const sendDailyNotificationsMutation = useMutation({
    mutationFn: async (notify: string) => {
      const response = await fetch("/api/admin/send-calendar-events/day", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notifyPreference: notify }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to send daily notifications");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.warning) {
        toast({
          title: "Warning",
          description: data.message,
          variant: "destructive",
        });
        setNotifiedUsers([]);
      } else {
        toast({
          title: "Daily Notifications Sent",
          description: `Sent notifications about ${data.eventCount} events to ${data.sentCount} of ${data.totalCount} users.`,
        });
        // Set notified users for the alert display
        if (data.notifiedUsers && data.notifiedUsers.length > 0) {
          setNotifiedUsers(data.notifiedUsers);
        }
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send daily notifications",
        variant: "destructive",
      });
    }
  });

  // Send today's calendar notifications
  const sendTodayNotificationsMutation = useMutation({
    mutationFn: async (notify: string) => {
      const response = await fetch("/api/admin/send-calendar-events/today", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notifyPreference: notify }),
      });
      if (!response.ok) {
        throw new Error("Failed to send today's notifications");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.warning) {
        toast({
          title: "Warning",
          description: data.message,
          variant: "destructive",
        });
        setNotifiedUsers([]);
      } else {
        toast({
          title: "Today's Notifications Sent",
          description: `Sent notifications about ${data.eventCount} events to ${data.sentCount} of ${data.totalCount} users.`,
        });
        if (data.notifiedUsers && data.notifiedUsers.length > 0) {
          setNotifiedUsers(data.notifiedUsers);
        }
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send today's notifications",
        variant: "destructive",
      });
    }
  });

  // Fetch auto-schedule config
  const scheduleQuery = useQuery<ScheduleConfig>({
    queryKey: ["/api/admin/calendar-email-schedule"],
    refetchOnWindowFocus: false,
  });

  // Live recipient preview — manual send
  const manualRecipientsQuery = useQuery<{ users: RecipientUser[]; count: number }>({
    queryKey: ["/api/admin/calendar-email-recipients", "manual", notifyPreference],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/calendar-email-recipients?notifyPreference=${notifyPreference}&context=manual`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch recipients");
      return res.json();
    },
    enabled: notifyPreference !== "none",
    staleTime: 30_000,
  });

  // Live recipient preview — auto-schedule send
  const scheduleRecipientsQuery = useQuery<{ users: RecipientUser[]; count: number }>({
    queryKey: ["/api/admin/calendar-email-recipients", "schedule", scheduleNotifyPref],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/calendar-email-recipients?notifyPreference=${scheduleNotifyPref}&context=schedule`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch recipients");
      return res.json();
    },
    enabled: scheduleNotifyPref !== "none",
    staleTime: 30_000,
  });

  // Populate local state when schedule config loads
  useEffect(() => {
    if (scheduleQuery.data) {
      setScheduleEnabled(scheduleQuery.data.enabled);
      setScheduleSendTime(scheduleQuery.data.sendTime);
      setScheduleNotifyPref(scheduleQuery.data.notifyPreference);
      setScheduleLastSent(scheduleQuery.data.lastSentAt);
      setScheduleDirty(false);
    }
  }, [scheduleQuery.data]);

  // Save schedule config — accepts an optional override for enabled (used by the toggle auto-save)
  const saveScheduleMutation = useMutation({
    mutationFn: async (overrides?: { enabled?: boolean }) => {
      const response = await fetch("/api/admin/calendar-email-schedule", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: overrides?.enabled !== undefined ? overrides.enabled : scheduleEnabled,
          sendTime: scheduleSendTime,
          notifyPreference: scheduleNotifyPref,
        }),
      });
      if (!response.ok) throw new Error("Failed to save schedule");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/admin/calendar-email-schedule"], data);
      // Also invalidate schedule recipients so "justme" resolves correctly
      queryClient.invalidateQueries({ queryKey: ["/api/admin/calendar-email-recipients", "schedule"] });
      setScheduleDirty(false);
      toast({ title: "Auto-Schedule Saved", description: "Your email schedule settings have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save schedule settings.", variant: "destructive" });
    },
  });

  // "Send Now with These Settings" — fires a manual send using current preview order/images
  const sendNowMutation = useMutation({
    mutationFn: async ({ customEventOrder, attachImageEventIds }: { customEventOrder: number[]; attachImageEventIds: number[] }) => {
      // Save the current selections first, fail fast if that save fails
      const saveResp = await fetch("/api/admin/calendar-email-schedule", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customEventOrder, attachImageEventIds }),
      });
      if (!saveResp.ok) throw new Error("Failed to save custom order before sending");
      // Only proceed to send if the save succeeded
      const response = await fetch("/api/admin/send-calendar-events/day", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyPreference: scheduleNotifyPref }),
      });
      if (!response.ok) throw new Error("Failed to send");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/calendar-email-schedule"] });
      setPreviewOrderDirty(false);
      if (data.warning) {
        toast({ title: "Notice", description: data.message, variant: "destructive" });
      } else {
        toast({ title: "Email Sent", description: `Sent to ${data.sentCount} of ${data.totalCount} recipients.` });
        setPreviewOpen(false);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send email.", variant: "destructive" });
    },
  });

  // Save custom event order to schedule
  const saveOrderMutation = useMutation({
    mutationFn: async ({ customEventOrder, attachImageEventIds }: { customEventOrder: number[]; attachImageEventIds: number[] }) => {
      const response = await fetch("/api/admin/calendar-email-schedule", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customEventOrder, attachImageEventIds }),
      });
      if (!response.ok) throw new Error("Failed to save order");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/calendar-email-schedule"] });
      setPreviewOrderDirty(false);
      toast({ title: "Order Saved", description: "Custom event order saved for the next scheduled send." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save event order.", variant: "destructive" });
    },
  });

  // Open preview modal and fetch preview HTML
  const openPreview = useCallback(async (eventOrder?: number[], attachImages?: number[]) => {
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const params = new URLSearchParams();
      if (eventOrder && eventOrder.length > 0) params.set("eventOrder", JSON.stringify(eventOrder));
      if (attachImages && attachImages.length > 0) params.set("attachImages", JSON.stringify(attachImages));
      const qs = params.toString() ? `?${params.toString()}` : "";
      const resp = await fetch(`/api/admin/calendar-email-preview${qs}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Preview failed");
      const data = await resp.json();
      setPreviewHtml(data.html);
      setPreviewSubject(data.subject);
      setPreviewEvents(data.events ?? []);
      if (!eventOrder || eventOrder.length === 0) {
        if (data.events?.length > 0) {
          setOrderedEventIds(data.events.map((e: PreviewEvent) => e.id));
        }
      }
    } catch {
      toast({ title: "Error", description: "Failed to load email preview.", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  }, [toast]);

  // Refresh preview HTML with current ordering + images
  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const params = new URLSearchParams();
      if (orderedEventIds.length > 0) params.set("eventOrder", JSON.stringify(orderedEventIds));
      if (attachImageIds.length > 0) params.set("attachImages", JSON.stringify(attachImageIds));
      const qs = params.toString() ? `?${params.toString()}` : "";
      const resp = await fetch(`/api/admin/calendar-email-preview${qs}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Preview failed");
      const data = await resp.json();
      setPreviewHtml(data.html);
      setPreviewSubject(data.subject);
    } catch {
      toast({ title: "Error", description: "Failed to refresh preview.", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  }, [orderedEventIds, attachImageIds, toast]);

  // Trigger a debounced preview refresh (800ms after last change)
  const scheduleAutoRefresh = useCallback((newOrder: number[], newAttachIds: number[]) => {
    if (autoRefreshTimer.current) clearTimeout(autoRefreshTimer.current);
    autoRefreshTimer.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const params = new URLSearchParams();
        if (newOrder.length > 0) params.set("eventOrder", JSON.stringify(newOrder));
        if (newAttachIds.length > 0) params.set("attachImages", JSON.stringify(newAttachIds));
        const qs = params.toString() ? `?${params.toString()}` : "";
        const resp = await fetch(`/api/admin/calendar-email-preview${qs}`, { credentials: "include" });
        if (!resp.ok) throw new Error("Preview failed");
        const data = await resp.json();
        setPreviewHtml(data.html);
        setPreviewSubject(data.subject);
      } catch {
        // Silent fail on debounced refresh; user can manually refresh
      } finally {
        setPreviewLoading(false);
      }
    }, 800);
  }, []);

  // Drag handlers for event reorder list
  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };
  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;
    const newOrder = [...orderedEventIds];
    const [moved] = newOrder.splice(dragItem.current, 1);
    newOrder.splice(dragOverItem.current, 0, moved);
    dragItem.current = null;
    dragOverItem.current = null;
    setOrderedEventIds(newOrder);
    setPreviewOrderDirty(true);
    scheduleAutoRefresh(newOrder, attachImageIds);
  };

  // Toggle image attachment
  const toggleAttachImage = (eventId: number) => {
    setAttachImageIds(prev => {
      const next = prev.includes(eventId) ? prev.filter(id => id !== eventId) : [...prev, eventId];
      setPreviewOrderDirty(true);
      scheduleAutoRefresh(orderedEventIds, next);
      return next;
    });
  };

  // Handle export to Excel
  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/events/export/excel', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to export events');
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `barefoot-bay-events-${new Date().toISOString().split('T')[0]}.xlsx`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: "Events have been exported to Excel successfully.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export events",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle row selection
  const handleRowSelection = (eventId: number) => {
    setSelectedEvents(prev => {
      if (prev.includes(eventId)) {
        return prev.filter(id => id !== eventId);
      } else {
        return [...prev, eventId];
      }
    });
  };

  // Select all events
  const selectAllEvents = () => {
    if (eventsQuery.data) {
      if (selectedEvents.length === eventsQuery.data.length) {
        setSelectedEvents([]);  // Deselect all if all are selected
      } else {
        setSelectedEvents(eventsQuery.data.map(event => event.id));
      }
    }
  };

  // Format date helper
  const formatEventDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy - h:mm a");
    } catch (e) {
      return dateString;
    }
  };

  // Define table columns with responsive design
  const columns = [
    {
      header: "ID",
      accessorKey: "id",
      cell: ({ row }: any) => (
        <Link href={`/events/${row.original.id}`}>
          <span className="text-xs font-mono text-primary hover:underline cursor-pointer">
            #{row.original.id}
          </span>
        </Link>
      ),
      meta: {
        className: "w-16 min-w-16",
      },
    },
    {
      header: "Type",
      accessorKey: "type",
      cell: ({ row }: any) => {
        const event = row.original;
        
        // Check if this is a recurring parent event
        if (event.isRecurring && !event.parentEventId) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="default" className="gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap">
                    <Repeat className="h-3 w-3 flex-shrink-0" />
                    <span>Parent</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Recurring Event (Parent) - Editing this updates all events in the series</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        
        // Check if this is a child event (part of a series)
        if (event.parentEventId) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={`/events/${event.parentEventId}`}>
                    <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-secondary/80 whitespace-nowrap">
                      <Link2 className="h-3 w-3 flex-shrink-0" />
                      <span>#{event.parentEventId}</span>
                    </Badge>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Part of recurring series - Click to view parent event #{event.parentEventId}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        
        // Single event
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs whitespace-nowrap">
                  Single
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Standalone event (not part of a series)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
      meta: {
        className: "w-24 min-w-24",
      },
    },
    {
      header: "Title",
      accessorKey: "title",
      cell: ({ row }: any) => (
        <div className="font-medium min-w-0" title={row.original.title}>
          <span className="block truncate max-w-[160px] sm:max-w-[200px] md:max-w-[250px]">
            {row.original.title}
          </span>
        </div>
      ),
      meta: {
        className: "min-w-[160px]",
      },
    },
    {
      header: "Category",
      accessorKey: "category",
      cell: ({ row }: any) => (
        <Badge variant="outline" className="capitalize text-xs">
          {row.original.category}
        </Badge>
      ),
      meta: {
        className: "w-24 min-w-24 hidden sm:table-cell",
      },
    },
    {
      header: "Start Date",
      accessorKey: "startDate",
      cell: ({ row }: any) => (
        <span className="text-xs">
          <span className="hidden lg:inline">{formatEventDate(row.original.startDate)}</span>
          <span className="lg:hidden">{format(new Date(row.original.startDate), "MM/dd/yy")}</span>
        </span>
      ),
      meta: {
        className: "w-32 min-w-32",
      },
    },
    {
      header: "End Date",
      accessorKey: "endDate",
      cell: ({ row }: any) => (
        <span className="text-xs hidden md:inline">
          <span className="hidden lg:inline">{formatEventDate(row.original.endDate)}</span>
          <span className="lg:hidden">{format(new Date(row.original.endDate), "MM/dd/yy")}</span>
        </span>
      ),
      meta: {
        className: "w-32 min-w-32 hidden md:table-cell",
      },
    },
    {
      header: "Location",
      accessorKey: "location",
      cell: ({ row }: any) => (
        <span className="text-xs hidden lg:table-cell" title={row.original.location}>
          <span className="block truncate max-w-[120px]">
            {row.original.location || "N/A"}
          </span>
        </span>
      ),
      meta: {
        className: "w-32 min-w-32 hidden lg:table-cell",
      },
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }: any) => (
        <div className="flex items-center gap-1">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-6 w-6 sm:h-7 sm:w-7"
            onClick={() => handleRowSelection(row.original.id)}
          >
            {selectedEvents.includes(row.original.id) ? (
              <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
            ) : (
              <div className="h-3 w-3 sm:h-4 sm:w-4 border border-muted-foreground rounded-sm" />
            )}
          </Button>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="h-6 w-6 sm:h-7 sm:w-7"
                  onClick={() => deleteEventMutation.mutate(row.original.id)}
                  disabled={deleteEventMutation.isPending}
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete Event</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
      meta: {
        className: "w-20 min-w-20",
      },
    },
  ];

  return (
    <AdminLayout>
      <div className="w-full max-w-none px-2 py-3 sm:px-6 sm:py-6 overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-primary flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold leading-tight break-words">
                  Calendar Management
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base mt-1">
                  Manage all events in the community calendar.
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <Link href="/admin" className="w-full sm:w-auto">
              <Button variant="outline" className="gap-2 w-full sm:w-auto min-w-0 justify-start sm:justify-center">
                <ArrowLeft className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Back to Dashboard</span>
              </Button>
            </Link>
            <div className="w-full sm:w-auto">
              <BulkEventUpload />
            </div>
          </div>
        </div>
        
        <div className="w-full space-y-4 sm:space-y-6">
          {/* Media Migration Card - HIDDEN */}
          {/* 
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Calendar Media Migration</CardTitle>
              <CardDescription>
                Migrate calendar event media from filesystem to Replit Object Storage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CalendarMediaMigration />
            </CardContent>
          </Card>
          */}
          
          {/* Events Statistics Card */}
          <Card className="w-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Events Statistics</CardTitle>
              <CardDescription className="text-sm">
                Overview of calendar events.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-md">
                  <CalendarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-2" />
                  <span className="text-xl sm:text-2xl font-bold">
                    {eventsQuery.isLoading ? "..." : eventsQuery.data?.length || 0}
                  </span>
                  <span className="text-xs sm:text-sm text-muted-foreground text-center">
                    Total Events
                  </span>
                </div>
                
                <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-md">
                  <div className="flex flex-wrap gap-1 justify-center mb-2 max-w-full">
                    {(eventsQuery.data || []).slice(0, 3).map(cat => 
                      cat.category
                    ).filter((v, i, a) => a.indexOf(v) === i).map((category, i) => (
                      <Badge key={i} variant="outline" className="capitalize text-xs">
                        {category}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-xl sm:text-2xl font-bold">
                    {eventsQuery.isLoading ? "..." : 
                      new Set((eventsQuery.data || []).map(event => event.category)).size}
                  </span>
                  <span className="text-xs sm:text-sm text-muted-foreground text-center">
                    Unique Categories
                  </span>
                </div>
                
                <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-md sm:col-span-2 lg:col-span-1">
                  <span className="text-xs sm:text-sm text-muted-foreground mb-2 text-center">
                    Selected Events
                  </span>
                  <span className="text-xl sm:text-2xl font-bold">
                    {selectedEvents.length}
                  </span>
                  <div className="flex flex-col gap-1 sm:flex-row sm:gap-2 mt-2 w-full">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={selectAllEvents}
                      disabled={eventsQuery.isLoading || (eventsQuery.data?.length || 0) === 0}
                      className="flex-1 text-xs min-w-0 truncate"
                    >
                      {selectedEvents.length === (eventsQuery.data?.length || 0) ? "Deselect All" : "Select All"}
                    </Button>
                    
                    <Button 
                      variant="destructive" 
                      size="sm"
                      disabled={selectedEvents.length === 0 || deleteMultipleEventsMutation.isPending}
                      onClick={() => deleteMultipleEventsMutation.mutate(selectedEvents)}
                      className="flex-1 text-xs min-w-0 truncate"
                    >
                      Delete Selected
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Notifications Card */}
          <Card className="w-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Notifications
              </CardTitle>
              <CardDescription className="text-sm">
                Send calendar event notifications to all users via email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Email notification success alert */}
              {notifiedUsers.length > 0 && (
                <Alert className="mb-4 border-green-200 bg-green-50" data-testid="alert-calendar-notification-success">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <AlertTitle className="text-green-800 font-semibold">Email Notifications Sent Successfully</AlertTitle>
                  <AlertDescription className="text-green-700">
                    <p className="mb-3">Calendar event notifications were sent to {notifiedUsers.length} {notifiedUsers.length === 1 ? 'mailbox' : 'mailboxes'}:</p>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {notifiedUsers.map((user, index) => {
                        const sharedUsernames = user.additionalUsernames ?? [];
                        const allUsernames = [user.username, ...sharedUsernames].filter(Boolean);
                        return (
                          <div key={index} className="flex items-center gap-2 text-sm bg-white rounded-md p-2 border border-green-200" data-testid={`calendar-notification-user-${index}`}>
                            <Mail className="h-4 w-4 text-green-600 flex-shrink-0" />
                            <span className="font-medium text-navy">{allUsernames.join(', ')}</span>
                            <span className="text-gray-500">({user.email})</span>
                            {sharedUsernames.length > 0 && (
                              <span
                                className="text-xs text-green-700 italic"
                                data-testid={`calendar-notification-user-${index}-shared-mailbox`}
                              >
                                shared mailbox
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => setNotifiedUsers([])}
                      data-testid="button-dismiss-calendar-notification-alert"
                    >
                      Dismiss
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="mb-2">
                <div className="flex items-center gap-3 mb-2">
                  <Label htmlFor="notify-preference" className="text-sm font-medium whitespace-nowrap">Notify</Label>
                  <Select 
                    value={notifyPreference}
                    onValueChange={(value) => setNotifyPreference(value as "none" | "justme" | "admins" | "everyone")}
                  >
                    <SelectTrigger id="notify-preference" className="w-[200px]" data-testid="select-calendar-notify-preference">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" data-testid="option-calendar-notify-none">Notify no one</SelectItem>
                      <SelectItem value="justme" data-testid="option-calendar-notify-justme">Notify just me</SelectItem>
                      <SelectItem value="admins" data-testid="option-calendar-notify-admins">Notify just admins</SelectItem>
                      <SelectItem value="everyone" data-testid="option-calendar-notify-everyone">Notify everyone</SelectItem>
                    </SelectContent>
                  </Select>
                  {manualRecipientsQuery.isFetching && (
                    <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                  {!manualRecipientsQuery.isFetching && manualRecipientsQuery.data && notifyPreference !== "none" && (
                    <Badge variant="secondary" className="text-xs">
                      {manualRecipientsQuery.data.count} {manualRecipientsQuery.data.count === 1 ? "recipient" : "recipients"}
                    </Badge>
                  )}
                  {notifyPreference === "none" && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">0 recipients</Badge>
                  )}
                </div>
                {/* Live recipient list for manual send */}
                {notifyPreference === "none" ? (
                  <div className="ml-1 mb-3">
                    <p className="text-xs text-muted-foreground italic">No recipients — no emails will be sent.</p>
                  </div>
                ) : manualRecipientsQuery.data ? (
                  <div className="ml-1 mb-3">
                    {(manualRecipientsQuery.data.users?.length ?? 0) === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No eligible recipients found.</p>
                    ) : (
                      <div className="max-h-32 overflow-y-auto space-y-1 rounded-md border bg-muted/30 p-2">
                        {(manualRecipientsQuery.data.users ?? []).map((u, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium">{u.username}</span>
                            <span className="text-muted-foreground truncate">({u.email})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">1-Day Notifications</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Send emails with calendar events happening within the next 24 hours.
                </p>
                <Button
                  onClick={() => sendDailyNotificationsMutation.mutate(notifyPreference)}
                  disabled={sendDailyNotificationsMutation.isPending || sendTodayNotificationsMutation.isPending || eventsQuery.isLoading}
                  className="w-full gap-2"
                  data-testid="button-send-daily-notifications"
                >
                  {sendDailyNotificationsMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send 1-Day Notifications
                    </>
                  )}
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Same-Day Notifications</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Send emails with calendar events happening today (Florida/ET). Use if the scheduled send was missed.
                </p>
                <Button
                  onClick={() => sendTodayNotificationsMutation.mutate(notifyPreference)}
                  disabled={sendTodayNotificationsMutation.isPending || sendDailyNotificationsMutation.isPending || eventsQuery.isLoading}
                  variant="outline"
                  className="w-full gap-2"
                  data-testid="button-send-today-notifications"
                >
                  {sendTodayNotificationsMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Today's Events
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Auto-Schedule Configuration Card */}
          <Card className="w-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Automatic Email Schedule
              </CardTitle>
              <CardDescription className="text-sm">
                Configure a daily time to automatically send 1-day calendar notifications. Times are always in Florida / Eastern Time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {scheduleQuery.isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading schedule...
                </div>
              ) : (
                <>
                  {/* Enable / Disable toggle */}
                  <div className={`flex items-center justify-between rounded-lg px-3 py-2 -mx-3 transition-colors ${scheduleEnabled ? "bg-green-50 border border-green-200" : "bg-muted/40 border border-border"}`}>
                    <div>
                      <Label className="text-sm font-medium">Auto-send enabled</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        When enabled, emails are sent automatically at the configured time each day.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      <span className={`text-xs font-semibold ${scheduleEnabled ? "text-green-700" : "text-muted-foreground"}`}>
                        {scheduleEnabled ? "ON" : "OFF"}
                      </span>
                      <Switch
                        checked={scheduleEnabled}
                        onCheckedChange={(val) => {
                          setScheduleEnabled(val);
                          // Auto-save on toggle — persist immediately with new enabled state
                          saveScheduleMutation.mutate({ enabled: val });
                        }}
                        disabled={saveScheduleMutation.isPending}
                        data-testid="switch-schedule-enabled"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Send time input */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label htmlFor="schedule-time" className="text-sm font-medium">
                        Daily send time <span className="text-muted-foreground font-normal">(ET)</span>
                      </Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        value={scheduleSendTime}
                        onChange={(e) => { setScheduleSendTime(e.target.value); setScheduleDirty(true); }}
                        className="mt-1 w-36"
                        data-testid="input-schedule-time"
                      />
                    </div>
                  </div>

                  {/* Notify preference for scheduled send */}
                  <div>
                    <Label htmlFor="schedule-notify" className="text-sm font-medium">Recipients</Label>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-1">
                      Who receives the automated daily email. "Notify just me" sends only to the admin who saves this setting.
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <Select
                        value={scheduleNotifyPref}
                        onValueChange={(v) => {
                          const pref = v as "none" | "justme" | "admins" | "everyone";
                          setScheduleNotifyPref(pref);
                          setScheduleDirty(true);
                        }}
                      >
                        <SelectTrigger id="schedule-notify" className="w-[200px]" data-testid="select-schedule-notify">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Notify no one</SelectItem>
                          <SelectItem value="justme">Notify just me</SelectItem>
                          <SelectItem value="admins">Notify just admins</SelectItem>
                          <SelectItem value="everyone">Notify everyone</SelectItem>
                        </SelectContent>
                      </Select>
                      {scheduleRecipientsQuery.isFetching && (
                        <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                      {!scheduleRecipientsQuery.isFetching && scheduleRecipientsQuery.data && scheduleNotifyPref !== "none" && (
                        <Badge variant="secondary" className="text-xs">
                          {scheduleRecipientsQuery.data.count} {scheduleRecipientsQuery.data.count === 1 ? "recipient" : "recipients"}
                        </Badge>
                      )}
                      {scheduleNotifyPref === "none" && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">0 recipients</Badge>
                      )}
                    </div>
                    {/* Live recipient list for scheduled send */}
                    {scheduleNotifyPref === "none" ? (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground italic">No recipients — no emails will be sent.</p>
                      </div>
                    ) : scheduleRecipientsQuery.data ? (
                      <div className="mt-2">
                        {(scheduleRecipientsQuery.data.users?.length ?? 0) === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No eligible recipients found.</p>
                        ) : (
                          <div className="max-h-32 overflow-y-auto space-y-1 rounded-md border bg-muted/30 p-2">
                            {(scheduleRecipientsQuery.data.users ?? []).map((u, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium">{u.username}</span>
                                <span className="text-muted-foreground truncate">({u.email})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Schedule status: last sent + next scheduled run */}
                  <div className="space-y-0.5">
                    {scheduleLastSent && (
                      <p className="text-xs text-muted-foreground">
                        Last auto-sent: {format(new Date(scheduleLastSent), "MMM d, yyyy 'at' h:mm a")} ET
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {scheduleEnabled
                        ? <>Next scheduled send: <span className="font-medium text-foreground">{getNextRunDisplay(scheduleSendTime)}</span></>
                        : <span className="italic">Auto-send is disabled — no emails will be sent automatically.</span>
                      }
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    {/* Save settings button */}
                    <Button
                      onClick={() => saveScheduleMutation.mutate()}
                      disabled={saveScheduleMutation.isPending || !scheduleDirty}
                      className="gap-2 flex-1"
                      data-testid="button-save-schedule"
                    >
                      {saveScheduleMutation.isPending ? (
                        <><RefreshCw className="h-4 w-4 animate-spin" />Saving...</>
                      ) : (
                        <><Save className="h-4 w-4" />Save Schedule</>
                      )}
                    </Button>

                    {/* Preview email button */}
                    <Button
                      variant="outline"
                      onClick={() => {
                        const savedOrder = scheduleQuery.data?.customEventOrder;
                        const savedImages = scheduleQuery.data?.attachImageEventIds;
                        const initialOrder = savedOrder && savedOrder.length > 0 ? savedOrder : [];
                        const initialImages = savedImages && savedImages.length > 0 ? savedImages : [];
                        setOrderedEventIds(initialOrder);
                        setAttachImageIds(initialImages);
                        setPreviewOrderDirty(false);
                        openPreview(initialOrder.length > 0 ? initialOrder : undefined, initialImages.length > 0 ? initialImages : undefined);
                      }}
                      className="gap-2 flex-1"
                      data-testid="button-preview-email"
                    >
                      <Eye className="h-4 w-4" />
                      Preview Tomorrow's Email
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Email Preview Dialog */}
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
              <DialogHeader className="px-6 pt-6 pb-3 border-b flex-shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Email Preview
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {previewSubject ? <><strong>Subject:</strong> {previewSubject}</> : "Loading preview..."}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-1 overflow-hidden">
                {/* Left panel: event order + image controls */}
                <div className="w-72 flex-shrink-0 border-r flex flex-col">
                  <div className="px-4 py-3 border-b bg-muted/30">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event Order</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Drag to reorder. Check box to attach image.</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {previewLoading && orderedEventIds.length === 0 ? (
                      <div className="flex items-center gap-2 p-3 text-muted-foreground text-xs">
                        <RefreshCw className="h-3 w-3 animate-spin" />Loading events...
                      </div>
                    ) : (
                      orderedEventIds.map((eventId, index) => {
                        const event = previewEvents.find(e => e.id === eventId);
                        if (!event) return null;
                        const hasMedia = (event.mediaUrls ?? []).length > 0;
                        return (
                          <div
                            key={eventId}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragEnter={() => handleDragEnter(index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            className="flex items-center gap-2 p-2 rounded-md border bg-background cursor-grab active:cursor-grabbing hover:bg-muted/50 select-none"
                          >
                            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{event.title}</p>
                              <p className="text-xs text-muted-foreground capitalize">{event.category?.replace(/_/g, ' ')}</p>
                            </div>
                            {hasMedia && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center">
                                      <Checkbox
                                        checked={attachImageIds.includes(eventId)}
                                        onCheckedChange={() => toggleAttachImage(eventId)}
                                        className="h-3.5 w-3.5"
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="left">
                                    <p className="text-xs">Embed image in email</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="p-3 border-t space-y-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-1 text-xs"
                      onClick={refreshPreview}
                      disabled={previewLoading}
                    >
                      {previewLoading ? (
                        <><RefreshCw className="h-3 w-3 animate-spin" />Refreshing...</>
                      ) : (
                        <><RefreshCw className="h-3 w-3" />Refresh Preview</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-1 text-xs"
                      disabled={!previewOrderDirty || saveOrderMutation.isPending}
                      onClick={() => saveOrderMutation.mutate({ customEventOrder: orderedEventIds, attachImageEventIds: attachImageIds })}
                    >
                      {saveOrderMutation.isPending ? (
                        <><RefreshCw className="h-3 w-3 animate-spin" />Saving...</>
                      ) : (
                        <><Save className="h-3 w-3" />Save Order for Next Send</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="w-full gap-1 text-xs bg-primary"
                      disabled={sendNowMutation.isPending || orderedEventIds.length === 0}
                      onClick={() => sendNowMutation.mutate({ customEventOrder: orderedEventIds, attachImageEventIds: attachImageIds })}
                      data-testid="button-send-now"
                    >
                      {sendNowMutation.isPending ? (
                        <><RefreshCw className="h-3 w-3 animate-spin" />Sending...</>
                      ) : (
                        <><Send className="h-3 w-3" />Send Now with These Settings</>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Right panel: email preview iframe */}
                <div className="flex-1 overflow-hidden bg-gray-100">
                  {previewLoading ? (
                    <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      <span className="text-sm">Loading preview...</span>
                    </div>
                  ) : previewHtml ? (
                    <iframe
                      srcDoc={previewHtml}
                      title="Email Preview"
                      className="w-full h-full border-0"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      No preview available. There may be no events tomorrow.
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Card className="w-full">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-4">
                <div>
                  <CardTitle className="text-base sm:text-lg">Event Management</CardTitle>
                  <CardDescription className="text-sm">
                    View and manage all calendar events.
                  </CardDescription>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Input
                    placeholder="Search events..."
                    value={searchTerm}
                    onChange={(e) => updateSearchTerm(e.target.value)}
                    className="flex-1 min-w-0 sm:max-w-sm"
                  />
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/events"] })}
                      disabled={eventsQuery.isLoading}
                      className="flex-shrink-0"
                    >
                      <RefreshCw className={`h-4 w-4 ${eventsQuery.isLoading ? "animate-spin" : ""}`} />
                    </Button>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            onClick={handleExportToExcel}
                            disabled={isExporting || eventsQuery.isLoading || !eventsQuery.data || eventsQuery.data.length === 0}
                            className="gap-2 flex-shrink-0"
                            data-testid="button-export-events"
                          >
                            {isExporting ? (
                              <>
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                <span className="hidden sm:inline">Exporting...</span>
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4" />
                                <span className="hidden sm:inline">Export to Excel</span>
                              </>
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Download all events as an Excel spreadsheet with parent/child grouping</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="gap-2 flex-shrink-0">
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Delete All Events</span>
                          <span className="sm:hidden">Delete All</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                            Delete All Events
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete all events from the community calendar.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteAllEventsMutation.mutate()}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {eventsQuery.isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : eventsQuery.error ? (
                <div className="flex justify-center items-center py-8 text-destructive">
                  <AlertCircle className="h-6 w-6 mr-2" />
                  <span>Error loading events</span>
                </div>
              ) : eventsQuery.data?.length === 0 ? (
                <div className="flex flex-col justify-center items-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mb-4" />
                  <h3 className="text-lg font-medium">No events found</h3>
                  <p className="text-center mt-1">
                    Use the bulk upload button to add events to the calendar.
                  </p>
                </div>
              ) : (
                <DataTable
                  columns={columns}
                  data={(eventsQuery.data ?? []).filter(event => 
                    event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (event.description?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    event.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (event.location?.toLowerCase().includes(searchTerm.toLowerCase()))
                  )}
                />
              )}
            </CardContent>
            
            {(eventsQuery.data?.length || 0) > 0 && (
              <CardFooter className="justify-between border-t pt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {eventsQuery.data?.length} event{eventsQuery.data?.length === 1 ? "" : "s"}
                </div>
                
                <div className="flex gap-2">
                  {selectedEvents.length > 0 && (
                    <Button
                      variant="destructive"
                      onClick={() => deleteMultipleEventsMutation.mutate(selectedEvents)}
                      disabled={deleteMultipleEventsMutation.isPending}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete {selectedEvents.length} Selected Events
                    </Button>
                  )}
                </div>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}