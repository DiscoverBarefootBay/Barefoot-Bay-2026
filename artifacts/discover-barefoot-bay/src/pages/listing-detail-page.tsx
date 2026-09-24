import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { format } from "date-fns";
import { Home, Bed, Bath, Ruler, CalendarDays, Phone, Mail, DollarSign, Tag, MapPin, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaGallery } from "@/components/shared/media-gallery";
import { LocationMapAlt } from "@/components/calendar/location-map-alt";
import { ListingImage } from "@/components/for-sale/listing-image";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollableContent } from "@/components/ui/scrollable-content";
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
import { CreateListingForm } from "@/components/for-sale/create-listing-form";
import { FeatureUpgradeDialog } from "@/components/for-sale/feature-upgrade-dialog";
import { FeaturedInfoDialog } from "@/components/for-sale/featured-info-dialog";
import { ContactForm } from "@/components/for-sale/contact-form";
import SubscriptionManager from "@/components/for-sale/subscription-manager";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useFlags } from "@/hooks/use-flags";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { RealEstateListing } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import PublishPaymentDialog from "@/components/for-sale/publish-payment-dialog-new";
import { ShareButton } from "@/components/shared/share-button";
import { ContentModerationMenu } from "@/components/admin/dmca/content-moderation-menu";

const typeLabels = {
  FSBO: "For Sale By Owner",
  Agent: "For Sale By Agent",
  Rent: "For Rent",
  OpenHouse: "Open House",
  Wanted: "Wanted",
  Classified: "Classified",
} as const;

const typeColors = {
  FSBO: "bg-purple-100 text-purple-800",
  Agent: "bg-blue-100 text-blue-800",
  Rent: "bg-green-100 text-green-800",
  OpenHouse: "bg-yellow-100 text-yellow-800",
  Wanted: "bg-red-100 text-red-800",
  Classified: "bg-gray-100 text-gray-800",
} as const;

