import { useActiveUsers } from '@/hooks/use-active-users';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

/**
 * Format last active time to a readable format
 */
function formatLastActive(dateString: string): string {
  try {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (e) {
    return 'Unknown time';
  }
}

/**
 * Get device type from user agent
 */
function getDeviceType(userAgent: string): string {
  if (!userAgent) return 'Unknown';
  
  // Simple detection for demo purposes
  if (/mobile|android|iphone|ipad|ipod/i.test(userAgent.toLowerCase())) {
    return 'Mobile';
  } else if (/tablet|ipad/i.test(userAgent.toLowerCase())) {
    return 'Tablet';
  } else {
    return 'Desktop';
  }
}

/**
 * Display a panel of currently active users with real-time updates
 */
export function ActiveUsersPanel() {
  const { activeUsers, activeUserCount, isLoading, error, refresh } = useActiveUsers(30000); // Poll every 30 seconds
  
  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Active Users</CardTitle>
            <Badge variant="outline" className="ml-2">{activeUserCount}</Badge>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={refresh} 
            title="Refresh"
            className="h-8 w-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Users active in the last 5 minutes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          // Skeleton loader for loading state
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-[150px]" />
                  <Skeleton className="h-3 w-[100px]" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          // Error state
          <div className="text-center p-4 text-destructive">
            <p>Error loading active users</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refresh} 
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        ) : activeUsers.length === 0 ? (
          // Empty state
          <div className="text-center py-6 text-muted-foreground">
            <p>No active users at this time</p>
          </div>
        ) : (
          // User list
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {activeUsers.map((user) => (
                <div key={user.userId} className="flex items-start space-x-3 p-2 rounded-md transition-colors hover:bg-muted/50">
                  <div className="bg-primary/10 text-primary rounded-full p-2 flex items-center justify-center">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <span className="font-medium truncate">
                        {user.username || `User ${user.userId}`}
                      </span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {getDeviceType(user.userAgent)}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatLastActive(user.lastActive)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      <span className="italic">Current page:</span> {user.path}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}