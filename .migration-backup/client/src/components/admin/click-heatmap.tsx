import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, MousePointerClick } from 'lucide-react';
import { format } from 'date-fns';

// Interface for click data
interface ClickData {
  x: number;
  y: number;
  path: string;
  timestamp: string;
  elementType?: string;
  elementId?: string;
}

// Generate color based on density
const getHeatmapColor = (intensity: number): string => {
  // Scale from transparent to red
  const alpha = Math.min(0.85, intensity);
  return `rgba(239, 68, 68, ${alpha})`;
};

export function ClickHeatmap() {
  const [clickData, setClickData] = useState<ClickData[]>([]);
  const [selectedPage, setSelectedPage] = useState<string>('/');
  const [availablePages, setAvailablePages] = useState<string[]>(['/']);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch click data from server
  const fetchClickData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // This would fetch real data in production
      const response = await fetch('/api/analytics/click-data', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch click data: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Process and set the click data
      if (data.clicks && Array.isArray(data.clicks)) {
        setClickData(data.clicks);
        
        // Extract unique pages
        const pages = Array.from(new Set(data.clicks.map((click: ClickData) => click.path)));
        if (pages.length > 0) {
          setAvailablePages(pages);
          if (!pages.includes(selectedPage)) {
            setSelectedPage(pages[0]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching click data:', err);
      setError('Failed to load click heatmap data');
      
      // For demo purposes only - in production this would use actual data
      if (process.env.NODE_ENV === 'development') {
        generateDemoData();
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Generate demo data - only for development/preview
  const generateDemoData = () => {
    const demoPages = ['/', '/about', '/products', '/contact'];
    const demoClicks: ClickData[] = [];
    
    // Generate 100 random clicks across demo pages
    for (let i = 0; i < 100; i++) {
      const pageIndex = Math.floor(Math.random() * demoPages.length);
      const path = demoPages[pageIndex];
      
      // Create clusters of clicks in different areas to simulate real behavior
      let x, y;
      
      // Different hotspot areas for different pages
      if (path === '/') {
        // Navigation area
        if (Math.random() < 0.4) {
          x = 100 + Math.random() * 800;
          y = 50 + Math.random() * 60;
        } 
        // Hero CTA
        else if (Math.random() < 0.7) {
          x = 400 + Math.random() * 200;
          y = 300 + Math.random() * 100;
        }
        // Random elsewhere
        else {
          x = Math.random() * 1000;
          y = Math.random() * 600;
        }
      } else {
        // More random distribution for other pages
        x = Math.random() * 1000;
        y = Math.random() * 600;
      }
      
      demoClicks.push({
        x,
        y,
        path,
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        elementType: Math.random() > 0.5 ? 'button' : 'link',
        elementId: `element-${Math.floor(Math.random() * 10)}`
      });
    }
    
    setClickData(demoClicks);
    setAvailablePages(demoPages);
    if (!demoPages.includes(selectedPage)) {
      setSelectedPage(demoPages[0]);
    }
  };
  
  // Fetch data on component mount
  useEffect(() => {
    fetchClickData();
  }, []);
  
  // Filter clicks for the selected page
  const pageClicks = clickData.filter(click => click.path === selectedPage);
  
  // Generate heatmap points based on click proximity
  const generateHeatmapPoints = () => {
    // Group nearby clicks together to create heatmap points
    const gridSize = 50; // Size of each cell in the grid
    const grid: Record<string, { x: number, y: number, count: number }> = {};
    
    pageClicks.forEach(click => {
      // Round to nearest grid cell
      const gridX = Math.floor(click.x / gridSize) * gridSize;
      const gridY = Math.floor(click.y / gridSize) * gridSize;
      const key = `${gridX},${gridY}`;
      
      if (!grid[key]) {
        grid[key] = { x: gridX, y: gridY, count: 0 };
      }
      grid[key].count++;
    });
    
    return Object.values(grid);
  };
  
  const heatmapPoints = generateHeatmapPoints();
  const maxCount = heatmapPoints.length > 0 
    ? Math.max(...heatmapPoints.map(point => point.count)) 
    : 1;
  
  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle>Click Heatmap</CardTitle>
            <MousePointerClick className="h-4 w-4 ml-2 text-primary" />
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={fetchClickData} 
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          Visualize where users are clicking on your pages
        </CardDescription>
      </CardHeader>
      
      <Separator />
      
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col justify-center items-center h-[400px] text-destructive">
            <p className="mb-4">{error}</p>
            <Button variant="outline" onClick={fetchClickData}>Try Again</Button>
          </div>
        ) : clickData.length === 0 ? (
          <div className="flex justify-center items-center h-[400px] text-muted-foreground">
            <p>No click data available yet</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Tabs 
                value={selectedPage} 
                onValueChange={setSelectedPage}
                className="w-full"
              >
                <TabsList className="mb-4 flex flex-wrap">
                  {availablePages.map(page => (
                    <TabsTrigger 
                      key={page} 
                      value={page}
                      className="text-xs md:text-sm"
                    >
                      {page === '/' ? 'Home' : page.replace(/^\//, '')}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                {availablePages.map(page => (
                  <TabsContent key={page} value={page} className="mt-0">
                    <div className="relative w-full h-[400px] border rounded-md overflow-hidden bg-gray-50">
                      {/* Page mockup background */}
                      <div className="absolute inset-0 opacity-10">
                        <div className="h-12 bg-gray-200 w-full"></div>
                        <div className="p-4">
                          <div className="h-40 bg-gray-200 rounded-md w-full mb-4"></div>
                          <div className="h-20 bg-gray-200 rounded-md w-3/4 mb-4"></div>
                          <div className="h-8 bg-gray-200 rounded-md w-1/2 mb-2"></div>
                          <div className="h-8 bg-gray-200 rounded-md w-1/3"></div>
                        </div>
                      </div>
                      
                      {/* Heatmap layer */}
                      {heatmapPoints.map((point, index) => (
                        <div 
                          key={index}
                          className="absolute rounded-full"
                          style={{
                            left: `${point.x}px`,
                            top: `${point.y}px`,
                            width: `${gridSize * 2}px`,
                            height: `${gridSize * 2}px`,
                            backgroundColor: getHeatmapColor(point.count / maxCount),
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'none'
                          }}
                        />
                      ))}
                      
                      {/* Click dots */}
                      {pageClicks.map((click, index) => (
                        <div 
                          key={index}
                          className="absolute w-2 h-2 bg-red-600 rounded-full"
                          style={{
                            left: `${click.x}px`,
                            top: `${click.y}px`,
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'none'
                          }}
                          title={`Clicked at ${format(new Date(click.timestamp), 'MM/dd/yyyy HH:mm')}`}
                        />
                      ))}
                    </div>
                    
                    <div className="mt-2 text-sm text-right text-muted-foreground">
                      {pageClicks.length} clicks on this page
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}