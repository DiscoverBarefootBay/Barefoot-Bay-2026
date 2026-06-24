import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { CalendarDays, MapPin, Clock, MessageSquare, ThumbsUp, Users, Phone, Mail, Globe, Building2, Pencil, Trash2, AlertTriangle, Eye, EyeOff, CreditCard, BanIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CreateEventForm, type EventFormData } from "@/components/calendar/create-event-form";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { type Event, type EventWithChildCount, type InteractionWithUser, type CommentWithUser } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { UserAvatarCarousel } from "@/components/calendar/user-avatar-carousel";
import { LocationMapAlt } from "@/components/calendar/location-map-alt";
import { EventMediaGallerySimple } from "@/components/calendar/event-media-gallery-simple";
import {Badge} from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShareButton } from "@/components/shared/share-button";
import { Helmet } from "react-helmet";
import { EventDetailSkeleton } from "@/components/calendar/event-detail-skeleton";
import { SeriesOccurrencesDialog } from "@/components/calendar/series-occurrences-dialog";
import { Repeat, Link2 } from "lucide-react";
import { Link } from "wouter";


// keep existing type definitions

const formatHoursOfOperation = (hours: any) => {
  if (!hours) return "Not specified";

  const days = Object.entries(hours).map(([day, schedule]: [string, any]) => {
    if (!schedule.isOpen) return `${day}: Closed`;
    return `${day}: ${schedule.openTime} - ${schedule.closeTime}`;
  });

  return days.join('\n');
};

