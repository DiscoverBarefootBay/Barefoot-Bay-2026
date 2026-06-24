import React, { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { CreditCard, Lock, ShoppingCart, CheckCircle, ArrowLeft } from 'lucide-react';

interface Order {
  id: number;
  status: string;
  total: string;
  items: Array<{
    id: number;
    productId: string;
    productName: string;
    quantity: number;
    price: string;
  }>;
  shippingAddress: {
    fullName: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

export default function PaymentPage() {
  const [match, params] = useRoute('/store/pay/:orderId');
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  useEffect(() => {
    if (params?.orderId) {
      fetchOrder(params.orderId);
    }
  }, [params?.orderId]);

  const fetchOrder = async (orderId: string) => {
    try {
      setLoading(true);
      const response = await apiRequest('GET', `/api/orders/${orderId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch order');
      }
      
      const orderData = await response.json();
      setOrder(orderData);
      
      // Check if order is already paid/processed
      if (orderData.status === 'processing' || orderData.status === 'shipped' || orderData.status === 'delivered') {
        setPaymentCompleted(true);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      toast({
        title: "Error",
        description: "Failed to load order details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!order) return;
    
    setProcessing(true);
    
    try {
      // Update order status to processing (paid)
      const response = await apiRequest('PATCH', `/api/orders/${order.id}/status`, {
        status: 'processing',
        paymentMethod: 'square'
      });
      
      if (!response.ok) {
        throw new Error('Failed to update order status');
      }
      
      setPaymentCompleted(true);
      
      toast({
        title: "Payment Successful!",
        description: "Your order has been confirmed and is being processed.",
      });
      
      // Redirect to order confirmation after a brief delay
      setTimeout(() => {
        window.location.href = `/store/order-complete/${order.id}`;
      }, 2000);
      
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Failed",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending Payment</Badge>;
      case 'processing':
        return <Badge className="bg-green-100 text-green-800">Processing</Badge>;
      case 'shipped':
        return <Badge className="bg-blue-100 text-blue-800">Shipped</Badge>;
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800">Delivered</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Order Not Found</CardTitle>
            <CardDescription>
              The order you're looking for could not be found.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => window.location.href = '/store'} className="w-full">
              Return to Store
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (paymentCompleted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
            <CardTitle className="text-green-600">Payment Completed!</CardTitle>
            <CardDescription>
              Your order #{order.id} has been successfully processed.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              You will be redirected to the order confirmation page shortly.
            </p>
            <Button 
              onClick={() => window.location.href = `/store/order-complete/${order.id}`}
              className="w-full"
            >
              View Order Details
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => window.history.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Complete Your Payment</h1>
          <p className="text-gray-600 mt-2">Order #{order.id}</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Order Summary
                {getStatusBadge(order.status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Items */}
              <div>
                <h3 className="font-medium mb-3">Items</h3>
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-2">
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium">${item.price && !isNaN(parseFloat(item.price)) ? parseFloat(item.price).toFixed(2) : '0.00'}</p>
                  </div>
                ))}
              </div>
              
              <Separator />
              
              {/* Total */}
              <div className="flex justify-between items-center font-bold text-lg">
                <span>Total</span>
                <span>${order.total}</span>
              </div>

              <Separator />

              {/* Shipping Address */}
              <div>
                <h3 className="font-medium mb-2">Shipping Address</h3>
                <div className="text-sm text-gray-600">
                  <p>{order.shippingAddress.fullName}</p>
                  <p>{order.shippingAddress.streetAddress}</p>
                  <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}</p>
                  <p>{order.shippingAddress.country}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lock className="h-5 w-5 mr-2" />
                Secure Payment
              </CardTitle>
              <CardDescription>
                Your payment information is encrypted and secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Payment Method */}
              <div>
                <Label htmlFor="payment-method">Payment Method</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center space-x-2 p-3 border rounded-lg bg-blue-50 border-blue-200">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Square Payment Gateway</span>
                  </div>
                </div>
              </div>

              {/* Mock Payment Form */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="card-number">Card Number</Label>
                  <Input 
                    id="card-number" 
                    placeholder="1234 5678 9012 3456" 
                    defaultValue="4111 1111 1111 1111"
                    disabled
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="expiry">Expiry Date</Label>
                    <Input 
                      id="expiry" 
                      placeholder="MM/YY" 
                      defaultValue="12/25"
                      disabled
                    />
                  </div>
                  <div>
                    <Label htmlFor="cvv">CVV</Label>
                    <Input 
                      id="cvv" 
                      placeholder="123" 
                      defaultValue="123"
                      disabled
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="name">Cardholder Name</Label>
                  <Input 
                    id="name" 
                    placeholder="John Doe" 
                    defaultValue={order.shippingAddress.fullName}
                    disabled
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Demo Mode:</strong> This is a demonstration of the payment flow. 
                  Clicking "Complete Payment" will simulate a successful transaction and update the order status.
                </p>
                <p className="text-xs text-gray-500">
                  In production, this would integrate with Square's secure payment processing.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleProcessPayment}
                disabled={processing || order.status !== 'pending'}
                className="w-full"
                size="lg"
              >
                {processing ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Complete Payment - ${order.total}
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Security Info */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center text-sm text-gray-500">
            <Lock className="h-4 w-4 mr-1" />
            Your payment information is secure and encrypted
          </div>
        </div>
      </div>
    </div>
  );
}