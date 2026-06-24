import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReturnDetails } from "@/components/store/return-details";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { Loader2, Filter, Search } from "lucide-react";
import { ReturnStatus } from "@shared/schema";
import { usePermissions } from "@/hooks/use-permissions";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  userId?: number;
  userEmail?: string;
  userName?: string;
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

export default function ManageReturnsPage() {
  const { isAdmin } = usePermissions();
  const [selectedReturn, setSelectedReturn] = useState<OrderReturn | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("requested");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | "all">("all");
  
  // Fetch all returns (admin only)
  const { data: returns, isLoading, isError, refetch } = useQuery({
    queryKey: ['/api/returns'],
    queryFn: async () => {
      const response = await fetch('/api/returns');
      if (!response.ok) {
        throw new Error('Failed to fetch returns');
      }
      return response.json() as Promise<OrderReturn[]>;
    },
    enabled: isAdmin,
  });
  
  // Filter returns based on the active tab, search term, and status filter
  const filteredReturns = returns?.filter(returnData => {
    // Always apply search filter if present
    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase();
      const searchMatches = 
        returnData.id.toString().includes(lowercaseSearch) ||
        returnData.orderId.toString().includes(lowercaseSearch) ||
        (returnData.userEmail && returnData.userEmail.toLowerCase().includes(lowercaseSearch)) ||
        (returnData.userName && returnData.userName.toLowerCase().includes(lowercaseSearch)) ||
        (returnData.trackingNumber && returnData.trackingNumber.toLowerCase().includes(lowercaseSearch));
      
      if (!searchMatches) return false;
    }
    
    // Apply status filter if not set to "all"
    if (statusFilter !== "all" && returnData.status !== statusFilter) {
      return false;
    }
    
    // Apply tab filters
    switch (activeTab) {
      case "requested":
        return returnData.status === ReturnStatus.REQUESTED;
      case "approved":
        return returnData.status === ReturnStatus.APPROVED || 
              returnData.status === ReturnStatus.LABEL_CREATED;
      case "in_transit":
        return returnData.status === ReturnStatus.SHIPPED;
      case "received":
        return returnData.status === ReturnStatus.RECEIVED;
      case "processed":
        return returnData.status === ReturnStatus.REFUNDED || 
              returnData.status === ReturnStatus.COMPLETED;
      case "denied":
        return returnData.status === ReturnStatus.DENIED;
      case "cancelled":
        return returnData.status === ReturnStatus.CANCELLED;
      case "all":
        return true;
      default:
        return false;
    }
  }) || [];
  
  // Handle opening the details dialog
  const handleViewDetails = (returnData: OrderReturn) => {
    setSelectedReturn(returnData);
    setDetailsDialogOpen(true);
  };
  
  // Handle return update (e.g., after processing)
  const handleReturnUpdate = () => {
    setDetailsDialogOpen(false);
    refetch();
  };
  
  if (!isAdmin) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-10">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
              <p className="text-muted-foreground">You don't have permission to access this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Manage Returns</h1>
          <p className="text-muted-foreground">
            Review and process customer return requests
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search returns..."
              className="pl-8 w-full sm:w-[200px] md:w-[260px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as ReturnStatus | "all")}
            >
              <SelectTrigger className="pl-8 w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value={ReturnStatus.REQUESTED}>Requested</SelectItem>
                <SelectItem value={ReturnStatus.APPROVED}>Approved</SelectItem>
                <SelectItem value={ReturnStatus.DENIED}>Denied</SelectItem>
                <SelectItem value={ReturnStatus.LABEL_CREATED}>Label Created</SelectItem>
                <SelectItem value={ReturnStatus.SHIPPED}>Shipped</SelectItem>
                <SelectItem value={ReturnStatus.RECEIVED}>Received</SelectItem>
                <SelectItem value={ReturnStatus.REFUNDED}>Refunded</SelectItem>
                <SelectItem value={ReturnStatus.COMPLETED}>Completed</SelectItem>
                <SelectItem value={ReturnStatus.CANCELLED}>Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button variant="outline" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>
      
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
              <p className="text-muted-foreground mb-4">No returns have been requested yet</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="requested" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="requested">
              New Requests
              {returns.filter(r => r.status === ReturnStatus.REQUESTED).length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {returns.filter(r => r.status === ReturnStatus.REQUESTED).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="in_transit">In Transit</TabsTrigger>
            <TabsTrigger value="received">Received</TabsTrigger>
            <TabsTrigger value="processed">Processed</TabsTrigger>
            <TabsTrigger value="denied">Denied</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            <TabsTrigger value="all">All Returns</TabsTrigger>
          </TabsList>
          
          <div className="space-y-4">
            {filteredReturns.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center">
                    <p className="text-muted-foreground">No returns found</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredReturns.map((returnData) => (
                <Card key={returnData.id} className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          Return #{returnData.id}
                          <Badge className={getStatusColor(returnData.status as ReturnStatus)}>
                            {formatStatus(returnData.status as ReturnStatus)}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          For Order #{returnData.orderId} • {formatDate(returnData.createdAt)}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{returnData.userName || "Unknown User"}</p>
                        <p className="text-xs text-muted-foreground">{returnData.userEmail || "No email"}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium">Items:</p>
                        <p className="text-sm">{returnData.items?.length || 0} item(s)</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Reason:</p>
                        <p className="text-sm">{returnData.reason}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Updated:</p>
                        <p className="text-sm">{formatDate(returnData.updatedAt)}</p>
                      </div>
                    </div>
                    
                    {returnData.status === ReturnStatus.REFUNDED && returnData.refundAmount && (
                      <div className="mb-4">
                        <p className="text-sm font-medium">Refund Amount:</p>
                        <p className="text-sm">${returnData.refundAmount && !isNaN(returnData.refundAmount) ? returnData.refundAmount.toFixed(2) : '0.00'}</p>
                      </div>
                    )}
                    
                    <div className="flex justify-end pt-2">
                      <Button onClick={() => handleViewDetails(returnData)}>
                        Manage Return
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </Tabs>
      )}
      
      {/* Return Details Dialog */}
      {selectedReturn && (
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Return Details #{selectedReturn.id}</DialogTitle>
            </DialogHeader>
            <ReturnDetails 
              returnData={selectedReturn} 
              onUpdate={handleReturnUpdate}
              isCustomer={false}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}