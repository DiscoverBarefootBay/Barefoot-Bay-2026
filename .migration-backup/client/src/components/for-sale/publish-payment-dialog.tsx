import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Spinner } from '@/components/ui/spinner';
import { Check, DollarSign, CreditCard } from "lucide-react";
import { PaymentDialog } from './payment-dialog';

// Add window type for Square SDK
declare global {
  interface Window {
    Square?: any;
  }
}

interface PublishPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: number;
  onPublishSuccess: (listing: any) => void;
}

// Credit-based publishing component
function CreditPublishForm({ listingId, onPublishSuccess, onClose, draftListing }: { 
  listingId: number; 
  onPublishSuccess: (listing: any) => void;
  onClose: () => void;
  draftListing: any;
}) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<string>(() => {
    // Convert draft listing duration to the format expected by the UI
    const draftDuration = draftListing?.listingDuration;
    if (draftDuration === '30_day' || draftDuration === '30') return '30';
    if (draftDuration === '7_day' || draftDuration === '7') return '7';
    if (draftDuration === '3_day' || draftDuration === '3') return '3';
    return '30'; // Default to 30 days
  });
  const [userCredits, setUserCredits] = useState<number>(0);
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);

  // Fetch user credits
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const response = await apiRequest('GET', '/api/credits/balance');
        if (response.ok) {
          const data = await response.json();
          setUserCredits(data.credits);
        }
      } catch (error) {
        console.error('Error fetching credits:', error);
      } finally {
        setIsLoadingCredits(false);
      }
    };

    fetchCredits();
  }, []);

  // Calculate credits needed based on listing type and duration
  const getCreditsNeeded = (duration: string, listingType: string = draftListing?.listingType || 'FSBO'): number => {
    // All property listings (FSBO, Agent, Rent, OpenHouse) have duration-based pricing
    if (['FSBO', 'Agent', 'Rent', 'OpenHouse'].includes(listingType)) {
      switch (duration) {
        case '3':
          return 2; // 3 days = 2 credits ($10)
        case '7':
          return 5; // 7 days = 5 credits ($25)
        case '30':
          return 10; // 30 days = 10 credits ($50)
        default:
          return 2;
      }
    }
    
    // Other listing types (Classified, GarageSale, Wanted) - same pricing structure
    switch (duration) {
      case '3':
        return 2; // 3 days = 2 credits ($10)
      case '7':
        return 5; // 7 days = 5 credits ($25)
      case '30':
        return 10; // 30 days = 10 credits ($50)
      default:
        return 2;
    }
  };

  const creditsNeeded = getCreditsNeeded(selectedDuration);
  const hasEnoughCredits = userCredits >= creditsNeeded;

  // Handle credit-based publishing
  const handleCreditPublish = async () => {
    if (!hasEnoughCredits || isProcessing) {
      return;
    }

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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to publish with credits');
      }

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Published Successfully',
          description: `Your listing has been published using ${creditsNeeded} credit${creditsNeeded !== 1 ? 's' : ''}!`,
        });
        onPublishSuccess(data.listing);
      } else {
        throw new Error(data.message || 'Failed to publish listing');
      }
    } catch (error) {
      console.error('Credit publish error:', error);
      toast({
        title: 'Publishing Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoadingCredits) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
        <span className="ml-2">Loading your credits...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Credits Section - Matching main payment dialog style */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-green-600" />
            </div>
            <h3 className="font-semibold text-green-900">Your Credits</h3>
          </div>
          <div className="text-2xl font-bold text-green-600">{userCredits}</div>
        </div>
        <p className="text-sm text-green-700">
          Credits can be used to publish listings without payment.
        </p>
      </div>

      {/* Duration Selection - Consistent with main dialog */}
      <div className="space-y-4">
        <h4 className="font-medium">Select Listing Duration</h4>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: '3', label: '3 Days - 2 Credits ($10)', credits: 2 },
            { value: '7', label: '7 Days - 5 Credits ($25)', credits: 5 },
            { value: '30', label: '30 Days - 10 Credits ($50)', credits: 10 }
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedDuration(option.value)}
              disabled={isProcessing}
              className={`relative p-4 rounded-lg border-2 text-center transition-all ${
                selectedDuration === option.value
                  ? 'border-green-500 bg-green-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="font-semibold">{option.label}</div>
              {selectedDuration === option.value && (
                <div className="absolute top-2 right-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Credit Balance Check */}
      {userCredits >= 1 ? (
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
              Insufficient credits. Switch to payment tab to purchase.
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onClose} 
          disabled={isProcessing}
          className="flex-1"
        >
          Cancel
        </Button>
        
        <Button 
          onClick={handleCreditPublish}
          disabled={isProcessing || userCredits < 1}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
        >
          {isProcessing ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Publishing...
            </>
          ) : userCredits >= 1 ? (
            `Publish with Credits`
          ) : (
            `Insufficient Credits`
          )}
        </Button>
      </div>
    </div>
  );
}

// Square payment form component
function SquarePaymentForm({ listingId, onPublishSuccess, onClose, draftListing }: { 
  listingId: number; 
  onPublishSuccess: (listing: any) => void;
  onClose: () => void;
  draftListing: any;
}) {
  const paymentFormRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<string>(draftListing?.listingDuration || '7_day');
  const [priceDisplay, setPriceDisplay] = useState<string>('$10.00');
  const [card, setCard] = useState<any>(null);
  const [isSquareLoaded, setIsSquareLoaded] = useState(false);
  const [isPaymentFormReady, setIsPaymentFormReady] = useState(false);

  // Update price display when duration changes
  useEffect(() => {
    switch(selectedDuration) {
      case '3_day':
        setPriceDisplay('$5.00');
        break;
      case '7_day':
        setPriceDisplay('$10.00');
        break;
      case '30_day':
        setPriceDisplay('$25.00');
        break;
      default:
        setPriceDisplay('$10.00');
    }
  }, [selectedDuration]);

  // Initialize the Square payment form
  useEffect(() => {
    // This loads the Square JS SDK
    const loadSquareSdk = async () => {
      try {
        // Create a script element - dynamically set based on environment
        const script = document.createElement('script');
        // We'll load the right SDK depending on what the server tells us (production or sandbox)
        script.src = 'https://web.squarecdn.com/v1/square.js';
        script.async = true;
        script.onload = () => {
          console.log('Square SDK loaded successfully');
          setIsSquareLoaded(true);
        };
        script.onerror = () => {
          console.error('Failed to load Square SDK');
          toast({
            title: 'Error',
            description: 'Failed to load payment system. Please try again later.',
            variant: 'destructive'
          });
        };
        document.body.appendChild(script);
      } catch (error) {
        console.error('Error loading Square SDK:', error);
      }
    };

    loadSquareSdk();

    // Cleanup function to remove the script
    return () => {
      const script = document.querySelector('script[src="https://web.squarecdn.com/v1/square.js"]');
      if (script) {
        document.body.removeChild(script);
      }
    };
  }, [toast]);

  // Initialize Square payment form when SDK is loaded
  useEffect(() => {
    const initializeSquarePayment = async () => {
      if (!isSquareLoaded || !window.Square || !paymentFormRef.current) {
        return;
      }

      try {
        // First, fetch Square application ID from the server
        const appIdResponse = await apiRequest('GET', '/api/square/app-info');
        const appIdData = await appIdResponse.json();

        if (!appIdData.applicationId || !appIdData.locationId) {
          toast({
            title: 'Configuration Error',
            description: 'Payment system is not properly configured.',
            variant: 'destructive'
          });
          return;
        }

        // Initialize Square with the application ID
        const payments = window.Square.payments(appIdData.applicationId, appIdData.locationId);
        
        // Create a card payment method
        const newCard = await payments.card();
        setCard(newCard);
        
        // Attach the card payment method to the form
        await newCard.attach('#card-container');
        setIsPaymentFormReady(true);
      } catch (error) {
        console.error('Error initializing Square payment:', error);
        toast({
          title: 'Payment Error',
          description: 'Could not initialize payment form. Please try again later.',
          variant: 'destructive'
        });
      }
    };

    initializeSquarePayment();
  }, [isSquareLoaded, toast]);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!card || isProcessing) {
      return;
    }

    setIsProcessing(true);

    try {
      // Create a payment request for the listing
      const paymentResponse = await apiRequest('POST', `/api/listings/${listingId}/create-publish-payment`, {
        listingDuration: selectedDuration
      });
      
      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json();
        throw new Error(errorData.message || 'Failed to create payment request');
      }
      
      const paymentData = await paymentResponse.json();
      
      // Get a payment token from Square
      const result = await card.tokenize();
      
      if (result.status === 'OK') {
        // Process the payment with the source ID (payment token)
        const publishResponse = await apiRequest('POST', `/api/listings/${listingId}/publish-with-square`, {
          sourceId: result.token,
          listingDuration: selectedDuration,
          amount: paymentData.amount
        });
        
        if (!publishResponse.ok) {
          const errorData = await publishResponse.json();
          throw new Error(errorData.message || 'Payment processing failed');
        }
        
        const publishData = await publishResponse.json();
        
        if (publishData.success) {
          toast({
            title: 'Payment Successful',
            description: 'Your listing has been published successfully!',
          });
          onPublishSuccess(publishData.listing);
        } else {
          throw new Error(publishData.message || 'Failed to publish listing');
        }
      } else {
        throw new Error(result.errors[0].message || 'Card tokenization failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: 'Payment Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Duration Selection - Consistent with main dialog and credits form */}
      <div className="space-y-4">
        <h4 className="font-medium">Select Listing Duration & Price</h4>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: '3_day', label: '3 Days', price: '$5.00' },
            { value: '7_day', label: '7 Days', price: '$10.00' },
            { value: '30_day', label: '30 Days', price: '$25.00' }
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedDuration(option.value)}
              disabled={isProcessing}
              className={`relative p-4 rounded-lg border-2 text-center transition-all ${
                selectedDuration === option.value
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="font-semibold">{option.label}</div>
              <div className="text-lg font-bold text-blue-600 mt-1">{option.price}</div>
              {selectedDuration === option.value && (
                <div className="absolute top-2 right-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
          <CardDescription>
            Enter your card information to publish your listing for {selectedDuration.replace('_', ' ')}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div id="card-container" ref={paymentFormRef} className="min-h-[100px] p-4 border rounded-md"></div>
            {!isPaymentFormReady && isSquareLoaded && (
              <div className="flex items-center justify-center py-4">
                <Spinner size="md" /> <span className="ml-2">Loading payment form...</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons - Consistent styling */}
      <div className="flex gap-3 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onClose} 
          disabled={isProcessing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isProcessing || !isPaymentFormReady}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isProcessing ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Processing...
            </>
          ) : (
            `Pay ${priceDisplay} & Publish`
          )}
        </Button>
      </div>
    </form>
  );
}

export const PublishPaymentDialog: React.FC<PublishPaymentDialogProps> = ({ 
  isOpen, 
  onClose, 
  listingId, 
  onPublishSuccess 
}) => {
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [userCredits, setUserCredits] = useState<number>(0);
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);
  const [draftListing, setDraftListing] = useState<any>(null);
  const [isLoadingListing, setIsLoadingListing] = useState(true);
  const [activeTab, setActiveTab] = useState<'credits' | 'payment'>('credits');

  // Fetch draft listing information and user credits
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
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
          }

          // Handle credits data
          if (creditsResponse.ok) {
            const creditsData = await creditsResponse.json();
            setUserCredits(creditsData.credits);
            // If user has credits, default to credits tab, otherwise payment tab
            setActiveTab(creditsData.credits > 0 ? 'credits' : 'payment');
          }
        } catch (error) {
          console.error('Error fetching data:', error);
          setActiveTab('payment'); // Default to payment if fetch fails
        } finally {
          setIsLoadingCredits(false);
          setIsLoadingListing(false);
        }
      };

      fetchData();
    }
  }, [isOpen, listingId]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish Your Listing</DialogTitle>
          <DialogDescription>
            Choose how to publish your listing - use credits or make a payment.
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
                  {draftListing.listingDuration && ` (${draftListing.listingDuration.replace('_', ' ')})`}
                </p>
              </div>
            )}

            {/* Tab Selection */}
            <div className="flex space-x-1 bg-muted p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('credits')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'credits'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Use Credits ({userCredits})
              </button>
              <button
                onClick={() => setActiveTab('payment')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'payment'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Make Payment
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'credits' ? (
              <CreditPublishForm
                listingId={listingId}
                onPublishSuccess={onPublishSuccess}
                onClose={onClose}
                draftListing={draftListing}
              />
            ) : (
              <SquarePaymentForm
                listingId={listingId}
                onPublishSuccess={onPublishSuccess}
                onClose={onClose}
                draftListing={draftListing}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PublishPaymentDialog;