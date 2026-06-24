import { useState } from "react";
import { ReturnStatus, ReturnReason } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ProcessReturnForm } from "@/components/admin/process-return-form";

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

// Helper function to format return reason
function formatReason(reason: ReturnReason) {
  // Replace underscores with spaces and capitalize each word
  return reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Return item interface
interface ReturnItem {
  id: number;
  returnId: number;
  orderItemId: number;
  quantity: number;
  reason: ReturnReason;
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
  reason: ReturnReason;
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

interface ReturnDetailsProps {
  returnData: OrderReturn;
  onUpdate?: () => void;
  isCustomer?: boolean;
}

export function ReturnDetails({ returnData, onUpdate, isCustomer = true }: ReturnDetailsProps) {
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setImageDialogOpen(true);
  };
  
  const handleCancelReturn = async () => {
    // Only allow cancellation if return is in the "REQUESTED" state
    if (returnData.status !== ReturnStatus.REQUESTED) {
      toast({
        title: "Cannot cancel return",
        description: "This return cannot be cancelled in its current state",
        variant: "destructive",
      });
      return;
    }
    
    setIsCancelling(true);
    
    try {
      const response = await apiRequest(`/api/returns/${returnData.id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to cancel return request");
      }
      
      toast({
        title: "Return cancelled",
        description: "Your return request has been cancelled successfully",
      });
      
      // Invalidate queries to refetch returns
      queryClient.invalidateQueries({ queryKey: ['/api/returns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/returns/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/returns/order', returnData.orderId] });
      
      // Close the dialog
      setCancelDialogOpen(false);
      
      // Call the update callback if provided
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Error cancelling return:", error);
      toast({
        title: "Failed to cancel return",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };
  
  const canCancel = isCustomer && returnData.status === ReturnStatus.REQUESTED;
  const canProcess = !isCustomer; // Only admins can process returns
  
  const handleProcessSuccess = () => {
    setProcessDialogOpen(false);
    if (onUpdate) {
      onUpdate();
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-wrap justify-between items-center">
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
      <CardContent className="space-y-6">
        {/* Return Details */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Return Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Reason:</p>
              <p className="text-sm">{formatReason(returnData.reason as ReturnReason)}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Requested On:</p>
              <p className="text-sm">{formatDate(returnData.createdAt)}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm font-medium">Details:</p>
              <p className="text-sm">{returnData.reasonDetails}</p>
            </div>
            {returnData.notes && (
              <div className="md:col-span-2">
                <p className="text-sm font-medium">Additional Notes:</p>
                <p className="text-sm">{returnData.notes}</p>
              </div>
            )}
          </div>
        </div>
        
        <Separator />
        
        {/* Return Items */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Return Items</h3>
          {returnData.items.map((item) => (
            <div key={item.id} className="border rounded-md p-3 space-y-2">
              <div className="flex justify-between flex-wrap gap-2">
                <div>
                  <p className="font-medium">{item.productName || `Item #${item.orderItemId}`}</p>
                  {item.variant && <p className="text-sm text-muted-foreground">Variant: {item.variant}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm">Quantity: {item.quantity}</p>
                  {item.price && !isNaN(parseFloat(item.price)) && <p className="text-sm">Price: ${parseFloat(item.price).toFixed(2)}</p>}
                </div>
              </div>
              {item.reason !== returnData.reason && (
                <div>
                  <p className="text-sm font-medium">Item Reason:</p>
                  <p className="text-sm">{formatReason(item.reason as ReturnReason)}</p>
                </div>
              )}
              {item.reasonDetails && (
                <div>
                  <p className="text-sm font-medium">Item Details:</p>
                  <p className="text-sm">{item.reasonDetails}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Return Images (if any) */}
        {returnData.imageUrls && returnData.imageUrls.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Return Images</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {returnData.imageUrls.map((imageUrl, index) => (
                  <div 
                    key={index} 
                    className="cursor-pointer"
                    onClick={() => handleImageClick(imageUrl)}
                  >
                    <img 
                      src={imageUrl} 
                      alt={`Return image ${index + 1}`}
                      className="w-full h-24 object-cover rounded-md hover:opacity-90 transition-opacity" 
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        
        {/* Shipping Information (if label created) */}
        {returnData.status === ReturnStatus.LABEL_CREATED && returnData.returnLabelUrl && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Shipping Information</h3>
              <div className="space-y-2">
                {returnData.trackingNumber && (
                  <div>
                    <p className="text-sm font-medium">Tracking Number:</p>
                    <p className="text-sm">{returnData.trackingNumber}</p>
                  </div>
                )}
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
              </div>
            </div>
          </>
        )}
        
        {/* Refund Information (if refunded) */}
        {[ReturnStatus.REFUNDED, ReturnStatus.COMPLETED].includes(returnData.status as ReturnStatus) && returnData.refundAmount && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Refund Information</h3>
              <div>
                <p className="text-sm font-medium">Refund Amount:</p>
                <p className="text-sm">${returnData.refundAmount && !isNaN(returnData.refundAmount) ? returnData.refundAmount.toFixed(2) : '0.00'}</p>
              </div>
              {returnData.refundId && (
                <div>
                  <p className="text-sm font-medium">Refund ID:</p>
                  <p className="text-sm">{returnData.refundId}</p>
                </div>
              )}
            </div>
          </>
        )}
        
        {/* Admin Notes (only shown to admins) */}
        {!isCustomer && returnData.adminNotes && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Admin Notes</h3>
              <p className="text-sm">{returnData.adminNotes}</p>
            </div>
          </>
        )}
        
        {/* Actions */}
        <Separator />
        <div className="flex justify-end space-x-2">
          {canProcess && (
            <Button 
              variant="default" 
              onClick={() => setProcessDialogOpen(true)}
            >
              Process Return
            </Button>
          )}
          
          {canCancel && (
            <Button 
              variant="destructive" 
              onClick={() => setCancelDialogOpen(true)}
            >
              Cancel Return Request
            </Button>
          )}
        </div>
        
        {/* Cancel Confirmation Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Return Request</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel this return request? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                No, Keep Request
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleCancelReturn}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  "Yes, Cancel Request"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Process Return Dialog (admin only) */}
        {canProcess && (
          <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Process Return #{returnData.id}</DialogTitle>
              </DialogHeader>
              <ProcessReturnForm 
                returnData={returnData}
                onSuccess={handleProcessSuccess}
                onCancel={() => setProcessDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
      
      {/* Image Preview Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Return Image</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center">
            <img 
              src={selectedImage} 
              alt="Return image" 
              className="max-h-[70vh] object-contain" 
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}