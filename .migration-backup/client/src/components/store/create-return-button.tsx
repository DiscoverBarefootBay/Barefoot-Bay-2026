import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReturnRequestForm } from "@/components/store/return-request-form";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { OrderStatus } from "@shared/schema";

// Only allow returns for these order statuses
const RETURNABLE_STATUSES = [
  OrderStatus.COMPLETED,
  OrderStatus.DELIVERED,
  OrderStatus.SHIPPED,
];

interface Order {
  id: number;
  status: string;
  items: {
    id: number;
    productId: number;
    productName: string;
    variant?: string;
    price: string;
    quantity: number;
    imageUrl?: string;
  }[];
}

interface CreateReturnButtonProps {
  order: Order;
  onSuccess?: () => void;
}

export function CreateReturnButton({ order, onSuccess }: CreateReturnButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Check if the order is eligible for returns
  const isReturnable = RETURNABLE_STATUSES.includes(order.status as OrderStatus);
  
  // Fetch existing returns for this order to check if there's an active return already
  const { data: existingReturns, isLoading: isLoadingReturns } = useQuery({
    queryKey: ['/api/returns/order', order.id],
    queryFn: async () => {
      const response = await fetch(`/api/returns/order/${order.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch returns');
      }
      return response.json();
    },
    // Only fetch if the order is returnable
    enabled: isReturnable,
  });
  
  // Check if there's an active return
  const hasActiveReturn = existingReturns?.some((returnItem: any) => 
    !['COMPLETED', 'CANCELLED'].includes(returnItem.status)
  );
  
  const handleRequestReturn = () => {
    setDialogOpen(true);
  };
  
  const handleSuccess = () => {
    setDialogOpen(false);
    if (onSuccess) {
      onSuccess();
    }
  };
  
  // Button tooltip text based on conditions
  let buttonTooltip = "";
  if (!isReturnable) {
    buttonTooltip = "Returns are only available for completed or delivered orders";
  } else if (hasActiveReturn) {
    buttonTooltip = "This order already has an active return request";
  }
  
  return (
    <>
      <Button
        onClick={handleRequestReturn}
        disabled={!isReturnable || hasActiveReturn || isLoadingReturns}
        variant="outline"
        title={buttonTooltip}
      >
        {isLoadingReturns ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Checking...
          </>
        ) : hasActiveReturn ? (
          "Return In Progress"
        ) : (
          "Request Return"
        )}
      </Button>
      
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Request Return for Order #{order.id}</DialogTitle>
          </DialogHeader>
          <ReturnRequestForm 
            order={order}
            onSuccess={handleSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}