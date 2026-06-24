import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogClose, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Check, X } from "lucide-react";

// Define the shipping address schema
const ShippingAddressSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  streetAddress: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(5, "Zip code is required"),
  country: z.string().min(1, "Country is required").default("United States"),
  phone: z.string().optional(),
  discountCode: z.string().optional(),
});

type ShippingAddress = z.infer<typeof ShippingAddressSchema>;

// Define discount code schema for the separate form
const DiscountCodeSchema = z.object({
  code: z.string().min(1, "Discount code is required"),
});

type DiscountCodeFormData = z.infer<typeof DiscountCodeSchema>;

interface CheckoutDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  cart: any[];
  formatPrice: (price: string | number) => string;
  clearCart: () => void;
  calculateTotal: () => number;
}

export function CheckoutDialog({ 
  isOpen,
  onOpenChange,
  cart,
  formatPrice,
  clearCart,
  calculateTotal
}: CheckoutDialogProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  // DISCOUNT FUNCTIONALITY TEMPORARILY DISABLED FOR DEBUGGING
  // const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
  // const [appliedDiscount, setAppliedDiscount] = useState<{code: string, percentage: number} | null>(null);
  // const [discountedTotal, setDiscountedTotal] = useState<number | null>(null);
  
  // DISCOUNT FORM TEMPORARILY DISABLED FOR DEBUGGING
  // const discountForm = useForm<DiscountCodeFormData>({
  //   resolver: zodResolver(DiscountCodeSchema),
  //   defaultValues: {
  //     code: ""
  //   }
  // });

  // Set up form with default values
  const form = useForm<ShippingAddress>({
    resolver: zodResolver(ShippingAddressSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      streetAddress: "",
      city: "",
      state: "",
      zipCode: "",
      country: "United States",
      phone: "",
    },
  });

  // DISCOUNT VALIDATION MUTATION TEMPORARILY DISABLED FOR DEBUGGING
  // const validateDiscountMutation = useMutation({
  //   mutationFn: async (data: DiscountCodeFormData) => {
  //     setIsValidatingDiscount(true);
      
  //     console.log("Validating discount code:", data.code);
  //     const response = await apiRequest({
  //       url: "/api/orders/validate-discount",
  //       method: "POST",
  //       body: { code: data.code }
  //     });
      
  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(errorData.message || "Invalid discount code");
  //     }
      
  //     return await response.json();
  //   },
  //   onSuccess: (data) => {
  //     if (data.valid) {
  //       // Store the applied discount code
  //       setAppliedDiscount({
  //         code: discountForm.getValues().code,
  //         percentage: data.discountPercentage
  //       });
        
  //       // Calculate discounted total
  //       const originalTotal = calculateTotal();
  //       const discountAmount = (originalTotal * data.discountPercentage) / 100;
  //       const newTotal = Math.max(0, originalTotal - discountAmount);
  //       setDiscountedTotal(newTotal);
        
  //       // Set the discount code in the main form
  //       form.setValue("discountCode", discountForm.getValues().code);
        
  //       toast({
  //         title: "Discount Applied",
  //         description: `${data.discountPercentage}% discount has been applied to your order.`,
  //       });
  //     } else {
  //       toast({
  //         title: "Invalid Discount Code",
  //         description: "The discount code you entered is invalid.",
  //         variant: "destructive",
  //       });
  //     }
      
  //     setIsValidatingDiscount(false);
  //   },
  //   onError: (error: Error) => {
  //     console.error("Discount code error:", error);
  //     toast({
  //       title: "Error",
  //       description: error.message || "Failed to validate discount code. Please try again.",
  //       variant: "destructive",
  //     });
  //     setIsValidatingDiscount(false);
  //   }
  // });
  
  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async (data: { items: any[], shippingAddress: ShippingAddress, discountCode?: string }) => {
      console.log("Debug: Submitting checkout with data", data);
      // Use the object form of the apiRequest to avoid parameter order issues
      const response = await apiRequest({
        url: "/api/orders/checkout",
        method: "POST",
        body: data
      });
      return await response.json();
    },
    onSuccess: (data) => {
      console.log("Checkout success response:", data);
      if (data.paymentLinkUrl) {
        // Redirect to Square payment page
        console.log("Redirecting to Square payment page:", data.paymentLinkUrl);
        window.location.href = data.paymentLinkUrl;
      } else if (data.isFree) {
        // Handle free orders (redirect to completion page)
        console.log("Free order detected, redirecting to completion page with order ID:", data.paymentId);
        clearCart();
        setLocation(`/store/order-complete/${data.paymentId}`);
      }
      setIsProcessing(false);
    },
    onError: (error) => {
      console.error("Checkout error:", error);
      toast({
        title: "Checkout Failed",
        description: "There was an error processing your order. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  // DISCOUNT HANDLERS TEMPORARILY DISABLED FOR DEBUGGING
  // const handleApplyDiscount = (e: React.FormEvent) => {
  //   e.preventDefault(); // Prevent form submission
  //   const data = discountForm.getValues();
  //   validateDiscountMutation.mutate(data);
  // };
  
  // const handleRemoveDiscount = () => {
  //   setAppliedDiscount(null);
  //   setDiscountedTotal(null);
  //   form.setValue("discountCode", undefined);
  //   discountForm.reset();
  // };
  
  // Handle form submission
  const onSubmit = (shippingData: ShippingAddress) => {
    setIsProcessing(true);
    
    // Format cart items for the API
    const items = cart.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      price: parseFloat(item.product.price), // Convert to number if stored as string
      variantInfo: item.variant ? { variant: item.variant } : undefined,
    }));
    
    // Submit to API (discount code temporarily disabled)
    const checkoutData = {
      items,
      shippingAddress: shippingData,
      // discountCode: appliedDiscount?.code
    };
    
    console.log("Submitting checkout with data:", checkoutData);
    checkoutMutation.mutate(checkoutData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Complete Your Order</DialogTitle>
          <DialogDescription>
            Please enter your shipping information to continue.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground">Shipping Information</h3>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="streetAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input placeholder="" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip Code</FormLabel>
                      <FormControl>
                        <Input placeholder="" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="bg-accent/30 p-4 rounded-md">
              <h3 className="font-medium mb-2">Order Summary</h3>
              <div className="space-y-2">
                {cart.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{item.quantity} × {item.product.name}</span>
                    <span>{formatPrice(parseFloat(item.product.price) * item.quantity)}</span>
                  </div>
                ))}
                
                {/* DISCOUNT UI SECTION TEMPORARILY DISABLED FOR DEBUGGING */}
                {/* {false && (
                  !appliedDiscount ? (
                    <div className="pt-2 border-t">
                      <div className="flex space-x-2 items-end">
                        <div className="flex-1">
                          <Form {...discountForm}>
                            <FormField
                              control={discountForm.control}
                              name="code"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Discount Code</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter code" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </Form>
                        </div>
                        <Button 
                          type="button" 
                          size="sm" 
                          className="bg-coral hover:bg-coral/90"
                          disabled={isValidatingDiscount}
                          onClick={handleApplyDiscount}
                        >
                          {isValidatingDiscount ? "Applying..." : "Apply"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>{formatPrice(calculateTotal())}</span>
                      </div>
                      <div className="flex justify-between text-sm items-center">
                        <div className="flex items-center gap-2">
                          <span>Discount (0%)</span>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 p-0" 
                            onClick={handleRemoveDiscount}
                          >
                            <X className="h-3 w-3" />
                            <span className="sr-only">Remove discount</span>
                          </Button>
                        </div>
                        <span>-{formatPrice(0)}</span>
                      </div>
                    </div>
                  )
                )} */}
                
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>
                    {formatPrice(calculateTotal())}
                  </span>
                </div>
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button 
                type="submit" 
                className="bg-coral hover:bg-coral/90"
                disabled={isProcessing}
              >
                {isProcessing ? "Processing..." : "Proceed to Payment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}