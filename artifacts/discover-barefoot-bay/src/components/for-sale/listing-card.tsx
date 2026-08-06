import { format, differenceInDays } from "date-fns";
import { Home, Bed, Bath, Ruler, CalendarDays, Phone, Mail, DollarSign, Tag, Clock, Pencil, Trash2, FileCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { type RealEstateListing } from "@shared/schema";
import { MediaGallery } from "@/components/shared/media-gallery";
import { ListingImage } from "@/components/for-sale/listing-image";

const typeColors = {
  FSBO: "bg-purple-100 text-purple-800",
  Agent: "bg-blue-100 text-blue-800",
  Rent: "bg-green-100 text-green-800",
  OpenHouse: "bg-yellow-100 text-yellow-800",
  Wanted: "bg-red-100 text-red-800",
  Classified: "bg-gray-100 text-gray-800",
} as const;

const typeLabels = {
  FSBO: "For Sale By Owner",
  Agent: "For Sale By Agent",
  Rent: "For Rent",
  OpenHouse: "Open House",
  Wanted: "Wanted",
  Classified: "Classified",
} as const;

export function ListingCard({ 
  listing, 
  listingTypes,
  onClick,
  isAdmin = false,
  onEdit,
  onDelete,
  onPublish,
  currentUserId,
  showActionButtons = true,
  isNew = false
}: { 
  listing: RealEstateListing, 
  listingTypes?: ReadonlyArray<{ value: string, label: string, color?: string }>,
  onClick?: () => void,
  isAdmin?: boolean,
  onEdit?: (id: number) => void,
  onDelete?: (id: number) => void,
  onPublish?: (id: number) => void,
  currentUserId?: number,
  showActionButtons?: boolean,
  isNew?: boolean
}) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  // Defensive programming to ensure listing and its properties exist
  if (!listing || !listing.listingType || !listing.id) {
    console.warn("Invalid listing data received:", listing);
    return null;
  }
  
  // Safe access to the listing type
  const listingType = String(listing.listingType);
  const isPropertyListing = ['FSBO', 'Agent', 'Rent', 'OpenHouse'].includes(listingType);
  
  // Safe date handling
  const createdAtDate = listing.createdAt ? new Date(listing.createdAt) : new Date();
  const expirationDate = listing.expirationDate ? new Date(listing.expirationDate) : null;
  
  // Check if listing is about to expire (7 days or less)
  const now = new Date();
  const daysUntilExpiration = expirationDate ? differenceInDays(expirationDate, now) : null;
  const isExpiringBadge = daysUntilExpiration !== null && daysUntilExpiration <= 7 && daysUntilExpiration >= 0;
  
  // Ensure contactInfo is an object
  const contactInfo = (typeof listing.contactInfo === 'object' && listing.contactInfo) 
    ? listing.contactInfo as { name?: string; phone?: string; email?: string } 
    : {};

  // FIXED DRAFT DETECTION LOGIC
  // Only use explicit status field to determine draft status
  const status = String(listing.status || "").toUpperCase();
  
  // Primary decision rule: A listing is a draft ONLY if its status is explicitly set to DRAFT
  const isDraft = status === "DRAFT";

  // A listing whose expiration date is in the past is effectively expired even
  // if the stored status hasn't been flipped to EXPIRED yet by the background
  // job. Display the effective status so the badge never shows a stale "ACTIVE".
  const isActuallyExpired = !!expirationDate && expirationDate < now;
  const effectiveStatus = !isDraft && isActuallyExpired ? "EXPIRED" : status;
  
  // Log the final decision for debugging
  console.warn(`LISTING DEBUG: ID: ${listing.id}, Title: "${listing.title}", Status: "${status}", Original: "${listing.status}", isDraft: ${isDraft}`);
  
  if (isDraft) {
    console.warn(`DRAFT STYLE APPLIED FOR LISTING #${listing.id} - ${listing.title}`);
    // Override the isDraft variable to ensure styling is applied
    const isDraftOverride = true;
    return (
      <Card className="overflow-hidden border-amber-500 border-[6px] shadow-lg bg-white">
        {/* Forced draft banner */}
        <div className="bg-amber-500 text-white px-3 py-3 font-bold flex items-center justify-between text-base sticky top-0">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="mr-2" viewBox="0 0 16 16">
              <path d="M12.643 15C13.979 15 15 13.845 15 12.5V5H1v7.5C1 13.845 2.021 15 3.357 15h9.286zM5.5 7h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1zM.8 1a.8.8 0 0 0-.8.8V3a.8.8 0 0 0 .8.8h14.4A.8.8 0 0 0 16 3V1.8a.8.8 0 0 0-.8-.8H.8z"/>
            </svg>
            <span className="text-lg uppercase">DRAFT LISTING</span>
          </div>
          <span className="text-sm bg-white text-amber-600 px-2 py-1 rounded-full">Not published</span>
        </div>
        
        {/* Rest of card content with standard rendering */}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary" className={typeColors[listingType as keyof typeof typeColors] || "bg-gray-100 text-gray-800"}>
                {typeLabels[listingType as keyof typeof typeLabels] || "Listing"}
              </Badge>
              
              {/* Status Badge - Always show DRAFT for this specific listing */}
              <Badge variant="default" className="bg-amber-500 text-white flex items-center gap-1 font-medium">
                <span className="inline-block w-2 h-2 rounded-full bg-white"></span>
                DRAFT
              </Badge>
              
              {/* Admin indicator if applicable */}
              {isAdmin && listing.createdBy && currentUserId && listing.createdBy !== currentUserId && (
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 ml-1">
                  Other User's Draft
                </Badge>
              )}
            </div>
            
            {listing.price && (
              <span className="text-lg font-bold">
                {(() => {
                  try {
                    // Make sure the price is a valid number
                    const price = Number(listing.price);
                    if (isNaN(price)) {
                      console.error("Invalid listing.price in card:", listing.price);
                      return "Price not available";
                    }
                    return formatter.format(price);
                  } catch (error) {
                    console.error("Price formatting error in card:", error);
                    return "Price not available";
                  }
                })()}
              </span>
            )}
          </div>
          <CardTitle className="text-xl mt-2">{listing.title}</CardTitle>
        </CardHeader>
        
        {/* Rest of the card content remains the same */}
        <CardContent className="space-y-4">
          {isPropertyListing && (
            <>
              {listing.address && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Home className="h-4 w-4" />
                  <span className="text-sm">{listing.address}</span>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <Bed className="h-4 w-4 text-muted-foreground" />
                  <span>{listing.bedrooms || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Bath className="h-4 w-4 text-muted-foreground" />
                  <span>{listing.bathrooms || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Ruler className="h-4 w-4 text-muted-foreground" />
                  <span>{listing.squareFeet || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span>{listing.yearBuilt || 'N/A'}</span>
                </div>
              </div>

              {listing.cashOnly && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Cash Only
                </Badge>
              )}
            </>
          )}

          {listing.description && (
            <p className="text-sm text-muted-foreground line-clamp-3">{listing.description}</p>
          )}

          {/* Photos Section */}
          {listing.photos && listing.photos.length > 0 && (
            <div className="w-full h-48 overflow-hidden">
              {/* Only show the first photo in the card view with our smart image component */}
              <ListingImage 
                src={listing.photos[0]}
                alt={listing.title || 'Property listing image'} 
                className="w-full h-full object-cover" 
              />
            </div>
          )}

          {/* Contact Information Section */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-semibold mb-2">Contact Information</h4>
            <div className="space-y-1 text-sm">
              {contactInfo.name && (
                <div>{contactInfo.name}</div>
              )}
              {contactInfo.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${contactInfo.phone}`} className="hover:underline">
                    {contactInfo.phone}
                  </a>
                </div>
              )}
              {contactInfo.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${contactInfo.email}`} className="hover:underline">
                    {contactInfo.email}
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <div>Listed on {(() => {
              try {
                // Verify the date is valid
                if (!createdAtDate || isNaN(createdAtDate.getTime())) {
                  console.error("Invalid createdAtDate in listing card:", listing.createdAt);
                  return "Invalid date";
                }
                return format(createdAtDate, "MMMM d, yyyy");
              } catch (error) {
                console.error("Date formatting error for createdAtDate in listing card:", error);
                return "Invalid date";
              }
            })()}</div>
            {isExpiringBadge && (
              <div className="flex items-center gap-1 mt-1 text-amber-600 font-medium">
                <Clock className="h-3 w-3" />
                <span>
                  {daysUntilExpiration === 0 
                    ? "Expires today" 
                    : `Expires in ${daysUntilExpiration} day${daysUntilExpiration !== 1 ? "s" : ""}`}
                </span>
              </div>
            )}
          </div>

          <div className="pt-2 flex flex-col gap-2">
            {/* Always show Publish button for this forced draft */}
            <Button 
              variant="secondary" 
              className="w-full flex items-center justify-center" 
              onClick={(e) => {
                e.stopPropagation();
                if (onPublish) onPublish(listing.id);
              }}
            >
              <FileCheck className="h-4 w-4 mr-2" />
              Publish Listing
            </Button>
            
            {/* Edit and Delete buttons */}
            {showActionButtons && (
              <div className="flex gap-2 mb-2">
                {onEdit && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 flex items-center justify-center" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(listing.id);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
                
                {onDelete && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 flex items-center justify-center text-destructive hover:text-destructive" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(listing.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            )}
            
            {/* View listing button */}
            {onClick ? (
              <Button className="w-full" onClick={onClick}>View Listing</Button>
            ) : (
              <Link href={`/for-sale/${listing.id}`}>
                <Button className="w-full">View Listing</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-white relative ${isDraft ? 'border-amber-500 border-[6px] shadow-lg' : ''} ${isNew ? 'border-red-500 border-[3px] shadow-lg ring-2 ring-red-300' : ''} ${listing.featured && !isDraft ? 'border-yellow-400 border-[3px] shadow-lg ring-2 ring-yellow-200' : ''}`}>
      {listing.featured && !isDraft && (
        <div className="absolute -top-2 -left-2 z-10 bg-yellow-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1">
          ★ Featured
        </div>
      )}
      {isNew && !isDraft && (
        <div className="absolute -top-2 -right-2 z-10 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
          New
        </div>
      )}
      <div className="rounded-lg overflow-hidden">
      {/* Add a super prominent draft banner at the top for draft listings */}
      {isDraft && (
        <div className="bg-amber-500 text-white px-3 py-3 font-bold flex items-center justify-between text-base sticky top-0">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="mr-2" viewBox="0 0 16 16">
              <path d="M12.643 15C13.979 15 15 13.845 15 12.5V5H1v7.5C1 13.845 2.021 15 3.357 15h9.286zM5.5 7h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1zM.8 1a.8.8 0 0 0-.8.8V3a.8.8 0 0 0 .8.8h14.4A.8.8 0 0 0 16 3V1.8a.8.8 0 0 0-.8-.8H.8z"/>
            </svg>
            <span className="text-lg uppercase">DRAFT LISTING</span>
          </div>
          <span className="text-sm bg-white text-amber-600 px-2 py-1 rounded-full">Not published</span>
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className={typeColors[listingType as keyof typeof typeColors] || "bg-gray-100 text-gray-800"}>
              {typeLabels[listingType as keyof typeof typeLabels] || "Listing"}
            </Badge>

            {listing.featured && !isDraft && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300 font-medium">
                ★ Featured
              </Badge>
            )}

            {/* Status Badge - Enhanced Version (uses effective status so a
                listing past its expiration date never shows a stale "ACTIVE") */}
            {effectiveStatus && (
              <Badge variant={isDraft ? "default" : "outline"} className={
                effectiveStatus === "DRAFT" ? "bg-amber-500 text-white flex items-center gap-1 font-medium" : 
                effectiveStatus === "ACTIVE" ? "bg-green-100 text-green-800 border-green-200 flex items-center gap-1 font-medium" : 
                effectiveStatus === "EXPIRED" ? "bg-red-500 text-white border-red-500 flex items-center gap-1 font-medium" : 
                "bg-gray-100 text-gray-800 border-gray-200 flex items-center gap-1 font-medium"
              }>
                <span className={`inline-block w-2 h-2 rounded-full ${
                  effectiveStatus === "DRAFT" ? "bg-white" :
                  effectiveStatus === "ACTIVE" ? "bg-green-500" :
                  effectiveStatus === "EXPIRED" ? "bg-red-500" :
                  "bg-gray-500"
                }`}></span>
                {effectiveStatus === "DRAFT" ? "DRAFT" : 
                 effectiveStatus === "ACTIVE" ? "ACTIVE" : 
                 effectiveStatus === "EXPIRED" ? "EXPIRED" : 
                 effectiveStatus || "UNKNOWN"}
              </Badge>
            )}
            
            {/* Admin indicator for other users' draft listings */}
            {isAdmin && listing.status === "DRAFT" && 
             listing.createdBy && currentUserId && listing.createdBy !== currentUserId && (
              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 ml-1">
                Other User's Draft
              </Badge>
            )}
          </div>
          
          {listing.price && (
            <span className="text-lg font-bold">
              {(() => {
                try {
                  // Make sure the price is a valid number
                  const price = Number(listing.price);
                  if (isNaN(price)) {
                    console.error("Invalid listing.price in card:", listing.price);
                    return "Price not available";
                  }
                  return formatter.format(price);
                } catch (error) {
                  console.error("Price formatting error in card:", error);
                  return "Price not available";
                }
              })()}
            </span>
          )}
        </div>
        <CardTitle className="text-xl mt-2">{listing.title}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {isPropertyListing && (
          <>
            {listing.address && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Home className="h-4 w-4" />
                <span className="text-sm">{listing.address}</span>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 text-sm">
              <div className="flex items-center gap-1">
                <Bed className="h-4 w-4 text-muted-foreground" />
                <span>{listing.bedrooms || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <Bath className="h-4 w-4 text-muted-foreground" />
                <span>{listing.bathrooms || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <Ruler className="h-4 w-4 text-muted-foreground" />
                <span>{listing.squareFeet || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span>{listing.yearBuilt || 'N/A'}</span>
              </div>
            </div>

            {listing.cashOnly && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                <DollarSign className="h-4 w-4 mr-1" />
                Cash Only
              </Badge>
            )}
          </>
        )}

        {listing.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">{listing.description}</p>
        )}

        {/* Photos Section */}
        {listing.photos && listing.photos.length > 0 && (
          <div className="w-full h-48 overflow-hidden">
            {/* Only show the first photo in the card view with our smart image component */}
            <ListingImage 
              src={listing.photos[0]}
              alt={listing.title || 'Property listing image'} 
              className="w-full h-full object-cover" 
            />
          </div>
        )}

        {/* Contact Information Section */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-semibold mb-2">Contact Information</h4>
          <div className="space-y-1 text-sm">
            {contactInfo.name && (
              <div>{contactInfo.name}</div>
            )}
            {contactInfo.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${contactInfo.phone}`} className="hover:underline">
                  {contactInfo.phone}
                </a>
              </div>
            )}
            {contactInfo.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${contactInfo.email}`} className="hover:underline">
                  {contactInfo.email}
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          <div>Listed on {(() => {
            try {
              // Verify the date is valid
              if (!createdAtDate || isNaN(createdAtDate.getTime())) {
                console.error("Invalid createdAtDate in listing card:", listing.createdAt);
                return "Invalid date";
              }
              return format(createdAtDate, "MMMM d, yyyy");
            } catch (error) {
              console.error("Date formatting error for createdAtDate in listing card:", error);
              return "Invalid date";
            }
          })()}</div>
          {isExpiringBadge && (
            <div className="flex items-center gap-1 mt-1 text-amber-600 font-medium">
              <Clock className="h-3 w-3" />
              <span>
                {daysUntilExpiration === 0 
                  ? "Expires today" 
                  : `Expires in ${daysUntilExpiration} day${daysUntilExpiration !== 1 ? "s" : ""}`}
              </span>
            </div>
          )}
        </div>

        {/* Action buttons including Publish for draft listings */}
        <div className="pt-2 flex flex-col gap-2">
          {/* Publish button for Draft listings */}
          {listing.status === "DRAFT" && onPublish && (
            <Button 
              variant="secondary" 
              className="w-full flex items-center justify-center" 
              onClick={(e) => {
                e.stopPropagation();
                onPublish(listing.id);
              }}
            >
              <FileCheck className="h-4 w-4 mr-2" />
              Publish Listing
            </Button>
          )}
          
          {/* Edit and Delete buttons for My Listings */}
          {showActionButtons && (onEdit || onDelete) && (
            <div className="flex gap-2 mb-2">
              {onEdit && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 flex items-center justify-center" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(listing.id);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              
              {onDelete && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 flex items-center justify-center text-destructive hover:text-destructive" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(listing.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          )}
          
          {/* View listing button */}
          {onClick ? (
            <Button className="w-full" onClick={onClick}>View Listing</Button>
          ) : (
            <Link href={`/for-sale/${listing.id}`}>
              <Button className="w-full">View Listing</Button>
            </Link>
          )}
        </div>
      </CardContent>
      </div>
    </Card>
  );
}