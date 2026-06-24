import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { GitFork, LogIn, LogOut, RefreshCw } from 'lucide-react';

// Mock visualization - in a real app, use a charting library like recharts
// for this example we'll use a simplified visualization

interface PathTransition {
  source: string;
  target: string;
  count: number;
}

interface EntryPage {
  path: string;
  count: number;
  percentage: number;
}

interface ExitPage {
  path: string;
  count: number;
  percentage: number;
}

interface UserJourneyData {
  pathTransitions: PathTransition[];
  entryPages: EntryPage[];
  exitPages: ExitPage[];
}

// Function to format paths for better display
function formatPath(path: string): string {
  if (path === '/') return 'Home';
  
  // Remove leading slash and capitalize
  const formatted = path.replace(/^\//, '').replace(/-/g, ' ');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function UserJourneyVisualization() {
  const [activeTab, setActiveTab] = useState('path-transitions');
  const [dateRange, setDateRange] = useState('30');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [journeyData, setJourneyData] = useState<UserJourneyData>({
    pathTransitions: [],
    entryPages: [],
    exitPages: []
  });

  // Function to fetch journey data
  const fetchJourneyData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Prepare date parameters
      let startDate, endDate;
      
      if (dateRange === 'today') {
        const today = new Date();
        startDate = today.toISOString().split('T')[0];
        endDate = startDate;
      } else if (dateRange === '7' || dateRange === '30' || dateRange === '90') {
        const today = new Date();
        const pastDate = new Date();
        pastDate.setDate(today.getDate() - parseInt(dateRange));
        startDate = pastDate.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
      } else {
        // Custom date range would be handled here
        const today = new Date();
        const pastDate = new Date();
        pastDate.setDate(today.getDate() - 30);
        startDate = pastDate.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
      }
      
      // Fetch journey data from API
      const response = await fetch(`/user-journey?startDate=${startDate}&endDate=${endDate}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setJourneyData({
          pathTransitions: data.pathTransitions || [],
          entryPages: data.entryPages || [],
          exitPages: data.exitPages || []
        });
      } else {
        throw new Error(data.message || 'Failed to fetch journey data');
      }
    } catch (err) {
      console.error('Error fetching user journey data:', err);
      setError('Failed to load user journey data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on mount and when date range changes
  useEffect(() => {
    fetchJourneyData();
  }, [dateRange]);

  // Path Transitions Visualization
  const PathTransitionsView = () => (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center p-4 text-destructive">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={fetchJourneyData} className="mt-2">
            Try Again
          </Button>
        </div>
      ) : journeyData.pathTransitions.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <p>No path transition data available for this time period</p>
        </div>
      ) : (
        <div className="space-y-3">
          {journeyData.pathTransitions
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
            .map((transition, index) => (
              <div key={index} className="border rounded-md p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <GitFork className="h-4 w-4 text-primary" />
                  </div>
                  <div className="font-medium">{formatPath(transition.source)}</div>
                  <div className="text-muted-foreground">→</div>
                  <div className="font-medium">{formatPath(transition.target)}</div>
                </div>
                <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-primary"
                    style={{ 
                      width: `${Math.min(100, (transition.count / journeyData.pathTransitions[0].count) * 100)}%` 
                    }}
                  />
                </div>
                <div className="mt-1 text-xs text-right text-muted-foreground">
                  {transition.count} transitions
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  // Entry Pages Visualization
  const EntryPagesView = () => (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center p-4 text-destructive">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={fetchJourneyData} className="mt-2">
            Try Again
          </Button>
        </div>
      ) : journeyData.entryPages.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <p>No entry page data available for this time period</p>
        </div>
      ) : (
        <div className="space-y-3">
          {journeyData.entryPages
            .sort((a, b) => b.count - a.count)
            .map((page, index) => (
              <div key={index} className="border rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="bg-green-100 p-2 rounded-full">
                      <LogIn className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="font-medium">{formatPath(page.path)}</div>
                  </div>
                  <Badge variant="outline">{page.percentage}%</Badge>
                </div>
                <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-green-500"
                    style={{ width: `${page.percentage}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-right text-muted-foreground">
                  {page.count} entries
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  // Exit Pages Visualization
  const ExitPagesView = () => (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center p-4 text-destructive">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={fetchJourneyData} className="mt-2">
            Try Again
          </Button>
        </div>
      ) : journeyData.exitPages.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <p>No exit page data available for this time period</p>
        </div>
      ) : (
        <div className="space-y-3">
          {journeyData.exitPages
            .sort((a, b) => b.count - a.count)
            .map((page, index) => (
              <div key={index} className="border rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="bg-red-100 p-2 rounded-full">
                      <LogOut className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="font-medium">{formatPath(page.path)}</div>
                  </div>
                  <Badge variant="outline">{page.percentage}%</Badge>
                </div>
                <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-red-500"
                    style={{ width: `${page.percentage}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-right text-muted-foreground">
                  {page.count} exits
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
          <CardTitle className="flex items-center">
            <GitFork className="h-5 w-5 text-primary mr-2" /> 
            User Journey Analysis
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Select 
              value={dateRange} 
              onValueChange={setDateRange}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Last 30 days" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={fetchJourneyData} 
              title="Refresh data"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <CardDescription>
          Visualize how users navigate through your site
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="path-transitions">Path Transitions</TabsTrigger>
            <TabsTrigger value="entry-pages">Entry Pages</TabsTrigger>
            <TabsTrigger value="exit-pages">Exit Pages</TabsTrigger>
          </TabsList>
          
          <TabsContent value="path-transitions" className="mt-4">
            <PathTransitionsView />
          </TabsContent>
          
          <TabsContent value="entry-pages" className="mt-4">
            <EntryPagesView />
          </TabsContent>
          
          <TabsContent value="exit-pages" className="mt-4">
            <ExitPagesView />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}