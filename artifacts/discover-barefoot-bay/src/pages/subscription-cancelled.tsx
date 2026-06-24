import React from 'react';
import { useLocation } from 'wouter';
import { Helmet } from 'react-helmet';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SubscriptionCancelledPage() {
  const [, navigate] = useLocation();

  const handleRetry = () => {
    navigate('/subscriptions');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <>
      <Helmet>
        <title>Subscription Cancelled | Barefoot Bay</title>
      </Helmet>
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4 w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <CardTitle className="text-2xl text-yellow-700">
              Payment Cancelled
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="text-lg font-medium">
                Your subscription payment was cancelled
              </p>
              <p className="text-muted-foreground">
                No charges have been made to your account. You can try again whenever you're ready.
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-700">
                Your account remains unchanged. Premium features require an active subscription.
              </p>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleRetry}
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              
              <Button 
                onClick={handleGoHome}
                variant="outline"
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return Home
              </Button>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Questions about our premium membership? Contact our support team.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}