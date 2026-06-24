import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { DollarSign, CreditCard, Check, ExternalLink } from "lucide-react";

const discountCodeSchema = z.object({
  code: z.string().min(1, "Discount code is required")
});

type DiscountCodeFormData = z.infer<typeof discountCodeSchema>;

type PaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (paymentId: number) => void;
};

// Square Payment Link component
function SquarePaymentLink({ paymentLinkUrl, paymentId, onSuccess }: { 
  paymentLinkUrl: string; 
  paymentId: number;
  onSuccess?: (paymentId: number) => void;
}) {
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);

  // Function to verify the payment status with the server
  const verifyPayment = async (paymentLinkId: string) => {
    setIsVerifying(true);
    
    try {
      const response = await apiRequest("POST", "/api/payments/verify", {
        paymentIntentId: paymentLinkId
      });
      
      if (!response.ok) {
        throw new Error("Failed to verify payment");
      }
      
      const data = await response.json();
      
      if (data.success && data.status === 'completed') {
        toast({
          title: "Payment Verified",
          description: "Your payment has been verified. You can now create your listing.",
        });
        
        // Payment verified, proceed with listing creation
        if (onSuccess) {
          onSuccess(paymentId);
        }
        return true;
      } else {
        toast({
          title: "Payment Pending",
          description: "Your payment is still processing. Please try checking again shortly.",
        });
        return false;
      }
    } catch (error) {
      console.error("Payment verification error:", error);
      toast({
        title: "Verification Error",
        description: "We couldn't verify your payment status. Please try again or contact support.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  // Extract payment link ID
  const paymentLinkId = paymentLinkUrl.split('/').pop() || '';

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted p-4 rounded-lg">
        <p className="text-sm text-center mb-2">
          You will be redirected to Square's secure payment page to complete your transaction.
        </p>
        <Button 
          onClick={() => window.open(paymentLinkUrl, '_blank')}
          className="w-full"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open Payment Page
        </Button>
      </div>
      
      <Separator className="my-2" />
      
      <div className="text-center text-sm space-y-2">
        <p>Already completed payment?</p>
        <Button 
          variant="outline" 
          onClick={() => verifyPayment(paymentLinkId)}
          disabled={isVerifying}
          className="w-full"
        >
          <Check className="h-4 w-4 mr-2" />
          {isVerifying ? "Verifying..." : "Verify Payment Status"}
        </Button>
      </div>
    </div>
  );
}

export function PaymentDialog({ open, onOpenChange, onSuccess }: PaymentDialogProps) {
  const { toast } = useToast();
  const [isPaying, setIsPaying] = useState(false);
  const [price, setPrice] = useState(50);
  const [hasAppliedDiscount, setHasAppliedDiscount] = useState(false);
  const [isProcessingDiscount, setIsProcessingDiscount] = useState(false);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  
  // Reset state when dialog opens or closes
  useEffect(() => {
    if (!open) {
      setPaymentInitiated(false);
      setPaymentLinkUrl(null);
      setPaymentId(null);
    }
  }, [open]);
  
  const form = useForm<DiscountCodeFormData>({
    resolver: zodResolver(discountCodeSchema),
    defaultValues: {
      code: ""
    }
  });
  
  // Create payment link mutation
  const createPaymentMutation = useMutation({
    mutationFn: async (discountCode?: string) => {
      setIsPaying(true);
      
      const payload = discountCode ? { discountCode } : {};
      const response = await apiRequest("POST", "/api/payments/create-link", payload);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create payment");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.isFree) {
        // Free listing with valid discount code
        toast({
          title: "Discount applied",
          description: "Your discount code has been applied! You can now create a listing for free.",
        });
        
        // For free listings, we already have the payment ID
        if (onSuccess) {
          onSuccess(data.paymentId);
        }
        onOpenChange(false); // Close the dialog
      } else {
        // Need to process payment with Square
        setPaymentLinkUrl(data.paymentLinkUrl);
        setPaymentId(data.paymentId);
        setPaymentInitiated(true);
      }
      setIsPaying(false);
    },
    onError: (error: Error) => {
      console.error("Payment error:", error);
      
      // Enhanced error handling with more specific messages
      let errorMessage = "Failed to create payment. Please try again.";
      
      if (error.message) {
        if (error.message.includes("401 Unauthorized")) {
          errorMessage = "Payment system authentication issue. The team has been notified.";
        } else if (error.message.includes("404")) {
          errorMessage = "Payment system endpoint not found. Please try again later.";
        } else if (error.message.includes("500")) {
          errorMessage = "Payment system error. Please try again later or contact support.";
        } else {
          // Include part of the original error for better debugging
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive",
      });
      setIsPaying(false);
    }
  });
  
  // Apply discount code mutation
  const applyDiscountMutation = useMutation({
    mutationFn: async (data: DiscountCodeFormData) => {
      setIsProcessingDiscount(true);
      
      const response = await apiRequest("POST", "/api/payments/validate-discount", {
        code: data.code
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Invalid discount code");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      // Update price with discount
      setPrice(data.finalAmount / 100);
      setHasAppliedDiscount(true);
      
      toast({
        title: "Discount applied",
        description: `Discount of $${data.discountAmount / 100} applied. Final price: $${data.finalAmount / 100}.`,
      });
      
      setIsProcessingDiscount(false);
    },
    onError: (error: Error) => {
      console.error("Discount code error:", error);
      toast({
        title: "Error",
        description: error.message || "Invalid discount code. Please try again.",
        variant: "destructive",
      });
      setIsProcessingDiscount(false);
    }
  });
  
  const handleApplyDiscount = (data: DiscountCodeFormData) => {
    applyDiscountMutation.mutate(data);
  };
  
  const handleProceedToPayment = () => {
    const discountCode = hasAppliedDiscount ? form.getValues().code : undefined;
    createPaymentMutation.mutate(discountCode);
  };
  
  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      // Only allow closing if we're not in the middle of payment processing
      if (!isPaying) {
        onOpenChange(newOpen);
      }
    }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-auto p-6 mt-4">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Create Draft Listing</DialogTitle>
          <DialogDescription>
            You can purchase publishing credits for your drafts under the <a href="/my-listings" className="text-blue-600 hover:text-blue-800 underline">My Listings</a> page. You will be auto-redirected to that page after saving your draft listing here.
          </DialogDescription>
        </DialogHeader>
        
        {!paymentInitiated ? (
          <div className="flex flex-col gap-6 py-4 px-2">
            {/* Price Display - Hidden for draft listings */}
            <div className="hidden bg-muted p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <p className="font-medium">Listing Fee</p>
                </div>
                <p className="font-semibold">${price}.00</p>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Your listing will be visible to all community members after approval.
              </p>
            </div>
            
            {!hasAppliedDiscount && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleApplyDiscount)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount Code</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input placeholder="Enter code" {...field} />
                          </FormControl>
                          <Button 
                            type="submit" 
                            variant="outline" 
                            disabled={isProcessingDiscount}
                          >
                            Apply
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            )}
            
            {hasAppliedDiscount && (
              <div className="flex items-center gap-2 text-sm bg-green-50 p-2 rounded border border-green-200">
                <Check className="h-4 w-4 text-green-600" />
                <span>Discount code "{form.getValues().code}" applied</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="ml-auto" 
                  onClick={() => {
                    setHasAppliedDiscount(false);
                    setPrice(50);
                  }}
                >
                  Remove
                </Button>
              </div>
            )}
            
            <Separator className="my-2" />
            
            <div className="flex flex-col gap-2">
              <Button 
                onClick={handleProceedToPayment} 
                disabled={isPaying}
                className="w-full"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {price === 0 ? "Continue with Free Listing" : `Proceed to Payment`}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)} 
                disabled={isPaying}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-4">
            {paymentLinkUrl && paymentId ? (
              <SquarePaymentLink 
                paymentLinkUrl={paymentLinkUrl}
                paymentId={paymentId}
                onSuccess={onSuccess}
              />
            ) : (
              <div className="text-center p-4">
                <p>Generating payment link...</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}