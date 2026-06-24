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
import { Loader2, AlertCircle, CheckCircle, Calendar, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function UserSubscriptionManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('monthly');

  // Query to fetch subscription status from the API
  const { 
    data: subscription,
    isLoading: isLoadingSubscription,
    error: subscriptionError 
  } = useQuery({
    queryKey: ['/api/subscriptions/status'],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/subscriptions/status');
        // Ensure we have valid response structure even if backend returns partial data
        return {
          success: response?.success || false,
          message: response?.message || 'Unknown status',
          subscription: response?.subscription || {
            subscriptionId: null,
            type: null,
            status: null,
            startDate: null,
            endDate: null
          }
        };
      } catch (error) {
        console.error('Failed to fetch subscription status:', error);
        throw error;
      }
    },
    // Don't retry on 401 Unauthorized responses
    retry: (failureCount, error: any) => {
      if (error?.status === 401) return false;
      return failureCount < 3;
    }
  });

  // Mutation to create a new subscription with Square
  const createSubscriptionMutation = useMutation({
    mutationFn: (planType: string) => 
      apiRequest('/api/subscriptions/create-checkout', {
        method: 'POST',
        data: { planType }
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/check'] });
      
      if (data.checkoutUrl) {
        // Redirect to Square checkout URL
        window.location.href = data.checkoutUrl;
      } else {
        // If no checkout URL, show an error
        toast({
          title: 'Subscription Error',
          description: 'Could not create Square checkout session',
          variant: 'destructive',
        });
      }
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
      apiRequest('/api/subscriptions/cancel', {
        method: 'POST'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/check'] });
      toast({
        title: 'Subscription Cancelled',
        description: 'Your subscription has been cancelled. Your membership benefits will remain active until the current billing period ends.',
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
      case 'monthly':
        return { amount: '$5', period: 'month' };
      case 'annual':
        return { amount: '$50', period: 'year' };
      default:
        return { amount: 'Unknown', period: 'Unknown' };
    }
  };

  // Handle subscription creation
  const handleCreateSubscription = () => {
    createSubscriptionMutation.mutate(selectedPlan);
  };

  // If loading, show loading state
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

  // If user has an active subscription, show the details
  if (subscription?.success && subscription?.subscription?.subscriptionId) {
    const userSubscription = subscription.subscription;
    // Get pricing info for current subscription
    const subscriptionType = userSubscription.type || 'unknown';
    const priceInfo = getPriceInfo(subscriptionType);
    const status = userSubscription.status || 'unknown';

    // Display active subscription details
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              Premium Membership
            </CardTitle>
            <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">
              {status === 'active' ? 'Active' : 
               status === 'cancelled' ? 'Cancelling' : 
               status}
            </Badge>
          </div>
          <CardDescription>
            Your premium membership gives you access to exclusive features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-md">
              <div className="flex justify-between">
                <div>
                  <p className="font-medium">
                    {subscriptionType.charAt(0).toUpperCase() + subscriptionType.slice(1)} Plan
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {priceInfo.amount} per {priceInfo.period}
                  </p>
                </div>
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium">Next Billing Date</p>
                    <p className="text-muted-foreground">
                      {userSubscription.endDate ? formatDate(userSubscription.endDate) : 'Not available'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Premium Benefits:</h3>
              <ul className="text-sm space-y-1">
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  Access to exclusive community content
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  Additional posting privileges
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  Recognition as a premium community member
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  Special event invitations
                </li>
              </ul>
            </div>
            
            {status === 'cancelled' && (
              <div className="bg-yellow-50 p-3 rounded-md text-sm text-yellow-800">
                <p className="font-medium">Your subscription has been cancelled.</p>
                <p>
                  You'll continue to have premium access until 
                  {userSubscription.endDate ? ` ${formatDate(userSubscription.endDate)}` : ' the end of your billing period'}.
                </p>
              </div>
            )}
          </div>
        </CardContent>
        {status === 'active' && (
          <CardFooter className="flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">Cancel Membership</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cancelling your membership will stop automatic renewals, but your premium benefits 
                    will remain active until 
                    {userSubscription.endDate ? ` ${formatDate(userSubscription.endDate)}` : ' the end of your billing period'}. 
                    After that, you'll return to your previous membership level.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Membership</AlertDialogCancel>
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
        )}
      </Card>
    );
  }

  // Show subscription signup UI
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upgrade to Premium</CardTitle>
        <CardDescription>
          Support our community and get access to exclusive features with a premium membership
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Premium Benefits:</h3>
            <ul className="text-sm space-y-1">
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Access to exclusive community content
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Additional posting privileges
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Recognition as a premium community member
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Special event invitations
              </li>
            </ul>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4">
            <Card className={`flex-1 cursor-pointer border-2 ${selectedPlan === 'monthly' ? 'border-primary' : 'border-border'}`}
                  onClick={() => setSelectedPlan('monthly')}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Monthly
                  {selectedPlan === 'monthly' && <CheckCircle className="h-5 w-5 text-primary" />}
                </CardTitle>
                <CardDescription>
                  <span className="text-xl font-bold">$5</span> / month
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">Flexible monthly billing</p>
              </CardContent>
            </Card>
            
            <Card className={`flex-1 cursor-pointer border-2 ${selectedPlan === 'annual' ? 'border-primary' : 'border-border'}`}
                  onClick={() => setSelectedPlan('annual')}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Annual
                  {selectedPlan === 'annual' && <CheckCircle className="h-5 w-5 text-primary" />}
                </CardTitle>
                <CardDescription>
                  <span className="text-xl font-bold">$50</span> / year
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">Save $10 with annual billing</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-center space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          <Button 
            className="w-full" 
            onClick={() => {
              setSelectedPlan('monthly');
              handleCreateSubscription();
            }}
            disabled={createSubscriptionMutation.isPending}
          >
            {createSubscriptionMutation.isPending && selectedPlan === 'monthly' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Monthly Membership ($5)'
            )}
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setSelectedPlan('annual');
              handleCreateSubscription();
            }}
            disabled={createSubscriptionMutation.isPending}
          >
            {createSubscriptionMutation.isPending && selectedPlan === 'annual' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Annual Membership ($50)'
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Membership payments are processed securely through Square
        </p>
      </CardFooter>
    </Card>
  );
}