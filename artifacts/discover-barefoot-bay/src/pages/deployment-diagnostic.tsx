/**
 * Deployment Authentication Diagnostic Tool
 * 
 * This page provides tools for diagnosing authentication issues in deployment
 */
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle, HelpCircle, Info } from 'lucide-react';

// Structured diagnostic data from the API
interface DiagnosticData {
  timestamp: string;
  authInfo: {
    isAuthenticated: boolean;
    user: {
      id: number;
      username: string;
      role: string;
    } | null;
  };
  sessionInfo: {
    id: string;
    cookie: {
      originalMaxAge: number;
      secure: boolean;
      httpOnly: boolean;
      path: string;
      domain: string | null;
      sameSite: string | boolean;
    };
    isNew: boolean;
  } | string;
  requestInfo: {
    headers: {
      host: string;
      origin: string | null;
      referer: string | null;
      userAgent: string | null;
      cookie: string;
      authorization: string;
    };
    ip: string;
    protocol: string;
    secure: boolean;
    xhr: boolean;
    path: string;
    method: string;
  };
  envConfig: {
    NODE_ENV: string;
    SESSION_SECRET: string;
    COOKIE_SECURE: string;
    COOKIE_DOMAIN: string;
    REPL_ID: string;
    REPL_OWNER: string;
    REPL_SLUG: string;
  };
  corsCheck: {
    allowedOrigins: string[];
    currentOrigin: string;
    isOriginAllowed: boolean;
  };
}

