import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from 'zod';
import { Calendar as CalendarIcon, Plus, Trash2, ChevronLeft, ChevronRight, ChevronDown, CreditCard, BanIcon, MapPin, Info, ArrowUpDown, ArrowUp, ArrowDown, Search, X } from "lucide-react";
import { format, addHours, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays, addWeeks, subWeeks } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useCalendarSync } from "@/hooks/use-calendar-sync";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import MobileDayView from "@/components/calendar/mobile-day-view";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EventCard } from "@/components/calendar/event-card";
import { EventCardSkeletonGroup } from "@/components/calendar/event-card-skeleton";
import { PlatinumSponsorBanner } from "@/components/home/platinum-sponsors-section";
import { CreateEventForm, type EventFormData as CreateEventFormData } from "@/components/calendar/create-event-form";
import { type Event } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { LocationPickerAlt } from "@/components/calendar/location-picker-alt";
import { HoursOperationPicker } from "@/components/calendar/hours-operation-picker";
import { usePermissions } from "@/hooks/use-permissions";
import { PhoneInput } from "@/components/ui/phone-input";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useRotatingList } from "@/hooks/use-rotating-list";
import { usePlatinumSponsorSettings, PLATINUM_SPONSOR_DEFAULT_SETTINGS } from "@/hooks/use-platinum-sponsor-settings";

// Helper function to strip HTML tags from text
const stripHtmlTags = (html: string | null) => {
  if (!html) return '';
  return html.replace(/<\/?[^>]+(>|$)/g, '');
};

const defaultHours = {
  Monday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Tuesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Wednesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Thursday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Friday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Saturday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Sunday: { isOpen: true, openTime: "09:00", closeTime: "17:00" }
};

// Define recurrence frequency options for the frontend
const RecurrenceFrequency = {
  DAILY: "daily",
  WEEKLY: "weekly",
  BIWEEKLY: "biweekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
} as const;

type ViewType = 'month' | 'week' | 'day';

