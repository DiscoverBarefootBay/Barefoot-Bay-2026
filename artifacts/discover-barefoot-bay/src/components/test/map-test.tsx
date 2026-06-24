import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StaticMapImage } from '@/components/calendar/static-map-image';
import { Separator } from '@/components/ui/separator';

export function MapTest() {
  const [location, setLocation] = useState('625 Barefoot Blvd, Barefoot Bay, FL, USA');
  const [width, setWidth] = useState(400);
  const [height, setHeight] = useState(300);
  const [zoom, setZoom] = useState(15);
  const [showFallback, setShowFallback] = useState(true);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Google Maps Integration Test</CardTitle>
          <CardDescription>
            Test the enhanced Google Maps component with fallback mechanisms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="location">Location</Label>
                <Input 
                  id="location" 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)} 
                  placeholder="Enter an address" 
                />
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="width">Width</Label>
                  <Input 
                    id="width" 
                    type="number" 
                    value={width} 
                    onChange={(e) => setWidth(parseInt(e.target.value) || 400)} 
                  />
                </div>
                <div>
                  <Label htmlFor="height">Height</Label>
                  <Input 
                    id="height" 
                    type="number" 
                    value={height} 
                    onChange={(e) => setHeight(parseInt(e.target.value) || 300)} 
                  />
                </div>
                <div>
                  <Label htmlFor="zoom">Zoom</Label>
                  <Input 
                    id="zoom" 
                    type="number" 
                    min="1" 
                    max="20" 
                    value={zoom} 
                    onChange={(e) => setZoom(parseInt(e.target.value) || 15)} 
                  />
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="show-fallback"
                checked={showFallback}
                onChange={(e) => setShowFallback(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="show-fallback">Show fallback content when map fails to load</Label>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button
            onClick={() => {
              // Reset to default settings
              setLocation('625 Barefoot Blvd, Barefoot Bay, FL, USA');
              setWidth(400);
              setHeight(300);
              setZoom(15);
            }}
          >
            Reset
          </Button>
        </CardFooter>
      </Card>

      <Tabs defaultValue="proxy" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="proxy">Server Proxy Approach</TabsTrigger>
          <TabsTrigger value="direct">Enhanced Component</TabsTrigger>
        </TabsList>
        
        <TabsContent value="proxy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Server Proxy Implementation</CardTitle>
              <CardDescription>
                Using the server-side proxy at /api/google/staticmap
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <img 
                  src={`/api/google/staticmap?center=${encodeURIComponent(location)}&zoom=${zoom}&size=${width}x${height}&markers=color:red|${encodeURIComponent(location)}`}
                  alt={`Map of ${location}`}
                  width={width}
                  height={height}
                  className="border border-gray-200 rounded-md"
                  onError={(e) => {
                    console.error("Error loading map image via proxy");
                    e.currentTarget.style.display = showFallback ? 'none' : 'block';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className={`hidden flex flex-col items-center justify-center p-4 bg-gray-100 rounded-md`} style={{ width, height, minHeight: '200px' }}>
                  <p className="text-sm font-medium mb-1">Map Failed to Load</p>
                  <p className="text-xs text-muted-foreground mb-3">Server proxy error</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank')}
                  >
                    View on Google Maps
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="direct" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enhanced StaticMapImage Component</CardTitle>
              <CardDescription>
                New implementation with automatic fallback mechanism
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <StaticMapImage
                  location={location}
                  width={width}
                  height={height}
                  zoom={zoom}
                  showFallback={showFallback}
                  className="border border-gray-200 rounded-md"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Direct URL Preview</CardTitle>
          <CardDescription>
            Direct URL to Google Maps with search query
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              This link will always work regardless of API key or referrer issues:
            </p>
            <p className="text-sm break-all p-2 bg-muted rounded-md">
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                https://www.google.com/maps/search/?api=1&query={encodeURIComponent(location)}
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-amber-50">
        <CardHeader>
          <CardTitle>Implementation Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li>
              The enhanced component tries both direct API access and server proxy.
            </li>
            <li>
              In production, API key restrictions cause 403 errors in direct mode.
            </li>
            <li>
              The server-side proxy approach should work in all environments.
            </li>
            <li>
              The fallback mechanism ensures location information is always accessible.
            </li>
            <li>
              Direct Google Maps URL will open Google Maps in a new tab as the guaranteed fallback.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}