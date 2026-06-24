import React from 'react';
import { useLocation } from 'wouter';
import { BarChart3, Users, Eye, Clock, LineChart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function AnalyticsDirectCard() {
  const [, navigate] = useLocation();

  return (
    <div className="mb-10">
      <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        Analytics
      </h2>
      
      <Card className="overflow-hidden border-solid !border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl text-primary flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Analytics Dashboard
            </CardTitle>
            
            <div className="bg-muted px-2 py-1 rounded text-xs font-medium">
              NEW!
            </div>
          </div>
          <CardDescription>Complete visitor tracking and behavior analytics</CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-white dark:bg-muted rounded p-2 text-center">
              <Users className="h-4 w-4 text-blue-500 mx-auto mb-1" />
              <div className="text-lg font-bold">4,321</div>
              <div className="text-xs text-muted-foreground">Active Users</div>
            </div>
            
            <div className="bg-white dark:bg-muted rounded p-2 text-center">
              <Eye className="h-4 w-4 text-green-500 mx-auto mb-1" />
              <div className="text-lg font-bold">12.8k</div>
              <div className="text-xs text-muted-foreground">Page Views</div>
            </div>
            
            <div className="bg-white dark:bg-muted rounded p-2 text-center">
              <Clock className="h-4 w-4 text-amber-500 mx-auto mb-1" />
              <div className="text-lg font-bold">4:32</div>
              <div className="text-xs text-muted-foreground">Avg. Time</div>
            </div>
            
            <div className="bg-white dark:bg-muted rounded p-2 text-center">
              <LineChart className="h-4 w-4 text-indigo-500 mx-auto mb-1" />
              <div className="text-lg font-bold">+6%</div>
              <div className="text-xs text-muted-foreground">Growth</div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="pt-0">
          <Button 
            onClick={() => navigate('/analytics-dashboard')}
            className="w-full"
          >
            Manage
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}