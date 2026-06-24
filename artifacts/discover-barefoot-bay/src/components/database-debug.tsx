import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, RefreshCcw, Database, UserCheck2, UserX, AlertTriangle, ShieldAlert, Key, Copy } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Type for auth status check response
type AuthStatus = {
  isAuthenticated: boolean;
  hasSession: boolean;
  sessionID: string | null;
  hasCookies: boolean;
  hasUser: boolean;
  userInfo: {
    id: number;
    username: string;
    role: string;
  } | null;
  nodeEnv: string;
};

// Type for database stats response
type DatabaseStats = {
  environment: string;
  database: {
    connectionType: string;
    connectionString: string | null;
  };
  userStats: {
    total: number;
    pending: number;
    approved: number;
    byRole: {
      admin: number;
      registered: number;
    }
  };
  pendingUsers: Array<{
    id: number;
    username: string;
    email: string;
    fullName: string;
    role: string;
    createdAt: string;
  }>;
};

export function DatabaseDebugger() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAuthChecking, setIsAuthChecking] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<Date | null>(null);
  const [isTokenFetching, setIsTokenFetching] = useState(false);
  
  // Enhanced authentication status check with retries and more detailed diagnostics 
  const checkAuthStatus = async (retryCount = 0) => {
    setIsAuthChecking(true);
    setAuthError(null);
    
    console.log("Starting authentication status check (attempt " + (retryCount + 1) + ")");
    
    try {
      // First, try to use the dedicated diagnostic endpoint that doesn't require admin rights
      const response = await fetch('/api/production-sync/auth-status', {
        method: 'GET',
        credentials: 'include', // Include credentials for cross-domain support
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store', // Prevent caching
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Authentication check failed (${response.status}): ${errorText}`);
        
        // If this isn't the first attempt and we still can't connect, throw an error
        if (retryCount >= 2) {
          throw new Error(`Authentication check failed: ${response.status} ${errorText}`);
        }
        
        // Before giving up, attempt to refresh auth status in 1 second
        console.log("Retrying authentication check in 1 second...");
        setTimeout(() => checkAuthStatus(retryCount + 1), 1000);
        return;
      }
      
      const data = await response.json();
      setAuthStatus(data);
      console.log("Auth status check result:", data);
      
      if (!data.isAuthenticated || !data.hasUser) {
        // Authentication issue
        const errorMessage = !data.isAuthenticated 
          ? "Not authenticated with the server" 
          : "Session exists but user data is missing";
          
        console.error("Authentication issue detected:", {
          isAuthenticated: data.isAuthenticated,
          hasUser: data.hasUser,
          hasCookies: data.hasCookies,
          hasSession: data.hasSession,
          sessionID: data.sessionID ? "Present" : "Missing",
          environment: data.nodeEnv
        });
        
        setAuthError(
          `Authentication problem detected: ${errorMessage}. Please log out and log back in to resolve this issue.`
        );
        
        // Show a friendlier toast notification
        toast({
          title: "Authentication Issue Detected",
          description: "The system can't verify your login. Try logging out and back in to fix the problem.",
          variant: "destructive"
        });
      } else if (data.userInfo?.role !== 'admin') {
        // Authorization issue (logged in but not as admin)
        console.warn("Authorization issue: User is logged in but doesn't have admin role", {
          role: data.userInfo?.role,
          userId: data.userInfo?.id,
          username: data.userInfo?.username
        });
        
        setAuthError("You need administrator privileges to access this feature. Your current role is: " + data.userInfo?.role);
      } else {
        // Successful authentication and authorization
        console.log("Authentication check passed:", {
          userId: data.userInfo?.id,
          username: data.userInfo?.username,
          role: data.userInfo?.role,
          environment: data.nodeEnv
        });
      }
    } catch (err) {
      console.error("Auth status check error:", err);
      setAuthError(err instanceof Error ? err.message : "Failed to check authentication status");
      
      // Show a more detailed error message in the toast
      toast({
        title: "Authentication Check Failed",
        description: "Could not verify your login status. Please refresh the page or try logging out and back in.",
        variant: "destructive"
      });
    } finally {
      setIsAuthChecking(false);
    }
  };
  
  // Function to get a cross-domain authentication token
  const getAuthToken = async () => {
    setIsTokenFetching(true);
    
    try {
      // Request a new token from the token endpoint
      const response = await fetch('/api/auth/token', {
        method: 'GET',
        credentials: 'include', // Include credentials
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get auth token: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.authToken) {
        throw new Error('Invalid token response');
      }
      
      // Set the token and its expiry
      setAuthToken(data.authToken);
      setTokenExpiry(new Date(data.tokenExpires));
      
      // Show success message
      toast({
        title: "Token Generated",
        description: "Cross-domain authentication token created successfully",
      });
      
      return data.authToken;
    } catch (err) {
      console.error("Error getting auth token:", err);
      toast({
        title: "Token Generation Failed",
        description: err instanceof Error ? err.message : "Failed to generate authentication token",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsTokenFetching(false);
    }
  };
  
  // Run auth check on component mount
  useEffect(() => {
    checkAuthStatus();
  }, []);
  
  // Query database stats with enhanced error handling
  const { data: dbStats, isLoading, error, refetch } = useQuery<DatabaseStats>({
    queryKey: ['/api/production-sync/stats'],
    refetchOnWindowFocus: false,
    // Only perform this query if the user is authenticated and an admin
    enabled: authStatus?.isAuthenticated && authStatus?.userInfo?.role === 'admin',
    retry: 1,
    retryDelay: 1000,
    // Add specific error handler for production environment
    onError: (err) => {
      console.error("Database stats fetch error:", err);
      // Show a more user-friendly error toast
      toast({
        title: "Failed to Load Database Information",
        description: err instanceof Error ? err.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  });
  
  // Create test user mutation
  const createTestUserMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest({
        method: 'POST', 
        url: '/api/production-sync/create-test-users',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/production-sync/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "Test pending user created successfully",
        variant: "default"
      });
    },
    onError: (err) => {
      console.error("Create test user error:", err);
      toast({
        title: "Failed to Create Test User",
        description: err instanceof Error ? err.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  });
  
  // Force refresh data mutation
  const forceRefreshMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest({
        method: 'POST', 
        url: '/api/production-sync/force-refresh',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/production-sync/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "Database refreshed successfully",
        variant: "default"
      });
    },
    onError: (err) => {
      console.error("Force refresh error:", err);
      toast({
        title: "Failed to Refresh Database",
        description: err instanceof Error ? err.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  });
  
  // Show authentication checking state
  if (isAuthChecking) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Database Diagnostics</CardTitle>
          <CardDescription>Checking authentication status...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  
  // Show authentication error if present
  if (authError) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Database Diagnostics</CardTitle>
          <CardDescription>Authentication Required</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Authentication Error</AlertTitle>
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
          
          {authStatus && (
            <div className="mt-4 p-4 bg-muted rounded-md text-xs">
              <h4 className="font-semibold mb-2">Diagnostic Information</h4>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
                <div>
                  <span className="font-medium">Authentication:</span>
                  <span className={`ml-2 ${authStatus.isAuthenticated ? 'text-green-600' : 'text-red-600'}`}>
                    {authStatus.isAuthenticated ? 'Successful ✓' : 'Failed ✗'}
                  </span>
                </div>
                
                <div>
                  <span className="font-medium">Environment:</span>
                  <span className={`ml-2 ${authStatus.nodeEnv === 'production' ? 'text-amber-600' : 'text-blue-600'}`}>
                    {authStatus.nodeEnv}
                  </span>
                </div>
                
                <div>
                  <span className="font-medium">Session:</span>
                  <span className={`ml-2 ${authStatus.hasSession ? 'text-green-600' : 'text-red-600'}`}>
                    {authStatus.hasSession ? 'Active ✓' : 'Missing ✗'}
                  </span>
                </div>
                
                <div>
                  <span className="font-medium">Session ID:</span>
                  <span className={`ml-2 ${authStatus.sessionID ? 'text-green-600' : 'text-red-600'}`}>
                    {authStatus.sessionID ? 'Present ✓' : 'Missing ✗'}
                  </span>
                </div>
                
                <div>
                  <span className="font-medium">Cookies:</span>
                  <span className={`ml-2 ${authStatus.hasCookies ? 'text-green-600' : 'text-red-600'}`}>
                    {authStatus.hasCookies ? 'Present ✓' : 'Missing ✗'}
                  </span>
                </div>
                
                <div>
                  <span className="font-medium">User Data:</span>
                  <span className={`ml-2 ${authStatus.hasUser ? 'text-green-600' : 'text-red-600'}`}>
                    {authStatus.hasUser ? 'Present ✓' : 'Missing ✗'}
                  </span>
                </div>
                
                {authStatus.userInfo && (
                  <>
                    <div>
                      <span className="font-medium">User Role:</span>
                      <span className={`ml-2 ${authStatus.userInfo.role === 'admin' ? 'text-green-600' : 'text-amber-600'}`}>
                        {authStatus.userInfo.role}
                      </span>
                    </div>
                    
                    <div>
                      <span className="font-medium">User ID:</span>
                      <span className="ml-2">{authStatus.userInfo.id}</span>
                    </div>
                    
                    <div>
                      <span className="font-medium">Username:</span>
                      <span className="ml-2">{authStatus.userInfo.username}</span>
                    </div>
                    
                    {/* Approval status removed from system */}
                  </>
                )}
              </div>
              
              <div className="mt-4 pt-4 border-t border-border">
                <h4 className="font-semibold mb-2">Common Issues:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {!authStatus.isAuthenticated && (
                    <li>Authentication failed - try logging out and back in</li>
                  )}
                  {!authStatus.hasCookies && (
                    <li>Missing cookies - check browser cookie settings and enable cookies</li>
                  )}
                  {authStatus.hasSession && !authStatus.hasUser && (
                    <li>Session exists but user data is missing - database synchronization issue</li>
                  )}
                  {authStatus.userInfo && authStatus.userInfo.role !== 'admin' && (
                    <li>Current user doesn't have admin privileges</li>
                  )}
                  {authStatus.nodeEnv === 'production' && !authStatus.hasCookies && (
                    <li>Production environment may be experiencing cross-domain cookie issues</li>
                  )}
                </ul>
              </div>
              
              <div className="mt-4 text-xs text-muted-foreground">
                <p>Raw diagnostic data:</p>
                <pre className="whitespace-pre-wrap mt-1 p-2 bg-background rounded border">
                  {JSON.stringify(authStatus, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={() => checkAuthStatus()}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Check Again
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  // Show loading state for database stats
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Database Diagnostics</CardTitle>
          <CardDescription>Loading database information...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  
  // Show error state if database stats fetch fails
  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Database Diagnostics</CardTitle>
          <CardDescription>Error fetching database information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Database Error</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "An unknown error occurred"}
            </AlertDescription>
          </Alert>
          
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              This error may be related to database connection issues. The following actions may help:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground mt-2">
              <li>Try refreshing the page</li>
              <li>Log out and log back in to refresh your authentication</li>
              <li>Check if you have administrator privileges</li>
              <li>Try again in a few minutes</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="space-x-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button variant="outline" onClick={() => checkAuthStatus()}>
            <ShieldAlert className="w-4 h-4 mr-2" />
            Check Auth
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Database Diagnostics</CardTitle>
            <CardDescription>Information about the current database connection</CardDescription>
          </div>
          <div className="flex space-x-2">
            {/* Allow getting a token for cross-domain requests in production */}
            {authStatus?.nodeEnv === 'production' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={getAuthToken}
                disabled={isTokenFetching}
                className="flex items-center"
              >
                {isTokenFetching ? (
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                ) : (
                  <Key className="h-3.5 w-3.5 mr-2" />
                )}
                {isTokenFetching ? 'Generating...' : 'Get Auth Token'}
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()} 
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {dbStats && (
          <>
            {/* Environment Information */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Environment</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current Environment</p>
                  <p className="font-medium">
                    <Badge variant={dbStats.environment === 'production' ? 'destructive' : 'secondary'}>
                      {dbStats.environment}
                    </Badge>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Database Type</p>
                  <p className="font-medium flex items-center">
                    <Database className="w-4 h-4 mr-2" />
                    {dbStats.database.connectionType}
                  </p>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* User Statistics */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">User Statistics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-xl font-medium">{dbStats.userStats.total}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Approvals</p>
                  <p className="text-xl font-medium flex items-center">
                    <UserX className="w-4 h-4 mr-2 text-amber-500" />
                    {dbStats.userStats.pending}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Approved Users</p>
                  <p className="text-xl font-medium flex items-center">
                    <UserCheck2 className="w-4 h-4 mr-2 text-green-500" />
                    {dbStats.userStats.approved}
                  </p>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Cross-domain Auth Token (only shown in production when a token exists) */}
            {authStatus?.nodeEnv === 'production' && authToken && (
              <>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Key className="w-5 h-5 mr-2 text-amber-500" />
                    Cross-domain Authentication Token
                  </h3>
                  
                  <Alert className="bg-amber-50 dark:bg-amber-950">
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground flex items-center justify-between">
                        <span>Token expires: {tokenExpiry?.toLocaleTimeString()}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => {
                            if (authToken) {
                              navigator.clipboard.writeText(authToken);
                              toast({
                                title: "Token Copied",
                                description: "Authentication token copied to clipboard",
                              });
                            }
                          }}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Copy
                        </Button>
                      </div>

                      <div className="relative">
                        <div className="overflow-x-auto rounded border p-2 bg-background text-xs font-mono">
                          {authToken}
                        </div>
                      </div>
                      
                      <p className="text-xs text-muted-foreground">
                        Use this token for cross-domain authentication in production environments. Add it as 
                        <code className="px-1 py-0.5 rounded bg-muted mx-1">x-auth-token</code>
                        header or
                        <code className="px-1 py-0.5 rounded bg-muted mx-1">?authToken=value</code>
                        query parameter to API requests.
                      </p>
                    </div>
                  </Alert>
                </div>
                <Separator />
              </>
            )}
            
            {/* Pending Users */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Pending Approval Users</h3>
              
              {dbStats.pendingUsers.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">No pending users found in the database.</p>
              ) : (
                <div className="overflow-auto max-h-60 border rounded-md">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">ID</th>
                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Username</th>
                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Email</th>
                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {dbStats.pendingUsers.map((user) => (
                        <tr key={user.id}>
                          <td className="px-4 py-2 whitespace-nowrap text-sm">{user.id}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{user.username}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm">{user.email}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
      
      <CardFooter className="flex flex-col space-y-2 items-stretch sm:flex-row sm:space-y-0 sm:space-x-2 sm:items-center">
        <Button 
          onClick={() => createTestUserMutation.mutate()} 
          disabled={createTestUserMutation.isPending}
          variant="outline"
        >
          {createTestUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Create Test Pending User
        </Button>
        
        <Button 
          onClick={() => forceRefreshMutation.mutate()} 
          disabled={forceRefreshMutation.isPending} 
          variant="secondary"
        >
          {forceRefreshMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Force DB Refresh
        </Button>
      </CardFooter>
    </Card>
  );
}