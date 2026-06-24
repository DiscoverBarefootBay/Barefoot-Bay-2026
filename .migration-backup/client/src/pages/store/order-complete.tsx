import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { CheckCircle, Package, Truck, ShoppingCart, Home } from 'lucide-react';

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
  createdAt: string;
  paymentIntentId?: string;
}

export default function OrderCompletePage() {
  const [match, params] = useRoute('/store/order-complete/:orderId');
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (params?.orderId) {
      fetchOrder(params.orderId);
    }
  }, [params?.orderId]);

  // Auto-redirect countdown timer for successful orders
  useEffect(() => {
    if (order && order.status === 'paid' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (order && order.status === 'paid' && countdown === 0) {
      setLocation('/store/track-order');
    }
  }, [order, countdown, setLocation]);

  const fetchOrder = async (orderId: string) => {
    try {
      setLoading(true);
      const response = await apiRequest('GET', `/api/orders/${orderId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch order');
      }
      
      const orderData = await response.json();
      setOrder(orderData);
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

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'paid':
        return {
          icon: <CheckCircle className="h-6 w-6 text-green-600" />,
          title: 'Payment Successful!',
          description: 'Your order has been confirmed and will be processed soon.',
          color: 'bg-green-100 text-green-800'
        };
      case 'pending_cash_payment':
        return {
          icon: <Package className="h-6 w-6 text-orange-600" />,
          title: 'Order Reserved',
          description: 'Your order is reserved. Please visit our office to complete payment.',
          color: 'bg-orange-100 text-orange-800'
        };
      case 'shipped':
        return {
          icon: <Truck className="h-6 w-6 text-blue-600" />,
          title: 'Order Shipped',
          description: 'Your order is on its way!',
          color: 'bg-blue-100 text-blue-800'
        };
      default:
        return {
          icon: <Package className="h-6 w-6 text-gray-600" />,
          title: 'Order Received',
          description: 'Your order is being processed.',
          color: 'bg-gray-100 text-gray-800'
        };
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

  const statusInfo = getStatusInfo(order.status);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {statusInfo.icon}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {statusInfo.title}
          </h1>
          <p className="text-lg text-gray-600">
            {statusInfo.description}
          </p>
          {order && order.status === 'paid' && countdown > 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800">
                Redirecting to your order history in {countdown} seconds...
              </p>
            </div>
          )}
        </div>

        {/* Order Details */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Order #{order.id}</CardTitle>
                <CardDescription>
                  Placed on {new Date(order.createdAt).toLocaleDateString()}
                </CardDescription>
              </div>
              <Badge className={statusInfo.color}>
                {order.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Order Items */}
            <div>
              <h3 className="font-medium mb-3">Items Ordered</h3>
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
            
            {/* Order Total */}
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

            {/* Payment Information */}
            {order.paymentIntentId && (
              <div>
                <h3 className="font-medium mb-2">Payment Information</h3>
                <p className="text-sm text-gray-600">
                  Payment ID: {order.paymentIntentId}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Next Steps */}
        {order.status === 'pending_cash_payment' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>Office Hours:</strong> Monday-Friday 9AM-5PM</p>
                <p><strong>Location:</strong> 625 Barefoot Blvd, Barefoot Bay, FL</p>
                <p><strong>Payment Methods:</strong> Cash, Check, or Credit Card</p>
                <p className="text-blue-600 font-medium">
                  Please bring this order confirmation when you visit.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            onClick={() => setLocation('/store/track-order')}
            className="flex-1"
          >
            <Package className="h-4 w-4 mr-2" />
            Track Orders
          </Button>
          <Button 
            onClick={() => window.location.href = '/store'}
            variant="outline"
            className="flex-1"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Continue Shopping
          </Button>
          <Button 
            onClick={() => window.location.href = '/'}
            variant="outline"
            className="flex-1"
          >
            <Home className="h-4 w-4 mr-2" />
            Return Home
          </Button>
        </div>

        {/* Order Tracking Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Order confirmation and tracking information will be sent to your email.
          </p>
          <p className="mt-2">
            Questions? Contact us at support@barefootbay.com
          </p>
        </div>
      </div>
    </div>
  );
}