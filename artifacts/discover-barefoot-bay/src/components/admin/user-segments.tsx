import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Users, Clock, CalendarDays, ArrowUpDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

// Types for user segment data
interface UserSegment {
  name: string;
  count: number;
  percentage: number;
}

interface SegmentData {
  totalUsers: number;
  activitySegments: UserSegment[];
  frequencySegments: UserSegment[];
  retentionSegments: UserSegment[];
  conversionSegments: UserSegment[];
  timeSegments: UserSegment[];
}

export function UserSegments() {
  const [activeTab, setActiveTab] = useState('activity');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [segmentData, setSegmentData] = useState<SegmentData>({
    totalUsers: 0,
    activitySegments: [],
    frequencySegments: [],
    retentionSegments: [],
    conversionSegments: [],
    timeSegments: []
  });

  // Colors for charts
  const COLORS = [
    '#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c',
    '#d0ed57', '#ffc658', '#ff8042', '#ff5252', '#e97efd'
  ];

  // Fetch user segment data
  const fetchSegmentData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/analytics/user-segments', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user segment data: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSegmentData({
          totalUsers: data.totalUsers || 0,
          activitySegments: data.activitySegments || [],
          frequencySegments: data.frequencySegments || [],
          retentionSegments: data.retentionSegments || [],
          conversionSegments: data.conversionSegments || [],
          timeSegments: data.timeSegments || []
        });
      } else {
        throw new Error(data.message || 'Failed to fetch segment data');
      }
    } catch (err) {
      console.error('Error fetching user segments:', err);
      setError('Failed to load user segment data');
      
      // Keep any existing data
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch data on component mount
  useEffect(() => {
    fetchSegmentData();
  }, []);
  
  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  
  // Create a chart component for segments
  const SegmentBarChart = ({ data }: { data: UserSegment[] }) => (
    <div className="h-[300px] w-full mt-4">
      {isLoading ? (
        <div className="flex justify-center items-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex justify-center items-center h-full text-destructive">
          <p>{error}</p>
        </div>
      ) : data.length === 0 ? (
        <div className="flex justify-center items-center h-full text-muted-foreground">
          <p>No segment data available</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={120}
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              formatter={(value: any) => [`${value} users`, 'Count']}
              labelFormatter={(label) => `Segment: ${label}`}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
  
  // Create a pie chart component for segments
  const SegmentPieChart = ({ data }: { data: UserSegment[] }) => (
    <div className="h-[300px] w-full mt-4">
      {isLoading ? (
        <div className="flex justify-center items-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex justify-center items-center h-full text-destructive">
          <p>{error}</p>
        </div>
      ) : data.length === 0 ? (
        <div className="flex justify-center items-center h-full text-muted-foreground">
          <p>No segment data available</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={100}
              fill="#8884d8"
              dataKey="count"
              nameKey="name"
              label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: any) => [`${value} users (${data.find(d => d.count === value)?.percentage}%)`, 'Count']}
              labelFormatter={(name) => `Segment: ${name}`}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
  
  // Render different segments based on the active tab
  const renderActiveSegment = () => {
    switch (activeTab) {
      case 'activity':
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-indigo-500" />
                <h3 className="text-lg font-medium">Activity Segments</h3>
              </div>
              <Badge variant="outline">
                {formatNumber(segmentData.totalUsers)} Total Users
              </Badge>
            </div>
            <p className="text-muted-foreground mb-4">
              Users segmented by their activity level on the platform
            </p>
            <SegmentBarChart data={segmentData.activitySegments} />
          </div>
        );
        
      case 'frequency':
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <ArrowUpDown className="h-5 w-5 text-green-500" />
                <h3 className="text-lg font-medium">Visit Frequency</h3>
              </div>
              <Badge variant="outline">
                {formatNumber(segmentData.totalUsers)} Total Users
              </Badge>
            </div>
            <p className="text-muted-foreground mb-4">
              Users segmented by how frequently they visit the platform
            </p>
            <SegmentPieChart data={segmentData.frequencySegments} />
          </div>
        );
        
      case 'retention':
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <CalendarDays className="h-5 w-5 text-blue-500" />
                <h3 className="text-lg font-medium">Retention Segments</h3>
              </div>
              <Badge variant="outline">
                {formatNumber(segmentData.totalUsers)} Total Users
              </Badge>
            </div>
            <p className="text-muted-foreground mb-4">
              Users segmented by how recently they've returned to the platform
            </p>
            <SegmentBarChart data={segmentData.retentionSegments} />
          </div>
        );
        
      case 'time':
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <h3 className="text-lg font-medium">Time-Based Segments</h3>
              </div>
              <Badge variant="outline">
                {formatNumber(segmentData.totalUsers)} Total Users
              </Badge>
            </div>
            <p className="text-muted-foreground mb-4">
              Users segmented by when they are most active on the platform
            </p>
            <SegmentPieChart data={segmentData.timeSegments} />
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>User Segmentation</CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={fetchSegmentData} 
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          Analyze your user base by behavior and demographics
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs 
          defaultValue="activity" 
          value={activeTab} 
          onValueChange={setActiveTab}
        >
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="frequency">Frequency</TabsTrigger>
            <TabsTrigger value="retention">Retention</TabsTrigger>
            <TabsTrigger value="time">Time</TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab}>
            {renderActiveSegment()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}