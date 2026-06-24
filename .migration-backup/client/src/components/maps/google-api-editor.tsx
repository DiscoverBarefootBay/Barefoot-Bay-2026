import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

// Define the schema for Google API config
const googleApiConfigSchema = z.object({
  mapsApiKey: z.string().min(1, "Maps API Key is required"),
  placesApiKey: z.string().min(1, "Places API Key is required"),
  geminiApiKey: z.string().min(1, "Gemini API Key is required")
});

type GoogleApiConfig = z.infer<typeof googleApiConfigSchema>;

export default function GoogleApiEditor() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  // Fetch the current Google API configuration
  const { data: googleConfig, isLoading, error } = useQuery({
    queryKey: ["/api/google/config"],
    enabled: true,
  });

  // Mutation to update Google API configuration
  const updateGoogleConfigMutation = useMutation({
    mutationFn: async (data: GoogleApiConfig) => {
      const response = await fetch("/api/google/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to update Google API configuration");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Google API configuration has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/google/config"] });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Set up form with react-hook-form
  const form = useForm<GoogleApiConfig>({
    resolver: zodResolver(googleApiConfigSchema),
    defaultValues: {
      mapsApiKey: "",
      placesApiKey: "",
      geminiApiKey: ""
    },
  });

  // Update form values when data is loaded
  useEffect(() => {
    if (googleConfig) {
      form.reset({
        mapsApiKey: googleConfig.mapsApiKey || "",
        placesApiKey: googleConfig.placesApiKey || "",
        geminiApiKey: googleConfig.geminiApiKey || ""
      });
    }
  }, [googleConfig, form]);

  // Submit handler
  const onSubmit = (data: GoogleApiConfig) => {
    updateGoogleConfigMutation.mutate(data);
  };

  // Handle cancel button
  const handleCancel = () => {
    form.reset({
      mapsApiKey: googleConfig?.mapsApiKey || "",
      placesApiKey: googleConfig?.placesApiKey || "",
      geminiApiKey: googleConfig?.geminiApiKey || ""
    });
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2">Loading configuration...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded-md text-red-600">
        <p>Error loading Google API configuration. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-md p-4 bg-card">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Maps API Key Field */}
          <FormField
            control={form.control}
            name="mapsApiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Google Maps API Key</FormLabel>
                <FormControl>
                  <div className="flex">
                    <Input
                      placeholder="Enter Google Maps API key"
                      {...field}
                      type={isEditing ? "text" : "password"}
                      disabled={!isEditing}
                      className="flex-1"
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  API key for Google Maps integration.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Places API Key Field */}
          <FormField
            control={form.control}
            name="placesApiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Google Places API Key</FormLabel>
                <FormControl>
                  <div className="flex">
                    <Input
                      placeholder="Enter Google Places API key"
                      {...field}
                      type={isEditing ? "text" : "password"}
                      disabled={!isEditing}
                      className="flex-1"
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  API key for Google Places integration (location search/autocomplete).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Gemini API Key Field */}
          <FormField
            control={form.control}
            name="geminiApiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Google Gemini API Key</FormLabel>
                <FormControl>
                  <div className="flex">
                    <Input
                      placeholder="Enter Google Gemini API key"
                      {...field}
                      type={isEditing ? "text" : "password"}
                      disabled={!isEditing}
                      className="flex-1"
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  API key for Google Gemini AI integration (used for search features).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            {isEditing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={updateGoogleConfigMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateGoogleConfigMutation.isPending}
                >
                  {updateGoogleConfigMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={() => setIsEditing(true)}
                variant="default"
              >
                Edit Configuration
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}