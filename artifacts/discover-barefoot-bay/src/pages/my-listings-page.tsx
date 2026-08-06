import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Edit, Trash2, Search, Star } from "lucide-react";
import { ListingImage } from "@/components/for-sale/listing-image";
import PublishPaymentDialog from "@/components/for-sale/publish-payment-dialog-new";
import FeatureUpgradeDialog from "@/components/for-sale/feature-upgrade-dialog";
import { ForSaleLoadingAnimation } from "@/components/for-sale/loading-animation";
import { useFlags } from "@/hooks/use-flags";

interface RealEstateListing {
  id: number;
  title: string;
  description?: string;
  price: number;
  address?: string;
  status: string;
  listingType: string;
  photos?: string[];
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  expirationDate?: string;
  featured?: boolean;
  createdByUsername?: string;
  createdByFullName?: string;
  createdByEmail?: string;
}

export default function MyListingsPage() {
  const { isFeaturedListingsEnabled } = useFlags();
  const featuredEnabled = isFeaturedListingsEnabled();
  const [searchTerm, setSearchTerm] = useState("");
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [publishingListingId, setPublishingListingId] = useState<number | null>(null);
  const [featuringListing, setFeaturingListing] = useState<RealEstateListing | null>(null);
  const [adminView, setAdminView] = useState(false);
  const [, setLocation] = useLocation();

  // Get current user from auth context or API
  const { data: authData, isLoading: isAuthLoading, isFetched: isAuthFetched } = useQuery({
    queryKey: ["/api/auth/check"],
    queryFn: async () => {
      const response = await fetch("/api/auth/check");
      if (!response.ok) throw new Error("Not authenticated");
      return response.json();
    },
  });

  const user = authData?.user;
  const isAdmin = user?.role === 'admin';

  // Redirect to login if auth check is complete and no user found
  useEffect(() => {
    if (isAuthFetched && !isAuthLoading && !user) {
      setLocation("/login");
    }
  }, [isAuthFetched, isAuthLoading, user, setLocation]);

  // Fetch user's listings or all listings for admin
  const { 
    data: listings = [], 
    isLoading,
    isError,
    error,
  } = useQuery<RealEstateListing[]>({
    queryKey: [isAdmin && adminView ? "/api/admin/all-listings" : "/api/listings", user?.id, adminView],
    queryFn: async () => {
      if (!user?.id) return [];
      
      try {
        let url;
        if (isAdmin && adminView) {
          url = '/api/admin/all-listings';
          console.log(`[DEBUG] Admin fetching all listings from ${url}`);
        } else {
          url = `/api/listings?userId=${user.id}`;
          console.log(`[DEBUG] Fetching user listings from ${url}`);
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Error ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`[DEBUG] Successfully fetched ${data.length || 0} listings`);
        
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.error("Error fetching listings:", err);
        return [];
      }
    },
    enabled: !!user?.id,
  });

  // Filter listings based on search term
  const filteredListings = listings.filter(listing => {
    if (!searchTerm) return true;
    return listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           listing.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           listing.address?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Count listings by status
  const statusCounts = {
    draft: listings.filter(l => l.status === "DRAFT").length,
    active: listings.filter(l => l.status === "ACTIVE").length,
    expired: listings.filter(l => l.status === "EXPIRED").length,
    total: listings.length
  };

  // Handle publish listing
  const handlePublish = (listingId: number) => {
    setPublishingListingId(listingId);
    setIsPublishDialogOpen(true);
  };

  // Handle successful publish
  const handlePublishSuccess = (updatedListing: any) => {
    // Refresh the listings data
    window.location.reload();
  };

  // Show loading animation while auth is loading or while redirect is pending
  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ForSaleLoadingAnimation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isAdmin && adminView ? "All Listings (Admin View)" : "My Listings"}
              </h1>
              <p className="text-gray-600 mt-2">
                {isAdmin && adminView 
                  ? "Viewing all user listings with admin privileges" 
                  : "Manage your property listings and drafts"
                }
              </p>
              {/* Status summary */}
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
                <span>Total: <strong>{statusCounts.total}</strong></span>
                <span>Drafts: <strong>{statusCounts.draft}</strong></span>
                <span>Active: <strong>{statusCounts.active}</strong></span>
                <span>Expired: <strong>{statusCounts.expired}</strong></span>
              </div>
            </div>
            {/* Admin Toggle */}
            {isAdmin && (
              <div className="flex flex-col gap-2">
                <Button
                  variant={adminView ? "default" : "outline"}
                  onClick={() => setAdminView(!adminView)}
                  className="w-full lg:w-auto"
                >
                  {adminView ? "Switch to My Listings" : "View All Listings"}
                </Button>
                {adminView && (
                  <span className="text-xs text-orange-600 font-medium text-center lg:text-right">
                    Admin Mode Active
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search listings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Listings Content */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-coral" />
              <span className="ml-2 text-gray-600">Loading your listings...</span>
            </div>
          </div>
        ) : isError ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Listings</h3>
              <p className="text-gray-600">{error instanceof Error ? error.message : "An unexpected error occurred."}</p>
            </div>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {listings.length === 0 ? "No Listings Yet" : "No Results Found"}
              </h3>
              <p className="text-gray-600 mb-4">
                {listings.length === 0 
                  ? "You haven't created any listings yet."
                  : "Try adjusting your search terms."
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredListings.map((listing) => (
              <Card key={listing.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  {/* Listing Image */}
                  <div className="aspect-video bg-gray-100 rounded-lg mb-3 overflow-hidden">
                    {listing.photos && listing.photos.length > 0 ? (
                      <ListingImage
                        src={listing.photos[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <span>No Image</span>
                      </div>
                    )}
                  </div>

                  {/* Listing Details */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">
                        {listing.title}
                      </h3>
                      <div className="ml-2 flex flex-shrink-0 gap-1">
                        {featuredEnabled && listing.featured && listing.status === "ACTIVE" && (
                          <Badge className="bg-yellow-500 text-white hover:bg-yellow-500">
                            ★ Featured
                          </Badge>
                        )}
                        <Badge 
                          variant={listing.status === "ACTIVE" ? "default" : 
                                  listing.status === "DRAFT" ? "secondary" : "destructive"}
                        >
                          {listing.status}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Admin view shows creator information prominently at top */}
                    {isAdmin && adminView && (listing.createdByUsername || listing.createdByFullName) && (
                      <div className="bg-orange-50 border border-orange-300 rounded-md p-2 mb-2">
                        <p className="text-sm font-bold text-orange-900">
                          👤 Created by: {listing.createdByFullName || listing.createdByUsername}
                        </p>
                        <p className="text-xs text-orange-700">
                          📧 {listing.createdByEmail} • ID: {listing.createdBy}
                        </p>
                      </div>
                    )}
                    
                    {listing.price > 0 && (
                      <p className="text-lg font-bold text-green-600">
                        ${listing.price.toLocaleString()}
                      </p>
                    )}
                    
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {listing.description}
                    </p>
                    
                    {listing.address && (
                      <p className="text-sm text-gray-500 line-clamp-1">
                        {listing.address}
                      </p>
                    )}
                    

                    
                    <p className="text-xs text-gray-400">
                      {listing.listingType} • Created {new Date(listing.createdAt).toLocaleDateString()}
                    </p>
                    
                    {listing.expirationDate && (
                      <p className="text-xs text-gray-400">
                        Expires on {new Date(listing.expirationDate).toLocaleDateString()}
                      </p>
                    )}
                    
                    {/* For non-admin view or regular users, show creator info less prominently */}
                    {(!isAdmin || !adminView) && listing.createdByUsername && (
                      <p className="text-xs text-gray-400">
                        Created By {listing.createdByFullName || listing.createdByUsername}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 mt-4">
                    {/* Publish button for Draft listings */}
                    {listing.status === "DRAFT" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handlePublish(listing.id)}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        Publish Listing
                      </Button>
                    )}
                    
                    {/* Featured upgrade for Active listings */}
                    {featuredEnabled && listing.status === "ACTIVE" && !listing.featured && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFeaturingListing(listing)}
                        className="w-full border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                      >
                        <Star className="h-4 w-4 mr-1" />
                        Upgrade to Featured
                      </Button>
                    )}

                    {/* Republish button for Expired listings */}
                    {listing.status === "EXPIRED" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handlePublish(listing.id)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Republish Listing
                      </Button>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = `/for-sale/${listing.id}`}
                        className="flex-1"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/for-sale/${listing.id}`, '_blank')}
                        className="flex-1"
                      >
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      {/* Publish Payment Dialog */}
      {publishingListingId && (
        <PublishPaymentDialog
          isOpen={isPublishDialogOpen}
          onClose={() => {
            setIsPublishDialogOpen(false);
            setPublishingListingId(null);
          }}
          listingId={publishingListingId}
          onPublishSuccess={handlePublishSuccess}
          redirectPath="/my-listings"
        />
      )}

      {/* Featured Upgrade Dialog */}
      {featuredEnabled && featuringListing && (
        <FeatureUpgradeDialog
          isOpen={!!featuringListing}
          onClose={() => setFeaturingListing(null)}
          listingId={featuringListing.id}
          listingTitle={featuringListing.title}
          onFeatureSuccess={() => window.location.reload()}
          redirectPath="/my-listings"
        />
      )}
    </div>
  );
}