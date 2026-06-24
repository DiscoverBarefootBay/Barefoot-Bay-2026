import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocationPickerAlt } from "@/components/calendar/location-picker-alt";
import { HoursOperationPicker } from "@/components/calendar/hours-operation-picker";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";


// Define recurrence frequency types for frontend
const RecurrenceFrequency = {
  DAILY: "daily",
  WEEKLY: "weekly",
  BIWEEKLY: "biweekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
} as const;

// Update the schema to include recurring event fields
const eventFormSchema = z.object({
  // Required fields - no changes
  title: z.string().min(1, "Event title is required"),
  startDate: z.date(),
  endDate: z.date(),
  location: z.string().min(1, "Location is required"),
  category: z.enum(["entertainment", "government", "social", "promotional", "bulletin", "platinum_sponsor"]),

  // Optional fields
  description: z.string().nullable().optional(),
  businessName: z.string().nullable().optional(),
  badgeRequired: z.boolean().default(true), // Whether a membership badge is required (default to true)
  contactInfo: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    website: z.string().optional().refine(
      (val) => !val || val.trim() === '' || /^https?:\/\/.+/.test(val),
      { message: "Website must be a valid URL starting with http:// or https://" }
    )
  }).optional(),
  hoursOfOperation: z.any().nullable().optional(), // Accept string (from backend), object (from component), null, or undefined
  mediaUrls: z.array(z.string()).optional(),
  existingMediaToRemove: z.array(z.string()).optional(),
  
  // Recurring event fields
  isRecurring: z.boolean().default(false),
  recurrenceFrequency: z.enum([
    RecurrenceFrequency.DAILY,
    RecurrenceFrequency.WEEKLY,
    RecurrenceFrequency.BIWEEKLY,
    RecurrenceFrequency.MONTHLY,
    RecurrenceFrequency.YEARLY
  ]).optional().nullable(),
  recurrenceEndDate: z.date().optional().nullable(),
  
  sponsorTagline: z.string().nullable().optional(),
  sponsorPhone: z.string().nullable().optional(),
  sponsorWebsiteUrl: z.string().nullable().optional(),
  sponsorVendorPageSlug: z.string().nullable().optional(),
  sponsorIsPoliticalAd: z.boolean().nullable().optional(),
  sponsorPoliticalAdText: z.string().nullable().optional(),
}).refine((data) => {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  return endDate > startDate;
}, {
  message: "End date must be after start date",
  path: ["endDate"],
}).refine((data) => {
  // If it's a recurring event, frequency and end date are required
  if (data.isRecurring) {
    return !!data.recurrenceFrequency && !!data.recurrenceEndDate;
  }
  return true;
}, {
  message: "Recurring events must have a frequency and end date",
  path: ["recurrenceEndDate"],
});

export type EventFormData = z.infer<typeof eventFormSchema>;

const defaultHours = {
  Monday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Tuesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Wednesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Thursday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Friday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Saturday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Sunday: { isOpen: true, openTime: "09:00", closeTime: "17:00" }
};

type Props = {
  eventId?: number; // If provided, the form is in update mode
  defaultValues?: Partial<EventFormData>;
  onSubmit: (data: EventFormData & { mediaFiles?: FileList | null }) => Promise<void>;
  onDuplicate?: () => void; // Optional callback for duplicating an event
  isSubmitting?: boolean;
  isDuplicating?: boolean; // Flag to indicate if a duplication process is in progress
};

