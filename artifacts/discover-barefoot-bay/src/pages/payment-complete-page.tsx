import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader, CreditCard } from "lucide-react";

export default function PaymentCompletePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<"success" | "error" | "processing">("processing");
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [creditsAdded, setCreditsAdded] = useState<number | null>(null);
  const [currentCredits, setCurrentCredits] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Parse the query parameters (Square will redirect back with parameters)
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const paymentType = searchParams.get("type"); // "credits" for credit purchases
  const packageId = searchParams.get("pkg"); // Credit package ID
  const orderId = searchParams.get("ord"); // Our internal order ID
  const paymentLinkId = searchParams.get("checkoutId");
  const referenceId = searchParams.get("referenceId");
  const transactionId = searchParams.get("transactionId"); // Square's transaction/order ID
  const squareOrderId = searchParams.get("orderId") || transactionId; // Square's orderId (appended by Square on redirect)
  const redirectPath = searchParams.get("redirect"); // Where to redirect after successful payment

  // Debug logging for payment completion
  console.log("Payment completion page loaded with params:", {
    paymentType,
    packageId,
    orderId,
    squareOrderId,
    paymentLinkId,
    referenceId,
    transactionId,
    allParams: Object.fromEntries(searchParams.entries()),
    urlSearch: typeof window !== 'undefined' ? window.location.search : 'SSR'
  });
  
  // Verify payment status mutation
  const verifyPaymentMutation = useMutation({
    mutationFn: async () => {
      // Handle credit purchases 
      if (paymentType === "credits" && packageId && orderId) {
        console.log("Credit verification - sending request with:", {
          packageId,
          orderId,
          squareOrderId,
          paymentType,
          allUrlParams: Object.fromEntries(searchParams.entries())
        });

        // Try authenticated endpoint first
        console.log("Attempting authenticated verification at /api/credits/verify-purchase");
        let response = await fetch("/api/credits/verify-purchase", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest"
          },
          credentials: "include",
          body: JSON.stringify({
            packageId: packageId,
            orderId: orderId,
            squareOrderId: squareOrderId
          })
        });
        
        console.log("Authenticated verification response:", {
          ok: response.ok,
          status: response.status
        });
        
        // If authentication failed (401), try the public endpoint
        if (response.status === 401) {
          console.log("Session expired, trying public verification endpoint");
          
          response = await fetch("/api/credits/verify-purchase-public", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              packageId: packageId,
              orderId: orderId,
              squareOrderId: squareOrderId
            })
          });
          
          console.log("Public verification response:", {
            ok: response.ok,
            status: response.status
          });
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error response text:", errorText);
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }
          
          throw new Error(errorData.message || "Failed to verify credit purchase");
        }
        
        const result = await response.json();
        console.log("API response data:", result);
        return result;
      }
      
      // Handle legacy payment verification
      const paymentIdentifier = paymentLinkId || orderId || referenceId || transactionId;
      
      if (!paymentIdentifier) {
        throw new Error("No payment identifier found in URL");
      }
      
      // Try authenticated first, then public endpoint
      let response = await fetch("/api/credits/verify-purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        credentials: "include",
        body: JSON.stringify({
          packageId: packageId,
          orderId: orderId
        })
      });
      
      // Fallback to public endpoint on 401
      if (response.status === 401 && orderId) {
        console.log("Session expired, trying public verification for legacy flow");
        response = await fetch("/api/credits/verify-purchase-public", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            packageId: packageId,
            orderId: orderId
          })
        });
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to verify payment status");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setPaymentId(data.transactionId || data.paymentId);
        setStatus('success'); // Credit verification success means payment is complete
        
        // Capture credit information if available
        if (data.credits !== undefined) {
          setCreditsAdded(data.credits); // The credits field represents credits added
        }
        if (data.creditsAdded !== undefined) {
          setCreditsAdded(data.creditsAdded);
        }
        if (data.currentCredits !== undefined) {
          setCurrentCredits(data.currentCredits);
        }
        
        toast({
          title: "Payment Successful",
          description: "Your credits have been added successfully."
        });
        
        // Start countdown for auto-close
        setCountdown(1.5);
      } else {
        setStatus("error");
        toast({
          title: "Payment Verification Failed",
          description: data.message || "We couldn't verify your payment status.",
          variant: "destructive"
        });
      }
      setIsLoading(false);
    },
    onError: (error: Error) => {
      console.error("Payment verification error:", error);
      setStatus("error");
      toast({
        title: "Payment Verification Error",
        description: error.message || "We couldn't verify your payment status.",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  });
  
  // Handle payment success
  const handlePaymentSuccess = useMutation({
    mutationFn: async () => {
      // Determine which ID to use
      const paymentIdentifier = paymentLinkId || orderId || referenceId;
      
      if (!paymentIdentifier) {
        throw new Error("No payment identifier found in URL");
      }
      
      const response = await apiRequest("POST", "/api/payments/verify", {
        paymentIntentId: paymentIdentifier
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to process payment");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setPaymentId(data.paymentId);
        setCreditsAdded(data.creditsAdded);
        setCurrentCredits(data.currentCredits);
        setStatus("success");
        setCountdown(1.5); // Start countdown for auto-close
        toast({
          title: "Payment Successful",
          description: "Your payment has been processed successfully."
        });
      } else {
        setStatus("error");
        toast({
          title: "Payment Processing Failed",
          description: data.message || "We couldn't process your payment.",
          variant: "destructive"
        });
      }
      setIsLoading(false);
    },
    onError: (error: Error) => {
      console.error("Payment processing error:", error);
      
      // Show actual error - don't hide verification failures
      setStatus("error");
      toast({
        title: "Payment Verification Error",
        description: error.message || "We couldn't verify your payment. Please contact support if you were charged.",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  });
  
  // Check if we were redirected from Square
  useEffect(() => {
    console.log("PaymentCompletePage mounted");
    console.log("Current location:", window.location.href);
    console.log("Query parameters:", { 
      paymentType,
      packageId,
      orderId, 
      paymentLinkId, 
      referenceId, 
      transactionId,
      fullSearch: window.location.search,
      userAuthenticated: !!user
    });
    
    // Don't require user authentication - the API has a public fallback endpoint
    // This handles the case where the user's session is lost during Square redirect
    
    // Start the payment verification
    if (paymentType === "credits" && packageId && orderId) {
      console.log("Triggering CREDIT verification with:", { paymentType, packageId, orderId });
      verifyPaymentMutation.mutate();
    } else if (orderId || paymentLinkId || referenceId || transactionId) {
      console.log("Triggering REGULAR payment verification with:", { orderId, paymentLinkId, referenceId, transactionId });
      handlePaymentSuccess.mutate();
    } else {
      // No payment identifiers found in the URL
      setStatus("error");
      setIsLoading(false);
      toast({
        title: "Payment Information Missing",
        description: "No payment information was found in the URL.",
        variant: "destructive"
      });
    }
  }, [orderId, paymentLinkId, referenceId, transactionId, packageId, paymentType]);

  // Countdown timer for auto-redirect after successful payment
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const timer = setTimeout(() => {
      if (countdown <= 0.1) {
        // Navigate to the redirect path or default to for-sale page
        const finalRedirect = redirectPath ? decodeURIComponent(redirectPath) : "/for-sale";
        navigate(finalRedirect);
      } else {
        setCountdown(countdown - 0.1);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [countdown, navigate, redirectPath]);
  
  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md my-12">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-2">Payment Status</h1>
        <p className="text-muted-foreground">
          {isLoading
            ? "Checking your payment status..."
            : status === "success"
            ? "Your payment has been successfully processed."
            : status === "processing"
            ? "Your payment is still being processed."
            : "There was an issue with your payment."}
        </p>
      </div>
      
      <div className="flex justify-center my-8">
        {isLoading ? (
          <div className="bg-blue-50 p-6 rounded-full">
            <Loader className="h-16 w-16 text-blue-500 animate-spin" />
          </div>
        ) : status === "success" ? (
          <div className="bg-green-50 p-6 rounded-full">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
        ) : status === "processing" ? (
          <div className="bg-yellow-50 p-6 rounded-full">
            <Loader className="h-16 w-16 text-yellow-500 animate-spin" />
          </div>
        ) : (
          <div className="bg-red-50 p-6 rounded-full">
            <XCircle className="h-16 w-16 text-red-500" />
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        {status === "success" && (
          <div className="bg-green-50 p-4 rounded-md border border-green-100">
            <div className="flex items-center justify-center mb-4">
              <CreditCard className="h-6 w-6 text-green-600 mr-2" />
              <h3 className="text-lg font-semibold text-green-800">Credits Added to Your Account</h3>
            </div>
            
            {creditsAdded !== null && (
              <div className="text-center mb-3">
                <p className="text-green-800 text-lg font-bold">
                  +{creditsAdded} Credits Added
                </p>
                <p className="text-green-700 text-sm">
                  (${(creditsAdded * 5).toFixed(2)} value)
                </p>
              </div>
            )}
            
            {currentCredits !== null && (
              <div className="text-center mb-4">
                <p className="text-green-800 text-sm">
                  Your current balance: <span className="font-semibold">{currentCredits} credits</span>
                </p>
              </div>
            )}
            
            {countdown !== null && countdown > 0 && (
              <div className="text-center">
                <p className="text-green-800 text-sm">
                  Redirecting to For Sale listings in {countdown.toFixed(1)} seconds
                </p>
                <div className="w-full bg-green-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-100" 
                    style={{ width: `${(countdown / 1.5) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            {/* Show discount code if one was used */}
            {referenceId && referenceId.includes("FREESHOP100") && (
              <p className="text-green-800 text-xs mt-2 text-center">
                <span className="font-semibold">Discount applied:</span> FREESHOP100 (100% off)
              </p>
            )}
            {referenceId && referenceId.includes("ALMOSTFREE99") && (
              <p className="text-green-800 text-xs mt-2 text-center">
                <span className="font-semibold">Discount applied:</span> ALMOSTFREE99 (99% off)
              </p>
            )}
            {referenceId && referenceId.includes("HALFSHOP50") && (
              <p className="text-green-800 text-xs mt-2 text-center">
                <span className="font-semibold">Discount applied:</span> HALFSHOP50 (50% off)
              </p>
            )}
          </div>
        )}
        
        {status === "processing" && (
          <div className="bg-yellow-50 p-4 rounded-md border border-yellow-100">
            <p className="text-yellow-800 text-sm">
              Your payment is still being processed. This may take a few moments.
            </p>
            <div className="mt-3">
              <Button
                onClick={() => verifyPaymentMutation.mutate()}
                disabled={verifyPaymentMutation.isPending}
                variant="outline"
                className="w-full"
              >
                {verifyPaymentMutation.isPending ? "Checking..." : "Check Payment Status"}
              </Button>
            </div>
          </div>
        )}
        
        {status === "error" && (
          <div className="bg-red-50 p-4 rounded-md border border-red-100">
            <p className="text-red-800 text-sm">
              There was an issue with your payment. Please try again or contact support.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}