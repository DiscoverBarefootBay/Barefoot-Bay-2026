import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodV4Resolver } from "@/lib/zod-v4-resolver";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { LocationPickerAlt } from "@/components/calendar/location-picker-alt";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, X, GripVertical } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { insertListingSchema, ListingType, type RealEstateListing } from "@shared/schema";
import { z } from "zod";
import { Link } from "wouter";

// Create a specific type for the form values
type ListingFormValues = z.infer<typeof insertListingSchema> & {
  mediaFiles?: FileList | null;
};

type Props = {
  onSubmit: (data: ListingFormValues) => void;
  isSubmitting?: boolean;
  defaultValues?: RealEstateListing;
  selectedFiles?: File[];
  setSelectedFiles?: (files: File[]) => void;
  listingDuration?: string | null;
  selectedType?: string;
  userIntent?: 'payment' | 'draft' | null;
};

function formatPhoneNumber(value: string) {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length >= 10) {
    return `(${numbers.slice(0,3)}) ${numbers.slice(3,6)}-${numbers.slice(6,10)}`;
  } else if (numbers.length >= 6) {
    return `(${numbers.slice(0,3)}) ${numbers.slice(3,6)}-${numbers.slice(6)}`;
  } else if (numbers.length >= 3) {
    return `(${numbers.slice(0,3)}) ${numbers.slice(3)}`;
  }
  return numbers;
}

// Helper function to get the human-readable label for a listing type
function getListingTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'FSBO': 'For Sale By Owner',
    'Agent': 'For Sale By Agent',
    'Rent': 'For Rent',
    'OpenHouse': 'Open House',
    'Wanted': 'Wanted',
    'Classified': 'Classified',
    'GarageSale': 'Garage/Yard Sale'
  };
  
  return labels[type] || type;
}

