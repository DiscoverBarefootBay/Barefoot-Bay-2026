import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

type SquareStatus = {
  status: string;
  squareStatus: {
    initialized: boolean;
    hasCheckoutApi: boolean;
    hasLocationsApi: boolean;
    hasEnvironmentVars: {
      accessToken: boolean;
      applicationId: boolean;
      locationId: boolean;
    }
  };
  environmentInfo: {
    nodeEnv: string;
    publicUrl: string;
    hasSquareAccessToken: boolean;
    hasSquareApplicationId: boolean;
    hasSquareLocationId: boolean;
  };
  apiConnectionStatus?: {
    connected: boolean;
    error: string | null;
    message: string;
  };
};

export default function SquareStatusChecker() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SquareStatus | null>(null);
  
  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use fetch directly for better error handling in this diagnostic component
      const response = await fetch('/api/payments/square-status');
      
      if (!response.ok) {
        throw new Error(`Failed to check Square status: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setStatus(data);
      console.log('Square status:', data);
    } catch (err) {
      console.error('Error checking Square status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check Square status');
    } finally {
      setLoading(false);
    }
  };
  
  const StatusIndicator = ({ value, label }: { value: boolean; label: string }) => (
    <div className="flex items-center gap-2">
      {value ? (
        <CheckCircle2 className="text-green-500" size={18} />
      ) : (
        <XCircle className="text-red-500" size={18} />
      )}
      <span>{label}</span>
    </div>
  );
  
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Square Payment Integration Status</CardTitle>
        <CardDescription>
          Check the status of the Square payment integration and configuration
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button 
            onClick={checkStatus}
            disabled={loading}
            variant="outline"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Check Status
          </Button>
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {status && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Square Client Status</h3>
                <StatusIndicator 
                  value={status.squareStatus.initialized} 
                  label="Client Initialized" 
                />
                <StatusIndicator 
                  value={status.squareStatus.hasCheckoutApi} 
                  label="Checkout API Available" 
                />
                <StatusIndicator 
                  value={status.squareStatus.hasLocationsApi} 
                  label="Locations API Available" 
                />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Environment Variables</h3>
                <StatusIndicator 
                  value={status.environmentInfo.hasSquareAccessToken} 
                  label="Access Token Present" 
                />
                <StatusIndicator 
                  value={status.environmentInfo.hasSquareApplicationId} 
                  label="Application ID Present" 
                />
                <StatusIndicator 
                  value={status.environmentInfo.hasSquareLocationId} 
                  label="Location ID Present" 
                />
              </div>
            </div>
            
            {status.apiConnectionStatus && (
              <div className="pt-2 border-t">
                <h3 className="text-sm font-medium mb-2">API Connection Status</h3>
                <StatusIndicator 
                  value={status.apiConnectionStatus.connected} 
                  label="Direct API Connection" 
                />
                {status.apiConnectionStatus.error && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertTitle>API Connection Error</AlertTitle>
                    <AlertDescription className="break-all">
                      {status.apiConnectionStatus.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
            
            <div className="pt-2 border-t">
              <h3 className="text-sm font-medium mb-2">Environment Info</h3>
              <div className="text-sm">
                <p><strong>Node Environment:</strong> {status.environmentInfo.nodeEnv}</p>
                <p><strong>Public URL:</strong> {status.environmentInfo.publicUrl}</p>
              </div>
            </div>
            
            {!status.squareStatus.initialized && (
              <Alert>
                <AlertTitle>Square client is not properly initialized</AlertTitle>
                <AlertDescription>
                  Please check the required environment variables and ensure they are properly set.
                </AlertDescription>
              </Alert>
            )}
            
            {status.apiConnectionStatus && !status.apiConnectionStatus.connected && (
              <Alert variant="destructive">
                <AlertTitle>Square API Connection Problem</AlertTitle>
                <AlertDescription>
                  The server cannot connect to the Square API. This is typically caused by:
                  <ul className="list-disc ml-6 mt-2">
                    <li>Invalid credentials (401 Unauthorized)</li>
                    <li>Expired access token</li>
                    <li>Incorrect access permission scopes</li>
                    <li>Using production credentials in sandbox mode (or vice versa)</li>
                  </ul>
                  Please update your Square API credentials.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}