export function CreateEventForm({ eventId, defaultValues, onSubmit, onDuplicate, isSubmitting, isDuplicating }: Props) {
  const [existingMediaToRemove, setExistingMediaToRemove] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [vendorSearchText, setVendorSearchText] = useState("");
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);

  const { data: vendorPages = [] } = useQuery<{ id: number; slug: string; title: string }[]>({
    queryKey: ["/api/pages", "vendors"],
    queryFn: async () => {
      const res = await fetch("/api/pages?type=vendors");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const vendorOptions = useMemo(() => {
    return vendorPages.map((v) => ({
      slug: v.slug,
      title: v.title,
    })).sort((a, b) => a.title.localeCompare(b.title));
  }, [vendorPages]);

  // Normalize contactInfo to convert null values to empty strings for form validation
  // This prevents "Expected string, received null" errors when loading events with null contact fields
  const normalizedContactInfo = defaultValues?.contactInfo ? {
    name: defaultValues.contactInfo.name ?? '',
    phone: defaultValues.contactInfo.phone ?? '',
    email: defaultValues.contactInfo.email ?? '',
    website: defaultValues.contactInfo.website ?? '',
  } : undefined;

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      startDate: new Date(),
      endDate: new Date(),
      category: "entertainment",
      businessName: "",
      badgeRequired: true, // Default to true - most events require a badge
      contactInfo: {
        name: "",
        phone: "",
        email: "",
        website: ""
      },
      hoursOfOperation: undefined,
      mediaUrls: [],
      existingMediaToRemove: [],
      isRecurring: false,
      recurrenceFrequency: undefined,
      recurrenceEndDate: undefined,
      sponsorTagline: "",
      sponsorPhone: "",
      sponsorWebsiteUrl: "",
      sponsorVendorPageSlug: "",
      sponsorIsPoliticalAd: false,
      sponsorPoliticalAdText: "",
      ...defaultValues,
      // Override contactInfo with normalized version (after spread to ensure it takes precedence)
      contactInfo: normalizedContactInfo ?? {
        name: "",
        phone: "",
        email: "",
        website: ""
      }
    }
  });
  
  // Initialize the existingMediaToRemove state with the form's value
  useEffect(() => {
    const formMediaToRemove = form.getValues().existingMediaToRemove || [];
    setExistingMediaToRemove(formMediaToRemove);
    console.log("Initialized existingMediaToRemove:", formMediaToRemove);
  }, []);
  
  // Reset existingMediaToRemove when default values change (e.g., when a different event is loaded)
  useEffect(() => {
    if (defaultValues) {
      setExistingMediaToRemove([]);
      // Also update the form value
      form.setValue('existingMediaToRemove', []);
      console.log("Reset existingMediaToRemove due to defaultValues change");
    }
  }, [defaultValues, form]);
  
  // Initialize with the defaultValues to ensure they're loaded properly
  useEffect(() => {
    if (defaultValues?.mediaUrls) {
      form.setValue('mediaUrls', defaultValues.mediaUrls);
    }
  }, [defaultValues, form]);

  const watchedCategory = form.watch("category");
  useEffect(() => {
    if (watchedCategory === 'platinum_sponsor' && !defaultValues?.category) {
      const startDate = form.getValues("startDate");
      const start = startDate instanceof Date ? startDate : new Date(startDate);
      if (!isNaN(start.getTime())) {
        const endDate = new Date(start);
        endDate.setMonth(endDate.getMonth() + 3);
        form.setValue("endDate", endDate);
      }
      const currentTagline = form.getValues("sponsorTagline");
      if (!currentTagline) {
        form.setValue("sponsorTagline", "Supports the Barefoot Bay Community");
      }
    }
  }, [watchedCategory, form, defaultValues]);

  const watchedStartDate = form.watch("startDate");
  useEffect(() => {
    if (watchedCategory === 'platinum_sponsor') {
      const start = watchedStartDate instanceof Date ? watchedStartDate : new Date(watchedStartDate);
      if (!isNaN(start.getTime())) {
        const currentEndDate = form.getValues("endDate");
        const end = currentEndDate instanceof Date ? currentEndDate : new Date(currentEndDate);
        if (isNaN(end.getTime()) || end <= start) {
          const newEndDate = new Date(start);
          newEndDate.setMonth(newEndDate.getMonth() + 3);
          form.setValue("endDate", newEndDate);
        }
      }
    }
  }, [watchedStartDate, watchedCategory, form]);

  const handleSubmit = async (data: EventFormData) => {
    console.log("Create event form handleSubmit called with data:", data);
    
    // Force update existingMediaToRemove in the form data
    form.setValue('existingMediaToRemove', existingMediaToRemove);
    
    // Create a properly typed contact info object - making sure it matches the expected schema
    // When editing (eventId is present), we need to preserve empty strings as null to allow clearing fields
    const isEditing = !!eventId;
    
    const rawContactInfo = data.contactInfo ? {
      name: data.contactInfo.name?.trim() || (isEditing ? null : undefined),
      phone: data.contactInfo.phone?.trim() || (isEditing ? null : undefined),
      email: data.contactInfo.email?.trim() || (isEditing ? null : undefined),
      website: data.contactInfo.website?.trim() || (isEditing ? null : undefined)
    } : undefined;
    
    // For editing mode, keep all fields (including nulls) to allow clearing
    // For create mode, filter out undefined values to detect if contactInfo is empty
    const cleanContactInfo = rawContactInfo ? 
      (isEditing 
        ? rawContactInfo  // Keep all fields when editing to allow clearing
        : Object.fromEntries(
            Object.entries(rawContactInfo).filter(([_, value]) => value !== undefined)
          )
      ) : undefined;

    // Enhanced debugging for media handling
    console.log("Media URLs in form:", data.mediaUrls);
    console.log("Media files selected:", selectedFiles ? selectedFiles.length : 0);
    console.log("Media to remove from state var:", existingMediaToRemove);
    console.log("Media to remove from form data:", form.getValues().existingMediaToRemove);
    
    // Re-get the form values after the forced update
    const updatedFormValues = form.getValues();

    // Sanitize all data including recurring event fields
    const sanitizedData = {
      ...updatedFormValues, // Use the updated form values that include the forced existingMediaToRemove update
      title: data.title.trim(),
      location: data.location.trim(),
      description: data.description?.trim() || undefined,
      businessName: data.businessName?.trim() || undefined,
      badgeRequired: data.badgeRequired ?? true, // Default to true if not explicitly set
      // Explicitly set contactInfo from cleaned data (not from updatedFormValues) to allow clearing fields
      // In edit mode, always send contactInfo (even with null values) to allow clearing fields
      contactInfo: isEditing ? cleanContactInfo : (cleanContactInfo && Object.keys(cleanContactInfo).length > 0 ? cleanContactInfo : undefined),
      // Handle the hours of operation properly - critical for toggle state persistence
      // Check if it's already an object (from HoursOperationPicker) or a string that needs parsing
      hoursOfOperation: !data.hoursOfOperation || data.hoursOfOperation === '' ? 
        null : // Empty or undefined value
        (typeof data.hoursOfOperation === 'string' ? 
          (() => {
            try {
              return JSON.parse(data.hoursOfOperation);
            } catch (error) {
              console.error("Failed to parse hoursOfOperation JSON:", error);
              return null; // Fallback to null if parsing fails
            }
          })() : data.hoursOfOperation),
      // Recurring event fields - properly handle undefined values for server
      isRecurring: data.isRecurring || false,
      recurrenceFrequency: data.isRecurring ? data.recurrenceFrequency : undefined,
      recurrenceEndDate: data.isRecurring && data.recurrenceEndDate ? 
        data.recurrenceEndDate : undefined,
      // Media fields - critical for proper media handling
      mediaUrls: data.mediaUrls || [],
      // Use the state variable directly to ensure the latest value is used
      existingMediaToRemove: existingMediaToRemove,
      mediaFiles: selectedFiles,
      // Platinum sponsor fields
      sponsorTagline: data.category === 'platinum_sponsor' ? (data.sponsorTagline?.trim() || undefined) : undefined,
      sponsorPhone: data.category === 'platinum_sponsor' ? (data.sponsorPhone?.trim() || undefined) : undefined,
      sponsorWebsiteUrl: data.category === 'platinum_sponsor' ? (data.sponsorWebsiteUrl?.trim() || undefined) : undefined,
      sponsorVendorPageSlug: data.category === 'platinum_sponsor' ? (data.sponsorVendorPageSlug?.trim() || undefined) : undefined,
      sponsorIsPoliticalAd: data.category === 'platinum_sponsor' ? (data.sponsorIsPoliticalAd || false) : undefined,
      sponsorPoliticalAdText: data.category === 'platinum_sponsor' && data.sponsorIsPoliticalAd ? (data.sponsorPoliticalAdText?.trim() || undefined) : undefined,
    };

    console.log("Submitting event with sanitized data:", sanitizedData);
    
    // Call the onSubmit prop function
    try {
      await onSubmit(sanitizedData);
      console.log("onSubmit called successfully");
    } catch (error) {
      console.error("Error in onSubmit:", error);
      throw error; // Re-throw to let React Hook Form handle the error
    }
  };

  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit(handleSubmit, (errors) => {
          console.error("Form validation errors:", JSON.stringify(errors, null, 2));
          const errorMessages = Object.entries(errors).map(([field, error]) => {
            const msg = (error as any)?.message || (error as any)?.type || 'Invalid';
            return `${field}: ${msg}`;
          });
          if (errorMessages.length > 0) {
            alert("Please fix the following errors:\n\n" + errorMessages.join("\n"));
          }
        })} 
        className="space-y-8">
        {/* Required Fields Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold">Event Information</h3>
            
            {/* Duplicate button at the top of the form */}
            {defaultValues && onDuplicate && (
              <Button
                type="button"
                variant="outline"
                disabled={isDuplicating}
                className="min-w-[100px]"
                onClick={() => {
                  console.log("Duplicate button clicked");
                  if (onDuplicate) onDuplicate();
                }}
              >
                {isDuplicating ? "Duplicating..." : "Duplicate Event"}
              </Button>
            )}
          </div>

          {/* Event Title */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="after:content-['*'] after:ml-0.5 after:text-red-500">Event Title</FormLabel>
                <FormControl>
                  <Input placeholder="Enter event title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date and Time Fields */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => {
                const FLORIDA_TZ = 'America/New_York';
                const floridaTimeStr = formatInTimeZone(field.value, FLORIDA_TZ, "yyyy-MM-dd'T'HH:mm");
                
                return (
                  <FormItem>
                    <FormLabel className="after:content-['*'] after:ml-0.5 after:text-red-500">
                      Start Date & Time (Florida Time)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        value={floridaTimeStr}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          if (!inputValue) return;
                          
                          const [datePart, timePart] = inputValue.split('T');
                          if (!datePart || !timePart) return;
                          
                          const [year, month, day] = datePart.split('-').map(Number);
                          const [hours, minutes] = timePart.split(':').map(Number);
                          
                          const estOffset = new Date(year, month - 1, day).toLocaleString('en-US', {
                            timeZone: FLORIDA_TZ,
                            timeZoneName: 'short'
                          }).includes('EST') ? -5 : -4;
                          
                          const correctDate = new Date(Date.UTC(year, month - 1, day, hours - estOffset, minutes, 0));
                          field.onChange(correctDate);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => {
                const FLORIDA_TZ = 'America/New_York';
                const floridaTimeStr = formatInTimeZone(field.value, FLORIDA_TZ, "yyyy-MM-dd'T'HH:mm");
                
                return (
                  <FormItem>
                    <FormLabel className="after:content-['*'] after:ml-0.5 after:text-red-500">
                      End Date & Time (Florida Time)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        value={floridaTimeStr}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          if (!inputValue) return;
                          
                          const [datePart, timePart] = inputValue.split('T');
                          if (!datePart || !timePart) return;
                          
                          const [year, month, day] = datePart.split('-').map(Number);
                          const [hours, minutes] = timePart.split(':').map(Number);
                          
                          const estOffset = new Date(year, month - 1, day).toLocaleString('en-US', {
                            timeZone: FLORIDA_TZ,
                            timeZoneName: 'short'
                          }).includes('EST') ? -5 : -4;
                          
                          const correctDate = new Date(Date.UTC(year, month - 1, day, hours - estOffset, minutes, 0));
                          field.onChange(correctDate);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          </div>

          {/* Location Field */}
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="after:content-['*'] after:ml-0.5 after:text-red-500">Location</FormLabel>
                <FormControl>
                  <LocationPickerAlt
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                    }}
                    placeholder="Enter address or business name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Category Field */}
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="after:content-['*'] after:ml-0.5 after:text-red-500">Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="entertainment" className="text-white bg-[#00cc00]">Entertainment</SelectItem>
                    <SelectItem value="government" className="text-white bg-[#47759a]">Government</SelectItem>
                    <SelectItem value="social" className="text-black bg-[#e9dfe0]">Social Clubs</SelectItem>
                    <SelectItem value="promotional" className="text-[#111827] bg-[#FFF3CD] border border-[#F1E1BA] animate-gold-shine">Promotional</SelectItem>
                    <SelectItem value="bulletin" className="text-white bg-[#9ca3af]">Bulletin</SelectItem>
                    <SelectItem value="platinum_sponsor" className="text-[#111827] bg-[#E5E7EB] border border-[#9CA3AF] font-bold">Platinum Sponsor</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.watch("category") === "platinum_sponsor" && (
            <div className="border-2 border-[#9CA3AF] rounded-lg p-4 bg-[#F9FAFB] space-y-4">
              <h3 className="text-lg font-bold text-[#6B7280]">Platinum Sponsor Details</h3>
              <FormField
                control={form.control}
                name="sponsorTagline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tagline</FormLabel>
                    <FormControl>
                      <Input placeholder='e.g. "Supports the Barefoot Bay Community"' {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sponsorPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. (772) 555-1234" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sponsorWebsiteUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.example.com" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sponsorVendorPageSlug"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Vendor Page</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          placeholder="Type to search vendor pages..."
                          value={field.value
                            ? (vendorOptions.find((v) => v.slug === field.value)?.title || field.value)
                            : vendorSearchText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVendorSearchText(val);
                            setVendorDropdownOpen(val.length > 0);
                            if (field.value) {
                              field.onChange("");
                            }
                          }}
                          onFocus={() => {
                            if (!field.value && vendorSearchText.length > 0) {
                              setVendorDropdownOpen(true);
                            }
                            if (!field.value && vendorSearchText.length === 0) {
                              setVendorSearchText("");
                              setVendorDropdownOpen(true);
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => setVendorDropdownOpen(false), 200);
                          }}
                        />
                      </FormControl>
                      {vendorDropdownOpen && !field.value && (
                        <div className="absolute z-50 w-full mt-1 max-h-[200px] overflow-y-auto rounded-md border bg-white shadow-lg">
                          {vendorOptions
                            .filter((v) => v.title.toLowerCase().includes(vendorSearchText.toLowerCase()))
                            .map((vendor) => (
                              <div
                                key={vendor.slug}
                                className="flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  field.onChange(vendor.slug);
                                  setVendorSearchText("");
                                  setVendorDropdownOpen(false);
                                }}
                              >
                                {vendor.title}
                              </div>
                            ))}
                          {vendorOptions.filter((v) => v.title.toLowerCase().includes(vendorSearchText.toLowerCase())).length === 0 && (
                            <div className="px-3 py-2 text-sm text-muted-foreground">No vendor pages found.</div>
                          )}
                        </div>
                      )}
                    </div>
                    <FormDescription>Link to an existing vendor page on BarefootBay.com</FormDescription>
                    {field.value && (
                      <button
                        type="button"
                        onClick={() => {
                          field.onChange("");
                          setVendorSearchText("");
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground underline self-start"
                      >
                        Clear selection
                      </button>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sponsorIsPoliticalAd"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer">Political advertisement</FormLabel>
                      <FormDescription>Check this box if this sponsorship is a political advertisement</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              {form.watch("sponsorIsPoliticalAd") && (
                <FormField
                  control={form.control}
                  name="sponsorPoliticalAdText"
                  render={({ field }) => (
                    <FormItem className="mt-3 ml-7">
                      <FormLabel>Political Ad Disclaimer</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Political advertisement paid for and approved by..."
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>This disclaimer will appear on the sponsor banner and in email notifications</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          )}

          {/* Optional Section */}
          <div className="border-t pt-6">
            <h3 className="text-xl font-semibold mb-4">Optional Information</h3>
          </div>

          {/* Description Field */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter event description"
                    className="min-h-[100px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Business Name */}
          <FormField
            control={form.control}
            name="businessName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business/Amenity Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter business or amenity name"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Badge Required Toggle */}
          <FormField
            control={form.control}
            name="badgeRequired"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5 mobile-toggle-text">
                  <FormLabel className="text-base mobile-toggle-label">Badge Required?</FormLabel>
                  <FormDescription className="mobile-toggle-description">
                    Toggle to indicate if a Barefoot Bay membership badge is required for this event
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Contact Information */}
          <div>
            <div className="mb-4">
              <h4 className="text-sm font-medium">Contact Information</h4>
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="contactInfo.name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter contact name"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactInfo.phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(555) 555-5555"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactInfo.email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="contact@example.com"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactInfo.website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="https://example.com"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => {
                          field.onChange(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Hours of Operation section */}
          <FormField
            control={form.control}
            name="hoursOfOperation"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <HoursOperationPicker
                    value={field.value || ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Recurring Event Section */}
          <div className="border-t pt-4">
            <div className="mb-4">
              <h4 className="text-sm font-medium">Recurring Event</h4>
            </div>
            
            {/* Is Recurring Toggle */}
            <FormField
              control={form.control}
              name="isRecurring"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5 mobile-toggle-text">
                    <FormLabel className="text-base mobile-toggle-label">Recurring Event</FormLabel>
                    <FormDescription className="mobile-toggle-description">
                      Set this event to repeat at regular intervals
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        console.log("Recurring toggle changed to:", checked);
                        // Explicitly mark the form as dirty when recurring toggle changes
                        form.setValue("isRecurring", checked, { 
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true 
                        });
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            {/* Recurrence Frequency Field - Only shown when isRecurring is true */}
            {form.watch("isRecurring") && (
              <div className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="recurrenceFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repeat Frequency</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          console.log("Recurrence frequency changed to:", value);
                          // Explicitly mark the form as dirty when frequency changes
                          form.setValue("recurrenceFrequency", value as any, { 
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true 
                          });
                        }} 
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={RecurrenceFrequency.DAILY}>Daily</SelectItem>
                          <SelectItem value={RecurrenceFrequency.WEEKLY}>Weekly</SelectItem>
                          <SelectItem value={RecurrenceFrequency.BIWEEKLY}>Biweekly</SelectItem>
                          <SelectItem value={RecurrenceFrequency.MONTHLY}>Monthly</SelectItem>
                          <SelectItem value={RecurrenceFrequency.YEARLY}>Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Recurrence End Date Field */}
                <FormField
                  control={form.control}
                  name="recurrenceEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Recurring Events On</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                          onChange={(e) => {
                            const date = e.target.value ? new Date(e.target.value) : undefined;
                            console.log("Recurrence end date changed to:", date);
                            // Explicitly mark the form as dirty when end date changes
                            form.setValue("recurrenceEndDate", date, { 
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true 
                            });
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>

          {/* Media Upload Section */}
          <FormField
            control={form.control}
            name="mediaUrls"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event Photos & Videos</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={(e) => {
                      if (e.target.files) {
                        setSelectedFiles(e.target.files);
                        field.onChange([]);
                      }
                    }}
                  />
                </FormControl>
                {field.value && field.value.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">Current Media:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {field.value.map((url, index) => {
                        // Convert Object Storage URLs to storage proxy URLs for preview
                        const previewUrl = url.includes('object-storage.replit.app') 
                          ? url.replace('https://object-storage.replit.app/CALENDAR/events/', '/api/storage-proxy/CALENDAR/events/')
                          : url;
                        
                        return (
                          <div key={index} className="relative group">
                            <img
                              src={previewUrl}
                              alt={`Media ${index + 1}`}
                              className="w-full h-24 object-cover rounded-md"
                              onError={(e) => {
                                // Fallback to original URL if proxy fails
                                const target = e.target as HTMLImageElement;
                                if (target.src !== url) {
                                  target.src = url;
                                }
                              }}
                            />
                            <button
                            type="button"
                            onClick={() => {
                              console.log(`Marking media for removal: ${url}`);
                              
                              // Add this URL to the list of media to remove
                              const updatedMediaToRemove = [...existingMediaToRemove, url];
                              setExistingMediaToRemove(updatedMediaToRemove);
                              
                              // Update the form's mediaUrls field to reflect the removal
                              const currentMediaUrls = form.getValues().mediaUrls || [];
                              const updatedMediaUrls = currentMediaUrls.filter(u => u !== url);
                              
                              // Update form state for both fields
                              field.onChange(updatedMediaUrls);
                              form.setValue('existingMediaToRemove', updatedMediaToRemove);
                              
                              // Synchronize form value with the state variable
                              setTimeout(() => {
                                const formStateValue = form.getValues().existingMediaToRemove || [];
                                console.log("Form state existingMediaToRemove:", formStateValue);
                                
                                // Ensure they're in sync
                                if (JSON.stringify(formStateValue) !== JSON.stringify(updatedMediaToRemove)) {
                                  console.log("Re-syncing form state with component state");
                                  form.setValue('existingMediaToRemove', updatedMediaToRemove);
                                }
                              }, 0);
                              
                              console.log("Media URLs after removal:", updatedMediaUrls);
                              console.log("Media to remove list:", updatedMediaToRemove);
                              console.log("Form values after update:", form.getValues());
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Submit Button */}
        <div className="pt-6 space-x-2 flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[100px]"
            onClick={() => {
              console.log("=== FORM SUBMISSION DEBUG ===");
              console.log("Submit button clicked");
              console.log("Form valid:", form.formState.isValid);
              console.log("Form errors:", form.formState.errors);
              console.log("Form values:", form.getValues());
              console.log("Form dirty:", form.formState.isDirty);
              console.log("Form submitting:", isSubmitting);
              
              if (Object.keys(form.formState.errors).length > 0) {
                console.error("VALIDATION ERRORS PREVENTING SUBMISSION:");
                Object.entries(form.formState.errors).forEach(([field, error]) => {
                  console.error(`  Field: ${field}`);
                  console.error(`  Error type:`, error?.type);
                  console.error(`  Error message:`, error?.message);
                  console.error(`  Full error object:`, JSON.stringify(error, null, 2));
                });
              } else {
                console.log("No validation errors found in form.formState.errors");
              }
              
              // Also manually trigger validation and log results
              form.trigger().then((isValid) => {
                console.log("Manual validation trigger result:", isValid);
                if (!isValid) {
                  console.error("Manual trigger found errors:", form.formState.errors);
                }
              });
              
              console.log("=== END DEBUG ===");
            }}
          >
            {isSubmitting ? "Saving..." : eventId ? "Update Event" : "Create Event"}
          </Button>
        </div>
      </form>
    </Form>
  );
}