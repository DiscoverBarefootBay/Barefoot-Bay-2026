import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { ReturnStatus } from "@shared/schema";
import { Loader2, AlertTriangle } from "lucide-react";

// The schema defines the validation rules for our form
const processReturnSchema = z.object({
  status: z.enum([
    ReturnStatus.REQUESTED,
    ReturnStatus.APPROVED,
    ReturnStatus.DENIED,
    ReturnStatus.LABEL_CREATED,
    ReturnStatus.SHIPPED,
    ReturnStatus.RECEIVED,
    ReturnStatus.REFUNDED,
    ReturnStatus.COMPLETED,
    ReturnStatus.CANCELLED
  ], {
    required_error: "Please select a status",
  }),
  adminNotes: z.string().optional(),
  returnLabelUrl: z.string().optional(),
  trackingNumber: z.string().optional(),
  refundAmount: z.string().optional(),
  refundId: z.string().optional(),
  printfulReturnId: z.string().optional(),
});

type ProcessReturnFormValues = z.infer<typeof processReturnSchema>;

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
  items: any[];
}

interface ProcessReturnFormProps {
  returnData: OrderReturn;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ProcessReturnForm({ returnData, onSuccess, onCancel }: ProcessReturnFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Initialize the form with return data
  const form = useForm<ProcessReturnFormValues>({
    resolver: zodResolver(processReturnSchema),
    defaultValues: {
      status: returnData.status,
      adminNotes: returnData.adminNotes || "",
      returnLabelUrl: returnData.returnLabelUrl || "",
      trackingNumber: returnData.trackingNumber || "",
      refundAmount: returnData.refundAmount?.toString() || "",
      refundId: returnData.refundId || "",
      printfulReturnId: returnData.printfulReturnId || "",
    }
  });
  
  // Watch the status to show conditional fields
  const watchStatus = form.watch("status");
  
  // Determine if moving to a status that needs confirmation
  const isRiskStatus = (oldStatus: ReturnStatus, newStatus: ReturnStatus) => {
    // Status changes that need extra confirmation
    const riskChanges: [ReturnStatus, ReturnStatus][] = [
      [ReturnStatus.REQUESTED, ReturnStatus.DENIED],
      [ReturnStatus.APPROVED, ReturnStatus.DENIED],
      [ReturnStatus.RECEIVED, ReturnStatus.COMPLETED],
      [ReturnStatus.REFUNDED, ReturnStatus.COMPLETED],
    ];
    
    return riskChanges.some(([from, to]) => from === oldStatus && to === newStatus);
  };
  
  // Status field validation based on current status
  const validateStatusChange = (value: ReturnStatus) => {
    const currentStatus = returnData.status;
    
    // Define allowed status transitions
    const allowedTransitions: Record<ReturnStatus, ReturnStatus[]> = {
      [ReturnStatus.REQUESTED]: [
        ReturnStatus.APPROVED,
        ReturnStatus.DENIED,
        ReturnStatus.CANCELLED
      ],
      [ReturnStatus.APPROVED]: [
        ReturnStatus.LABEL_CREATED,
        ReturnStatus.DENIED,
        ReturnStatus.CANCELLED
      ],
      [ReturnStatus.DENIED]: [
        ReturnStatus.APPROVED,
        ReturnStatus.CANCELLED,
        ReturnStatus.COMPLETED
      ],
      [ReturnStatus.LABEL_CREATED]: [
        ReturnStatus.SHIPPED,
        ReturnStatus.CANCELLED
      ],
      [ReturnStatus.SHIPPED]: [
        ReturnStatus.RECEIVED,
        ReturnStatus.CANCELLED
      ],
      [ReturnStatus.RECEIVED]: [
        ReturnStatus.REFUNDED,
        ReturnStatus.COMPLETED,
        ReturnStatus.CANCELLED
      ],
      [ReturnStatus.REFUNDED]: [
        ReturnStatus.COMPLETED
      ],
      [ReturnStatus.COMPLETED]: [],
      [ReturnStatus.CANCELLED]: [
        ReturnStatus.REQUESTED
      ]
    };
    
    // Allow staying in the same status
    if (value === currentStatus) {
      return true;
    }
    
    // Check if the new status is in the allowed transitions
    return allowedTransitions[currentStatus]?.includes(value) || false;
  };
  
  // Handle form submission
  const onSubmit = async (data: ProcessReturnFormValues) => {
    // Confirm risky status changes
    if (isRiskStatus(returnData.status, data.status)) {
      const confirmed = window.confirm(
        `Are you sure you want to change the status from ${returnData.status} to ${data.status}? This action may affect customer refund eligibility.`
      );
      
      if (!confirmed) {
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      // Convert refundAmount to number if present
      const processedData = {
        ...data,
        refundAmount: data.refundAmount ? parseFloat(data.refundAmount) : undefined
      };
      
      // Remove any undefined values (optional fields that weren't provided)
      const cleanData = Object.fromEntries(
        Object.entries(processedData).filter(([_, v]) => v !== undefined && v !== "")
      );
      
      // Update the return
      const response = await apiRequest(`/api/returns/${returnData.id}`, {
        method: "PATCH",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update return");
      }
      
      // Success!
      toast({
        title: "Return updated",
        description: `Return status changed to ${data.status}`
      });
      
      // Invalidate queries to refetch returns
      queryClient.invalidateQueries({ queryKey: ['/api/returns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/returns', returnData.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/returns/order', returnData.orderId] });
      
      // Call the success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error updating return:", error);
      toast({
        title: "Failed to update return",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Process Return Request</h2>
          
          {/* Status */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Return Status</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={ReturnStatus.REQUESTED} disabled={!validateStatusChange(ReturnStatus.REQUESTED)}>
                      Requested
                    </SelectItem>
                    <SelectItem value={ReturnStatus.APPROVED} disabled={!validateStatusChange(ReturnStatus.APPROVED)}>
                      Approved
                    </SelectItem>
                    <SelectItem value={ReturnStatus.DENIED} disabled={!validateStatusChange(ReturnStatus.DENIED)}>
                      Denied
                    </SelectItem>
                    <SelectItem value={ReturnStatus.LABEL_CREATED} disabled={!validateStatusChange(ReturnStatus.LABEL_CREATED)}>
                      Label Created
                    </SelectItem>
                    <SelectItem value={ReturnStatus.SHIPPED} disabled={!validateStatusChange(ReturnStatus.SHIPPED)}>
                      Shipped
                    </SelectItem>
                    <SelectItem value={ReturnStatus.RECEIVED} disabled={!validateStatusChange(ReturnStatus.RECEIVED)}>
                      Received
                    </SelectItem>
                    <SelectItem value={ReturnStatus.REFUNDED} disabled={!validateStatusChange(ReturnStatus.REFUNDED)}>
                      Refunded
                    </SelectItem>
                    <SelectItem value={ReturnStatus.COMPLETED} disabled={!validateStatusChange(ReturnStatus.COMPLETED)}>
                      Completed
                    </SelectItem>
                    <SelectItem value={ReturnStatus.CANCELLED} disabled={!validateStatusChange(ReturnStatus.CANCELLED)}>
                      Cancelled
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Show status transition alerts */}
          {watchStatus === ReturnStatus.DENIED && returnData.status !== ReturnStatus.DENIED && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Denying a return will notify the customer that their return request was rejected.
                Make sure to provide details in the admin notes.
              </AlertDescription>
            </Alert>
          )}
          
          {watchStatus === ReturnStatus.COMPLETED && 
           ![ReturnStatus.REFUNDED, ReturnStatus.COMPLETED].includes(returnData.status) && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Marking a return as completed without processing a refund may lead to customer dissatisfaction.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Admin Notes */}
          <FormField
            control={form.control}
            name="adminNotes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Admin Notes</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Internal notes about this return (not visible to customer)"
                    {...field}
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Return Label URL - only shown for certain statuses */}
          {[ReturnStatus.APPROVED, ReturnStatus.LABEL_CREATED, ReturnStatus.SHIPPED, 
             ReturnStatus.RECEIVED, ReturnStatus.REFUNDED].includes(watchStatus) && (
            <FormField
              control={form.control}
              name="returnLabelUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Return Label URL</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="URL to the return shipping label"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          {/* Tracking Number - only shown for certain statuses */}
          {[ReturnStatus.LABEL_CREATED, ReturnStatus.SHIPPED, 
             ReturnStatus.RECEIVED, ReturnStatus.REFUNDED, ReturnStatus.COMPLETED].includes(watchStatus) && (
            <FormField
              control={form.control}
              name="trackingNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tracking Number</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Shipping tracking number"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          {/* Refund Amount - only shown for certain statuses */}
          {[ReturnStatus.REFUNDED, ReturnStatus.COMPLETED].includes(watchStatus) && (
            <FormField
              control={form.control}
              name="refundAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Refund Amount ($)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      step="0.01"
                      placeholder="Amount refunded to customer"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          {/* Refund ID - only shown for certain statuses */}
          {[ReturnStatus.REFUNDED, ReturnStatus.COMPLETED].includes(watchStatus) && (
            <FormField
              control={form.control}
              name="refundId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Refund ID</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="ID from payment processor"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          {/* Printful Return ID - shown for all statuses */}
          <FormField
            control={form.control}
            name="printfulReturnId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Printful Return ID</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Printful return reference ID"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="flex justify-end space-x-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Return"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}