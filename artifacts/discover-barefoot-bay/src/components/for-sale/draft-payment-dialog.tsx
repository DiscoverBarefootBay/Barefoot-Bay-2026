import { useState, useEffect, useRef } from "react";
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
import { ExternalLink, Coins } from "lucide-react";

const CREDIT_PACKAGES = [
  { id: 'basic', name: 'Basic Package', credits: 2, price: 1000, description: 'Perfect for single listings' },
  { id: 'standard', name: 'Standard Package', credits: 5, price: 2500, description: 'Great value for occasional listings' },
  { id: 'premium', name: 'Premium Package', credits: 10, price: 5000, description: 'Best value for regular users' }
];

function getPackageForCredits(creditsNeeded: number) {
  if (creditsNeeded <= 2) return CREDIT_PACKAGES[0];
  if (creditsNeeded <= 5) return CREDIT_PACKAGES[1];
  return CREDIT_PACKAGES[2];
}

type DraftPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (credits: number) => void;
  userCredits?: number;
  creditsNeeded?: number;
  redirectPath?: string;
};

export function DraftPaymentDialog({ 
  open, 
  onOpenChange, 
  onSuccess, 
  userCredits = 0,
  creditsNeeded = 0,
  redirectPath
}: DraftPaymentDialogProps) {
  const { toast } = useToast();
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [showPaymentLink, setShowPaymentLink] = useState(false);
  const hasTriggeredRef = useRef(false);

  const selectedPackageInfo = getPackageForCredits(creditsNeeded);

  const createCreditPurchaseMutation = useMutation({
    mutationFn: async ({ packageId }: { packageId: string }) => {
      const response = await apiRequest('POST', '/api/credits/create-purchase-link', {
        packageId,
        redirectPath
      });
      
      if (!response.ok) {
        throw new Error('Failed to create credit purchase link');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setPaymentLinkUrl(data.paymentUrl);
      setOrderId(data.orderId);
      setShowPaymentLink(true);
      
      setTimeout(() => {
        window.location.href = data.paymentUrl;
      }, 1500);
    },
    onError: (error) => {
      console.error('Credit purchase error:', error);
      toast({
        title: "Purchase Error",
        description: "Failed to create credit purchase link. Please try again.",
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    if (open && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      createCreditPurchaseMutation.mutate({ packageId: selectedPackageInfo.id });
    }
    if (!open) {
      hasTriggeredRef.current = false;
      setPaymentLinkUrl(null);
      setOrderId(null);
      setShowPaymentLink(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-blue-600" />
            Purchase Credits
          </DialogTitle>
          <DialogDescription>
            Buy credits to publish your listings on Barefoot Bay Community.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {showPaymentLink && paymentLinkUrl && orderId ? (
            <div className="flex flex-col gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-center mb-4">
                  <h3 className="font-medium mb-2">{selectedPackageInfo.name}</h3>
                  <div className="text-2xl font-bold text-blue-600">
                    {selectedPackageInfo.credits} credits for ${(selectedPackageInfo.price / 100).toFixed(2)}
                  </div>
                </div>
                
                <p className="text-sm text-center mb-4">
                  Redirecting to Square's secure payment page...
                </p>
                
                <Button 
                  onClick={() => {
                    window.location.href = paymentLinkUrl;
                  }}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Payment Page
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center p-4">
              <p>Generating credit purchase link...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
