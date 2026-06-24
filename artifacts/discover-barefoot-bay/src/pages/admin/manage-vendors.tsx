import { useState, useEffect } from "react";

import { 
  dbSlugToPublicUrl, 
  COMPOUND_CATEGORIES, 
  generateVendorSlug 
} from "@/components/vendors/vendor-url-converter";

// Helper function to normalize vendor categories data for consistent rendering
const normalizeVendorCategories = (categories: any): Array<{id: string, name: string, slug: string}> => {
  if (!categories) {
    // Return empty array if no categories
    return [];
  }

  // Handle array format
  if (Array.isArray(categories)) {
    return categories.map(category => {
      if (typeof category === 'string') {
        return { id: category, name: category, slug: category.toLowerCase().replace(/\s+/g, '-') };
      }
      return {
        id: category.id || category.slug || category.name,
        name: category.name,
        slug: category.slug || category.name.toLowerCase().replace(/\s+/g, '-')
      };
    });
  }

  // Handle object format
  if (typeof categories === 'object') {
    return Object.entries(categories).map(([key, value]) => {
      if (typeof value === 'string') {
        return { id: key, name: value, slug: value.toLowerCase().replace(/\s+/g, '-') };
      }
      const category = value as any;
      return {
        id: key,
        name: category.name,
        slug: category.slug || category.name.toLowerCase().replace(/\s+/g, '-')
      };
    });
  }

  // Return empty array if categories is invalid
  return [];
};

// URL Display component to consistently format URL in admin interface
const VendorUrlDisplay = ({ slug }: { slug: string }) => {
  // Convert the database slug to a public URL format
  const displayUrl = slug ? dbSlugToPublicUrl(slug) : '/vendors/category/vendor-name';

  // Check if the slug needs repair
  const needsRepair = slug && (
    !slug.startsWith('vendors-') || 
    slug.includes('--') || 
    slug.split('-').length < 3
  );

  return (
    <div className="mt-1">
      <div className="text-xs text-gray-500 mb-1">Database format (with hyphens):</div>
      <code className="bg-gray-100 p-1 rounded text-xs block mb-2 font-mono">{slug || "vendors-category-vendor-name"}</code>
      <div className="text-xs text-gray-500 mb-1">Public URL (with slashes):</div>
      <code className="bg-gray-100 p-1 rounded text-xs block font-mono text-green-600">{displayUrl}</code>
      <div className="text-xs text-blue-500 mt-2">
        <strong>Note:</strong> URLs are stored with hyphens in the database but displayed with slashes in the browser.
      </div>
      {needsRepair && (
        <div className="text-xs text-amber-600 mt-2 p-1 bg-amber-50 rounded border border-amber-200">
          <strong>⚠️ Warning:</strong> This URL may need to be reformatted for consistency.
          Please save the form to fix it automatically.
        </div>
      )}
    </div>
  );
};

// Component for URL format explanation
const SlugFormatDescription = () => {
  return (
    <div className="space-y-1 border rounded-md p-2 bg-blue-50">
      <p className="text-sm font-medium text-blue-700">URL Formatting Guide:</p>
      <div className="text-xs">
        <div className="mb-1">
          <span className="font-medium">Auto-generated:</span> 
          <span className="text-slate-600 ml-1">This field is created from your title and category</span>
        </div>
        <div className="mb-1">
          <span className="font-medium">Database format:</span> 
          <code className="bg-gray-100 px-1 py-0.5 rounded ml-1">vendors-category-unique-name</code>
        </div>
        <div className="mb-1">
          <span className="font-medium">Public URL format:</span> 
          <code className="bg-gray-100 px-1 py-0.5 rounded ml-1 text-green-600">/vendors/category/unique-name</code>
        </div>
        <div className="text-xs text-blue-700">
          <strong>Note:</strong> URLs are stored with hyphens but displayed with slashes in the browser.
        </div>
      </div>
    </div>
  );
};
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slug-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { GenericPageLoading } from "@/components/shared/generic-page-loading";
import WysiwygEditor from "@/components/shared/wysiwyg-editor-direct";
import { Plus, Edit, Trash2, ExternalLink, ArrowUp, ArrowDown, RefreshCw, Briefcase, EyeOff, Eye } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

// Import our vendor categories management component
import ManageVendorCategories from "@/components/admin/manage-vendor-categories";

// Original hardcoded categories for backward compatibility
const VENDOR_CATEGORIES = [
  "Home Services",
  "Landscaping",
  "Contractors",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Cleaning",
  "Maintenance", 
  "Construction",
  "Retail",
  "Food & Dining",
  "Health & Wellness",
  "Professional Services",
  "Automotive", // Added Automotive category
  "Other Vendors"
];

// Define form schema
const pageFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  // Slug is auto-generated, so we make it optional in the form
  slug: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  category: z.string().min(1, "Category is required"),
  isHidden: z.boolean().default(false),
});

type PageFormValues = z.infer<typeof pageFormSchema>;

