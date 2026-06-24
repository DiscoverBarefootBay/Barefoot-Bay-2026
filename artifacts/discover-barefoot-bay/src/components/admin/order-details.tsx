import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle, Truck, Package, ExternalLink } from "lucide-react";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Order, OrderStatus } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface OrderDetailsProps {
  order: Order & { items: any[] };
  onUpdateStatus: (orderId: number, status: string) => void;
}

export function OrderDetails({ order, onUpdateStatus }: OrderDetailsProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl || "");
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || "");
  const [trackingType, setTrackingType] = useState<"real" | "mock">("real");
  const { toast } = useToast();

  const formatAddress = (address: any) => {
    if (!address) return "No address provided";
    return (
      <div className="space-y-1 text-sm">
        <p className="font-medium">{address.fullName}</p>
        <p>{address.streetAddress}</p>
        <p>
          {address.city}, {address.state} {address.zipCode}
        </p>
        <p>{address.country}</p>
        {address.phone && <p>{address.phone}</p>}
      </div>
    );
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case OrderStatus.PENDING:
        return <Badge variant="outline">Pending</Badge>;
      case OrderStatus.PROCESSING:
        return <Badge variant="secondary">Processing</Badge>;
      case OrderStatus.SHIPPED:
        return <Badge variant="default">Shipped</Badge>;
      case OrderStatus.DELIVERED:
        return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Delivered</Badge>;
      case OrderStatus.CANCELLED:
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (data: { status: string; trackingUrl?: string; trackingNumber?: string }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/orders/${order.id}`,
        data
      );
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Order updated",
        description: `Order #${order.id} has been updated.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      onUpdateStatus(order.id, data.status);
      setIsUpdating(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = (newStatus: string) => {
    // Generate a mock tracking URL if mock type is selected
    let finalTrackingUrl = trackingUrl;
    let finalTrackingNumber = trackingNumber || `BB${Math.floor(100000000 + Math.random() * 900000000)}`;
    
    if (trackingType === "mock" && newStatus === OrderStatus.SHIPPED) {
      finalTrackingUrl = `/testing/track?tracking=${finalTrackingNumber}`;
    }
    
    console.log(`Updating order status to ${newStatus}, tracking URL: ${finalTrackingUrl}, tracking number: ${finalTrackingNumber}`);
    
    updateMutation.mutate({ 
      status: newStatus,
      ...(newStatus === OrderStatus.SHIPPED ? { 
        trackingUrl: finalTrackingUrl,
        trackingNumber: finalTrackingNumber 
      } : {})
    });
  };

  const isPrintfulOrder = order.printProviderOrderId !== null && order.printProviderOrderId !== undefined;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Order #{order.id}</CardTitle>
            <CardDescription>
              {order.createdAt ? formatDate(order.createdAt.toString()) : ""}
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusBadge(order.status)}
            {isPrintfulOrder && <Badge variant="outline">Printful</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Shipping Address</h3>
            {formatAddress(order.shippingAddress)}
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Order Summary</h3>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Total:</span> {formatPrice(Number(order.total))}
              </p>
              <p>
                <span className="font-medium">Items:</span> {order.items.length}
              </p>
              {order.trackingNumber && (
                <p>
                  <span className="font-medium">Tracking #:</span>{" "}
                  {order.trackingNumber}
                </p>
              )}
              {order.trackingUrl && (
                <p>
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Track Shipment
                  </a>
                </p>
              )}
              {isPrintfulOrder && (
                <p>
                  <span className="font-medium">Printful Order ID:</span>{" "}
                  {order.printProviderOrderId}
                </p>
              )}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-2">Order Items</h3>
          <div className="space-y-4">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center border-b pb-2"
              >
                <div className="flex items-center space-x-4">
                  {item.product?.imageUrls?.[0] && (
                    <img
                      src={item.product.imageUrls[0]}
                      alt={item.product.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div>
                    <p className="font-medium">{item.product?.name}</p>
                    <p className="text-sm text-gray-500">
                      Qty: {item.quantity} × {formatPrice(Number(item.price))}
                    </p>
                    {item.variantInfo && (
                      <p className="text-xs text-gray-500">
                        {Object.entries(item.variantInfo)
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {formatPrice(Number(item.price) * item.quantity)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-4">
        {(order.status === OrderStatus.PENDING || order.status === OrderStatus.PROCESSING) && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Mark as Shipped
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ship Order #{order.id}</DialogTitle>
                <DialogDescription>
                  Enter tracking information before marking this order as shipped.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="trackingType">Tracking Type</Label>
                  <Select
                    value={trackingType}
                    onValueChange={(value) => setTrackingType(value as "real" | "mock")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tracking type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="real">Real Carrier URL</SelectItem>
                      <SelectItem value="mock">Mock Tracking (Testing)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {trackingType === "mock" 
                      ? "Uses our mock tracking page for testing" 
                      : "Use a real carrier tracking URL"
                    }
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="trackingNumber">Tracking Number</Label>
                  <Input
                    id="trackingNumber"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter tracking number..."
                  />
                </div>

                {trackingType === "real" && (
                  <div className="space-y-2">
                    <Label htmlFor="trackingUrl">Tracking URL</Label>
                    <Input
                      id="trackingUrl"
                      value={trackingUrl}
                      onChange={(e) => setTrackingUrl(e.target.value)}
                      placeholder="https://tracking.provider.com/..."
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => handleStatusUpdate(OrderStatus.SHIPPED)}>
                  Mark as Shipped
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {order.status === OrderStatus.PENDING && (
          <Button 
            variant="secondary" 
            className="flex items-center gap-2"
            onClick={() => handleStatusUpdate(OrderStatus.PROCESSING)}
          >
            <Package className="h-4 w-4" />
            Start Processing
          </Button>
        )}

        {order.status === OrderStatus.SHIPPED && (
          <Button 
            variant="default" 
            className="flex items-center gap-2"
            onClick={() => handleStatusUpdate(OrderStatus.DELIVERED)}
          >
            <CheckCircle className="h-4 w-4" />
            Mark as Delivered
          </Button>
        )}

        {order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.DELIVERED && (
          <Button 
            variant="destructive" 
            className="flex items-center gap-2"
            onClick={() => handleStatusUpdate(OrderStatus.CANCELLED)}
          >
            <AlertTriangle className="h-4 w-4" />
            Cancel Order
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}