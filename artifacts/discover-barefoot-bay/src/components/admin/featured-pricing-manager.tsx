import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

type FeaturedConfig = {
  creditCost: number;
  minCreditCost: number;
  maxCreditCost: number;
};

/**
 * Admin control for the credit price of the Featured listing upgrade.
 * The saved price flows through everywhere the cost is used: the
 * upgrade dialogs on On The Market / listing pages / My Listings,
 * insufficient-credit messages, and the actual credit charge.
 */
export function FeaturedPricingManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [price, setPrice] = useState<string>('');

  const { data: config, isLoading } = useQuery<FeaturedConfig>({
    queryKey: ['/api/featured-listings/config'],
  });

  const minCost = config?.minCreditCost ?? 5;
  const maxCost = config?.maxCreditCost ?? 10000;

  // Seed the input with the current price once loaded.
  useEffect(() => {
    if (config && typeof config.creditCost === 'number') {
      setPrice(String(config.creditCost));
    }
  }, [config?.creditCost]);

  const parsed = Number(price);
  const isValid =
    price !== '' && Number.isSafeInteger(parsed) && parsed >= minCost && parsed <= maxCost;
  const isDirty = config ? price !== String(config.creditCost) : false;

  const saveMutation = useMutation({
    mutationFn: async (creditCost: number) => {
      const res = await apiRequest('PUT', '/api/featured-listings/config', { creditCost });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Failed to update the price');
      return body as { creditCost: number };
    },
    onSuccess: (body) => {
      queryClient.invalidateQueries({ queryKey: ['/api/featured-listings/config'] });
      toast({
        title: 'Featured price updated',
        description: `Featuring a listing now costs ${body.creditCost} credits everywhere on the site.`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Couldn't update the price",
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    if (!isValid || saveMutation.isPending) return;
    saveMutation.mutate(parsed);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          Featured Listing Price
        </CardTitle>
        <CardDescription>
          Set how many credits it costs to upgrade an On The Market listing to Featured. The new
          price applies immediately to upgrade dialogs, balance checks, and charges across the
          site.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 py-6">
            <Spinner size="md" />
            <span>Loading current price...</span>
          </div>
        ) : (
          <div className="space-y-4 max-w-sm">
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-900">
                Current price:{' '}
                <strong>{config?.creditCost ?? '—'} credits</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="featured-price">New price (credits)</Label>
              <Input
                id="featured-price"
                type="number"
                min={minCost}
                max={maxCost}
                step={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
              />
              {!isValid && price !== '' && (
                <p className="text-sm text-destructive">
                  Enter a whole number between {minCost} and {maxCost} credits.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Whole credits only, between {minCost} and {maxCost}.
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={!isValid || !isDirty || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                'Save price'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
