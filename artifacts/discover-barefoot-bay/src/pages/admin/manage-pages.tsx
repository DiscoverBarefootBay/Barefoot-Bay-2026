import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUp, ArrowDown, Edit, Trash, Plus, Save, ExternalLink } from "lucide-react";
import { ContentEditor } from "@/components/admin/content-editor";
import { GenericPageLoading } from "@/components/shared/generic-page-loading";
import { Badge } from "@/components/ui/badge";
import ManageCommunityCategories from "@/components/admin/manage-community-categories";

// Instead of hardcoded categories, we'll fetch them from the API
// This is just a fallback in case the API call fails
const FALLBACK_CATEGORIES = [
  "Government & Regulations",
  "Safety & Emergency Services",
  "Community Information",
  "Local Services & Resources", 
  "Nature & Environment",
  "Transportation & Accessibility",
  "Religion & Community Engagement",
  "Amenities & Recreation",
  "Preferred Vendors"
];

// Schema for the form
const pageFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  content: z.string().min(1, "Content is required"),
  category: z.string().min(1, "Category is required"),
  order: z.number().optional(),
});

type PageFormValues = z.infer<typeof pageFormSchema>;

export default function ManagePagesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const isAdmin = user?.role === 'admin';

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [editorContent, setEditorContent] = useState("");
  // Tracks which open page-edit dialog the admin is trying to close while it
  // has unsaved edits. `null` means no pending close, which also drives the
  // discard-confirmation alert dialog's open state.
  const [pendingDialogClose, setPendingDialogClose] = useState<
    null | "add" | "edit"
  >(null);
  
  // Get all pages
  const {
    data: pages,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/pages"],
    queryFn: async () => {
      const response = await fetch("/api/pages");
      if (!response.ok) throw new Error("Failed to fetch pages");
      return response.json();
    },
  });
  
  // Get all community categories
  const {
    data: communityCategoriesData,
    isLoading: isCategoriesLoading,
    error: categoriesError
  } = useQuery({
    queryKey: ["/api/community-categories"],
    queryFn: async () => {
      const response = await fetch("/api/community-categories");
      if (!response.ok) throw new Error("Failed to fetch community categories");
      return response.json();
    },
  });
  
  // Extract category names from the community categories data
  const communityCategories = communityCategoriesData ? 
    communityCategoriesData.map((category: any) => category.name) : 
    FALLBACK_CATEGORIES;

  // Function to extract category from slug
  const getCategoryFromSlug = (slug: string): string => {
    if (!slug) return "Uncategorized";
    
    // First extract the prefix from the slug (first part before any dash or slash)
    let prefix = "";
    if (slug.includes("/")) {
      // Handle path format like "more/government/bbrd" or "community/test"
      const parts = slug.split("/");
      // Always use the first part after any leading section (either index 0 or 1)
      if (parts.length >= 2) {
        // If the first part is "more", use the second part
        if (parts[0] === "more" && parts.length >= 3) {
          prefix = parts[1];
        } else {
          // Otherwise use the first part
          prefix = parts[0];
        }
      }
    } else if (slug.includes("-")) {
      // Handle dash format like "government-bbrd"
      prefix = slug.split("-")[0];
    } else {
      // Just use the whole slug if no separator
      prefix = slug;
    }
    
    // Early return if no prefix found
    if (!prefix) return "Uncategorized";
    
    // Map prefixes to matching categories from the navigation menu
    const prefixToCategory: Record<string, string> = {
      'government': 'Government & Regulations',
      'safety': 'Safety & Emergency Services',
      'community': 'Community Information',
      'services': 'Local Services & Resources',
      'nature': 'Nature & Environment',
      'transportation': 'Transportation & Accessibility',
      'religion': 'Religion & Community Engagement',
      'amenities': 'Nature & Environment'   // map older pages to appropriate new categories
      // Removed 'vendors' mapping to prevent vendor pages from showing in Local Services
    };
    
    // Try to match the prefix with community categories
    if (communityCategoriesData && communityCategoriesData.length > 0) {
      // First try to find a direct match
      const matchingCategory = communityCategoriesData.find((category: any) => {
        const categoryPrefix = category.slug.split('-')[0];
        return prefix === categoryPrefix;
      });
      
      if (matchingCategory) {
        return matchingCategory.name;
      }
      
      // If we have a known mapping for this prefix
      if (prefixToCategory[prefix] && 
          communityCategoriesData.some(cat => cat.name === prefixToCategory[prefix])) {
        return prefixToCategory[prefix];
      }
    }
    
    // Fallback to hardcoded mapping
    if (prefixToCategory[prefix]) {
      return prefixToCategory[prefix];
    }
    
    // Last resort fallback to prefix name (title case)
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  };
  
  // Function to convert category to slug prefix
  const getCategoryPrefix = (category: string): string => {
    // First try to find the slug from community categories data
    if (communityCategoriesData) {
      const matchingCategory = communityCategoriesData.find((cat: any) => 
        cat.name === category
      );
      
      if (matchingCategory) {
        // Extract just the prefix part of the slug (before any '-')
        const parts = matchingCategory.slug.split('-');
        return parts[0];
      }
    }
    
    // Map category names to appropriate URL prefixes (matching the navigation)
    const categoryMapping: Record<string, string> = {
      "Government & Regulations": "government",
      "Safety & Emergency Services": "safety",
      "Community Information": "community",
      "Local Services & Resources": "services",
      "Nature & Environment": "nature",
      "Transportation & Accessibility": "transportation",
      "Religion & Community Engagement": "religion",
      
      // Legacy category mappings
      "Government & Regulation": "government",
      "Community News": "community",
      "Resident Resources": "services",
      "Homeowners Association": "homeowners",
      "Recreation & Parks": "amenities",
      "Events & Activities": "events",
      "Amenities & Recreation": "amenities",
      "Preferred Vendors": "vendors"
    };
    
    if (categoryMapping[category]) {
      return categoryMapping[category];
    }
    
    // Convert to lowercase and use first word as a fallback
    return category.toLowerCase().split(/\s+/)[0];
  };
  
  // Function to format page URLs to match navigation format
  const getFormattedPageUrl = (slug: string, categoryPrefix: string): string => {
    // If the slug already contains the category prefix (like "religion-submissions")
    // Format it as "/community/categoryPrefix/pageName" (like "/community/religion/submissions")
    
    if (slug.includes('-')) {
      const pageName = slug.split('-')[1];
      return `/community/${categoryPrefix}/${pageName}`;
    }
    
    // If the slug doesn't follow the expected format, return the default path
    return `/community/${slug}`;
  };
  
  // Group pages by category
  const pagesByCategory = pages ? pages.reduce((acc: Record<string, any[]>, page: any) => {
    // Extract category from slug using the same function as form
    let category = getCategoryFromSlug(page.slug);
    
    // Initialize category array if it doesn't exist
    if (!acc[category]) acc[category] = [];
    
    // Add page to category
    acc[category].push(page);
    return acc;
  }, {}) : {};
  
  // Sort each category's pages by order (ascending)
  Object.keys(pagesByCategory).forEach(category => {
    pagesByCategory[category].sort((a, b) => {
      // Use order field or fallback to id if order is not set (null/undefined)
      const orderA = a.order !== null && a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
      const orderB = b.order !== null && b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
  });

  // Form for adding/editing pages
  const form = useForm<PageFormValues>({
    resolver: zodResolver(pageFormSchema),
    defaultValues: {
      title: "",
      slug: "",
      content: "",
      category: "",
    },
  });

  // Set form values when editing a page
  useEffect(() => {
    if (selectedPage && isEditDialogOpen) {
      form.reset({
        title: selectedPage.title,
        slug: selectedPage.slug,
        content: selectedPage.content,
        category: getCategoryFromSlug(selectedPage.slug),
      });
      setEditorContent(selectedPage.content);
    }
  }, [selectedPage, isEditDialogOpen, form]);

  // Create page mutation
  const createPageMutation = useMutation({
    mutationFn: async (data: PageFormValues) => {
      const response = await apiRequest("POST", "/api/pages", {
        ...data,
        mediaUrls: [],
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({
        title: "Success",
        description: "Page created successfully",
      });
      setIsAddDialogOpen(false);
      form.reset({
        title: "",
        slug: "",
        content: "",
        category: "",
      });
      setEditorContent("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create page",
        variant: "destructive",
      });
    },
  });

  // Update page mutation
  const updatePageMutation = useMutation({
    mutationFn: async (data: PageFormValues & { id: number }) => {
      const { id, ...pageData } = data;
      const response = await apiRequest("PATCH", `/api/pages/${id}`, {
        ...pageData,
        mediaUrls: selectedPage.mediaUrls || [],
        createVersion: true,
        versionNotes: `Updated by admin on ${new Date().toLocaleString()}`,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({
        title: "Success",
        description: "Page updated successfully",
      });
      setIsEditDialogOpen(false);
      setSelectedPage(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update page",
        variant: "destructive",
      });
    },
  });

  // Delete page mutation
  const deletePageMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/pages/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({
        title: "Success",
        description: "Page deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setSelectedPage(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete page",
        variant: "destructive",
      });
    },
  });

  // Mutations for reordering pages
  const movePageUpMutation = useMutation({
    mutationFn: async ({ categoryName, index }: { categoryName: string; index: number }) => {
      // Get pages in this category
      const categoryPages = pagesByCategory[categoryName];
      if (index <= 0 || !categoryPages || categoryPages.length < 2) return null;
      
      // Swap order with previous page in category
      const pageToMove = categoryPages[index];
      const pageToSwap = categoryPages[index - 1];
      
      // To move a page UP in the list, we need to DECREASE its order number
      // Get current order numbers, defaulting to their index if not set
      // For UP arrows, ensure we make the current page's order explicitly smaller
      const currentOrder = pageToMove.order !== null && pageToMove.order !== undefined ? pageToMove.order : index;
      const swapOrder = pageToSwap.order !== null && pageToSwap.order !== undefined ? pageToSwap.order : index - 1;
      
      // Handle the edge case of duplicate order values - ensure the order values are different
      const effectiveSwapOrder = currentOrder === swapOrder ? swapOrder - 1 : swapOrder;
      
      console.log(`Moving page ${pageToMove.title} (ID: ${pageToMove.id}) UP: changing order from ${currentOrder} to ${effectiveSwapOrder}`);
      console.log(`Swapping with page ${pageToSwap.title} (ID: ${pageToSwap.id}): changing order from ${swapOrder} to ${currentOrder}`);
      
      // Make sure we have non-empty content field to satisfy schema validation
      // If content is empty or undefined, use a space or default content to satisfy validation
      const pageToMoveContent = pageToMove.content || " ";  // Space character as fallback
      const pageToSwapContent = pageToSwap.content || " ";  // Space character as fallback
      
      // Update the page we're moving to have a lower order number
      console.log("Sending PATCH request to update order UP:", {
        pageId: pageToMove.id,
        newOrder: effectiveSwapOrder,
        title: pageToMove.title,
        contentLength: pageToMoveContent?.length || 0,
        slug: pageToMove.slug
      });
      
      let response;
      try {
        response = await apiRequest("PATCH", `/api/pages/${pageToMove.id}`, {
          order: effectiveSwapOrder,
          // Important: Keep existing values to avoid overwriting them
          title: pageToMove.title,
          content: pageToMoveContent,
          slug: pageToMove.slug,
          mediaUrls: pageToMove.mediaUrls || []
        });
        console.log("UP Response from first PATCH:", response);
      } catch (error) {
        console.error("Error in UP apiRequest for first page:", error);
        throw error;
      }
      
      // Update the other page to have a higher order number
      console.log("Sending PATCH request to update order for swap page in UP:", {
        pageId: pageToSwap.id,
        newOrder: currentOrder,
        title: pageToSwap.title,
        contentLength: pageToSwapContent?.length || 0,
        slug: pageToSwap.slug
      });
      
      try {
        const swapResponse = await apiRequest("PATCH", `/api/pages/${pageToSwap.id}`, {
          order: currentOrder,
          // Important: Keep existing values to avoid overwriting them
          title: pageToSwap.title,
          content: pageToSwapContent,
          slug: pageToSwap.slug,
          mediaUrls: pageToSwap.mediaUrls || []
        });
        console.log("UP Response from second PATCH:", swapResponse);
      } catch (error) {
        console.error("Error in UP apiRequest for swap page:", error);
        // Continue execution - we don't want to throw here as the first update succeeded
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Force a refetch of the data to update the UI
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      
      // Add a slight delay and then refetch to ensure we get the latest data
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["/api/pages"] });
      }, 300);
      
      toast({
        title: "Success",
        description: "Page order updated successfully",
      });
    },
    onError: (error: any) => {
      console.error("Error in movePageUpMutation:", error);
      if (error.cause) console.error("Error cause:", error.cause);
      if (error.stack) console.error("Error stack:", error.stack);
      
      // Try to extract more useful error information
      let errorMessage = "Failed to reorder pages";
      if (error.message) {
        errorMessage = error.message;
      }
      
      if (error.response) {
        try {
          const responseData = error.response.data;
          if (responseData && responseData.message) {
            errorMessage = responseData.message;
            if (responseData.errors) {
              console.error("Validation errors:", responseData.errors);
            }
          }
        } catch (e) {
          console.error("Error parsing error response:", e);
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const movePageDownMutation = useMutation({
    mutationFn: async ({ categoryName, index }: { categoryName: string; index: number }) => {
      // Get pages in this category
      const categoryPages = pagesByCategory[categoryName];
      if (index >= categoryPages.length - 1 || !categoryPages || categoryPages.length < 2) return null;
      
      // Swap order with next page in category
      const pageToMove = categoryPages[index];
      const pageToSwap = categoryPages[index + 1];
      
      // To move a page DOWN in the list, we need to INCREASE its order number
      // Get current order numbers, defaulting to their index if not set
      // For DOWN arrows, ensure we make the current page's order explicitly larger
      const currentOrder = pageToMove.order !== null && pageToMove.order !== undefined ? pageToMove.order : index;
      const swapOrder = pageToSwap.order !== null && pageToSwap.order !== undefined ? pageToSwap.order : index + 1;
      
      // Handle the edge case of duplicate order values - ensure the order values are different
      const effectiveSwapOrder = currentOrder === swapOrder ? swapOrder + 1 : swapOrder;
      
      console.log(`Moving page ${pageToMove.title} (ID: ${pageToMove.id}) DOWN: changing order from ${currentOrder} to ${effectiveSwapOrder}`);
      console.log(`Swapping with page ${pageToSwap.title} (ID: ${pageToSwap.id}): changing order from ${swapOrder} to ${currentOrder}`);
      
      // Make sure we have non-empty content field to satisfy schema validation
      // If content is empty or undefined, use a space or default content to satisfy validation
      const pageToMoveContent = pageToMove.content || " ";  // Space character as fallback
      const pageToSwapContent = pageToSwap.content || " ";  // Space character as fallback
      
      // Update the page we're moving to have a higher order number
      console.log("Sending PATCH request to update order DOWN:", {
        pageId: pageToMove.id,
        newOrder: effectiveSwapOrder,
        title: pageToMove.title,
        contentLength: pageToMoveContent?.length || 0,
        slug: pageToMove.slug
      });
      
      let response;
      try {
        response = await apiRequest("PATCH", `/api/pages/${pageToMove.id}`, {
          order: effectiveSwapOrder,
          // Important: Keep existing values to avoid overwriting them
          title: pageToMove.title,
          content: pageToMoveContent,
          slug: pageToMove.slug,
          mediaUrls: pageToMove.mediaUrls || []
        });
        console.log("DOWN Response from first PATCH:", response);
      } catch (error) {
        console.error("Error in DOWN apiRequest for first page:", error);
        throw error;
      }
      
      // Update the other page to have a lower order number
      console.log("Sending PATCH request to update order for swap page in DOWN:", {
        pageId: pageToSwap.id,
        newOrder: currentOrder,
        title: pageToSwap.title,
        contentLength: pageToSwapContent?.length || 0,
        slug: pageToSwap.slug
      });
      
      try {
        const swapResponse = await apiRequest("PATCH", `/api/pages/${pageToSwap.id}`, {
          order: currentOrder,
          // Important: Keep existing values to avoid overwriting them
          title: pageToSwap.title,
          content: pageToSwapContent,
          slug: pageToSwap.slug,
          mediaUrls: pageToSwap.mediaUrls || []
        });
        console.log("DOWN Response from second PATCH:", swapResponse);
      } catch (error) {
        console.error("Error in DOWN apiRequest for swap page:", error);
        // Continue execution - we don't want to throw here as the first update succeeded
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Force a refetch of the data to update the UI
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      
      // Add a slight delay and then refetch to ensure we get the latest data
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["/api/pages"] });
      }, 300);
      
      toast({
        title: "Success",
        description: "Page order updated successfully",
      });
    },
    onError: (error: any) => {
      console.error("Error in movePageDownMutation:", error);
      if (error.cause) console.error("Error cause:", error.cause);
      if (error.stack) console.error("Error stack:", error.stack);
      
      // Try to extract more useful error information
      let errorMessage = "Failed to reorder pages";
      if (error.message) {
        errorMessage = error.message;
      }
      
      if (error.response) {
        try {
          const responseData = error.response.data;
          if (responseData && responseData.message) {
            errorMessage = responseData.message;
            if (responseData.errors) {
              console.error("Validation errors:", responseData.errors);
            }
          }
        } catch (e) {
          console.error("Error parsing error response:", e);
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });



  // Helper function to generate slug suffix from title
  const generateSlugSuffix = (title: string): string => {
    if (!title) return "page";
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, '')      // Remove leading/trailing hyphens
      .substring(0, 50);            // Truncate to reasonable length
  };

  // Watch for changes to category or title and update slug accordingly
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // Update slug when either category or title changes
      if (name === "category" || name === "title") {
        const category = form.getValues("category");
        const title = form.getValues("title");
        
        // Only update slug if we have a category selected
        if (category) {
          const categoryPrefix = getCategoryPrefix(category);
          const slugSuffix = generateSlugSuffix(title || "");
          const newSlug = `${categoryPrefix}-${slugSuffix}`;
          form.setValue("slug", newSlug);
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);

  // Helper function to normalize category to internal prefix format
  const normalizeCategoryForStorage = (categoryName: string): string => {
    const categoryMapping: Record<string, string> = {
      "Government & Regulations": "government",
      "Safety & Emergency Services": "safety",
      "Community Information": "community",
      "Local Services & Resources": "services",
      "Nature & Environment": "nature",
      "Transportation & Accessibility": "transportation",
      "Religion & Community Engagement": "religion",
      "Amenities & Recreation": "amenities",
      "Preferred Vendors": "vendors"
    };
    
    return categoryMapping[categoryName] || categoryName.toLowerCase().split(/\s+/)[0];
  };

  // The Add and Edit dialogs share the same react-hook-form instance, so the
  // form is "dirty" only when one of those dialogs is open *and* the admin has
  // edited a field. Closing the dialog (via mutation success or explicit
  // discard) collapses this back to false on its own.
  const isPageDialogOpen = isAddDialogOpen || isEditDialogOpen;
  const hasUnsavedPageChanges =
    isPageDialogOpen && form.formState.isDirty;

  // Warn before navigating away (router transition, back button, browser
  // unload) while the page edit dialog has edits that haven't been saved or
  // discarded. Stays active during save so a failed save doesn't leave the
  // admin unprotected; on success the dialog closes and this flips to false.
  const unsavedChangesDialog = useUnsavedChangesPrompt(
    hasUnsavedPageChanges,
    {
      title: "Unsaved page changes",
      description:
        "You have unsaved changes to this page. If you leave now, your edits will be lost.",
      confirmLabel: "Discard & Leave",
      cancelLabel: "Stay on Page",
    },
  );

  // Reset the form back to a clean blank state. Used when the admin discards
  // changes via the in-dialog confirmation so the next open of either dialog
  // starts fresh and `formState.isDirty` is false again.
  const resetPageForm = () => {
    form.reset({
      title: "",
      slug: "",
      content: "",
      category: "",
    });
    setEditorContent("");
  };

  // Handler for the Add dialog's onOpenChange (and Cancel button). When the
  // admin tries to close the dialog while there are unsaved edits, we queue
  // the close behind a styled confirmation instead of dropping their work.
  const handleAddDialogOpenChange = (open: boolean) => {
    if (!open && hasUnsavedPageChanges) {
      setPendingDialogClose("add");
      return;
    }
    setIsAddDialogOpen(open);
  };

  // Same as above, for the Edit dialog.
  const handleEditDialogOpenChange = (open: boolean) => {
    if (!open && hasUnsavedPageChanges) {
      setPendingDialogClose("edit");
      return;
    }
    setIsEditDialogOpen(open);
  };

  // Confirm the queued discard: actually close the corresponding dialog,
  // clear any selection, and reset the form so it's no longer dirty.
  const confirmDiscardPageChanges = () => {
    if (pendingDialogClose === "add") {
      setIsAddDialogOpen(false);
    } else if (pendingDialogClose === "edit") {
      setIsEditDialogOpen(false);
      setSelectedPage(null);
    }
    resetPageForm();
    setPendingDialogClose(null);
  };

  // Handle form submission for adding page
  const onAddSubmit = (values: PageFormValues) => {
    // Normalize category to internal prefix before saving
    const normalizedValues = {
      ...values,
      category: normalizeCategoryForStorage(values.category)
    };
    createPageMutation.mutate(normalizedValues);
  };

  // Handle form submission for editing page
  const onEditSubmit = (values: PageFormValues) => {
    if (!selectedPage) return;
    
    // Normalize category to internal prefix before saving
    const normalizedValues = {
      ...values,
      category: normalizeCategoryForStorage(values.category)
    };
    updatePageMutation.mutate({
      ...normalizedValues,
      id: selectedPage.id,
    });
  };

  // Handle page deletion
  const onDeletePage = () => {
    if (!selectedPage) return;
    deletePageMutation.mutate(selectedPage.id);
  };

  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== "admin") {
      toast({
        title: "Access Denied",
        description: "You need admin privileges to access this page.",
        variant: "destructive",
      });
      navigate("/");
    } else if (!user) {
      toast({
        title: "Authentication Required",
        description: "You need to log in with admin privileges to access this page.",
        variant: "destructive",
      });
      navigate("/auth");
    }
  }, [user, navigate, toast]);

  if (!user || user.role !== "admin") {
    return (
      <div className="container max-w-4xl mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need administrator privileges to access this page
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <GenericPageLoading />;
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              Failed to load pages: {error instanceof Error ? error.message : "Unknown error"}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-10">
      {unsavedChangesDialog}
      <AlertDialog
        open={pendingDialogClose !== null}
        onOpenChange={(open) => {
          // Treat any close (Escape, overlay click, Cancel button) of the
          // discard prompt as "stay on the page" so the dialog and edits stick
          // around.
          if (!open) setPendingDialogClose(null);
        }}
      >
        <AlertDialogContent data-testid="dialog-page-unsaved-changes">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved page changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this page. If you close now, your
              edits will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-page-unsaved-changes-cancel">
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDiscardPageChanges}
              data-testid="button-page-unsaved-changes-confirm"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <h1 className="text-3xl font-bold mb-6">Community Content Management</h1>
      
      <Tabs defaultValue="pages" className="mb-8">
        <TabsList className="grid grid-cols-2 mb-6">
          <TabsTrigger value="pages">Content Pages</TabsTrigger>
          <TabsTrigger value="community-categories">Community Categories</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pages">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Manage Community Pages</h2>
            <Button 
              onClick={() => {
                setIsAddDialogOpen(true);
                form.reset({
                  title: "",
                  slug: "",
                  content: "",
                  category: "",
                });
                setEditorContent("");
              }}
              className="bg-coral hover:bg-coral/90 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Page
            </Button>
          </div>

          <div className="space-y-8">
            {(communityCategories || FALLBACK_CATEGORIES).map((category) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle>{category}</CardTitle>
                  <CardDescription>
                    Pages in the {category} section
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                  {pagesByCategory[category]?.length > 0 ? (
                    pagesByCategory[category].map((page, index) => (
                      <TableRow key={page.id}>
                        <TableCell>{page.title}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                              {page.slug}
                            </code>
                            <a 
                              href={getFormattedPageUrl(page.slug, getCategoryPrefix(category))} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-navy/70 hover:text-coral"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                console.log("UP BUTTON CLICKED for page:", page.title, "in category:", category, "at index:", index);
                                movePageUpMutation.mutate({ categoryName: category, index });
                              }}
                              disabled={index === 0}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                console.log("DOWN BUTTON CLICKED for page:", page.title, "in category:", category, "at index:", index);
                                movePageDownMutation.mutate({ categoryName: category, index });
                              }}
                              disabled={index === (pagesByCategory[category]?.length || 0) - 1}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedPage(page);
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive"
                              onClick={() => {
                                setSelectedPage(page);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                        No pages in this category
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Page Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Page</DialogTitle>
            <DialogDescription>
              Create a new community page with content
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAddSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Page Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter page title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {communityCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Page Slug (URL)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., amenities-golf" {...field} readOnly className="bg-muted" />
                    </FormControl>
                    <FormDescription>
                      {field.value ? `This will be used in the URL: ${getFormattedPageUrl(field.value, getCategoryPrefix(form.getValues("category") || ""))}` : "Select a category to automatically generate the page URL"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <ContentEditor
                        initialContent={field.value}
                        onChange={(content) => { setEditorContent(content); field.onChange(content); }}
                        pageSlug={form.getValues("slug")}
                        pageCategory={form.getValues("category")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAddDialogOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-coral hover:bg-coral/90 text-white"
                  disabled={createPageMutation.isPending}
                >
                  {createPageMutation.isPending ? "Creating..." : "Create Page"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Page Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Page</DialogTitle>
            <DialogDescription>
              Update the page content and settings
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Page Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter page title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {communityCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Page Slug (URL)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., amenities-golf" {...field} readOnly className="bg-muted" />
                    </FormControl>
                    <FormDescription>
                      {field.value ? `This will be used in the URL: ${getFormattedPageUrl(field.value, getCategoryPrefix(form.getValues("category") || ""))}` : "Select a category to automatically generate the page URL"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <ContentEditor
                        initialContent={field.value}
                        onChange={(content) => { setEditorContent(content); field.onChange(content); }}
                        pageSlug={selectedPage?.slug || form.getValues("slug")}
                        pageCategory={selectedPage?.category || form.getValues("category")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleEditDialogOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-coral hover:bg-coral/90 text-white"
                  disabled={updatePageMutation.isPending}
                >
                  {updatePageMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Page</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this page? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <p className="font-bold">
            {selectedPage?.title}
          </p>
          <p className="text-sm text-muted-foreground">
            Slug: {selectedPage?.slug}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onDeletePage}
              disabled={deletePageMutation.isPending}
            >
              {deletePageMutation.isPending ? "Deleting..." : "Delete Page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>
        
        <TabsContent value="community-categories">
          <ManageCommunityCategories />
        </TabsContent>
      </Tabs>
    </div>
  );
}