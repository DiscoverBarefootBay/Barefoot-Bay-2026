import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Helmet } from 'react-helmet';
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import confetti from 'canvas-confetti';

export default function SubscriptionSuccessPage() {
  const [, navigate] = useLocation();
  const { user, refetch } = useAuth();
  const [countdown, setCountdown] = useState(5);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Trigger confetti animation
  useEffect(() => {
    // Trigger confetti when component mounts
    const triggerConfetti = () => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    };

    // Trigger immediately and then again after a short delay
    triggerConfetti();
    const confettiTimeout = setTimeout(triggerConfetti, 500);

    return () => clearTimeout(confettiTimeout);
  }, []);

  // Countdown timer and auto-redirect
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setIsRedirecting(true);
          navigate('/subscriptions');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  // Refetch user data to ensure we have the latest subscription info
  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleManualRedirect = () => {
    setIsRedirecting(true);
    navigate('/subscriptions');
  };

  return (
    <>
      <Helmet>
        <title>Subscription Success | Barefoot Bay</title>
      </Helmet>
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-700">
              Subscription Successful!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="text-lg font-medium">
                Thank you for your premium sponsorship!
              </p>
              <p className="text-muted-foreground">
                Your payment has been processed successfully and your account has been upgraded.
              </p>
            </div>

            {user && user.subscriptionType && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">Subscription Details</h3>
                <div className="text-sm space-y-1 text-green-700">
                  <p><strong>Plan:</strong> {user.subscriptionType === 'monthly' ? 'Monthly' : 'Annual'} Membership</p>
                  <p><strong>Status:</strong> Active</p>
                  {user.subscriptionEndDate && (
                    <p><strong>Next Billing:</strong> {new Date(user.subscriptionEndDate).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Redirecting to your subscription page in {countdown} seconds...
              </div>
              
              <Button 
                onClick={handleManualRedirect}
                className="w-full"
                disabled={isRedirecting}
              >
                {isRedirecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    Go to Subscriptions
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                You now have access to all premium features and content.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}