export default function ListingDetailPage() {
  const [, params] = useRoute<{ id: string }>("/for-sale/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { isFeaturedListingsEnabled } = useFlags();
  const featuredEnabled = isFeaturedListingsEnabled();
  const { isAdmin, isModerator } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [isFeatureUpgradeOpen, setIsFeatureUpgradeOpen] = useState(false);
  const [isFeaturedInfoOpen, setIsFeaturedInfoOpen] = useState(false);
  const listingId = params?.id;

  // Note: We intentionally do NOT update for-sale visit tracking here.
  // Viewing a single listing detail should not clear the "new listings" badge.
  // The badge should only be cleared when visiting the main for-sale listings page.

  const { data: listing, isLoading, error } = useQuery<RealEstateListing>({
    queryKey: [`/api/listings/${listingId}`],
    enabled: !!listingId,
    retry: 2,
    retryDelay: 1000,
    queryFn: async () => {
      console.log(`Fetching listing details for ID: ${listingId}`);
      try {
        const response = await fetch(`/api/listings/${listingId}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Listing fetch error:', errorData);
          throw new Error(errorData.message || 'Failed to fetch listing details');
        }
        const result = await response.json();
        console.log('Listing data received:', result);
        
        // Ensure we have all the necessary data, especially the status field
        if (!result || typeof result !== 'object') {
          console.error('Invalid listing data received:', result);
          throw new Error('Received invalid listing data');
        }
        
        // Set a default status if missing
        if (!result.status) {
          console.log('Adding default status to listing data');
          result.status = "ACTIVE";
        }
        
        return result;
      } catch (err) {
        console.error('Error fetching listing:', err);
        throw err;
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/listings/${listingId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete listing");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({
        title: "Success",
        description: "Listing deleted successfully",
      });
      navigate("/for-sale");
    },
    onError: (error: Error) => {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Updating listing with data:", data);
      console.log("[Listing Update] Photos received from form:", data.photos);
      console.log("[Listing Update] Photos array length:", data.photos?.length);

      // Create FormData to handle file uploads
      const formData = new FormData();

      // Add the basic listing data
      const listingData = {
        listingType: data.listingType,
        title: data.title,
        price: Number(data.price) || 0,
        address: data.address,
        bedrooms: Number(data.bedrooms) || 0,
        bathrooms: Number(data.bathrooms) || 0,
        squareFeet: Number(data.squareFeet) || 0,
        yearBuilt: Number(data.yearBuilt) || 0,
        description: data.description,
        cashOnly: data.cashOnly || false,
        contactInfo: {
          name: data.contactInfo?.name?.trim() || '',
          phone: data.contactInfo?.phone?.trim() || '',
          email: data.contactInfo?.email?.trim() || '',
        },
        photos: data.photos || [],
        status: data.status,
      };
      
      console.log("[Listing Update] listingData.photos being sent:", listingData.photos);

      // Append the listing data
      formData.append('data', JSON.stringify(listingData));

      // Handle media files separately using the dedicated real estate media endpoint
      let newMediaUrls = [];
      if (data.mediaFiles && data.mediaFiles.length > 0) {
        console.log(`Uploading ${data.mediaFiles.length} real estate images using specialized endpoint`);
        console.log("Media files to upload:", data.mediaFiles);
        
        // First upload the media files using the dedicated endpoint
        const mediaFormData = new FormData();
        for (let i = 0; i < data.mediaFiles.length; i++) {
          const file = data.mediaFiles[i];
          console.log(`Adding file ${i}:`, file.name, file.type, file.size);
          mediaFormData.append('media', file);
        }
        
        console.log("About to send request to /api/upload/real-estate-media");
        
        // Use the specialized real estate media upload endpoint
        const mediaResponse = await fetch("/api/upload/real-estate-media", {
          method: "POST",
          credentials: 'include',
          body: mediaFormData,
        });
        
        if (!mediaResponse.ok) {
          let errorMessage = "Failed to upload listing images";
          try {
            const error = await mediaResponse.json();
            errorMessage = error.message || errorMessage;
          } catch (parseError) {
            // If JSON parsing fails, try to get text response
            try {
              const textError = await mediaResponse.text();
              console.error("Server returned non-JSON error:", textError);
              errorMessage = `Server error: ${mediaResponse.status} ${mediaResponse.statusText}`;
            } catch (textError) {
              console.error("Could not parse server error response");
            }
          }
          throw new Error(errorMessage);
        }
        
        const mediaData = await mediaResponse.json();
        
        // Handle response from the specialized real estate endpoint
        if (mediaData.mediaUrls && mediaData.mediaUrls.length > 0) {
          newMediaUrls = mediaData.mediaUrls;
          console.log("Successfully uploaded real estate images:", newMediaUrls);
          
          // Add the new media URLs to the existing photos
          listingData.photos = [...(listingData.photos || []), ...newMediaUrls];
          
          // Update the data in the formData
          formData.set('data', JSON.stringify(listingData));
        } else {
          console.error("Failed to upload media files:", mediaData);
          throw new Error("Failed to upload images for listing");
        }
      }
      
      // Now update the listing data without media files
      const response = await fetch(`/api/listings/${listingId}`, {
        method: 'PATCH',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update listing");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/listings/${listingId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      setIsDialogOpen(false);
      toast({
        title: "Success",
        description: "Listing updated successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Update error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (error) {
    console.error('Error in listing detail page:', error);
    return (
      <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Listing</h2>
        <p className="text-gray-700 mb-4">There was a problem loading this listing. Please try again later.</p>
        <Button onClick={() => navigate('/for-sale')}>
          Return to Listings
        </Button>
      </div>
    );
  }

  if (!listing) {
    return <div>Listing not found</div>;
  }

  // Defensive programming - ensure we have all required properties
  const safeListingData = {
    ...listing,
    listingType: listing.listingType || 'Classified',
    title: listing.title || 'Untitled Listing',
    price: typeof listing.price === 'number' ? listing.price : 0,
    photos: Array.isArray(listing.photos) ? listing.photos : [],
    address: listing.address || 'Address not provided',
    bedrooms: typeof listing.bedrooms === 'number' ? listing.bedrooms : 0,
    bathrooms: typeof listing.bathrooms === 'number' ? listing.bathrooms : 0,
    squareFeet: typeof listing.squareFeet === 'number' ? listing.squareFeet : 0,
    yearBuilt: typeof listing.yearBuilt === 'number' ? listing.yearBuilt : 0,
    description: listing.description || '',
    cashOnly: !!listing.cashOnly,
    status: listing.status || 'ACTIVE',
    createdAt: listing.createdAt || new Date().toISOString(),
    createdBy: typeof listing.createdBy === 'number' ? listing.createdBy : 0,
  };

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const isPropertyListing = ['FSBO', 'Agent', 'Rent', 'OpenHouse'].includes(safeListingData.listingType);
  const createdAtDate = safeListingData.createdAt ? new Date(safeListingData.createdAt) : new Date();

  // Treat a listing whose expiration date has passed as expired even if its
  // stored status hasn't been flipped to EXPIRED yet, so the badge never shows
  // a stale "ACTIVE".
  const isActuallyExpired = !!safeListingData.expirationDate
    && new Date(safeListingData.expirationDate) < new Date();
  const effectiveStatus = safeListingData.status !== "DRAFT" && isActuallyExpired
    ? "EXPIRED"
    : safeListingData.status;
  
  // Ensure contactInfo is an object even if undefined in the listing
  const contactInfo = (typeof safeListingData.contactInfo === 'object' && safeListingData.contactInfo) 
    ? safeListingData.contactInfo as { name?: string; phone?: string; email?: string } 
    : { name: undefined, phone: undefined, email: undefined };
  
  const isOwner = user?.id === safeListingData.createdBy;

  return (
    <div className="max-w-7xl mx-auto p-2 sm:p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
        {/* Left Column: Listing Details */}
        <div className="space-y-4 md:space-y-8">
          <Card className={featuredEnabled && safeListingData.featured && safeListingData.status !== "DRAFT"
            ? "relative border-yellow-400 border-[3px] shadow-lg ring-2 ring-yellow-200"
            : undefined
          }>
            {featuredEnabled && safeListingData.featured && safeListingData.status !== "DRAFT" && (
              <button
                type="button"
                className="absolute -top-2 -left-2 z-10 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1 cursor-pointer"
                title="About Featured listings"
                onClick={() => setIsFeaturedInfoOpen(true)}
              >
                ★ Featured
              </button>
            )}
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className={typeColors[safeListingData.listingType as keyof typeof typeColors]}>
                    {typeLabels[safeListingData.listingType as keyof typeof typeLabels] || safeListingData.listingType}
                  </Badge>
                  
                  {/* Status Badge - Enhanced for visibility (uses effective
                      status so a past-expiration listing never shows "ACTIVE") */}
                  <Badge variant="outline" className={
                    effectiveStatus === "DRAFT" ? "bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1 font-medium" : 
                    effectiveStatus === "ACTIVE" ? "bg-green-100 text-green-800 border-green-200 flex items-center gap-1 font-medium" : 
                    effectiveStatus === "EXPIRED" ? "bg-red-100 text-red-800 border-red-200 flex items-center gap-1 font-medium" : 
                    "bg-gray-100 text-gray-800 border-gray-200 flex items-center gap-1 font-medium"
                  }>
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      effectiveStatus === "DRAFT" ? "bg-amber-500" :
                      effectiveStatus === "ACTIVE" ? "bg-green-500" :
                      effectiveStatus === "EXPIRED" ? "bg-red-500" :
                      "bg-gray-500"
                    }`}></span>
                    {effectiveStatus || "ACTIVE"}
                  </Badge>
                </div>
                {safeListingData.price > 0 && (
                  <span className="text-xl sm:text-2xl font-bold">
                    {(() => {
                      try {
                        // Make sure the price is a valid number
                        const price = Number(safeListingData.price);
                        if (isNaN(price)) {
                          console.error("Invalid listing.price:", safeListingData.price);
                          return "Price not available";
                        }
                        return formatter.format(price);
                      } catch (error) {
                        console.error("Price formatting error:", error);
                        return "Price not available";
                      }
                    })()}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl sm:text-3xl break-words">{safeListingData.title}</CardTitle>
                
                {/* Prominent Draft Status Indicator */}
                {safeListingData.status === "DRAFT" && (
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800 border border-amber-300 mt-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
                    Draft Listing (Not Published)
                  </div>
                )}
                
                {effectiveStatus === "EXPIRED" && (
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-500 text-white border border-red-500 mt-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-white mr-2"></span>
                    Expired Listing
                  </div>
                )}
              </div>

              {/* Edit, Publish and Delete buttons */}
              {(isOwner || isModerator) && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {/* Publish Button - Only for draft listings */}
                  {safeListingData.status === "DRAFT" && isOwner && (
                    <Button 
                      variant="default" 
                      className="w-full sm:w-auto text-sm bg-green-600 hover:bg-green-700"
                      onClick={() => setIsPublishDialogOpen(true)}
                    >
                      <Tag className="h-4 w-4 mr-2" />
                      Publish Listing
                    </Button>
                  )}
                  
                  {/* Payment Dialog for Publishing */}
                  {safeListingData.status === "DRAFT" && isOwner && (
                    <PublishPaymentDialog
                      isOpen={isPublishDialogOpen}
                      onClose={() => setIsPublishDialogOpen(false)}
                      listingId={Number(listingId)}
                      onPublishSuccess={(updatedListing) => {
                        queryClient.invalidateQueries({ queryKey: [`/api/listings/${listingId}`] });
                        queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
                        toast({
                          title: "Success",
                          description: "Your listing has been published successfully!",
                        });
                      }}
                    />
                  )}
                
                  {/* Edit button for both owner and admin */}
                  {(isOwner || isAdmin) && <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={`w-full sm:w-auto text-sm ${
                          isAdmin && !isOwner 
                            ? "bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300" 
                            : ""
                        }`}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Listing 
                        {isAdmin && !isOwner && " (Admin)"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[800px] h-[90vh]">
                      <DialogTitle>Edit Listing</DialogTitle>
                      <ScrollableContent maxHeight="calc(90vh - 120px)" contentClassName="px-6">
                        {listing && (
                          <CreateListingForm
                            defaultValues={listing}
                            onSubmit={(data) => updateMutation.mutate(data)}
                            isSubmitting={updateMutation.isPending}
                            selectedType={listing.listingType}
                            onFeatureUpgrade={
                              featuredEnabled && (isOwner || isAdmin) && listing.status === "ACTIVE" && !listing.featured
                                ? () => setIsFeatureUpgradeOpen(true)
                                : undefined
                            }
                          />
                        )}
                      </ScrollableContent>
                    </DialogContent>
                  </Dialog>}

                  {isModerator && !isOwner ? (
                    <ContentModerationMenu
                      contentType="listing"
                      contentId={Number(listingId)}
                      label="Moderate listing"
                      deleteFn={() => deleteMutation.mutateAsync()}
                    />
                  ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        className={`w-full sm:w-auto text-sm ${
                          isAdmin && !isOwner 
                            ? "bg-red-600 hover:bg-red-700 text-white border-red-600" 
                            : ""
                        }`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Listing
                        {isAdmin && !isOwner && " (Admin)"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Listing</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this listing? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  )}
                </div>
              )}
              
              {/* Share Button - Available to all users */}
              <div className="flex justify-center sm:justify-start mt-4">
                <ShareButton
                  title={safeListingData.title}
                  text={`Check out this listing: ${safeListingData.title}${safeListingData.price > 0 ? ` - ${formatter.format(safeListingData.price)}` : ''}${isPropertyListing && safeListingData.address ? ` at ${safeListingData.address}` : ''}`}
                  url={`${window.location.origin}/for-sale/${listingId}`}
                  imageUrl={safeListingData.photos && safeListingData.photos.length > 0 ? safeListingData.photos[0] : undefined}
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto"
                  buttonText="Share Listing"
                  dialogTitle="Share Listing"
                  dialogDescription="Share this property listing with your friends and community"
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-8">
              {isPropertyListing && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-5 w-5 flex-shrink-0" />
                      <span className="text-lg break-words">{safeListingData.address}</span>
                    </div>

                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-y-3 gap-x-4 sm:gap-x-6">
                      <div className="flex items-center gap-2">
                        <Bed className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm sm:text-base">{safeListingData.bedrooms} Bedrooms</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Bath className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm sm:text-base">{safeListingData.bathrooms} Bathrooms</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Ruler className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm sm:text-base">{safeListingData.squareFeet} sq ft</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm sm:text-base">Built {safeListingData.yearBuilt || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {safeListingData.cashOnly && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      <DollarSign className="h-4 w-4 mr-1" />
                      Cash Only
                    </Badge>
                  )}
                </>
              )}

              {safeListingData.description && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Description</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{safeListingData.description}</p>
                </div>
              )}

              <div className="space-y-4 border-t pt-4 md:pt-6">
                <h3 className="text-lg font-semibold">Contact Information</h3>
                <div className="space-y-2 md:space-y-3">
                  {contactInfo.name && (
                    <div className="text-base sm:text-lg break-words">{contactInfo.name}</div>
                  )}
                  {contactInfo.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <a href={`tel:${contactInfo.phone}`} className="hover:underline text-sm sm:text-base break-all">
                        {contactInfo.phone}
                      </a>
                    </div>
                  )}
                  {contactInfo.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <a href={`mailto:${contactInfo.email}`} className="hover:underline text-sm sm:text-base break-all">
                        {contactInfo.email}
                      </a>
                    </div>
                  )}
                  {!contactInfo.name && !contactInfo.phone && !contactInfo.email && (
                    <div className="text-sm text-muted-foreground">No contact information provided</div>
                  )}
                </div>
                
                {/* Contact Form (Moved here from right column) */}
                <div className="mt-4">
                  <ContactForm listing={safeListingData} />
                </div>
              </div>

              <div className="text-sm text-muted-foreground border-t pt-4 space-y-2">
                <div>Listed on {(() => {
                  try {
                    // Create date from safe data
                    const createdDate = new Date(safeListingData.createdAt);
                    // Verify the date is valid
                    if (isNaN(createdDate.getTime())) {
                      console.error("Invalid createdAt date in listing detail:", safeListingData.createdAt);
                      return "Invalid date";
                    }
                    return format(createdDate, "MMMM d, yyyy");
                  } catch (error) {
                    console.error("Date formatting error for createdAt:", error);
                    return "Invalid date";
                  }
                })()}</div>
                
                {/* Only show expiration for non-draft listings */}
                {safeListingData.status !== "DRAFT" && safeListingData.expirationDate && (
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span>
                      Expires on {(() => {
                        try {
                          // Verify the expiration date string is valid
                          const timestamp = Date.parse(safeListingData.expirationDate || '');
                          if (isNaN(timestamp)) {
                            console.error("Invalid listing.expirationDate:", safeListingData.expirationDate);
                            return "Invalid date";
                          }
                          
                          const dateObj = new Date(timestamp);
                          if (isNaN(dateObj.getTime())) {
                            console.error("Invalid date object after parsing listing.expirationDate:", safeListingData.expirationDate);
                            return "Invalid date";
                          }
                          
                          return format(dateObj, "MMMM d, yyyy");
                        } catch (error) {
                          console.error("Date formatting error for listing.expirationDate:", error);
                          return "Invalid date";
                        }
                      })()}
                    </span>
                  </div>
                )}
                
                {/* Draft expiration explanation */}
                {safeListingData.status === "DRAFT" && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <CalendarDays className="h-4 w-4" />
                    <span>
                      Expiration timer begins after publishing
                    </span>
                  </div>
                )}
                
                {/* Special message for draft listings */}
                {safeListingData.status === "DRAFT" && (
                  <div className="mt-3 text-amber-600 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                      This is a draft listing that has not been published yet. 
                      {isOwner && " You can publish it when ready."}
                    </div>
                    {isOwner && (
                      <Button 
                        onClick={() => setIsPublishDialogOpen(true)} 
                        className="mt-2 w-full md:w-auto"
                        variant="outline"
                      >
                        Publish Listing
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Photos, Map, and Subscription */}
        <div className="space-y-8">
          {/* Subscription Manager - only for listing owner */}
          {isOwner && (
            <SubscriptionManager
              listingId={parseInt(listingId || '0')}
              subscriptionId={safeListingData.subscriptionId || null}
            />
          )}

          {safeListingData.photos && safeListingData.photos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Photos</CardTitle>
              </CardHeader>
              <CardContent>
                <MediaGallery 
                  items={safeListingData.photos.map(url => ({
                    url,
                    altText: `${safeListingData.title} photo`,
                    mediaType: url.toLowerCase().endsWith('.mp4') || url.toLowerCase().endsWith('.webm') 
                      ? 'video' : 'image'
                  }))} 
                />
              </CardContent>
            </Card>
          )}

          {safeListingData.address && (
            <Card>
              <CardHeader>
                <CardTitle>Location</CardTitle>
              </CardHeader>
              <CardContent>
                <LocationMapAlt location={safeListingData.address} className="h-[300px] w-full" />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {/* Featured info dialog — opened by clicking the ★ Featured badge; the
          owner and admins can also remove featured status from here */}
      {featuredEnabled && safeListingData.featured && (
        <FeaturedInfoDialog
          isOpen={isFeaturedInfoOpen}
          onClose={() => setIsFeaturedInfoOpen(false)}
          listing={safeListingData as any}
          canUnfeature={isOwner || isAdmin}
          onUnfeatureSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/listings/${listingId}`] });
            queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
            setIsFeaturedInfoOpen(false);
          }}
        />
      )}

      {/* Feature upgrade dialog — triggered from edit form by owner or admin */}
      {featuredEnabled && (isOwner || isAdmin) && safeListingData.status === "ACTIVE" && !safeListingData.featured && (
        <FeatureUpgradeDialog
          isOpen={isFeatureUpgradeOpen}
          onClose={() => setIsFeatureUpgradeOpen(false)}
          listingId={safeListingData.id}
          listingTitle={safeListingData.title}
          adminComp={isAdmin && !isOwner}
          onFeatureSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/listings/${listingId}`] });
            queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
            setIsFeatureUpgradeOpen(false);
          }}
          redirectPath={`/for-sale/${listingId}`}
        />
      )}

      {/* Publish Payment Dialog */}
      <PublishPaymentDialog
        isOpen={isPublishDialogOpen}
        onClose={() => setIsPublishDialogOpen(false)}
        listingId={parseInt(listingId || '0')}
        onPublishSuccess={(updatedListing) => {
          queryClient.invalidateQueries({ queryKey: [`/api/listings/${listingId}`] });
          queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
          setIsPublishDialogOpen(false);
          toast({
            title: "Success",
            description: "Your listing has been published successfully",
          });
        }}
      />
    </div>
  );
}