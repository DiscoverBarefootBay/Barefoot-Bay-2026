import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  Search, 
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  ArrowLeft
} from 'lucide-react';

interface OrderItem {
  id: number;
  productId: string;
  productName: string;
  quantity: number;
  price: string;
}

interface Order {
  id: number;
  status: string;
  total: string;
  items: OrderItem[];
  shippingAddress: {
    fullName: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  createdAt: string;
  updatedAt: string;
  trackingNumber?: string;
  trackingUrl?: string;
  paymentIntentId?: string;
}

export default function TrackOrderPage() {
  const { toast } = useToast();
  const [orderIdInput, setOrderIdInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [showUserOrders, setShowUserOrders] = useState(false);

  useEffect(() => {
    // Check if user is logged in and load their orders
    loadUserOrders();
  }, []);

  const loadUserOrders = async () => {
    try {
      const response = await apiRequest('GET', '/api/orders/user');
      if (response.ok) {
        const orders = await response.json();
        setUserOrders(orders);
        setShowUserOrders(true);
      }
    } catch (error) {
      // User not logged in or no orders, that's fine
      setShowUserOrders(false);
    }
  };

  const trackOrder = async () => {
    if (!orderIdInput) {
      toast({
        title: "Order ID Required",
        description: "Please enter an order ID to track",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let response;
      
      if (emailInput) {
        // Public tracking with email verification
        response = await apiRequest('POST', `/api/orders/${orderIdInput}/track`, {
          email: emailInput
        });
      } else {
        // Try authenticated tracking first
        response = await apiRequest('GET', `/api/orders/${orderIdInput}`);
      }

      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "Order Not Found",
            description: "The order ID you entered could not be found.",
            variant: "destructive",
          });
        } else if (response.status === 401 && !emailInput) {
          toast({
            title: "Email Required",
            description: "Please enter the email address used for this order.",
            variant: "destructive",
          });
        } else {
          throw new Error('Failed to fetch order');
        }
        return;
      }

      const orderData = await response.json();
      setOrder(orderData);
      
    } catch (error) {
      console.error('Error tracking order:', error);
      toast({
        title: "Error",
        description: "Failed to track order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'paid':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'processing':
        return <Package className="h-5 w-5 text-blue-600" />;
      case 'shipped':
        return <Truck className="h-5 w-5 text-purple-600" />;
      case 'delivered':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-700 border-yellow-300">Pending Payment</Badge>;
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Payment Confirmed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      case 'shipped':
        return <Badge className="bg-purple-100 text-purple-800">Shipped</Badge>;
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800">Delivered</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusProgress = (status: string) => {
    const statuses = ['pending', 'paid', 'processing', 'shipped', 'delivered'];
    const currentIndex = statuses.indexOf(status);
    return currentIndex >= 0 ? ((currentIndex + 1) / statuses.length) * 100 : 0;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => window.location.href = '/store'}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Store
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Track Your Orders</h1>
          <p className="text-gray-600 mt-2">View your successfully placed orders and track their status</p>
        </div>

        {/* User's Orders (if logged in) */}
        {showUserOrders && userOrders.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Your Successfully Placed Orders</CardTitle>
              <CardDescription>All your completed purchases - click on any order to view details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {userOrders.slice(0, 5).map((userOrder) => (
                  <div 
                    key={userOrder.id}
                    onClick={() => setOrder(userOrder)}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(userOrder.status)}
                      <div>
                        <p className="font-medium">Order #{userOrder.id}</p>
                        <p className="text-sm text-gray-600">{formatDate(userOrder.createdAt)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(userOrder.status)}
                      <p className="text-sm font-medium mt-1">${userOrder.total}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Track Order Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="h-5 w-5 mr-2" />
              Track by Order ID
            </CardTitle>
            <CardDescription>
              Enter your order ID and email to track your order status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="order-id">Order ID</Label>
                <Input
                  id="order-id"
                  type="number"
                  placeholder="Enter order ID (e.g., 57)"
                  value={orderIdInput}
                  onChange={(e) => setOrderIdInput(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email used for order"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
              </div>
            </div>
            
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                Email is required for order tracking unless you're logged in to your account.
              </AlertDescription>
            </Alert>

            <Button 
              onClick={trackOrder}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Tracking Order...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Track Order
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Order Details */}
        {order && (
          <div className="space-y-6">
            {/* Order Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Order #{order.id}
                  {getStatusBadge(order.status)}
                </CardTitle>
                <CardDescription>
                  Placed on {formatDate(order.createdAt)}
                  {order.updatedAt !== order.createdAt && (
                    <span> • Last updated: {formatDate(order.updatedAt)}</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm font-medium mb-2">
                    <span>Order Progress</span>
                    <span>{Math.round(getStatusProgress(order.status))}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getStatusProgress(order.status)}%` }}
                    />
                  </div>
                </div>

                {/* Status Steps */}
                <div className="grid grid-cols-5 gap-2 text-center">
                  {[
                    { key: 'pending', label: 'Order Placed', icon: Clock },
                    { key: 'paid', label: 'Payment Confirmed', icon: CheckCircle },
                    { key: 'processing', label: 'Processing', icon: Package },
                    { key: 'shipped', label: 'Shipped', icon: Truck },
                    { key: 'delivered', label: 'Delivered', icon: CheckCircle }
                  ].map(({ key, label, icon: Icon }) => {
                    const statuses = ['pending', 'paid', 'processing', 'shipped', 'delivered'];
                    const currentIndex = statuses.indexOf(order.status);
                    const stepIndex = statuses.indexOf(key);
                    const isActive = stepIndex <= currentIndex;
                    
                    return (
                      <div key={key} className={`p-2 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                        <Icon className={`h-6 w-6 mx-auto mb-1 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                        <p className="text-xs font-medium">{label}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Tracking Information */}
                {order.trackingNumber && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Tracking Information</h4>
                    <p className="text-sm text-blue-800">
                      Tracking Number: <span className="font-mono">{order.trackingNumber}</span>
                    </p>
                    {order.trackingUrl && (
                      <Button variant="link" className="p-0 h-auto text-blue-600" asChild>
                        <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                          Track with Carrier
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-3 border-b last:border-b-0">
                      <div>
                        <h4 className="font-medium">{item.productName}</h4>
                        <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                        <p className="text-xs text-gray-500">Product ID: {item.productId}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${item.price && !isNaN(parseFloat(item.price)) ? parseFloat(item.price).toFixed(2) : '0.00'}</p>
                        <p className="text-sm text-gray-600">each</p>
                      </div>
                    </div>
                  ))}
                  
                  <Separator />
                  
                  <div className="flex justify-between items-center font-bold text-lg">
                    <span>Total</span>
                    <span>${order.total}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="h-5 w-5 mr-2" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  <p className="font-medium">{order.shippingAddress.fullName}</p>
                  <p>{order.shippingAddress.streetAddress}</p>
                  <p>
                    {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                  </p>
                  <p>{order.shippingAddress.country}</p>
                </div>
              </CardContent>
            </Card>

            {/* Order Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600">
                  If you have questions about your order, please contact our support team.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm">
                    Contact Support
                  </Button>
                  <Button variant="outline" size="sm">
                    Report Issue
                  </Button>
                  {order.status === 'delivered' && (
                    <Button variant="outline" size="sm">
                      Leave Review
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}