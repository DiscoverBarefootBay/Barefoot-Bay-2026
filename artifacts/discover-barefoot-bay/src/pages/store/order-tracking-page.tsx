import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle, Package, TruckIcon, HomeIcon, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const trackingFormSchema = z.object({
  orderId: z.string().refine(
    (val) => !isNaN(parseInt(val, 10)),
    { message: "Order ID must be a number" }
  ),
  email: z.string().email({ message: "Please enter a valid email address" })
});

type TrackingFormValues = z.infer<typeof trackingFormSchema>;

// We'll create an order status component that shows a nice visualization
function OrderStatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { label: string; variant: "default" | "outline" | "secondary" | "destructive" | "success" }> = {
    pending: { label: "Pending", variant: "outline" },
    processing: { label: "Processing", variant: "secondary" },
    fulfilled: { label: "Fulfilled", variant: "success" },
    shipped: { label: "Shipped", variant: "success" },
    delivered: { label: "Delivered", variant: "success" },
    canceled: { label: "Canceled", variant: "destructive" },
  };

  const statusInfo = statusMap[status] || { label: status, variant: "default" };

  return (
    <Badge variant={statusInfo.variant}>
      {statusInfo.label}
    </Badge>
  );
}

// Create a progress tracker component for orders
function OrderProgressTracker({ status }: { status: string }) {
  const steps = [
    { key: 'pending', label: 'Order Placed', icon: CheckCircle },
    { key: 'processing', label: 'Processing', icon: Package },
    { key: 'shipped', label: 'Shipped', icon: TruckIcon },
    { key: 'delivered', label: 'Delivered', icon: HomeIcon },
  ];

  // Find the current step index
  let currentStepIndex = steps.findIndex(step => step.key === status);
  
  // If status is not in our steps (e.g. "canceled"), handle appropriately
  if (currentStepIndex === -1) {
    if (status === 'fulfilled') {
      // Fulfilled is between processing and shipped
      currentStepIndex = 2;
    } else if (status === 'canceled') {
      // For canceled orders, don't highlight any steps
      currentStepIndex = -2;
    } else {
      // Default to the first step
      currentStepIndex = 0;
    }
  }

  return (
    <div className="w-full my-8">
      <div className="flex justify-between mb-2">
        {steps.map((step, idx) => {
          const isActive = idx <= currentStepIndex && currentStepIndex >= 0;
          const StepIcon = step.icon;
          
          return (
            <div key={step.key} className="flex flex-col items-center">
              <div className={`
                rounded-full p-2
                ${isActive 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'}
              `}>
                <StepIcon className="h-5 w-5" />
              </div>
              <span className={`text-xs mt-1 font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      
      <div className="relative flex w-full mt-2">
        {steps.map((_, idx) => (
          <React.Fragment key={idx}>
            {idx < steps.length - 1 && (
              <div className="flex-1 relative">
                <div className={`absolute h-1 w-full ${idx < currentStepIndex ? 'bg-primary' : 'bg-muted'}`} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// Format the order's total amount with currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function OrderTrackingPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<TrackingFormValues>({
    resolver: zodResolver(trackingFormSchema),
    defaultValues: {
      orderId: "",
      email: "",
    },
  });

  async function onSubmit(data: TrackingFormValues) {
    setIsLoading(true);
    setError(null);
    setOrderDetails(null);

    try {
      const response = await apiRequest('/api/orders/track', {
        method: 'POST',
        body: {
          orderId: parseInt(data.orderId),
          email: data.email,
        },
      });

      if (response.success) {
        setOrderDetails(response.order);
      } else {
        setError(response.error || 'Failed to retrieve order details');
        toast({
          variant: "destructive",
          title: "Error",
          description: response.error || 'Failed to retrieve order details',
        });
      }
    } catch (err) {
      console.error('Error tracking order:', err);
      setError('Failed to track order. Please check your information and try again.');
      toast({
        variant: "destructive",
        title: "Error",
        description: 'Failed to track order. Please check your information and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative z-10">
      <div className="container max-w-4xl py-10">
        <h1 className="text-3xl font-bold mb-6">Track Your Order</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Order Tracking</CardTitle>
            <CardDescription>
              Enter your order ID and email address to track your order status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="orderId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Order ID</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter your order ID" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter the email used for your order" 
                            type="email"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Tracking...
                    </>
                  ) : "Track Order"}
                </Button>
              </form>
            </Form>
            
            {error && (
              <Alert variant="destructive" className="mt-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        
        {orderDetails && (
          <Card className="mt-8">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Order #{orderDetails.id}</CardTitle>
                  <CardDescription>
                    Placed on {formatDate(orderDetails.createdAt)}
                  </CardDescription>
                </div>
                <OrderStatusBadge status={orderDetails.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Order progress tracker */}
              <OrderProgressTracker status={orderDetails.status} />
              
              {/* Show tracking info if available */}
              {(orderDetails.trackingNumber || orderDetails.trackingUrl) && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Shipping Information</h3>
                  {orderDetails.trackingNumber && (
                    <p className="text-sm">Tracking Number: {orderDetails.trackingNumber}</p>
                  )}
                  {orderDetails.trackingUrl && (
                    <Button 
                      variant="link" 
                      className="pl-0 h-8" 
                      onClick={() => window.open(orderDetails.trackingUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Track Package
                    </Button>
                  )}
                </div>
              )}
              
              {/* Order Items */}
              <div>
                <h3 className="font-semibold mb-4">Order Items</h3>
                <div className="space-y-4">
                  {orderDetails.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center border-b pb-4">
                      <div className="flex items-center space-x-4">
                        {item.product?.images && item.product.images[0] && (
                          <div className="rounded-md overflow-hidden w-16 h-16">
                            <img 
                              src={item.product.images[0]} 
                              alt={item.product.name} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{item.product?.name || "Product"}</p>
                          <p className="text-sm text-muted-foreground">
                            Qty: {item.quantity}
                            {item.variantInfo && Object.keys(item.variantInfo).length > 0 && (
                              <span className="ml-2">
                                ({Object.entries(item.variantInfo)
                                  .map(([key, value]) => `${key}: ${value}`)
                                  .join(", ")})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <p className="font-semibold">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Order Total */}
              <div className="pt-4">
                <div className="flex justify-between py-2">
                  <span>Subtotal</span>
                  <span>{formatCurrency(orderDetails.total)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between py-2 font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(orderDetails.total)}</span>
                </div>
              </div>
              
              {/* Shipping Address */}
              {orderDetails.shippingAddress && (
                <div>
                  <h3 className="font-semibold mb-2">Shipping Address</h3>
                  <p className="text-sm">
                    {orderDetails.shippingAddress.fullName}<br />
                    {orderDetails.shippingAddress.streetAddress}<br />
                    {orderDetails.shippingAddress.city}, {orderDetails.shippingAddress.state} {orderDetails.shippingAddress.zipCode}<br />
                    {orderDetails.shippingAddress.country}
                  </p>
                  {orderDetails.shippingAddress.phone && (
                    <p className="text-sm mt-1">
                      Phone: {orderDetails.shippingAddress.phone}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <p className="text-sm text-muted-foreground">
                If you have any questions about your order, please contact customer support.
              </p>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}