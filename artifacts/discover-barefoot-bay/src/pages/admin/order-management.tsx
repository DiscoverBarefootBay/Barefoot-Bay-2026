import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, FileDown, Package } from "lucide-react";
import { OrderDetails } from "@/components/admin/order-details";
import { usePermissions } from "@/hooks/use-permissions";
import { OrderStatus } from "@shared/schema";

export default function OrderManagementPage() {
  const { isAdmin } = usePermissions();
  
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentTab, setCurrentTab] = useState("all");

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["/api/orders", "admin"],
    queryFn: async () => {
      // Use the admin endpoint to fetch all orders
      const response = await fetch("/api/orders?all=true");
      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }
      return response.json();
    },
    enabled: isAdmin, // Only fetch if user is admin
  });

  const handleOrderSelection = (order: any) => {
    setSelectedOrder(order);
  };

  const handleStatusUpdate = (orderId: number, newStatus: string) => {
    // Update local state to reflect change
    if (!orders) return;
    
    const updatedOrders = orders.map((order: any) => {
      if (order.id === orderId) {
        return { ...order, status: newStatus };
      }
      return order;
    });
    
    // Close the order details if it was the selected order
    if (selectedOrder?.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
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
        return <Badge variant="default" className="bg-green-600">Delivered</Badge>;
      case OrderStatus.CANCELLED:
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPrintOnDemandBadge = (printProviderOrderId: string | null) => {
    if (printProviderOrderId) {
      return <Badge variant="outline">Printful</Badge>;
    }
    return null;
  };

  const filteredOrders = orders
    ? orders
        .filter((order: any) => 
          (statusFilter === "all" || order.status === statusFilter) && 
          (
            searchTerm === "" || 
            order.id.toString().includes(searchTerm) ||
            (order.shippingAddress.fullName && 
             order.shippingAddress.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
          )
        )
        .filter((order: any) => {
          if (currentTab === "all") return true;
          if (currentTab === "printful") return order.printProviderOrderId;
          if (currentTab === "self-fulfilled") return !order.printProviderOrderId;
          return true;
        })
    : [];

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p>You need administrator privileges to access this page.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Order Management</h1>
        <p>Loading orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Order Management</h1>
        <p className="text-red-500">Error loading orders: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold mb-6">Order Management</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>All Orders</CardTitle>
              <Button variant="outline" className="flex gap-2">
                <FileDown className="h-4 w-4" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <Tabs value={currentTab} onValueChange={setCurrentTab} className="mb-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all">All Orders</TabsTrigger>
                  <TabsTrigger value="printful">Printful Orders</TabsTrigger>
                  <TabsTrigger value="self-fulfilled">Self-Fulfilled</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex gap-4 mb-6">
                <div className="relative flex-grow">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search orders..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value={OrderStatus.PENDING}>Pending</SelectItem>
                    <SelectItem value={OrderStatus.PROCESSING}>Processing</SelectItem>
                    <SelectItem value={OrderStatus.SHIPPED}>Shipped</SelectItem>
                    <SelectItem value={OrderStatus.DELIVERED}>Delivered</SelectItem>
                    <SelectItem value={OrderStatus.CANCELLED}>Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4">
                          No orders found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOrders.map((order: any) => (
                        <TableRow
                          key={order.id}
                          className={`cursor-pointer ${
                            selectedOrder?.id === order.id
                              ? "bg-muted/50"
                              : ""
                          }`}
                          onClick={() => handleOrderSelection(order)}
                        >
                          <TableCell>#{order.id}</TableCell>
                          <TableCell>{formatDate(order.createdAt)}</TableCell>
                          <TableCell>
                            {order.shippingAddress?.fullName || "N/A"}
                          </TableCell>
                          <TableCell>{formatPrice(Number(order.total))}</TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell>
                            {getPrintOnDemandBadge(order.printProviderOrderId) || (
                              <Badge variant="outline" className="bg-orange-100 text-orange-800 hover:bg-orange-200">
                                Self-Fulfilled
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOrderSelection(order);
                              }}
                            >
                              <Package className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          {selectedOrder ? (
            <OrderDetails
              order={selectedOrder}
              onUpdateStatus={handleStatusUpdate}
            />
          ) : (
            <Card className="flex flex-col items-center justify-center p-6 h-full">
              <Package className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Select an order to view details and manage fulfillment
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}