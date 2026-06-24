import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import SquareStatusChecker from '@/components/real-estate/square-status-checker';
import { apiRequest } from '@/lib/queryClient';

export default function PaymentDiagnostics() {
  const [activeTab, setActiveTab] = useState('system');
  const [paymentLinkId, setPaymentLinkId] = useState('');
  const [subscriptionLinkId, setSubscriptionLinkId] = useState('');
  
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  
  const [subVerifyLoading, setSubVerifyLoading] = useState(false);
  const [subVerifyError, setSubVerifyError] = useState<string | null>(null);
  const [subVerifyResult, setSubVerifyResult] = useState<any>(null);
  
  // Verify regular payment
  const verifyPayment = async () => {
    if (!paymentLinkId) {
      setVerifyError('Please enter a payment link ID');
      return;
    }
    
    setVerifyLoading(true);
    setVerifyError(null);
    setVerifyResult(null);
    
    try {
      const result = await apiRequest('/api/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ paymentLinkId })
      });
      
      setVerifyResult(result);
      console.log('Payment verification result:', result);
    } catch (err) {
      console.error('Error verifying payment:', err);
      setVerifyError(err instanceof Error ? err.message : 'Failed to verify payment');
    } finally {
      setVerifyLoading(false);
    }
  };
  
  // Verify subscription payment
  const verifySubscription = async () => {
    if (!subscriptionLinkId) {
      setSubVerifyError('Please enter a subscription payment link ID');
      return;
    }
    
    setSubVerifyLoading(true);
    setSubVerifyError(null);
    setSubVerifyResult(null);
    
    try {
      const result = await apiRequest('/api/subscriptions/verify', {
        method: 'POST',
        body: JSON.stringify({ paymentLinkId: subscriptionLinkId })
      });
      
      setSubVerifyResult(result);
      console.log('Subscription verification result:', result);
    } catch (err) {
      console.error('Error verifying subscription:', err);
      setSubVerifyError(err instanceof Error ? err.message : 'Failed to verify subscription');
    } finally {
      setSubVerifyLoading(false);
    }
  };
  
  // Format JSON data for display
  const formatJson = (data: any) => {
    return JSON.stringify(data, null, 2);
  };
  
  return (
    <div className="container mx-auto py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Payment System Diagnostics</h1>
        <p className="text-muted-foreground">
          Test and troubleshoot payment integration and verification
        </p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="system">System Status</TabsTrigger>
          <TabsTrigger value="payment">Payment Verification</TabsTrigger>
          <TabsTrigger value="subscription">Subscription Verification</TabsTrigger>
        </TabsList>
        
        <TabsContent value="system" className="space-y-4 mt-4">
          <SquareStatusChecker />
          
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>
                General information about the payment system configuration
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Environment</h3>
                <div className="text-sm space-y-1">
                  <p>
                    <strong>Node Environment:</strong> {import.meta.env.VITE_NODE_ENV || 'development'}
                  </p>
                  <p>
                    <strong>API Mode:</strong> {import.meta.env.MODE === 'production' ? 'Production' : 'Development'}
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-medium mb-2">Verification Endpoints</h3>
                <div className="text-sm space-y-1">
                  <p>
                    <strong>Regular Payments:</strong> /api/payments/verify
                  </p>
                  <p>
                    <strong>Subscription Payments:</strong> /api/subscriptions/verify
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="payment" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Verification Test</CardTitle>
              <CardDescription>
                Test the payment verification process for one-time payments
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment-link-id">Payment Link ID</Label>
                <Input
                  id="payment-link-id"
                  placeholder="Enter a payment link ID to verify"
                  value={paymentLinkId}
                  onChange={(e) => setPaymentLinkId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This is the Square payment intent ID that would be returned after checkout
                </p>
              </div>
              
              <Button 
                onClick={verifyPayment}
                disabled={verifyLoading}
              >
                {verifyLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify Payment
              </Button>
              
              {verifyError && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{verifyError}</AlertDescription>
                </Alert>
              )}
              
              {verifyResult && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {verifyResult.isCompleted ? (
                      <CheckCircle className="text-green-500" size={18} />
                    ) : (
                      <XCircle className="text-yellow-500" size={18} />
                    )}
                    <span className="font-medium">
                      {verifyResult.isCompleted 
                        ? 'Payment verified successfully' 
                        : 'Payment verification pending'}
                    </span>
                  </div>
                  
                  <Alert>
                    <AlertTitle>Verification Result</AlertTitle>
                    <AlertDescription>
                      <pre className="mt-2 w-full max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-white">
                        {formatJson(verifyResult)}
                      </pre>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="subscription" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Verification Test</CardTitle>
              <CardDescription>
                Test the subscription payment verification process
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subscription-link-id">Subscription Payment Link ID</Label>
                <Input
                  id="subscription-link-id"
                  placeholder="Enter a subscription payment link ID to verify"
                  value={subscriptionLinkId}
                  onChange={(e) => setSubscriptionLinkId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This is the Square payment intent ID for a subscription payment
                </p>
              </div>
              
              <Button 
                onClick={verifySubscription}
                disabled={subVerifyLoading}
              >
                {subVerifyLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify Subscription
              </Button>
              
              {subVerifyError && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{subVerifyError}</AlertDescription>
                </Alert>
              )}
              
              {subVerifyResult && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {subVerifyResult.isCompleted ? (
                      <CheckCircle className="text-green-500" size={18} />
                    ) : (
                      <XCircle className="text-yellow-500" size={18} />
                    )}
                    <span className="font-medium">
                      {subVerifyResult.isCompleted 
                        ? 'Subscription verified successfully' 
                        : 'Subscription verification pending'}
                    </span>
                  </div>
                  
                  <Alert>
                    <AlertTitle>Verification Result</AlertTitle>
                    <AlertDescription>
                      <pre className="mt-2 w-full max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-white">
                        {formatJson(subVerifyResult)}
                      </pre>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}