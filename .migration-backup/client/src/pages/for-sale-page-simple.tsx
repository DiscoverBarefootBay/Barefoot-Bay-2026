import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { type RealEstateListing } from "@shared/schema";

export default function ForSalePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Visit tracking is deferred - will be called after listings load
  // to avoid clearing "new" status before the user sees the listings

  const { 
    data: listings = [], 
    isLoading,
    isError,
    error,
  } = useQuery<RealEstateListing[]>({
    queryKey: ["/api/listings"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/listings?excludeDrafts=true");
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.error("Error fetching listings:", err);
        throw err;
      }
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p>Loading listings...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-red-500">Error loading listings: {error?.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">For Sale</h1>
      
      <div className="grid gap-6">
        {listings.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-lg text-muted-foreground">
              No listings found.
            </p>
          </div>
        ) : (
          listings.map((listing) => (
            <div key={listing.id} className="border rounded-lg p-4">
              <h3 className="text-xl font-semibold">{listing.title}</h3>
              <p className="text-gray-600">{listing.description}</p>
              {listing.price && (
                <p className="text-lg font-bold text-green-600">
                  ${listing.price.toLocaleString()}
                </p>
              )}
              <p className="text-sm text-gray-500">Type: {listing.listingType}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}