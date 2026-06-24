import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Check, AlertCircle, Package, Loader2, FileText, ExternalLink, RefreshCw, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function PrintfulIntegration() {
  const [showCatalog, setShowCatalog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Test Printful connection 
  const { 
    data: connectionStatus, 
    isLoading: testingConnection, 
    isError: connectionError,
    refetch: retestConnection
  } = useQuery({
    queryKey: ['/api/printful/test'],
    enabled: true, // Auto-fetch on component mount
  });
  
  // Fetch product catalog (conditionally)
  const {
    data: catalog,
    isLoading: loadingCatalog,
    isError: catalogError,
  } = useQuery({
    queryKey: ['/api/printful/catalog'],
    enabled: showCatalog, // Only fetch when user clicks to view catalog
  });
  
  // Manual order status check mutation
  const checkOrdersMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/printful/check-orders', { method: 'POST' });
    },
    onSuccess: (data) => {
      toast({
        title: "Order Status Check Complete",
        description: data.message || `Updated ${data.updatedCount || 0} orders.`,
      });
      
      // Invalidate any relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
    onError: (error) => {
      console.error("Error checking order statuses:", error);
      toast({
        title: "Order Status Check Failed",
        description: "Failed to check order statuses. See console for details.",
        variant: "destructive",
      });
    }
  });
  
  // Run all scheduled tasks mutation
  const runScheduledTasksMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/printful/run-scheduled-tasks', { method: 'POST' });
    },
    onSuccess: (data) => {
      toast({
        title: "Scheduled Tasks Completed",
        description: data.message || "All scheduled tasks have been run successfully.",
      });
      
      // Invalidate any relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
    onError: (error) => {
      console.error("Error running scheduled tasks:", error);
      toast({
        title: "Scheduled Tasks Failed",
        description: "Failed to run scheduled tasks. See console for details.",
        variant: "destructive",
      });
    }
  });
  
  // Check if API key is valid and connection is working
  const isConnected = connectionStatus?.result?.connected === true;
  const apiKeyValid = connectionStatus?.result?.apiKeyValid === true;
  const hasStores = connectionStatus?.result?.stores && connectionStatus.result.stores.length > 0;
  const catalogItemCount = connectionStatus?.result?.catalogItemCount || 0;
  const setupGuide = connectionStatus?.result?.setupGuide;
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Printful API Connection</CardTitle>
          <CardDescription>
            Connect to Printful's print-on-demand service to offer custom merchandise in your store.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {testingConnection ? (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Testing connection to Printful API...</span>
            </div>
          ) : connectionError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Connection Error</AlertTitle>
              <AlertDescription>
                Failed to connect to Printful API. Please check your API key and try again.
              </AlertDescription>
            </Alert>
          ) : isConnected ? (
            <div className="flex items-start space-x-2">
              <div className="bg-green-50 p-2 rounded-full dark:bg-green-900/20">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-2">
                <div>
                  <h4 className="font-semibold">Connected to Printful API</h4>
                  <p className="text-sm text-muted-foreground">
                    API Key: Valid and working
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Product Catalog: {catalogItemCount} items available
                  </p>
                </div>
                
                {hasStores ? (
                  <div>
                    <h4 className="font-semibold">Store Information</h4>
                    <p className="text-sm text-muted-foreground">
                      {connectionStatus.result.stores.length} store(s) connected
                    </p>
                    {connectionStatus.result.stores.map((store: any, index: number) => (
                      <div key={index} className="text-sm">
                        <p className="font-medium">{store.name || "Unnamed Store"}</p>
                        {store.website && (
                          <p className="text-xs text-muted-foreground">
                            Website: {store.website}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Store ID: {store.id}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Printful Store Connected</AlertTitle>
                    <AlertDescription>
                      Your API key is valid, but no stores are connected. Please create a store in your Printful account 
                      or follow the setup guide to configure your store correctly.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Not Connected</AlertTitle>
              <AlertDescription>
                The Printful API key may be missing or invalid. Check your environment variables.
              </AlertDescription>
            </Alert>
          )}

          {setupGuide && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
              <div className="flex items-center mb-2">
                <FileText className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                <h4 className="font-semibold text-blue-600 dark:text-blue-400">Setup Guide Available</h4>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                We've created a detailed guide to help you set up your Printful store and configure it to work with the Barefoot Bay community website.
              </p>
              <Button 
                variant="link" 
                className="px-0 mt-2 text-blue-600 dark:text-blue-400 font-semibold"
                onClick={() => window.open('/PRINTFUL_SETUP_GUIDE.md', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Setup Guide
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between pt-2">
          <Button 
            variant="outline" 
            onClick={() => retestConnection()}
            disabled={testingConnection}
          >
            {testingConnection ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
          
          <Button
            onClick={() => setShowCatalog(prev => !prev)}
            disabled={!apiKeyValid || testingConnection}
          >
            <Package className="h-4 w-4 mr-2" />
            {showCatalog ? "Hide Catalog" : "View Product Catalog"}
          </Button>
        </CardFooter>
      </Card>
      
      {/* Order Status Management */}
      <Card>
        <CardHeader>
          <CardTitle>Order Status Management</CardTitle>
          <CardDescription>
            Check order statuses and sync with Printful fulfillment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex flex-col space-y-2">
                <h3 className="text-sm font-semibold flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-primary" />
                  Automated Status Checking
                </h3>
                <p className="text-sm text-muted-foreground">
                  The system automatically checks order statuses every 30 minutes. You can manually trigger 
                  a check at any time using the buttons below.
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => checkOrdersMutation.mutate()}
                disabled={checkOrdersMutation.isPending || runScheduledTasksMutation.isPending}
                className="flex-1"
              >
                {checkOrdersMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking Orders...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check Order Statuses
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => runScheduledTasksMutation.mutate()}
                disabled={runScheduledTasksMutation.isPending || checkOrdersMutation.isPending}
                className="flex-1"
              >
                {runScheduledTasksMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running Tasks...
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Run All Scheduled Tasks
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showCatalog && (
        <Card>
          <CardHeader>
            <CardTitle>Printful Product Catalog</CardTitle>
            <CardDescription>
              Available products that can be added to your store
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCatalog ? (
              <div className="flex items-center justify-center p-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : catalogError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  Failed to load product catalog. Please try again later.
                </AlertDescription>
              </Alert>
            ) : catalog && catalog.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-2">
                  {catalog.length} products available from Printful
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {catalog.slice(0, 6).map((product: any) => (
                    <div key={product.id} className="border rounded-md p-4">
                      <h3 className="font-semibold">{product.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {product.type} • {product.variants} variants
                      </p>
                    </div>
                  ))}
                </div>
                {catalog.length > 6 && (
                  <p className="text-sm text-center text-muted-foreground">
                    ...and {catalog.length - 6} more products
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-muted-foreground p-6">
                No products found in catalog
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}