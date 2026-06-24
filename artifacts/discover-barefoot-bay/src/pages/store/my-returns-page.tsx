import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReturnDetails } from "@/components/store/return-details";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { ReturnStatus } from "@shared/schema";

// Helper function to format return status
function getStatusColor(status: ReturnStatus) {
  switch (status) {
    case ReturnStatus.REQUESTED:
      return "bg-yellow-500 hover:bg-yellow-600";
    case ReturnStatus.APPROVED:
      return "bg-blue-500 hover:bg-blue-600";
    case ReturnStatus.DENIED:
      return "bg-red-500 hover:bg-red-600";
    case ReturnStatus.LABEL_CREATED:
      return "bg-indigo-500 hover:bg-indigo-600";
    case ReturnStatus.SHIPPED:
      return "bg-purple-500 hover:bg-purple-600";
    case ReturnStatus.RECEIVED:
      return "bg-green-500 hover:bg-green-600";
    case ReturnStatus.REFUNDED:
      return "bg-emerald-500 hover:bg-emerald-600";
    case ReturnStatus.COMPLETED:
      return "bg-green-700 hover:bg-green-800";
    case ReturnStatus.CANCELLED:
      return "bg-gray-500 hover:bg-gray-600";
    default:
      return "bg-gray-500 hover:bg-gray-600";
  }
}

// Helper function to format return status for display
function formatStatus(status: ReturnStatus) {
  // Replace underscores with spaces and capitalize each word
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Return item interface
interface ReturnItem {
  id: number;
  returnId: number;
  orderItemId: number;
  quantity: number;
  reason: string;
  reasonDetails?: string;
  createdAt: string;
  productName?: string;
  variant?: string;
  price?: string;
}

// Order return interface
interface OrderReturn {
  id: number;
  orderId: number;
  status: ReturnStatus;
  reason: string;
  reasonDetails: string;
  notes?: string;
  imageUrls?: string[];
  returnLabelUrl?: string;
  trackingNumber?: string;
  refundAmount?: number;
  refundId?: string;
  printfulReturnId?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  items: ReturnItem[];
}

export default function MyReturnsPage() {
  const [selectedReturn, setSelectedReturn] = useState<OrderReturn | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  
  // Fetch user returns
  const { data: returns, isLoading, isError, refetch } = useQuery({
    queryKey: ['/api/returns/user'],
    queryFn: async () => {
      const response = await fetch('/api/returns/user');
      if (!response.ok) {
        throw new Error('Failed to fetch returns');
      }
      return response.json() as Promise<OrderReturn[]>;
    }
  });
  
  // Filter returns based on the active tab
  const activeReturns = returns?.filter(returnData => 
    ![ReturnStatus.COMPLETED, ReturnStatus.CANCELLED].includes(returnData.status as ReturnStatus)
  ) || [];
  
  const completedReturns = returns?.filter(returnData => 
    [ReturnStatus.COMPLETED, ReturnStatus.CANCELLED].includes(returnData.status as ReturnStatus)
  ) || [];
  
  // Handle opening the details dialog
  const handleViewDetails = (returnData: OrderReturn) => {
    setSelectedReturn(returnData);
    setDetailsDialogOpen(true);
  };
  
  // Handle return update (e.g., after cancellation)
  const handleReturnUpdate = () => {
    setDetailsDialogOpen(false);
    refetch();
  };
  
  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">My Returns</h1>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-destructive mb-4">Failed to load returns</p>
              <Button onClick={() => refetch()}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      ) : returns?.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">You haven't made any return requests yet</p>
              <Button asChild>
                <a href="/store/orders">View My Orders</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="active">
              Active Returns
              {activeReturns.length > 0 && (
                <Badge variant="outline" className="ml-2">{activeReturns.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed Returns
              {completedReturns.length > 0 && (
                <Badge variant="outline" className="ml-2">{completedReturns.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="space-y-4">
            {activeReturns.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">You don't have any active returns</p>
                    <Button asChild>
                      <a href="/store/orders">View My Orders</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              activeReturns.map((returnData) => (
                <Card key={returnData.id} className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <CardTitle>Return #{returnData.id}</CardTitle>
                        <CardDescription>
                          For Order #{returnData.orderId} • {formatDate(returnData.createdAt)}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(returnData.status as ReturnStatus)}>
                        {formatStatus(returnData.status as ReturnStatus)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium">Items:</p>
                        <p className="text-sm">{returnData.items.length} item(s)</p>
                      </div>
                      
                      {returnData.status === ReturnStatus.LABEL_CREATED && returnData.returnLabelUrl && (
                        <div>
                          <p className="text-sm font-medium">Return Label:</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            asChild
                            className="mt-1"
                          >
                            <a href={returnData.returnLabelUrl} target="_blank" rel="noopener noreferrer">
                              Download Return Label
                            </a>
                          </Button>
                        </div>
                      )}
                      
                      <div className="pt-2">
                        <Button onClick={() => handleViewDetails(returnData)}>
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
          
          <TabsContent value="completed" className="space-y-4">
            {completedReturns.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">You don't have any completed returns</p>
                    <Button asChild>
                      <a href="/store/orders">View My Orders</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              completedReturns.map((returnData) => (
                <Card key={returnData.id} className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <CardTitle>Return #{returnData.id}</CardTitle>
                        <CardDescription>
                          For Order #{returnData.orderId} • {formatDate(returnData.createdAt)}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(returnData.status as ReturnStatus)}>
                        {formatStatus(returnData.status as ReturnStatus)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium">Items:</p>
                        <p className="text-sm">{returnData.items.length} item(s)</p>
                      </div>
                      
                      {returnData.status === ReturnStatus.REFUNDED && returnData.refundAmount && (
                        <div>
                          <p className="text-sm font-medium">Refund Amount:</p>
                          <p className="text-sm">${returnData.refundAmount && !isNaN(returnData.refundAmount) ? returnData.refundAmount.toFixed(2) : '0.00'}</p>
                        </div>
                      )}
                      
                      <div className="pt-2">
                        <Button onClick={() => handleViewDetails(returnData)}>
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
      
      {/* Return Details Dialog */}
      {selectedReturn && (
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Return Details</DialogTitle>
            </DialogHeader>
            <ReturnDetails 
              returnData={selectedReturn} 
              onUpdate={handleReturnUpdate}
              isCustomer={true}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}