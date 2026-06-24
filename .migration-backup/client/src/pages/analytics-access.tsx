import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layouts/layout';
import { useAuth } from '@/hooks/use-auth';

export default function DirectAnalyticsAccess() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    // Check if user is admin
    if (user && user.role === 'admin') {
      setIsAdmin(true);
    }
  }, [user]);
  
  return (
    <Layout>
      <div className="container mx-auto py-10 px-4 md:px-6">
        <h1 className="text-3xl font-bold mb-6">Analytics Dashboards Access</h1>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* Admin-only Dashboards */}
          <Card>
            <CardHeader>
              <CardTitle>Standard Analytics Dashboard</CardTitle>
              <CardDescription>
                Basic site statistics and visitor metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                This dashboard provides an overview of site traffic, page views, and user activity.
              </p>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => navigate('/admin/analytics-dashboard')}
                disabled={!isAdmin}
                className="w-full"
              >
                Access Standard Dashboard
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Enhanced Analytics Dashboard</CardTitle>
              <CardDescription>
                Advanced metrics and visitor behavior analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                Access comprehensive analytics with geolocation mapping, traffic metrics, 
                bounce rates, and user journey visualization.
              </p>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => navigate('/admin/enhanced-analytics')}
                disabled={!isAdmin}
                className="w-full bg-green-600 hover:bg-green-700"
                variant="default"
              >
                Access Enhanced Dashboard
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <h2 className="text-2xl font-bold mt-12 mb-6">Public Access Dashboards</h2>
        <p className="mb-6">These dashboards are accessible without authentication:</p>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* Public Access Dashboards */}
          <Card className="border-green-200">
            <CardHeader className="bg-green-50 border-b border-green-100">
              <CardTitle>Public Analytics Dashboard</CardTitle>
              <CardDescription>
                Direct access to enhanced analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                Access all analytics data without authentication. This dashboard includes
                traffic metrics, bounce rates, and engagement statistics.
              </p>
              <p className="text-xs text-green-600">No login required</p>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => window.open('/enhanced-analytics', '_blank')}
                className="w-full"
                variant="outline"
              >
                Open Public Dashboard
              </Button>
            </CardFooter>
          </Card>
          
          <Card className="border-green-200">
            <CardHeader className="bg-green-50 border-b border-green-100">
              <CardTitle>Direct Analytics Dashboard</CardTitle>
              <CardDescription>
                Simplified analytics interface
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                A clean, minimal interface showing key metrics including visitor counts,
                traffic sources, and engagement statistics.
              </p>
              <p className="text-xs text-green-600">No login required</p>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => window.open('/direct-analytics', '_blank')}
                className="w-full"
                variant="outline"
              >
                Open Direct Dashboard
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        {!isAdmin && (
          <div className="mt-6 p-4 border border-yellow-500 rounded-md bg-yellow-50 text-yellow-800">
            <p className="font-semibold">Administrator access required</p>
            <p className="text-sm mt-1">
              You must be logged in as an administrator to access the analytics dashboards.
            </p>
          </div>
        )}
        
        <div className="mt-10">
          <h2 className="text-xl font-bold mb-4">Direct Dashboard Links</h2>
          <div className="space-y-2">
            <div className="p-3 bg-gray-50 rounded border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-medium">Standard Analytics Dashboard</p>
                <p className="text-sm text-gray-500">/admin/analytics-dashboard</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + '/admin/analytics-dashboard');
                }}
              >
                Copy Link
              </Button>
            </div>
            
            <div className="p-3 bg-gray-50 rounded border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-medium">Enhanced Analytics Dashboard</p>
                <p className="text-sm text-gray-500">/admin/enhanced-analytics</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + '/admin/enhanced-analytics');
                }}
              >
                Copy Link
              </Button>
            </div>
            
            <div className="p-3 bg-gray-50 rounded border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-medium">Alternative Enhanced Analytics URL</p>
                <p className="text-sm text-gray-500">/admin/enhanced-analytics-dashboard</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + '/admin/enhanced-analytics-dashboard');
                }}
              >
                Copy Link
              </Button>
            </div>
          </div>
          
          <h2 className="text-xl font-bold mb-4 mt-8">Public Access Dashboard URLs</h2>
          <div className="space-y-2">
            <div className="p-3 bg-green-50 rounded border border-green-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-medium">Enhanced Analytics (Public Access)</p>
                <p className="text-sm text-gray-500">/enhanced-analytics</p>
                <p className="text-xs text-green-600 mt-1">No authentication required</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin + '/enhanced-analytics');
                  }}
                >
                  Copy Link
                </Button>
                <Button
                  size="sm"
                  onClick={() => window.open('/enhanced-analytics', '_blank')}
                >
                  Open
                </Button>
              </div>
            </div>
            
            <div className="p-3 bg-green-50 rounded border border-green-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-medium">Direct Analytics Dashboard</p>
                <p className="text-sm text-gray-500">/direct-analytics</p>
                <p className="text-xs text-green-600 mt-1">Clean interface, no authentication required</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin + '/direct-analytics');
                  }}
                >
                  Copy Link
                </Button>
                <Button
                  size="sm"
                  onClick={() => window.open('/direct-analytics', '_blank')}
                >
                  Open
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}