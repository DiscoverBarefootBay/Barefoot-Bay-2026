import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader } from "lucide-react";

// Define types for the order data
interface ShippingAddress {
  fullName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone?: string;
}

interface PaymentVerificationResponse {
  status: string;
}

interface Order {
  id: string;
  createdAt: string;
  status: string;
  total: number;
  paymentIntentId?: string;
  shippingAddress?: ShippingAddress;
}

export default function OrderCompletePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/store/order-complete/:orderId");
  const orderId = params?.orderId;
  
  console.log("OrderCompletePage - Order ID from URL:", orderId);
  
  const [status, setStatus] = useState<"success" | "error" | "processing">("processing");
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Get payment link ID from URL if available
  const searchParams = new URLSearchParams(window.location.search);
  const paymentLinkId = searchParams.get('payment_id');
  console.log("OrderCompletePage - Payment Link ID from URL:", paymentLinkId);
  
  // Fetch order details
  const orderQuery = useQuery<Order>({
    queryKey: [`/api/orders/${orderId}`],
    enabled: !!orderId && !!user,
  });

  const { data: order, isLoading, isError } = orderQuery;
  
  // Verify payment if payment ID is in the URL
  const verifyPaymentQuery = useQuery<PaymentVerificationResponse>({
    queryKey: [`/api/orders/verify-payment/${orderId}/${order?.paymentIntentId || paymentLinkId}`],
    enabled: !!orderId && !!user && (!!order?.paymentIntentId || !!paymentLinkId) && !isVerifying,
    refetchInterval: status === 'processing' ? 5000 : false, // Poll every 5 seconds if still processing
  });
  
  // Process order status once data is loaded
  useEffect(() => {
    if (orderQuery.isSuccess && order) {
      // Check if payment verification is needed
      if (order.status === 'pending' && (order.paymentIntentId || paymentLinkId)) {
        setIsVerifying(true);
        
        // Attempt to verify payment status
        if (verifyPaymentQuery.isSuccess && verifyPaymentQuery.data) {
          const paymentStatus = verifyPaymentQuery.data.status;
          setIsVerifying(false);
          
          if (paymentStatus === 'COMPLETED') {
            setStatus('success');
            toast({
              title: "Payment Confirmed",
              description: "Your payment was successful and your order is being processed.",
            });
          } else if (paymentStatus === 'CANCELED' || paymentStatus === 'ERROR') {
            setStatus('error');
            toast({
              title: "Payment Failed",
              description: "There was an issue with your payment. Please try again or contact support.",
              variant: "destructive",
            });
          } else {
            // Still processing
            setStatus('processing');
          }
        } else if (verifyPaymentQuery.isError) {
          setIsVerifying(false);
          setStatus('error');
          toast({
            title: "Verification Error",
            description: "We couldn't verify your payment status. Please contact support.",
            variant: "destructive",
          });
        }
      } else if (order.status === 'completed' || order.status === 'delivered' || order.status === 'processing') {
        setStatus('success');
        toast({
          title: "Order Confirmed",
          description: "Your order has been confirmed and is being processed.",
        });
      } else if (order.status === 'cancelled') {
        setStatus('error');
        toast({
          title: "Order Cancelled",
          description: "Your order has been cancelled.",
          variant: "destructive",
        });
      } else {
        setStatus('processing');
      }
    } else if (orderQuery.isError) {
      setStatus('error');
      toast({
        title: "Error Retrieving Order",
        description: "We couldn't find your order. Please contact support.",
        variant: "destructive",
      });
    }
  }, [orderQuery.isSuccess, orderQuery.isError, verifyPaymentQuery.isSuccess, verifyPaymentQuery.isError, verifyPaymentQuery.data, order, toast, paymentLinkId]);
  
  // Check for localhost redirect and handle authentication
  useEffect(() => {
    // Check if we're on localhost but should be on Replit
    if (typeof window !== 'undefined' && 
        window.location.origin.includes('localhost') && 
        import.meta.env.REPLIT_DEPLOYMENT_ID) {
      // We're on localhost but running in a Replit deployment
      // Construct the correct Replit URL
      const replitUrl = `https://${import.meta.env.REPLIT_DEPLOYMENT_ID}-00-y43hx7t2mc3m.janeway.replit.dev`;
      const redirectUrl = `${replitUrl}${window.location.pathname}${window.location.search}`;
      
      console.log(`Redirecting from localhost to Replit URL: ${redirectUrl}`);
      window.location.href = redirectUrl;
      return;
    }

    // Redirect to login if not authenticated
    if (!user) {
      navigate("/auth?redirect=" + encodeURIComponent(window.location.pathname));
    }
  }, [user, navigate]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
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
  
  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-8 my-12 text-center">
        <div className="flex justify-center my-8">
          <div className="bg-blue-50 p-6 rounded-full">
            <Loader className="h-16 w-16 text-blue-500 animate-spin" />
          </div>
        </div>
        <h2 className="text-xl font-medium">Loading order details...</h2>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 my-8">
      <Card className="w-full">
        <CardHeader className="text-center border-b">
          <CardTitle className="text-2xl">Order Confirmation</CardTitle>
          {status === "success" && (
            <div className="flex justify-center my-4">
              <div className="bg-green-50 p-6 rounded-full">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
            </div>
          )}
          {status === "processing" && (
            <div className="flex justify-center my-4">
              <div className="bg-yellow-50 p-6 rounded-full">
                <Loader className="h-16 w-16 text-yellow-500 animate-spin" />
              </div>
            </div>
          )}
          {status === "error" && (
            <div className="flex justify-center my-4">
              <div className="bg-red-50 p-6 rounded-full">
                <XCircle className="h-16 w-16 text-red-500" />
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="pt-6">
          {order ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Order Summary</h3>
                <div className="bg-muted/50 p-4 rounded-md">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Order ID:</span>
                    <span className="font-medium">{order.id}</span>
                    
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium">{formatDate(order.createdAt)}</span>
                    
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium capitalize">{order.status}</span>
                    
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-medium">{formatPrice(order.total)}</span>
                  </div>
                </div>
              </div>
              
              {order.shippingAddress && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Shipping Information</h3>
                  <div className="bg-muted/50 p-4 rounded-md">
                    <div className="grid grid-cols-1 gap-1 text-sm">
                      <span className="font-medium">{order.shippingAddress.fullName}</span>
                      <span>{order.shippingAddress.streetAddress}</span>
                      <span>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}</span>
                      <span>{order.shippingAddress.country}</span>
                      {order.shippingAddress.phone && <span>{order.shippingAddress.phone}</span>}
                    </div>
                  </div>
                </div>
              )}
              
              {status === "success" && (
                <div className="bg-green-50 p-4 rounded-md border border-green-100">
                  <p className="text-green-800 text-sm">
                    Thank you for your order! You will receive a confirmation email shortly with your order details.
                  </p>
                </div>
              )}
              
              {status === "processing" && (
                <div className="bg-yellow-50 p-4 rounded-md border border-yellow-100">
                  <p className="text-yellow-800 text-sm">
                    Your order is being processed. We'll email you once it's confirmed.
                  </p>
                </div>
              )}
              
              {status === "error" && (
                <div className="bg-red-50 p-4 rounded-md border border-red-100">
                  <p className="text-red-800 text-sm">
                    There was an issue with your order. Please contact support for assistance.
                  </p>
                </div>
              )}
            </div>
          ) : isError ? (
            <div className="text-center py-8">
              <p className="text-destructive mb-4">
                We couldn't find information for this order.
              </p>
              <p className="text-muted-foreground">
                Please check your order ID or contact customer support for assistance.
              </p>
            </div>
          ) : null}
        </CardContent>
        
        <CardFooter className="flex flex-col gap-2 sm:flex-row pt-6 border-t">
          <Button 
            onClick={() => navigate("/")}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Return to Home
          </Button>
          <Button 
            onClick={() => navigate("/store")}
            className="w-full sm:w-auto bg-coral hover:bg-coral/90"
          >
            Continue Shopping
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}