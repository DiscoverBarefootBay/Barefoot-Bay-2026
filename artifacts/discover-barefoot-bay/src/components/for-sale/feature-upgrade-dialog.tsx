import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Spinner } from '@/components/ui/spinner';
import { Star, DollarSign, CreditCard } from 'lucide-react';
import { DraftPaymentDialog } from './draft-payment-dialog';

interface FeatureUpgradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: number;
  listingTitle?: string;
  onFeatureSuccess: (listing: any) => void;
  redirectPath?: string;
}

/**
 * Upgrade an active listing to Featured by spending credits.
 * Featured lasts until the listing itself expires. If the seller is short
 * on credits, the existing buy-credits (Square) flow is offered.
 */
export const FeatureUpgradeDialog: React.FC<FeatureUpgradeDialogProps> = ({
  isOpen,
  onClose,
  listingId,
  listingTitle,
  onFeatureSuccess,
  redirectPath,
}) => {
  const { toast } = useToast();
  const [userCredits, setUserCredits] = useState<number>(0);
  const [creditCost, setCreditCost] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const hasEnoughCredits = creditCost !== null && userCredits >= creditCost;

  useEffect(() => {
    if (!isOpen) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [configRes, creditsRes] = await Promise.all([
          apiRequest('GET', '/api/featured-listings/config'),
          apiRequest('GET', '/api/credits/balance'),
        ]);
        if (configRes.ok) {
          const config = await configRes.json();
          setCreditCost(config.creditCost);
        }
        if (creditsRes.ok) {
          const credits = await creditsRes.json();
          setUserCredits(credits.credits);
        }
      } catch (error) {
        console.error('Error loading featured upgrade info:', error);
        toast({
          title: 'Error',
          description: 'Failed to load upgrade information.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isOpen, toast]);

  const handleUpgrade = async () => {
    if (!hasEnoughCredits || isProcessing) return;
    setIsProcessing(true);
    try {
      const response = await apiRequest('POST', `/api/listings/${listingId}/feature-with-credits`, {});
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || 'Failed to feature listing');
      }
      toast({
        title: 'Listing featured!',
        description: 'Your listing now gets priority placement on On The Market and in the weekly email.',
      });
      onFeatureSuccess(body.listing);
      onClose();
    } catch (error) {
      console.error('Error featuring listing:', error);
      toast({
        title: 'Upgrade failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentSuccess = (_credits: number) => {
    const fetchCredits = async () => {
      try {
        const response = await apiRequest('GET', '/api/credits/balance');
        if (response.ok) {
          const data = await response.json();
          setUserCredits(data.credits);
        }
      } catch (error) {
        console.error('Error fetching updated credits:', error);
      }
    };
    fetchCredits();
    setShowPaymentDialog(false);
    toast({
      title: 'Payment Successful',
      description: 'Credits have been added to your account. You can now feature your listing.',
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Upgrade to Featured
            </DialogTitle>
            <DialogDescription>
              Featured listings are pinned to the top of On The Market with a Featured badge and
              shown first in the weekly email. Featured status lasts until your listing expires.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" />
              <span className="ml-2">Loading...</span>
            </div>
          ) : (
            <>
              {listingTitle && (
                <div className="mb-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-900">
                    <strong>{listingTitle}</strong>
                  </p>
                </div>
              )}

              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-green-900">Your Credits</h3>
                  <span className="text-2xl font-bold text-green-600">{userCredits}</span>
                </div>
                <p className="text-sm text-green-700">
                  Featured upgrade cost: <strong>{creditCost ?? '—'} credits</strong>
                </p>
              </div>

              {hasEnoughCredits ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <span className="text-sm text-blue-700 font-medium">
                    You have enough credits to feature this listing.
                  </span>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm text-yellow-700 font-medium">
                      You need {creditCost} credits but only have {userCredits}. Purchase more
                      credits to continue.
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  Cancel
                </Button>
                {hasEnoughCredits ? (
                  <Button
                    onClick={handleUpgrade}
                    disabled={isProcessing}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
                  >
                    {isProcessing ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Upgrading...
                      </>
                    ) : (
                      `Feature for ${creditCost} Credits`
                    )}
                  </Button>
                ) : (
                  <Button onClick={() => setShowPaymentDialog(true)} className="flex-1">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Purchase Credits
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <DraftPaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        onSuccess={handlePaymentSuccess}
        userCredits={userCredits}
        creditsNeeded={creditCost ?? 0}
        redirectPath={redirectPath}
      />
    </>
  );
};

export default FeatureUpgradeDialog;
