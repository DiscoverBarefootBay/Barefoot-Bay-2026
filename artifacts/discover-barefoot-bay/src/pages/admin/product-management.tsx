import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Pencil, Trash, Printer, Upload, RefreshCw, Image } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { Product, ProductCategory, ProductStatus, PrintProvider } from "@shared/schema";
import { PrintfulSyncButton } from "@/components/admin/printful-sync-button";
import { PrintfulIntegration } from "@/components/admin/printful-integration";
import { PrintfulProductManager } from "@/components/admin/printful-product-manager";

// Print-on-demand service form interface
interface PrintServiceConfig {
  apiKey: string;
  serviceProvider: string;
}

// Mock interface for product creation/editing
interface ProductFormData {
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrls: string[];
  status: string;
  featured?: boolean;
  printProvider?: string | null;
  printProviderId?: string | null;
  customProviderId?: string;
  designUrls?: string[];
  mockupUrls?: string[];
  variantData?: Record<string, any>;
}

export default function ProductManagementPage() {
  const { isAdmin } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("products");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [printConfig, setPrintConfig] = useState<PrintServiceConfig>({
    apiKey: "",
    serviceProvider: PrintProvider.PRINTFUL,
  });

  // Form state for product editing/creation
  const [productForm, setProductForm] = useState<ProductFormData>({
    name: "",
    description: "",
    price: 0,
    category: ProductCategory.APPAREL,
    imageUrls: [],
    status: ProductStatus.DRAFT,
  });

  // Form state for design upload
  const [designForm, setDesignForm] = useState({
    productId: 0,
    designFile: null as File | null,
    mockupType: "t-shirt", // default mockup type
  });

  // Fetch products
  const { data: products = [], isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });
  
  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      return await apiRequest<Product>({
        url: "/api/products",
        method: "POST",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setProductDialogOpen(false);
      toast({
        title: "Product created",
        description: "The product has been created successfully.",
      });
      resetProductForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async (data: { id: number; data: Partial<Product> }) => {
      return await apiRequest<Product>({
        url: `/api/products/${data.id}`,
        method: "PATCH",
        body: data.data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setProductDialogOpen(false);
      toast({
        title: "Product updated",
        description: "The product has been updated successfully.",
      });
      resetProductForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest({
        url: `/api/products/${id}`,
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Product deleted",
        description: "The product has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting product",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Toggle featured status mutation
  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ id, featured }: { id: number; featured: boolean }) => {
      return await apiRequest({
        url: `/api/products/${id}`,
        method: "PATCH",
        body: { featured },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Featured status updated",
        description: "The product's featured status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating featured status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Upload design mutation
  const uploadDesignMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return await apiRequest({
        url: "/api/products/design",
        method: "POST",
        body: formData,
        headers: {
          // No Content-Type header, let the browser set it with the boundary
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setUploadDialogOpen(false);
      toast({
        title: "Design uploaded",
        description: "The design has been uploaded successfully.",
      });
      setDesignForm({
        productId: 0,
        designFile: null,
        mockupType: "t-shirt",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error uploading design",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save print service configuration
  const savePrintConfigMutation = useMutation({
    mutationFn: async (config: PrintServiceConfig) => {
      return await apiRequest({
        url: "/api/print-service/config",
        method: "POST",
        body: config,
      });
    },
    onSuccess: () => {
      toast({
        title: "Configuration saved",
        description: "Print service configuration has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving configuration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Function to handle product form submission
  const handleProductSubmit = () => {
    // Create a copy of the form data to modify
    const formData = { 
      ...productForm,
      // Convert price to number to match the schema
      price: Number(productForm.price)
    };
    
    // If using custom provider ID, use the custom value instead
    if (formData.printProviderId === "custom" && formData.customProviderId) {
      formData.printProviderId = formData.customProviderId;
    }
    
    // Remove customProviderId as it's not part of the schema
    delete formData.customProviderId;
    
    if (selectedProduct) {
      updateProductMutation.mutate({
        id: selectedProduct.id,
        data: formData,
      });
    } else {
      createProductMutation.mutate(formData);
    }
  };

  // Function to handle design upload
  const handleDesignUpload = () => {
    if (!designForm.productId || !designForm.designFile) {
      toast({
        title: "Missing information",
        description: "Please select a product and upload a design file.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("productId", designForm.productId.toString());
    formData.append("design", designForm.designFile);
    formData.append("mockupType", designForm.mockupType);

    uploadDesignMutation.mutate(formData);
  };

  // Function to save print service configuration
  const handleSavePrintConfig = () => {
    savePrintConfigMutation.mutate(printConfig);
  };

  // Function to edit a product
  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || "",
      price: Number(product.price),
      category: product.category,
      imageUrls: product.imageUrls || [],
      status: product.status,
      featured: product.featured || false,
      printProvider: product.printProvider || undefined,
      printProviderId: product.printProviderId || undefined,
      designUrls: product.designUrls || [],
      mockupUrls: product.mockupUrls || [],
      variantData: product.variantData || {},
    });
    setProductDialogOpen(true);
  };

  // Function to delete a product
  const handleDeleteProduct = (id: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProductMutation.mutate(id);
    }
  };

  // Function to toggle featured status
  const handleToggleFeatured = (product: Product) => {
    // Toggle the featured status using the new boolean field
    const featured = !product.featured;
    toggleFeaturedMutation.mutate({ 
      id: product.id, 
      featured
    });
  };

  // Reset product form
  const resetProductForm = () => {
    setSelectedProduct(null);
    setProductForm({
      name: "",
      description: "",
      price: 0,
      category: ProductCategory.APPAREL,
      imageUrls: [],
      status: ProductStatus.DRAFT,
      featured: false,
      printProvider: null,
      printProviderId: null,
      customProviderId: "",
    });
  };

  // Format price for display
  const formatPrice = (price: number | string) => {
    if (price === undefined || price === null || price === '') {
      return '$0.00';
    }
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) {
      return '$0.00';
    }
    return `$${numPrice.toFixed(2)}`;
  };

  if (!isAdmin) {
    return (
      <div className="container max-w-7xl mx-auto p-8">
        <h1 className="text-3xl font-bold">Access Denied</h1>
        <p className="mt-4">You do not have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Product Management</h1>
        <Button variant="outline" onClick={() => window.location.href = "/admin/product-image-test"}>
          Test Image Upload
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="designs">Design Upload</TabsTrigger>
          <TabsTrigger value="printful">Printful Products</TabsTrigger>
          <TabsTrigger value="settings">Print Service Settings</TabsTrigger>
        </TabsList>
        
        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Product Catalog</h2>
            <Button onClick={() => {
              resetProductForm();
              setProductDialogOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
          </div>
          
          {isLoadingProducts ? (
            <div className="text-center py-8">Loading products...</div>
          ) : products.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No products found. Click "Add Product" to create your first product.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Table>
              <TableCaption>List of all products</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Print Provider</TableHead>
                  <TableHead>Featured</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>{formatPrice(product.price)}</TableCell>
                    <TableCell>{product.status}</TableCell>
                    <TableCell>{product.printProvider || "—"}</TableCell>
                    <TableCell>
                      <Button
                        variant={product.featured ? "default" : "outline"}
                        size="sm"
                        className={product.featured ? "bg-green-600 hover:bg-green-700" : ""}
                        onClick={() => handleToggleFeatured(product)}
                      >
                        {product.featured ? "Highlighted" : "Not Highlighted"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditProduct(product)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          setDesignForm({
                            ...designForm,
                            productId: product.id,
                          });
                          setActiveTab("designs");
                        }}>
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteProduct(product.id)}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* Product Dialog */}
          <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{selectedProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
                <DialogDescription>
                  {selectedProduct 
                    ? "Update the details for this product" 
                    : "Enter the details for the new product"}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input
                    id="name"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">Description</Label>
                  <Textarea
                    id="description"
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="price" className="text-right">Price ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: parseFloat(e.target.value) })}
                    className="col-span-3"
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="category" className="text-right">Category</Label>
                  <Select
                    value={productForm.category}
                    onValueChange={(value) => setProductForm({ ...productForm, category: value })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ProductCategory.APPAREL}>Apparel</SelectItem>
                      <SelectItem value={ProductCategory.HOME}>Home</SelectItem>
                      <SelectItem value={ProductCategory.ACCESSORIES}>Accessories</SelectItem>
                      <SelectItem value={ProductCategory.SPONSORSHIP}>Sponsorship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="status" className="text-right">Status</Label>
                  <Select
                    value={productForm.status}
                    onValueChange={(value) => setProductForm({ ...productForm, status: value })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ProductStatus.ACTIVE}>Active</SelectItem>
                      <SelectItem value={ProductStatus.INACTIVE}>Inactive</SelectItem>
                      <SelectItem value={ProductStatus.DRAFT}>Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="featured" className="text-right">Highlight</Label>
                  <div className="flex items-center space-x-2 col-span-3">
                    <Checkbox
                      id="featured"
                      checked={productForm.featured}
                      onCheckedChange={(checked) => 
                        setProductForm({ ...productForm, featured: Boolean(checked) })
                      }
                    />
                    <Label htmlFor="featured" className="text-sm font-normal">
                      Highlight this product in its category
                    </Label>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="printProvider" className="text-right">Print Provider</Label>
                  <Select
                    value={productForm.printProvider || "none"}
                    onValueChange={(value) => setProductForm({ ...productForm, printProvider: value === "none" ? null : value })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select a print provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value={PrintProvider.PRINTFUL}>Printful</SelectItem>
                      <SelectItem value={PrintProvider.PRINTIFY}>Printify</SelectItem>
                      <SelectItem value={PrintProvider.GOOTEN}>Gooten</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {productForm.printProvider && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="productType" className="text-right">Product Type</Label>
                    <div className="col-span-3 space-y-2">
                      <Select
                        value={productForm.printProviderId || ""}
                        onValueChange={(value) => setProductForm({ ...productForm, printProviderId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a product type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tshirt">T-Shirt</SelectItem>
                          <SelectItem value="mug">Coffee Mug</SelectItem>
                          <SelectItem value="hoodie">Hoodie</SelectItem>
                          <SelectItem value="tote">Tote Bag</SelectItem>
                          <SelectItem value="hat">Baseball Cap</SelectItem>
                          <SelectItem value="poster">Poster</SelectItem>
                          <SelectItem value="custom">Custom (Enter ID)</SelectItem>
                        </SelectContent>
                      </Select>
                      {productForm.printProviderId === "custom" && (
                        <Input
                          id="customProviderId"
                          value={productForm.customProviderId || ""}
                          onChange={(e) => setProductForm({ ...productForm, customProviderId: e.target.value })}
                          className="mt-2"
                          placeholder="Enter custom product ID"
                        />
                      )}
                      <p className="text-sm text-muted-foreground">
                        Select the type of product you want to sell. This helps match your product with the correct template in the print-on-demand service.
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="imageUrl" className="text-right">Product Image</Label>
                  <div className="col-span-3 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        id="imageUrl"
                        placeholder="Enter image URL"
                        value={productForm.imageUrls[0] || ""}
                        onChange={(e) => {
                          const newUrls = [...productForm.imageUrls];
                          if (newUrls.length === 0) {
                            newUrls.push(e.target.value);
                          } else {
                            newUrls[0] = e.target.value;
                          }
                          setProductForm({ ...productForm, imageUrls: newUrls });
                        }}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        type="button"
                        onClick={() => {
                          // Create a hidden file input element
                          const fileInput = document.createElement('input');
                          fileInput.type = 'file';
                          fileInput.accept = 'image/*';
                          
                          // Add event listener for when a file is selected
                          fileInput.addEventListener('change', async (e) => {
                            const target = e.target as HTMLInputElement;
                            if (target.files && target.files[0]) {
                              const file = target.files[0];
                              
                              // Create form data to upload
                              const formData = new FormData();
                              formData.append('image', file);
                              
                              try {
                                // Show loading toast
                                toast({
                                  title: "Uploading image...",
                                  description: "Please wait while we upload your image.",
                                });
                                
                                // Upload the image
                                const response = await fetch('/api/products/upload/product-image', {
                                  method: 'POST',
                                  body: formData,
                                });
                                
                                if (!response.ok) {
                                  throw new Error('Failed to upload image');
                                }
                                
                                const data = await response.json();
                                
                                // Update the product form with the image URL
                                const imageUrl = data.imageUrl;
                                const newUrls = [...productForm.imageUrls];
                                if (newUrls.length === 0) {
                                  newUrls.push(imageUrl);
                                } else {
                                  newUrls[0] = imageUrl;
                                }
                                setProductForm({ ...productForm, imageUrls: newUrls });
                                
                                // Show success toast
                                toast({
                                  title: "Image uploaded",
                                  description: "Your image has been uploaded successfully.",
                                });
                              } catch (error) {
                                console.error("Error uploading image:", error);
                                toast({
                                  title: "Upload failed",
                                  description: "Failed to upload image. Please try again.",
                                  variant: "destructive",
                                });
                              }
                            }
                          });
                          
                          // Trigger the file input click
                          fileInput.click();
                        }}
                      >
                        <Image className="h-4 w-4" />
                      </Button>
                    </div>
                    {productForm.imageUrls[0] && (
                      <div className="mt-2 border rounded-md p-2 max-w-[200px]">
                        <img 
                          src={productForm.imageUrls[0]} 
                          alt="Product Preview" 
                          className="w-full h-auto"
                          onError={(e) => {
                            // If image fails to load, show error message
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = "https://placehold.co/200x200/lightgray/gray?text=Image+Error";
                          }}
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Upload a product image or enter an image URL directly
                    </p>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleProductSubmit}
                  disabled={createProductMutation.isPending || updateProductMutation.isPending}
                >
                  {createProductMutation.isPending || updateProductMutation.isPending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {selectedProduct ? "Update Product" : "Create Product"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
        
        {/* Designs Tab */}
        <TabsContent value="designs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Design</CardTitle>
              <CardDescription>
                Upload designs for your products and generate print-on-demand mockups
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {products.length === 0 ? (
                <div className="bg-muted p-4 rounded-md mb-4">
                  <p className="text-sm text-center mb-2">
                    No products found. You need to create a product before you can upload designs.
                  </p>
                  <div className="flex justify-center">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        resetProductForm();
                        setActiveTab("products");
                        setProductDialogOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Create a Product
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="productSelect" className="text-right">
                    Product
                  </Label>
                  <Select
                    value={designForm.productId ? designForm.productId.toString() : ""}
                    onValueChange={(value) => setDesignForm({ ...designForm, productId: parseInt(value) })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="designFile" className="text-right">
                  Design File
                </Label>
                <div className="col-span-3">
                  <Input
                    id="designFile"
                    type="file"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setDesignForm({ ...designForm, designFile: e.target.files[0] });
                      }
                    }}
                    accept="image/*"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Recommended: PNG with transparent background, minimum 4000x4000 pixels
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="mockupType" className="text-right">
                  Mockup Type
                </Label>
                <div className="col-span-3 space-y-2">
                  <Select
                    value={designForm.mockupType}
                    onValueChange={(value) => setDesignForm({ ...designForm, mockupType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select mockup type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="t-shirt">T-Shirt</SelectItem>
                      <SelectItem value="hoodie">Hoodie</SelectItem>
                      <SelectItem value="mug">Mug</SelectItem>
                      <SelectItem value="poster">Poster</SelectItem>
                      <SelectItem value="tote">Tote Bag</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    This determines how your design will be presented in the product preview. The mockup will be generated using your design on the selected product type.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button 
                onClick={handleDesignUpload}
                disabled={uploadDesignMutation.isPending}
              >
                {uploadDesignMutation.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                Upload & Generate Mockups
              </Button>
            </CardFooter>
          </Card>
          
          {selectedProduct && (
            <Card>
              <CardHeader>
                <CardTitle>Current Designs for {selectedProduct.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedProduct.designUrls && selectedProduct.designUrls.map((url, index) => (
                    <div key={index} className="border rounded-md p-2">
                      <img src={url} alt={`Design ${index + 1}`} className="w-full h-auto" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* Settings Tab */}
        {/* Printful Products Tab */}
        <TabsContent value="printful" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Printful Products</h2>
            <Button variant="outline" onClick={() => window.location.href = "/admin/printful"}>
              Advanced Printful Settings
            </Button>
          </div>
          
          <Card className="mb-4">
            <CardContent className="pt-6">
              <PrintfulSyncButton />
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <PrintfulProductManager onSelectProduct={(product) => {
                // Create a new product from the Printful product
                const newProduct = {
                  name: product.name,
                  description: product.description || "",
                  price: product.retail_price,
                  category: ProductCategory.APPAREL,
                  imageUrls: product.thumbnail_url ? [product.thumbnail_url] : [],
                  status: ProductStatus.DRAFT,
                  printProvider: PrintProvider.PRINTFUL,
                  printProviderId: product.id.toString(),
                  variantData: product.variant_data || {}
                };
                
                // Set the form data
                setProductForm(newProduct);
                
                // Open the dialog
                setSelectedProduct(null);
                setProductDialogOpen(true);
                
                // Switch to products tab
                setActiveTab("products");
              }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Print Service Configuration</CardTitle>
              <CardDescription>
                Configure your print-on-demand service credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="printProvider" className="text-right">
                  Service Provider
                </Label>
                <Select
                  value={printConfig.serviceProvider}
                  onValueChange={(value) => setPrintConfig({ ...printConfig, serviceProvider: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select service provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PrintProvider.PRINTFUL}>Printful</SelectItem>
                    <SelectItem value={PrintProvider.PRINTIFY}>Printify</SelectItem>
                    <SelectItem value={PrintProvider.GOOTEN}>Gooten</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="apiKey" className="text-right">
                  API Key
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={printConfig.apiKey}
                  onChange={(e) => setPrintConfig({ ...printConfig, apiKey: e.target.value })}
                  className="col-span-3"
                  placeholder="Enter your API key"
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button 
                onClick={handleSavePrintConfig}
                disabled={savePrintConfigMutation.isPending}
              >
                {savePrintConfigMutation.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save Configuration
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Print Service Overview</CardTitle>
              <CardDescription>
                Overview of your print-on-demand service integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-medium">Service Provider</span>
                  <span>{printConfig.serviceProvider}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-medium">Connected</span>
                  <span>{printConfig.apiKey ? "Yes" : "No"}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-medium">Products with POD Integration</span>
                  <span>{products.filter(p => p.printProvider).length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Printful Integration */}
          <PrintfulIntegration />
        </TabsContent>
      </Tabs>
    </div>
  );
}