// Helper function to normalize contactInfo for form loading
// Converts null values to empty strings so form validation doesn't fail
const normalizeContactInfoForForm = (contactInfo: any) => {
  if (!contactInfo) return undefined;
  return {
    name: contactInfo.name ?? '',
    phone: contactInfo.phone ?? '',
    email: contactInfo.email ?? '',
    website: contactInfo.website ?? '',
  };
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  // Get return date from URL to navigate back to the same calendar position
  const urlParams = new URLSearchParams(window.location.search);
  const returnDate = urlParams.get('returnDate');
  const calendarReturnUrl = returnDate ? `/calendar?date=${returnDate}` : '/calendar';
  const { isAdmin, canInteractWithEvent, canCommentOnEvent } = usePermissions();
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [isCreateDuplicateDialogOpen, setIsCreateDuplicateDialogOpen] = useState(false);
  const [isRecurringEditDialogOpen, setIsRecurringEditDialogOpen] = useState(false);
  const [isDeleteSeriesDialogOpen, setIsDeleteSeriesDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState<'occurrence' | 'series' | null>(null);
  const [isSeriesDialogOpen, setIsSeriesDialogOpen] = useState(false);
  
  // Add mutation for deleting comments
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      console.log("Deleting comment:", commentId);
      
      // Use the apiRequest function for consistent authentication credentials handling
      const response = await apiRequest("DELETE", `/api/events/comments/${commentId}`);
      
      if (!response.ok) {
        throw new Error("Failed to delete comment");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", parseInt(id), "comments"] });
      toast({
        title: "Success",
        description: "Comment deleted successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete comment",
        variant: "destructive"
      });
    }
  });
  //Removed selectedFiles State, using mediaFiles in the form instead.

  const { data: event, isLoading: isEventLoading, error: eventError } = useQuery<EventWithChildCount>({
    queryKey: ["/api/events", parseInt(id)],
    queryFn: async () => {
      console.log("Fetching event details for:", id);
      const response = await apiRequest("GET", `/api/events/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch event details");
      }
      return response.json();
    },
  });

  const { data: interactions = [] } = useQuery<InteractionWithUser[]>({
    queryKey: ["/api/events", parseInt(id), "interactions"],
    queryFn: async () => {
      console.log("Fetching event interactions for:", id);
      const response = await apiRequest("GET", `/api/events/${id}/interactions`);
      if (!response.ok) {
        throw new Error("Failed to fetch event interactions");
      }
      return response.json();
    },
    enabled: !!event,
  });

  const { data: comments = [] } = useQuery<CommentWithUser[]>({
    queryKey: ["/api/events", parseInt(id), "comments"],
    queryFn: async () => {
      console.log("Fetching event comments for:", id);
      const response = await apiRequest("GET", `/api/events/${id}/comments`);
      if (!response.ok) {
        throw new Error("Failed to fetch event comments");
      }
      return response.json();
    },
    enabled: !!event,
  });

  const interactionMutation = useMutation({
    mutationFn: async (type: "like" | "going" | "interested") => {
      console.log("Submitting interaction:", { type, eventId: id, user: user?.id });
      
      // Use the apiRequest function instead of fetch directly to ensure
      // consistent handling of authentication credentials
      const response = await apiRequest("POST", `/api/events/${id}/interactions`, { type });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", parseInt(id), "interactions"] });
      toast({
        title: "Success",
        description: "Your interaction has been recorded",
      });
    },
    onError: (error: Error) => {
      console.error("Interaction error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to interact with event",
        variant: "destructive",
      });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      console.log("Submitting comment:", { content, eventId: id, user: user?.id });
      
      // Use the apiRequest function instead of fetch directly to ensure
      // consistent handling of authentication credentials
      const response = await apiRequest("POST", `/api/events/${id}/comments`, { content });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", parseInt(id), "comments"] });
      setComment("");
      toast({
        title: "Success",
        description: "Your comment has been posted"
      });
    },
    onError: (error: Error) => {
      console.error("Comment error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to post comment",
        variant: "destructive"
      });
    }
  });

  const updateEventMutation = useMutation({
    mutationFn: async (data: EventFormData & { existingMediaToRemove?: string[], mediaFiles?: FileList | null }) => {
      console.log("updateEventMutation.mutationFn called with data:", data);
      
      try {
        // Ensure endDate is after startDate
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        
        // If endDate is before startDate, add 1 hour to endDate
        if (endDate <= startDate) {
          const newEndDate = new Date(startDate);
          newEndDate.setHours(startDate.getHours() + 1);
          data.endDate = newEndDate;
          console.log("Adjusted endDate to be after startDate:", newEndDate);
        }
        
        const formData = new FormData();

        // Add any new media files
        if (data.mediaFiles) {
          console.log("Adding media files to FormData:", data.mediaFiles.length, "files");
          for (let i = 0; i < data.mediaFiles.length; i++) {
            formData.append('media', data.mediaFiles[i]);
          }
        }

        // Enhanced media handling - properly track which files to keep and which to remove
        const currentMediaUrls = event?.mediaUrls || [];
        
        // Ensure data.existingMediaToRemove is an array
        const mediaToRemove = Array.isArray(data.existingMediaToRemove) 
          ? data.existingMediaToRemove 
          : (typeof data.existingMediaToRemove === 'string' 
              ? [data.existingMediaToRemove] 
              : []);
        
        // Log the media removal data for debugging
        console.log("Current media URLs:", currentMediaUrls);
        console.log("Media marked for removal (raw):", data.existingMediaToRemove);
        console.log("Media marked for removal (normalized):", mediaToRemove);
        
        // Filter out media URLs that are marked for removal
        const mediaUrlsToKeep = currentMediaUrls.filter(
          url => !mediaToRemove.includes(url)
        );
        console.log("Media URLs to keep:", mediaUrlsToKeep);

        // Clean up contact info fields - for edit mode, preserve null values to allow clearing fields
        // Convert empty strings to null to signal field clearing to the server
        const cleanContactInfo = data.contactInfo ? Object.fromEntries(
          Object.entries(data.contactInfo)
            .map(([key, value]) => {
              // Convert empty/whitespace strings to null (to clear the field)
              if (typeof value === 'string' && value.trim() === '') {
                return [key, null];
              }
              // Trim non-empty string values
              return [key, value && typeof value === 'string' ? value.trim() : value];
            })
        ) : undefined;
        
        console.log('CONTACT_INFO_DEBUG - Client side cleanContactInfo:', JSON.stringify(cleanContactInfo));

        // Prepare the event data
        const eventData = {
          title: data.title.trim(),
          startDate: new Date(data.startDate).toISOString(),
          endDate: new Date(data.endDate).toISOString(),
          location: data.location.trim(),
          description: data.description?.trim() || undefined,
          category: data.category,
          businessName: data.businessName?.trim() || undefined,
          // Always send contactInfo when editing to allow clearing fields via null values
          contactInfo: cleanContactInfo,
          // Include badge required field
          badgeRequired: data.badgeRequired === true,
          // Handle the hours of operation, explicitly converting between string 'null' and actual null
          hoursOfOperation: data.hoursOfOperation === 'null' || data.hoursOfOperation === null ? 
            null : // Important: Set to real null when the hours are toggled off
            (data.hoursOfOperation ? 
              (typeof data.hoursOfOperation === 'string' ? 
                JSON.parse(data.hoursOfOperation) : 
                data.hoursOfOperation) : 
              undefined),
          mediaUrls: mediaUrlsToKeep,
          // Include the explicitly marked files for removal for server-side processing
          existingMediaToRemove: mediaToRemove,
          isRecurring: data.isRecurring,
          recurrenceFrequency: data.isRecurring && data.recurrenceFrequency ? 
            data.recurrenceFrequency.toLowerCase().replace('bi-weekly', 'biweekly') : null,
          recurrenceEndDate: data.isRecurring && data.recurrenceEndDate ? 
            new Date(data.recurrenceEndDate).toISOString() : null,
          sponsorTagline: data.category === 'platinum_sponsor' ? (data.sponsorTagline?.trim() || null) : null,
          sponsorPhone: data.category === 'platinum_sponsor' ? (data.sponsorPhone?.trim() || null) : null,
          sponsorWebsiteUrl: data.category === 'platinum_sponsor' ? (data.sponsorWebsiteUrl?.trim() || null) : null,
          sponsorVendorPageSlug: data.category === 'platinum_sponsor' ? (data.sponsorVendorPageSlug?.trim() || null) : null,
          sponsorIsPoliticalAd: data.category === 'platinum_sponsor' ? (data.sponsorIsPoliticalAd || false) : false,
          sponsorPoliticalAdText: data.category === 'platinum_sponsor' && data.sponsorIsPoliticalAd ? (data.sponsorPoliticalAdText?.trim() || undefined) : undefined,
        };
        
        console.log("Final eventData for PATCH:", { 
          ...eventData,
          hoursOfOperationRaw: data.hoursOfOperation,
          hoursOfOperationType: typeof data.hoursOfOperation,
          hoursOfOperationIsNull: data.hoursOfOperation === 'null'
        });

        // Always add existingMediaToRemove as a separate field in formData for better tracking
        // Even if it's empty, so the server knows we're checking for media removal
        console.log("Adding media removal information to FormData:", mediaToRemove);
        const removalDataString = JSON.stringify(mediaToRemove);
        formData.append('existingMediaToRemove', removalDataString);

        // Add the event data as a JSON string
        // Include the edit mode when updating recurring events OR events that are part of a recurring series
        if ((event?.isRecurring || event?.parentEventId) && editMode) {
          console.log(`Updating recurring event with mode: ${editMode}`);
          eventData.editMode = editMode;
        }

        const eventDataString = JSON.stringify(eventData);
        console.log("Adding eventData to FormData:", eventDataString.substring(0, 100) + "...");
        formData.append('eventData', eventDataString);

        console.log("Sending PATCH request to:", `/api/events/${id}`);
        // Use apiRequest for consistent authentication handling
        const response = await apiRequest({
          url: `/api/events/${id}`,
          method: 'PATCH',
          body: formData
        });

        console.log("PATCH response status:", response.status);
        
        if (!response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType?.includes("application/json")) {
            const errorData = await response.json();
            console.error("PATCH error response:", errorData);
            throw new Error(errorData.message || "Failed to update event");
          }
          throw new Error(`Failed to update event: ${response.status} ${response.statusText}`);
        }

        console.log("PATCH request successful");
        return response.json();
      } catch (error) {
        console.error("Error in updateEventMutation.mutationFn:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", parseInt(id)] });
      setIsEditDialogOpen(false);
      // setSelectedFiles([]); // Removed as selectedFiles is no longer used.
      toast({
        title: "Success",
        description: "Event updated successfully"
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

  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData & { existingMediaToRemove?: string[], mediaFiles?: FileList | null }) => {
      console.log("Creating a new event from duplicate with data:", data);
      
      try {
        // Ensure endDate is after startDate
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        
        // If endDate is before startDate, add 1 hour to endDate
        if (endDate <= startDate) {
          const newEndDate = new Date(startDate);
          newEndDate.setHours(startDate.getHours() + 1);
          data.endDate = newEndDate;
          console.log("Adjusted endDate to be after startDate:", newEndDate);
        }
        
        const formData = new FormData();

        // Add any new media files
        if (data.mediaFiles) {
          console.log("Adding media files to FormData:", data.mediaFiles.length, "files");
          for (let i = 0; i < data.mediaFiles.length; i++) {
            formData.append('media', data.mediaFiles[i]);
          }
        }

        // Clean up contact info fields - for create/duplicate, filter out empty fields
        const cleanContactInfo = data.contactInfo ? Object.fromEntries(
          Object.entries(data.contactInfo)
            .filter(([_, value]) => value && typeof value === 'string' && value.trim() !== '')
            .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
        ) : undefined;

        // Prepare the event data
        const eventData = {
          title: data.title.trim(),
          startDate: new Date(data.startDate).toISOString(),
          endDate: new Date(data.endDate).toISOString(),
          location: data.location.trim(),
          description: data.description?.trim() || undefined,
          category: data.category,
          businessName: data.businessName?.trim() || undefined,
          contactInfo: Object.keys(cleanContactInfo || {}).length > 0 ? cleanContactInfo : undefined,
          // Include badge required field
          badgeRequired: data.badgeRequired === true,
          // Handle the hours of operation, explicitly converting between string 'null' and actual null
          hoursOfOperation: data.hoursOfOperation === 'null' || data.hoursOfOperation === null ? 
            null : // Important: Set to real null when the hours are toggled off
            (data.hoursOfOperation ? 
              (typeof data.hoursOfOperation === 'string' ? 
                JSON.parse(data.hoursOfOperation) : 
                data.hoursOfOperation) : 
              undefined),
          mediaUrls: data.mediaUrls || [],
          // Handle recurring event data
          isRecurring: data.isRecurring,
          recurrenceFrequency: data.isRecurring && data.recurrenceFrequency ? 
            // Normalize frequency: convert to lowercase and replace "bi-weekly" with "biweekly"
            data.recurrenceFrequency.toLowerCase().replace('bi-weekly', 'biweekly') : null,
          recurrenceEndDate: data.isRecurring && data.recurrenceEndDate ? 
            new Date(data.recurrenceEndDate).toISOString() : null
        };
        
        console.log("Final eventData for new event:", eventData);

        // Add the event data as a JSON string
        formData.append('eventData', JSON.stringify(eventData));

        console.log("Sending POST request to create new event");
        // Use apiRequest for consistent authentication handling
        const response = await apiRequest({
          url: `/api/events`,
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType?.includes("application/json")) {
            const errorData = await response.json();
            console.error("Event creation error response:", errorData);
            throw new Error(errorData.message || "Failed to create event");
          }
          throw new Error(`Failed to create event: ${response.status} ${response.statusText}`);
        }

        console.log("Event creation successful");
        return response.json();
      } catch (error) {
        console.error("Error in createEventMutation.mutationFn:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setIsCreateDuplicateDialogOpen(false);
      toast({
        title: "Success",
        description: "Event duplicated successfully"
      });
      // Navigate to the new event page, preserving return date
      if (data && data.id) {
        setLocation(`/events/${data.id}${returnDate ? `?returnDate=${returnDate}` : ''}`);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Use apiRequest for consistent authentication handling
      const response = await apiRequest({
        url: `/api/events/${id}`,
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error("Failed to delete event");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", parseInt(id)] });
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
      setLocation(calendarReturnUrl);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation for deleting an entire recurring event series
  const deleteSeriesMutation = useMutation({
    mutationFn: async () => {
      console.log("Deleting entire event series with ID:", id);
      // Use apiRequest for consistent authentication handling
      const response = await apiRequest({
        url: `/api/events/${id}/series`,
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error("Failed to delete event series");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Success",
        description: "Event series deleted successfully",
      });
      setLocation(calendarReturnUrl);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const interestedUsers = interactions.filter(i => i.interactionType === "interested");
  const goingUsers = interactions.filter(i => i.interactionType === "going");
  const likedUsers = interactions.filter(i => i.interactionType === "like");

  const userInteraction = user && interactions.find(i => i.userId === user.id);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    try {
      // Validate the date string before creating a Date object
      const timestamp = Date.parse(dateString);
      if (isNaN(timestamp)) {
        console.error("Invalid date string:", dateString);
        return "Invalid date";
      }
      
      const dateObj = new Date(timestamp);
      // Check if date is valid after parsing
      if (isNaN(dateObj.getTime())) {
        console.error("Invalid date object after parsing:", dateString);
        return "Invalid date";
      }
      
      return format(dateObj, "PPP");
    } catch (error) {
      console.error("Date formatting error:", error, "for date string:", dateString);
      return "Invalid date";
    }
  };

  if (isEventLoading) {
    return <EventDetailSkeleton />;
  }

  if (eventError || !event) {
    return (
      <div className="text-center p-8">
        <p className="text-xl text-red-600 mb-4">Failed to load event details</p>
        <Button onClick={() => setLocation(calendarReturnUrl)}>Return to Calendar</Button>
      </div>
    );
  }

  // Prepare share content
  const shareUrl = `${window.location.origin}/events/${id}`;
  const shareTitle = event.title;
  const shareText = `Join us for ${event.title}${event.location ? ` at ${event.location}` : ''}${event.startDate ? ` on ${formatDate(event.startDate.toString())}` : ''}`;
  const shareImageUrl = event.mediaUrls && event.mediaUrls.length > 0 ? event.mediaUrls[0] : undefined;
  // react-helmet's `<title>` child is validated with an `invariant` that throws
  // "Helmet expects a string as a child of <title>. Did you forget to wrap your
  // children in a string?" whenever the child is anything other than a string
  // (or an array of only strings). The API can hand us an `event.title` that
  // is null, an empty string, or — historically — a non-string value, and the
  // previous inline template literal would still pass that straight through
  // as the JSX child. We now coerce explicitly with `String(...)` and
  // pre-compute the value outside JSX so there is exactly one string child of
  // `<title>` at render time. With Replit's runtime-error-modal plugin
  // disabled this no longer crashes the preview, but the warning itself was
  // contributing to the mobile reload loop and is fixed here too.
  const rawEventTitle = event.title;
  const safeEventTitle =
    typeof rawEventTitle === "string" && rawEventTitle.length > 0
      ? rawEventTitle
      : "Event";
  const documentTitle = `${String(safeEventTitle)} - Events`;

  return (
    <>
      <Helmet>
        <title>{documentTitle}</title>
        <meta name="description" content={event.description || shareText} />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="event" />
        <meta property="og:url" content={shareUrl} />
        <meta property="og:title" content={event.title} />
        <meta property="og:description" content={event.description || shareText} />
        {shareImageUrl && <meta property="og:image" content={shareImageUrl} />}
        {event.startDate && <meta property="event:start_time" content={new Date(event.startDate).toISOString()} />}
        {event.endDate && <meta property="event:end_time" content={new Date(event.endDate).toISOString()} />}
        {event.location && <meta property="event:location" content={event.location} />}
        
        {/* Twitter */}
        <meta name="twitter:card" content={shareImageUrl ? "summary_large_image" : "summary"} />
        <meta name="twitter:url" content={shareUrl} />
        <meta name="twitter:title" content={event.title} />
        <meta name="twitter:description" content={event.description || shareText} />
        {shareImageUrl && <meta name="twitter:image" content={shareImageUrl} />}
      </Helmet>
      
      <div className="max-w-4xl mx-auto space-y-8 p-4">
      {isAdmin && (
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-4">
          {/* Duplicate Event Button */}
          <Button
            variant="outline"
            onClick={() => setIsCreateDuplicateDialogOpen(true)}
            className="gap-2 w-full sm:w-auto text-sm sm:text-base order-3 sm:order-1 sm:mr-auto justify-start sm:justify-center"
          >
            <CalendarDays className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">Duplicate Event</span>
          </Button>
          
          {/* Alert Dialog for Recurring Event Edit Options */}
          <AlertDialog open={isRecurringEditDialogOpen} onOpenChange={setIsRecurringEditDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Edit Recurring Event</AlertDialogTitle>
                <AlertDialogDescription>
                  Would you like to edit only this occurrence or the entire series?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
                <div className="flex flex-wrap gap-2 justify-between w-full">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditMode('occurrence');
                      setIsRecurringEditDialogOpen(false);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    Edit Only Occurrence
                  </Button>
                  <Button
                    onClick={() => {
                      setEditMode('series');
                      setIsRecurringEditDialogOpen(false);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    Edit Recurring Series
                  </Button>
                </div>
                <div className="w-full border-t border-border pt-2 mt-2">
                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    onClick={() => {
                      setIsRecurringEditDialogOpen(false);
                      setIsDeleteSeriesDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Series
                  </Button>
                </div>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          {/* Alert Dialog for Delete Series Confirmation */}
          <AlertDialog open={isDeleteSeriesDialogOpen} onOpenChange={setIsDeleteSeriesDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Recurring Event Series</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the entire series? This action cannot be undone and will delete {event?.isRecurring && !event?.parentEventId && event?.childCount ? `all ${event.childCount + 1} events (1 parent + ${event.childCount} occurrence${event.childCount !== 1 ? 's' : ''})` : 'all occurrences of this event'}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteSeriesMutation.mutate()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleteSeriesMutation.isPending ? "Deleting..." : "Delete Series"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <Button
              variant="outline"
              onClick={() => {
                // Platinum sponsor child events redirect to parent for editing
                if (event?.category === 'platinum_sponsor' && event?.parentEventId) {
                  setLocation(`/events/${event.parentEventId}`);
                  return;
                }
                // Check if this is a recurring event OR part of a recurring series
                if (event?.isRecurring || event?.parentEventId) {
                  setIsRecurringEditDialogOpen(true);
                } else {
                  setEditMode(null); // Not a recurring event
                  setIsEditDialogOpen(true);
                }
              }}
              className="gap-2 w-full sm:w-auto text-sm sm:text-base order-1 sm:order-2 justify-start sm:justify-center"
            >
              <Pencil className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Edit Event</span>
            </Button>
            <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Edit Event {event?.isRecurring && editMode === 'occurrence' ? '(This Occurrence Only)' : ''}
                  {event?.isRecurring && editMode === 'series' ? '(Entire Series)' : ''}
                </DialogTitle>
                <DialogDescription>
                  Update event details. Fields marked with * are required.
                </DialogDescription>
              </DialogHeader>
              {event && (
                <CreateEventForm
                  eventId={event.id}
                  defaultValues={{
                    ...event,
                    startDate: new Date(event.startDate),
                    endDate: new Date(event.endDate),
                    // Normalize contactInfo to convert null values to empty strings for form validation
                    contactInfo: normalizeContactInfoForForm(event.contactInfo),
                    // Convert hoursOfOperation from object to string for the form
                    hoursOfOperation: event.hoursOfOperation ? 
                      JSON.stringify(event.hoursOfOperation) : 
                      null,
                    // Convert recurrenceEndDate from string to Date if it exists
                    recurrenceEndDate: event.recurrenceEndDate ? 
                      new Date(event.recurrenceEndDate) : 
                      undefined,
                    sponsorIsPoliticalAd: event.sponsorIsPoliticalAd ?? false,
                    sponsorPoliticalAdText: event.sponsorPoliticalAdText ?? "",
                  }}
                  onSubmit={(data) => {
                    console.log("Form onSubmit called in event-detail-page with data:", data);
                    updateEventMutation.mutate(data);
                  }}
                  onDuplicate={() => {
                    console.log("Duplicate button clicked, opening duplicate dialog");
                    setIsEditDialogOpen(false);
                    setIsCreateDuplicateDialogOpen(true);
                  }}
                  isSubmitting={updateEventMutation.isPending}
                />
              )}
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2 w-full sm:w-auto text-sm sm:text-base order-2 sm:order-3 justify-start sm:justify-center">
                <Trash2 className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Delete {event?.parentEventId ? 'This Occurrence' : 'Event'}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {event?.parentEventId ? 'Delete This Occurrence Only?' : event?.isRecurring ? 'Delete Entire Series?' : 'Delete Event?'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {event?.parentEventId ? (
                    <>This action cannot be undone. This will permanently delete <strong>only this occurrence</strong> from the recurring series. Other occurrences will remain unchanged.</>
                  ) : event?.isRecurring && event?.childCount ? (
                    <>This action cannot be undone. This will permanently delete the <strong>entire series</strong> including all {event.childCount + 1} events (1 parent + {event.childCount} occurrence{event.childCount !== 1 ? 's' : ''}).</>
                  ) : (
                    <>This action cannot be undone. This will permanently delete this event and remove it from the calendar.</>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleteMutation.isPending ? "Deleting..." : event?.parentEventId ? "Delete This Occurrence" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Duplicate Event Dialog */}
          <Dialog open={isCreateDuplicateDialogOpen} onOpenChange={setIsCreateDuplicateDialogOpen}>
            <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Duplicate Event</DialogTitle>
                <DialogDescription>
                  Create a copy of this event with new dates and times. All other details will be preserved.
                </DialogDescription>
              </DialogHeader>
              {event && (
                <CreateEventForm
                  defaultValues={{
                    ...event,
                    // For a duplicate, start with current dates but advance them by a day
                    startDate: new Date(new Date(event.startDate).setDate(new Date(event.startDate).getDate() + 1)),
                    endDate: new Date(new Date(event.endDate).setDate(new Date(event.endDate).getDate() + 1)),
                    // Normalize contactInfo to convert null values to empty strings for form validation
                    contactInfo: normalizeContactInfoForForm(event.contactInfo),
                    // Convert hoursOfOperation from object to string for the form
                    hoursOfOperation: event.hoursOfOperation ? 
                      JSON.stringify(event.hoursOfOperation) : 
                      null,
                    // Convert recurrenceEndDate from string to Date if it exists
                    recurrenceEndDate: event.recurrenceEndDate ? 
                      new Date(event.recurrenceEndDate) : 
                      undefined,
                    sponsorIsPoliticalAd: event.sponsorIsPoliticalAd ?? false,
                    sponsorPoliticalAdText: event.sponsorPoliticalAdText ?? "",
                  }}
                  onSubmit={(data) => {
                    console.log("Creating duplicate event with data:", data);
                    createEventMutation.mutate(data);
                  }}
                  isSubmitting={createEventMutation.isPending}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Event Information Section */}
      <Card className={`bg-white ${event.category === 'promotional' ? 'promotional-detail-card border-2 border-[#d4a017]' : event.category === 'platinum_sponsor' ? 'border-2 border-[#9CA3AF] bg-[#F9FAFB]' : ''}`}>
        <CardHeader>
          <div className="flex flex-wrap items-start gap-3">
            <CardTitle className="text-3xl break-words min-w-0 pr-4 flex-1">{event.title}</CardTitle>
            {isAdmin && (() => {
              // Parent event: recurring and has no parent
              if (event.isRecurring && !event.parentEventId) {
                const childCount = event.childCount || 0;
                return (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge 
                          variant="default" 
                          className={`gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap ${childCount > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                          data-testid="badge-parent-event-detail"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (childCount > 0) {
                              setIsSeriesDialogOpen(true);
                            }
                          }}
                        >
                          <Repeat className="h-3 w-3 flex-shrink-0" />
                          <span>Series ({childCount})</span>
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Click to view all {childCount} occurrence{childCount !== 1 ? 's' : ''}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              }

              // Child event: has a parent event ID
              if (event.parentEventId) {
                return (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={`/events/${event.parentEventId}`}>
                          <Badge 
                            variant="secondary" 
                            className="gap-1 text-xs cursor-pointer hover:bg-secondary/80 whitespace-nowrap"
                            data-testid="badge-child-event-detail"
                          >
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

              // Single event: not recurring and has no parent
              return (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant="outline" 
                        className="text-xs whitespace-nowrap"
                        data-testid="badge-single-event-detail"
                      >
                        Single
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Standalone event (not part of a series)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })()}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left side: Event Details */}
            <div className="flex-1 space-y-6">
              <div className="flex flex-col gap-4">
                {/* Hide date and time for promotional and platinum sponsor category events */}
                {event.category !== 'promotional' && event.category !== 'platinum_sponsor' && (
                  <>
                    <div className="flex items-center gap-3 text-lg">
                      <CalendarDays className="h-5 w-5 text-muted-foreground" />
                      <span>{formatDate(event.startDate?.toString())}</span>
                    </div>

                    {event.startDate && event.endDate && (
                      <div className="flex items-center gap-3 text-lg">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <span>
                          {(() => {
                            try {
                              // Parse timestamps and explicitly treat them as UTC
                              // API returns "2025-04-15T15:00:00.000Z" format
                              const startTimeStr = String(event.startDate);
                              const endTimeStr = String(event.endDate);
                              
                              // Ensure the timestamp has timezone info (Z for UTC)
                              const startUTC = startTimeStr.endsWith('Z') ? startTimeStr : startTimeStr + 'Z';
                              const endUTC = endTimeStr.endsWith('Z') ? endTimeStr : endTimeStr + 'Z';
                              
                              const startTime = new Date(startUTC);
                              const endTime = new Date(endUTC);
                              
                              // Validate both dates before formatting
                              if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                                return null;
                              }
                              
                              // Display times in Florida/Eastern Time (America/New_York) for all users
                              // This ensures events always show in the local time where they occur (Barefoot Bay, FL)
                              // formatInTimeZone will convert from UTC to ET properly
                              const FLORIDA_TZ = 'America/New_York';
                              return `${formatInTimeZone(startTime, FLORIDA_TZ, "h:mm a")} - ${formatInTimeZone(endTime, FLORIDA_TZ, "h:mm a")}`;
                            } catch (error) {
                              return null;
                            }
                          })()}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {event.location && (
                  <div className="flex items-center gap-3 text-lg">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <span>{event.location}</span>
                  </div>
                )}
                
                {/* Add website field below location */}
                {event.contactInfo?.website && (
                  <div className="flex items-center gap-3 text-lg">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <a href={event.contactInfo.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline hover:text-blue-800">
                      {event.contactInfo.website}
                    </a>
                  </div>
                )}
                
                {/* Badge Required Indicator */}
                <div className="flex items-center gap-3 text-lg mt-2">
                  {event.badgeRequired ? (
                    <>
                      <CreditCard className="h-5 w-5 text-primary" />
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-primary text-white border-primary/20 font-medium px-2">
                          Badge Required
                        </Badge>
                      </span>
                    </>
                  ) : (
                    <>
                      <BanIcon className="h-5 w-5 text-muted-foreground" />
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-muted text-muted-foreground border-muted/30 font-medium px-2">
                          No Badge Required
                        </Badge>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {event.description && (
                <div className={`mt-6 ${event.category === 'promotional' ? 'promotional-float' : ''}`}>
                  <h3 className="text-lg font-semibold mb-2">Description</h3>
                  <p className="text-lg">{event.description}</p>
                </div>
              )}

              {/* Only show Hours of Operation if it was explicitly set (not hidden) */}
              {event.hoursOfOperation !== null &&
                typeof event.hoursOfOperation === 'object' &&
                Object.keys(event.hoursOfOperation).length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-2">Hours of Operation</h3>
                    <div className="whitespace-pre-line">
                      {formatHoursOfOperation(event.hoursOfOperation)}
                    </div>
                  </div>
                )}
            </div>

            {/* Right side: Map and Media Gallery */}
            <div className="lg:w-1/3 space-y-6">
              {/* Map Section */}
              {event.location && (
                <div>
                  {event.category === 'promotional' ? (
                    <Badge 
                      variant="secondary" 
                      className="mb-4 bg-[#FFF3CD] border border-[#F1E1BA] text-[#111827] font-bold text-base"
                    >
                      Promotional
                    </Badge>
                  ) : event.category === 'platinum_sponsor' ? (
                    <Badge 
                      variant="secondary" 
                      className="mb-4 bg-[#E5E7EB] border border-[#9CA3AF] text-[#111827] font-bold text-base"
                    >
                      Platinum Sponsor
                    </Badge>
                  ) : (
                    <Badge 
                      variant="secondary" 
                      className={`mb-4 ${
                        event.category === 'entertainment' 
                          ? 'bg-[#7FD7C6] border border-[#5FC4B1] text-[#111827]' 
                          : event.category === 'government'
                          ? 'bg-[#6FA8DC] border border-[#4F93D3] text-[#111827]'
                          : event.category === 'social'
                          ? 'bg-[#F6D8A8] border border-[#EBC28B] text-[#111827]'
                          : event.category === 'bulletin'
                          ? 'bg-[#C9C3E6] border border-[#B3AADF] text-[#111827]'
                          : 'bg-[#FDFEFE] border border-[#E7EAEE] text-[#111827]'
                      } font-bold text-base`}
                    >
                      {event.category === 'entertainment' 
                        ? 'Entertainment & Activities'
                        : event.category === 'government'
                        ? 'Government & Politics'
                        : event.category === 'social'
                        ? 'Social Clubs'
                        : event.category === 'bulletin'
                        ? 'Bulletin'
                        : 'Other'}
                    </Badge>
                  )}
                  <h3 className="text-lg font-semibold mb-4">Location</h3>
                  <LocationMapAlt
                    location={event.location}
                    className="w-full h-[200px]"
                  />
                </div>
              )}

              {/* Media Gallery Section */}
              {event.mediaUrls && event.mediaUrls.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Photos & Videos</h3>
                  <EventMediaGallerySimple mediaUrls={event.mediaUrls} />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information Section */}
      {(event.businessName || event.contactInfo) && (
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <CardTitle>Contact Information</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="show-contact-info" className="text-sm text-muted-foreground whitespace-nowrap">
                  {showContactInfo ? (
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      <span>Show</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <EyeOff className="h-4 w-4" />
                      <span>Hide</span>
                    </div>
                  )}
                </Label>
                <Switch
                  id="show-contact-info"
                  checked={showContactInfo}
                  onCheckedChange={setShowContactInfo}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {event.businessName && (
              <div className="flex items-center gap-3 text-lg">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <span>{event.businessName}</span>
              </div>
            )}

            {event.contactInfo?.name && (
              <div className="flex items-center gap-3 text-lg">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span>{event.contactInfo.name}</span>
              </div>
            )}

            {event.contactInfo?.phone && (
              <div className="flex items-center gap-3 text-lg">
                <Phone className="h-5 w-5 text-muted-foreground" />
                {showContactInfo ? (
                  <a href={`tel:${event.contactInfo.phone}`} className="hover:underline">
                    {event.contactInfo.phone}
                  </a>
                ) : (
                  <span>••••••••••</span>
                )}
              </div>
            )}

            {event.contactInfo?.email && (
              <div className="flex items-center gap-3 text-lg">
                <Mail className="h-5 w-5 text-muted-foreground" />
                {showContactInfo ? (
                  <a href={`mailto:${event.contactInfo.email}`} className="hover:underline">
                    {event.contactInfo.email}
                  </a>
                ) : (
                  <span>••••••••••</span>
                )}
              </div>
            )}

            {/* Website field moved to main event information section */}
          </CardContent>
        </Card>
      )}

      {/* Interaction Buttons Section */}
      <div className="space-y-6">
        <div className="flex flex-wrap gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant={userInteraction?.interactionType === "like" ? "default" : "outline"}
                    className="text-lg py-6 px-8"
                    onClick={() => interactionMutation.mutate("like")}
                    disabled={!user || interactionMutation.isPending || (user && !canInteractWithEvent && !isAdmin)}
                  >
                    <ThumbsUp className="mr-2" />
                    Like ({likedUsers.length})
                  </Button>
                </span>
              </TooltipTrigger>
              {user && !canInteractWithEvent && !isAdmin && (
                <TooltipContent className="max-w-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <p>This feature requires a specific membership level.</p>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant={userInteraction?.interactionType === "going" ? "default" : "outline"}
                    className="text-lg py-6 px-8"
                    onClick={() => interactionMutation.mutate("going")}
                    disabled={!user || interactionMutation.isPending || (user && !canInteractWithEvent && !isAdmin)}
                  >
                    <Users className="mr-2" />
                    I'm Going ({goingUsers.length})
                  </Button>
                </span>
              </TooltipTrigger>
              {user && !canInteractWithEvent && !isAdmin && (
                <TooltipContent className="max-w-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <p>This feature requires a specific membership level.</p>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant={userInteraction?.interactionType === "interested" ? "default" : "outline"}
                    className="text-lg py-6 px-8"
                    onClick={() => interactionMutation.mutate("interested")}
                    disabled={!user || interactionMutation.isPending || (user && !canInteractWithEvent && !isAdmin)}
                  >
                    <Users className="mr-2" />
                    Interested ({interestedUsers.length})
                  </Button>
                </span>
              </TooltipTrigger>
              {user && !canInteractWithEvent && !isAdmin && (
                <TooltipContent className="max-w-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <p>This feature requires a specific membership level.</p>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Share Button - Available to all users */}
        <div className="flex justify-center sm:justify-start mt-4">
          <ShareButton
            title={shareTitle}
            text={shareText}
            url={shareUrl}
            imageUrl={shareImageUrl}
            startDate={event.startDate ? new Date(event.startDate) : undefined}
            endDate={event.endDate ? new Date(event.endDate) : undefined}
            description={event.description || undefined}
            location={event.location || undefined}
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            buttonText="Share Event"
            dialogTitle="Share Event"
            dialogDescription="Share this event with your friends and community"
            isEvent={true}
          />
        </div>

        {interactions.length > 0 && (
          <UserAvatarCarousel interactions={interactions} />
        )}
      </div>

      {/* Comments Section */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comments ({comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {user ? (
            user && !canCommentOnEvent && !isAdmin ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <p className="font-medium text-amber-800">Commenting Restricted</p>
                </div>
                <p className="text-amber-700">
                  This feature requires a specific membership level to access. {user.isBlocked && user.blockReason ? ` Reason: ${user.blockReason}` : ''}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Textarea
                  placeholder="Write a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="text-lg"
                />
                <Button
                  onClick={() => commentMutation.mutate(comment)}
                  disabled={!comment.trim() || commentMutation.isPending}
                  className="text-lg py-6"
                >
                  Post Comment
                </Button>
              </div>
            )
          ) : (
            <p className="text-muted-foreground">Please login to comment</p>
          )}

          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-4">
                <div className="flex-shrink-0">
                  {comment.user ? (
                    <UserAvatar 
                      user={comment.user}
                      size="md"
                      showBadge={true}
                      inComments={true}
                    />
                  ) : (
                    <Avatar>
                      <AvatarFallback>?</AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{comment.user?.username ?? 'Anonymous'}</p>
                      <span className="text-sm text-muted-foreground">•</span>
                      <p className="text-sm text-muted-foreground">
                        {comment.createdAt ? format(new Date(comment.createdAt), "PPp") : ""}
                      </p>
                    </div>
                    {isAdmin && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-auto"
                              onClick={() => deleteCommentMutation.mutate(comment.id)}
                              disabled={deleteCommentMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete comment</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <p className="mt-2 text-gray-700">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Series Occurrences Dialog */}
      {event.isRecurring && !event.parentEventId && (
        <SeriesOccurrencesDialog
          open={isSeriesDialogOpen}
          onOpenChange={setIsSeriesDialogOpen}
          parentEventId={event.id}
          parentEventTitle={event.title}
        />
      )}
    </div>
    </>
  );
}