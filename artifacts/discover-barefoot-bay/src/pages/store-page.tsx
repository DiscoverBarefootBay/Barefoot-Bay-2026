import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ProductCategory } from "@shared/schema";
import { Product } from "@shared/schema";
import { ShoppingCart, Trash, Plus, Minus } from "lucide-react";
import { CheckoutDialog } from "@/components/store/checkout-dialog";
// Import CSS modules to hide featured products section
import styles from "@/components/store/store-override.module.css";
import { useAuth } from "@/hooks/use-auth";

type CartItem = {
  product: Product;
  quantity: number;
  variant?: string;
};

export default function StorePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<string>(ProductCategory.ALL);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Get user-specific cart key
  const getCartKey = () => {
    return user ? `barefootbay-cart-${user.id}` : 'barefootbay-cart-guest';
  };
  
  // Initialize cart from localStorage with user-specific key
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined' && user) {
      const savedCart = localStorage.getItem(getCartKey());
      
      // Dynamically add CSS override to hide featured products
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/hide-featured.css';
      document.head.appendChild(link);
      
      return savedCart ? JSON.parse(savedCart) : [];
    }
    return [];
  });
  
  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      localStorage.setItem(getCartKey(), JSON.stringify(cart));
    }
  }, [cart, user]);

  // Update store visit tracking when page loads
  useEffect(() => {
    const updateVisit = async () => {
      try {
        await fetch('/api/products/visit', {
          method: 'POST',
          credentials: 'include'
        });
      } catch (error) {
        console.error('Failed to update store visit tracking:', error);
      }
    };

    updateVisit();
  }, []);

  // Clear cart when user changes
  useEffect(() => {
    if (user) {
      const savedCart = localStorage.getItem(getCartKey());
      setCart(savedCart ? JSON.parse(savedCart) : []);
    } else {
      setCart([]);
    }
  }, [user]);
  
  // Effect to find and hide featured products section
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Use a timeout to ensure DOM is fully loaded
      const timeoutId = setTimeout(() => {
        // Find all h2 elements
        const headings = document.querySelectorAll('h2');
        
        // Loop through headings and hide any that contain "FEATURED PRODUCTS"
        headings.forEach(heading => {
          if (heading.textContent?.includes('FEATURED PRODUCTS')) {
            // Add class to hide the heading
            heading.classList.add('hide-featured-heading');
            
            // Hide the next element (likely the carousel)
            const nextElement = heading.nextElementSibling;
            if (nextElement) {
              nextElement.classList.add('hide-featured-content');
            }
            
            // Also try parent approach
            const parent = heading.parentElement;
            if (parent) {
              parent.style.display = 'none';
            }
          }
        });
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, []);
  
  // Fetch highlighted products for sponsorship tab (using legacy API endpoint for now)
  const { data: highlightedProducts = [], isLoading: highlightedLoading } = useQuery<Product[]>({
    queryKey: ['/api/products/featured'],
  });
  
  // Fetch products by current category
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: [`/api/products/category/${activeCategory}`],
  });
  
  // Calculate cart total
  const cartTotal = cart.reduce((total, item) => {
    return total + (Number(item.product.price) * item.quantity);
  }, 0);
  
  // Add item to cart
  const addToCart = (product: Product, variant?: string) => {
    setCart(prevCart => {
      // Check if product is already in cart
      const existingItem = prevCart.find(
        item => item.product.id === product.id && item.variant === variant
      );
      
      if (existingItem) {
        // Update quantity if item exists
        toast({
          title: "Quantity updated",
          description: `Increased quantity of ${product.name} in your cart.`,
        });
        return prevCart.map(item => 
          item.product.id === product.id && item.variant === variant
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        // Add new item to cart
        toast({
          title: "Item added to cart",
          description: `${product.name} has been added to your cart.`,
        });
        return [...prevCart, { product, quantity: 1, variant }];
      }
    });
  };
  
  // Update cart item quantity
  const updateQuantity = (index: number, amount: number) => {
    setCart(prevCart => {
      const newCart = [...prevCart];
      newCart[index].quantity += amount;
      
      // Remove item if quantity is 0
      if (newCart[index].quantity <= 0) {
        newCart.splice(index, 1);
      }
      
      return newCart;
    });
  };
  
  // Remove item from cart
  const removeFromCart = (index: number) => {
    setCart(prevCart => {
      const newCart = [...prevCart];
      const removedItem = newCart[index];
      newCart.splice(index, 1);
      
      toast({
        title: "Item removed",
        description: `${removedItem.product.name} has been removed from your cart.`,
      });
      
      return newCart;
    });
  };
  
  // Clear cart
  const clearCart = () => {
    if (cart.length > 0) {
      toast({
        title: "Cart cleared",
        description: "All items have been removed from your cart.",
      });
      setCart([]);
    }
  };
  
  // Format price
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
  
  // Skip featured products section
  // Modified to completely remove the featured products carousel
  return (
    <div className={`container max-w-7xl mx-auto p-8 ${styles.hideFeaturedProducts}`}>
      <div className="hidden md:flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Barefoot Bay Community Store</h1>
        
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="relative">
              <ShoppingCart className="h-5 w-5 mr-2" />
              <span>Cart</span>
              {cart.length > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2">
                  {cart.length}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Shopping Cart</SheetTitle>
              <SheetDescription>
                Review your items before checkout
              </SheetDescription>
            </SheetHeader>
            
            <div className="mt-6 flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item, index) => (
                    <div key={`${item.product.id}-${item.variant || 'default'}`} className="flex justify-between items-center p-4 bg-muted/40 rounded-lg">
                      <div>
                        <h3 className="font-medium">{item.product.name}</h3>
                        {item.variant && (
                          <p className="text-sm text-muted-foreground">Variant: {item.variant}</p>
                        )}
                        <div className="flex items-center mt-2 space-x-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => updateQuantity(index, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => updateQuantity(index, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span>{formatPrice(Number(item.product.price) * item.quantity)}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive mt-2"
                          onClick={() => removeFromCart(index)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="mt-4">
              <Separator />
              <div className="flex justify-between py-4">
                <span className="font-medium">Total</span>
                <span className="font-bold">{formatPrice(cartTotal)}</span>
              </div>
              <Separator />
            </div>
            
            <SheetFooter className="mt-6">
              <div className="grid w-full gap-2">
                <Button 
                  className="w-full bg-coral hover:bg-coral/90" 
                  disabled={cart.length === 0}
                  onClick={() => {
                    if (cart.length > 0) {
                      setIsCheckoutOpen(true);
                    }
                  }}
                >
                  Proceed to Checkout
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                >
                  Clear Cart
                </Button>
                <SheetClose asChild>
                  <Button variant="ghost">Continue Shopping</Button>
                </SheetClose>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
      
      {/* Mobile floating cart button */}
      <div className="md:hidden fixed bottom-6 right-6 z-10 fab-container">
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-lg bg-coral hover:bg-coral/90 text-white relative single-fab">
              <ShoppingCart className="h-6 w-6" />
              {cart.length > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2">
                  {cart.length}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Shopping Cart</SheetTitle>
              <SheetDescription>
                Review your items before checkout
              </SheetDescription>
            </SheetHeader>
            
            <div className="mt-6 flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item, index) => (
                    <div key={`${item.product.id}-${item.variant || 'default'}`} className="flex justify-between items-center p-4 bg-muted/40 rounded-lg">
                      <div>
                        <h3 className="font-medium">{item.product.name}</h3>
                        {item.variant && (
                          <p className="text-sm text-muted-foreground">Variant: {item.variant}</p>
                        )}
                        <div className="flex items-center mt-2 space-x-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => updateQuantity(index, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => updateQuantity(index, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span>{formatPrice(Number(item.product.price) * item.quantity)}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive mt-2"
                          onClick={() => removeFromCart(index)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="mt-4">
              <Separator />
              <div className="flex justify-between py-4">
                <span className="font-medium">Total</span>
                <span className="font-bold">{formatPrice(cartTotal)}</span>
              </div>
              <Separator />
            </div>
            
            <SheetFooter className="mt-6">
              <div className="grid w-full gap-2">
                <Button 
                  className="w-full bg-coral hover:bg-coral/90" 
                  disabled={cart.length === 0}
                  onClick={() => {
                    if (cart.length > 0) {
                      setIsCheckoutOpen(true);
                    }
                  }}
                >
                  Proceed to Checkout
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                >
                  Clear Cart
                </Button>
                <SheetClose asChild>
                  <Button variant="ghost">Continue Shopping</Button>
                </SheetClose>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
      
      {/* Categories - Hidden for now, showing all products by default */}
      <div className="hidden">
        <Tabs 
          value={activeCategory} 
          onValueChange={setActiveCategory}
          className="mb-8"
        >
          <TabsList className="flex w-full mb-8">
            <TabsTrigger value={ProductCategory.ALL}>All</TabsTrigger>
            <TabsTrigger value={ProductCategory.SPONSORSHIP}>Sponsorship</TabsTrigger>
            <TabsTrigger value={ProductCategory.APPAREL}>Apparel</TabsTrigger>
            <TabsTrigger value={ProductCategory.HOME}>Home</TabsTrigger>
            <TabsTrigger value={ProductCategory.ACCESSORIES}>Accessories</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
        
      {/* All Products Grid - No category filtering */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoading ? (
            Array(3).fill(0).map((_, index) => (
              <Card key={index} className="h-80 animate-pulse">
                <div className="h-40 bg-muted rounded-t-lg"></div>
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardContent>
                <CardFooter className="flex justify-between p-6 pt-0">
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                  <div className="h-8 bg-muted rounded w-1/3"></div>
                </CardFooter>
              </Card>
            ))
          ) : products.length === 0 ? (
            <div className="col-span-3 text-center py-12">
              <p className="text-muted-foreground">No products available</p>
            </div>
          ) : (
            products.map((product) => (
              <Card key={product.id} className="overflow-hidden group">
                <Link href={`/product/${product.id}`} className="block no-underline text-inherit">
                  <div className="aspect-square overflow-hidden bg-muted cursor-pointer">
                    {product.imageUrls && product.imageUrls.length > 0 ? (
                      <img
                        src={product.imageUrls[0]}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <img
                        src="/assets/product-placeholder.svg"
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <CardHeader className="p-4 cursor-pointer">
                    <CardTitle className="text-lg leading-tight">{product.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 cursor-pointer">
                    <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                  </CardContent>
                </Link>
                <CardFooter className="p-4 pt-0 flex justify-between items-center">
                  <span className="font-bold">{formatPrice(product.price)}</span>
                  <div className="flex gap-2">
                    <Link href={`/product/${product.id}`}>
                      <Button size="sm" variant="outline">
                        Details
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      className="bg-coral hover:bg-coral/90"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product);
                      }}
                    >
                      Add to Cart
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>
      

      
      {/* Checkout Dialog */}
      <CheckoutDialog
        isOpen={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        cart={cart}
        formatPrice={formatPrice}
        clearCart={clearCart}
        calculateTotal={() => cartTotal}
      />
    </div>
  );
}