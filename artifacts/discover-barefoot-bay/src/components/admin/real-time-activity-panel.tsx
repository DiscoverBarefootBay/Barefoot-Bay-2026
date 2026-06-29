import { useSiteActiveUsers } from '@/hooks/use-active-users';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Activity, Clock, Smartphone, Monitor, Tablet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

const POLL_INTERVAL_MS = 30000;

/**
 * Format last active time to a readable relative string.
 */
function formatLastActive(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch (e) {
    return 'Unknown time';
  }
}

/**
 * Pick an icon for the device type.
 */
function DeviceIcon({ device }: { device: string }) {
  const d = (device || '').toLowerCase();
  if (d.includes('mobile') || d.includes('phone')) return <Smartphone className="h-4 w-4" />;
  if (d.includes('tablet') || d.includes('ipad')) return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

/**
 * Real-time feed of what users are doing right now. Reuses the site-wide
 * active-users data and presents it as a chronological activity feed, sorted
 * by most recent activity. Refreshes on the same cadence as the Active Users panel.
 */
export function RealTimeActivityPanel() {
  const { activeUsers, isLoading, error, refresh } = useSiteActiveUsers(POLL_INTERVAL_MS);

  // Most recent activity first.
  const feed = [...activeUsers].sort((a, b) => {
    const ta = new Date(a.lastActive).getTime();
    const tb = new Date(b.lastActive).getTime();
    return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
  });

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>Real-Time Activity</CardTitle>
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
        <CardDescription>What users are doing right now</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
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
          <div className="text-center p-4 text-destructive">
            <p>Error loading real-time activity</p>
            <Button variant="outline" size="sm" onClick={refresh} className="mt-2">
              Try Again
            </Button>
          </div>
        ) : feed.length === 0 ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-center text-muted-foreground">
            <Activity className="h-8 w-8 mb-2 opacity-50" />
            <p>No activity right now</p>
            <p className="text-xs mt-1">
              User activity will appear here as people browse the site.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {feed.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-start space-x-3 p-2 rounded-md transition-colors hover:bg-muted/50"
                >
                  <div className="bg-primary/10 text-primary rounded-full p-2 flex items-center justify-center">
                    <DeviceIcon device={user.device} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <span className="font-medium truncate">
                        {user.username || `User ${user.userId}`}
                      </span>
                      <Badge variant="outline" className="ml-2 text-xs shrink-0">
                        {user.device}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 truncate">
                      <span className="italic">Viewing:</span> {user.path}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatLastActive(user.lastActive)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        <div className="mt-3 flex justify-center">
          <Badge variant="outline" className="text-xs">
            Activity data refreshes every 30 seconds
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
