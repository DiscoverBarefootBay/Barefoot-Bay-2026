import { format } from "date-fns";
import { Home, Bed, Bath, Ruler, CalendarDays, Phone, Mail, DollarSign, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { type RealEstateListing } from "@shared/schema";
import { MediaGallery } from "@/components/shared/media-gallery";

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
  onClick
}: { 
  listing: RealEstateListing, 
  listingTypes?: { value: string, label: string, color: string }[],
  onClick?: () => void 
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
  
  // Ensure contactInfo is an object
  const contactInfo = (typeof listing.contactInfo === 'object' && listing.contactInfo) 
    ? listing.contactInfo as { name?: string; phone?: string; email?: string } 
    : {};

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Badge variant="secondary" className={typeColors[listingType as keyof typeof typeColors] || "bg-gray-100 text-gray-800"}>
            {typeLabels[listingType as keyof typeof typeLabels] || "Listing"}
          </Badge>
          {listing.price && (
            <span className="text-lg font-bold">{formatter.format(listing.price)}</span>
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
            <MediaGallery mediaUrls={listing.photos} thumbnailMode />
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
          Listed on {format(createdAtDate, "MMMM d, yyyy")}
        </div>

        <div className="pt-2">
          <Link href={`/real-estate/${listing.id}`}>
            <Button className="w-full">View Listing</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}