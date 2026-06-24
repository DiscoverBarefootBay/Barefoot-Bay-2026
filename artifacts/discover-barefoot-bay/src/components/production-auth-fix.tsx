import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCcw, ShieldAlert, Database, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type CookieStatus = {
  isAuthenticated: boolean;
  hasUser: boolean;
  user: any;
  cookies: {
    raw: string;
    parsedSessionId: boolean;
    hasConnectSid: boolean;
  };
  session: {
    exists: boolean;
    id: string | null;
    cookie: {
      secure: boolean;
      httpOnly: boolean;
      sameSite: string;
      maxAge: number;
      domain: string;
      path: string;
    } | null;
  };
  request: {
    host: string;
    origin: string;
    referer: string;
    secure: boolean;
    protocol: string;
    domain: string;
  };
  environment: {
    nodeEnv: string;
    cookieDomain: string;
    cookieSecure: string;
  };
};

type SessionStoreTest = {
  success: boolean;
  sessionWritable: boolean;
  sessionID: string;
  timestamp: number;
  databaseConnection: string;
  databaseInfo?: any;
  databaseError?: string;
};

export default function ProductionAuthFix() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('diagnose');
  const [isChecking, setIsChecking] = useState(false);
  const [cookieStatus, setCookieStatus] = useState<CookieStatus | null>(null);
  const [cookieError, setCookieError] = useState<string | null>(null);
  
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<SessionStoreTest | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  
  // Check cookie status
  const checkCookieStatus = async () => {
    setIsChecking(true);
    setCookieError(null);
    setCookieStatus(null);
    
    try {
      const response = await fetch('/api/production-auth/cookie-status', {
        method: 'GET',
        credentials: 'include', // Important for cross-domain authentication
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to check cookie status: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setCookieStatus(data);
      console.log('Cookie status:', data);
    } catch (err) {
      console.error('Error checking cookie status:', err);
      setCookieError(err instanceof Error ? err.message : String(err));
      toast({
        title: "Cookie Status Check Failed",
        description: err instanceof Error ? err.message : "Failed to check cookie status",
        variant: "destructive"
      });
    } finally {
      setIsChecking(false);
    }
  };
  
  // Reset session
  const resetSession = async () => {
    setIsResetting(true);
    setResetError(null);
    setResetResult(null);
    
    try {
      const response = await fetch('/api/production-auth/reset-session', {
        method: 'POST',
        credentials: 'include', // Important for cross-domain authentication
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to reset session: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setResetResult(data);
      console.log('Session reset result:', data);
      
      toast({
        title: "Session Reset",
        description: data.message || "Session has been reset. You'll need to log in again.",
        variant: "default"
      });
    } catch (err) {
      console.error('Error resetting session:', err);
      setResetError(err instanceof Error ? err.message : String(err));
      toast({
        title: "Session Reset Failed",
        description: err instanceof Error ? err.message : "Failed to reset session",
        variant: "destructive"
      });
    } finally {
      setIsResetting(false);
    }
  };
  
  // Test session store
  const testSessionStore = async () => {
    setIsTesting(true);
    setTestError(null);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/production-auth/session-store-test', {
        method: 'GET',
        credentials: 'include', // Important for cross-domain authentication
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to test session store: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setTestResult(data);
      console.log('Session store test result:', data);
      
      toast({
        title: "Session Store Test",
        description: data.success ? "Session store is working properly" : "Session store test failed",
        variant: data.success ? "default" : "destructive"
      });
    } catch (err) {
      console.error('Error testing session store:', err);
      setTestError(err instanceof Error ? err.message : String(err));
      toast({
        title: "Session Store Test Failed",
        description: err instanceof Error ? err.message : "Failed to test session store",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };
  
  // Helper to render status badges
  const StatusBadge = ({ status, label }: { status: boolean; label: string }) => (
    status ? (
      <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
        <CheckCircle className="w-3.5 h-3.5 mr-1" /> {label}
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200">
        <XCircle className="w-3.5 h-3.5 mr-1" /> {label}
      </Badge>
    )
  );
  
  // Format JSON for display
  const formatJson = (data: any) => {
    return JSON.stringify(data, null, 2);
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Production Authentication Troubleshooter</h1>
      <p className="text-muted-foreground mb-6">
        This tool helps diagnose and fix authentication issues in the production environment.
      </p>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="diagnose">Diagnose</TabsTrigger>
          <TabsTrigger value="fix">Fix</TabsTrigger>
          <TabsTrigger value="test">Database Test</TabsTrigger>
        </TabsList>
        
        {/* Diagnose Tab */}
        <TabsContent value="diagnose">
          <Card>
            <CardHeader>
              <CardTitle>Cookie & Session Diagnostics</CardTitle>
              <CardDescription>
                Check the status of authentication cookies and session data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isChecking ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : cookieError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{cookieError}</AlertDescription>
                </Alert>
              ) : cookieStatus ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="font-medium">Authentication Status</h3>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={cookieStatus.isAuthenticated} label="Authenticated" />
                      <StatusBadge status={cookieStatus.hasUser} label="User Present" />
                      <StatusBadge status={cookieStatus.cookies.hasConnectSid} label="Session Cookie" />
                      <StatusBadge status={cookieStatus.session.exists} label="Session Data" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h3 className="font-medium">Cookie Information</h3>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-36">
                        {formatJson(cookieStatus.cookies)}
                      </pre>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="font-medium">Session Information</h3>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-36">
                        {formatJson(cookieStatus.session)}
                      </pre>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium">Environment Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                      <div className="bg-muted p-2 rounded">
                        <span className="font-medium">Node Env:</span> {cookieStatus.environment.nodeEnv}
                      </div>
                      <div className="bg-muted p-2 rounded">
                        <span className="font-medium">Cookie Domain:</span> {cookieStatus.environment.cookieDomain}
                      </div>
                      <div className="bg-muted p-2 rounded">
                        <span className="font-medium">Cookie Secure:</span> {cookieStatus.environment.cookieSecure}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium">Request Information</h3>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-36">
                      {formatJson(cookieStatus.request)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-muted-foreground mb-2">Click the button below to check cookie and session status</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={checkCookieStatus} disabled={isChecking}>
                {isChecking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Check Status
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Fix Tab */}
        <TabsContent value="fix">
          <Card>
            <CardHeader>
              <CardTitle>Reset Session</CardTitle>
              <CardDescription>
                Fix authentication issues by resetting the session
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isResetting ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : resetError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{resetError}</AlertDescription>
                </Alert>
              ) : resetResult ? (
                <Alert variant={resetResult.success ? "default" : "destructive"}>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>{resetResult.success ? "Success" : "Failed"}</AlertTitle>
                  <AlertDescription>{resetResult.message}</AlertDescription>
                </Alert>
              ) : (
                <div className="py-6 space-y-4">
                  <p className="text-muted-foreground">
                    Resetting your session will clear all authentication data and require you to log in again. 
                    This can fix issues with corrupted session data or authentication problems.
                  </p>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Important</AlertTitle>
                    <AlertDescription>
                      After resetting your session, you will need to log in again. Make sure you know your username and password before proceeding.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                variant="destructive" 
                onClick={resetSession} 
                disabled={isResetting}
              >
                {isResetting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    Reset Session
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Test Tab */}
        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle>Database Connection Test</CardTitle>
              <CardDescription>
                Verify the database connection and session store are working properly
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isTesting ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : testError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{testError}</AlertDescription>
                </Alert>
              ) : testResult ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="font-medium">Test Results</h3>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={testResult.success} label="Overall Test" />
                      <StatusBadge status={testResult.sessionWritable} label="Session Writable" />
                      <StatusBadge status={testResult.databaseConnection === 'working'} label="Database Connection" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium">Session Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="bg-muted p-2 rounded">
                        <span className="font-medium">Session ID:</span> {testResult.sessionID}
                      </div>
                      <div className="bg-muted p-2 rounded">
                        <span className="font-medium">Timestamp:</span> {new Date(testResult.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  {testResult.databaseInfo && (
                    <div className="space-y-2">
                      <h3 className="font-medium">Database Information</h3>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-36">
                        {formatJson(testResult.databaseInfo)}
                      </pre>
                    </div>
                  )}
                  
                  {testResult.databaseError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Database Error</AlertTitle>
                      <AlertDescription>{testResult.databaseError}</AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-muted-foreground mb-2">Click the button below to test the database connection and session store</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={testSessionStore} disabled={isTesting}>
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Test Connection
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}