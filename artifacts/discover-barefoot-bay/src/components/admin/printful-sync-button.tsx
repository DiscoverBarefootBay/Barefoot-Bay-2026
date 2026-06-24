import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';

/**
 * Button component that synchronizes Printful products with the local database
 * This should only be shown to admins in the product management interface
 */
export function PrintfulSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState<number | null>(null);
  const { toast } = useToast();

  // Trigger the sync process
  const handleSync = async () => {
    if (syncing) return;
    
    setSyncing(true);
    setSyncCount(null);
    
    try {
      const response = await apiRequest('POST', '/api/printful/sync')
        .then(res => res.json()) as {
          success: boolean;
          message: string;
          syncedCount: number;
        };
      
      if (response && response.success) {
        setSyncCount(response.syncedCount);
        toast({
          title: 'Products Synchronized',
          description: `Successfully synced ${response.syncedCount} products from Printful to the local database.`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Sync Failed',
          description: (response && response.message) || 'Failed to sync products from Printful.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error syncing Printful products:', error);
      toast({
        title: 'Sync Error',
        description: 'An error occurred while syncing products from Printful.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 mb-4">
      <Button 
        onClick={handleSync} 
        disabled={syncing}
        className="w-full"
      >
        {syncing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Syncing Products...
          </>
        ) : (
          <>Sync Products from Printful</>
        )}
      </Button>
      
      {syncCount !== null && (
        <p className="text-sm text-muted-foreground">
          {syncCount} products successfully synced from Printful.
        </p>
      )}
      
      <p className="text-xs text-muted-foreground mt-1">
        This will fetch all products from your Printful store and add them to the local database
        so they can be displayed in the storefront.
      </p>
    </div>
  );
}