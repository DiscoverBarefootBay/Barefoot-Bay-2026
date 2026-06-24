import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  GoogleMap, 
  LoadScript, 
  Marker, 
  InfoWindow,
  HeatmapLayer
} from '@react-google-maps/api';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/date-picker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MapPin } from 'lucide-react';

// Define our map container styles
const mapContainerStyle = {
  width: '100%',
  height: '600px',
};

// Default map center (can be adjusted based on visitor data)
const defaultCenter = {
  lat: 20,
  lng: 0,
};

// Define interface for geolocation data
interface GeoLocation {
  sessionId: string;
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  views: number;
  lastActive: string;
  topPages: { path: string; count: number }[];
}

interface CountryVisitors {
  country: string;
  count: number;
}

const GeoLocationMap: React.FC = () => {
  const [mapTab, setMapTab] = useState<'pins' | 'heatmap'>('pins');
  const [startDate, setStartDate] = useState<Date | undefined>(
    () => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date;
    }
  );
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [pageFilter, setPageFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<GeoLocation | null>(null);
  
  // Fetch geolocation data
  const { data: geoData, isLoading: isLoadingGeo, refetch: refetchGeo } = useQuery<GeoLocation[]>({
    queryKey: ['analytics', 'geo-location', startDate, endDate, pageFilter, countryFilter],
    queryFn: async () => {
      // Build query parameters
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      if (pageFilter) params.append('page', pageFilter);
      if (countryFilter) params.append('country', countryFilter);
      
      const response = await apiRequest('GET', `/api/analytics/geo-location?${params.toString()}`);
      return await response.json();
    },
    enabled: true
  });
  
  // Fetch country visitor data for heatmap
  const { data: countryData, isLoading: isLoadingCountry } = useQuery<CountryVisitors[]>({
    queryKey: ['analytics', 'country-visitors', startDate, endDate, pageFilter],
    queryFn: async () => {
      // Build query parameters
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      if (pageFilter) params.append('page', pageFilter);
      
      const response = await apiRequest('GET', `/api/analytics/country-visitors?${params.toString()}`);
      return await response.json();
    },
    enabled: mapTab === 'heatmap'
  });
  
  const handleApplyFilters = () => {
    refetchGeo();
  };
  
  // Prepare heatmap data (if available)
  const heatmapData = React.useMemo(() => {
    if (!filteredGeoData || filteredGeoData.length === 0) return [];
    
    return filteredGeoData.map(location => ({
      location: new google.maps.LatLng(location.latitude, location.longitude),
      weight: location.views || 1
    }));
  }, [filteredGeoData]);
  
  // Loading state
  if (isLoadingGeo && !geoData) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading visitor location data...</span>
      </div>
    );
  }
  
  // Filter out entries without valid coordinates
  const filteredGeoData = geoData?.filter(loc => 
    loc && loc.latitude !== null && loc.longitude !== null && 
    !isNaN(loc.latitude) && !isNaN(loc.longitude)
  ) || [];
  
  // Check if we have any valid location data
  const hasLocationData = filteredGeoData.length > 0;
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Visitor Geolocation Map</CardTitle>
        <CardDescription>
          Visualize where your website visitors are coming from around the world
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <DatePicker
                id="startDate" 
                date={startDate} 
                setDate={setStartDate}
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <DatePicker
                id="endDate" 
                date={endDate} 
                setDate={setEndDate}
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="pageFilter">Page Path (Optional)</Label>
              <Input
                id="pageFilter"
                placeholder="/path/to/page"
                value={pageFilter}
                onChange={(e) => setPageFilter(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="countryFilter">Country (Optional)</Label>
              <Input
                id="countryFilter"
                placeholder="Country code (e.g., US)"
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleApplyFilters}>Apply Filters</Button>
          </div>
        </div>
        
        <Tabs value={mapTab} onValueChange={(value) => setMapTab(value as 'pins' | 'heatmap')}>
          <TabsList className="mb-4">
            <TabsTrigger value="pins">Location Pins</TabsTrigger>
            <TabsTrigger value="heatmap">Heatmap View</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pins" className="mt-0">
            {!hasLocationData ? (
              <div className="flex flex-col items-center justify-center bg-muted/20 rounded-md p-8 min-h-[400px]">
                <MapPin className="h-12 w-12 text-muted mb-4" />
                <h3 className="text-lg font-medium mb-2">No Location Data Available</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  There is no geolocation data available for the selected time period. This could be because:
                </p>
                <ul className="text-sm text-muted-foreground mt-2 list-disc space-y-1 pl-6">
                  <li>No visitors with IP address data have been tracked yet</li>
                  <li>IP addresses couldn't be resolved to geographic locations</li>
                  <li>Your current filters don't match any visitors with location data</li>
                </ul>
                <Button 
                  className="mt-4" 
                  variant="outline" 
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(new Date());
                    setPageFilter('');
                    setCountryFilter('');
                    setTimeout(() => refetchGeo(), 0);
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            ) : (
              <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={defaultCenter}
                  zoom={2}
                  options={{
                    styles: [
                      {
                        featureType: 'administrative',
                        elementType: 'geometry',
                        stylers: [{ visibility: 'on' }],
                      },
                    ],
                  }}
                >
                  {filteredGeoData.map((location) => (
                    <Marker
                      key={`${location.sessionId}-${location.latitude}-${location.longitude}`}
                      position={{
                        lat: location.latitude,
                        lng: location.longitude,
                      }}
                      onClick={() => setSelectedLocation(location)}
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 8 + Math.min(location.views / 2, 8), // Size based on views
                        fillColor: '#3b82f6',
                        fillOpacity: 0.7,
                        strokeWeight: 1,
                        strokeColor: '#1d4ed8',
                      }}
                    />
                  ))}
                  
                  {selectedLocation && (
                    <InfoWindow
                      position={{
                        lat: selectedLocation.latitude,
                        lng: selectedLocation.longitude,
                      }}
                      onCloseClick={() => setSelectedLocation(null)}
                    >
                      <div className="p-2 max-w-sm">
                        <h3 className="font-bold text-gray-800">
                          {selectedLocation.city}, {selectedLocation.region}, {selectedLocation.country}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Views: {selectedLocation.views}
                        </p>
                        <p className="text-sm text-gray-600">
                          Last active: {new Date(selectedLocation.lastActive).toLocaleString()}
                        </p>
                        {selectedLocation.topPages?.length > 0 && (
                          <div className="mt-2">
                            <h4 className="text-sm font-semibold">Top Pages:</h4>
                            <ul className="text-xs text-gray-600 max-h-32 overflow-auto">
                              {selectedLocation.topPages.map((page, i) => (
                                <li key={i} className="truncate">
                                  {page.path} <span className="text-gray-400">({page.count})</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              </LoadScript>
            )}
          </TabsContent>
          
          <TabsContent value="heatmap" className="mt-0">
            {!hasLocationData ? (
              <div className="flex flex-col items-center justify-center bg-muted/20 rounded-md p-8 min-h-[400px]">
                <MapPin className="h-12 w-12 text-muted mb-4" />
                <h3 className="text-lg font-medium mb-2">No Location Data Available</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  There is no geolocation data available for the heatmap. This could be because:
                </p>
                <ul className="text-sm text-muted-foreground mt-2 list-disc space-y-1 pl-6">
                  <li>No visitors with IP address data have been tracked yet</li>
                  <li>IP addresses couldn't be resolved to geographic locations</li>
                  <li>Your current filters don't match any visitors with location data</li>
                </ul>
                <Button 
                  className="mt-4" 
                  variant="outline" 
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(new Date());
                    setPageFilter('');
                    setCountryFilter('');
                    setTimeout(() => refetchGeo(), 0);
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            ) : (
              <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={defaultCenter}
                  zoom={2}
                >
                  {heatmapData.length > 0 && (
                    <HeatmapLayer
                      data={heatmapData}
                      options={{
                        radius: 20,
                        opacity: 0.7,
                        gradient: [
                          'rgba(0, 255, 255, 0)',
                          'rgba(0, 255, 255, 1)',
                          'rgba(0, 191, 255, 1)',
                          'rgba(0, 127, 255, 1)',
                          'rgba(0, 63, 255, 1)',
                          'rgba(0, 0, 255, 1)',
                          'rgba(0, 0, 223, 1)',
                          'rgba(0, 0, 191, 1)',
                          'rgba(0, 0, 159, 1)',
                          'rgba(0, 0, 127, 1)',
                          'rgba(63, 0, 91, 1)',
                          'rgba(127, 0, 63, 1)',
                          'rgba(191, 0, 31, 1)',
                          'rgba(255, 0, 0, 1)'
                        ]
                      }}
                    />
                  )}
                </GoogleMap>
              </LoadScript>
            )}
            
            {/* Country visitor counts displayed as a list */}
            <div className="mt-6 bg-accent/30 rounded-md p-4">
              <h3 className="font-medium mb-2">Visitor Count by Country</h3>
              {isLoadingCountry ? (
                <div className="flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Loading country data...</span>
                </div>
              ) : countryData && countryData.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {countryData.map(item => (
                    <div key={item.country} className="flex items-center text-sm">
                      <MapPin className="h-3.5 w-3.5 text-primary mr-1" />
                      <span className="font-medium">{item.country}:</span>
                      <span className="ml-1">{item.count} visitors</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No country data available for the selected filters.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        <p className="text-xs text-muted-foreground mt-4">
          Note: The map displays approximate visitor locations based on IP addresses.
          For privacy reasons, exact locations are not tracked or stored.
        </p>
      </CardContent>
    </Card>
  );
};

export default GeoLocationMap;