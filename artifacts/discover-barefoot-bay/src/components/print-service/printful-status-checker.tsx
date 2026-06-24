import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Package } from 'lucide-react';

type PrintfulStatus = {
  code: number;
  result: {
    connected: boolean;
    apiKeyValid: boolean;
    storeInfoAvailable: boolean;
    catalogAvailable: boolean;
    hasProducts: boolean;
    productCount: number;
    stores: Array<{
      id: number;
      name: string;
      type: string;
    }>;
    storeId: string;
    catalogItemCount: number;
    errors: {
      storeInfo?: string;
      catalog?: string;
      storeProducts?: string;
    };
    setupGuide: string;
    error?: string;
  };
};

export default function PrintfulStatusChecker() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PrintfulStatus | null>(null);
  
  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use fetch directly for better error handling in this diagnostic component
      const response = await fetch('/api/printful/test');
      
      if (!response.ok) {
        throw new Error(`Failed to check Printful status: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setStatus(data);
      console.log('Printful status:', data);
    } catch (err) {
      console.error('Error checking Printful status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check Printful status');
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
        <CardTitle className="flex items-center">
          <Package className="h-5 w-5 mr-2" />
          Printful Integration Status
        </CardTitle>
        <CardDescription>
          Check the status of the Printful print-on-demand service integration
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
                <h3 className="text-sm font-medium">Connection Status</h3>
                <StatusIndicator 
                  value={status.result.connected} 
                  label="API Connected" 
                />
                <StatusIndicator 
                  value={status.result.storeInfoAvailable} 
                  label="Store Information Available" 
                />
                <StatusIndicator 
                  value={status.result.catalogAvailable} 
                  label="Product Catalog Available" 
                />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Store Information</h3>
                <p><strong>Store ID:</strong> {status.result.storeId}</p>
                {status.result.stores.length > 0 && (
                  <p><strong>Store Name:</strong> {status.result.stores[0].name}</p>
                )}
                {status.result.hasProducts && (
                  <p><strong>Published Products:</strong> {status.result.productCount}</p>
                )}
                {status.result.catalogItemCount > 0 && (
                  <p><strong>Catalog Items:</strong> {status.result.catalogItemCount}</p>
                )}
              </div>
            </div>
            
            {status.result.hasProducts && (
              <div className="pt-2 border-t">
                <h3 className="text-sm font-medium mb-2">Store Products</h3>
                <p>
                  Your store has <strong>{status.result.productCount}</strong> published product{status.result.productCount !== 1 ? 's' : ''} ready for sale.
                </p>
              </div>
            )}
            
            {status.result.setupGuide && (
              <Alert>
                <AlertTitle>Setup Information</AlertTitle>
                <AlertDescription className="break-all">
                  {status.result.setupGuide}
                </AlertDescription>
              </Alert>
            )}
            
            {(status.result.errors.storeInfo || status.result.errors.catalog) && (
              <Alert variant="destructive">
                <AlertTitle>Limited API Permissions</AlertTitle>
                <AlertDescription>
                  Some Printful features require additional API permissions:
                  <ul className="list-disc ml-6 mt-2">
                    {status.result.errors.storeInfo && (
                      <li>Store Information: {status.result.errors.storeInfo}</li>
                    )}
                    {status.result.errors.catalog && (
                      <li>Product Catalog: {status.result.errors.catalog}</li>
                    )}
                  </ul>
                  Contact Printful support to request additional API scopes for full functionality.
                </AlertDescription>
              </Alert>
            )}
            
            {status.result.error && (
              <Alert variant="destructive">
                <AlertTitle>API Connection Error</AlertTitle>
                <AlertDescription className="break-all">
                  {status.result.error}
                </AlertDescription>
              </Alert>
            )}
            
            {!status.result.connected && (
              <Alert variant="destructive">
                <AlertTitle>Printful API Connection Problem</AlertTitle>
                <AlertDescription>
                  The server cannot connect to the Printful API. This is typically caused by:
                  <ul className="list-disc ml-6 mt-2">
                    <li>Invalid API key</li>
                    <li>Expired API key</li>
                    <li>Restricted API permissions</li>
                    <li>Printful service disruption</li>
                  </ul>
                  Please update your Printful API key in the settings below.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}