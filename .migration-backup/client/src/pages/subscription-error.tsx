import React from 'react';
import { useLocation } from 'wouter';
import { Helmet } from 'react-helmet';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SubscriptionErrorPage() {
  const [, navigate] = useLocation();
  
  // Get error message from URL params
  const searchParams = new URLSearchParams(window.location.search);
  const errorMessage = searchParams.get('message') || 'An unexpected error occurred during payment processing.';

  const handleRetry = () => {
    navigate('/subscriptions');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <>
      <Helmet>
        <title>Subscription Error | Barefoot Bay</title>
      </Helmet>
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl text-red-700">
              Payment Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="text-lg font-medium">
                We encountered an issue processing your subscription
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">
                  {errorMessage}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Don't worry - no charges have been made to your account. You can try again or contact support if the issue persists.
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
                Need help? Contact our support team for assistance.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}