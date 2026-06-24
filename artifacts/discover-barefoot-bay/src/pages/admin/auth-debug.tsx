import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layouts/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import { apiRequest } from '@/lib/queryClient';

export default function AuthDebugPage() {
  const { user, isLoading: authLoading, loginMutation, logoutMutation } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [apiTestResult, setApiTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const isAuthenticated = !!user;

  // Get the current hostname - used for debug logging
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isProduction = hostname.includes('repl.co') || hostname.includes('replit.app');

  // Fetch debug info on mount and when authentication state changes
  useEffect(() => {
    fetchDebugInfo();
  }, [user, loginMutation.isSuccess, logoutMutation.isSuccess]);

  const fetchDebugInfo = async () => {
    try {
      setIsLoading(true);
      
      // Get current cookie information
      const cookieInfo = document.cookie
        .split(';')
        .map(cookie => cookie.trim())
        .reduce((acc: Record<string, string>, cookie) => {
          const [name, value] = cookie.split('=');
          acc[name] = value;
          return acc;
        }, {});
      
      // Basic browser info
      const info = {
        isAuthenticated,
        user,
        cookies: cookieInfo,
        userAgent: navigator.userAgent,
        hostname,
        href: window.location.href,
        isProduction
      };
      
      setDebugInfo(info);
    } catch (error) {
      console.error('Error fetching debug info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testApiAccess = async () => {
    try {
      setIsLoading(true);
      
      // Test endpoint that requires authentication
      const response = await apiRequest('GET', '/api/users');
      const data = await response.json();
      
      setApiTestResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setApiTestResult(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  const clearDebugData = () => {
    setApiTestResult('');
  };

  return (
    <AdminLayout>
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-6">Authentication Debug Tool</h1>
        <p className="text-muted-foreground mb-6">
          This page helps diagnose authentication issues across different environments.
        </p>
        
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Status</CardTitle>
              <CardDescription>Current authentication state</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-md mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p><span className="font-semibold">Status:</span> {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</p>
                    <p><span className="font-semibold">Environment:</span> {isProduction ? 'Production' : 'Development'}</p>
                    <p><span className="font-semibold">Hostname:</span> {hostname}</p>
                  </div>
                  <div>
                    {user ? (
                      <>
                        <p><span className="font-semibold">User ID:</span> {user.id}</p>
                        <p><span className="font-semibold">Username:</span> {user.username}</p>
                        <p><span className="font-semibold">Role:</span> {user.role}</p>
                      </>
                    ) : (
                      <p className="text-amber-600">No user currently logged in</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mb-4">
                <Button onClick={fetchDebugInfo} disabled={isLoading}>
                  Refresh Status
                </Button>
                {isAuthenticated ? (
                  <Button 
                    onClick={() => logoutMutation.mutate()} 
                    variant="outline" 
                    disabled={isLoading || logoutMutation.isPending}
                  >
                    Test Logout
                  </Button>
                ) : (
                  <Button 
                    onClick={() => loginMutation.mutate({ username: 'admin', password: 'admin123' })} 
                    variant="outline" 
                    disabled={isLoading || loginMutation.isPending}
                  >
                    Test Login
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>API Access Test</CardTitle>
              <CardDescription>Test authenticated API endpoints</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Button onClick={testApiAccess} disabled={isLoading || !isAuthenticated}>
                  Test /api/users Endpoint
                </Button>
                <Button onClick={clearDebugData} variant="outline" disabled={isLoading || !apiTestResult}>
                  Clear Results
                </Button>
              </div>
              
              {apiTestResult && (
                <div className="bg-muted p-4 rounded-md overflow-auto max-h-60">
                  <pre className="text-xs">{apiTestResult}</pre>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Debug Information</CardTitle>
              <CardDescription>Detailed debug data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-md overflow-auto max-h-96">
                <pre className="text-xs">{JSON.stringify(debugInfo, null, 2)}</pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}