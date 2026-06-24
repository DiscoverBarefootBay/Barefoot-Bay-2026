import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Spinner } from '@/components/ui/spinner';
import { Check, DollarSign, CreditCard } from "lucide-react";
import { DraftPaymentDialog } from './draft-payment-dialog';

interface PublishPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: number;
  onPublishSuccess: (listing: any) => void;
  redirectPath?: string;
}

export const PublishPaymentDialog: React.FC<PublishPaymentDialogProps> = ({ 
  isOpen, 
  onClose, 
  listingId, 
  onPublishSuccess,
  redirectPath 
}) => {
  const { toast } = useToast();
  const [userCredits, setUserCredits] = useState<number>(0);
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);
  const [draftListing, setDraftListing] = useState<any>(null);
  const [isLoadingListing, setIsLoadingListing] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<string>('30');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  // Calculate credits needed based on duration
  const creditsNeeded = selectedDuration === '3' ? 2 : selectedDuration === '7' ? 5 : 10;
  const hasEnoughCredits = userCredits >= creditsNeeded;

  // Fetch draft listing information and user credits
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setIsLoadingCredits(true);
        setIsLoadingListing(true);
        
        try {
          // Fetch both listing data and user credits
          const [listingResponse, creditsResponse] = await Promise.all([
            apiRequest('GET', `/api/listings/${listingId}`),
            apiRequest('GET', '/api/credits/balance')
          ]);

          // Handle listing data
          if (listingResponse.ok) {
            const listingData = await listingResponse.json();
            setDraftListing(listingData);
            
            // Set default duration based on draft listing
            const draftDuration = listingData?.listingDuration;
            if (draftDuration === '3_day' || draftDuration === '3') setSelectedDuration('3');
            else if (draftDuration === '7_day' || draftDuration === '7') setSelectedDuration('7');
            else setSelectedDuration('30');
          }

          // Handle credits data
          if (creditsResponse.ok) {
            const creditsData = await creditsResponse.json();
            setUserCredits(creditsData.credits);
          }
        } catch (error) {
          console.error('Error fetching data:', error);
          toast({
            title: 'Error',
            description: 'Failed to load listing information.',
            variant: 'destructive'
          });
        } finally {
          setIsLoadingCredits(false);
          setIsLoadingListing(false);
        }
      };

      fetchData();
    }
  }, [isOpen, listingId, toast]);

  const handleCreditPublish = async () => {
    if (!hasEnoughCredits) return;
    
    setIsProcessing(true);
    try {
      // Convert duration format for server (e.g., '30' -> '30_day')
      const serverDuration = selectedDuration === '30' ? '30_day' : 
                            selectedDuration === '7' ? '7_day' : 
                            selectedDuration === '3' ? '3_day' : selectedDuration;
                            
      const response = await apiRequest('POST', `/api/listings/${listingId}/publish-with-credits`, {
        listingDuration: serverDuration,
        creditsToUse: creditsNeeded
      });

      if (response.ok) {
        const publishedListing = await response.json();
        toast({
          title: 'Success',
          description: 'Your listing has been published successfully!',
        });
        onPublishSuccess(publishedListing);
        onClose();
      } else {
        throw new Error('Failed to publish listing');
      }
    } catch (error) {
      console.error('Error publishing listing:', error);
      toast({
        title: 'Error',
        description: 'Failed to publish listing. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreditPurchase = () => {
    setShowPaymentDialog(true);
  };

  const handlePaymentSuccess = (_credits: number) => {
    // Refresh credits after payment
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
      description: 'Credits have been added to your account. You can now publish your listing.',
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publish Your Listing</DialogTitle>
            <DialogDescription>
              Choose how to publish your listing - use credits or purchase more credits.
            </DialogDescription>
          </DialogHeader>
          
          {(isLoadingCredits || isLoadingListing) ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" />
              <span className="ml-2">Loading options...</span>
            </div>
          ) : (
            <>
              {/* Display Draft Listing Information */}
              {draftListing && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-1">Publishing Draft Listing</h4>
                  <p className="text-sm text-blue-700">
                    <strong>{draftListing.title}</strong> - {draftListing.listingType}
                  </p>
                </div>
              )}

              {/* Credits Section */}
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-green-900">Your Credits</h3>
                  <span className="text-2xl font-bold text-green-600">{userCredits}</span>
                </div>
                <p className="text-sm text-green-700 mb-4">
                  Credits can be used to publish listings without payment.
                </p>
                
                {/* Duration Selection */}
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Select Listing Duration</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`p-3 border rounded-lg text-center cursor-pointer ${
                      selectedDuration === '3' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                    }`} onClick={() => setSelectedDuration('3')}>
                      <div className="font-medium">3 Days</div>
                      <div className="text-sm text-gray-600">2 Credits ($10)</div>
                    </div>
                    <div className={`p-3 border rounded-lg text-center cursor-pointer ${
                      selectedDuration === '7' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                    }`} onClick={() => setSelectedDuration('7')}>
                      <div className="font-medium">7 Days</div>
                      <div className="text-sm text-gray-600">5 Credits ($25)</div>
                    </div>
                    <div className={`p-3 border rounded-lg text-center cursor-pointer ${
                      selectedDuration === '30' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                    }`} onClick={() => setSelectedDuration('30')}>
                      <div className="font-medium">30 Days</div>
                      <div className="text-sm text-gray-600">10 Credits ($50)</div>
                    </div>
                  </div>
                </div>

                {/* Credit Status */}
                {hasEnoughCredits ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-blue-700 font-medium">
                        You have sufficient credits to publish this listing
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm text-yellow-700 font-medium">
                        You need {creditsNeeded} credits but only have {userCredits}. Purchase more credits to continue.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
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
                    onClick={handleCreditPublish}
                    disabled={isProcessing}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isProcessing ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Publishing...
                      </>
                    ) : (
                      `Publish with Credits`
                    )}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleCreditPurchase}
                    className="flex-1"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Purchase Credits
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Square Payment Dialog for Draft Publishing */}
      <DraftPaymentDialog 
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        onSuccess={handlePaymentSuccess}
        userCredits={userCredits}
        creditsNeeded={creditsNeeded}
        redirectPath={redirectPath}
      />
    </>
  );
};

export default PublishPaymentDialog;