import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, AlertCircle, CheckCircle, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type SubscriptionManagerProps = {
  listingId: number;
  subscriptionId: string | null;
};

export default function SubscriptionManager({ listingId, subscriptionId }: SubscriptionManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('MONTHLY');

  // Query to fetch subscription details if a subscription exists
  const { 
    data: subscription,
    isLoading: isLoadingSubscription,
    error: subscriptionError 
  } = useQuery({
    queryKey: ['/api/subscriptions', subscriptionId],
    queryFn: () => apiRequest(`/api/subscriptions/${subscriptionId}`, { method: 'GET' }),
    enabled: !!subscriptionId,
  });

  // Mutation to create a new subscription for this listing
  const createSubscriptionMutation = useMutation({
    mutationFn: (planType: string) => 
      apiRequest(`/api/listings/${listingId}/convert-to-subscription`, {
        method: 'POST',
        data: { planType }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/listings', listingId] });
      toast({
        title: 'Subscription Created',
        description: `Your listing has been converted to a ${selectedPlan.toLowerCase()} subscription plan.`,
        variant: 'default',
      });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Subscription Error',
        description: `Failed to create subscription: ${error.message}`,
        variant: 'destructive',
      });
    }
  });

  // Mutation to cancel an existing subscription
  const cancelSubscriptionMutation = useMutation({
    mutationFn: () => 
      apiRequest(`/api/subscriptions/${subscriptionId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/listings', listingId] });
      toast({
        title: 'Subscription Cancelled',
        description: 'Your subscription has been cancelled. Your listing will remain active until the current billing period ends.',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Cancellation Error',
        description: `Failed to cancel subscription: ${error.message}`,
        variant: 'destructive',
      });
    }
  });

  // Format the next billing date
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Get pricing info based on plan
  const getPriceInfo = (plan: string) => {
    switch (plan) {
      case 'MONTHLY':
        return { amount: '$45', period: 'month' };
      case 'QUARTERLY':
        return { amount: '$120', period: '3 months' };
      default:
        return { amount: 'Unknown', period: 'Unknown' };
    }
  };

  // Handle subscription creation
  const handleCreateSubscription = () => {
    createSubscriptionMutation.mutate(selectedPlan);
  };

  // If this listing doesn't have a subscription, show the subscription creation UI
  if (!subscriptionId) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Enable Auto-Renewal</CardTitle>
          <CardDescription>
            Keep your listing active by subscribing to an auto-renewal plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm">
              Your listing will expire after 30 days. Subscribe to keep it active automatically.
            </p>
            <div className="flex flex-col md:flex-row gap-4 mt-4">
              <Card className={`flex-1 cursor-pointer border-2 ${selectedPlan === 'MONTHLY' ? 'border-primary' : 'border-border'}`}
                    onClick={() => setSelectedPlan('MONTHLY')}>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    Monthly
                    {selectedPlan === 'MONTHLY' && <CheckCircle className="h-5 w-5 text-primary" />}
                  </CardTitle>
                  <CardDescription>
                    <span className="text-xl font-bold">$45</span> / month
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">Automatic monthly renewal</p>
                </CardContent>
              </Card>
              
              <Card className={`flex-1 cursor-pointer border-2 ${selectedPlan === 'QUARTERLY' ? 'border-primary' : 'border-border'}`}
                    onClick={() => setSelectedPlan('QUARTERLY')}>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    Quarterly
                    {selectedPlan === 'QUARTERLY' && <CheckCircle className="h-5 w-5 text-primary" />}
                  </CardTitle>
                  <CardDescription>
                    <span className="text-xl font-bold">$120</span> / 3 months
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">Save $15 with quarterly billing</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button>Subscribe Now</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Subscription</AlertDialogTitle>
                <AlertDialogDescription>
                  You are about to subscribe to the {selectedPlan.toLowerCase()} plan at 
                  {getPriceInfo(selectedPlan).amount} per {getPriceInfo(selectedPlan).period}. 
                  Your listing will automatically renew until you cancel.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleCreateSubscription}
                  disabled={createSubscriptionMutation.isPending}>
                  {createSubscriptionMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Subscribe'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    );
  }

  // Show loading state while fetching subscription details
  if (isLoadingSubscription) {
    return (
      <Card className="w-full">
        <CardContent className="py-6 flex justify-center items-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <span>Loading subscription details...</span>
        </CardContent>
      </Card>
    );
  }

  // Show error state if there's an issue fetching subscription details
  if (subscriptionError) {
    return (
      <Card className="w-full">
        <CardContent className="py-6">
          <div className="flex items-center text-destructive mb-2">
            <AlertCircle className="h-5 w-5 mr-2" />
            <p className="font-medium">Error loading subscription</p>
          </div>
          <p className="text-sm text-muted-foreground">
            There was a problem loading your subscription details. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get pricing info for current subscription
  const priceInfo = getPriceInfo(subscription?.planType || 'UNKNOWN');

  // Display active subscription details
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          Active Subscription
        </CardTitle>
        <CardDescription>
          Your listing will automatically renew
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-md">
            <div className="flex justify-between">
              <div>
                <p className="font-medium">{subscription?.planType?.toLowerCase() || 'Unknown'} Plan</p>
                <p className="text-sm text-muted-foreground">
                  {priceInfo.amount} per {priceInfo.period}
                </p>
              </div>
              <div className="flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-muted-foreground" />
                <div className="text-sm">
                  <p className="font-medium">Next Billing Date</p>
                  <p className="text-muted-foreground">{formatDate(subscription?.nextBillingDate)}</p>
                </div>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm">
              Your subscription will automatically renew on {formatDate(subscription?.nextBillingDate)}. 
              You can cancel anytime.
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">Cancel Subscription</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                Cancelling your subscription will stop automatic renewals, but your listing 
                will remain active until {formatDate(subscription?.nextBillingDate)}. After that, 
                it will be marked as expired.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => cancelSubscriptionMutation.mutate()}
                disabled={cancelSubscriptionMutation.isPending}
                className="bg-destructive hover:bg-destructive/90">
                {cancelSubscriptionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Yes, Cancel'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}