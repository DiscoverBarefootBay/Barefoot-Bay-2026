import { useState, useEffect } from "react";
import { RouteComponentProps, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Save, Trash2, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { queryClient } from "@/lib/queryClient";
import { GenericPageLoading } from "@/components/shared/generic-page-loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";

interface ForumCategory {
  id: number;
  name: string;
  description: string | null;
  slug: string;
  icon: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  postCount?: number;
}

// Form schema for creating/editing categories
const categoryFormSchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(50, "Category name cannot exceed 50 characters"),
  description: z
    .string()
    .max(500, "Description cannot exceed 500 characters")
    .nullable()
    .optional(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(50, "Slug cannot exceed 50 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  icon: z.string().nullable().optional(),
  order: z.number().int().min(0).default(0),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

function ManageForumCategories(_props: RouteComponentProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const [isEditMode, setIsEditMode] = useState<{ [key: number]: boolean }>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ForumCategory | null>(null);

  // Form for adding/editing categories
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      description: "",
      slug: "",
      icon: "",
      order: 0,
    },
  });

  // Query for fetching categories
  const {
    data: categories,
    isLoading,
    error,
  } = useQuery<ForumCategory[]>({
    queryKey: ["/api/forum/categories"],
  });

  // Mutations for CRUD operations
  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormValues) => {
      return apiRequest("POST", "/api/forum/categories", data);
    },
    onSuccess: () => {
      toast({
        title: "Category created",
        description: "The forum category has been created successfully.",
      });
      
      // Force a refetch of the data to update the UI
      queryClient.invalidateQueries({ queryKey: ["/api/forum/categories"] });
      
      // Add a slight delay and then refetch to ensure we get the latest data
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["/api/forum/categories"] });
      }, 300);
      
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Failed to create category",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CategoryFormValues }) => {
      return apiRequest("PATCH", `/api/forum/categories/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Category updated",
        description: "The forum category has been updated successfully.",
      });
      
      // Force a refetch of the data to update the UI
      queryClient.invalidateQueries({ queryKey: ["/api/forum/categories"] });
      
      // Add a slight delay and then refetch to ensure we get the latest data
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["/api/forum/categories"] });
      }, 300);
      
      setEditingCategory(null);
      setIsEditMode({});
    },
    onError: (error) => {
      toast({
        title: "Failed to update category",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/forum/categories/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Category deleted",
        description: "The forum category has been deleted successfully.",
      });
      
      // Force a refetch of the data to update the UI
      queryClient.invalidateQueries({ queryKey: ["/api/forum/categories"] });
      
      // Add a slight delay and then refetch to ensure we get the latest data
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["/api/forum/categories"] });
      }, 300);
    },
    onError: (error) => {
      toast({
        title: "Failed to delete category",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Check admin permission
  useEffect(() => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [isAdmin, navigate]);

  // Handle create form submission
  const onSubmitCreate = (data: CategoryFormValues) => {
    createCategoryMutation.mutate(data);
  };

  // Handle edit form submission
  const onSubmitEdit = (data: CategoryFormValues) => {
    if (!editingCategory) return;
    updateCategoryMutation.mutate({ id: editingCategory.id, data });
  };

  // Start editing a category
  const startEditing = (category: ForumCategory) => {
    setEditingCategory(category);
    setIsEditMode({ ...isEditMode, [category.id]: true });
    
    // Set form values
    form.reset({
      name: category.name,
      description: category.description || "",
      slug: category.slug,
      icon: category.icon || "",
      order: category.order,
    });
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingCategory(null);
    setIsEditMode({});
    form.reset();
  };

  // Delete a category
  const deleteCategory = (id: number) => {
    if (window.confirm("Are you sure you want to delete this category? This action cannot be undone and will remove all posts in this category.")) {
      deleteCategoryMutation.mutate(id);
    }
  };

  // Reorder categories
  const reorderCategory = (id: number, direction: "up" | "down") => {
    const category = categories?.find(c => c.id === id);
    if (!category) return;
    
    // First, let's ensure all categories have unique orders by fixing any duplicates
    // This will create a sorted array where each category has a sequential order value
    const orderedCategories = normalizeOrderValues();
    
    // Find current category's index in the normalized list
    const currentIndex = orderedCategories.findIndex(c => c.id === id);
    if (currentIndex === -1) return;
    
    // For the UP direction, swap with the previous item if not already at the top
    if (direction === "up") {
      if (currentIndex === 0) {
        console.log("Can't move up - already at the top");
        return;
      }
      
      const prevCategory = orderedCategories[currentIndex - 1];
      
      console.log(`Moving category ${category.name} (ID: ${category.id}) UP: changing order from ${currentIndex} to ${currentIndex - 1}`);
      console.log(`Swapping with category ${prevCategory.name} (ID: ${prevCategory.id}): order ${prevCategory.order}`);
      
      // Update this category to have the lower order (move it up)
      updateCategoryMutation.mutate({
        id,
        data: {
          ...category,
          order: currentIndex - 1 // Use normalized index-based order
        }
      });
      
      // Update the other category to have the higher order
      updateCategoryMutation.mutate({
        id: prevCategory.id,
        data: {
          ...prevCategory,
          order: currentIndex // Use normalized index-based order
        }
      });
    } 
    // For DOWN direction, swap with the next item if not already at the bottom
    else {
      if (currentIndex === orderedCategories.length - 1) {
        console.log("Can't move down - already at the bottom");
        return;
      }
      
      const nextCategory = orderedCategories[currentIndex + 1];
      
      console.log(`Moving category ${category.name} (ID: ${category.id}) DOWN: changing order from ${currentIndex} to ${currentIndex + 1}`);
      console.log(`Swapping with category ${nextCategory.name} (ID: ${nextCategory.id}): order ${nextCategory.order}`);
      
      // Update this category to have the higher order (move it down)
      updateCategoryMutation.mutate({
        id,
        data: {
          ...category,
          order: currentIndex + 1 // Use normalized index-based order
        }
      });
      
      // Update the other category to have the lower order
      updateCategoryMutation.mutate({
        id: nextCategory.id,
        data: {
          ...nextCategory,
          order: currentIndex // Use normalized index-based order
        }
      });
    }
  };
  
  // Helper function to normalize category order values to ensure they are sequential without duplicates
  const normalizeOrderValues = () => {
    if (!categories) return [];
    
    // Sort categories by their current order
    const sorted = [...categories].sort((a, b) => {
      // Primary sort by order
      if (a.order !== b.order) return a.order - b.order;
      // Secondary sort by ID to handle duplicates consistently
      return a.id - b.id;
    });
    
    // For debugging: log any duplicate order values
    const orderCounts = sorted.reduce((acc, cat) => {
      acc[cat.order] = (acc[cat.order] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    const duplicates = Object.entries(orderCounts).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log("Found duplicate order values:", duplicates);
    }
    
    // Return the sorted list (we don't actually update the DB here, just prepare the list)
    return sorted;
  };

  // Loading state
  if (isLoading) {
    return <GenericPageLoading />;
  }

  // Error state
  if (error || !isAdmin) {
    return (
      <div className="container max-w-4xl mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              {error instanceof Error
                ? error.message
                : !isAdmin
                ? "You don't have permission to access this page."
                : "An unknown error occurred."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Sort categories by order if available
  const sortedCategories = categories 
    ? [...categories].sort((a, b) => a.order - b.order) 
    : [];

  return (
    <div className="container max-w-6xl mx-auto py-10">
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">Forum Categories</CardTitle>
              <CardDescription>
                Manage forum categories for the community forum
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-coral hover:bg-coral/90 text-white">
                  <Plus className="mr-2 h-4 w-4" /> Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Forum Category</DialogTitle>
                  <DialogDescription>
                    Create a new category for the community forum
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmitCreate)} className="space-y-4 mt-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., General Discussion" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slug</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., general-discussion" 
                              {...field} 
                              onChange={(e) => {
                                // Auto-generate slug from name if user hasn't customized it yet
                                if (!form.getValues().slug || form.getValues().slug === field.value) {
                                  const value = e.target.value
                                    .toLowerCase()
                                    .replace(/[^a-z0-9\s-]/g, "")
                                    .replace(/\s+/g, "-");
                                  field.onChange(value);
                                } else {
                                  // User has customized the slug, so respect their input
                                  const value = e.target.value
                                    .toLowerCase()
                                    .replace(/[^a-z0-9-]/g, "");
                                  field.onChange(value);
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Used in URLs. Only lowercase letters, numbers, and hyphens.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Brief description of the category"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="icon"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Icon (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Icon name (Lucide icon)"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Name of a Lucide icon (e.g., "message-square")
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="order"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Order</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                              value={field.value}
                            />
                          </FormControl>
                          <FormDescription>
                            Lower numbers appear first
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          form.reset();
                          setIsAddDialogOpen(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        className="bg-coral hover:bg-coral/90 text-white"
                        disabled={createCategoryMutation.isPending}
                      >
                        {createCategoryMutation.isPending ? "Creating..." : "Create Category"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Order</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="w-[100px] text-right">Posts</TableHead>
                <TableHead className="text-right w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCategories.length > 0 ? (
                sortedCategories.map((category, index) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <span>{index + 1}</span>
                        <div className="flex flex-col">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6"
                            onClick={() => reorderCategory(category.id, "up")}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6"
                            onClick={() => reorderCategory(category.id, "down")}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isEditMode[category.id] ? (
                        <Form {...form}>
                          <div className="space-y-2">
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Textarea 
                                      {...field} 
                                      value={field.value || ""}
                                      className="min-h-[80px]" 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </Form>
                      ) : (
                        <div>
                          <div className="font-medium">{category.name}</div>
                          {category.description && (
                            <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                              {category.description}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditMode[category.id] ? (
                        <Form {...form}>
                          <FormField
                            control={form.control}
                            name="slug"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </Form>
                      ) : (
                        category.slug
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {category.postCount || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditMode[category.id] ? (
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelEditing}
                          >
                            <X className="h-4 w-4 mr-1" /> Cancel
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-coral hover:bg-coral/90 text-white"
                            onClick={form.handleSubmit(onSubmitEdit)}
                            disabled={updateCategoryMutation.isPending}
                          >
                            <Save className="h-4 w-4 mr-1" /> Save
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditing(category)}
                          >
                            <Pencil className="h-4 w-4 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteCategory(category.id)}
                            disabled={deleteCategoryMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No categories found. Create your first category to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default ManageForumCategories;