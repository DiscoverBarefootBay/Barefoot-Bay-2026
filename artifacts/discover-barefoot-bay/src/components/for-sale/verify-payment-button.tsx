import React, { useState } from 'react';
import { Button } from '../ui/button';
import { useToast } from '../ui/use-toast';
import { apiRequest } from '../../lib/api';

interface VerifyPaymentButtonProps {
  paymentId?: string;
  checkoutId?: string;
  orderId?: string;
  onVerificationComplete?: (result: any) => void;
  className?: string;
}

export function VerifyPaymentButton({ 
  paymentId, 
  checkoutId, 
  orderId, 
  onVerificationComplete,
  className 
}: VerifyPaymentButtonProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  const handleVerifyPayment = async () => {
    if (!paymentId && !checkoutId && !orderId) {
      toast({
        title: "Missing Payment Information",
        description: "No payment identifier provided for verification.",
        variant: "destructive"
      });
      return;
    }

    setIsVerifying(true);

    try {
      console.log("Verifying payment status:", { paymentId, checkoutId, orderId });
      
      const response = await apiRequest("POST", "/api/payments/verify-status", {
        paymentId,
        checkoutId,
        orderId
      });

      if (!response.ok) {
        throw new Error(`Verification failed: ${response.status}`);
      }

      const result = await response.json();
      console.log("Payment verification result:", result);

      if (result.success && result.payment) {
        toast({
          title: "Payment Verified",
          description: `Payment confirmed! You now have ${result.credits} credits available.`,
        });

        // Call completion callback if provided
        if (onVerificationComplete) {
          onVerificationComplete(result);
        }
      } else {
        toast({
          title: "Payment Not Found",
          description: result.message || "Payment not found or not yet completed. Please try again later.",
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error("Payment verification error:", error);
      toast({
        title: "Verification Error",
        description: "Failed to verify payment status. Please try again or contact support.",
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Button 
      onClick={handleVerifyPayment} 
      disabled={isVerifying}
      className={className}
      variant="outline"
    >
      {isVerifying ? "Verifying..." : "Verify Payment Status"}
    </Button>
  );
}