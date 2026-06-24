import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { fetchAuthDebugInfo, type DebugAuthResponse } from '@/lib/debugAuth';
import { Loader2 } from 'lucide-react';

export function AuthDebugPanel() {
  const [debugInfo, setDebugInfo] = useState<DebugAuthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchDebugInfo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const info = await fetchAuthDebugInfo();
      setDebugInfo(info);
    } catch (err) {
      console.error("Error fetching auth debug info:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch authentication debug information");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto mb-8">
      <CardHeader>
        <CardTitle>Authentication Debug Panel</CardTitle>
        <CardDescription>
          Diagnose authentication issues across different environments
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <Button 
            onClick={handleFetchDebugInfo} 
            disabled={loading}
            variant="default"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                Loading...
              </>
            ) : "Fetch Auth Debug Info"}
          </Button>
          
          {debugInfo && (
            <Badge variant={debugInfo.isAuthenticated ? "default" : "destructive"} className={debugInfo.isAuthenticated ? "bg-green-500" : ""}>
              {debugInfo.isAuthenticated ? "Authenticated" : "Not Authenticated"}
            </Badge>
          )}
        </div>
        
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {debugInfo && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Session Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-medium">Has Session:</div>
                <div>{debugInfo.hasSession ? "Yes" : "No"}</div>
                
                <div className="font-medium">Session ID:</div>
                <div className="break-all">{debugInfo.sessionID}</div>
                
                <div className="font-medium">Is Authenticated:</div>
                <div>{debugInfo.isAuthenticated ? "Yes" : "No"}</div>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="text-lg font-medium mb-2">User Information</h3>
              {debugInfo.user ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">User ID:</div>
                  <div>{debugInfo.user.id}</div>
                  
                  <div className="font-medium">Username:</div>
                  <div>{debugInfo.user.username}</div>
                  
                  <div className="font-medium">Role:</div>
                  <div>{debugInfo.user.role}</div>
                  
                  {/* Approval status has been deprecated */}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No user information available</div>
              )}
            </div>
            
            <Separator />
            
            <div>
              <h3 className="text-lg font-medium mb-2">Request Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-medium">Protocol:</div>
                <div>{debugInfo.requestInfo.protocol}</div>
                
                <div className="font-medium">Secure:</div>
                <div>{debugInfo.requestInfo.secure ? "Yes" : "No"}</div>
                
                <div className="font-medium">Hostname:</div>
                <div>{debugInfo.requestInfo.hostname}</div>
                
                <div className="font-medium">Original URL:</div>
                <div className="break-all">{debugInfo.requestInfo.originalUrl}</div>
                
                <div className="font-medium">IP:</div>
                <div>{debugInfo.requestInfo.ip}</div>
                
                <div className="font-medium">Method:</div>
                <div>{debugInfo.requestInfo.method}</div>
                
                <div className="font-medium">Path:</div>
                <div>{debugInfo.requestInfo.path}</div>
                
                <div className="font-medium">Referrer:</div>
                <div className="break-all">{debugInfo.requestInfo.referrer}</div>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="text-lg font-medium mb-2">Configuration Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-medium">Node Environment:</div>
                <div>{debugInfo.configInfo.nodeEnv || "Not set"}</div>
                
                <div className="font-medium">Cookie Secure:</div>
                <div>{debugInfo.configInfo.cookieSecure || "Not set"}</div>
                
                <div className="font-medium">Cookie Domain:</div>
                <div>{debugInfo.configInfo.cookieDomain || "Not set"}</div>
                
                <div className="font-medium">Trust Proxy:</div>
                <div>{debugInfo.configInfo.trustProxy}</div>
                
                <div className="font-medium">Port:</div>
                <div>{debugInfo.configInfo.port}</div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-2">Browser Document Cookie</h3>
              <div className="p-3 bg-muted rounded-md text-xs font-mono break-all whitespace-pre-wrap">
                {document.cookie || "No cookies"}
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <div className="text-sm text-muted-foreground">
          Used to diagnose authentication issues between environments
        </div>
      </CardFooter>
    </Card>
  );
}

export default AuthDebugPanel;