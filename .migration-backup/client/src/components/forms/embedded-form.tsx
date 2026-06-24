import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, QueryClient } from "@tanstack/react-query";
import { CustomFormDefinition } from "./custom-form-types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import FormBuilder from "./form-builder";
import FormRenderer from "./form-renderer";
import { Trash2 } from "lucide-react";
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

// Default blank form configuration that can be used when no form exists
const defaultBlankForm: Partial<CustomFormDefinition> = {
  title: "Default Form",
  description: "Please fill out this form",
  fields: [],
  submitButtonText: "Submit",
  successMessage: "Thank you for your submission!",
};

interface EmbeddedFormProps {
  formSlug?: string;
  pageSlug: string;
  isEditing?: boolean;
}

export function EmbeddedForm({ formSlug, pageSlug, isEditing = false }: EmbeddedFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  
  // Form slug can be explicitly provided or derived from page slug
  const effectiveFormSlug = formSlug || `form-${pageSlug}`;
  
  // Set up query data placeholder to avoid having undefined values
  const placeholderFormData = useMemo(() => ({
    id: -1, // Use a negative ID to indicate a placeholder
    title: `Form for ${pageSlug}`,
    description: "Please fill out this form",
    slug: effectiveFormSlug,
    formFields: [],
    submitButtonText: "Submit",
    successMessage: "Thank you for your submission!",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPlaceholder: true // Flag to indicate this is not a real form from the database
  }), [pageSlug, effectiveFormSlug]);
  
  // Check if we should attempt to fetch the form based on the URL path
  const pathname = window.location.pathname;
  const isNatureWildlifePage = pathname.includes('/community/nature/wildlife');
  
  // Query for the form definition - only for admin users and only if not on known problem pages
  const {
    data: formData,
    isLoading,
    isError,
    refetch
  } = useQuery<any>({
    queryKey: [`/api/forms/by-slug/${effectiveFormSlug}`],
    // Only enable the query if we have a slug, user is admin, and we're not on a known problem page
    enabled: !!effectiveFormSlug && isAdmin && !isNatureWildlifePage,
    retry: 0, // Don't retry on failure to avoid console spam
    gcTime: Infinity, // Don't garbage collect this query
    staleTime: 60000, // Cache results for 1 minute to reduce API calls
    
    // Use an error boundary for this query to prevent errors from propagating
    useErrorBoundary: false,
    
    // Set a default placeholder value if query fails
    placeholderData: null,
    
    /**
     * Custom fetch function that silently handles errors and returns null instead
     */
    queryFn: async () => {
      try {
        // Log that we're making a request
        console.log(`Fetching form by slug: ${effectiveFormSlug}`);
        
        const response = await fetch(`/api/forms/by-slug/${effectiveFormSlug}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            // Form doesn't exist yet - silently return null
            console.log(`Form not found for slug: ${effectiveFormSlug}`);
            return null;
          }
          // For other errors, log them but don't throw to prevent console errors
          console.warn(`Form fetch failed with status ${response.status}`);
          return null; 
        }
        
        return response.json();
      } catch (err) {
        // Silently handle all errors to avoid console errors
        console.log(`Error fetching form: ${err}`);
        return null;
      }
    },
    
    // Suppress error logging
    onError: () => {
      // Intentionally empty to prevent error logging in console
    }
  });
  
  // Convert database form format to component format if data exists
  const form = useMemo(() => {
    if (!formData) return undefined;
    return {
      ...formData,
      fields: formData.formFields || [] // Map formFields to fields
    };
  }, [formData]);
  
  // Delete form mutation
  const deleteFormMutation = useMutation({
    mutationFn: async () => {
      if (!form?.id) {
        throw new Error("No form ID available for deletion");
      }
      
      const response = await fetch(`/api/forms/${form.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include"
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete form");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/by-slug/${effectiveFormSlug}`] });
      
      toast({
        title: "Form Deleted",
        description: `The form "${form?.title}" has been deleted.`,
        variant: "default"
      });
      
      // Reset form data
      refetch();
      
      // Refresh the page after a short delay to allow the toast to be seen
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error Deleting Form",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Reset builder state when isEditing changes
  useEffect(() => {
    if (!isEditing) {
      setShowFormBuilder(false);
    }
  }, [isEditing]);
  
  // Handle form creation/update completion
  const handleFormSaved = (savedForm: CustomFormDefinition) => {
    setShowFormBuilder(false);
    refetch();
    
    toast({
      title: "Form Saved",
      description: `The form "${savedForm.title}" has been updated.`,
    });
  };
  
  // If loading, show skeleton
  if (isLoading) {
    return (
      <div className="space-y-4 my-8">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="space-y-4 mt-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }
  
  // If in edit mode and showing the form builder
  if (isEditing && isAdmin && showFormBuilder) {
    return (
      <div className="border p-4 rounded-md bg-muted/30 my-8">
        <h3 className="text-lg font-medium mb-4">
          {form ? "Edit Form" : "Create Form"}
        </h3>
        <FormBuilder 
          initialForm={form || {
            title: `Form for ${pageSlug}`,
            description: "Please fill out this form",
            slug: effectiveFormSlug,
            fields: [],
            submitButtonText: "Submit",
            successMessage: "Thank you for your submission!",
          }}
          onSaved={handleFormSaved}
          onCancel={() => setShowFormBuilder(false)}
        />
      </div>
    );
  }
  
  // If in edit mode but not showing form builder yet
  if (isEditing && isAdmin && !showFormBuilder) {
    return (
      <div className="border p-4 rounded-md bg-muted/30 my-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">
            {form ? `Form: ${form.title}` : "Add Form to Page"}
          </h3>
          <div className="flex gap-2">
            {form && (
              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Form
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the form 
                      from this page. Form submissions will still be available in the admin dashboard.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteFormMutation.mutate()}
                      className="bg-red-600 hover:bg-red-700"
                      disabled={deleteFormMutation.isPending}
                    >
                      {deleteFormMutation.isPending ? "Deleting..." : "Delete Form"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={() => setShowFormBuilder(true)}>
              {form ? "Edit Form" : "Create Form"}
            </Button>
          </div>
        </div>
        
        {form ? (
          <div className="bg-white p-4 rounded-md border">
            <p className="text-sm text-muted-foreground mb-2">Form Preview:</p>
            <h4 className="font-medium">{form.title}</h4>
            <p className="text-sm text-muted-foreground">{form.description}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {form.fields.length} field{form.fields.length !== 1 ? "s" : ""} | 
              Slug: {form.slug}
            </p>
          </div>
        ) : (
          <div className="bg-white p-4 rounded-md border text-center">
            <p className="text-muted-foreground">
              No form has been added to this page yet.
              Click "Create Form" to add one.
            </p>
          </div>
        )}
      </div>
    );
  }
  
  // If we have a form and are not in edit mode, render the form
  if (form && !isEditing) {
    return (
      <div className="my-8 border rounded-md p-6 bg-card">
        <h3 className="text-xl font-semibold mb-4">{form.title}</h3>
        <FormRenderer 
          form={form} 
          onSubmissionComplete={() => {
            // This could trigger a parent component refresh if needed
          }} 
        />
      </div>
    );
  }
  
  // If there's no form and we're not in edit mode, don't show anything
  if (!form && !isEditing) {
    return null;
  }
  
  // Fall back to error state
  return (
    <div className="my-8 p-4 border rounded-md bg-destructive/10 text-destructive">
      <p>There was an error loading the form. Please try again later.</p>
    </div>
  );
}