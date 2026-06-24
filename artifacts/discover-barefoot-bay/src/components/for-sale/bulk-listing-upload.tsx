import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Upload, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/use-permissions";

export function BulkListingUpload() {
  const { isAdmin } = usePermissions();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/listings/bulk", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload listings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      setIsDialogOpen(false);
      toast({
        title: "Success",
        description: "Listings uploaded successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "text/csv") {
      toast({
        title: "Error",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("listings", file);
    uploadMutation.mutate(formData);
  };

  if (!isAdmin) return null;

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Bulk Upload Listings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Upload Listings</DialogTitle>
          <DialogDescription>
            Upload multiple real estate listings using a CSV file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              CSV file must include the following columns:
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>title (required) - Property title</li>
                <li>description (required) - Property description</li>
                <li>price (required) - Price in USD</li>
                <li>location (required) - Property address</li>
                <li>type (required) - FSBO/RENTAL/LEASE</li>
                <li>bedrooms - Number of bedrooms</li>
                <li>bathrooms - Number of bathrooms</li>
                <li>squareFeet - Property size in square feet</li>
                <li>amenities - Comma-separated list of amenities</li>
                <li>contactName - Contact person name</li>
                <li>contactEmail - Contact email</li>
                <li>contactPhone - Contact phone number</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="flex justify-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload">
              <Button
                variant="outline"
                className="cursor-pointer"
                disabled={uploadMutation.isPending}
                asChild
              >
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {uploadMutation.isPending ? "Uploading..." : "Choose CSV File"}
                </div>
              </Button>
            </label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
