import React, { useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Spinner } from '@/components/ui/spinner';
import { Star } from 'lucide-react';
import { type RealEstateListing } from '@shared/schema';

interface FeaturedInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  listing: RealEstateListing;
  /** True when the viewer owns the listing or is an admin — enables Remove Featured */
  canUnfeature: boolean;
  onUnfeatureSuccess?: (listing: RealEstateListing) => void;
}

/**
 * Shown when someone clicks the "★ Featured" badge on a featured listing.
 * Explains what Featured means; owners and admins can also remove the
 * featured status from here (no credits are refunded).
 */
export const FeaturedInfoDialog: React.FC<FeaturedInfoDialogProps> = ({
  isOpen,
  onClose,
  listing,
  canUnfeature,
  onUnfeatureSuccess,
}) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const featuredAt = listing.featuredAt ? new Date(listing.featuredAt) : null;
  const expirationDate = listing.expirationDate ? new Date(listing.expirationDate) : null;

  const handleUnfeature = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const response = await apiRequest('POST', `/api/listings/${listing.id}/unfeature`, {});
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || 'Failed to remove featured status');
      }
      toast({
        title: 'Featured status removed',
        description: 'The listing is no longer featured.',
      });
      onUnfeatureSuccess?.(body.listing);
      onClose();
    } catch (error) {
      console.error('Error unfeaturing listing:', error);
      toast({
        title: 'Could not remove featured status',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setConfirming(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setConfirming(false); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Featured Listing
          </DialogTitle>
          <DialogDescription>
            Featured listings are pinned to the top of On The Market with a gold border and
            Featured badge, and appear first in the weekly email. Featured status lasts until
            the listing expires.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-1">
          <p className="text-sm text-yellow-900">
            <strong>{listing.title}</strong>
          </p>
          {featuredAt && (
            <p className="text-sm text-yellow-800">
              Featured since {format(featuredAt, 'MMMM d, yyyy')}
            </p>
          )}
          {expirationDate && (
            <p className="text-sm text-yellow-800">
              Featured until the listing expires on {format(expirationDate, 'MMMM d, yyyy')}
            </p>
          )}
        </div>

        {canUnfeature && (
          confirming ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Remove featured status? The listing will lose its priority placement, and the
                credits spent on featuring are not refunded.
              </p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={isProcessing}
                  onClick={() => setConfirming(false)}
                >
                  Keep Featured
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  disabled={isProcessing}
                  onClick={handleUnfeature}
                >
                  {isProcessing ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Removing...
                    </>
                  ) : (
                    'Remove Featured'
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Close
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => setConfirming(true)}
              >
                Remove Featured
              </Button>
            </div>
          )
        )}
        {!canUnfeature && (
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FeaturedInfoDialog;
