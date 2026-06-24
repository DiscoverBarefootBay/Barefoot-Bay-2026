import React from 'react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Calendar, InfoIcon } from 'lucide-react';
import type { RealEstateListing } from '@shared/schema';

type SubscriptionManagerProps = {
  listingId: number;
  subscriptionId: string | null;
};

export default function SubscriptionManager({ listingId }: SubscriptionManagerProps) {
  // Query to fetch listing details to get the expiration date
  const { data: listing } = useQuery<RealEstateListing>({
    queryKey: [`/api/listings/${listingId}`],
    enabled: !!listingId,
  });

  // Format the expiration date
  const formatDate = (dateString: string | Date | undefined) => {
    if (!dateString) return 'No expiration date set';
    const date = new Date(dateString);
    
    // Check if the date is valid (not 1970-01-01 which is used as a null placeholder)
    if (date.getFullYear() <= 1970) return 'No expiration date set';
    
    return format(date, 'MMMM d, yyyy');
  };

  // Calculate days remaining until expiration
  const getDaysRemaining = (expirationDate: string | Date | undefined) => {
    if (!expirationDate) return 0;
    
    const expDate = new Date(expirationDate);
    
    // Check if the date is valid (not 1970-01-01 which is used as a null placeholder)
    if (expDate.getFullYear() <= 1970) return 0;
    
    const today = new Date();
    
    // Set both dates to midnight for accurate day calculation
    expDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  // If no expiration date is set, calculate a default one (30 days from creation date)
  const getDefaultExpirationDate = () => {
    if (!listing) return new Date();
    
    const creationDate = new Date(listing.createdAt || new Date());
    const defaultExpiration = new Date(creationDate);
    defaultExpiration.setDate(defaultExpiration.getDate() + 30);
    return defaultExpiration;
  };

  // Check if this is a draft listing
  const isDraft = listing?.status === "DRAFT";

  // For draft listings, don't show an expiration date
  // For published listings, use the existing expiration date or calculate a default one
  const expirationDate = isDraft ? null : (listing?.expirationDate ? new Date(listing.expirationDate) : getDefaultExpirationDate());

  const daysRemaining = isDraft ? 0 : getDaysRemaining(expirationDate);
  
  // Display listing expiration information
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Listing Expiration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-md">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-muted-foreground" />
                <div>
                  <p className="font-medium">Expires On</p>
                  {isDraft ? (
                    <p className="text-amber-600 font-medium">Will be set when published</p>
                  ) : (
                    <p className="text-muted-foreground">{formatDate(expirationDate)}</p>
                  )}
                </div>
              </div>
              <div>
                {isDraft ? (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                    Draft listing
                  </span>
                ) : daysRemaining <= 0 ? (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                    No valid expiration
                  </span>
                ) : (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    daysRemaining <= 5 ? 'bg-red-100 text-red-800' : 
                    daysRemaining <= 10 ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-green-100 text-green-800'
                  }`}>
                    {daysRemaining} days remaining
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <InfoIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              Your listing will automatically expire as indicated. After expiration, it will be hidden from the public but remain visible in your 'My Listings' section with an 'Expired' label for a limited time. To list your item again, you'll need to use additional credits to republish it.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}