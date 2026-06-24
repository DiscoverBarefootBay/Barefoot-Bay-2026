import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";

// Define a simplified Listing type for our edit page
interface Listing {
  id: number;
  createdBy: number;
  title: string;
  price: number;
  description?: string;
  listingType: string;
  address?: string;
  contactInfo: {
    name: string;
    phone: string;
    email: string;
  };
  photos?: string[];
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  yearBuilt?: number;
  expirationDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const [_, navigate] = useLocation();
  const { user } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Fetch the listing
  const { data: listing, isLoading, isError, error } = useQuery<Listing>({
    queryKey: ["listing", id],
    queryFn: async () => {
      const response = await fetch(`/api/listings/${id}`, {
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Failed to fetch listing");
      }
      return response.json();
    },
    enabled: !!id,
  });

  // Check if user is authorized to edit this listing
  useEffect(() => {
    if (listing && user) {
      const isOwner = listing.createdBy === user.id;
      const isAdmin = user.role === "admin";
      setIsAuthorized(isOwner || isAdmin);
    }
  }, [listing, user]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Listing>) => {
      const response = await fetch(`/api/listings/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update listing");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Listing updated",
        description: "Your listing has been updated successfully.",
      });
      navigate(`/for-sale/${id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Navigation handlers with proper useCallback
  const handleCancel = useCallback(() => {
    navigate(`/for-sale/${id}`);
  }, [navigate, id]);

  const handleBackToListings = useCallback(() => {
    navigate("/for-sale");
  }, [navigate]);

  // Form submission handler with proper useCallback
  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data: Record<string, any> = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });
    updateMutation.mutate(data as Partial<Listing>);
  }, [updateMutation]);

  // Handle cases where listing is not found or loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Error</h2>
          <p className="text-muted-foreground">{(error as Error).message}</p>
          <Button onClick={handleBackToListings} className="mt-4">
            Back to Listings
          </Button>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Unauthorized</h2>
          <p className="text-muted-foreground">You don't have permission to edit this listing.</p>
          <Button onClick={handleCancel} className="mt-4">
            Back to Listing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Listing</h1>
      
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            {listing && (
              <div className="p-4">
                <h2 className="text-xl font-semibold mb-4">Update listing information</h2>
                <p className="mb-4 text-gray-600">
                  Make changes to your listing below. All fields marked with an asterisk (*) are required.
                </p>
                <form 
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  {/* Listing Type (Read-only) */}
                  <div className="space-y-2">
                    <label htmlFor="listingType" className="block font-medium">Listing Type</label>
                    <div className="w-full p-2 border rounded-md bg-gray-50 text-gray-600">
                      {listing.listingType}
                    </div>
                    <p className="text-xs text-muted-foreground">Listing type cannot be changed after creation</p>
                  </div>
                  
                  {/* Title */}
                  <div className="space-y-2">
                    <label htmlFor="title" className="block font-medium">Title <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      id="title" 
                      name="title" 
                      defaultValue={listing.title} 
                      required 
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  
                  {/* Price */}
                  <div className="space-y-2">
                    <label htmlFor="price" className="block font-medium">Price <span className="text-red-500">*</span></label>
                    <input 
                      type="number" 
                      id="price" 
                      name="price" 
                      defaultValue={listing.price} 
                      min="0" 
                      step="0.01" 
                      required 
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  
                  {/* Description */}
                  <div className="space-y-2">
                    <label htmlFor="description" className="block font-medium">Description</label>
                    <textarea 
                      id="description" 
                      name="description" 
                      defaultValue={listing.description || ''} 
                      rows={6}
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  
                  {/* Submit button */}
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}