export default function DeploymentDiagnosticPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData | null>(null);
  const [testCookieStatus, setTestCookieStatus] = useState<{exists: boolean; value?: string} | null>(null);
  const [clientCookieStatus, setClientCookieStatus] = useState<{exists: boolean; value?: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('diagnostic');
  const { toast } = useToast();

  // Check if we're in a deployment environment
  const isDeployment = typeof window !== 'undefined' && (
    window.location.hostname.includes('replit.app') || 
    window.location.hostname.includes('replit.dev') ||
    window.location.hostname.includes('barefootbay.com')
  );

  // Get the URL of the current deployment
  const deploymentUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Run a comprehensive diagnostic check
  const runDiagnostic = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/deployment-diagnostic/diagnostic', {
        credentials: 'include',
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setDiagnosticData(data);
      
      toast({
        title: "Diagnostic Complete",
        description: "Deployment diagnostic information retrieved successfully",
      });
    } catch (error) {
      console.error('Error running diagnostic:', error);
      toast({
        title: "Diagnostic Failed",
        description: error instanceof Error ? error.message : "Failed to retrieve diagnostic data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test setting a server cookie
  const testServerCookie = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/deployment-diagnostic/test-cookie', {
        credentials: 'include',
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check if the cookie was set
      setTimeout(checkTestCookie, 500); // Wait briefly for cookie to be set
      
      toast({
        title: "Test Cookie Set",
        description: "Server has attempted to set a test cookie. Checking status...",
      });
    } catch (error) {
      console.error('Error setting test cookie:', error);
      toast({
        title: "Cookie Test Failed",
        description: error instanceof Error ? error.message : "Failed to set test cookie",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  // Check if the test cookie is present
  const checkTestCookie = async () => {
    try {
      const response = await fetch('/api/deployment-diagnostic/check-test-cookie', {
        credentials: 'include',
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setTestCookieStatus({
        exists: data.testCookieExists,
        value: data.allCookies
      });
      
      toast({
        title: data.testCookieExists ? "Cookie Test Passed" : "Cookie Test Failed",
        description: data.testCookieExists 
          ? "The test cookie was successfully set and read by the server" 
          : "The server could not detect the test cookie",
        variant: data.testCookieExists ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Error checking test cookie:', error);
      toast({
        title: "Cookie Check Failed",
        description: error instanceof Error ? error.message : "Failed to check test cookie",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test setting a client-readable cookie
  const testClientCookie = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/deployment-diagnostic/client-readable-cookie', {
        credentials: 'include',
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check client-side cookies
      setTimeout(() => {
        const cookies = document.cookie;
        const clientReadableCookie = cookies.includes('client_readable');
        setClientCookieStatus({
          exists: clientReadableCookie,
          value: cookies
        });
        
        toast({
          title: clientReadableCookie ? "Client Cookie Test Passed" : "Client Cookie Test Failed",
          description: clientReadableCookie 
            ? "The client-readable cookie was successfully set and read by the browser" 
            : "The browser could not detect the client-readable cookie",
          variant: clientReadableCookie ? "default" : "destructive"
        });
        
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error setting client cookie:', error);
      toast({
        title: "Client Cookie Test Failed",
        description: error instanceof Error ? error.message : "Failed to set client cookie",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check client-side cookies on mount
    const cookies = document.cookie;
    setClientCookieStatus({
      exists: cookies.length > 0,
      value: cookies
    });
  }, []);

  // Format environment variable value for display
  const formatEnvVar = (value: string) => {
    if (value === 'not set') return <span className="text-red-500">Not Set</span>;
    if (value === 'Set (hidden)') return <span className="text-green-500">Set (Hidden)</span>;
    return value;
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="mb-8 border-blue-300 shadow-md">
        <CardHeader className="bg-blue-50">
          <CardTitle className="flex items-center text-blue-800">
            <Info className="mr-2 h-5 w-5" />
            Deployment Authentication Diagnostic Tool
          </CardTitle>
          <CardDescription>
            This tool helps diagnose authentication issues in deployed environments by checking cookies, 
            sessions, and environment configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Alert className={isDeployment ? "bg-green-50" : "bg-amber-50"}>
            <div className="flex items-center">
              {isDeployment ? (
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500 mr-2" />
              )}
              <AlertTitle>
                {isDeployment ? "Deployment Environment Detected" : "Development Environment Detected"}
              </AlertTitle>
            </div>
            <AlertDescription>
              {isDeployment 
                ? `You are currently in a deployment environment: ${deploymentUrl}` 
                : "You are currently in a development environment. Some deployment-specific issues may not be reproducible here."}
            </AlertDescription>
          </Alert>

          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">Authentication Status</h3>
            <div className="p-4 rounded-md bg-gray-50">
              {authLoading ? (
                <div className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Checking authentication status...</span>
                </div>
              ) : user ? (
                <div>
                  <div className="flex items-center">
                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                    <span className="font-medium">Authenticated as:</span>
                  </div>
                  <div className="mt-2 pl-6">
                    <p><span className="font-medium">Username:</span> {user.username}</p>
                    <p><span className="font-medium">User ID:</span> {user.id}</p>
                    <p><span className="font-medium">Role:</span> {user.role}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center">
                  <AlertCircle className="mr-2 h-4 w-4 text-red-500" />
                  <span>Not authenticated</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">Client Cookie Status</h3>
            <div className="p-4 rounded-md bg-gray-50">
              {clientCookieStatus ? (
                <div>
                  <div className="flex items-center">
                    {clientCookieStatus.exists ? (
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="mr-2 h-4 w-4 text-red-500" />
                    )}
                    <span className="font-medium">
                      {clientCookieStatus.exists ? "Client has cookies" : "No cookies found in browser"}
                    </span>
                  </div>
                  {clientCookieStatus.exists && (
                    <div className="mt-2 pl-6">
                      <p className="text-sm break-words">
                        <span className="font-medium">Cookies:</span> {clientCookieStatus.value}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center">
                  <HelpCircle className="mr-2 h-4 w-4 text-gray-500" />
                  <span>Cookie status unknown</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-gray-50 flex flex-col sm:flex-row gap-2 justify-start items-stretch sm:items-center">
          <Button 
            onClick={runDiagnostic} 
            disabled={isLoading} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Run Server Diagnostic
          </Button>
          <Button 
            onClick={testServerCookie} 
            disabled={isLoading} 
            variant="outline"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test Server Cookie
          </Button>
          <Button 
            onClick={testClientCookie} 
            disabled={isLoading} 
            variant="outline"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test Client Cookie
          </Button>
        </CardFooter>
      </Card>

      {diagnosticData && (
        <Card className="mb-8 border-green-300 shadow-md">
          <CardHeader className="bg-green-50">
            <CardTitle className="text-green-800">Diagnostic Results</CardTitle>
            <CardDescription>
              Timestamp: {new Date(diagnosticData.timestamp).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue="session" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="session">Session</TabsTrigger>
                <TabsTrigger value="request">Request</TabsTrigger>
                <TabsTrigger value="environment">Environment</TabsTrigger>
                <TabsTrigger value="cors">CORS</TabsTrigger>
              </TabsList>

              <TabsContent value="session" className="p-4 border rounded-md">
                <h3 className="text-lg font-medium mb-4">Session Information</h3>
                {typeof diagnosticData.sessionInfo === 'string' ? (
                  <div className="text-red-500">{diagnosticData.sessionInfo}</div>
                ) : (
                  <div className="space-y-3">
                    <p><span className="font-medium">Session ID:</span> {diagnosticData.sessionInfo.id}</p>
                    <p><span className="font-medium">Is New Session:</span> {diagnosticData.sessionInfo.isNew ? 'Yes' : 'No'}</p>
                    <div>
                      <p className="font-medium">Cookie Settings:</p>
                      <ul className="pl-6 space-y-1 mt-1">
                        <li><span className="font-medium">Secure:</span> {diagnosticData.sessionInfo.cookie.secure ? 'Yes' : 'No'}</li>
                        <li><span className="font-medium">HttpOnly:</span> {diagnosticData.sessionInfo.cookie.httpOnly ? 'Yes' : 'No'}</li>
                        <li><span className="font-medium">SameSite:</span> {
                          typeof diagnosticData.sessionInfo.cookie.sameSite === 'boolean' 
                            ? (diagnosticData.sessionInfo.cookie.sameSite ? 'True' : 'False')
                            : diagnosticData.sessionInfo.cookie.sameSite
                        }</li>
                        <li><span className="font-medium">Domain:</span> {diagnosticData.sessionInfo.cookie.domain || 'Not set'}</li>
                        <li><span className="font-medium">Path:</span> {diagnosticData.sessionInfo.cookie.path}</li>
                        <li><span className="font-medium">Max Age:</span> {diagnosticData.sessionInfo.cookie.originalMaxAge / 1000 / 60 / 60} hours</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium">Authentication:</p>
                      <ul className="pl-6 space-y-1 mt-1">
                        <li><span className="font-medium">Authenticated:</span> {diagnosticData.authInfo.isAuthenticated ? 'Yes' : 'No'}</li>
                        {diagnosticData.authInfo.user && (
                          <>
                            <li><span className="font-medium">User ID:</span> {diagnosticData.authInfo.user.id}</li>
                            <li><span className="font-medium">Username:</span> {diagnosticData.authInfo.user.username}</li>
                            <li><span className="font-medium">Role:</span> {diagnosticData.authInfo.user.role}</li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="request" className="p-4 border rounded-md">
                <h3 className="text-lg font-medium mb-4">Request Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium">Headers:</p>
                    <ul className="pl-6 space-y-1 mt-1">
                      <li><span className="font-medium">Host:</span> {diagnosticData.requestInfo.headers.host}</li>
                      <li><span className="font-medium">Origin:</span> {diagnosticData.requestInfo.headers.origin || 'Not set'}</li>
                      <li><span className="font-medium">Referer:</span> {diagnosticData.requestInfo.headers.referer || 'Not set'}</li>
                      <li><span className="font-medium">Cookie:</span> {diagnosticData.requestInfo.headers.cookie}</li>
                      <li><span className="font-medium">Authorization:</span> {diagnosticData.requestInfo.headers.authorization}</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">Request Details:</p>
                    <ul className="pl-6 space-y-1 mt-1">
                      <li><span className="font-medium">IP:</span> {diagnosticData.requestInfo.ip}</li>
                      <li><span className="font-medium">Protocol:</span> {diagnosticData.requestInfo.protocol}</li>
                      <li><span className="font-medium">Secure:</span> {diagnosticData.requestInfo.secure ? 'Yes' : 'No'}</li>
                      <li><span className="font-medium">XHR:</span> {diagnosticData.requestInfo.xhr ? 'Yes' : 'No'}</li>
                      <li><span className="font-medium">Path:</span> {diagnosticData.requestInfo.path}</li>
                      <li><span className="font-medium">Method:</span> {diagnosticData.requestInfo.method}</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="environment" className="p-4 border rounded-md">
                <h3 className="text-lg font-medium mb-4">Environment Configuration</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 border rounded bg-gray-50">
                      <p className="font-medium">NODE_ENV:</p> 
                      <p className={`mt-1 ${diagnosticData.envConfig.NODE_ENV === 'production' ? 'text-green-600' : 'text-amber-600'}`}>
                        {diagnosticData.envConfig.NODE_ENV}
                      </p>
                    </div>
                    <div className="p-3 border rounded bg-gray-50">
                      <p className="font-medium">SESSION_SECRET:</p> 
                      <p className="mt-1">{formatEnvVar(diagnosticData.envConfig.SESSION_SECRET)}</p>
                    </div>
                    <div className="p-3 border rounded bg-gray-50">
                      <p className="font-medium">COOKIE_SECURE:</p> 
                      <p className={`mt-1 ${diagnosticData.envConfig.COOKIE_SECURE === 'true' ? 'text-green-600' : 'text-amber-600'}`}>
                        {diagnosticData.envConfig.COOKIE_SECURE}
                      </p>
                    </div>
                    <div className="p-3 border rounded bg-gray-50">
                      <p className="font-medium">COOKIE_DOMAIN:</p> 
                      <p className={`mt-1 ${diagnosticData.envConfig.COOKIE_DOMAIN === 'not set' ? 'text-amber-600' : 'text-green-600'}`}>
                        {formatEnvVar(diagnosticData.envConfig.COOKIE_DOMAIN)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="font-medium mb-2">Replit Environment:</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 border rounded bg-gray-50">
                        <p className="font-medium">REPL_ID:</p>
                        <p className="mt-1 truncate">{diagnosticData.envConfig.REPL_ID}</p>
                      </div>
                      <div className="p-3 border rounded bg-gray-50">
                        <p className="font-medium">REPL_OWNER:</p>
                        <p className="mt-1">{diagnosticData.envConfig.REPL_OWNER}</p>
                      </div>
                      <div className="p-3 border rounded bg-gray-50">
                        <p className="font-medium">REPL_SLUG:</p>
                        <p className="mt-1">{diagnosticData.envConfig.REPL_SLUG}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="cors" className="p-4 border rounded-md">
                <h3 className="text-lg font-medium mb-4">CORS Configuration</h3>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium">Current Origin:</p>
                    <p className="mt-1">{diagnosticData.corsCheck.currentOrigin}</p>
                  </div>
                  <div>
                    <p className="font-medium">Origin Allowed:</p>
                    <p className={`mt-1 ${diagnosticData.corsCheck.isOriginAllowed ? 'text-green-600' : 'text-red-600'}`}>
                      {diagnosticData.corsCheck.isOriginAllowed ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Allowed Origins:</p>
                    <ul className="pl-6 list-disc mt-1">
                      {diagnosticData.corsCheck.allowedOrigins.map((origin, index) => (
                        <li key={index}>{origin}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {testCookieStatus && (
        <Card className="mb-8 border-amber-300 shadow-md">
          <CardHeader className={testCookieStatus.exists ? "bg-green-50" : "bg-red-50"}>
            <CardTitle className={testCookieStatus.exists ? "text-green-800" : "text-red-800"}>
              <div className="flex items-center">
                {testCookieStatus.exists ? (
                  <CheckCircle className="mr-2 h-5 w-5" />
                ) : (
                  <AlertCircle className="mr-2 h-5 w-5" />
                )}
                Server Cookie Test Results
              </div>
            </CardTitle>
            <CardDescription>
              {testCookieStatus.exists 
                ? "The test cookie was successfully set and detected by the server" 
                : "The server was unable to detect the test cookie"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="p-4 border rounded-md bg-gray-50">
              <p className="font-medium">Cookie Status:</p>
              <p className={`mt-1 ${testCookieStatus.exists ? 'text-green-600' : 'text-red-600'}`}>
                {testCookieStatus.exists ? "Cookie successfully set and detected" : "Cookie not detected"}
              </p>
              {testCookieStatus.value && (
                <div className="mt-4">
                  <p className="font-medium">All Cookies:</p>
                  <p className="mt-1 break-words text-sm">{testCookieStatus.value}</p>
                </div>
              )}
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Implications</h3>
              <p className="text-gray-700">
                {testCookieStatus.exists
                  ? "Your server can successfully set and read cookies. This indicates that session cookies should work properly."
                  : "Your server is unable to set or read cookies. This will prevent sessions from working, causing authentication failures."}
              </p>
              {!testCookieStatus.exists && (
                <div className="mt-4 p-4 bg-red-50 rounded-md border border-red-200">
                  <h4 className="font-medium text-red-800">Recommended Fixes:</h4>
                  <ul className="list-disc pl-6 mt-2 space-y-1 text-red-700">
                    <li>Ensure <code>COOKIE_SECURE</code> is set to <code>true</code> in production</li>
                    <li>Set <code>COOKIE_DOMAIN</code> to your deployment domain (e.g., <code>.yourdomain.com</code>)</li>
                    <li>Check that <code>sameSite: 'none'</code> is properly set for production</li>
                    <li>Verify that <code>NODE_ENV=production</code> is set in your deployment environment</li>
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}