export default function CalendarPage() {
  const { user } = useAuth();
  const { isAdmin, canCreateEvent, isRegistered } = usePermissions();
  const { toast } = useToast();
  useCalendarSync(); // Use the calendar sync hook for real-time updates
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [displayedMonth, setDisplayedMonth] = useState<Date>(new Date()); // Track displayed month for navigation preservation
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [badgeFilter, setBadgeFilter] = useState<boolean | null>(null); // null = show all, true = badge required, false = no badge required
  // Set initial view type based on screen size - month for desktop, day for mobile
  const [viewType, setViewType] = useState<ViewType>(typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'month');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [location, setLocation] = useLocation();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'now'>('now'); // Sort order for events (Now & Later by default)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize selected date and category from URL parameters - re-run when location changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dateFromUrl = urlParams.get('date');
    if (dateFromUrl) {
      const parsedDate = new Date(dateFromUrl);
      if (!isNaN(parsedDate.getTime())) {
        setSelectedDate(parsedDate);
        setDisplayedMonth(parsedDate); // Also set displayed month to match
      }
    }
    
    // Set category filter from URL parameter
    const categoryFromUrl = urlParams.get('category');
    if (categoryFromUrl && ['entertainment', 'government', 'social', 'promotional', 'bulletin', 'platinum_sponsor', 'other', 'all'].includes(categoryFromUrl)) {
      setSelectedCategory(categoryFromUrl);
    }
  }, [location]); // Re-run when location changes to support in-page navigation

  // Update URL when selected date changes
  const updateSelectedDate = (newDate: Date) => {
    setSelectedDate(newDate);
    setDisplayedMonth(newDate); // Keep displayed month in sync when selecting a date
    
    // Update URL with date parameter
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('date', newDate.toISOString().split('T')[0]); // Format as YYYY-MM-DD
    
    const newUrl = '/calendar' + (urlParams.toString() ? '?' + urlParams.toString() : '');
    // Use replace instead of push to avoid adding to browser history
    window.history.replaceState({}, '', newUrl);
  };
  
  // Handle month navigation in calendar - updates URL so return navigation preserves position
  const handleMonthChange = (newMonth: Date) => {
    setDisplayedMonth(newMonth);
    
    // Update URL with the displayed month (first day of month)
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('date', newMonth.toISOString().split('T')[0]);
    
    const newUrl = '/calendar' + (urlParams.toString() ? '?' + urlParams.toString() : '');
    window.history.replaceState({}, '', newUrl);
  };

  // Check for mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkMobile();

    // Add resize listener
    window.addEventListener('resize', checkMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Switch to Day view only when transitioning from desktop to mobile and view is Month
  useEffect(() => {
    // Only switch to Day view if we just detected mobile mode AND the current view is Month
    if (isMobile && viewType === 'month') {
      setViewType('day');
    }
    // When switching back to desktop, we don't change anything - maintains user selected view
  }, [isMobile]);

  // Add mutation for deleting all events
  const deleteAllEventsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/events', {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete all events');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Success",
        description: "All calendar events have been deleted"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });


  // Effect to scroll to the selected event when the view loads
  useEffect(() => {
    if (viewType === 'day' && selectedEventId !== null) {
      // Add a slight delay to ensure the DOM is ready
      setTimeout(() => {
        // Use DOM selector to find the selected event
        const selectedElement = document.getElementById(`event-${selectedEventId}`);
        if (selectedElement) {
          selectedElement.scrollIntoView({ 
            behavior: 'smooth',
            block: 'center'  
          });
          // Clear the selected event ID after scrolling
          setSelectedEventId(null);
        }
      }, 100);
    }
  }, [viewType, selectedEventId, setSelectedEventId]);

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const platinumSponsorsForDate = useMemo(() => {
    return (events ?? []).filter((e) => {
      if (e.category !== 'platinum_sponsor') return false;
      if (e.parentEventId) return false;
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      const dayStart = new Date(selectedDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(23, 59, 59, 999);
      return start <= dayEnd && end >= dayStart;
    });
  }, [events, selectedDate]);

  const { data: platinumSponsorSettings } = usePlatinumSponsorSettings();
  const [platinumSponsorTargetEl, setPlatinumSponsorTargetEl] = useState<HTMLDivElement | null>(null);
  const platinumRotationOptions = useMemo(() => {
    const settings = platinumSponsorSettings ?? PLATINUM_SPONSOR_DEFAULT_SETTINGS;
    return {
      randomizeOnLoad: settings.randomizeOnLoad,
      rotationEnabled: settings.rotationEnabled,
      intervalMs: Math.max(5, settings.rotationSeconds) * 1000,
      manualOrderEnabled: settings.manualOrderEnabled,
      manualOrderIds: settings.manualOrder,
      target: platinumSponsorTargetEl,
    };
  }, [platinumSponsorSettings, platinumSponsorTargetEl]);
  const rotatedPlatinumSponsors = useRotatingList(platinumSponsorsForDate, platinumRotationOptions);

  const createEventMutation = useMutation({
    mutationFn: async (data: CreateEventFormData & { mediaFiles?: FileList | null }) => {
      try {
        console.log("=== CREATE EVENT MUTATION START ===");
        console.log("Received data:", data);
        
        const formData = new FormData();

        // Step 1: Clean contact info
        console.log("Step 1: Cleaning contact info...");
        const cleanContactInfo = data.contactInfo ? Object.fromEntries(
          Object.entries(data.contactInfo).filter(([_, value]) => value && value.trim() !== '')
        ) : undefined;
        console.log("Clean contact info:", cleanContactInfo);

        // Step 2: Validate and convert dates
        console.log("Step 2: Processing dates...");
        console.log("Raw startDate:", data.startDate, "Type:", typeof data.startDate);
        console.log("Raw endDate:", data.endDate, "Type:", typeof data.endDate);
        
        if (!data.startDate || !data.endDate) {
          throw new Error("Start date and end date are required");
        }

        // Defensive coercion: ensure dates are Date objects before calling toISOString()
        const startDate = data.startDate instanceof Date ? data.startDate : new Date(data.startDate);
        const endDate = data.endDate instanceof Date ? data.endDate : new Date(data.endDate);
        
        console.log("Converted startDate:", startDate, "Is valid:", !isNaN(startDate.getTime()));
        console.log("Converted endDate:", endDate, "Is valid:", !isNaN(endDate.getTime()));
        
        if (isNaN(startDate.getTime())) {
          throw new Error(`Invalid start date: ${data.startDate}`);
        }
        if (isNaN(endDate.getTime())) {
          throw new Error(`Invalid end date: ${data.endDate}`);
        }

        let recurrenceEndDate: Date | undefined;
        if (data.recurrenceEndDate) {
          recurrenceEndDate = data.recurrenceEndDate instanceof Date ? data.recurrenceEndDate : new Date(data.recurrenceEndDate);
          console.log("Converted recurrenceEndDate:", recurrenceEndDate, "Is valid:", !isNaN(recurrenceEndDate.getTime()));
          if (isNaN(recurrenceEndDate.getTime())) {
            throw new Error(`Invalid recurrence end date: ${data.recurrenceEndDate}`);
          }
        }

        // Step 3: Build event data object
        console.log("Step 3: Building event data object...");
        const eventData = {
          title: data.title,
          description: data.description,
          location: data.location,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          category: data.category,
          badgeRequired: data.badgeRequired,
          // Recurring event fields
          isRecurring: data.isRecurring || false,
          ...(data.isRecurring && data.recurrenceFrequency && { 
            recurrenceFrequency: data.recurrenceFrequency 
          }),
          ...(data.isRecurring && recurrenceEndDate && { 
            recurrenceEndDate: recurrenceEndDate.toISOString()
          }),
          // Other fields
          ...(data.businessName && { businessName: data.businessName }),
          ...(Object.keys(cleanContactInfo || {}).length > 0 && { contactInfo: cleanContactInfo }),
          ...(data.mediaUrls && data.mediaUrls.length > 0 && { mediaUrls: data.mediaUrls }),
          // Parse hoursOfOperation from string if needed
          ...(data.hoursOfOperation && { 
            hoursOfOperation: typeof data.hoursOfOperation === 'string' 
              ? JSON.parse(data.hoursOfOperation) 
              : data.hoursOfOperation 
          }),
          ...(data.sponsorTagline && { sponsorTagline: data.sponsorTagline }),
          ...(data.sponsorPhone && { sponsorPhone: data.sponsorPhone }),
          ...(data.sponsorWebsiteUrl && { sponsorWebsiteUrl: data.sponsorWebsiteUrl }),
          ...(data.sponsorVendorPageSlug && { sponsorVendorPageSlug: data.sponsorVendorPageSlug }),
          ...(data.sponsorIsPoliticalAd !== undefined && { sponsorIsPoliticalAd: data.sponsorIsPoliticalAd }),
          ...(data.sponsorPoliticalAdText && { sponsorPoliticalAdText: data.sponsorPoliticalAdText }),
        };
        console.log("Event data built successfully:", eventData);

        // Step 4: Append to FormData
        console.log("Step 4: Appending to FormData...");
        formData.append('eventData', JSON.stringify(eventData));

        // Step 5: Handle media files
        if (data.mediaFiles) {
          console.log("Step 5: Adding media files...", data.mediaFiles.length);
          Array.from(data.mediaFiles).forEach((file) => {
            formData.append('media', file);
          });
        }

        // Step 6: Send request
        console.log("Step 6: Sending POST request to /api/events...");
        const response = await fetch('/api/events', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        console.log("Response status:", response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Server error:", errorText);
          throw new Error(errorText);
        }

        const result = await response.json();
        console.log("=== CREATE EVENT MUTATION SUCCESS ===", result);
        return result;
      } catch (error) {
        console.error("=== CREATE EVENT MUTATION ERROR ===");
        console.error("Error details:", error);
        console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setIsDialogOpen(false);
      toast({
        title: "Success",
        description: "Event created successfully"
      });
    },
    onError: (error: Error) => {
      console.error("Mutation error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handler for CreateEventForm submission
  const handleCreateEvent = async (data: CreateEventFormData & { mediaFiles?: FileList | null }) => {
    console.log("=== HANDLE CREATE EVENT CALLED ===");
    console.log("Received data in handleCreateEvent:", data);
    try {
      console.log("Calling createEventMutation.mutateAsync...");
      await createEventMutation.mutateAsync(data);
      console.log("mutateAsync completed successfully");
    } catch (error) {
      console.error("=== ERROR IN HANDLE CREATE EVENT ===");
      console.error("Error caught in handleCreateEvent:", error);
      throw error;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'entertainment':
        return 'bg-[#7FD7C6] border border-[#5FC4B1]';
      case 'government':
        return 'bg-[#6FA8DC] border border-[#4F93D3]';
      case 'social':
        return 'bg-[#F6D8A8] border border-[#EBC28B]';
      case 'promotional':
        return 'bg-[#FFF3CD] border border-[#F1E1BA]';
      case 'bulletin':
        return 'bg-[#C9C3E6] border border-[#B3AADF]';
      case 'platinum_sponsor':
        return 'bg-[#E5E7EB] border border-[#9CA3AF]';
      default:
        return 'bg-[#FDFEFE] border border-[#E7EAEE]';
    }
  };

  const getCategoryColorHex = (category: string) => {
    switch (category) {
      case 'entertainment':
        return '#7FD7C6';
      case 'government':
        return '#6FA8DC';
      case 'social':
        return '#F6D8A8';
      case 'promotional':
        return '#FFF3CD';
      case 'bulletin':
        return '#C9C3E6';
      case 'platinum_sponsor':
        return '#E5E7EB';
      default:
        return '#FDFEFE';
    }
  };

  const getCategoryBorderHex = (category: string) => {
    switch (category) {
      case 'entertainment':
        return '#5FC4B1';
      case 'government':
        return '#4F93D3';
      case 'social':
        return '#EBC28B';
      case 'promotional':
        return '#F1E1BA';
      case 'bulletin':
        return '#B3AADF';
      case 'platinum_sponsor':
        return '#9CA3AF';
      default:
        return '#E7EAEE';
    }
  };

  const getTextColor = (category: string) => {
    switch (category) {
      case 'entertainment':
      case 'government':
      case 'social':
      case 'bulletin':
      case 'promotional':
      case 'platinum_sponsor':
        return 'text-[#111827] font-bold';
      default:
        return 'text-[#111827] font-bold';
    }
  };

  const formatEventTime = (date: string | Date, category?: string) => {
    // Hide time for promotional and platinum sponsor events
    if (category === 'promotional' || category === 'platinum_sponsor') {
      return '';
    }
    
    // Parse timestamps and explicitly treat them as UTC
    if (typeof date === 'string') {
      // Ensure the timestamp has timezone info (Z for UTC)
      const dateStr = date.endsWith('Z') ? date : date + 'Z';
      const dateObj = new Date(dateStr);
      // Display times in Florida/Eastern Time (America/New_York) for all users
      // This ensures events always show in the local time where they occur (Barefoot Bay, FL)
      return formatInTimeZone(dateObj, 'America/New_York', "h:mm a");
    }
    // If it's already a Date object, use it directly
    return formatInTimeZone(date, 'America/New_York', "h:mm a");
  };
  
  const isPriorityCategory = (cat: string) => cat === 'promotional' || cat === 'platinum_sponsor';

  const sortEventsWithPromotionalFirst = (events: Event[], ascending: boolean = true) => {
    return [...events].sort((a, b) => {
      const aPriority = isPriorityCategory(a.category);
      const bPriority = isPriorityCategory(b.category);
      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;
      if (aPriority && bPriority) {
        if (a.category === 'platinum_sponsor' && b.category !== 'platinum_sponsor') return -1;
        if (a.category !== 'platinum_sponsor' && b.category === 'platinum_sponsor') return 1;
      }

      const timeA = new Date(a.startDate).getTime();
      const timeB = new Date(b.startDate).getTime();
      return ascending ? timeA - timeB : timeB - timeA;
    });
  };

  const getFilteredEvents = (events: Event[]) => {
    // Apply category filter
    let filteredEvents = selectedCategory === "all"
      ? events
      : events.filter(event => event.category === selectedCategory);

    // Apply badge requirement filter if set
    if (badgeFilter !== null) {
      filteredEvents = filteredEvents.filter(event => {
        // Check if event has badgeRequired property and it matches the filter
        return event.badgeRequired === badgeFilter;
      });
    }

    // Apply search filter if search query exists
    if (searchQuery.trim()) {
      filteredEvents = filteredEvents.filter(event => 
        event.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filteredEvents;
  };

  const getEventsForSelectedDate = () => {
    const filteredEvents = getFilteredEvents(events)
      .filter((event) => isSameDay(new Date(event.startDate), selectedDate));
    
    const platinumEvents = filteredEvents.filter(event => event.category === 'platinum_sponsor');
    const nonPlatinumEvents = filteredEvents.filter(event => event.category !== 'platinum_sponsor');
    const ascending = sortOrder !== 'desc';
    const sortedPlatinum = [...platinumEvents].sort((a, b) => {
      const diff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      return ascending ? diff : -diff;
    });
    
    if (sortOrder === 'now') {
      const now = new Date();
      const currentTime = now.getTime();
      
      const promotionalEvents = nonPlatinumEvents.filter(event => event.category === 'promotional');
      const nonPromoNonPlatinum = nonPlatinumEvents.filter(event => event.category !== 'promotional');
      
      const currentAndFuture = nonPromoNonPlatinum.filter(event => {
        const eventEnd = new Date(event.endDate).getTime();
        return eventEnd >= currentTime;
      }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      
      const past = nonPromoNonPlatinum.filter(event => {
        const eventEnd = new Date(event.endDate).getTime();
        return eventEnd < currentTime;
      }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      
      return [...sortedPlatinum, ...promotionalEvents, ...currentAndFuture, ...past];
    }
    
    return [...sortedPlatinum, ...sortEventsWithPromotionalFirst(nonPlatinumEvents, sortOrder === 'asc')];
  };

  const getEventsForDay = (date: Date) => {
    const filteredEvents = getFilteredEvents(events)
      .filter((event) => isSameDay(new Date(event.startDate), date));
    
    const platinumEvents = filteredEvents.filter(event => event.category === 'platinum_sponsor');
    const nonPlatinumEvents = filteredEvents.filter(event => event.category !== 'platinum_sponsor');
    const ascending = sortOrder !== 'desc';
    const sortedPlatinum = [...platinumEvents].sort((a, b) => {
      const diff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      return ascending ? diff : -diff;
    });
    
    if (sortOrder === 'now') {
      const now = new Date();
      const currentTime = now.getTime();
      
      const promotionalEvents = nonPlatinumEvents.filter(event => event.category === 'promotional');
      const nonPromoNonPlatinum = nonPlatinumEvents.filter(event => event.category !== 'promotional');
      
      const currentAndFuture = nonPromoNonPlatinum.filter(event => {
        const eventEnd = new Date(event.endDate).getTime();
        return eventEnd >= currentTime;
      }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      
      const past = nonPromoNonPlatinum.filter(event => {
        const eventEnd = new Date(event.endDate).getTime();
        return eventEnd < currentTime;
      }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      
      return [...sortedPlatinum, ...promotionalEvents, ...currentAndFuture, ...past];
    }
    
    return [...sortedPlatinum, ...sortEventsWithPromotionalFirst(nonPlatinumEvents, sortOrder === 'asc')];
  };

  const renderDayContent = (date: Date) => {
    const dayEvents = getEventsForDay(date);
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    // Use the dedicated mobile component on mobile devices
    if (isMobile) {
      return <MobileDayView date={date} events={dayEvents} />;
    }

    // Desktop view rendering
    const MAX_VISIBLE_EVENTS = 3;
    const displayEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
    const remainingCount = dayEvents.length - MAX_VISIBLE_EVENTS;
    const hasMoreEvents = remainingCount > 0;

    return (
      <div className="h-full w-full flex flex-col" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
        {/* Day number */}
        <div className="text-right pr-1 font-semibold text-sm h-5">
          {format(date, "d")}
          {hasMoreEvents && (
            <span className="inline-block ml-1">
              <ChevronDown className="h-3 w-3 inline-block opacity-40" />
            </span>
          )}
        </div>

        {/* Events container with overflow indicator */}
        <div className="flex-1 flex flex-col space-y-1 px-1 relative" style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
          {displayEvents.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}?returnDate=${displayedMonth.toISOString().split('T')[0]}`}
              className={`mobile-calendar-event overflow-hidden hover:opacity-90 transition-opacity cursor-pointer flex-shrink-0 w-full ${event.category === 'promotional' ? 'animate-gold-shine-compact' : ''}`}
              style={{ 
                width: '100%', 
                maxWidth: '100%', 
                display: 'block',
                backgroundColor: getCategoryColorHex(event.category),
                border: `1px solid ${getCategoryBorderHex(event.category)}`,
                borderRadius: '4px',
                marginBottom: '2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {/* Apple-style calendar event - just title in white text over category color */}
              <div className="px-1.5 py-0.5 w-full" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-[10px] text-[#111827] overflow-hidden text-ellipsis whitespace-nowrap ${event.category === 'promotional' || event.category === 'platinum_sponsor' ? 'max-w-full' : 'max-w-[calc(100%-30px)]'}`}>
                    {event.title}
                  </span>
                  {event.category !== 'promotional' && event.category !== 'platinum_sponsor' && (
                    <span className="text-[9px] text-[#111827] font-bold">
                      {formatEventTime(event.startDate, event.category)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
          {hasMoreEvents && (
            <Link
              href={`/calendar?date=${format(date, 'yyyy-MM-dd')}`}
              className="text-[9px] text-center bg-gray-100 hover:bg-blue-200 text-gray-800 
              rounded px-1 py-0.5 font-medium block hover:text-blue-900 transition-colors group mt-1 relative w-full"
            >
              <span className="block group-hover:hidden">
                +{remainingCount} more
                <ChevronDown className="h-2.5 w-2.5 inline-block ml-1 opacity-50" />
              </span>
              <span className="hidden group-hover:block">See All</span>
            </Link>
          )}
        </div>
      </div>
    );
  };

  // Navigation functions
  const goToPreviousDay = () => {
    updateSelectedDate(subDays(selectedDate, 1));
  };

  const goToNextDay = () => {
    updateSelectedDate(addDays(selectedDate, 1));
  };

  const goToPreviousWeek = () => {
    updateSelectedDate(subWeeks(selectedDate, 1));
  };

  const goToNextWeek = () => {
    updateSelectedDate(addWeeks(selectedDate, 1));
  };

  const renderDailyView = () => {
    // getEventsForSelectedDate already applies sorting based on sortOrder state
    const sortedEvents = getEventsForSelectedDate();

    return (
      <div className="space-y-4">
        <div className="flex items-center">
          <Button 
            variant="outline" 
            size="icon"
            onClick={goToPreviousDay}
            aria-label="Previous day"
            className="flex-none"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-base sm:text-xl md:text-2xl font-semibold flex-1 text-center truncate">
            {format(selectedDate, "EEEE, MMMM d, yyyy")}
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={goToNextDay}
            aria-label="Next day"
            className="flex-none"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Chronological list view */}
        <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
          {isLoading || sortedEvents.length === 0 ? (
            <div className="p-4 space-y-4">
              <div className="animate-pulse space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <div className="w-20 h-12 bg-gray-200 rounded"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full">
              {rotatedPlatinumSponsors.length > 0 && (
                <div ref={setPlatinumSponsorTargetEl} className="py-3 space-y-3 sm:px-3">
                  {rotatedPlatinumSponsors.map((event) => (
                    <PlatinumSponsorBanner key={event.id} event={event} showImage={false} edgeToEdge />
                  ))}
                </div>
              )}
            <ul className="divide-y w-full">
              {sortedEvents.filter(e => e.category !== 'platinum_sponsor').map((event) => {
                const startTime = new Date(event.startDate);
                const endTime = new Date(event.endDate);

                return (
                  <li 
                    key={event.id} 
                    className={`p-0 w-full ${event.category === 'promotional' ? 'promotional-detail-card' : ''}`}
                    id={`event-${event.id}`}
                  >
                    <Link 
                      href={`/events/${event.id}?returnDate=${selectedDate.toISOString().split('T')[0]}`}
                      className={`block p-4 transition-colors w-full ${event.category === 'promotional' ? 'hover:bg-[#fef9e7]' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex flex-wrap sm:flex-nowrap items-start gap-3 w-full">
                        {/* Category indicator */}
                        <div className="w-1.5 self-stretch rounded-full hidden sm:block" 
                          style={{ 
                            backgroundColor: getCategoryColorHex(event.category),
                            border: `1px solid ${getCategoryBorderHex(event.category)}`
                          }} 
                        />

                        {/* Time column - adjust for mobile, hidden for promotional */}
                        {event.category !== 'promotional' && (
                          <div className="w-full sm:w-20 flex-shrink-0 text-center mb-2 sm:mb-0">
                            <div className="text-sm font-medium">
                              {formatEventTime(startTime, event.category)}
                            </div>
                            <div className="text-xs text-gray-500">
                              to {formatEventTime(endTime, event.category)}
                            </div>
                          </div>
                        )}

                        {/* Event details */}
                        <div className="flex-grow min-w-0 w-full sm:w-auto">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-3 h-3 rounded-full flex-shrink-0 sm:hidden ${getCategoryColor(event.category)}`}></div>
                            <h4 className="font-semibold text-base break-words md:truncate">{event.title}</h4>
                          </div>

                          {event.location && (
                            <div className="text-sm text-gray-600 truncate mt-1">
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                                {event.location}
                              </span>
                            </div>
                          )}

                          {/* Badge requirement indicator */}
                          <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                            {event.badgeRequired ? (
                              <>
                                <CreditCard className="h-3 w-3 text-primary" />
                                <span className="font-medium text-white bg-primary px-1 rounded">Badge Required</span>
                              </>
                            ) : (
                              <>
                                <BanIcon className="h-3 w-3 text-gray-400" />
                                <span>No Badge Required</span>
                              </>
                            )}
                          </div>

                          {event.description && (
                            <div className="text-sm text-gray-600 line-clamp-2 mt-1">
                              {stripHtmlTags(event.description)}
                            </div>
                          )}
                        </div>

                        {/* Category badge - bottom on mobile, right on desktop */}
                        <div className="flex-shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                          <span 
                            className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${getCategoryColor(event.category)} ${getTextColor(event.category)}`}
                          >
                            {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  // We'll use CSS position: sticky instead of JavaScript
  // This effect just adds some debugging info
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Adding debugging info
    const weekNavHeader = document.querySelector('.week-nav-header');
    if (weekNavHeader) {
      const rect = weekNavHeader.getBoundingClientRect();
      weekNavHeader.setAttribute('data-top', rect.top.toString());
      weekNavHeader.setAttribute('data-height', rect.height.toString());
    }
  }, [viewType]);

  const renderWeeklyView = () => {
    const weekStart = startOfWeek(selectedDate);
    const weekEnd = endOfWeek(selectedDate);
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

    // Generate array of hours for the timeline
    const hours = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM to 9 PM

    // Group events by their start time to handle overlaps
    const groupEventsByTime = (events: Event[]) => {
      const groupedEvents: {[key: string]: Event[]} = {};

      events.forEach(event => {
        const startHour = new Date(event.startDate).getHours();
        const startMinRounded = Math.floor(new Date(event.startDate).getMinutes() / 15) * 15;
        const timeKey = `${startHour}:${startMinRounded}`;

        if (!groupedEvents[timeKey]) {
          groupedEvents[timeKey] = [];
        }
        groupedEvents[timeKey].push(event);
      });

      return groupedEvents;
    };

    // Function to calculate position and height based on event time
    const calculateEventPosition = (event: Event, eventIndex: number, totalEvents: number) => {
      const startTime = new Date(event.startDate);
      const endTime = new Date(event.endDate);

      const startHour = startTime.getHours() + startTime.getMinutes() / 60;
      const endHour = endTime.getHours() + endTime.getMinutes() / 60;

      // Calculate top position (distance from top based on start time)
      // Each hour is 100px tall in our timeline
      const topPosition = Math.max(0, (startHour - 7) * 100); // 7 AM is our starting hour

      // Calculate height (based on event duration)
      const height = Math.max(50, (endHour - startHour) * 100); // Minimum height of 50px

      // Calculate width and left position for overlapping events
      let width = '100%';
      let left = 0;

      if (totalEvents > 1) {
        // If there are multiple events at the same time
        const columnWidth = 100 / totalEvents;
        width = `${columnWidth}%`;
        left = eventIndex * columnWidth;
      }

      return { top: topPosition, height, width, left };
    };

    return (
      <div className="space-y-2">
        {/* Week navigation bar that becomes sticky only when scrolling down */}
        <div className="flex items-center justify-between px-2 mb-0 sticky top-[50px] md:top-0 left-0 right-0 bg-white z-40 py-2 border-b shadow-sm week-nav-header">
          <Button 
            variant="outline" 
            size="icon"
            onClick={goToPreviousWeek}
            aria-label="Previous week"
            className="flex-none h-10 w-10 mr-1"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-base sm:text-xl md:text-2xl font-semibold text-center truncate">
            <span className="hidden sm:inline">Week of </span>
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={goToNextWeek}
            aria-label="Next week"
            className="flex-none h-10 w-10 ml-1"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Timeline view */}
        <div className="border rounded-lg overflow-x-auto relative -mx-4 md:mx-0 md:overflow-visible">
          {/* Mobile week view indicator - commented out as no longer needed */}
          {/* <div className="md:hidden absolute left-1/2 -translate-x-1/2 top-1 z-30 bg-slate-50/90 text-xs text-gray-500 rounded px-2 py-1 shadow-sm">
            <span>← Swipe →</span>
          </div> */}
          <div className="flex w-full overflow-x-auto" style={{ minWidth: '100%', maxWidth: '100%' }}>
            {/* Time markers column */}
            <div className="w-5 md:w-16 border-r bg-slate-50 relative sticky left-0 z-20">
              {hours.map((hour) => (
                <div key={hour} className="h-[80px] md:h-[100px] border-b flex items-center justify-end pr-1 md:pr-2 text-[10px] md:text-xs text-gray-500 font-medium">
                  <div>
                    <span className="hidden md:inline">{hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}</span>
                    <span className="md:hidden">{hour === 12 ? '12p' : hour > 12 ? `${hour - 12}p` : `${hour}a`}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Days columns */}
            {daysInWeek.map((day) => {
              // Use getEventsForDay which applies promotional-first sorting
              const eventsForDay = getEventsForDay(day);

              return (
                <div key={day.toISOString()} className="flex-1 border-r w-[45px] md:w-[80px] relative">
                  {/* Day header - now clickable */}
                  <div 
                    className="h-12 border-b bg-white sticky top-0 z-10 flex flex-col justify-center items-center cursor-pointer hover:bg-slate-50"
                    onClick={() => {
                      // When the day header is clicked, set the selected date to this day and switch to day view
                      setSelectedDate(day);
                      setViewType('day');
                    }}
                  >
                    <div className="font-bold text-[10px] md:text-sm">
                      <span className="md:hidden">{format(day, "EEE")}</span>
                      <span className="hidden md:inline">{format(day, "EEEE")}</span>
                    </div>
                    <div className="text-[10px] md:text-sm text-gray-500">{format(day, "MMM d")}</div>
                  </div>

                  {/* Time grid */}
                  <div className="relative">
                    {hours.map((hour) => (
                      <div 
                        key={hour} 
                        className="h-[80px] md:h-[100px] border-b cursor-pointer hover:bg-slate-50"
                        onClick={() => {
                          // When anempty cell is clicked, set the selected date to this day and switch to day view
                          const newDate = new Date(day);
                          newDate.setHours(hour);
                          setSelectedDate(newDate);
                          setViewType('day');
                        }}
                      ></div>
                    ))}

                    {/* Events */}
                    {/* Group events by start time to handle overlaps */}
                    {Object.entries(groupEventsByTime(eventsForDay)).map(([timeKey, events]) => {
                      const eventsArray = events as Event[];
                      return eventsArray.map((event, index) => {
                        const startTime = new Date(event.startDate);
                        const endTime = new Date(event.endDate);

                        const startHour = startTime.getHours() + startTime.getMinutes() / 60;
                        const endHour = endTime.getHours() + endTime.getMinutes() / 60;

                        // Calculate top position (distance from top based on start time)
                        // Adjust for mobile vs desktop heights (80px vs 100px per hour)
                        const hourHeight = typeof window !== 'undefined' && window.innerWidth < 768 ? 80 : 100;
                        const topPosition = Math.max(0, (startHour - 7) * hourHeight);

                        // Calculate height (based on event duration)
                        const height = Math.max(40, (endHour - startHour) * hourHeight); // Smaller minimum height on mobile

                        // Calculate width and position for overlapping events
                        const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;

                        // For mobile with multiple events at the same time,
                        // determine if we should adapt the layout
                        const useMobileAdaptiveLayout = isMobileView && eventsArray.length > 1;

                        // Calculate event width based on number of events and mobile vs desktop
                        const eventWidth = eventsArray.length > 1 
                          ? useMobileAdaptiveLayout
                            ? `${95}%` // Make mobile overlapping events still take up most of the space
                            : `${100 / eventsArray.length}%` 
                          : '100%';

                        // For mobile with multiple events, calculate a vertical offset instead of reducing width
                        const verticalOffset = useMobileAdaptiveLayout ? (index * 5) : 0;

                        // Calculate horizontal position
                        const leftPosition = eventsArray.length > 1 
                          ? useMobileAdaptiveLayout
                            ? 0  // All events aligned to left on mobile
                            : index * (100 / eventsArray.length) 
                          : 0;

                        const eventStart = new Date(event.startDate);

                        // Determine mobile-specific classes
                        const mobileOverlapClass = useMobileAdaptiveLayout ? "mobile-event-overlap" : "";
                        const mobileOverlapIndex = useMobileAdaptiveLayout ? `mobile-event-index-${index}` : "";

                        return (
                          <div
                            key={event.id}
                            onClick={() => {
                              setSelectedDate(new Date(event.startDate));
                              setSelectedEventId(event.id);
                              setViewType('day');
                            }}
                            className={`absolute rounded shadow hover:shadow-md transition-shadow px-2 py-1 overflow-hidden hover:z-30 active:z-30 ${event.category === 'entertainment' ? 'bg-[#7FD7C6] border border-[#5FC4B1]' : event.category === 'government' ? 'bg-[#6FA8DC] border border-[#4F93D3]' : event.category === 'social' ? 'bg-[#F6D8A8] border border-[#EBC28B]' : event.category === 'promotional' ? 'bg-[#FFF3CD] border border-[#F1E1BA]' : event.category === 'bulletin' ? 'bg-[#C9C3E6] border border-[#B3AADF]' : event.category === 'platinum_sponsor' ? 'bg-[#E5E7EB] border border-[#9CA3AF]' : 'bg-[#FDFEFE] border border-[#E7EAEE]'} cursor-pointer ${mobileOverlapClass} ${mobileOverlapIndex}`}
                            style={{ 
                              top: `${topPosition + verticalOffset}px`, 
                              height: `${height}px`,
                              minHeight: '40px',
                              left: `${leftPosition}%`,
                              width: eventWidth,
                              zIndex: useMobileAdaptiveLayout ? index + 1 : 'auto', // Higher z-index for later events
                            }}
                            data-event-title={event.title} // Store event title for tooltip/accessibility
                          >
                            <div className="font-bold text-xs break-words md:truncate text-[#111827]">
                              {/* Always display text horizontally for all events */}
                              <span className="horizontal-only mobile-event-title">{event.title}</span>
                            </div>
                            {event.category !== 'promotional' && (
                              <div className="text-[10px] truncate text-[#111827] font-bold">
                                {formatEventTime(eventStart, event.category)}
                                {/* Badge indicator icon */}
                                {event.badgeRequired && 
                                  <span className="ml-1 inline-flex items-center">
                                    <CreditCard className="h-2 w-2 inline-block ml-1 text-primary" />
                                  </span>
                                }
                              </div>
                            )}
                            {event.category === 'promotional' && event.badgeRequired && (
                              <div className="text-[10px] truncate text-navy/80">
                                <CreditCard className="h-2 w-2 inline-block text-primary" />
                              </div>
                            )}

                            {/* Mobile-only indicator for overlapping events */}
                            {useMobileAdaptiveLayout && (
                              <div className="mobile-event-counter">
                                {index + 1}/{eventsArray.length}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /* Function moved to avoid duplicate declaration */

  return (
    <>
      <div className="max-w-7xl w-full space-y-8 relative overflow-x-hidden pt-1">
        {/* Header only for desktop - completely hidden on mobile */}
        <div className="hidden md:flex items-start justify-between w-full mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-4 text-left">Community Calendar</h1>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="xs" className="text-xs px-2 py-1 h-6">
                  <Info className="h-3 w-3 mr-1" />
                  User Disclaimer
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md max-h-[85vh] overflow-auto p-6 mt-4">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg">Calendar Disclaimer</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Please note: Events may change or be canceled due to weather, illness, or unforeseen circumstances.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    For corrections, updates, photos, or event submissions, email calendar@barefootbay.com
                  </p>
                </div>
                <div className="flex justify-end">
                  <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Refresh button removed as requested */}
        </div>

        {/* Mobile header - removed per request */}
        <div className="md:hidden mb-8">
          {/* Community Calendar header removed from mobile view only */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="xs" className="text-xs px-2 py-1 h-5 mb-4">
                <Info className="h-2.5 w-2.5 mr-1" />
                User Disclaimer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-auto p-6 mt-4">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Calendar Disclaimer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Please note: Events may change or be canceled due to weather, illness, or unforeseen circumstances.
                </p>
                <p className="text-sm text-muted-foreground">
                  For corrections, updates, photos, or event submissions, email calendar@barefootbay.com
                </p>
              </div>
              <div className="flex justify-end">
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Floating Action Button for desktop */}
        <div className="hidden md:block fixed bottom-8 right-8 z-10">
          {!user && (
            <Link href="/auth">
              <Button size="icon" className="h-16 w-16 rounded-full shadow-lg">
                <Plus className="h-7 w-7" />
              </Button>
            </Link>
          )}

          {user && !canCreateEvent && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" className="h-16 w-16 rounded-full shadow-lg" disabled>
                    <Plus className="h-7 w-7" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="p-3 text-center">
                  <p>Feature access restricted</p>
                  <p className="text-xs mt-1">You don't have permission to create events</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {user && canCreateEvent && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="icon" className="h-16 w-16 rounded-full shadow-lg">
                  <Plus className="h-7 w-7" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Event</DialogTitle>
                  <DialogDescription>
                    Add a new event to the community calendar. Fields marked with * are required.
                  </DialogDescription>
                </DialogHeader>
                <CreateEventForm
                  defaultValues={{
                    startDate: selectedDate,
                    endDate: addHours(selectedDate, 1),
                    category: "entertainment" as const,
                    badgeRequired: true
                  }}
                  onSubmit={handleCreateEvent}
                  isSubmitting={createEventMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Floating Action Button for mobile */}
        <div className="md:hidden fixed bottom-6 right-6 z-10 fab-container">
          {!user && (
            <Link href="/auth">
              <Button size="icon" className="h-14 w-14 rounded-full shadow-md bg-primary single-fab">
                <Plus className="h-6 w-6" />
              </Button>
            </Link>
          )}

          {user && !canCreateEvent && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" className="h-14 w-14 rounded-full shadow-md bg-primary single-fab" disabled>
                    <Plus className="h-6 w-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="p-3 text-center">
                  <p>Feature access restricted</p>
                  <p className="text-xs mt-1">You don't have permission to create events</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {user && canCreateEvent && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="icon" className="h-14 w-14 rounded-full shadow-md bg-primary single-fab">
                  <Plus className="h-6 w-6" />
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-[700px] max-h-[80vh] overflow-y-auto p-2 sm:p-6 max-w-full min-w-0">
                <DialogHeader>
                  <DialogTitle>Create New Event</DialogTitle>
                  <DialogDescription>
                    Add a new event to the community calendar. Fields marked with * are required.
                  </DialogDescription>
                </DialogHeader>
                <CreateEventForm
                  defaultValues={{
                    startDate: selectedDate,
                    endDate: addHours(selectedDate, 1),
                    category: "entertainment" as const,
                    badgeRequired: true
                  }}
                  onSubmit={handleCreateEvent}
                  isSubmitting={createEventMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4 lg:gap-8 w-full max-w-full">
        <div className={`${viewType === 'day' || viewType === 'week' ? 'lg:col-span-5' : 'lg:col-span-3'} w-full min-w-0 ${viewType === 'month' ? 'lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto' : ''}`}>
          <div className="flex flex-col mb-2 gap-2 w-full min-w-0">
            {/* Row 1: All filters on one line - full width like search bar */}
            <div className="flex flex-nowrap gap-2 items-center w-full overflow-x-auto py-1">
              <div className="flex gap-1">
                {/* Only show Month button on desktop */}
                {!isMobile && (
                  <Button
                    variant={viewType === 'month' ? 'default' : 'outline'}
                    onClick={() => setViewType('month')}
                    size="sm"
                    className="h-9"
                  >
                    Month
                  </Button>
                )}
                <Button
                  variant={viewType === 'week' ? 'default' : 'outline'}
                  onClick={() => setViewType('week')}
                  size="sm"
                  className="h-9"
                >
                  Week
                </Button>
                <Button
                  variant={viewType === 'day' ? 'default' : 'outline'}
                  onClick={() => setViewType('day')}
                  size="sm"
                  className="h-9"
                >
                  Day
                </Button>
              </div>

              {/* Sort order filter - visible in all views */}
              <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc' | 'now') => setSortOrder(value)}>
                <SelectTrigger className="w-[100px] h-9 text-sm whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3" />
                    <span>Sort</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="now">
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="h-4 w-4" />
                      <span>Now & Later</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="asc">
                    <div className="flex items-center gap-2">
                      <ArrowUp className="h-4 w-4" />
                      <span>Earliest First</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="desc">
                    <div className="flex items-center gap-2">
                      <ArrowDown className="h-4 w-4" />
                      <span>Latest First</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-[120px] h-9 text-sm whitespace-nowrap">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-bold text-md text-[#111827] bg-[#FDFEFE] border border-[#E7EAEE] rounded-md data-[highlighted]:bg-[#F29A8A] data-[highlighted]:border-[#EA7F6D] data-[state=checked]:bg-[#F29A8A] data-[state=checked]:border-[#EA7F6D]">Categories</SelectItem>
                  <SelectItem value="entertainment" className="font-bold text-[#111827] bg-[#7FD7C6] border border-[#5FC4B1] text-md py-2 my-1 rounded-md data-[highlighted]:bg-[#F29A8A] data-[highlighted]:border-[#EA7F6D] data-[state=checked]:bg-[#F29A8A] data-[state=checked]:border-[#EA7F6D]">
                    Entertainment & Activities
                  </SelectItem>
                  <SelectItem value="government" className="font-bold text-[#111827] bg-[#6FA8DC] border border-[#4F93D3] text-md py-2 my-1 rounded-md data-[highlighted]:bg-[#F29A8A] data-[highlighted]:border-[#EA7F6D] data-[state=checked]:bg-[#F29A8A] data-[state=checked]:border-[#EA7F6D]">
                    Government & Politics
                  </SelectItem>
                  <SelectItem value="social" className="font-bold text-[#111827] bg-[#F6D8A8] border border-[#EBC28B] text-md py-2 my-1 rounded-md data-[highlighted]:bg-[#F29A8A] data-[highlighted]:border-[#EA7F6D] data-[state=checked]:bg-[#F29A8A] data-[state=checked]:border-[#EA7F6D]">
                    Social Clubs
                  </SelectItem>
                  <SelectItem value="promotional" className="font-bold text-[#111827] bg-[#FFF3CD] border border-[#F1E1BA] text-md py-2 my-1 rounded-md data-[highlighted]:bg-[#F29A8A] data-[highlighted]:border-[#EA7F6D] data-[state=checked]:bg-[#F29A8A] data-[state=checked]:border-[#EA7F6D]">
                    Promotional
                  </SelectItem>
                  <SelectItem value="bulletin" className="font-bold text-[#111827] bg-[#C9C3E6] border border-[#B3AADF] text-md py-2 my-1 rounded-md data-[highlighted]:bg-[#F29A8A] data-[highlighted]:border-[#EA7F6D] data-[state=checked]:bg-[#F29A8A] data-[state=checked]:border-[#EA7F6D]">
                    Bulletin
                  </SelectItem>
                  <SelectItem value="platinum_sponsor" className="font-bold text-[#111827] bg-[#E5E7EB] border border-[#9CA3AF] text-md py-2 my-1 rounded-md data-[highlighted]:bg-[#F29A8A] data-[highlighted]:border-[#EA7F6D] data-[state=checked]:bg-[#F29A8A] data-[state=checked]:border-[#EA7F6D]">
                    Platinum Sponsors
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Badge requirement filter */}
              <Select 
                value={badgeFilter === null ? 'all' : badgeFilter === true ? 'required' : 'none'} 
                onValueChange={(value) => {
                  if (value === 'all') setBadgeFilter(null);
                  else if (value === 'required') setBadgeFilter(true);
                  else setBadgeFilter(false);
                }}
              >
                <SelectTrigger className="w-[90px] h-9 text-sm whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    <span>Badge</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <span>All</span>
                      <CreditCard className="h-4 w-4" />
                      <span>+</span>
                      <BanIcon className="h-4 w-4" />
                    </div>
                  </SelectItem>
                  <SelectItem value="required">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      <span>Badge Required</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="none">
                    <div className="flex items-center gap-2">
                      <BanIcon className="h-4 w-4" />
                      <span>No Badge</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 2: Search bar full width */}
            <div className="relative w-full">
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchSuggestions(e.target.value.trim().length > 0);
                }}
                onFocus={() => setShowSearchSuggestions(searchQuery.trim().length > 0)}
                onBlur={() => {
                  // Delay hiding to allow click on suggestion
                  setTimeout(() => setShowSearchSuggestions(false), 200);
                }}
                className="w-full h-10 pl-9 pr-9"
                data-testid="input-search-events"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setShowSearchSuggestions(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {/* Autocomplete dropdown */}
              {showSearchSuggestions && searchQuery.trim() && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-[300px] overflow-auto">
                  {(() => {
                    // Get filtered events first (respecting category and badge filters)
                    let filteredForSuggestions = selectedCategory === "all"
                      ? events
                      : events.filter(event => event.category === selectedCategory);

                    if (badgeFilter !== null) {
                      filteredForSuggestions = filteredForSuggestions.filter(event => 
                        event.badgeRequired === badgeFilter
                      );
                    }

                    // Then filter by search query
                    const matchingEvents = filteredForSuggestions
                      .filter(event => 
                        event.title.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .slice(0, 10);

                    if (matchingEvents.length === 0) {
                      return (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          No events found
                        </div>
                      );
                    }

                    return matchingEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => {
                          setSearchQuery(event.title);
                          setShowSearchSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b last:border-b-0 transition-colors"
                        data-testid={`suggestion-${event.id}`}
                      >
                        <div className="font-medium text-sm truncate">{event.title}</div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(event.startDate), "MMM d, yyyy")}
                        </div>
                      </button>
                    ));
                  })()}
                </div>
              )}
            </div>
          </div>

          {viewType === 'month' ? (
            <Calendar
              mode="single"
              selected={selectedDate}
              month={displayedMonth}
              onMonthChange={handleMonthChange}
              onSelect={(date) => date && updateSelectedDate(date)}
              className="rounded-md border w-full bg-white overflow-hidden"
              components={{
                DayContent: ({ date }) => renderDayContent(date)
              }}
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full max-w-full",
                month: "space-y-2 w-full max-w-full", // Ensure month takes full width
                caption: "flex justify-center pt-1 pb-1 relative items-center", // Reduced padding
                caption_label: "text-lg font-semibold", // Smaller font on mobile
                nav: "space-x-1 flex items-center", // Reduced spacing
                nav_button: cn(
                  buttonVariants({ variant: "outline" }),
                  "h-7 w-7 md:h-9 md:w-9 bg-transparent p-0 opacity-70 hover:opacity-100" // Smaller nav buttons on mobile
                ),
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full max-w-full border-collapse space-y-0 table-fixed", // Added table-fixed for proper column widths
                head_row: "flex w-full max-w-full flex-nowrap",
                head_cell: "text-muted-foreground rounded-md w-[14.28%] min-w-[14.28%] max-w-[14.28%] font-semibold text-xs md:text-base h-8 md:h-12 sticky top-0 bg-white z-10 p-0", // Added min-width to ensure cell width
                head_cell_content: ({ title, ...props }) => {
                  // Use shorter abbrevations on mobile
                  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
                  const shortened = {
                    "Sunday": "Su",
                    "Monday": "Mo",
                    "Tuesday": "Tu",
                    "Wednesday": "We",
                    "Thursday": "Th", 
                    "Friday": "Fr",
                    "Saturday": "Sa"
                  };

                  return <span className="block text-center px-0">{isMobile ? shortened[title] || title : title}</span>;
                },
                row: "flex w-full max-w-full flex-nowrap mt-0", // Added max-width to ensure no overflow
                cell: "relative w-[14.28%] min-w-[14.28%] max-w-[14.28%] h-12 md:h-28 p-0 bg-white border text-center hover:bg-accent hover:text-accent-foreground focus-within:relative focus-within:z-20 overflow-hidden hover:overflow-auto calendar-cell", // Added min-width to ensure cell width
                day: "h-full w-full p-0 font-normal aria-selected:opacity-100 flex flex-col",
                day_range_end: "day-range-end",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "bg-accent text-accent-foreground",
                day_outside: "text-muted-foreground opacity-50 bg-white",
                day_disabled: "text-muted-foreground opacity-50",
                day_hidden: "invisible",
              }}
            />
          ) : viewType === 'week' ? (
            renderWeeklyView()
          ) : (
            renderDailyView()
          )}
        </div>

        {viewType === 'month' && (
          <div className="lg:col-span-2 space-y-4 pl-2 lg:pl-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-semibold flex items-center gap-2 md:gap-3 flex-wrap">
                  <span className="hidden md:inline">Events for {format(selectedDate, "MMMM d, yyyy")}</span>
                  <span className="md:hidden">Events for {format(selectedDate, "MMM d, yyyy")}</span>
                </h2>
              </div>
            </div>

            {isLoading || getEventsForSelectedDate().length === 0 ? (
              <div className="grid grid-cols-1 gap-4">
                <EventCardSkeletonGroup count={3} />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {rotatedPlatinumSponsors.length > 0 && (
                  <div ref={setPlatinumSponsorTargetEl} className="grid grid-cols-1 gap-4">
                    {rotatedPlatinumSponsors.map((event) => (
                      <PlatinumSponsorBanner key={event.id} event={event} showImage={false} />
                    ))}
                  </div>
                )}
                {getEventsForSelectedDate().filter(e => e.category !== 'platinum_sponsor').map((event) => (
                  <EventCard key={event.id} event={event} returnDate={selectedDate.toISOString().split('T')[0]} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}