export default function ManageVendorsAdmin() {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [editorContent, setEditorContent] = useState("");
  // Tracks which open vendor dialog the admin is trying to close while it has
  // unsaved edits. `null` means no pending close, which also drives the
  // discard-confirmation alert dialog's open state.
  const [pendingDialogClose, setPendingDialogClose] = useState<
    null | "add" | "edit"
  >(null);

  // Fetch vendor categories (including hidden ones for admin view)
  const { data: vendorCategories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["/api/vendor-categories"],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/vendor-categories?includeHidden=true');
        if (!response.ok) {
          throw new Error(`Failed to fetch vendor categories: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log("Vendor categories API response:", data);
        return data;
      } catch (error) {
        console.error("Error fetching vendor categories:", error);
        throw error;
      }
    },
    select: (data: any) => {
      // Enhanced data validation and debugging
      console.log("Processing vendor categories data:", data);
      console.log("Data type:", typeof data);
      console.log("Is array:", Array.isArray(data));

      // Use our helper function to normalize the categories data
      const normalizedCategories = normalizeVendorCategories(data);

      // If we got no categories from normalization, use our fallback hardcoded categories
      if (normalizedCategories.length === 0) {
        console.log("No categories returned by normalization, using fallback categories");
        return VENDOR_CATEGORIES.map(name => ({ 
          id: slugify(name), 
          name: name,
          slug: slugify(name) 
        }));
      }

      console.log("Returning normalized vendor categories array with", normalizedCategories.length, "items");
      return normalizedCategories;
    },
  });

  // Fetch all pages (including hidden ones for admin view)
  const { data: pages, isLoading: isLoadingPages, error } = useQuery({
    queryKey: ["/api/pages"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/pages?includeHidden=true');
      const data = await response.json();
      console.log("Pages API response:", data);
      return data;
    },
    select: (data: any) => {
      // Check if data is an array before filtering
      if (!Array.isArray(data)) {
        console.error("Expected pages data to be an array, but got:", typeof data);
        return [];
      }
      return data.filter((page: any) => 
        page.slug.startsWith("vendors-") || 
        (page.slug.includes("/") && page.slug.split("/")[1] === "vendors")
      );
    },
  });

  // Group pages by category for display
  const pagesByCategory = pages ? pages.reduce((acc: any, page: any) => {
    let category = "Uncategorized";

    console.log("Grouping page with slug:", page.slug);

    // First check dynamically against vendor categories from database
    if (vendorCategories && Array.isArray(vendorCategories) && vendorCategories.length > 0) {
      for (const vendorCategory of vendorCategories) {
        const categorySlug = vendorCategory.slug.toLowerCase();

        // Check different slug formats for this category
        if (
          // Format: vendors-category-name
          page.slug.startsWith(`vendors-${categorySlug}-`) ||
          // Format: vendors-category name
          page.slug.startsWith(`vendors-${categorySlug} `) ||
          // Format: more/vendors/category
          (page.slug.includes('/') && 
            page.slug.split('/').length >= 3 && 
            page.slug.split('/')[1] === 'vendors' && 
            page.slug.split('/')[2] === categorySlug)
        ) {
          console.log(`Matched dynamic category "${vendorCategory.name}" for page ${page.slug}`);
          category = vendorCategory.name;
          break;
        }
      }
    }

    // If no match found from dynamic categories, use the legacy hardcoded mappings
    if (category === "Uncategorized") {
      if (page.slug.includes("/")) {
        // For slugs like 'more/vendors/home-services'
        const parts = page.slug.split("/");
        if (parts.length >= 3 && parts[1] === "vendors") {
          const vendorType = parts[2];
          console.log("Found path-based vendor type:", vendorType);

          if (vendorType === "home-services") category = "Home Services";
          else if (vendorType === "landscaping") category = "Landscaping";
          else if (vendorType === "contractors") category = "Contractors";
          else if (vendorType === "plumbing") category = "Plumbing";
          else if (vendorType === "electrical") category = "Electrical";
          else if (vendorType === "hvac") category = "HVAC";
          else if (vendorType === "cleaning") category = "Cleaning";
          else if (vendorType === "maintenance") category = "Maintenance";
          else if (vendorType === "construction") category = "Construction";
          else if (vendorType === "automotive") category = "Automotive";
          else if (vendorType === "retail") category = "Retail";
          else if (vendorType === "food-dining") category = "Food & Dining";
          else if (vendorType === "health-wellness") category = "Health & Wellness";
          else if (vendorType === "professional-services") category = "Professional Services";
          else category = "Other Vendors";
        }
      } else if (page.slug.includes("-")) {
        // For slugs like 'vendors-home-services'
        const parts = page.slug.split("-");
        if (parts.length >= 2 && parts[0] === "vendors") {
          const vendorType = parts[1];
          console.log("Found hyphen-based vendor type:", vendorType);

          if (vendorType === "home") category = "Home Services";
          else if (vendorType === "landscaping") category = "Landscaping";
          else if (vendorType === "contractors") category = "Contractors";
          else if (vendorType === "plumbing") category = "Plumbing";
          else if (vendorType === "electrical") category = "Electrical";
          else if (vendorType === "hvac") category = "HVAC";
          else if (vendorType === "cleaning") category = "Cleaning";
          else if (vendorType === "maintenance") category = "Maintenance";
          else if (vendorType === "construction") category = "Construction";
          else if (vendorType === "automotive") category = "Automotive";
          else if (vendorType === "retail") category = "Retail";
          else if (vendorType === "food") category = "Food & Dining";
          else if (vendorType === "health") category = "Health & Wellness";
          else if (vendorType === "professional") category = "Professional Services";
          else category = "Other Vendors";
        }
      }
    }

    console.log(`Categorizing page "${page.title}" (${page.slug}) as "${category}"`);

    // Initialize category array if it doesn't exist
    if (!acc[category]) acc[category] = [];

    // Add page to category
    acc[category].push(page);
    return acc;
  }, {}) : {};

  // Form for adding/editing pages
  const form = useForm<PageFormValues>({
    resolver: zodResolver(pageFormSchema),
    defaultValues: {
      title: "",
      slug: "",
      content: "",
      category: "",
      isHidden: false,
    },
  });

  // Add effect to automatically update slug when title or category changes
  useEffect(() => {
    // Watch for changes to title and category
    const subscription = form.watch((value, { name }) => {
      // Only regenerate slug when title or category changes
      if (name === 'title' || name === 'category') {
        const currentValues = form.getValues();
        const title = currentValues.title;
        const category = currentValues.category;

        // Only generate a slug if we have both title and category
        if (title && category) {
          // Generate a new slug based on current values
          const newSlug = generateVendorSlug(title, category);

          // Update the slug field automatically
          form.setValue('slug', newSlug);

          console.log(`Auto-updating slug based on title "${title}" and category "${category}"`);
          console.log(`Generated slug: ${newSlug}`);
        }
      }
    });

    // Clean up subscription on component unmount
    return () => subscription.unsubscribe();
  }, [form]);

  // Set form values when editing a page
  useEffect(() => {
    if (selectedPage && isEditDialogOpen) {
      form.reset({
        title: selectedPage.title,
        slug: selectedPage.slug,
        content: selectedPage.content,
        category: getCategoryFromSlug(selectedPage.slug),
        isHidden: selectedPage.isHidden || false,
      });
      setEditorContent(selectedPage.content);
    }
  }, [selectedPage, isEditDialogOpen, form]);

  // Create page mutation
  const createPageMutation = useMutation({
    mutationFn: async (data: PageFormValues) => {
      const { category, title } = data;

      // ALWAYS generate the slug from title and category for consistency
      // This ensures the unique-identifier always matches the title
      const newSlug = generateVendorSlug(title, category);

      console.log(`Creating vendor page for "${title}" in category "${category}"`);
      console.log(`Generated slug: ${newSlug}`);

      // Extract all image URLs from the content HTML
      const content = data.content || '';
      const imgRegex = /<img[^>]+src="([^">]+)"/g;
      const videoRegex = /<video[^>]+src="([^">]+)"/g;

      // Find all image URLs in the content
      const mediaUrls: string[] = [];
      let match;

      // Extract image URLs
      while ((match = imgRegex.exec(content)) !== null) {
        const url = match[1];
        if (url && !mediaUrls.includes(url)) {
          mediaUrls.push(url);
        }
      }

      // Extract video URLs
      while ((match = videoRegex.exec(content)) !== null) {
        const url = match[1];
        if (url && !mediaUrls.includes(url)) {
          mediaUrls.push(url);
        }
      }

      console.log("Creating vendor page with media URLs:", mediaUrls);

      const response = await apiRequest("POST", "/api/pages", {
        title: data.title,
        slug: newSlug, // Use our automatically generated slug based on title and category
        content: data.content,
        mediaUrls: mediaUrls,
        isHidden: data.isHidden,
        category: data.category, // Make sure we include the category
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({
        title: "Success",
        description: "Vendor page created successfully",
      });
      setIsAddDialogOpen(false);
      form.reset({
        title: "",
        slug: "",
        content: "",
        category: "",
        isHidden: false,
      });
      setEditorContent("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create vendor page",
        variant: "destructive",
      });
    },
  });

  // Update page mutation
  const updatePageMutation = useMutation({
    mutationFn: async (data: PageFormValues & { id: number }) => {
      const { id, category, title, ...pageData } = data;

      // ALWAYS generate a new slug directly from the title and category
      // This ensures the slug unique-identifier portion always reflects the title
      const newSlug = generateVendorSlug(title, category);

      // Calculate the public URL for logging
      const publicUrl = dbSlugToPublicUrl(newSlug);
      console.log(`Automatically generating vendor slug for title "${title}" and category "${category}"`);
      console.log(`Slug: ${newSlug}`);
      console.log(`This will appear as URL: ${publicUrl}`);

      // Extract all image URLs from the content HTML
      const content = pageData.content || '';
      const imgRegex = /<img[^>]+src="([^">]+)"/g;
      const videoRegex = /<video[^>]+src="([^">]+)"/g;

      // Get existing media URLs
      let existingMediaUrls = selectedPage?.mediaUrls || [];

      // Find all new image URLs in the content
      const imageUrls: string[] = [];
      let match;

      // Extract image URLs
      while ((match = imgRegex.exec(content)) !== null) {
        const url = match[1];
        if (url && !imageUrls.includes(url)) {
          imageUrls.push(url);
        }
      }

      // Extract video URLs
      while ((match = videoRegex.exec(content)) !== null) {
        const url = match[1];
        if (url && !imageUrls.includes(url)) {
          imageUrls.push(url);
        }
      }

      // Combine existing URLs with new ones (unique)
      // Convert to array first to avoid TypeScript iteration error with Set
      const combinedUrls = [...existingMediaUrls, ...imageUrls];
      const uniqueUrls = Array.from(new Set(combinedUrls));

      console.log("Updating media URLs:", uniqueUrls);

      const response = await apiRequest("PATCH", `/api/pages/${id}`, {
        ...pageData,
        title, // Ensure we're sending the title
        category, // Ensure we're sending the category
        slug: newSlug, // Use the automatically generated slug
        mediaUrls: uniqueUrls,
        createVersion: true,
        versionNotes: `Updated by admin on ${new Date().toLocaleString()}`,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({
        title: "Success",
        description: "Vendor page updated successfully",
      });
      setIsEditDialogOpen(false);
      setSelectedPage(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update vendor page",
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
        description: "Vendor page deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setSelectedPage(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete vendor page",
        variant: "destructive",
      });
    },
  });

  // Toggle visibility mutation
  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, isHidden }: { id: number; isHidden: boolean }) => {
      const response = await apiRequest("PATCH", `/api/pages/${id}`, {
        isHidden: !isHidden,
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({
        title: "Success",
        description: `Vendor page ${variables.isHidden ? "unhidden" : "hidden"} successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update visibility",
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
      const currentOrder = pageToMove.order !== null && pageToMove.order !== undefined ? pageToMove.order : index;
      const swapOrder = pageToSwap.order !== null && pageToSwap.order !== undefined ? pageToSwap.order : index - 1;

      // Handle the edge case of duplicate order values - ensure the order values are different
      const effectiveSwapOrder = currentOrder === swapOrder ? swapOrder - 1 : swapOrder;

      console.log(`Moving vendor ${pageToMove.title} (ID: ${pageToMove.id}) UP: changing order from ${currentOrder} to ${effectiveSwapOrder}`);
      console.log(`Swapping with vendor ${pageToSwap.title} (ID: ${pageToSwap.id}): changing order from ${swapOrder} to ${currentOrder}`);

      // Make sure we have non-empty content field to satisfy schema validation
      const pageToMoveContent = pageToMove.content || " ";  // Space character as fallback
      const pageToSwapContent = pageToSwap.content || " ";  // Space character as fallback

      // Update the page we're moving to have a lower order number (move it up)
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
        description: "Vendor order updated successfully",
      });
    },
    onError: (error: any) => {
      console.error("Error in movePageUpMutation:", error);
      if (error.cause) console.error("Error cause:", error.cause);
      if (error.stack) console.error("Error stack:", error.stack);

      // Try to extract more useful error information
      let errorMessage = "Failed to reorder vendors";
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
      const currentOrder = pageToMove.order !== null && pageToMove.order !== undefined ? pageToMove.order : index;
      const swapOrder = pageToSwap.order !== null && pageToSwap.order !== undefined ? pageToSwap.order : index + 1;

      // Handle the edge case of duplicate order values - ensure the order values are different
      const effectiveSwapOrder = currentOrder === swapOrder ? swapOrder + 1 : swapOrder;

      console.log(`Moving vendor ${pageToMove.title} (ID: ${pageToMove.id}) DOWN: changing order from ${currentOrder} to ${effectiveSwapOrder}`);
      console.log(`Swapping with vendor ${pageToSwap.title} (ID: ${pageToSwap.id}): changing order from ${swapOrder} to ${currentOrder}`);

      // Make sure we have non-empty content field to satisfy schema validation
      const pageToMoveContent = pageToMove.content || " ";  // Space character as fallback
      const pageToSwapContent = pageToSwap.content || " ";  // Space character as fallback

      // Update the page we're moving to have a higher order number (move it down)
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
        description: "Vendor order updated successfully",
      });
    },
    onError: (error: any) => {
      console.error("Error in movePageDownMutation:", error);
      if (error.cause) console.error("Error cause:", error.cause);
      if (error.stack) console.error("Error stack:", error.stack);

      // Try to extract more useful error information
      let errorMessage = "Failed to reorder vendors";
      if (error.message) {        errorMessage = error.message;
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

  // Function to extract category from slug
  const getCategoryFromSlug = (slug: string): string => {
    console.log("Analyzing slug for category:", slug);

    // First check dynamically against vendor categories from database
    if (vendorCategories && Array.isArray(vendorCategories) && vendorCategories.length > 0) {
      for (const vendorCategory of vendorCategories) {
        const categorySlug = vendorCategory.slug.toLowerCase();

        // Check different slug formats for this category
        if (
          // Format: vendors-category-name
          slug.startsWith(`vendors-${categorySlug}-`) ||
          // Format: vendors-category name
          slug.startsWith(`vendors-${categorySlug} `) ||
          // Format: more/vendors/category
          (slug.includes('/') && 
            slug.split('/').length >= 3 && 
            slug.split('/')[1] === 'vendors' && 
            slug.split('/')[2] === categorySlug)
        ) {
          console.log(`Matched dynamic category "${vendorCategory.name}" for slug ${slug}`);
          return vendorCategory.name;
        }
      }
    }

    // If no match found from dynamic categories, use the legacy hardcoded mappings
    if (slug.includes("/")) {
      const parts = slug.split("/");
      if (parts.length >= 3 && parts[1] === "vendors") {
        const vendorType = parts[2];
        console.log("Found path-based vendor slug, type:", vendorType);

        if (vendorType === "home-services") return "Home Services";
        else if (vendorType === "landscaping") return "Landscaping";
        else if (vendorType === "contractors") return "Contractors";
        else if (vendorType === "plumbing") return "Plumbing";
        else if (vendorType === "electrical") return "Electrical";
        else if (vendorType === "hvac") return "HVAC";
        else if (vendorType === "cleaning") return "Cleaning";
        else if (vendorType === "maintenance") return "Maintenance";
        else if (vendorType === "construction") return "Construction";
        else if (vendorType === "automotive") return "Automotive";
        else if (vendorType === "retail") return "Retail";
        else if (vendorType === "food-dining") return "Food & Dining";
        else if (vendorType === "health-wellness") return "Health & Wellness";
        else if (vendorType === "professional-services") return "Professional Services";
      }
    } else if (slug.includes("-")) {
      const parts = slug.split("-");
      if (parts.length >= 2 && parts[0] === "vendors") {
        const vendorType = parts[1];
        console.log("Found hyphen-based vendor slug, type:", vendorType);

        if (vendorType === "home") return "Home Services";
        else if (vendorType === "landscaping") return "Landscaping";
        else if (vendorType === "contractors") return "Contractors";
        else if (vendorType === "plumbing") return "Plumbing";
        else if (vendorType === "electrical") return "Electrical";
        else if (vendorType === "hvac") return "HVAC";
        else if (vendorType === "cleaning") return "Cleaning";
        else if (vendorType === "maintenance") return "Maintenance";
        else if (vendorType === "construction") return "Construction"; 
        else if (vendorType === "automotive") return "Automotive";
        else if (vendorType === "retail") return "Retail";
        else if (vendorType === "food") return "Food & Dining";
        else if (vendorType === "health") return "Health & Wellness";
        else if (vendorType === "professional") return "Professional Services";
      }
    }

    return "Other Vendors";
  };

  // Function to convert category to slug prefix 
  // IMPORTANT: This should NOT include "services-" as a prefix
  const getCategoryPrefix = (category: string): string => {
    // First check if this is a category from our database
    if (vendorCategories && Array.isArray(vendorCategories)) {
      const matchingCategory = vendorCategories.find(
        (cat: any) => cat.name === category || cat.slug === category
      );

      if (matchingCategory && matchingCategory.slug) {
        // We have a direct match from the database
        console.log(`Found direct category match in database: ${matchingCategory.slug}`);
        return matchingCategory.slug;
      }
    }

    // Map of display names to proper slug format - used as fallback
    const categoryMap: Record<string, string> = {
      "Home Services": "home-services",
      "Landscaping": "landscaping",
      "Contractors": "contractors",
      "Plumbing": "plumbing",
      "Electrical": "electrical",
      "HVAC": "hvac",
      "Cleaning": "cleaning",
      "Maintenance": "maintenance",
      "Construction": "construction",
      "Retail": "retail",
      "Food & Dining": "food-dining",
      "Health & Wellness": "health-wellness",
      "Professional Services": "professional-services",
      "Insurance & Financial": "insurance-financial",
      "Real Estate": "real-estate",
      "Technology & Electronics": "technology-electronics",
      "Retail & Shops": "retail-shops",
      "Beauty & Personal Care": "beauty-personal-care",
      "Automotive": "automotive",
      "Anchor and Vapor Barrier": "anchor-vapor-barrier",
      "Roofing": "roofing",
      "Services": "services",
      "General": "general",
      "Other": "other"
    };

    // Check if the category is in our mapping
    if (categoryMap[category]) {
      return categoryMap[category];
    }

    // Fallback: Convert the category to slug format 
    const sluggedCategory = category ? slugify(category) : "other";

    // Import list of compound category slugs to check for possible duplication
    const { COMPOUND_CATEGORIES } = require('@/components/vendors/vendor-url-converter');

    // Make sure we don't return a duplicate segment in compound categories
    if (COMPOUND_CATEGORIES.includes(sluggedCategory)) {
      console.log(`Using compound category: ${sluggedCategory}`);
      return sluggedCategory;
    }

    return sluggedCategory;
  };

  // Function to generate the correct vendor page link
  const getVendorPageLink = (slug: string): string => {
    // If no slug provided or invalid, return basic vendors path
    if (!slug) return '/vendors';

    // For slugs that already start with vendors-
    if (slug.startsWith('vendors-')) {
      // Extract the category and the vendor name
      const parts = slug.split('-');

      if (parts.length >= 3) {
        // Updated compound categories list to match the corrected database format
        const compoundCategories = [
          'home-services', 
          'food-dining', 
          'health-wellness', 
          'professional-services',
          'real-estate-senior-living',
          'anchor-vapor-barrier',
          'hvac-air-quality',
          'health-medical',
          'funeral-memorial',
          'moving-transportation',
          'insurance-financial-services',
          'technology-electronics',
          'retail-shops',
          'new-homes-installation'
        ];

        // Check for compound categories by testing different combinations
        let foundCompoundCategory = null;
        let vendorStartIndex = 1;

        // Test 3-part compound categories first (like insurance-financial-services)
        if (parts.length >= 5) {
          const threePartCategory = `${parts[1]}-${parts[2]}-${parts[3]}`;
          if (compoundCategories.includes(threePartCategory)) {
            foundCompoundCategory = threePartCategory;
            vendorStartIndex = 4;
          }
        }

        // Test 2-part compound categories if no 3-part match found
        if (!foundCompoundCategory && parts.length >= 4) {
          const twoPartCategory = `${parts[1]}-${parts[2]}`;
          if (compoundCategories.includes(twoPartCategory)) {
            foundCompoundCategory = twoPartCategory;
            vendorStartIndex = 3;
          }
        }

        if (foundCompoundCategory) {
          // Use the compound category and remaining parts as vendor name
          const vendorName = parts.slice(vendorStartIndex).join('-');
          return `/vendors/${foundCompoundCategory}/${vendorName}`;
        } else {
          // Standard single-word category
          const category = parts[1];
          const vendorName = parts.slice(2).join('-');
          return `/vendors/${category}/${vendorName}`;
        }
      } else if (parts.length === 2) {
        // vendors-landscaping -> /vendors/landscaping (for category page)
        const category = parts[1];
        return `/vendors/${category}`;
      }
    }

    // Fallback to the original link format if the pattern doesn't match,
    // making sure to remove any vendors- prefixes
    let cleanedSlug = slug.replace('vendors-', '');
    return `/vendors/${cleanedSlug}`;
  };

  // Convert editor content to form field when submitting and
  // Auto-format the slug based on category and title following the URL pattern:
  // vendors-[category]-[unique-identifier]
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "category" || name === "title") {
        // Only proceed if we have both category and title (or at least one of them changed)
        const categoryValue = value.category as string;
        const titleValue = name === "title" ? 
                          (value.title as string) : 
                          form.getValues("title");

        // Skip if we don't have the essential info
        if (!categoryValue) {
          return;
        }

        // Get the standardized category prefix
        const categoryPrefix = getCategoryPrefix(categoryValue);

        // Generate a slug suffix from the title, or use a placeholder if no title
        let slugSuffix = titleValue ? slugify(titleValue) : "vendor";

        // Clean up the slug suffix by removing common prefixes
        const prefixesToRemove = [
          'vendors-',
          'vendors',
          'services-',
          'service-',
          categoryPrefix + '-',
        ];

        // Import our list of compound categories for special handling
        const { COMPOUND_CATEGORIES } = require('@/components/vendors/vendor-url-converter');

        // Handle compound categories by adding each segment to remove
        if (COMPOUND_CATEGORIES.includes(categoryPrefix)) {
          console.log(`Handling compound category: ${categoryPrefix}`);
          const categoryParts = categoryPrefix.split('-');
          // Add each part of the compound category to prefixes to remove
          categoryParts.forEach(part => {
            prefixesToRemove.push(`${part}-`);
          });
        }

        // Remove each possible prefix if found
        for (const prefix of prefixesToRemove) {
          if (slugSuffix.startsWith(prefix)) {
            slugSuffix = slugSuffix.substring(prefix.length);
            console.log(`Removed prefix "${prefix}" from slug: ${slugSuffix}`);
          }
        }

        // Handle potential duplicate segments when the title has parts of the category
        if (COMPOUND_CATEGORIES.includes(categoryPrefix)) {
          const categoryParts = categoryPrefix.split('-');
          const slugParts = slugSuffix.split('-');

          // Check if the first slug part matches the last category part
          if (slugParts.length > 0 && slugParts[0] === categoryParts[categoryParts.length - 1]) {
            console.log(`Detected duplicate segment: ${slugParts[0]}`);
            slugSuffix = slugParts.slice(1).join('-');
          }
        }

        // Ensure slug suffix isn't empty after all our cleanups
        if (!slugSuffix) {
          slugSuffix = "main";
        }

        // Construct the final slug in the proper format: vendors-category-uniquename
        const newSlug = `vendors-${categoryPrefix}-${slugSuffix}`;

        // Update the form with the correctly formatted slug
        form.setValue("slug", newSlug);

        // Calculate the public URL for logging
        const publicUrl = dbSlugToPublicUrl(newSlug);

        console.log(`Generated vendor slug: ${newSlug}`);
        console.log(`This will appear as URL: ${publicUrl}`);
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  // The Add and Edit dialogs share the same react-hook-form instance, so the
  // form is "dirty" only when one of those dialogs is open *and* the admin has
  // edited a field. Closing the dialog (via mutation success or explicit
  // discard) collapses this back to false on its own.
  const isVendorDialogOpen = isAddDialogOpen || isEditDialogOpen;
  const hasUnsavedVendorChanges =
    isVendorDialogOpen && form.formState.isDirty;

  // Warn before navigating away (router transition, back button, browser
  // unload) while the vendor dialog has edits that haven't been saved or
  // discarded. Stays active during save so a failed save doesn't leave the
  // admin unprotected; on success the dialog closes and this flips to false.
  const unsavedChangesDialog = useUnsavedChangesPrompt(
    hasUnsavedVendorChanges,
    {
      title: "Unsaved vendor changes",
      description:
        "You have unsaved changes to this vendor page. If you leave now, your edits will be lost.",
      confirmLabel: "Discard & Leave",
      cancelLabel: "Stay on Page",
    },
  );

  // Reset the form back to a clean blank state. Used when the admin discards
  // changes via the in-dialog confirmation so the next open of either dialog
  // starts fresh and `formState.isDirty` is false again.
  const resetVendorForm = () => {
    form.reset({
      title: "",
      slug: "",
      content: "",
      category: "",
      isHidden: false,
    });
    setEditorContent("");
  };

  // Handler for the Add dialog's onOpenChange (and Cancel button). When the
  // admin tries to close the dialog while there are unsaved edits, we queue
  // the close behind a styled confirmation instead of dropping their work.
  const handleAddDialogOpenChange = (open: boolean) => {
    if (!open && hasUnsavedVendorChanges) {
      setPendingDialogClose("add");
      return;
    }
    setIsAddDialogOpen(open);
  };

  // Same as above, for the Edit dialog.
  const handleEditDialogOpenChange = (open: boolean) => {
    if (!open && hasUnsavedVendorChanges) {
      setPendingDialogClose("edit");
      return;
    }
    setIsEditDialogOpen(open);
  };

  // Confirm the queued discard: actually close the corresponding dialog,
  // clear any selection, and reset the form so it's no longer dirty.
  const confirmDiscardVendorChanges = () => {
    if (pendingDialogClose === "add") {
      setIsAddDialogOpen(false);
    } else if (pendingDialogClose === "edit") {
      setIsEditDialogOpen(false);
      setSelectedPage(null);
    }
    resetVendorForm();
    setPendingDialogClose(null);
  };

  // Handle form submission for adding page
  const onAddSubmit = (values: PageFormValues) => {
    // Enhanced debugging for vendor creation
    console.log('🟢 Vendor creation form submission started:', values);
    console.log('🟢 Category selected:', values.category);
    console.log('🟢 Content length:', values.content?.length || 0);
    console.log('🟢 Form validation state:', form.formState.isValid);
    console.log('🟢 Form errors:', form.formState.errors);
    
    // Check if we have all required fields
    if (!values.category) {
      console.error('❌ No category selected');
      toast({
        title: "Validation Error",
        description: "Please select a vendor category",
        variant: "destructive",
      });
      return;
    }
    
    if (!values.title?.trim()) {
      console.error('❌ No title provided');
      toast({
        title: "Validation Error", 
        description: "Please enter a vendor title",
        variant: "destructive",
      });
      return;
    }
    
    if (!values.content?.trim()) {
      console.error('❌ No content provided');
      toast({
        title: "Validation Error",
        description: "Please add some content for the vendor page",
        variant: "destructive",
      });
      return;
    }
    
    console.log('🟢 All validation checks passed, submitting to mutation...');
    // Form validation now handles the content properly
    createPageMutation.mutate(values);
  };

  // Handle form submission for editing page
  const onEditSubmit = (values: PageFormValues) => {
    if (!selectedPage) {
      console.error('❌ No page selected for editing');
      return;
    }

    // Enhanced debugging for vendor editing
    console.log('🟡 Vendor edit form submission started:', values);
    console.log('🟡 Selected page ID:', selectedPage.id);
    console.log('🟡 Category selected:', values.category);
    console.log('🟡 Content length:', values.content?.length || 0);
    
    // Form validation now handles the content properly
    updatePageMutation.mutate({
      ...values,
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

  if (isLoadingPages || isLoadingCategories) {
    return <GenericPageLoading />;
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              Failed to load vendor pages: {error instanceof Error ? error.message : "Unknown error"}
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
        <AlertDialogContent data-testid="dialog-vendor-unsaved-changes">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved vendor changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this vendor page. If you close now,
              your edits will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-vendor-unsaved-changes-cancel">
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDiscardVendorChanges}
              data-testid="button-vendor-unsaved-changes-confirm"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <h1 className="text-4xl font-bold mb-8">Vendor Management</h1>

      {/* Vendor Categories Management */}
      <div className="mb-10">
        <ManageVendorCategories />
      </div>

      {/* Vendor Pages Management */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Briefcase className="h-6 w-6 mr-2 text-coral" />
          <h2 className="text-3xl font-bold">Manage Vendor Pages</h2>
        </div>
        <Button 
          onClick={() => {
            setIsAddDialogOpen(true);
            form.reset({
              title: "",
              slug: "",
              content: "",
              category: "",
              isHidden: false,
            });
            setEditorContent("");
          }}
          className="bg-coral hover:bg-coral/90 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New Vendor
        </Button>
      </div>

      <div className="space-y-8">
        {/* Use dynamic categories from the database if available, fall back to hardcoded ones if not */}
        {(vendorCategories && vendorCategories.length > 0 
          ? vendorCategories.map((category) => category.name) 
          : VENDOR_CATEGORIES).map((categoryName) => (
          <Card key={typeof categoryName === 'string' ? categoryName : categoryName.id}>
            <CardHeader>
              <CardTitle>{typeof categoryName === 'string' ? categoryName : categoryName.name}</CardTitle>
              <CardDescription>
                Vendor pages in the {typeof categoryName === 'string' ? categoryName : categoryName.name} category
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
                  {pagesByCategory[typeof categoryName === 'string' ? categoryName : categoryName.name]?.length > 0 ? (
                    pagesByCategory[typeof categoryName === 'string' ? categoryName : categoryName.name].map((page: any, index: number) => (
                      <TableRow key={page.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{page.title}</span>
                            {page.isHidden && (
                              <Badge variant="outline" className="bg-gray-100 text-gray-500 text-xs">
                                <EyeOff className="h-3 w-3 mr-1" />
                                Hidden
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                              {page.slug}
                            </code>
                            <a 
                              href={dbSlugToPublicUrl(page.slug)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-navy/70 hover:text-coral"
                              title="Open vendor page in new tab"
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
                              onClick={() => movePageUpMutation.mutate({ 
                                categoryName: typeof categoryName === 'string' ? categoryName : categoryName.name, 
                                index 
                              })}
                              disabled={index === 0}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => movePageDownMutation.mutate({ 
                                categoryName: typeof categoryName === 'string' ? categoryName : categoryName.name, 
                                index 
                              })}
                              disabled={index === (pagesByCategory[typeof categoryName === 'string' ? categoryName : categoryName.name]?.length || 0) - 1}
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
                              className={page.isHidden ? "text-amber-500 hover:text-amber-700" : "text-gray-500 hover:text-gray-700"}
                              onClick={() => toggleVisibilityMutation.mutate({ id: page.id, isHidden: !!page.isHidden })}
                              title={page.isHidden ? "Show this vendor on the public page" : "Hide this vendor from the public page"}
                            >
                              {page.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => {
                                setSelectedPage(page);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-gray-500">
                        No vendor pages in this category yet
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
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Vendor Page</DialogTitle>
            <DialogDescription>
              Create a new vendor page in the preferred vendors section
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAddSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Vendor Name or Title" 
                        {...field} 
                        className="text-foreground bg-background border-input" 
                      />
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
                    <FormLabel>Vendor Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vendorCategories ? (
                          vendorCategories.map((category: any) => (
                            <SelectItem key={category.id} value={category.slug}>
                              {category.name}
                            </SelectItem>
                          ))
                        ) : (
                          VENDOR_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      This will determine where this vendor appears in navigation
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="vendors-category-unique-name" {...field} readOnly className="bg-gray-50 cursor-not-allowed" />
                    </FormControl>
                    <FormDescription>
                      This will determine the URL. Format: /vendors/[category]/[unique-identifier]
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
                      <WysiwygEditor 
                        editorContent={field.value}
                        setEditorContent={(value) => {
                          field.onChange(value);
                          setEditorContent(value);
                          form.setValue("content", value, { shouldValidate: true });
                        }}
                        editorContext={{
                          section: 'vendors',
                          slug: form.getValues("slug") || 'vendor-new'
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isHidden"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Hide Vendor
                      </FormLabel>
                      <FormDescription>
                        If enabled, this vendor will be hidden from the public view but remain in the system.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
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
                  {createPageMutation.isPending && (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Vendor Page
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Page Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Vendor Page</DialogTitle>
            <DialogDescription>
              Modify the details of this vendor page
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Vendor Name or Title" {...field} />
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
                    <FormLabel>Vendor Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vendorCategories ? (
                          vendorCategories.map((category: any) => (
                            <SelectItem key={category.id} value={category.slug}>
                              {category.name}
                            </SelectItem>
                          ))
                        ) : (
                          VENDOR_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      This will determine where this vendor appears in navigation
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="vendors-category-unique-name" {...field} readOnly className="bg-gray-50 cursor-not-allowed" />
                    </FormControl>
                    <FormDescription>
                      This will determine the URL. Format: /vendors/[category]/[unique-identifier]
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
                      <WysiwygEditor 
                        editorContent={field.value}
                        setEditorContent={(value) => {
                          field.onChange(value);
                          setEditorContent(value);
                          form.setValue("content", value, { shouldValidate: true });
                        }}
                        editorContext={{
                          section: 'vendors',
                          slug: selectedPage?.slug || form.getValues("slug") || 'vendor-edit'
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isHidden"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Hide Vendor
                      </FormLabel>
                      <FormDescription>
                        If enabled, this vendor will be hidden from the public view but remain in the system.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
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
                  {updatePageMutation.isPending && (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Vendor Page
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
            <DialogTitle>Delete Vendor Page</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this vendor page? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedPage && (
              <div className="space-y-2">
                <div className="font-semibold">Page Information:</div>
                <div><span className="font-medium">Title:</span> {selectedPage.title}</div>
                <div><span className="font-medium">Slug:</span> {selectedPage.slug}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={onDeletePage}
              disabled={deletePageMutation.isPending}
            >
              {deletePageMutation.isPending && (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}