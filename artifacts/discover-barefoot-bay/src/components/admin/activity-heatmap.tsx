import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { useActiveUsers } from '@/hooks/use-active-users';

// Color mapping for heatmap intensity
const getHeatColor = (intensity: number): string => {
  // Scale from blue (cold) to red (hot)
  if (intensity <= 0.2) return 'rgba(59, 130, 246, 0.3)';  // Light blue
  if (intensity <= 0.4) return 'rgba(16, 185, 129, 0.4)';  // Green
  if (intensity <= 0.6) return 'rgba(250, 204, 21, 0.5)';  // Yellow
  if (intensity <= 0.8) return 'rgba(249, 115, 22, 0.6)';  // Orange
  return 'rgba(239, 68, 68, 0.7)';                         // Red
};

interface PathActivity {
  path: string;
  count: number;
  percentage: number;
}

export function ActivityHeatmap() {
  const { activeUsers, isLoading, error, refresh } = useActiveUsers(15000); // Poll every 15 seconds
  const [pathActivity, setPathActivity] = useState<PathActivity[]>([]);
  
  // Transform active users data into path activity heatmap
  useEffect(() => {
    if (!activeUsers.length) {
      setPathActivity([]);
      return;
    }
    
    // Count occurrences of each path
    const pathCounts: Record<string, number> = {};
    
    activeUsers.forEach(user => {
      const path = user.path || '/';
      pathCounts[path] = (pathCounts[path] || 0) + 1;
    });
    
    // Calculate the total users
    const totalCount = activeUsers.length;
    
    // Convert to array with percentages
    const activity = Object.entries(pathCounts).map(([path, count]) => ({
      path,
      count,
      percentage: Math.round((count / totalCount) * 100)
    }));
    
    // Sort by count (descending)
    activity.sort((a, b) => b.count - a.count);
    
    setPathActivity(activity);
  }, [activeUsers]);
  
  // Format path for display
  const formatPath = (path: string): string => {
    if (path === '/') return 'Home';
    return path.replace(/^\//, '').replace(/-/g, ' ');
  };
  
  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle>Activity Heatmap</CardTitle>
            <Badge variant="outline" className="ml-2">{pathActivity.length} pages</Badge>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={refresh} 
            title="Refresh"
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          Real-time view of where users are active
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && pathActivity.length === 0 ? (
          <div className="flex justify-center items-center h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-[300px] text-destructive">
            <p>Error loading activity data</p>
          </div>
        ) : pathActivity.length === 0 ? (
          <div className="flex justify-center items-center h-[300px] text-muted-foreground">
            <p>No active users at this time</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pathActivity.map((activity, index) => (
              <div key={index} className="relative rounded-md overflow-hidden">
                <div 
                  className="absolute inset-0"
                  style={{ 
                    backgroundColor: getHeatColor(activity.count / pathActivity[0].count),
                    opacity: 0.7
                  }}
                />
                <div className="relative p-3 flex items-center justify-between">
                  <div className="font-medium truncate max-w-[70%]" title={activity.path}>
                    {formatPath(activity.path)}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge>{activity.count} user{activity.count !== 1 ? 's' : ''}</Badge>
                    <Badge variant="outline">{activity.percentage}%</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}