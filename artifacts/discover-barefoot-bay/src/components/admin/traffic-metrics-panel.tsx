import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Users, Globe, UserCheck, UserX, Activity } from 'lucide-react';
import { formatNumber } from '@/lib/format-utils';

interface TrafficData {
  totalUniqueVisitors: number;
  totalUniqueIPs: number;
  totalAuthenticatedUsers: number;
  totalUnauthenticatedUsers: number;
  totalBounces: number;
  bounceRate: number;
}

interface TrafficMetricsPanelProps {
  isLoading: boolean;
  data: TrafficData;
}

export const TrafficMetricsPanel: React.FC<TrafficMetricsPanelProps> = ({ isLoading, data }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Traffic Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="grid">
          <TabsList className="mb-4">
            <TabsTrigger value="grid">Grid View</TabsTrigger>
            <TabsTrigger value="list">List View</TabsTrigger>
          </TabsList>
          
          <TabsContent value="grid">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                title="Total Unique Visitors"
                value={data.totalUniqueVisitors}
                icon={<Users className="h-4 w-4" />}
                isLoading={isLoading}
                description="Unique visitor sessions"
              />
              
              <MetricCard
                title="Unique IP Addresses"
                value={data.totalUniqueIPs}
                icon={<Globe className="h-4 w-4" />}
                isLoading={isLoading}
                description="Distinct IPs accessing the site"
              />
              
              <MetricCard
                title="Authenticated Users"
                value={data.totalAuthenticatedUsers}
                icon={<UserCheck className="h-4 w-4" />}
                isLoading={isLoading}
                description="Signed-in users"
              />
              
              <MetricCard
                title="Unauthenticated Users"
                value={data.totalUnauthenticatedUsers}
                icon={<UserX className="h-4 w-4" />}
                isLoading={isLoading}
                description="Unsigned users"
              />
              
              <MetricCard
                title="Bounce Count"
                value={data.totalBounces}
                icon={<Activity className="h-4 w-4" />}
                isLoading={isLoading}
                description="Single page visits"
              />
              
              <MetricCard
                title="Bounce Rate"
                value={data.bounceRate}
                icon={<Activity className="h-4 w-4" />}
                isLoading={isLoading}
                description="Percentage of single page visits"
                suffix="%"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="list">
            <div className="space-y-4">
              <MetricListItem
                title="Total Unique Visitors"
                value={data.totalUniqueVisitors}
                icon={<Users className="h-4 w-4" />}
                isLoading={isLoading}
                description="Unique visitor sessions"
              />
              
              <MetricListItem
                title="Unique IP Addresses"
                value={data.totalUniqueIPs}
                icon={<Globe className="h-4 w-4" />}
                isLoading={isLoading}
                description="Distinct IPs accessing the site"
              />
              
              <MetricListItem
                title="Authenticated Users"
                value={data.totalAuthenticatedUsers}
                icon={<UserCheck className="h-4 w-4" />}
                isLoading={isLoading}
                description="Signed-in users"
              />
              
              <MetricListItem
                title="Unauthenticated Users"
                value={data.totalUnauthenticatedUsers}
                icon={<UserX className="h-4 w-4" />}
                isLoading={isLoading}
                description="Unsigned users"
              />
              
              <MetricListItem
                title="Bounce Count"
                value={data.totalBounces}
                icon={<Activity className="h-4 w-4" />}
                isLoading={isLoading}
                description="Single page visits"
              />
              
              <MetricListItem
                title="Bounce Rate"
                value={data.bounceRate}
                icon={<Activity className="h-4 w-4" />}
                isLoading={isLoading}
                description="Percentage of single page visits"
                suffix="%"
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  isLoading: boolean;
  description: string;
  suffix?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, isLoading, description, suffix = '' }) => (
  <div className="bg-card rounded-lg p-4 border shadow-sm">
    <div className="flex items-center justify-between">
      <div className="bg-primary/10 rounded p-2">{icon}</div>
      <span className="text-xs text-muted-foreground">{description}</span>
    </div>
    <h3 className="text-sm font-medium mt-2">{title}</h3>
    <div className="text-2xl font-bold mt-1">
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          {formatNumber(value)}
          {suffix}
        </>
      )}
    </div>
  </div>
);

interface MetricListItemProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  isLoading: boolean;
  description: string;
  suffix?: string;
}

const MetricListItem: React.FC<MetricListItemProps> = ({ title, value, icon, isLoading, description, suffix = '' }) => (
  <div className="flex items-center justify-between p-3 rounded-lg border">
    <div className="flex items-center gap-3">
      <div className="bg-primary/10 rounded p-2">{icon}</div>
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
    <div className="text-xl font-bold">
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          {formatNumber(value)}
          {suffix}
        </>
      )}
    </div>
  </div>
);