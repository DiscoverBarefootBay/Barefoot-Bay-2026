/**
 * Printful Product Manager Component
 * 
 * This component allows administrators to browse the Printful catalog,
 * view available products, and add them to the store.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Search, Tag, Filter, ShoppingBag, PackageCheck, Truck, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PrintfulProduct {
  id: number;
  name: string;
  thumbnail_url: string;
  variants: PrintfulVariant[];
  description?: string;
}

interface PrintfulVariant {
  id: number;
  name: string;
  price: string;
  retail_price: string;
  thumbnail_url: string;
  variant_id: number;
}

interface StoreProduct {
  external_id: string;
  name: string;
  thumbnail_url: string;
  variants: {
    id: number;
    name: string;
    price: string;
    sync_product_id: number;
  }[];
}

export function PrintfulProductManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<PrintfulProduct | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<number[]>([]);
  const [productPrice, setProductPrice] = useState<string>("0.00");
  const [activeTab, setActiveTab] = useState("catalog");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch Printful catalog
  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ["/api/printful/catalog"],
    enabled: activeTab === "catalog",
  });

  // Fetch Printful store products
  const { data: storeProducts, isLoading: storeProductsLoading } = useQuery({
    queryKey: ["/api/printful/products"],
    enabled: activeTab === "store",
  });

  // Add product to store mutation
  const addProductMutation = useMutation({
    mutationFn: (productData: any) => 
      apiRequest("/api/printful/products", "POST", productData),
    onSuccess: () => {
      toast({
        title: "Product Added",
        description: "The product has been added to your store",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/printful/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedProduct(null);
      setSelectedVariants([]);
      setProductPrice("0.00");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to add product: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Filter categories from catalog data
  const categories = catalog?.result ? 
    Array.from(new Set(catalog.result.map((p: PrintfulProduct) => {
      // Extract category from product name (e.g., "Men's T-Shirt" -> "T-Shirt")
      // Check if p.name exists first to avoid errors
      if (!p.name) return 'Unknown';
      const nameParts = p.name.split(' ');
      return nameParts[nameParts.length - 1];
    }))) : 
    [];

  // Filter products based on search and category
  const filteredProducts = catalog?.result ? 
    catalog.result.filter((product: PrintfulProduct) => {
      // Validate product has a name
      if (!product.name) return false;
      
      // Match search term
      const matchesSearch = searchTerm === "" || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Match category
      const matchesCategory = selectedCategory === "all" || 
        product.name.toLowerCase().includes(selectedCategory.toLowerCase());
      
      return matchesSearch && matchesCategory;
    }) : 
    [];

  // Handle adding a product to the store
  const handleAddProduct = () => {
    if (!selectedProduct) return;
    
    // Get selected variants or default to all variants
    const variants = selectedVariants.length > 0 
      ? selectedProduct.variants.filter(v => selectedVariants.includes(v.id))
      : selectedProduct.variants;
    
    const productData = {
      name: selectedProduct.name,
      description: selectedProduct.description || selectedProduct.name,
      variants: variants.map(v => ({
        variant_id: v.variant_id,
        retail_price: productPrice || v.retail_price
      }))
    };
    
    addProductMutation.mutate(productData);
  };

  // Toggle variant selection
  const toggleVariant = (variantId: number) => {
    setSelectedVariants(prev => 
      prev.includes(variantId)
        ? prev.filter(id => id !== variantId)
        : [...prev, variantId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Printful Products</h2>
        <div className="flex items-center space-x-2">
          <Button
            variant={activeTab === "store" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("store")}
          >
            <Store className="mr-2 h-4 w-4" />
            My Store
          </Button>
          <Button
            variant={activeTab === "catalog" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("catalog")}
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            Printful Catalog
          </Button>
        </div>
      </div>
      
      <Separator />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsContent value="catalog" className="space-y-4">
          {/* Catalog View */}
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category: string) => (
                    <SelectItem key={category} value={category.toLowerCase()}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {catalogLoading ? (
              <div className="flex justify-center p-8">
                <Spinner size="lg" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((product: PrintfulProduct) => (
                  <Card key={product.id} className="overflow-hidden">
                    <CardHeader className="p-4">
                      <CardTitle className="text-sm truncate">{product.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {product.variants.length} variants available
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="aspect-square relative overflow-hidden rounded-md">
                        <img
                          src={product.thumbnail_url}
                          alt={product.name}
                          className="object-cover w-full h-full"
                        />
                      </div>
                    </CardContent>
                    <CardFooter className="p-4 pt-0 flex justify-end">
                      <Button 
                        onClick={() => setSelectedProduct(product)}
                        variant="outline" 
                        size="sm"
                      >
                        View Details
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
          
          {/* Product Details Modal */}
          {selectedProduct && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-3xl max-h-[80vh] overflow-y-auto">
                <CardHeader>
                  <CardTitle>{selectedProduct.name}</CardTitle>
                  <CardDescription>
                    {selectedProduct.description || "Select variants to add to your store"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Product Image</Label>
                      <div className="aspect-square overflow-hidden rounded-md mt-2">
                        <img
                          src={selectedProduct.thumbnail_url}
                          alt={selectedProduct.name}
                          className="object-cover w-full h-full"
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="price">Retail Price ($)</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          min="0"
                          value={productPrice}
                          onChange={(e) => setProductPrice(e.target.value)}
                          className="mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Set a custom retail price or leave at 0 to use Printful's retail price
                        </p>
                      </div>
                      
                      <div>
                        <Label>Select Variants</Label>
                        <div className="grid grid-cols-1 gap-2 mt-2">
                          {selectedProduct.variants.map((variant) => (
                            <div
                              key={variant.id}
                              className={`p-2 border rounded-md cursor-pointer flex items-center justify-between ${
                                selectedVariants.includes(variant.id) ? "border-primary bg-primary/10" : ""
                              }`}
                              onClick={() => toggleVariant(variant.id)}
                            >
                              <div className="flex items-center">
                                <div className="w-10 h-10 rounded overflow-hidden mr-2">
                                  <img
                                    src={variant.thumbnail_url}
                                    alt={variant.name}
                                    className="object-cover w-full h-full"
                                  />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{variant.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Base: ${variant.price} | Retail: ${variant.retail_price}
                                  </p>
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={selectedVariants.includes(variant.id)}
                                onChange={() => {}}
                                className="h-4 w-4"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={() => setSelectedProduct(null)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddProduct}
                    disabled={addProductMutation.isPending}
                  >
                    {addProductMutation.isPending ? (
                      <>
                        <Spinner className="mr-2" size="sm" /> 
                        Adding...
                      </>
                    ) : (
                      <>Add to Store</>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="store" className="space-y-4">
          {/* Store Products View */}
          {storeProductsLoading ? (
            <div className="flex justify-center p-8">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">My Printful Products</h3>
                <Button
                  size="sm"
                  onClick={() => setActiveTab("catalog")}
                >
                  Add New Product
                </Button>
              </div>
              
              {storeProducts?.result && storeProducts.result.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {storeProducts.result.map((product: StoreProduct) => (
                    <Card key={product.external_id} className="overflow-hidden">
                      <CardHeader className="p-4">
                        <CardTitle className="text-sm truncate">{product.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {product.variants.length} variants
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="aspect-square relative overflow-hidden rounded-md">
                          <img
                            src={product.thumbnail_url}
                            alt={product.name}
                            className="object-cover w-full h-full"
                          />
                        </div>
                      </CardContent>
                      <CardFooter className="p-4 pt-0 flex justify-between">
                        <Badge variant="outline" className="flex items-center">
                          <PackageCheck className="mr-1 h-3 w-3" />
                          Printful
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          // TODO: Add product details/edit view
                          onClick={() => {}}
                        >
                          Manage
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 border rounded-lg">
                  <Store className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Products Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    You haven't added any Printful products to your store.
                  </p>
                  <Button onClick={() => setActiveTab("catalog")}>
                    Browse Printful Catalog
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}