export function CreateListingForm({ 
  onSubmit, 
  isSubmitting, 
  defaultValues,
  selectedFiles: externalSelectedFiles,
  setSelectedFiles: setExternalSelectedFiles,
  listingDuration,
  selectedType,
  userIntent
}: Props) {
  const [listingType, setListingType] = useState<ListingType | undefined>(
    defaultValues?.listingType as ListingType | undefined
  );
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [currentPhotos, setCurrentPhotos] = useState<string[]>(defaultValues?.photos || []);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [savingAsDraft, setSavingAsDraft] = useState<boolean>(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // Tracks whether the seller is listing a lot/vacant land (no home), in
  // which case bedrooms/bathrooms/square feet/year built do not apply. We
  // infer this from existing listings whose home-detail fields are all
  // empty so editing a lot/land listing keeps the toggle on.
  const [isLotOrLand, setIsLotOrLand] = useState<boolean>(() => {
    if (!defaultValues) return false;
    const isPropertyType = ['FSBO', 'Agent', 'Rent', 'OpenHouse'].includes(
      defaultValues.listingType as string,
    );
    if (!isPropertyType) return false;
    const hasNoHomeDetails =
      !defaultValues.bedrooms &&
      !defaultValues.bathrooms &&
      !defaultValues.squareFeet &&
      !defaultValues.yearBuilt;
    return hasNoHomeDetails;
  });

  // Reset the local "Saving..." state on the Save as Draft button whenever the
  // parent's submission transitions from in-flight to finished (success or
  // error). Without this, a failed submission leaves the button permanently
  // disabled with the "Saving..." label. Using a ref to detect the true->false
  // edge avoids resetting prematurely between the click and the mutation
  // starting.
  const prevIsSubmittingRef = useRef<boolean>(false);
  useEffect(() => {
    if (prevIsSubmittingRef.current && !isSubmitting) {
      setSavingAsDraft(false);
    }
    prevIsSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  // The LocationPickerAlt component handles its own service-status soft warning,
  // so we no longer check status here to avoid a double (and potentially
  // blocking) alert.  mapsError is kept for future use (e.g. upload errors).
  useEffect(() => {
    setMapsError(null);
  }, []);

  // Default contact info to avoid null/undefined errors
  const defaultContactInfo = {
    name: defaultValues?.contactInfo && typeof defaultValues.contactInfo === 'object' 
      ? String(defaultValues.contactInfo.name || "") : "",
    phone: defaultValues?.contactInfo && typeof defaultValues.contactInfo === 'object' 
      ? String(defaultValues.contactInfo.phone || "") : "",
    email: defaultValues?.contactInfo && typeof defaultValues.contactInfo === 'object' 
      ? String(defaultValues.contactInfo.email || "") : "",
  };

  const form = useForm<ListingFormValues>({
    resolver: zodV4Resolver(insertListingSchema),
    defaultValues: {
      listingType: defaultValues?.listingType as ListingType | undefined,
      title: defaultValues?.title || "",
      price: defaultValues?.price || 0,
      address: defaultValues?.address || "",
      bedrooms: defaultValues?.bedrooms || 0,
      bathrooms: defaultValues?.bathrooms || 0,
      squareFeet: defaultValues?.squareFeet || 0,
      yearBuilt: defaultValues?.yearBuilt || 0,
      description: defaultValues?.description || "",
      photos: defaultValues?.photos || [],
      contactInfo: defaultContactInfo,
      cashOnly: defaultValues?.cashOnly || false,
      isSubscription: defaultValues?.isSubscription || false,
      category: defaultValues?.category || "",
    },
  });

  // Update form values when defaultValues change
  useEffect(() => {
    if (defaultValues) {
      const contactInfo = {
        name: defaultValues.contactInfo && typeof defaultValues.contactInfo === 'object' 
          ? String(defaultValues.contactInfo.name || "") : "",
        phone: defaultValues.contactInfo && typeof defaultValues.contactInfo === 'object' 
          ? String(defaultValues.contactInfo.phone || "") : "",
        email: defaultValues.contactInfo && typeof defaultValues.contactInfo === 'object' 
          ? String(defaultValues.contactInfo.email || "") : "",
      };
      
      form.reset({
        listingType: defaultValues.listingType as ListingType,
        title: defaultValues.title,
        price: defaultValues.price,
        address: defaultValues.address || "",
        bedrooms: defaultValues.bedrooms || 0,
        bathrooms: defaultValues.bathrooms || 0,
        squareFeet: defaultValues.squareFeet || 0,
        yearBuilt: defaultValues.yearBuilt || 0,
        description: defaultValues.description || "",
        photos: defaultValues.photos || [],
        contactInfo: contactInfo,
        cashOnly: defaultValues.cashOnly || false,
        isSubscription: defaultValues.isSubscription || false,
        category: defaultValues.category || "",
      });
      setListingType(defaultValues.listingType as ListingType);
      setCurrentPhotos(defaultValues.photos || []);

      // Re-evaluate lot/land status when loading an existing listing.
      const isPropertyType = ['FSBO', 'Agent', 'Rent', 'OpenHouse'].includes(
        defaultValues.listingType as string,
      );
      const hasNoHomeDetails =
        !defaultValues.bedrooms &&
        !defaultValues.bathrooms &&
        !defaultValues.squareFeet &&
        !defaultValues.yearBuilt;
      setIsLotOrLand(isPropertyType && hasNoHomeDetails);
    }
  }, [defaultValues, form]);

  const isPropertyListing = listingType && ['FSBO', 'Agent', 'Rent', 'OpenHouse'].includes(listingType);
  const isClassifiedListing = listingType === 'Classified';
  const isGarageSaleListing = listingType === 'GarageSale';

  const handleListingTypeChange = (value: string) => {
    const validType = value as ListingType;
    setListingType(validType);
    
    // Only set if it's a valid listing type
    if (['FSBO', 'Agent', 'Rent', 'OpenHouse', 'Wanted', 'Classified', 'GarageSale'].includes(value)) {
      form.setValue('listingType', validType);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(e.target.files);
      
      // If parent component provided setSelectedFiles function, use it
      if (setExternalSelectedFiles) {
        // Convert FileList to array of Files
        const filesArray = Array.from(e.target.files);
        setExternalSelectedFiles(filesArray);
      }
    }
  };

  /**
   * Helper function to get proper URL for media display
   * This handles converting file paths to Object Storage URLs
   */
  const getProperMediaUrl = (url: string): string => {
    // If it's already a full URL (http or https), use it directly
    if (url.startsWith('http')) {
      return url;
    }
    
    // If it's an Object Storage proxy URL, use it directly
    if (url.startsWith('/api/storage-proxy/')) {
      return url;
    }
    
    // If it starts with a slash, it's already a proper path
    if (url.startsWith('/')) {
      // Check if it's a real-estate-media path without proxy
      if (url.startsWith('/real-estate-media/')) {
        // Convert to Object Storage proxy URL format
        const filename = url.replace('/real-estate-media/', '');
        return `/api/storage-proxy/REAL_ESTATE/real-estate-media/${filename}`;
      }
      return url;
    }
    
    // If it's a real-estate-media path without slash, convert to Object Storage proxy
    if (url.startsWith('real-estate-media/')) {
      // Convert to Object Storage proxy URL format
      const filename = url.replace('real-estate-media/', '');
      return `/api/storage-proxy/REAL_ESTATE/real-estate-media/${filename}`;
    }
    
    // Default to adding a leading slash
    return `/${url}`;
  };

  const handleRemovePhoto = (photoUrl: string) => {
    console.log("[Photo Deletion] Removing photo:", photoUrl);
    console.log("[Photo Deletion] Current photos before removal:", currentPhotos);
    
    const updatedPhotos = currentPhotos.filter(url => url !== photoUrl);
    
    console.log("[Photo Deletion] Updated photos after removal:", updatedPhotos);
    
    setCurrentPhotos(updatedPhotos);
    form.setValue('photos', updatedPhotos, { shouldDirty: true, shouldValidate: true });
    
    console.log("[Photo Deletion] Form photos value set to:", updatedPhotos);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reorderedPhotos = [...currentPhotos];
    const [draggedPhoto] = reorderedPhotos.splice(draggedIndex, 1);
    reorderedPhotos.splice(dropIndex, 0, draggedPhoto);

    console.log("[Photo Reorder] Moved photo from index", draggedIndex, "to", dropIndex);
    console.log("[Photo Reorder] New order:", reorderedPhotos);

    setCurrentPhotos(reorderedPhotos);
    form.setValue('photos', reorderedPhotos, { shouldDirty: true, shouldValidate: true });
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Effect to set the listingDuration value when it changes
  useEffect(() => {
    if (listingDuration) {
      // Ensure the listingDuration matches one of the expected enum values
      let formattedDuration = listingDuration;
      
      // If we get a duration that doesn't match the exact format, normalize it
      if (listingDuration !== '3_day' && listingDuration !== '7_day' && listingDuration !== '30_day') {
        // Try to convert it to the expected format
        if (listingDuration.includes('3')) {
          formattedDuration = '3_day';
        } else if (listingDuration.includes('7')) {
          formattedDuration = '7_day';
        } else if (listingDuration.includes('30')) {
          formattedDuration = '30_day';
        } else {
          // Default to 30 days if we can't determine
          formattedDuration = '30_day';
        }
        console.log(`Normalized listing duration from ${listingDuration} to ${formattedDuration}`);
      }
      
      // Set the normalized value in the form
      form.setValue('listingDuration', formattedDuration);
      
      // Calculate expiration date based on duration
      const expirationDate = new Date();
      if (formattedDuration === '3_day') {
        expirationDate.setDate(expirationDate.getDate() + 3);
      } else if (formattedDuration === '7_day') {
        expirationDate.setDate(expirationDate.getDate() + 7);
      } else if (formattedDuration === '30_day') {
        expirationDate.setDate(expirationDate.getDate() + 30);
      }
      
      form.setValue('expirationDate', expirationDate);
      console.log(`Set expiration date to ${expirationDate.toISOString()} based on duration ${formattedDuration}`);
    }
  }, [listingDuration, form]);
  
  // Effect to set the selectedType value when it's provided and update the form
  useEffect(() => {
    if (selectedType) {
      form.setValue('listingType', selectedType as ListingType);
      setListingType(selectedType as ListingType);
      console.log(`Locked listing type to ${selectedType} as it was selected during payment`);
    }
  }, [selectedType, form]);

  const handleSubmit = (data: ListingFormValues, isDraft: boolean = false) => {
    console.log("Form submission triggered with data:", data);
    console.log("Saving as draft:", isDraft);
    console.log("[Photo Submission] currentPhotos state:", currentPhotos);
    console.log("[Photo Submission] data.photos from form:", data.photos);
    
    // For lot/land property listings, clear out the home-detail fields so we
    // don't persist meaningless 0 values. The shared schema treats these
    // fields as optional, so this is safe.
    const isPropertyType = data.listingType && ['FSBO', 'Agent', 'Rent', 'OpenHouse'].includes(data.listingType);
    const skipHomeDetails = Boolean(isPropertyType && isLotOrLand);

    // Ensure all numeric fields are properly typed
    const formattedData: ListingFormValues = {
      ...data,
      price: Number(data.price),
      bedrooms: skipHomeDetails ? 0 : Number(data.bedrooms),
      bathrooms: skipHomeDetails ? 0 : Number(data.bathrooms),
      squareFeet: skipHomeDetails ? 0 : Number(data.squareFeet),
      yearBuilt: skipHomeDetails ? 0 : Number(data.yearBuilt),
      contactInfo: {
        name: data.contactInfo?.name?.trim() || "",
        phone: data.contactInfo?.phone?.trim() || "",
        email: data.contactInfo?.email?.trim() || "",
      },
      // Use currentPhotos instead of data.photos to reflect deletions
      photos: currentPhotos,
      // Include the selected files
      mediaFiles: selectedFiles,
      // Ensure ListingType is properly typed
      listingType: data.listingType as ListingType,
      // Set default isSubscription to false if not provided
      isSubscription: data.isSubscription || false,
      // Ensure category is included
      category: data.category || "",
      // Include the listing duration
      listingDuration: listingDuration || undefined,
      // Set status based on whether this is a draft or preserving existing status
      status: isDraft ? "DRAFT" : (defaultValues?.status && !isDraft ? defaultValues.status : "ACTIVE"),
      
      // Ensure expirationDate is always a Date object
      expirationDate: data.expirationDate instanceof Date 
        ? data.expirationDate 
        : typeof data.expirationDate === 'string' 
          ? new Date(data.expirationDate) 
          : null,
    };
    
    // If we have a duration but no expiration date set yet, calculate it
    if (listingDuration && !data.expirationDate) {
      // Normalize the duration to ensure it matches the expected format
      let formattedDuration = listingDuration;
      
      // If we get a duration that doesn't match the exact format, normalize it
      if (listingDuration !== '3_day' && listingDuration !== '7_day' && listingDuration !== '30_day') {
        // Try to convert it to the expected format
        if (listingDuration.includes('3')) {
          formattedDuration = '3_day';
        } else if (listingDuration.includes('7')) {
          formattedDuration = '7_day';
        } else if (listingDuration.includes('30')) {
          formattedDuration = '30_day';
        } else {
          // Default to 30 days if we can't determine
          formattedDuration = '30_day';
        }
        console.log(`Normalized listing duration in submit from ${listingDuration} to ${formattedDuration}`);
      }
      
      // Also update the listingDuration in the formatted data
      formattedData.listingDuration = formattedDuration;
      
      const expirationDate = new Date();
      if (formattedDuration === '3_day') {
        expirationDate.setDate(expirationDate.getDate() + 3);
      } else if (formattedDuration === '7_day') {
        expirationDate.setDate(expirationDate.getDate() + 7);
      } else if (formattedDuration === '30_day') {
        expirationDate.setDate(expirationDate.getDate() + 30);
      }
      
      formattedData.expirationDate = expirationDate;
      console.log(`Set expiration date in submit to ${expirationDate.toISOString()} based on duration ${formattedDuration}`);
    }
    
    console.log("[Photo Submission] Final photos being submitted:", formattedData.photos);
    onSubmit(formattedData);
  };

  return (
    <Form {...form}>
      <form 
        onSubmit={(e) => {
          console.log("Direct form submit event triggered");
          // Prevent default to allow our custom handler
          e.preventDefault();
          // Call the react-hook-form submit handler
          form.handleSubmit(handleSubmit)(e);
        }} 
        className="space-y-6 pb-6"
      >
        {mapsError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {mapsError}
              <p className="mt-2 text-sm">
                If this problem persists, please try entering the address manually.
              </p>
            </AlertDescription>
          </Alert>
        )}
        <div className="space-y-6">
          {/* Listing Type */}
          <FormField
            control={form.control}
            name="listingType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Listing Type</FormLabel>
                {/* If a listing type is provided from payment, show as disabled */}
                {selectedType ? (
                  <div className="flex flex-col space-y-1.5">
                    <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background opacity-70">
                      {getListingTypeLabel(selectedType)}
                    </div>
                    <p className="text-xs text-muted-foreground">This listing type was selected during payment and cannot be changed</p>
                  </div>
                ) : (
                  <Select onValueChange={handleListingTypeChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="FSBO">For Sale By Owner</SelectItem>
                      <SelectItem value="Agent">For Sale By Agent</SelectItem>
                      <SelectItem value="Rent">For Rent</SelectItem>
                      <SelectItem value="OpenHouse">Open House</SelectItem>
                      <SelectItem value="Wanted">Wanted</SelectItem>
                      <SelectItem value="Classified">Classified</SelectItem>
                      <SelectItem value="GarageSale">Garage/Yard Sale</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ''} placeholder="Enter listing title" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {isPropertyListing && (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                            field.onChange(value);
                          }}
                          placeholder="Enter price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <LocationPickerAlt
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder="Enter property address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-start gap-3 rounded-md border border-dashed p-3">
                <Checkbox
                  id="lot-or-land-toggle"
                  checked={isLotOrLand}
                  onCheckedChange={(checked) => {
                    const next = checked === true;
                    setIsLotOrLand(next);
                    if (next) {
                      // Clear home-detail values so they don't linger in the
                      // form state when hidden.
                      form.setValue('bedrooms', 0, { shouldDirty: true });
                      form.setValue('bathrooms', 0, { shouldDirty: true });
                      form.setValue('squareFeet', 0, { shouldDirty: true });
                      form.setValue('yearBuilt', 0, { shouldDirty: true });
                    }
                  }}
                  className="mt-0.5"
                  data-testid="checkbox-lot-or-land"
                />
                <div className="space-y-1 leading-none">
                  <label
                    htmlFor="lot-or-land-toggle"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Lot / Land (no home)
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Check this if you're selling vacant land or a lot. We'll skip the bedrooms, bathrooms, square footage, and year built fields.
                  </p>
                </div>
              </div>

              {!isLotOrLand && (
                <div className="grid md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="bedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bedrooms <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                              field.onChange(value);
                            }}
                            placeholder="0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bathrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bathrooms <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                              field.onChange(value);
                            }}
                            placeholder="0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="squareFeet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Square Feet <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                              field.onChange(value);
                            }}
                            placeholder="0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="yearBuilt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year Built <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1900"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                              field.onChange(value);
                            }}
                            placeholder="Year"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </>
          )}

          {isClassifiedListing && (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Furniture">Furniture</SelectItem>
                        <SelectItem value="Electronics">Electronics</SelectItem>
                        <SelectItem value="Clothing">Clothing</SelectItem>
                        <SelectItem value="Tools">Tools</SelectItem>
                        <SelectItem value="Garage/Yard Sale">Garage/Yard Sale</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                            field.onChange(value);
                          }}
                          placeholder="Enter price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address (Optional)</FormLabel>
                      <FormControl>
                        <LocationPickerAlt
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder="Enter item location address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          {isGarageSaleListing && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price Range (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                            field.onChange(value);
                          }}
                          placeholder="Enter max price (optional)"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <LocationPickerAlt
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder="Enter sale location address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter listing description"
                    className="min-h-[100px] resize-y"
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Add Media Upload Section */}
          <FormField
            control={form.control}
            name="photos"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Property Photos & Videos</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                  />
                </FormControl>
                {currentPhotos.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground mb-2">Current photos ({currentPhotos.length}) - Drag to reorder:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {currentPhotos.map((url, index) => (
                        <div 
                          key={url}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                          className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing ${
                            draggedIndex === index 
                              ? 'opacity-50 border-primary scale-95' 
                              : dragOverIndex === index 
                                ? 'border-primary border-dashed bg-primary/10' 
                                : 'border-transparent hover:border-muted-foreground/50'
                          }`}
                        >
                          <div className="absolute top-1 left-1 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <div className="absolute top-1 left-10 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            #{index + 1}
                          </div>
                          <img 
                            src={getProperMediaUrl(url)} 
                            alt={`Property photo ${index + 1}`}
                            className="w-full h-full object-cover pointer-events-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(url)}
                            className="absolute top-1 right-1 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg cursor-pointer z-10"
                            title="Delete photo"
                          >
                            <X className="h-5 w-5" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs text-white truncate block">{url.split('/').pop()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Contact Information</h3>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="contactInfo.name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter contact name" 
                        {...field} 
                        value={field.value || ''} 
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
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(555) 555-5555"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => {
                          const formatted = formatPhoneNumber(e.target.value);
                          field.onChange(formatted);
                        }}
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Hidden fields for listing duration and expiration date */}
          <input 
            type="hidden" 
            {...form.register('listingDuration')} 
          />
          <input 
            type="hidden" 
            {...form.register('expirationDate')} 
          />

          {/* Show listing duration information if available */}
          {listingDuration && (
            <div className="mt-4 p-4 bg-muted rounded-md">
              <p className="text-sm font-medium">Listing Details:</p>
              <p className="text-sm text-muted-foreground">
                Duration: {listingDuration === '3_day' ? '3 days' : 
                  listingDuration === '7_day' ? '7 days' : 
                  listingDuration === '30_day' ? '30 days' : 'Unknown'}
              </p>
            </div>
          )}
          
          <div className="space-y-3 mt-4">
            <div className="flex gap-4">
              {/* Conditional button display based on userIntent */}
              {userIntent === 'draft' ? (
                /* Show only Save as Draft button when user selected "Save as Draft" */
                <Button 
                  type="button" 
                  className="flex-1" 
                  variant="outline"
                  disabled={isSubmitting || savingAsDraft}
                  onClick={(e) => {
                    setSavingAsDraft(true);
                    console.log("Save as Draft button clicked");
                    const formData = form.getValues();
                    // Pass true to indicate this is a draft
                    handleSubmit(formData, true);
                  }}
                >
                  {savingAsDraft ? "Saving..." : "Save as Draft"}
                </Button>
              ) : userIntent === 'payment' ? (
                /* Show only Create Listing button when user clicked "Proceed to Payment" */
                <Button 
                  type="button" 
                  className="flex-1" 
                  disabled={isSubmitting}
                  onClick={(e) => {
                    console.log("Submit button clicked directly");
                    // Manually trigger form validation and submission
                    const formData = form.getValues();
                    console.log("Form data:", formData);
                    // Process the data directly (not a draft)
                    handleSubmit(formData, false);
                  }}
                >
                  {isSubmitting ? "Creating..." : defaultValues ? "Update Listing" : "Create Listing"}
                </Button>
              ) : (
                /* Show both buttons when no intent is set (before payment dialog) */
                <>
                  <Button 
                    type="button" 
                    className="flex-1" 
                    variant="outline"
                    disabled={isSubmitting || savingAsDraft}
                    onClick={(e) => {
                      setSavingAsDraft(true);
                      console.log("Save as Draft button clicked");
                      const formData = form.getValues();
                      // Pass true to indicate this is a draft
                      handleSubmit(formData, true);
                    }}
                    data-testid="button-save-draft"
                  >
                    {savingAsDraft ? "Saving..." : "Save as Draft"}
                  </Button>
                  
                  <Button 
                    type="button" 
                    className="flex-1" 
                    disabled={isSubmitting}
                    onClick={(e) => {
                      console.log("Update listing button clicked - preserving current status");
                      // Manually trigger form validation and submission
                      const formData = form.getValues();
                      console.log("Form data:", formData);
                      // Process the data preserving current status (not a draft)
                      handleSubmit(formData, false);
                    }}
                    data-testid="button-update-listing"
                  >
                    {isSubmitting ? "Updating..." : defaultValues ? "Update Listing" : "Create Listing"}
                  </Button>
                </>
              )}
            </div>
            
            {/* Help text for buttons when editing an existing listing */}
            {defaultValues && !userIntent && (
              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div className="space-y-1">
                  <p className="font-medium">Save as Draft:</p>
                  <p>Removes listing from public On The Market page. Saved under <Link href="/my-listings" className="underline hover:text-foreground">My Listings</Link>. Requires credits to republish.</p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Update Listing:</p>
                  <p>Updates listing with your edits while keeping it live on the public On The Market page. No additional credits needed.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}